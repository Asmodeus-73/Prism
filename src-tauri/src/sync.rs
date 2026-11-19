//! Folder sync: Prism's cloud-sync layer (a document database plus a file
//! store) backed by a folder the person picks, which they can keep in sync
//! between computers with Syncthing, iCloud Drive or Dropbox.
//!
//! Layout inside the chosen folder:
//!   Prism-donnees/docs/<collection>/<id>.json
//!   Prism-donnees/assets/<id>

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::http::{header, Response, StatusCode};
use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Manager, Runtime, State, UriSchemeContext, UriSchemeResponder};
use tauri_plugin_dialog::DialogExt;

const DATA_DIR: &str = "Prism-donnees";

/// Where the app's own page is served from (macOS/Linux, then Windows).
const APP_ORIGINS: [&str; 3] = ["tauri://localhost", "http://tauri.localhost", "https://tauri.localhost"];

#[derive(Default)]
pub struct SyncState(Mutex<Option<PathBuf>>);

impl SyncState {
    fn root(&self) -> Result<PathBuf, String> {
        self.0
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| "Aucun dossier de synchronisation".to_string())
    }
}

fn config_file<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("sync-folder.txt"))
}

/// Restores the folder chosen in an earlier session.
pub fn load<R: Runtime>(app: &AppHandle<R>) {
    let Some(file) = config_file(app) else { return };
    let Ok(folder) = fs::read_to_string(file) else { return };
    let folder = PathBuf::from(folder.trim());
    if folder.is_dir() {
        *app.state::<SyncState>().0.lock().unwrap() = Some(folder.join(DATA_DIR));
    }
}

/// Names Windows refuses for a file, whatever the extension (CON, NUL.json, COM1...).
fn reserved_on_windows(name: &str) -> bool {
    let stem = name.split('.').next().unwrap_or("").to_ascii_uppercase();
    matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || (stem.len() == 4
            && (stem.starts_with("COM") || stem.starts_with("LPT"))
            && stem.as_bytes()[3].is_ascii_digit()
            && stem.as_bytes()[3] != b'0')
}

/// Only plain names: no separators, no "..", nothing hidden, nothing Windows refuses.
fn safe(name: &str) -> Result<&str, String> {
    let ok = !name.is_empty()
        && name.len() <= 200
        && !name.starts_with('.')
        && !name.ends_with('.')
        && !reserved_on_windows(name)
        && name.chars().all(|c| c.is_ascii_alphanumeric() || "-_.".contains(c));
    if ok { Ok(name) } else { Err(format!("Nom invalide : {name}")) }
}

/// "a/b" is stored as "a__b": a part may not hold "__" itself, or "a/b" and "a__b" would share a folder.
fn collection_dir(root: &Path, col: &str) -> Result<PathBuf, String> {
    let parts: Vec<&str> = col
        .split('/')
        .map(|p| if p.contains("__") { Err(format!("Nom invalide : {p}")) } else { safe(p) })
        .collect::<Result<_, _>>()?;
    Ok(root.join("docs").join(parts.join("__")))
}

static TMP_COUNTER: AtomicUsize = AtomicUsize::new(0);

