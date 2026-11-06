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
    tauri_build::build()
}
