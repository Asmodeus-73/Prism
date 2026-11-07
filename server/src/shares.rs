//! Travail à plusieurs : partages et verrou « chacun son tour » (spec sync-sharing).
use crate::auth::Me;
use crate::db::{db, hit, n, now, q, s};
use crate::http::{body, fail, json, ok, prop, Res, MAX_BODY};
use crate::live::{notify, send};
use crate::{js, validate};
use serde::Deserialize;
use serde_json::{json, Value};
use worker::{Context, Env, Request, Result};

const LOCK_MS: f64 = 10.0 * 60e3;

#[derive(Deserialize)]
pub struct Member {
    pub user: String,
}

#[derive(Deserialize)]
pub struct Lock {
    pub user: String,
    pub name: String,
    pub until: i64,
}

/// les comptes qui partagent cette photo (sans soi-même)
pub async fn others(env: &Env, pid: &str, me: &str) -> Result<Vec<Member>> {
    q(&db(env)?, "SELECT user, role FROM shares WHERE pid = ? AND user != ?", &[s(pid), s(me)])?.all().await?.results()
}

pub async fn role_of(env: &Env, pid: &str, me: &str) -> Result<Option<String>> {
    q(&db(env)?, "SELECT role FROM shares WHERE pid = ? AND user = ?", &[s(pid), s(me)])?.first(Some("role")).await
}

pub async fn lock_of(env: &Env, pid: &str) -> Result<Option<Lock>> {
    let l: Option<Lock> = q(&db(env)?, "SELECT user, device, name, until FROM locks WHERE pid = ?", &[s(pid)])?.first(None).await?;
    Ok(l.filter(|l| l.until as f64 > now()))
}

/// prévient les autres membres (en arrière-plan)
pub fn tell_share(env: &Env, ctx: &Context, pid: &str, me: &str, msg: Value) {
    let (env2, pid, me) = (env.clone(), pid.to_string(), me.to_string());
    ctx.wait_until(async move {
        if let Ok(list) = others(&env2, &pid, &me).await {
            for o in list {
                send(&env2, &o.user, &msg).await;
            }
        }
    });
}

pub async fn list(env: &Env, me: &Me) -> Res {
    #[derive(Deserialize)]
    struct R {
        pid: String,
        mine: String,
        user: String,
        role: String,
        email: String,
    }
    #[derive(Deserialize)]
    struct L {
        pid: String,
        user: String,
        device: String,
        name: String,
        until: i64,
    }
    let d = db(env)?;
    // deux requêtes en tout, quel que soit le nombre de photos partagées (design D13)
    let rows: Vec<R> = q(
        &d,
        "SELECT s.pid, s.role AS mine, m.user, m.role, u.email FROM shares s JOIN shares m ON m.pid = s.pid JOIN users u ON u.id = m.user \
         WHERE s.user = ? ORDER BY s.rowid, m.created, m.rowid",
        &[s(&me.user)],
    )?
    .all()
    .await?
    .results()?;
    let locks: Vec<L> = q(&d, "SELECT pid, user, device, name, until FROM locks WHERE pid IN (SELECT pid FROM shares WHERE user = ?) AND until > ?", &[s(&me.user), n(now())])?
        .all()
        .await?
        .results()?;
    let mut out: Vec<serde_json::Map<String, Value>> = Vec::new();
    for r in rows {
        if out.last().and_then(|o| o["pid"].as_str()) != Some(r.pid.as_str()) {
            let lock = locks.iter().find(|l| l.pid == r.pid).map(|l| json!({ "user": l.user, "device": l.device, "name": l.name, "until": l.until, "me": l.user == me.user }));
            let mut o = serde_json::Map::new();
            o.insert("pid".into(), json!(r.pid));
            o.insert("role".into(), json!(r.mine));
            o.insert("members".into(), json!([]));
            o.insert("lock".into(), lock.unwrap_or(Value::Null));
            out.push(o);
        }
        let o = out.last_mut().unwrap();
        o["members"].as_array_mut().unwrap().push(json!({ "user": r.user, "email": r.email, "role": r.role, "me": r.user == me.user }));
    }
    json(json!({ "shares": out }), 200)
}

