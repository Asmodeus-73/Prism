//! Tethered shooting through a watched folder: the camera maker's own app
//! (EOS Utility, Nikon NX Tether, Sony Imaging Edge, Fujifilm X Acquire...)
//! or a card reader writes each new photo into a folder, and Prism opens it
//! as soon as the file is complete.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::Serialize;
use tauri::ipc::Response;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_dialog::DialogExt;

const PHOTO_EXT: [&str; 22] = [
    "jpg", "jpeg", "png", "tif", "tiff", "heic", "heif", "avif", "webp", "dng", "cr2", "cr3", "crw", "nef", "nrw", "arw",
    "srf", "sr2", "raf", "orf", "rw2", "pef",
];

#[derive(Default)]
pub struct TetherState(Mutex<Option<(PathBuf, Arc<AtomicBool>)>>);

#[derive(Clone, Serialize)]
struct NewPhoto {
    path: String,
    name: String,
}

fn is_photo(p: &Path) -> bool {
    let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
    !name.starts_with('.')
        && p.extension()
            .and_then(|e| e.to_str())
            .is_some_and(|e| PHOTO_EXT.contains(&e.to_ascii_lowercase().as_str()))
}

/// Photos in the folder and its subfolders (camera apps often make one per day), two levels deep.
fn scan(dir: &Path, depth: u32, out: &mut HashMap<PathBuf, u64>) {
    let Ok(rd) = fs::read_dir(dir) else { return };
    for e in rd.flatten() {
        let p = e.path();
        let Ok(m) = e.metadata() else { continue };
        if m.is_dir() {
            if depth < 2 && !p.file_name().and_then(|n| n.to_str()).unwrap_or(".").starts_with('.') {
                scan(&p, depth + 1, out);
            }
        } else if m.is_file() && is_photo(&p) {
            out.insert(p, m.len());
        }
    }
}

fn watch(app: AppHandle, dir: PathBuf, stop: Arc<AtomicBool>) {
    let mut seen = HashMap::new();
    scan(&dir, 0, &mut seen); // photos already there are not opened
    let mut growing: HashMap<PathBuf, u64> = HashMap::new();
    while !stop.load(Ordering::Relaxed) {
        std::thread::sleep(Duration::from_millis(700));
        let mut now = HashMap::new();
        scan(&dir, 0, &mut now);
        for (p, len) in now {
            if seen.contains_key(&p) {
                continue;
            }
            // a file still being written changes size: it is opened once two looks agree
            if len > 0 && growing.get(&p) == Some(&len) {
                growing.remove(&p);
                let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("photo").to_string();
                let _ = app.emit("tether-photo", NewPhoto { path: p.to_string_lossy().into_owned(), name });
                seen.insert(p, len);
            } else {
                growing.insert(p, len);
            }
        }
    }
}

/// The watched folder, if any.
#[tauri::command]
pub fn tether_folder(state: State<'_, TetherState>) -> Option<String> {
    state.0.lock().unwrap().as_ref().map(|(d, _)| d.to_string_lossy().into_owned())
}

/// Asks for the folder the camera app writes into and starts watching it.
#[tauri::command]
pub async fn tether_start(app: AppHandle, state: State<'_, TetherState>) -> Result<Option<String>, String> {
    // development builds can be pointed at a folder without the dialog (automated tests)
    #[cfg(debug_assertions)]
    let forced = std::env::var("PRISM_TETHER_DIR").ok().map(PathBuf::from);
    #[cfg(not(debug_assertions))]
    let forced: Option<PathBuf> = None;
    let dir = match forced {
        Some(d) => d,
        None => {
            let Some(picked) = app.dialog().file().set_title("Dossier où arrivent les photos").blocking_pick_folder() else {
                return Ok(None);
            };
            picked.into_path().map_err(|e| e.to_string())?
        }
    };
    let stop = Arc::new(AtomicBool::new(false));
    if let Some((_, old)) = state.0.lock().unwrap().replace((dir.clone(), stop.clone())) {
        old.store(true, Ordering::Relaxed);
    }
    let app2 = app.clone();
    let dir2 = dir.clone();
    std::thread::spawn(move || watch(app2, dir2, stop));
    Ok(Some(dir.to_string_lossy().into_owned()))
}

#[tauri::command]
pub fn tether_stop(state: State<'_, TetherState>) {
    if let Some((_, stop)) = state.0.lock().unwrap().take() {
        stop.store(true, Ordering::Relaxed);
    }
}

/// Reads a photo announced by the watcher (only inside the watched folder).
#[tauri::command]
pub fn tether_read(path: String, state: State<'_, TetherState>) -> Result<Response, String> {
    let dir = state.0.lock().unwrap().as_ref().map(|(d, _)| d.clone()).ok_or("Aucun dossier surveillé")?;
    let p = fs::canonicalize(&path).map_err(|e| e.to_string())?;
    let root = fs::canonicalize(&dir).map_err(|e| e.to_string())?;
    if !p.starts_with(&root) || !is_photo(&p) {
        return Err("Fichier hors du dossier surveillé".into());
    }
    fs::read(&p).map(Response::new).map_err(|e| format!("Lecture impossible : {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn photos_only() {
        assert!(is_photo(Path::new("/a/IMG_0001.CR3")));
        assert!(is_photo(Path::new("/a/DSC0001.jpg")));
        assert!(!is_photo(Path::new("/a/._DSC0001.jpg")));
        assert!(!is_photo(Path::new("/a/notes.txt")));
    }

    #[test]
    fn new_complete_files_are_found() {
        let dir = std::env::temp_dir().join(format!("prism-tether-{}", std::process::id()));
        fs::create_dir_all(dir.join("2026-10-20")).unwrap();
        fs::write(dir.join("old.jpg"), b"x").unwrap();
        let mut a = HashMap::new();
        scan(&dir, 0, &mut a);
        fs::write(dir.join("2026-10-20").join("new.NEF"), b"xyz").unwrap();
        let mut b = HashMap::new();
        scan(&dir, 0, &mut b);
        let fresh: Vec<_> = b.keys().filter(|p| !a.contains_key(*p)).collect();
        assert_eq!(fresh.len(), 1);
        assert!(fresh[0].ends_with("2026-10-20/new.NEF"));
        fs::remove_dir_all(dir).unwrap();
    }
}
