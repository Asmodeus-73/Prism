//! Prism : serveur de synchronisation.
//! Cloudflare n'est qu'un intermédiaire :
//! - D1 garde les comptes, les appareils et un journal d'évènements (« ce projet a changé », « ce projet a été supprimé ») ;
//! - R2 garde les fichiers en transit : effacés dès que tous les appareils du compte les ont reçus, au plus tard après 24 h ;
//! - un Durable Object par compte prévient les appareils connectés et relaie leurs messages WebRTC
//!   (quand deux appareils sont allumés, les fichiers passent directement de l'un à l'autre).
//!
//! Si le transit approche la limite (9,5 Go), l'envoi est refusé avec 507 et un délai : l'appareil le garde en file d'attente.
//! Le comportement est décrit par les specs `openspec/specs/sync-*`.
use worker::{event, Context, Env, Method, Request, Response, Result, ScheduleContext, ScheduledEvent};

mod accounts;
mod auth;
mod crypto;
mod db;
mod events;
mod http;
pub mod js;
mod live;
mod shares;
mod transit;
pub mod validate;

pub use live::Live;

use http::{fail, json, Res};

/// `^/préfixe/([A-Za-z0-9_.-]{1,64})(/([A-Za-z0-9_.-]{1,64}))?$` : les identifiants à la fin d'une adresse.
fn ids<'a>(p: &'a str, prefix: &str, count: usize) -> Option<Vec<&'a str>> {
    let rest = p.strip_prefix(prefix)?;
    let parts: Vec<&str> = rest.split('/').collect();
    (parts.len() == count && parts.iter().all(|x| validate::pid(x))).then_some(parts)
}

async fn route(mut req: Request, env: &Env, ctx: &Context) -> Res {
    let url = req.url()?;
    let p = url.path().to_string();
    let m = req.method();
    if m == Method::Options {
        return http::options();
    }
    if p == "/" || p == "/v1" {
        return json(serde_json::json!({ "ok": true, "service": "prism-sync" }), 200);
    }
    if p == "/v1/signup" && m == Method::Post {
        return accounts::signup(req, env).await;
    }
    if p == "/v1/login" && m == Method::Post {
        return accounts::login(req, env).await;
    }

    let Some(me) = auth::auth(env, &req, &url).await? else {
        return Err(fail(401, "auth", "Connecte-toi à ton compte Prism."));
    };

    match (&m, p.as_str()) {
        (Method::Post, "/v1/logout") => return accounts::logout(&req, env).await,
        (Method::Get, "/v1/me") => return accounts::me_get(env, &me).await,
        (Method::Patch, "/v1/me") => return accounts::me_patch(req, env, &me).await,
        (Method::Get, "/v1/usage") => return transit::usage(env).await,
        _ => {}
    }
    if m == Method::Delete {
        if let Some(id) = ids(&p, "/v1/devices/", 1) {
            return accounts::device_delete(env, ctx, &me, id[0]).await;
        }
    }
    if let Some(raw) = p.strip_prefix("/v1/blobs/").filter(|r| !r.is_empty()) {
        let Some(key) = transit::key_of(raw) else { return Err(fail(400, "key", "Nom de fichier invalide.")) };
        match m {
            Method::Put => return transit::put(req, env, &me, &key).await,
            Method::Get => return transit::get(env, &me, &key, &url).await,
            _ => {}
        }
    }
    match (&m, p.as_str()) {
        (Method::Post, "/v1/events") => return events::post(req, env, ctx, &me).await,
        (Method::Get, "/v1/events") => return events::list(env, &me, &url).await,
        (Method::Post, "/v1/ack") => return events::ack(req, env, ctx, &me).await,
        (Method::Get, "/v1/shares") => return shares::list(env, &me).await,
        (Method::Post, "/v1/shares") => return shares::invite(req, env, ctx, &me).await,
        _ => {}
    }
    if m == Method::Delete {
        if let Some(x) = ids(&p, "/v1/shares/", 2) {
            return shares::remove(env, ctx, &me, x[0], x[1]).await;
        }
    }
    if let Some(x) = ids(&p, "/v1/locks/", 1) {
        if let Some(r) = shares::lock(env, ctx, &me, x[0], &m).await? {
            return r;
        }
    }
    if p == "/v1/live" && req.headers().get("upgrade")?.as_deref() == Some("websocket") {
        return live::connect(&req, env, &me).await;
    }
    let _ = &mut req;
    Err(fail(404, "route", "Adresse inconnue."))
}

#[event(fetch)]
async fn fetch(req: Request, env: Env, ctx: Context) -> Result<Response> {
    Ok(match route(req, &env, &ctx).await {
        Ok(r) => r,
        Err(e) => e.response(),
    })
}

/// ménage de chaque heure : transit de plus de 24 h, journal de plus de 30 jours
#[event(scheduled)]
async fn scheduled(_ev: ScheduledEvent, env: Env, _ctx: ScheduleContext) {
    if let Err(e) = transit::sweep_all(&env).await {
        worker::console_error!("ménage : {e}");
    }
}
