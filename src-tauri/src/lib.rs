mod ai;
mod models;
mod raw;
mod sd;
mod sync;
mod tether;
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

/// Opens the system print dialog for the window (the page has laid out only the photo to print).
#[tauri::command]
fn print_page(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}

/// Opens a new GitHub issue for Prism in the default browser ("Signaler un problème").
/// Only that page is allowed, and no shell is involved (the URL reaches the opener as one argument).
#[tauri::command]
fn report_issue(url: String) -> Result<(), String> {
    if !issue_url_ok(&url) {
        return Err("adresse refusée".into());
    }
    #[cfg(target_os = "macos")]
    let mut cmd = std::process::Command::new("open");
    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = std::process::Command::new("rundll32");
        c.arg("url.dll,FileProtocolHandler");
        c
    };
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let mut cmd = std::process::Command::new("xdg-open");
    cmd.arg(&url).spawn().map(|_| ()).map_err(|e| e.to_string())
}

/// Only a new-issue page of the Prism repository, already percent-encoded (no space, quote or control character).
fn issue_url_ok(url: &str) -> bool {
    const BASE: &str = "https://github.com/Asmodeus-73/Prism/issues/new?";
    url.starts_with(BASE)
        && url.len() <= 8000
        && url.bytes().all(|b| b.is_ascii_graphic() && b != b'"' && b != b'\\' && b != b'`')
}

#[cfg(test)]
mod report_tests {
    use super::issue_url_ok;
    #[test]
    fn only_prism_issues() {
        assert!(issue_url_ok("https://github.com/Asmodeus-73/Prism/issues/new?title=a&body=b%20c"));
        for bad in [
            "https://evil.example/issues/new?x",
            "https://github.com/Asmodeus-73/Prism/issues/new?title=a b",
            "https://github.com/Asmodeus-73/Prism/issues/new?\"&calc",
            "https://github.com/Asmodeus-73/Prism/issues/new?a\nb",
            "file:///etc/passwd",
            "https://github.com/Asmodeus-73/Prism/issues/newx",
            "https://github.com/Asmodeus-73/Prism.evil.example/issues/new?",
        ] {
            assert!(!issue_url_ok(bad), "{bad}");
        }
        assert!(!issue_url_ok(&format!("https://github.com/Asmodeus-73/Prism/issues/new?{}", "a".repeat(9000))));
    }
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
        .manage(sd::SdState::default())
        .manage(tether::TetherState::default())
        .setup(|app| {
            sync::load(app.handle());
            Ok(())
        })
        .register_asynchronous_uri_scheme_protocol("prismsync", sync::protocol)
        .register_asynchronous_uri_scheme_protocol("prismmodel", models::protocol)
        .invoke_handler(tauri::generate_handler![
            save_file,
            print_page,
            report_issue,
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
            ai::ai_run,
            sd::sd_status,
            sd::sd_prepare,
            sd::sd_generate,
            sd::sd_cancel,
            sd::sd_unload,
            raw::raw_decode,
            tether::tether_folder,
            tether::tether_start,
            tether::tether_stop,
            tether::tether_read
        ])
        .run(tauri::generate_context!())
        .expect("error while running Prism");
}
