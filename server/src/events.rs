//! Journal d'évènements par compte (spec sync-events).
use crate::auth::Me;
use crate::db::{db, hit, n, now, q, s};
use crate::http::{body_text, fail, json, json_raw, ok, prop, Res, MAX_BODY};
use crate::live::notify;
use crate::shares::{lock_of, others, role_of, tell_share};
use crate::{js, transit, validate};
use serde::{Deserialize, Serialize};
use serde_json::value::RawValue;
use serde_json::{json, Value};
use worker::{Context, Env, Request, Url};

/// Ce qu'on garde d'un évènement envoyé : `body` reste du texte JSON (design D7, jamais décodé en arbre).
struct Incoming {
    kind: String,
    pid: String,
    blobs: Vec<String>,
    body: Option<String>,
}

fn blobs_of(v: Option<&Value>) -> Vec<String> {
    match v {
        Some(Value::Array(a)) => a.iter().filter_map(|x| x.as_str()).filter(|k| validate::key(k)).take(5000).map(String::from).collect(),
        _ => Vec::new(),
    }
}

fn parse(t: &str) -> Result<Incoming, crate::http::ApiError> {
    let t = if t.is_empty() { "{}" } else { t };
    #[derive(Deserialize)]
    struct Fast<'a> {
        kind: Option<Value>,
        pid: Option<Value>,
        blobs: Option<Value>,
        #[serde(borrow)]
        body: Option<&'a RawValue>,
    }
    // le cas courant : un objet sans clé en double, `body` gardé tel quel
    if let Ok(f) = serde_json::from_str::<Fast>(t) {
        let body = f.body.map(|b| b.get()).filter(|b| *b != "null").map(js::compact_json);
        return Ok(Incoming { kind: js::str_or_empty(f.kind.as_ref()), pid: js::str_or_empty(f.pid.as_ref()), blobs: blobs_of(f.blobs.as_ref()), body });
    }
    // sinon, la lecture complète (et ses erreurs) comme JSON.parse
    let v: Value = serde_json::from_str(t).map_err(|_| fail(400, "server", "JSON invalide"))?;
    let body = prop(&v, "body")?.filter(|b| !b.is_null()).map(|b| b.to_string());
    Ok(Incoming { kind: js::str_or_empty(prop(&v, "kind")?), pid: js::str_or_empty(prop(&v, "pid")?), blobs: blobs_of(prop(&v, "blobs")?), body })
}

pub async fn post(mut req: Request, env: &Env, ctx: &Context, me: &Me) -> Res {
    let d = db(env)?;
    // 1 200 évènements par minute et par compte : assez pour importer une grosse photothèque, pas pour remplir la base
    if hit(&d, &format!("events:{}", me.user), 1200.0, 60e3).await? {
        return Err(fail(429, "slow", "Trop d’envois d’un coup : la synchronisation reprendra dans une minute.").retry(60));
    }
    let b = parse(&body_text(&mut req, MAX_BODY).await?)?;
    if !matches!(b.kind.as_str(), "put" | "delete" | "want") {
        return Err(fail(400, "kind", "Type d’évènement inconnu."));
    }
    if !validate::pid(&b.pid) && !(b.kind == "want" && b.pid == "*") {
        return Err(fail(400, "pid", "Identifiant de projet invalide."));
    }
    if b.body.as_ref().is_some_and(|t| js::len(t) > MAX_BODY) {
        return Err(fail(413, "big", "Projet trop gros."));
    }
    let blobs = serde_json::to_string(&b.blobs)?;
    let body = b.body.as_deref().map(s).unwrap_or(wasm_bindgen::JsValue::NULL);
    let role = if b.pid == "*" { None } else { role_of(env, &b.pid, &me.user).await? };
    if role.is_some() && b.kind == "put" {
        // chacun son tour : une photo partagée ne s'enregistre que chez celui qui la tient
        if let Some(l) = lock_of(env, &b.pid).await? {
            if l.user != me.user {
                return Err(fail(423, "locked", "Quelqu’un d’autre retouche cette photo en ce moment.").with("holder", json!({ "name": l.name, "until": l.until })));
            }
        }
    }
    let t = now();
    let seq: Option<f64> = q(&d, "INSERT INTO events(user,device,kind,pid,body,blobs,created) VALUES(?,?,?,?,?,?,?) RETURNING seq", &[s(&me.user), s(&me.device), s(&b.kind), s(&b.pid), body.clone(), s(&blobs), n(t)])?
        .first(Some("seq"))
        .await?;
    let seq = seq.unwrap_or(0.0);
    notify(env, ctx, &me.user, json!({ "type": "event", "seq": js::num(seq), "from": me.device }));
    if let Some(role) = role {
        if b.kind == "delete" && role != "owner" {
            // un invité qui supprime quitte seulement le partage
            q(&d, "DELETE FROM shares WHERE pid = ? AND user = ?", &[s(&b.pid), s(&me.user)])?.run().await?;
            tell_share(env, ctx, &b.pid, &me.user, json!({ "type": "share", "pid": b.pid }));
        } else {
            let members = others(env, &b.pid, &me.user).await?;
            if !members.is_empty() {
                let mut st = Vec::new();
                for o in &members {
                    st.push(q(
                        &d,
                        "INSERT INTO events(user,device,kind,pid,body,blobs,created,origin) VALUES(?,?,?,?,?,?,?,?) RETURNING seq",
                        &[s(&o.user), s(&me.device), s(&b.kind), s(&b.pid), body.clone(), s(&blobs), n(now()), s(&me.user)],
                    )?);
                }
                #[derive(Deserialize)]
                struct Seq {
                    seq: f64,
                }
                for (o, r) in members.iter().zip(d.batch(st).await?) {
                    if let Some(c) = r.results::<Seq>()?.first() {
                        notify(env, ctx, &o.user, json!({ "type": "event", "seq": js::num(c.seq), "from": me.device }));
                    }
                }
            }
            if b.kind == "delete" {
                d.batch(vec![q(&d, "DELETE FROM shares WHERE pid = ?", &[s(&b.pid)])?, q(&d, "DELETE FROM locks WHERE pid = ?", &[s(&b.pid)])?]).await?;
            }
        }
    }
    json(json!({ "seq": js::num(seq) }), 201)
}

