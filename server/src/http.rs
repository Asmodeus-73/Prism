//! Socle HTTP (spec sync-http) : réponses JSON sûres, erreurs, lecture bornée des corps.
use futures_util::StreamExt;
use serde_json::{Map, Value};
use std::borrow::Cow;
use worker::{Headers, Request, Response};

pub const MAX_BODY: usize = 4 << 20; // un manifeste de projet (JSON) : 4 Mio au plus

const CORS: [(&str, &str); 4] = [
    ("access-control-allow-origin", "*"),
    ("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS"),
    ("access-control-allow-headers", "authorization,content-type"),
    ("access-control-max-age", "86400"),
];
/// aucune réponse n'est une page : le navigateur ne doit ni deviner le type, ni exécuter quoi que ce soit
const SAFE: [(&str, &str); 4] = [
    ("x-content-type-options", "nosniff"),
    ("referrer-policy", "no-referrer"),
    ("content-security-policy", "default-src 'none'; sandbox"),
    ("cache-control", "no-store"),
];

pub fn headers(safe: bool) -> Headers {
    let h = Headers::new();
    for (k, v) in CORS.iter().chain(if safe { SAFE.iter() } else { [].iter() }) {
        let _ = h.set(k, v);
    }
    h
}

/// Une erreur rendue à l'appareil : `{error, message, ...extra}`.
#[derive(Debug)]
pub struct ApiError {
    pub status: u16,
    pub code: &'static str,
    pub message: Cow<'static, str>,
    pub extra: Map<String, Value>,
}

pub type Res = Result<Response, ApiError>;

pub fn fail(status: u16, code: &'static str, message: impl Into<Cow<'static, str>>) -> ApiError {
    ApiError { status, code, message: message.into(), extra: Map::new() }
}

impl ApiError {
    pub fn with(mut self, k: &str, v: Value) -> Self {
        self.extra.insert(k.into(), v);
        self
    }
    pub fn retry(self, s: u32) -> Self {
        self.with("retryAfter", Value::from(s))
    }
    pub fn response(&self) -> Response {
        let mut o = Map::new();
        o.insert("error".into(), Value::from(self.code));
        o.insert("message".into(), Value::from(self.message.as_ref()));
        o.extend(self.extra.clone());
        json_raw(&Value::Object(o).to_string(), self.status)
    }
}

/// Toute erreur imprévue (D1, R2, plateforme) : 500 sans détail.
impl From<worker::Error> for ApiError {
    fn from(e: worker::Error) -> Self {
        worker::console_error!("{e}");
        fail(500, "server", "Erreur du serveur.")
    }
}

impl From<serde_json::Error> for ApiError {
    fn from(e: serde_json::Error) -> Self {
        worker::console_error!("{e}");
        fail(500, "server", "Erreur du serveur.")
    }
}

/// Accès à une propriété d'un corps : `null.x` lève une erreur en JavaScript (→ 500), le reste rend `undefined`.
pub fn prop<'a>(b: &'a Value, k: &str) -> Result<Option<&'a Value>, ApiError> {
    match b {
        Value::Null => Err(fail(500, "server", "Erreur du serveur.")),
        Value::Object(o) => Ok(o.get(k)),
        _ => Ok(None),
    }
}

pub fn json_raw(text: &str, status: u16) -> Response {
    let h = headers(true);
    let _ = h.set("content-type", "application/json; charset=utf-8");
    Response::ok(text).map(|r| r.with_status(status).with_headers(h)).unwrap_or_else(|_| Response::empty().unwrap())
}

pub fn json(v: Value, status: u16) -> Res {
    Ok(json_raw(&v.to_string(), status))
}

pub fn ok() -> Res {
    json(serde_json::json!({ "ok": true }), 200)
}

pub fn options() -> Res {
    Ok(Response::empty()?.with_status(204).with_headers(headers(false)))
}

/// Corps lu par morceaux : un corps sans taille annoncée ne remplit pas la mémoire avant d'être refusé.
pub async fn body_text(req: &mut Request, max: usize) -> Result<String, ApiError> {
    let too_big = || fail(413, "server", "trop gros");
    let len: f64 = req.headers().get("content-length")?.map(|s| crate::js::str_to_num(&s)).unwrap_or(0.0);
    if len > max as f64 {
        return Err(too_big());
    }
    let mut buf = Vec::new();
    if req.inner().body().is_some() {
        let mut st = req.stream()?;
        while let Some(c) = st.next().await {
            let c = c?;
            buf.extend_from_slice(&c);
            if buf.len() > max {
                return Err(too_big());
            }
        }
    }
    Ok(String::from_utf8_lossy(&buf).into_owned())
}

/// `JSON.parse(texte || '{}')`
pub async fn body(req: &mut Request, max: usize) -> Result<Value, ApiError> {
    let t = body_text(req, max).await?;
    if t.is_empty() {
        return Ok(Value::Object(Map::new()));
    }
    serde_json::from_str(&t).map_err(|_| fail(400, "server", "JSON invalide"))
}
