mod ai;
mod sync;
mod update;

use std::path::PathBuf;
use std::sync::Mutex;

use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

/// Folder of the last save, so the next save dialog opens there.
#[derive(Default)]
struct LastDir(Mutex<Option<PathBuf>>);

/// Asks where to save, then writes the bytes sent by the page.
/// Returns the chosen path, or None when the person cancels.
#[tauri::command]
async fn save_file(
    app: AppHandle,
    last_dir: State<'_, LastDir>,
    request: Request<'_>,
) -> Result<Option<String>, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("Données de fichier manquantes".into());
    };
    let name = request
        .headers()
        .get("x-filename")
        .and_then(|v| v.to_str().ok())
        .map(|v| percent_encoding::percent_decode_str(v).decode_utf8_lossy().into_owned())
        .unwrap_or_else(|| "photo".into());

    let mut dialog = app.dialog().file().set_file_name(&name);
    if let Some(dir) = last_dir.0.lock().unwrap().clone() {
        dialog = dialog.set_directory(dir);
    }
    let Some(chosen) = dialog.blocking_save_file() else {
        return Ok(None);
    };
    let path = chosen.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&path, bytes).map_err(|e| format!("Écriture impossible : {e}"))?;
    *last_dir.0.lock().unwrap() = path.parent().map(PathBuf::from);
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(LastDir::default())
        .manage(sync::SyncState::default())
        .manage(update::Pending::default())
        .manage(ai::AiState::default())
        .setup(|app| {
            sync::load(app.handle());
            Ok(())
        })
        .register_asynchronous_uri_scheme_protocol("prismsync", sync::protocol)
        .invoke_handler(tauri::generate_handler![
            save_file,
            sync::sync_folder,
            sync::sync_choose,
            sync::sync_stop,
            sync::db_scan,
            sync::db_get,
            sync::db_set,
            sync::db_delete,
            sync::asset_put,
            sync::asset_delete,
            sync::asset_usage,
            update::update_check,
            update::update_install,
            ai::ai_status,
            ai::ai_load,
            ai::ai_unload,
            ai::ai_run
        ])
        .run(tauri::generate_context!())
        .expect("error while running Prism");
}
