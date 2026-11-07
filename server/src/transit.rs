//! Fichiers en transit dans R2 (spec sync-transit).
use crate::auth::Me;
use crate::db::{db, limit, n, now, q, s, transit_hours, user_limit};
use crate::http::{fail, headers, json, Res};
use crate::{js, validate};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;
use worker::{Env, HttpMetadata, Request, Response, Result, Url};

const MAX_BLOB: f64 = (500u64 << 20) as f64; // un fichier : 500 Mo au plus

/// `decodeURIComponent` du nom ; `None` si l'encodage est cassé.
fn decode(raw: &str) -> Option<String> {
    let b = raw.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' {
            let h = b.get(i + 1..i + 3)?;
            out.push(u8::from_str_radix(std::str::from_utf8(h).ok()?, 16).ok()?);
            i += 3;
        } else {
            out.push(b[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

/// Nom valide d'un fichier en transit, depuis la fin de l'adresse `/v1/blobs/…`.
pub fn key_of(raw: &str) -> Option<String> {
    let k = decode(raw).unwrap_or_default();
    (validate::key(&k) && k != "." && k != "..").then_some(k)
}

/// FixedLengthStream natif (design D9) : le fichier va de la requête à R2 sans traverser le WASM,
/// et doit faire exactement la taille annoncée (sinon le quota serait contourné).
fn fixed_length(req: &Request, len: f64) -> Result<web_sys::ReadableStream> {
    let ctor = js_sys::Reflect::get(&js_sys::global(), &"FixedLengthStream".into())?;
    let fl = js_sys::Reflect::construct(ctor.unchecked_ref::<js_sys::Function>(), &js_sys::Array::of1(&JsValue::from_f64(len)))?;
    let writable: web_sys::WritableStream = js_sys::Reflect::get(&fl, &"writable".into())?.unchecked_into();
    let readable: web_sys::ReadableStream = js_sys::Reflect::get(&fl, &"readable".into())?.unchecked_into();
    match req.inner().body() {
        Some(b) => {
            let p = b.pipe_to(&writable);
            wasm_bindgen_futures::spawn_local(async move {
                let _ = JsFuture::from(p).await; // une taille différente est vue par R2
            });
        }
        None => {
            let _ = writable.close();
        }
    }
    Ok(readable)
}

pub async fn put(req: Request, env: &Env, me: &Me, key: &str) -> Res {
    let size = req.headers().get("content-length")?.map(|v| js::str_to_num(&v)).unwrap_or(f64::NAN);
    if size.is_nan() || size <= 0.0 {
        return Err(fail(411, "length", "Taille du fichier manquante."));
    }
    if size > MAX_BLOB {
        return Err(fail(413, "big", "Fichier trop gros pour le transit (500 Mo au plus)."));
    }
    let d = db(env)?;
    // déjà là, place occupée par tous et par ce compte : une seule requête
    #[derive(Deserialize)]
    struct U {
        g: f64,
        u: f64,
        e: f64,
    }
    let u: Option<U> = q(
        &d,
        "SELECT COALESCE(SUM(size),0) AS g, COALESCE(SUM(CASE WHEN user = ?1 THEN size END),0) AS u, \
         COALESCE(MAX(CASE WHEN user = ?1 AND key = ?2 THEN 1 END),0) AS e FROM transit",
        &[s(&me.user), s(key)],
    )?
    .first(None)
    .await?;
    let u = u.unwrap_or(U { g: 0.0, u: 0.0, e: 0.0 });
    if u.e > 0.0 {
        return json(json!({ "ok": true, "already": true }), 200);
    }
    if u.g + size > limit(env) || u.u + size > user_limit(env) {
        return Err(fail(507, "full", "Le transit est plein pour le moment : l’envoi reprendra tout seul.").retry(600));
    }
    let ct = validate::content_type(req.headers().get("content-type")?);
    let ct = if validate::blob_type(&ct) { ct } else { "application/octet-stream".into() };
    let rk = format!("{}/{}", me.user, key);
    let bucket = env.bucket("TRANSIT")?;
    let bad = || fail(400, "length", "Le fichier ne fait pas la taille annoncée.");
    let meta = HttpMetadata { content_type: Some(ct), ..Default::default() };
    if bucket.put(&rk, fixed_length(&req, size)?).http_metadata(meta).execute().await.is_err() {
        let _ = bucket.delete(&rk).await;
        return Err(bad());
    }
    match bucket.head(&rk).await? {
        Some(o) if o.size() as f64 == size => {}
        _ => {
            let _ = bucket.delete(&rk).await;
            return Err(bad());
        }
    }
    q(&d, "INSERT OR REPLACE INTO transit(user,key,size,created) VALUES(?,?,?,?)", &[s(&me.user), s(key), n(size), n(now())])?.run().await?;
    json(json!({ "ok": true }), 201)
}

pub async fn get(env: &Env, me: &Me, key: &str, url: &Url) -> Res {
    let bucket = env.bucket("TRANSIT")?;
    let mut o = bucket.get(format!("{}/{}", me.user, key)).execute().await?;
    // un fichier d'un autre compte : seulement s'il est annoncé dans un évènement de photo partagée reçu ici
    let from = url.query_pairs().find(|(k, _)| k == "from").map(|(_, v)| v.into_owned());
    if o.is_none() {
        if let Some(from) = from.filter(|f| validate::pid(f) && *f != me.user) {
            // instr : recherche exacte (avec LIKE, le « _ » d'un nom de fichier valait n'importe quel caractère)
            let seen = q(&db(env)?, "SELECT 1 AS x FROM events WHERE user = ? AND origin = ? AND instr(blobs, ?) > 0 LIMIT 1", &[s(&me.user), s(&from), s(&format!("\"{key}\""))])?
                .first::<Value>(None)
                .await?;
            if seen.is_some() {
                o = bucket.get(format!("{from}/{key}")).execute().await?;
            }
        }
    }
    let Some(o) = o else { return Err(fail(404, "gone", "Ce fichier n’est plus en transit : il viendra d’un autre appareil.")) };
    let ct = o.http_metadata().content_type.unwrap_or_default();
    let h = headers(true);
    h.set("content-type", if validate::blob_type(&ct) { &ct } else { "application/octet-stream" })?;
    h.set("content-disposition", "attachment")?;
    h.set("content-length", &o.size().to_string())?;
    let body = o.body().ok_or_else(|| fail(404, "gone", "Ce fichier n’est plus en transit : il viendra d’un autre appareil."))?.response_body()?;
    Ok(Response::from_body(body)?.with_headers(h))
}

pub async fn usage(env: &Env) -> Res {
    let g: Option<f64> = q(&db(env)?, "SELECT COALESCE(SUM(size),0) AS s FROM transit", &[])?.first(Some("s")).await?;
    json(json!({ "used": js::num(g.unwrap_or(0.0)), "limit": js::num(limit(env)), "hours": js::num(transit_hours(env)) }), 200)
}

/// Efface (R2 et D1) une liste de fichiers d'un compte, par paquets (design D13).
pub async fn delete_keys(env: &Env, pairs: &[(String, String)]) -> Result<()> {
    if pairs.is_empty() {
        return Ok(());
    }
    let bucket = env.bucket("TRANSIT")?;
    for c in pairs.chunks(1000) {
        bucket.delete_multiple(c.iter().map(|(u, k)| format!("{u}/{k}")).collect::<Vec<String>>()).await?;
    }
    let d = db(env)?;
    // D1 accepte 100 paramètres au plus par requête
    let mut st = Vec::new();
    for c in pairs.chunks(49) {
        let sql = format!("DELETE FROM transit WHERE {}", vec!["(user = ? AND key = ?)"; c.len()].join(" OR "));
        let args: Vec<JsValue> = c.iter().flat_map(|(u, k)| [s(u), s(k)]).collect();
        st.push(q(&d, &sql, &args)?);
        if st.len() == 50 {
            d.batch(std::mem::take(&mut st)).await?;
        }
    }
    if !st.is_empty() {
        d.batch(st).await?;
    }
    Ok(())
}

/// Efface les fichiers en transit d'un compte que tous les appareils destinataires ont reçus.
/// Un fichier envoyé par un compte peut aussi être attendu par les comptes avec qui la photo est partagée
/// (copies d'évènement, origin = ce compte).
pub async fn sweep_user(env: &Env, user: &str) -> Result<usize> {
    #[derive(Deserialize)]
    struct R {
        user: String,
        seq: f64,
        blobs: String,
    }
    #[derive(Deserialize)]
    struct M {
        user: String,
        c: Option<f64>,
    }
    let d = db(env)?;
    let rows: Vec<R> = q(&d, "SELECT user, seq, blobs FROM events WHERE ((user = ?1 AND origin IS NULL) OR origin = ?1) AND blobs != '[]'", &[s(user)])?.all().await?.results()?;
    if rows.is_empty() {
        return Ok(0);
    }
    let users: Vec<&str> = rows.iter().map(|r| r.user.as_str()).collect::<HashSet<_>>().into_iter().collect();
    let mut mins: HashMap<String, f64> = HashMap::new();
    for c in users.chunks(90) {
        let sql = format!("SELECT user, MIN(cursor) AS c FROM devices WHERE user IN ({}) GROUP BY user", vec!["?"; c.len()].join(","));
        let m: Vec<M> = q(&d, &sql, &c.iter().map(|u| s(u)).collect::<Vec<_>>())?.all().await?.results()?;
        mins.extend(m.into_iter().map(|m| (m.user, m.c.unwrap_or(0.0))));
    }
    let (mut done, mut need) = (HashSet::new(), HashSet::new());
    for r in &rows {
        let keys: Vec<String> = serde_json::from_str(&r.blobs).unwrap_or_default();
        let set = if r.seq <= *mins.get(&r.user).unwrap_or(&0.0) { &mut done } else { &mut need };
        set.extend(keys);
    }
    let gone: Vec<(String, String)> = done.into_iter().filter(|k| !need.contains(k)).map(|k| (user.to_string(), k)).collect();
    delete_keys(env, &gone).await?;
    Ok(gone.len())
}

/// ménage de chaque heure : transit de plus de 24 h, journal de plus de 30 jours (spec sync-maintenance)
pub async fn sweep_all(env: &Env) -> Result<usize> {
    #[derive(Deserialize)]
    struct R {
        user: String,
        key: String,
    }
    let d = db(env)?;
    let old = now() - transit_hours(env) * 3600e3;
    let rows: Vec<R> = q(&d, "SELECT user, key FROM transit WHERE created < ?", &[n(old)])?.all().await?.results()?;
    let pairs: Vec<(String, String)> = rows.into_iter().map(|r| (r.user, r.key)).collect();
    if !pairs.is_empty() {
        let bucket = env.bucket("TRANSIT")?;
        for c in pairs.chunks(1000) {
            bucket.delete_multiple(c.iter().map(|(u, k)| format!("{u}/{k}")).collect::<Vec<String>>()).await?;
        }
    }
    let t = now();
    d.batch(vec![
        q(&d, "DELETE FROM transit WHERE created < ?", &[n(old)])?,
        q(&d, "DELETE FROM events WHERE created < ?", &[n(t - crate::db::events_days(env) * 864e5)])?,
        q(&d, "DELETE FROM attempts WHERE since < ?", &[n(t - 2.0 * 3600e3)])?,
        q(&d, "DELETE FROM locks WHERE until < ?", &[n(t)])?,
        // un appareil muet depuis 180 jours perd sa session (il faudra se reconnecter)
        q(&d, "DELETE FROM sessions WHERE device IN (SELECT id FROM devices WHERE last < ?)", &[n(t - 180.0 * 864e5)])?,
    ])
    .await?;
    Ok(pairs.len())
}
