//! Petites aides D1 et réglages.
use wasm_bindgen::JsValue;
use worker::{D1Database, D1PreparedStatement, Env, Result};

pub fn now() -> f64 {
    js_sys::Date::now()
}

pub fn s(v: &str) -> JsValue {
    JsValue::from_str(v)
}

pub fn n(v: f64) -> JsValue {
    JsValue::from_f64(v)
}

pub fn q(db: &D1Database, sql: &str, args: &[JsValue]) -> Result<D1PreparedStatement> {
    db.prepare(sql).bind(args)
}

pub fn db(env: &Env) -> Result<D1Database> {
    env.d1("DB")
}

/// `+(env.X || défaut)`
fn var(env: &Env, k: &str) -> Option<f64> {
    env.var(k).ok().map(|v| v.to_string()).filter(|v| !v.is_empty()).map(|v| crate::js::str_to_num(&v))
}

pub fn limit(env: &Env) -> f64 {
    var(env, "TRANSIT_LIMIT").unwrap_or(9.5e9)
}

/// un seul compte ne peut pas remplir tout le transit
pub fn user_limit(env: &Env) -> f64 {
    var(env, "USER_LIMIT").unwrap_or_else(|| limit(env) * 0.6)
}

pub fn transit_hours(env: &Env) -> f64 {
    var(env, "TRANSIT_HOURS").unwrap_or(24.0)
}

pub fn events_days(env: &Env) -> f64 {
    var(env, "EVENTS_DAYS").unwrap_or(30.0)
}

/// Compteur de débit (table `attempts`) en une seule requête : compte cet appel et dit si la limite était
/// déjà atteinte dans la fenêtre. Même effet que « tester, puis compter » du serveur JavaScript.
pub async fn hit(db: &D1Database, key: &str, max: f64, win: f64) -> Result<bool> {
    let n: Option<f64> = q(
        db,
        "INSERT INTO attempts(email,n,since) VALUES(?1,1,?2) ON CONFLICT(email) DO UPDATE SET \
         n = CASE WHEN ?2 - since > ?3 THEN 1 ELSE n + 1 END, since = CASE WHEN ?2 - since > ?3 THEN ?2 ELSE since END RETURNING n",
        &[s(key), n(now()), n(win)],
    )?
    .first(Some("n"))
    .await?;
    Ok(n.unwrap_or(1.0) > max)
}

/// Limite déjà atteinte, sans compter (connexion : on ne compte que les échecs).
pub async fn over(db: &D1Database, key: &str, max: f64, win: f64) -> Result<bool> {
    #[derive(serde::Deserialize)]
    struct A {
        n: f64,
        since: f64,
    }
    let a: Option<A> = q(db, "SELECT n, since FROM attempts WHERE email = ?", &[s(key)])?.first(None).await?;
    Ok(a.is_some_and(|a| now() - a.since <= win && a.n >= max))
}

/// Compte un échec (connexion).
pub async fn count(db: &D1Database, key: &str, win: f64) -> Result<()> {
    hit(db, key, f64::INFINITY, win).await.map(|_| ())
}