/// Write to a temporary file then rename, so a synced copy is never half written.
fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let dir = path.parent().ok_or("Chemin invalide")?;
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let tmp = dir.join(format!(
        ".{}.{}.tmp",
        path.file_name().and_then(|n| n.to_str()).unwrap_or("prism"),
        TMP_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    fs::write(&tmp, bytes).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

fn millis(t: SystemTime) -> u64 {
    t.duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

#[tauri::command]
pub fn sync_folder(state: State<'_, SyncState>) -> Option<String> {
    state
        .0
        .lock()
        .unwrap()
        .as_ref()
        .and_then(|p| p.parent())
        .map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn sync_choose(app: AppHandle, state: State<'_, SyncState>) -> Result<Option<String>, String> {
    let Some(picked) = app.dialog().file().set_title("Dossier de synchronisation").blocking_pick_folder() else {
        return Ok(None);
    };
    let folder = picked.into_path().map_err(|e| e.to_string())?;
    let data = folder.join(DATA_DIR);
    fs::create_dir_all(data.join("docs")).map_err(|e| e.to_string())?;
    fs::create_dir_all(data.join("assets")).map_err(|e| e.to_string())?;
    if let Some(file) = config_file(&app) {
        if let Some(dir) = file.parent() {
            fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        fs::write(file, folder.to_string_lossy().as_bytes()).map_err(|e| e.to_string())?;
    }
    *state.0.lock().unwrap() = Some(data);
    Ok(Some(folder.to_string_lossy().into_owned()))
}

#[tauri::command]
pub fn sync_stop(app: AppHandle, state: State<'_, SyncState>) -> Result<(), String> {
    if let Some(file) = config_file(&app) {
        let _ = fs::remove_file(file);
    }
    *state.0.lock().unwrap() = None;
    Ok(())
}

#[derive(Serialize)]
pub struct DocStamp {
    id: String,
    mtime: u64,
    size: u64,
}

/// Lists a collection's documents with their modification time, so the page
/// only reads the ones that changed.
#[tauri::command]
pub fn db_scan(state: State<'_, SyncState>, col: String) -> Result<Vec<DocStamp>, String> {
    let dir = collection_dir(&state.root()?, &col)?;
    let Ok(entries) = fs::read_dir(&dir) else { return Ok(vec![]) };
    let mut out = vec![];
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        // Skip temporary files and the conflict copies sync tools leave behind.
        let Some(id) = name.strip_suffix(".json") else { continue };
        if id.starts_with('.') || id.contains(".sync-conflict") || safe(id).is_err() {
            continue;
        }
        if let Ok(meta) = entry.metadata() {
            out.push(DocStamp {
                id: id.to_string(),
                mtime: meta.modified().map(millis).unwrap_or(0),
                size: meta.len(),
            });
        }
    }
    Ok(out)
}

#[tauri::command]
pub fn db_get(state: State<'_, SyncState>, col: String, id: String) -> Result<Option<String>, String> {
    let path = collection_dir(&state.root()?, &col)?.join(format!("{}.json", safe(&id)?));
    match fs::read_to_string(path) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn db_set(state: State<'_, SyncState>, col: String, id: String, json: String) -> Result<(), String> {
    let path = collection_dir(&state.root()?, &col)?.join(format!("{}.json", safe(&id)?));
    write_atomic(&path, json.as_bytes())
}

#[tauri::command]
pub fn db_delete(state: State<'_, SyncState>, col: String, id: String) -> Result<(), String> {
    let path = collection_dir(&state.root()?, &col)?.join(format!("{}.json", safe(&id)?));
    match fs::remove_file(path) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.to_string()),
        _ => Ok(()),
    }
}

/// Stores a file sent by the page. The id carries an extension so the file
/// can be served back with the right type.
#[tauri::command]
pub fn asset_put(state: State<'_, SyncState>, request: Request<'_>) -> Result<String, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("Données de fichier manquantes".into());
    };
    let kind = request
        .headers()
        .get("x-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let ext = match kind {
        "image/png" => "png",
        "image/jpeg" => "jpg",
        "image/webp" => "webp",
        "application/json" => "json",
        _ => "bin",
    };
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    let id = format!("{:x}{:08x}.{ext}", nanos, rand_u32());
    write_atomic(&state.root()?.join("assets").join(&id), bytes)?;
    Ok(id)
}

fn rand_u32() -> u32 {
    use std::collections::hash_map::RandomState;
    use std::hash::{BuildHasher, Hasher};
    let mut h = RandomState::new().build_hasher();
    h.write_u64(millis(SystemTime::now()));
    h.finish() as u32
}

#[tauri::command]
pub fn asset_delete(state: State<'_, SyncState>, id: String) -> Result<(), String> {
    match fs::remove_file(state.root()?.join("assets").join(safe(&id)?)) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.to_string()),
        _ => Ok(()),
    }
}

#[tauri::command]
pub fn asset_usage(state: State<'_, SyncState>) -> Result<u64, String> {
    let dir = state.root()?.join("assets");
    Ok(fs::read_dir(dir)
        .map(|it| it.flatten().filter_map(|e| e.metadata().ok()).map(|m| m.len()).sum())
        .unwrap_or(0))
}

fn content_type(id: &str) -> &'static str {
    match id.rsplit('.').next() {
        Some("png") => "image/png",
        Some("jpg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("json") => "application/json",
        _ => "application/octet-stream",
    }
}

/// Requests currently waiting for a file that is still syncing: past this many,
/// a missing file answers "not found" at once instead of holding one more thread.
const MAX_WAITING: usize = 8;
static WAITING: AtomicUsize = AtomicUsize::new(0);

