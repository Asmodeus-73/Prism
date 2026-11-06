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

/// When Prism was compiled (seconds since 1970, set by build.rs).
const BUILT: i64 = match i64::from_str_radix(env!("PRISM_BUILD_UNIX"), 10) {
    Ok(v) => v,
    Err(_) => 0,
};

/// A rebuild of the same version published this long after this copy was compiled
/// is offered as an update. The release of this very build is published within
/// minutes of it, so the margin keeps it from being offered again and again.
const SAME_VERSION_MARGIN: i64 = 2 * 3600;

fn rebuilt_later(published: Option<i64>, built: i64) -> bool {
    match published {
        Some(p) => built > 0 && p > built + SAME_VERSION_MARGIN,
        None => false,
    }
}

/// Returns the newer version, or None when the app is up to date
/// (or offline: a failed check is not worth bothering the person).
#[tauri::command]
pub async fn update_check(app: AppHandle, pending: State<'_, Pending>) -> Result<Option<Found>, String> {
    let update = app
        .updater_builder()
        .version_comparator(|current, remote| {
            // a higher version, or the same version rebuilt later (fixes shipped without a new number)
            if remote.version != current {
                return remote.version > current;
            }
            rebuilt_later(remote.pub_date.map(|d| d.unix_timestamp()), BUILT)
        })
        .build()
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_version_rebuild() {
        let built = 1_800_000_000;
        // the release of this very build, published 30 min later: not offered
        assert!(!rebuilt_later(Some(built + 1800), built));
        // a rebuild published the next day: offered
        assert!(rebuilt_later(Some(built + 86_400), built));
        // an older publication, no date, or an unknown build time: not offered
        assert!(!rebuilt_later(Some(built - 10), built));
        assert!(!rebuilt_later(None, built));
        assert!(!rebuilt_later(Some(built + 86_400), 0));
    }
}
