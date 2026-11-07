//! Comptes, profil et appareils (spec sync-accounts).
use crate::auth::{new_session, Me};
use crate::crypto::{dummy, hash_pw, rid, same, sha};
use crate::db::{count, db, hit, n, now, over, q, s};
use crate::http::{body, fail, json, ok, prop, ApiError, Res};
use crate::{js, transit, validate};
use serde::Deserialize;
use serde_json::{json, Value};
use worker::{Context, Env, Request};

const QUART: f64 = 15.0 * 60e3;

fn ip_of(req: &Request) -> String {
    let ip = req.headers().get("cf-connecting-ip").ok().flatten().filter(|s| !s.is_empty()).unwrap_or_else(|| "local".into());
    js::slice(&ip, 64)
}

fn email_pw(b: &Value) -> Result<(String, String), ApiError> {
    let email = js::trim(&js::str_or_empty(prop(b, "email")?)).to_lowercase();
    let pw = js::str_or_empty(prop(b, "password")?);
    Ok((email, pw))
}

pub async fn signup(mut req: Request, env: &Env) -> Res {
    let b = body(&mut req, crate::http::MAX_BODY).await?;
    let (email, pw) = email_pw(&b)?;
    if !validate::email(&email) {
        return Err(fail(400, "email", "Adresse e-mail invalide."));
    }
    if js::len(&pw) < 8 || js::len(&pw) > 200 {
        return Err(fail(400, "password", "Le mot de passe doit faire au moins 8 caractères."));
    }
    let d = db(env)?;
    if hit(&d, &format!("signup:{}", ip_of(&req)), 5.0, 3600e3).await? {
        return Err(fail(429, "slow", "Trop de comptes créés depuis ce réseau. Réessaie dans une heure.").retry(3600));
    }
    if q(&d, "SELECT 1 AS x FROM users WHERE email = ?", &[s(&email)])?.first::<Value>(None).await?.is_some() {
        return Err(fail(409, "exists", "Un compte existe déjà avec cette adresse."));
    }
    let id = rid(8)?;
    q(&d, "INSERT INTO users(id,email,pw,created) VALUES(?,?,?,?)", &[s(&id), s(&email), s(&hash_pw(&pw, None).await?), n(now())])?.run().await?;
    let mut o = new_session(env, &id, prop(&b, "device")?).await?;
    o.insert("email".into(), json!(email));
    json(Value::Object(o), 201)
}

pub async fn login(mut req: Request, env: &Env) -> Res {
    let b = body(&mut req, crate::http::MAX_BODY).await?;
    let (email, pw) = email_pw(&b)?;
    let d = db(env)?;
    let ipk = format!("login:{}", ip_of(&req));
    if over(&d, &email, 10.0, QUART).await? || over(&d, &ipk, 30.0, QUART).await? {
        return Err(fail(429, "slow", "Trop d’essais. Réessaie dans un quart d’heure.").retry(900));
    }
    let wrong = || fail(401, "login", "Adresse ou mot de passe incorrect.");
    if js::len(&pw) > 200 {
        return Err(wrong());
    }
    #[derive(Deserialize)]
    struct U {
        id: String,
        pw: String,
    }
    let u: Option<U> = q(&d, "SELECT id, pw FROM users WHERE email = ?", &[s(&email)])?.first(None).await?;
    let reference = match &u {
        Some(u) => u.pw.clone(),
        None => dummy().await?,
    };
    let salt = reference.split('$').next().unwrap_or("");
    let good = same(&hash_pw(&pw, Some(salt)).await?, &reference) && u.is_some();
    // trop d'essais de mot de passe : 10 par quart d'heure et par adresse ; une connexion réussie remet à zéro
    if good {
        q(&d, "DELETE FROM attempts WHERE email = ?", &[s(&email)])?.run().await?;
    } else {
        count(&d, &email, QUART).await?;
        count(&d, &ipk, QUART).await?;
        return Err(wrong());
    }
    let mut o = new_session(env, &u.unwrap().id, prop(&b, "device")?).await?;
    o.insert("email".into(), json!(email));
    json(Value::Object(o), 200)
}

