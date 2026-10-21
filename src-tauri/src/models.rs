//! AI models on demand: the app ships without its model files and fetches each
//! one the first time it is needed, then keeps it in the cache folder.
//! The page asks for prismmodel://localhost/<sha256>/<path in web/>; the hash comes
//! from the list scripts/prepare.mjs builds into the app, so a file is only
//! served when its content matches it, whoever answered the download.

use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use sha2::{Digest, Sha256};
use tauri::http::{header, Response, StatusCode};
use tauri::{Manager, Runtime, UriSchemeContext, UriSchemeResponder};

const APP_ORIGINS: [&str; 3] = ["tauri://localhost", "http://tauri.localhost", "https://tauri.localhost"];
/// Files stored once by their hash (any version of Prism finds its own there), then the site as a fallback.
const SOURCES: [&str; 2] = [
    "https://github.com/Asmodeus-73/Prism/releases/download/modeles/",
    "https://asmodeus-73.github.io/Prism/app/",
];

/// Development builds can be pointed at a local copy of web/ (PRISM_MODELS_URL=http://127.0.0.1:port/).
fn sources(rel: &str) -> Vec<String> {
    #[cfg(debug_assertions)]
    if let Ok(dev) = std::env::var("PRISM_MODELS_URL") {
        return vec![String::new(), dev];
    }
    // files published only in the release (never on the site): the site fallback is not tried for them
    let n = if rel.starts_with("sd-inpaint/") { 1 } else { SOURCES.len() };
    SOURCES.iter().take(n).map(|s| s.to_string()).collect()
}

fn is_hash(s: &str) -> bool {
    s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
}

