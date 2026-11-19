//! Project files on disk (.prism): the same zip as "Exporter le projet", written by the app.
//! The page never names a path on its own: a file is written or read only if the person
//! chose it in a system dialog, or opened it from the Finder or the Explorer (double-click,
//! "Ouvrir avec Prism"). Those files are remembered (recent.json) so that Cmd/Ctrl+S can
//! keep writing to the same file after a restart.

use std::collections::VecDeque;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Emitter, Manager, Runtime, State};
use tauri_plugin_dialog::DialogExt;

/// The most recent files, newest first.
const RECENT_MAX: usize = 20;

#[derive(Default)]
pub struct ProjectState {
    recent: Mutex<VecDeque<PathBuf>>,
    /// Files opened from the system before the page asked for them.
    pending: Mutex<Vec<PathBuf>>,
}

fn recent_file<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("recent.json"))
}

fn is_project(p: &Path) -> bool {
    p.extension().and_then(|e| e.to_str()).is_some_and(|e| e.eq_ignore_ascii_case("prism"))
}

fn same(a: &Path, b: &Path) -> bool {
    match (fs::canonicalize(a), fs::canonicalize(b)) {
        (Ok(x), Ok(y)) => x == y,
        _ => a == b,
    }
}

impl ProjectState {
    fn remember<R: Runtime>(&self, app: &AppHandle<R>, path: &Path) {
        let mut r = self.recent.lock().unwrap();
        r.retain(|p| !same(p, path));
        r.push_front(path.to_path_buf());
        r.truncate(RECENT_MAX);
        if let Some(file) = recent_file(app) {
            if let Some(dir) = file.parent() {
                let _ = fs::create_dir_all(dir);
            }
            let list: Vec<String> = r.iter().map(|p| p.to_string_lossy().into_owned()).collect();
            let _ = fs::write(file, serde_json::to_vec(&list).unwrap_or_default());
        }
    }

    /// Only files the person chose or opened (see the module comment).
    fn allowed(&self, path: &Path) -> bool {
        is_project(path) && self.recent.lock().unwrap().iter().any(|p| same(p, path))
    }
}

/// Restores the recent files and takes the .prism files given at launch (Windows, Linux).
pub fn load<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<ProjectState>();
    if let Some(Ok(text)) = recent_file(app).map(fs::read_to_string) {
        if let Ok(list) = serde_json::from_str::<Vec<String>>(&text) {
            *state.recent.lock().unwrap() = list.into_iter().map(PathBuf::from).filter(|p| is_project(p)).take(RECENT_MAX).collect();
        }
    }
    let launch: Vec<PathBuf> = std::env::args_os().skip(1).map(PathBuf::from).filter(|p| is_project(p) && p.is_file()).collect();
    for p in launch {
        opened(app, p);
    }
}

/// A .prism file opened from the system: remembered, then handed to the page
/// (now through an event, or later through project_pending when the page is not ready yet).
pub fn opened<R: Runtime>(app: &AppHandle<R>, path: PathBuf) {
    if !is_project(&path) {
        return;
    }
    let state = app.state::<ProjectState>();
    state.remember(app, &path);
    state.pending.lock().unwrap().push(path.clone());
    let _ = app.emit("project-opened", path.to_string_lossy().into_owned());
}

/// Write to a temporary file next to it then rename: a crash never leaves half a project.
fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let tmp = path.with_extension("prism~");
    fs::write(&tmp, bytes).map_err(|e| format!("Écriture impossible : {e}"))?;
    fs::rename(&tmp, path).map_err(|e| format!("Écriture impossible : {e}"))
}

fn body<'a>(request: &'a Request<'_>) -> Result<&'a [u8], String> {
    match request.body() {
        InvokeBody::Raw(bytes) => Ok(bytes),
        _ => Err("Données du projet manquantes".into()),
    }
}

fn header(request: &Request<'_>, name: &str) -> Option<String> {
    request
        .headers()
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(|v| percent_encoding::percent_decode_str(v).decode_utf8_lossy().into_owned())
}