/// Serves stored files to the page at prismsync://localhost/<id>
/// (http://prismsync.localhost/<id> on Windows). A file that another
/// computer has not finished syncing yet is waited for a little while.
pub fn protocol<R: Runtime>(ctx: UriSchemeContext<'_, R>, request: tauri::http::Request<Vec<u8>>, responder: UriSchemeResponder) {
    let root = ctx.app_handle().state::<SyncState>().root();
    let id = request.uri().path().trim_start_matches('/').to_string();
    // Only Prism's own page may read the files (not a web page opened from a link).
    let origin = request
        .headers()
        .get(header::ORIGIN)
        .and_then(|v| v.to_str().ok())
        .filter(|o| APP_ORIGINS.contains(o))
        .unwrap_or(APP_ORIGINS[0])
        .to_string();
    std::thread::spawn(move || {
        let found = root.ok().and_then(|root| {
            let id = safe(&id).ok()?;
            let path = root.join("assets").join(id);
            if let Ok(bytes) = fs::read(&path) {
                return Some(bytes);
            }
            if WAITING.fetch_add(1, Ordering::SeqCst) >= MAX_WAITING {
                WAITING.fetch_sub(1, Ordering::SeqCst);
                return None;
            }
            let mut found = None;
            for _ in 0..20 {
                std::thread::sleep(Duration::from_millis(500));
                if let Ok(bytes) = fs::read(&path) {
                    found = Some(bytes);
                    break;
                }
            }
            WAITING.fetch_sub(1, Ordering::SeqCst);
            found
        });
        let res = Response::builder()
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, origin)
            .header(header::VARY, "Origin")
            // the page is cross-origin isolated (COEP): stored files must say they may be embedded
            .header("Cross-Origin-Resource-Policy", "cross-origin");
        let res = match found {
            Some(bytes) => res
                .header(header::CONTENT_TYPE, content_type(&id))
                .header(header::CACHE_CONTROL, "max-age=31536000, immutable")
                .body(bytes),
            None => res.status(StatusCode::NOT_FOUND).body(Vec::new()),
        };
        responder.respond(res.unwrap());
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Attaque : un nom piégé ne doit jamais sortir du dossier de synchronisation.
    #[test]
    fn names_cannot_escape_the_folder() {
        for bad in ["..", "../etc", "..\\x", "a/b", "/abs", "C:\\x", ".cache", "", "a\0b", "é", &"x".repeat(201)] {
            assert!(safe(bad).is_err(), "{bad:?} accepté");
        }
        assert!(safe("p_1234.json").is_ok());
        let root = Path::new("/r");
        assert!(collection_dir(root, "../x").is_err());
        assert!(collection_dir(root, "a/../../x").is_err());
        assert_eq!(collection_dir(root, "a/b").unwrap(), root.join("docs").join("a__b"));
    }

    /// Windows refuse ces noms : un document ainsi nommé ne se synchroniserait jamais.
    #[test]
    fn windows_reserved_names_are_refused() {
        for bad in ["CON", "nul", "NUL.json", "com1", "LPT9.txt", "aux", "x."] {
            assert!(safe(bad).is_err(), "{bad:?} accepté");
        }
        for good in ["COM0", "COMET", "console", "nullable.json", "lpt"] {
            assert!(safe(good).is_ok(), "{good:?} refusé");
        }
    }

    /// "a/b" et "a__b" ne doivent pas tomber dans le même dossier.
    #[test]
    fn collections_do_not_collide() {
        let root = Path::new("/r");
        assert!(collection_dir(root, "a__b").is_err());
        assert!(collection_dir(root, "a/b").is_ok());
    }

    /// Deux écritures du même document ne partagent pas de fichier temporaire.
    #[test]
    fn concurrent_writes_use_distinct_temporaries() {
        let dir = std::env::temp_dir().join(format!("prism-sync-{}", std::process::id()));
        let file = dir.join("doc.json");
        let threads: Vec<_> = (0..8)
            .map(|i| {
                let file = file.clone();
                std::thread::spawn(move || write_atomic(&file, format!("{{\"n\":{i}}}").as_bytes()))
            })
            .collect();
        for t in threads {
            t.join().unwrap().unwrap();
        }
        let text = fs::read_to_string(&file).unwrap();
        assert!(text.starts_with("{\"n\":"));
        assert_eq!(fs::read_dir(&dir).unwrap().count(), 1, "fichier temporaire oublié");
        let _ = fs::remove_dir_all(&dir);
    }
}