fn is_rel_path(p: &str) -> bool {
    !p.is_empty()
        && p.len() <= 300
        && p.split('/').all(|s| !s.is_empty() && s != "." && s != ".." && !s.starts_with('.'))
        && p.bytes().all(|b| b.is_ascii_alphanumeric() || b"-_./".contains(&b))
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn client() -> Result<reqwest::Client, String> {
    if rustls::crypto::CryptoProvider::get_default().is_none() {
        let _ = rustls::crypto::ring::default_provider().install_default();
    }
    reqwest::Client::builder()
        .user_agent(concat!("Prism/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| e.to_string())
}

async fn download(hash: &str, rel: &str) -> Result<Vec<u8>, String> {
    let client = client()?;
    let mut last = String::from("aucune source");
    for (i, base) in sources(rel).iter().enumerate() {
        if base.is_empty() {
            continue;
        }
        let url = if i == 0 { format!("{base}{hash}") } else { format!("{base}{rel}") };
        let res = match client.get(&url).send().await {
            Ok(r) if r.status().is_success() => r,
            Ok(r) => {
                last = format!("{url} : {}", r.status());
                continue;
            }
            Err(e) => {
                last = e.to_string();
                continue;
            }
        };
        match res.bytes().await {
            Ok(b) if hex(&Sha256::digest(&b)) == hash => return Ok(b.to_vec()),
            Ok(_) => last = format!("{url} : contenu inattendu"),
            Err(e) => last = e.to_string(),
        }
    }
    Err(last)
}

pub fn cache_dir<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    let dir = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("models");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

async fn get(dir: PathBuf, hash: String, rel: String) -> Result<Vec<u8>, String> {
    let path = dir.join(&hash);
    if let Ok(bytes) = fs::read(&path) {
        // written only after its hash was checked, but a damaged disk copy is fetched again
        if hex(&Sha256::digest(&bytes)) == hash {
            return Ok(bytes);
        }
    }
    let bytes = download(&hash, &rel).await?;
    let tmp = dir.join(format!("{hash}.{}.part", std::process::id()));
    let saved = fs::File::create(&tmp).and_then(|mut f| f.write_all(&bytes)).and_then(|_| fs::rename(&tmp, &path));
    if saved.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    Ok(bytes)
}

// ---- large files (generative fill): streamed to disk, resumable, never sent to the page ----

/// Marker written once a cached file passed its hash check: its size and modification time at that moment.
/// It spares hashing 1.7 GB at every launch; a file changed afterwards no longer matches it.
fn marker(path: &Path) -> Option<String> {
    let m = fs::metadata(path).ok()?;
    let t = m.modified().ok()?.duration_since(std::time::UNIX_EPOCH).ok()?.as_secs();
    Some(format!("{} {}", m.len(), t))
}

fn marker_path(dir: &Path, hash: &str) -> PathBuf {
    dir.join(format!("{hash}.ok"))
}

fn hash_file(path: &Path, cancel: &AtomicBool) -> Result<String, String> {
    let mut f = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut h = Sha256::new();
    let mut buf = vec![0u8; 1 << 20];
    loop {
        if cancel.load(Ordering::Relaxed) {
            return Err("annulé".into());
        }
        let n = f.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        h.update(&buf[..n]);
    }
    Ok(hex(&h.finalize()))
}

/// Is the file already in the cache and intact? (hash checked the first time, then remembered)
pub fn cached(dir: &Path, hash: &str) -> bool {
    let path = dir.join(hash);
    matches!((marker(&path), fs::read_to_string(marker_path(dir, hash))), (Some(a), Ok(b)) if a == b)
}

/// Makes sure `rel` is in the cache folder under its hash and returns its path. Downloads it when needed
/// (streamed to `<hash>.part`, resumed after an interruption, hash checked before it gets its final name).
/// `on` receives (bytes done, bytes total) of this file; `verify` is called when the disk copy is being hashed.
pub async fn ensure(
    dir: &Path,
    hash: &str,
    rel: &str,
    cancel: &Arc<AtomicBool>,
    on: &(dyn Fn(u64, u64) + Sync),
    verify: &(dyn Fn() + Sync),
) -> Result<PathBuf, String> {
    let path = dir.join(hash);
    if path.is_file() {
        if cached(dir, hash) {
            return Ok(path);
        }
        verify();
        let (p, c) = (path.clone(), cancel.clone());
        let got = tauri::async_runtime::spawn_blocking(move || hash_file(&p, &c))
            .await
            .map_err(|e| e.to_string())??;
        if got == hash {
            if let Some(m) = marker(&path) {
                let _ = fs::write(marker_path(dir, hash), m);
            }
            return Ok(path);
        }
        let _ = fs::remove_file(&path);
    }
    let client = client()?;
    let part = dir.join(format!("{hash}.part"));
    let mut last = String::from("aucune source");
    for (i, base) in sources(rel).iter().enumerate() {
        if base.is_empty() {
            continue;
        }
        let url = if i == 0 { format!("{base}{hash}") } else { format!("{base}{rel}") };
        match fetch_part(&client, &url, &part, hash, cancel, on).await {
            Ok(()) => {
                fs::rename(&part, &path).map_err(|e| e.to_string())?;
                if let Some(m) = marker(&path) {
                    let _ = fs::write(marker_path(dir, hash), m);
                }
                return Ok(path);
            }
            Err(e) if e == "annulé" => return Err(e),
            Err(e) => last = format!("{url} : {e}"),
        }
    }
    Err(last)
}

async fn fetch_part(
    client: &reqwest::Client,
    url: &str,
    part: &Path,
    hash: &str,
    cancel: &AtomicBool,
    on: &(dyn Fn(u64, u64) + Sync),
) -> Result<(), String> {
    let have = fs::metadata(part).map(|m| m.len()).unwrap_or(0);
    let mut req = client.get(url);
    if have > 0 {
        req = req.header(header::RANGE, format!("bytes={have}-"));
    }
    let mut res = req.send().await.map_err(|e| e.to_string())?;
    let status = res.status();
    if status == StatusCode::RANGE_NOT_SATISFIABLE {
        let _ = fs::remove_file(part);
        return Err("reprise impossible, nouvel essai".into());
    }
    if !status.is_success() {
        return Err(status.to_string());
    }
    // 206: the server continues where the part stops; 200: it starts over
    let resume = status == StatusCode::PARTIAL_CONTENT && have > 0;
    let total = res.content_length().unwrap_or(0) + if resume { have } else { 0 };
    let mut hasher = Sha256::new();
    let mut done = 0u64;
    let mut file = if resume {
        let mut f = fs::File::open(part).map_err(|e| e.to_string())?;
        let mut buf = vec![0u8; 1 << 20];
        loop {
            let n = f.read(&mut buf).map_err(|e| e.to_string())?;
            if n == 0 {
                break;
            }
            hasher.update(&buf[..n]);
        }
        done = have;
        fs::OpenOptions::new().append(true).open(part).map_err(|e| e.to_string())?
    } else {
        fs::File::create(part).map_err(|e| e.to_string())?
    };
    on(done, total);
    while let Some(chunk) = res.chunk().await.map_err(|e| e.to_string())? {
        if cancel.load(Ordering::Relaxed) {
            return Err("annulé".into());
        }
        hasher.update(&chunk);
        file.write_all(&chunk).map_err(|e| format!("écriture impossible : {e}"))?;
        done += chunk.len() as u64;
        on(done, total);
    }
    drop(file);
    if hex(&hasher.finalize()) != hash {
        let _ = fs::remove_file(part);
        return Err("contenu inattendu".into());
    }
    Ok(())
}

pub fn protocol<R: Runtime>(ctx: UriSchemeContext<'_, R>, request: tauri::http::Request<Vec<u8>>, responder: UriSchemeResponder) {
    let origin = request
        .headers()
        .get(header::ORIGIN)
        .and_then(|v| v.to_str().ok())
        .filter(|o| APP_ORIGINS.contains(o))
        .unwrap_or(APP_ORIGINS[0])
        .to_string();
    // convertFileSrc encodes the slashes of <hash>/<path>
    let path = percent_encoding::percent_decode_str(request.uri().path().trim_start_matches('/'))
        .decode_utf8_lossy()
        .into_owned();
    let dir = cache_dir(ctx.app_handle());
    tauri::async_runtime::spawn(async move {
        let found = match (dir, path.split_once('/')) {
            (Ok(dir), Some((hash, rel))) if is_hash(hash) && is_rel_path(rel) => get(dir, hash.into(), rel.into()).await,
            (Err(e), _) => Err(e),
            _ => Err("adresse de modèle invalide".into()),
        };
        let res = Response::builder()
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, origin)
            .header(header::VARY, "Origin")
            .header("Cross-Origin-Resource-Policy", "cross-origin");
        let res = match found {
            Ok(bytes) => res
                .header(header::CONTENT_TYPE, "application/octet-stream")
                .header(header::CACHE_CONTROL, "no-store")
                .body(bytes),
            Err(e) => res
                .status(StatusCode::BAD_GATEWAY)
                .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
                .body(e.into_bytes()),
        };
        responder.respond(res.unwrap());
    });
}