/// Asks where to save the project (suggested name in x-filename), then writes it.
/// Returns the chosen path, or None when the person cancels.
#[tauri::command]
pub async fn project_save_as(app: AppHandle, state: State<'_, ProjectState>, request: Request<'_>) -> Result<Option<String>, String> {
    let bytes = body(&request)?;
    let name = header(&request, "x-filename").unwrap_or_else(|| "Projet.prism".into());
    let Some(chosen) = app.dialog().file().add_filter("Projet Prism", &["prism"]).set_file_name(&name).blocking_save_file() else {
        return Ok(None);
    };
    let mut path = chosen.into_path().map_err(|e| e.to_string())?;
    if !is_project(&path) {
        path.set_extension("prism");
    }
    write_atomic(&path, bytes)?;
    state.remember(&app, &path);
    Ok(Some(path.to_string_lossy().into_owned()))
}

/// Writes the project again to a file chosen earlier (x-path).
#[tauri::command]
pub fn project_save(app: AppHandle, state: State<'_, ProjectState>, request: Request<'_>) -> Result<(), String> {
    let bytes = body(&request)?;
    let path = PathBuf::from(header(&request, "x-path").ok_or("Chemin manquant")?);
    if !state.allowed(&path) {
        return Err("Fichier non choisi : utilisez Enregistrer dans un fichier…".into());
    }
    write_atomic(&path, bytes)?;
    state.remember(&app, &path);
    Ok(())
}

/// Asks which project file to open. Returns its path, or None when the person cancels.
#[tauri::command]
pub async fn project_open(app: AppHandle, state: State<'_, ProjectState>) -> Result<Option<String>, String> {
    let Some(chosen) = app.dialog().file().add_filter("Projet Prism", &["prism"]).blocking_pick_file() else {
        return Ok(None);
    };
    let path = chosen.into_path().map_err(|e| e.to_string())?;
    if !is_project(&path) {
        return Err("Ce n'est pas un projet Prism (.prism)".into());
    }
    state.remember(&app, &path);
    Ok(Some(path.to_string_lossy().into_owned()))
}

/// The bytes of a project file chosen or opened earlier.
#[tauri::command]
pub fn project_read(state: State<'_, ProjectState>, path: String) -> Result<tauri::ipc::Response, String> {
    let path = PathBuf::from(path);
    if !state.allowed(&path) {
        return Err("Fichier non choisi".into());
    }
    fs::read(&path).map(tauri::ipc::Response::new).map_err(|e| format!("Lecture impossible : {e}"))
}

/// Files opened from the system that the page has not taken yet.
#[tauri::command]
pub fn project_pending(state: State<'_, ProjectState>) -> Vec<String> {
    state.pending.lock().unwrap().drain(..).map(|p| p.to_string_lossy().into_owned()).collect()
}

/// The recent project files that still exist, newest first.
#[tauri::command]
pub fn project_recent(state: State<'_, ProjectState>) -> Vec<String> {
    state.recent.lock().unwrap().iter().filter(|p| p.is_file()).map(|p| p.to_string_lossy().into_owned()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Attaque : la page ne peut lire ni écrire un fichier que la personne n'a pas choisi.
    #[test]
    fn only_chosen_project_files() {
        let dir = std::env::temp_dir().join(format!("prism-project-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let chosen = dir.join("a.prism");
        fs::write(&chosen, b"x").unwrap();
        let s = ProjectState::default();
        s.recent.lock().unwrap().push_front(chosen.clone());
        assert!(s.allowed(&chosen));
        assert!(s.allowed(&dir.join(".").join("a.prism")));
        assert!(!s.allowed(&dir.join("b.prism")));
        assert!(!s.allowed(&dir.join("a.txt")));
        let other = dir.join("autre.json");
        fs::write(&other, b"{}").unwrap();
        assert!(!s.allowed(&other));
        assert!(!s.allowed(Path::new("/etc/passwd")));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn writes_are_atomic() {
        let dir = std::env::temp_dir().join(format!("prism-project-w-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let p = dir.join("a.prism");
        write_atomic(&p, b"un").unwrap();
        write_atomic(&p, b"deux").unwrap();
        assert_eq!(fs::read(&p).unwrap(), b"deux");
        assert!(!p.with_extension("prism~").exists());
        let _ = fs::remove_dir_all(&dir);
    }
}
