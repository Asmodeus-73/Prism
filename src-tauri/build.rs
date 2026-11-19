fn main() {
    // Build time, compared with the release date by the updater (src/update.rs): a rebuild of
    // the same version is offered as an update. CI sets PRISM_BUILD_UNIX for each build, which
    // also makes Cargo rerun this script instead of reusing a cached, older time.
    println!("cargo:rerun-if-env-changed=PRISM_BUILD_UNIX");
    let t = std::env::var("PRISM_BUILD_UNIX").ok().filter(|v| v.parse::<i64>().is_ok()).unwrap_or_else(|| {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs().to_string())
            .unwrap_or_else(|_| "0".into())
    });
    println!("cargo:rustc-env=PRISM_BUILD_UNIX={t}");
    // Every command the page may call is declared here, then allowed one by one in
    // capabilities/default.json: a command missing from that list is refused.
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)))
        .expect("tauri build");
}

/// Same list as generate_handler! in src/lib.rs.
const COMMANDS: &[&str] = &[
    "save_file",
    "print_page",
    "report_issue",
    "sync_folder",
    "sync_choose",
    "sync_stop",
    "db_scan",
    "db_get",
    "db_set",
    "db_delete",
    "asset_put",
    "asset_delete",
    "asset_usage",
    "update_check",
    "update_install",
    "ai_status",
    "ai_load",
    "ai_unload",
    "ai_run",
    "sd_status",
    "sd_prepare",
    "sd_generate",
    "sd_cancel",
    "sd_unload",
    "raw_decode",
    "tether_folder",
    "tether_start",
    "tether_stop",
    "tether_read",
];
