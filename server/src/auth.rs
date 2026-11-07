//! Jetons, sessions et appareils (specs sync-http « Authentification par jeton », sync-accounts).
use crate::crypto::{rid, sha};
use crate::db::{db, n, now, q, s};
use crate::{js, validate};
use serde::Deserialize;
use serde_json::{json, Value};
use worker::{Env, Request, Result, Url};

/// dernière activité d'un appareil : précise à la minute (spec sync-http)
const LAST_MS: f64 = 60e3;

pub struct Me {
    pub user: String,
    pub device: String,
    pub name: String,
}

/// Le jeton : en-tête `authorization: Bearer …`, ou paramètre `token` pour la WebSocket seulement
/// (un navigateur ne peut pas y mettre d'en-tête).
pub fn token(req: &Request, url: &Url) -> Result<Option<String>> {
    let h = req.headers().get("authorization")?.unwrap_or_default();
    Ok(if let Some(t) = h.strip_prefix("Bearer ") {
        Some(t.to_string())
    } else if url.path() == "/v1/live" {
        url.query_pairs().find(|(k, _)| k == "token").map(|(_, v)| v.into_owned())
    } else {
        None
    })
}

pub async fn auth(env: &Env, req: &Request, url: &Url) -> Result<Option<Me>> {
    let Some(t) = token(req, url)? else { return Ok(None) };
    if t.is_empty() || js::len(&t) > 128 {
        return Ok(None);
    }
    #[derive(Deserialize)]
    struct S {
        user: String,
        device: String,
        name: String,
        last: f64,
    }
    let d = db(env)?;
    let found: Option<S> = q(&d, "SELECT s.user, s.device, d.name, d.last FROM sessions s JOIN devices d ON d.id = s.device WHERE s.token = ?", &[s(&sha(&t).await?)])?.first(None).await?;
    let Some(x) = found else { return Ok(None) };
    // « vu il y a … » : réécrit au plus une fois par minute, pas à chaque requête d'une synchro
    if now() - x.last >= LAST_MS {
        q(&d, "UPDATE devices SET last = ? WHERE id = ?", &[n(now()), s(&x.device)])?.run().await?;
    }
    Ok(Some(Me { user: x.user, device: x.device, name: x.name }))
}

/// `dev?.k` : rien pour une valeur qui n'est pas un objet.
fn field<'a>(dev: Option<&'a Value>, k: &str) -> Option<&'a Value> {
    dev.and_then(|d| d.as_object()).and_then(|o| o.get(k))
}

/// Ouvre une session et rattache l'appareil : `{token, user, device}`.
pub async fn new_session(env: &Env, user: &str, dev: Option<&Value>) -> Result<serde_json::Map<String, Value>> {
    let d = db(env)?;
    let name = js::slice(&validate::clean_device(&js::str_nullish(field(dev, "name"))), 60);
    let name = if name.is_empty() { "Appareil".to_string() } else { name };
    let platform = js::slice(&validate::clean_device(&js::str_nullish(field(dev, "platform"))), 20);
    let platform = if platform.is_empty() { "web".to_string() } else { platform };
    let id = field(dev, "id");
    let mut device = if !js::falsy(id) && validate::pid(&js::to_string(id.unwrap())) { Some(js::to_string(id.unwrap())) } else { None };
    if let Some(dv) = &device {
        let owner: Option<String> = q(&d, "SELECT user FROM devices WHERE id = ?", &[s(dv)])?.first(Some("user")).await?;
        if owner.as_deref() != Some(user) {
            device = None;
        }
    }
    let device = match device {
        Some(dv) => {
            q(&d, "UPDATE devices SET name = ?, platform = ?, last = ? WHERE id = ?", &[s(&name), s(&platform), n(now()), s(&dv)])?.run().await?;
            dv
        }
        None => {
            let dv = rid(8)?;
            // un nouvel appareil ne reçoit que ce qui arrive après lui (il demandera le reste avec « Synchroniser maintenant »)
            let top: Option<f64> = q(&d, "SELECT COALESCE(MAX(seq),0) AS s FROM events WHERE user = ?", &[s(user)])?.first(Some("s")).await?;
            q(
                &d,
                "INSERT INTO devices(id,user,name,platform,created,last,cursor) VALUES(?,?,?,?,?,?,?)",
                &[s(&dv), s(user), s(&name), s(&platform), n(now()), n(now()), n(top.unwrap_or(0.0))],
            )?
            .run()
            .await?;
            dv
        }
    };
    let token = rid(32)?;
    q(&d, "INSERT INTO sessions(token,user,device,created) VALUES(?,?,?,?)", &[s(&sha(&token).await?), s(user), s(&device), n(now())])?.run().await?;
    let mut o = serde_json::Map::new();
    o.insert("token".into(), json!(token));
    o.insert("user".into(), json!(user));
    o.insert("device".into(), json!(device));
    Ok(o)
}
