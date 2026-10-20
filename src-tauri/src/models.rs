//! AI models on demand: the app ships without its model files and fetches each
//! one the first time it is needed, then keeps it in the cache folder.
//! The page asks for prismmodel://localhost/<sha256>/<path in web/>; the hash comes
//! from the list scripts/prepare.mjs builds into the app, so a file is only
//! served when its content matches it, whoever answered the download.

use std::fs;
use std::io::Write;
use std::path::PathBuf;

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
fn sources() -> Vec<String> {
    #[cfg(debug_assertions)]
    if let Ok(dev) = std::env::var("PRISM_MODELS_URL") {
        return vec![String::new(), dev];
    }
    SOURCES.iter().map(|s| s.to_string()).collect()
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

async fn download(hash: &str, rel: &str) -> Result<Vec<u8>, String> {
    if rustls::crypto::CryptoProvider::get_default().is_none() {
        let _ = rustls::crypto::ring::default_provider().install_default();
    }
    let client = reqwest::Client::builder()
        .user_agent(concat!("Prism/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| e.to_string())?;
    let mut last = String::from("aucune source");
    for (i, base) in sources().iter().enumerate() {
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

fn cache_dir<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
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