pub async fn invite(mut req: Request, env: &Env, ctx: &Context, me: &Me) -> Res {
    let b = body(&mut req, MAX_BODY).await?;
    let pid = js::str_or_empty(prop(&b, "pid")?);
    let email = js::trim(&js::str_or_empty(prop(&b, "email")?)).to_lowercase();
    if !validate::pid(&pid) {
        return Err(fail(400, "pid", "Identifiant de projet invalide."));
    }
    if !validate::email(&email) {
        return Err(fail(400, "email", "Adresse e-mail invalide."));
    }
    let d = db(env)?;
    // 10 invitations par heure : la réponse dit si l'adresse a un compte, on ne laisse pas en tester des milliers
    if hit(&d, &format!("share:{}", me.user), 10.0, 3600e3).await? {
        return Err(fail(429, "slow", "Trop d’invitations envoyées. Réessaie dans une heure.").retry(3600));
    }
    let mut role = role_of(env, &pid, &me.user).await?;
    if role.is_none() {
        // premier partage : il faut avoir soi-même envoyé cette photo, et que personne d'autre ne la partage déjà
        let own = q(&d, "SELECT 1 AS x FROM events WHERE user = ? AND pid = ? AND origin IS NULL AND kind = 'put' LIMIT 1", &[s(&me.user), s(&pid)])?.first::<Value>(None).await?;
        // la photo d'un autre compte au même identifiant : la partager écraserait la sienne chez lui
        let taken = q(&d, "SELECT 1 AS x FROM shares WHERE pid = ? LIMIT 1", &[s(&pid)])?.first::<Value>(None).await?.is_some()
            || q(&d, "SELECT 1 AS x FROM events WHERE pid = ? AND user != ? AND origin IS NULL LIMIT 1", &[s(&pid), s(&me.user)])?.first::<Value>(None).await?.is_some();
        if own.is_none() || taken {
            return Err(fail(404, "pid", "Photo inconnue : synchronise-la d’abord."));
        }
        q(&d, "INSERT INTO shares(pid,user,role,created) VALUES(?,?,?,?)", &[s(&pid), s(&me.user), s("owner"), n(now())])?.run().await?;
        role = Some("owner".into());
    }
    if role.as_deref() != Some("owner") {
        return Err(fail(403, "owner", "Seule la personne qui a partagé la photo peut inviter quelqu’un."));
    }
    let Some(guest): Option<String> = q(&d, "SELECT id FROM users WHERE email = ?", &[s(&email)])?.first(Some("id")).await? else {
        return Err(fail(404, "nouser", "Aucun compte Prism avec cette adresse : la personne doit d’abord créer son compte."));
    };
    if guest == me.user {
        return Err(fail(400, "self", "C’est ton propre compte."));
    }
    let count: Option<f64> = q(&d, "SELECT COUNT(*) AS n FROM shares WHERE pid = ?", &[s(&pid)])?.first(Some("n")).await?;
    if count.unwrap_or(0.0) >= 10.0 {
        return Err(fail(400, "full", "Dix personnes au plus sur une même photo."));
    }
    q(&d, "INSERT OR IGNORE INTO shares(pid,user,role,created) VALUES(?,?,?,?)", &[s(&pid), s(&guest), s("edit"), n(now())])?.run().await?;
    // l'invité n'a encore rien : on demande aux appareils de la propriétaire de renvoyer la photo (elle partira aussi chez lui)
    let seq: Option<f64> = q(
        &d,
        "INSERT INTO events(user,device,kind,pid,body,blobs,created,origin) VALUES(?,?,?,?,?,?,?,?) RETURNING seq",
        &[s(&me.user), s("partage"), s("want"), s(&pid), wasm_bindgen::JsValue::NULL, s("[]"), n(now()), s(&guest)],
    )?
    .first(Some("seq"))
    .await?;
    notify(env, ctx, &me.user, json!({ "type": "event", "seq": js::num(seq.unwrap_or(0.0)), "from": "share" }));
    notify(env, ctx, &guest, json!({ "type": "share", "pid": pid }));
    json(json!({ "ok": true }), 201)
}

pub async fn remove(env: &Env, ctx: &Context, me: &Me, pid: &str, who: &str) -> Res {
    let role = role_of(env, pid, &me.user).await?;
    if role.is_none() || (role.as_deref() != Some("owner") && who != me.user) {
        return Err(fail(404, "share", "Partage inconnu."));
    }
    let d = db(env)?;
    if role.as_deref() == Some("owner") && who == me.user {
        d.batch(vec![q(&d, "DELETE FROM shares WHERE pid = ?", &[s(pid)])?, q(&d, "DELETE FROM locks WHERE pid = ?", &[s(pid)])?]).await?;
    } else {
        q(&d, "DELETE FROM shares WHERE pid = ? AND user = ? AND role != 'owner'", &[s(pid), s(who)])?.run().await?;
        q(&d, "DELETE FROM locks WHERE pid = ? AND user = ?", &[s(pid), s(who)])?.run().await?;
    }
    notify(env, ctx, who, json!({ "type": "share", "pid": pid }));
    tell_share(env, ctx, pid, &me.user, json!({ "type": "share", "pid": pid }));
    ok()
}

/// `/v1/locks/<pid>` : `None` quand la méthode n'est pas prise en charge (la suite du routeur décide).
pub async fn lock(env: &Env, ctx: &Context, me: &Me, pid: &str, method: &worker::Method) -> Result<Option<Res>> {
    if role_of(env, pid, &me.user).await?.is_none() {
        return Ok(Some(Err(fail(404, "share", "Cette photo n’est pas partagée."))));
    }
    let l = lock_of(env, pid).await?;
    let d = db(env)?;
    Ok(match method {
        worker::Method::Post => {
            if let Some(l) = l.as_ref().filter(|l| l.user != me.user) {
                return Ok(Some(Err(fail(409, "locked", "Quelqu’un d’autre retouche cette photo en ce moment.").with("holder", json!({ "name": l.name, "until": l.until })))));
            }
            let email: Option<String> = q(&d, "SELECT email FROM users WHERE id = ?", &[s(&me.user)])?.first(Some("email")).await?;
            let name = email.unwrap_or_default().split('@').next().unwrap_or("").to_string();
            let until = now() + LOCK_MS;
            q(&d, "INSERT OR REPLACE INTO locks(pid,user,device,name,until) VALUES(?,?,?,?,?)", &[s(pid), s(&me.user), s(&me.device), s(&name), n(until)])?.run().await?;
            if l.is_none() {
                tell_share(env, ctx, pid, &me.user, json!({ "type": "lock", "pid": pid }));
            }
            Some(json(json!({ "ok": true, "until": js::num(until) }), 200))
        }
        worker::Method::Delete => {
            if l.as_ref().is_some_and(|l| l.user == me.user) {
                q(&d, "DELETE FROM locks WHERE pid = ?", &[s(pid)])?.run().await?;
                tell_share(env, ctx, pid, &me.user, json!({ "type": "lock", "pid": pid }));
            }
            Some(ok())
        }
        _ => None,
    })
}
