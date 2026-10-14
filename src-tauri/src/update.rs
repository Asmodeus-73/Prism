//! Automatic updates: the page asks for the newest version at launch, shows
//! "Installer et relancer", and this installs it and restarts the app.

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, State};
use tauri_plugin_updater::{Update, UpdaterExt};

/// The update found by the last check, kept until it is installed.
#[derive(Default)]
pub struct Pending(Mutex<Option<Update>>);

#[derive(Serialize)]
pub struct Found {
    version: String,
    current: String,
    notes: Option<String>,
}

/// Returns the newer version, or None when the app is up to date
/// (or offline: a failed check is not worth bothering the person).
#[tauri::command]
pub async fn update_check(app: AppHandle, pending: State<'_, Pending>) -> Result<Option<Found>, String> {
    let update = app
        .updater()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?;
    let found = update.as_ref().map(|u| Found {
        version: u.version.clone(),
        current: u.current_version.clone(),
        notes: u.body.clone(),
    });
    *pending.0.lock().unwrap() = update;
    Ok(found)
}

/// Downloads and installs the pending update, then restarts Prism.
#[tauri::command]
pub async fn update_install(app: AppHandle, pending: State<'_, Pending>) -> Result<(), String> {
    let update = pending.0.lock().unwrap().take().ok_or("Aucune mise à jour en attente")?;
    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|e| format!("Installation impossible : {e}"))?;
    app.restart();
}
