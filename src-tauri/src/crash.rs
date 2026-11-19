//! Native crash log: a panic in Prism's Rust code is written to crash.log in the app's
//! log folder, so "Signaler un problème" can include it (the page's own journal only sees
//! JavaScript errors). Nothing leaves the computer unless the person sends the report.

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use tauri::{AppHandle, Manager, Runtime};

static FILE: OnceLock<PathBuf> = OnceLock::new();

/// The log keeps its last 64 KB.
const MAX: usize = 64 * 1024;

pub fn install<R: Runtime>(app: &AppHandle<R>) {
    let Ok(dir) = app.path().app_log_dir() else { return };
    let _ = FILE.set(dir.join("crash.log"));
    set_hook();
}

fn set_hook() {
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        if let Some(path) = FILE.get() {
            let thread = std::thread::current();
            let entry = format!(
                "{} · Prism {} · {} · fil {}\n{}\n{}\n\n",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_secs())
                    .unwrap_or(0),
                env!("CARGO_PKG_VERSION"),
                std::env::consts::OS,
                thread.name().unwrap_or("?"),
                info,
                short(&std::backtrace::Backtrace::force_capture().to_string(), 1500),
            );
            append(path, &entry);
        }
        previous(info);
    }));
}

/// The first `max` bytes of a backtrace (its top frames), cut at a line end.
fn short(text: &str, max: usize) -> String {
    if text.len() <= max {
        return text.to_string();
    }
    let mut end = max;
    while !text.is_char_boundary(end) {
        end -= 1;
    }
    let cut = text[..end].rfind('\n').unwrap_or(end);
    format!("{}\n…", &text[..cut])
}

fn append(path: &Path, entry: &str) {
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    if fs::metadata(path).map(|m| m.len() as usize + entry.len() > MAX).unwrap_or(false) {
        if let Ok(old) = fs::read(path) {
            let keep = old.len().saturating_sub(MAX / 2);
            let _ = fs::write(path, &old[keep..]);
        }
    }
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = f.write_all(entry.as_bytes());
    }
}

/// The end of the crash log (at most `max` bytes, 4 KB by default), or None when there is none.
#[tauri::command]
pub fn crash_log(max: Option<usize>) -> Option<String> {
    let text = fs::read(FILE.get()?).ok()?;
    let max = max.unwrap_or(4096).min(MAX);
    let start = text.len().saturating_sub(max);
    let s = String::from_utf8_lossy(&text[start..]).into_owned();
    (!s.trim().is_empty()).then_some(s)
}

#[tauri::command]
pub fn crash_log_clear() -> Result<(), String> {
    match FILE.get() {
        Some(p) if p.exists() => fs::remove_file(p).map_err(|e| e.to_string()),
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A panic on any thread ends up in the log, with its message and place.
    #[test]
    fn a_panic_is_written() {
        let dir = std::env::temp_dir().join(format!("prism-crash-hook-{}", std::process::id()));
        let _ = FILE.set(dir.join("crash.log"));
        set_hook();
        let _ = std::thread::Builder::new().name("essai".into()).spawn(|| panic!("plantage volontaire")).unwrap().join();
        let _ = std::panic::take_hook();
        let text = crash_log(None).unwrap_or_default();
        assert!(text.contains("plantage volontaire") && text.contains("fil essai") && text.contains("crash.rs"), "{text}");
        crash_log_clear().unwrap();
        assert!(crash_log(None).is_none());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn the_log_stays_small() {
        let dir = std::env::temp_dir().join(format!("prism-crash-{}", std::process::id()));
        let path = dir.join("crash.log");
        let entry = "x".repeat(1000) + "\n";
        for _ in 0..200 {
            append(&path, &entry);
        }
        let len = fs::metadata(&path).unwrap().len() as usize;
        assert!(len <= MAX, "{len}");
        assert!(len > MAX / 4);
        let _ = fs::remove_dir_all(&dir);
    }
}