pub async fn logout(req: &Request, env: &Env) -> Res {
    let h = req.headers().get("authorization")?.unwrap_or_default();
    let t = h.get(7..).unwrap_or("");
    q(&db(env)?, "DELETE FROM sessions WHERE token = ?", &[s(&sha(t).await?)])?.run().await?;
    ok()
}

pub async fn me_get(env: &Env, me: &Me) -> Res {
    #[derive(Deserialize)]
    struct U {
        email: String,
        name: Option<String>,
        avatar: Option<String>,
    }
    #[derive(Deserialize, serde::Serialize)]
    struct D {
        id: String,
        name: String,
        platform: String,
        last: i64,
    }
    let d = db(env)?;
    let u: Option<U> = q(&d, "SELECT email, name, avatar FROM users WHERE id = ?", &[s(&me.user)])?.first(None).await?;
    let devs: Vec<D> = q(&d, "SELECT id, name, platform, last FROM devices WHERE user = ? ORDER BY last DESC", &[s(&me.user)])?.all().await?.results()?;
    let mut o = serde_json::Map::new();
    o.insert("user".into(), json!(me.user));
    if let Some(u) = &u {
        o.insert("email".into(), json!(u.email));
    }
    o.insert("name".into(), json!(u.as_ref().and_then(|u| u.name.clone()).filter(|x| !x.is_empty()).unwrap_or_default()));
    o.insert("avatar".into(), json!(u.as_ref().and_then(|u| u.avatar.clone()).filter(|x| !x.is_empty())));
    o.insert("device".into(), json!(me.device));
    o.insert("devices".into(), serde_json::to_value(devs)?);
    json(Value::Object(o), 200)
}

/// profil : nom affiché et photo (une petite image JPEG, PNG ou WebP en data URL, 200 Ko au plus)
pub async fn me_patch(mut req: Request, env: &Env, me: &Me) -> Res {
    let b = body(&mut req, 300_000).await?;
    // `'name' in b` : erreur (500) si le corps n'est pas un objet ou un tableau
    let o = match &b {
        Value::Object(o) => Some(o),
        Value::Array(_) => None,
        _ => return Err(fail(500, "server", "Erreur du serveur.")),
    };
    let (mut set, mut val) = (Vec::new(), Vec::new());
    if let Some(v) = o.and_then(|o| o.get("name")) {
        let name = js::slice(&validate::clean_name(&js::str_nullish(Some(v))), 60);
        set.push("name = ?");
        val.push(if name.is_empty() { wasm_bindgen::JsValue::NULL } else { s(&name) });
    }
    if let Some(a) = o.and_then(|o| o.get("avatar")) {
        let good = match a {
            Value::Null => true,
            Value::String(t) => js::len(t) <= 280_000 && validate::avatar(t),
            _ => false,
        };
        if !good {
            return Err(fail(400, "avatar", "La photo de profil doit être une image JPEG, PNG ou WebP de 200 Ko au plus."));
        }
        set.push("avatar = ?");
        val.push(a.as_str().map(s).unwrap_or(wasm_bindgen::JsValue::NULL));
    }
    if set.is_empty() {
        return Err(fail(400, "empty", "Rien à changer."));
    }
    val.push(s(&me.user));
    q(&db(env)?, &format!("UPDATE users SET {} WHERE id = ?", set.join(", ")), &val)?.run().await?;
    ok()
}

pub async fn device_delete(env: &Env, ctx: &Context, me: &Me, id: &str) -> Res {
    let d = db(env)?;
    let owner: Option<String> = q(&d, "SELECT user FROM devices WHERE id = ?", &[s(id)])?.first(Some("user")).await?;
    if owner.as_deref() != Some(&me.user) {
        return Err(fail(404, "device", "Appareil inconnu."));
    }
    d.batch(vec![q(&d, "DELETE FROM sessions WHERE device = ?", &[s(id)])?, q(&d, "DELETE FROM devices WHERE id = ?", &[s(id)])?]).await?;
    // un appareil retiré ne bloque plus le transit
    let (env2, user) = (env.clone(), me.user.clone());
    ctx.wait_until(async move {
        let _ = transit::sweep_user(&env2, &user).await;
    });
    ok()
}