pub async fn list(env: &Env, me: &Me, url: &Url) -> Res {
    #[derive(Deserialize)]
    struct Row {
        seq: i64,
        device: String,
        kind: String,
        pid: String,
        body: Option<String>,
        blobs: String,
        created: i64,
        origin: Option<String>,
    }
    #[derive(Serialize)]
    struct Out {
        seq: i64,
        device: String,
        kind: String,
        pid: String,
        body: Option<Box<RawValue>>,
        blobs: Box<RawValue>,
        created: i64,
        origin: Option<String>,
    }
    let after = url.query_pairs().find(|(k, _)| k == "after").map(|(_, v)| js::str_to_num(&v)).unwrap_or(0.0);
    let rows: Vec<Row> = q(&db(env)?, "SELECT seq, device, kind, pid, body, blobs, created, origin FROM events WHERE user = ? AND seq > ? ORDER BY seq LIMIT 200", &[s(&me.user), n(js::non_negative(after))])?
        .all()
        .await?
        .results()?;
    let more = rows.len() == 200;
    let mut events = Vec::with_capacity(rows.len());
    for r in rows {
        events.push(Out {
            seq: r.seq,
            device: r.device,
            kind: r.kind,
            pid: r.pid,
            body: r.body.filter(|b| !b.is_empty()).map(RawValue::from_string).transpose()?,
            blobs: RawValue::from_string(r.blobs)?,
            created: r.created,
            origin: r.origin,
        });
    }
    #[derive(Serialize)]
    struct List {
        events: Vec<Out>,
        more: bool,
    }
    Ok(json_raw(&serde_json::to_string(&List { events, more })?, 200))
}

pub async fn ack(mut req: Request, env: &Env, ctx: &Context, me: &Me) -> Res {
    let b = crate::http::body(&mut req, MAX_BODY).await?;
    let seq = js::non_negative(js::to_num(prop(&b, "seq")?));
    let d = db(env)?;
    q(&d, "UPDATE devices SET cursor = MAX(cursor, ?) WHERE id = ?", &[n(seq), s(&me.device)])?.run().await?;
    let (env2, user) = (env.clone(), me.user.clone());
    ctx.wait_until(async move {
        // ce compte, et les comptes dont on a reçu des photos partagées (en parallèle)
        let _ = transit::sweep_user(&env2, &user).await;
        #[derive(Deserialize)]
        struct O {
            origin: String,
        }
        let Ok(d) = db(&env2) else { return };
        let Ok(st) = q(&d, "SELECT DISTINCT origin FROM events WHERE user = ? AND origin IS NOT NULL", &[s(&user)]) else { return };
        if let Ok(r) = st.all().await {
            let origins: Vec<O> = r.results().unwrap_or_default();
            futures_util::future::join_all(origins.iter().map(|o| transit::sweep_user(&env2, &o.origin))).await;
        }
    });
    ok()
}
