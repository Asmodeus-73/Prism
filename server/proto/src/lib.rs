//! Prototype jetable : chaque route /p/* teste une brique de la plateforme dont le serveur a besoin.
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;
use worker::*;

fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

fn subtle() -> Result<web_sys::SubtleCrypto> {
    let c = js_sys::Reflect::get(&js_sys::global(), &"crypto".into())?;
    Ok(c.unchecked_into::<web_sys::Crypto>().subtle())
}

/// PBKDF2-HMAC-SHA-256, 100 000 tours, 256 bits : calculé par WebCrypto (natif), pas dans le WASM.
async fn pbkdf2(pw: &str, salt: &str) -> Result<String> {
    let s = subtle()?;
    let usages = js_sys::Array::of1(&"deriveBits".into());
    let key = JsFuture::from(s.import_key_with_str("raw", &js_sys::Uint8Array::from(pw.as_bytes()), "PBKDF2", false, &usages)?).await?;
    let algo = js_sys::Object::new();
    js_sys::Reflect::set(&algo, &"name".into(), &"PBKDF2".into())?;
    js_sys::Reflect::set(&algo, &"hash".into(), &"SHA-256".into())?;
    js_sys::Reflect::set(&algo, &"salt".into(), &js_sys::Uint8Array::from(salt.as_bytes()))?;
    js_sys::Reflect::set(&algo, &"iterations".into(), &JsValue::from(100_000))?;
    let bits = JsFuture::from(s.derive_bits_with_object(&algo, &key.unchecked_into(), 256)?).await?;
    Ok(salt.to_string() + "$" + &hex(&js_sys::Uint8Array::new(&bits).to_vec()))
}

async fn sha256_hex(t: &str) -> Result<String> {
    let d = JsFuture::from(subtle()?.digest_with_str_and_u8_array("SHA-256", t.as_bytes())?).await?;
    Ok(hex(&js_sys::Uint8Array::new(&d).to_vec()))
}

/// Corps lu par morceaux, refusé dès que la limite est dépassée.
async fn body_text(req: &mut Request, max: usize) -> Result<std::result::Result<String, u16>> {
    let mut st = req.stream()?;
    let mut buf = Vec::new();
    while let Some(c) = st.next().await {
        let c = c?;
        buf.extend_from_slice(&c);
        if buf.len() > max {
            return Ok(Err(413));
        }
    }
    Ok(Ok(String::from_utf8_lossy(&buf).into_owned()))
}

#[derive(Deserialize)]
struct Seq {
    seq: f64,
}

#[derive(Serialize, Deserialize, Clone)]
struct Peer {
    device: String,
    name: String,
}

/// FixedLengthStream natif (JavaScript) : le corps va de la requête à R2 sans passer par le WASM.
fn fixed_native(req: &Request, len: u64) -> Result<web_sys::ReadableStream> {
    let ctor = js_sys::Reflect::get(&js_sys::global(), &"FixedLengthStream".into())?;
    let fl = js_sys::Reflect::construct(ctor.unchecked_ref::<js_sys::Function>(), &js_sys::Array::of1(&JsValue::from(len as f64)))?;
    let writable: web_sys::WritableStream = js_sys::Reflect::get(&fl, &"writable".into())?.unchecked_into();
    let readable: web_sys::ReadableStream = js_sys::Reflect::get(&fl, &"readable".into())?.unchecked_into();
    if let Some(b) = req.inner().body() {
        let p = b.pipe_to(&writable);
        // l'erreur éventuelle est vue par R2 (taille différente) : on ne l'attend pas ici
        wasm_bindgen_futures::spawn_local(async move {
            let _ = JsFuture::from(p).await;
        });
    } else {
        let _ = writable.close();
    }
    Ok(readable)
}

#[event(fetch)]
async fn fetch(mut req: Request, env: Env, ctx: Context) -> Result<Response> {
    let url = req.url()?;
    let path = url.path().to_string();
    let m = req.method();
    match (m, path.as_str()) {
        (_, "/v1") => Response::from_json(&serde_json::json!({"ok": true, "service": "prism-sync"})),
        (Method::Post, "/p/pbkdf2") => {
            let pw = req.text().await?;
            Response::ok(pbkdf2(&pw, &"a".repeat(32)).await?)
        }
        (Method::Post, "/p/sha") => Response::ok(sha256_hex(&req.text().await?).await?),
        (Method::Post, "/p/json") => match body_text(&mut req, 4 << 20).await? {
            Err(s) => Response::error("trop gros", s),
            Ok(t) => {
                let v: serde_json::Value = serde_json::from_str(&t).map_err(|e| Error::RustError(e.to_string()))?;
                let back = serde_json::to_string(&v["body"]).map_err(|e| Error::RustError(e.to_string()))?;
                Response::ok(back)
            }
        },
        (Method::Post, "/p/json2") => {
            // variante : texte lu en natif, « body » gardé tel quel (pas d'arbre JSON dans le WASM)
            #[derive(Deserialize)]
            struct Ev<'a> {
                #[serde(borrow)]
                body: Option<&'a serde_json::value::RawValue>,
            }
            let t = req.text().await?;
            let v: Ev = serde_json::from_str(&t).map_err(|e| Error::RustError(e.to_string()))?;
            Response::ok(v.body.map(|b| b.get().to_string()).unwrap_or_default())
        }
        (Method::Post, "/p/d1") => {
            let db = env.d1("DB")?;
            db.exec("CREATE TABLE IF NOT EXISTS t(seq INTEGER PRIMARY KEY AUTOINCREMENT, v TEXT)").await?;
            db.batch(vec![
                db.prepare("INSERT INTO t(v) VALUES(?)").bind(&["a".into()])?,
                db.prepare("INSERT INTO t(v) VALUES(?)").bind(&["b".into()])?,
            ])
            .await?;
            let r: Option<Seq> = db.prepare("INSERT INTO t(v) VALUES(?) RETURNING seq").bind(&["c".into()])?.first(None).await?;
            let n: Option<f64> = db.prepare("SELECT COUNT(*) AS n FROM t").first(Some("n")).await?;
            // tâche de fond après la réponse
            let db2 = env.d1("DB")?;
            ctx.wait_until(async move {
                let _ = db2.prepare("INSERT INTO t(v) VALUES('fond')").run().await;
            });
            Response::from_json(&serde_json::json!({"seq": r.map(|x| x.seq), "count": n}))
        }
        (Method::Put, p) if p.starts_with("/p/blob/") => {
            let key = &p[8..];
            let size: u64 = req.headers().get("content-length")?.and_then(|s| s.parse().ok()).unwrap_or(0);
            let b = env.bucket("TRANSIT")?;
            let mode = url.query_pairs().find(|(k, _)| k == "mode").map(|(_, v)| v.into_owned()).unwrap_or_default();
            let put = if mode == "wasm" {
                // variante workers-rs : chaque octet traverse la mémoire du WASM
                let st = req.stream()?.map(|c| c.map(|v| v.to_vec()));
                b.put(key, FixedLengthStream::wrap(st, size)).execute().await
            } else {
                b.put(key, fixed_native(&req, size)?).execute().await
            };
            if put.is_err() {
                let _ = b.delete(key).await;
                return Response::error("taille", 400);
            }
            let h = b.head(key).await?;
            match h {
                Some(o) if o.size() == size => Response::ok("ok"),
                _ => {
                    let _ = b.delete(key).await;
                    Response::error("taille", 400)
                }
            }
        }
        (Method::Get, "/p/live") => {
            let dev = url.query_pairs().find(|(k, _)| k == "device").map(|(_, v)| v.into_owned()).unwrap_or_default();
            let mut u = Url::parse("https://live/ws")?;
            u.query_pairs_mut().append_pair("device", &dev).append_pair("name", "Mac");
            let init = RequestInit { headers: req.headers().clone(), ..Default::default() };
            let fwd = Request::new_with_init(u.as_str(), &init)?;
            env.durable_object("LIVE")?.get_by_name("compte1")?.fetch_with_request(fwd).await
        }
        (Method::Post, "/p/notify") => {
            let t = req.text().await?;
            let init = RequestInit { method: Method::Post, body: Some(t.into()), ..Default::default() };
            env.durable_object("LIVE")?.get_by_name("compte1")?.fetch_with_request(Request::new_with_init("https://live/notify", &init)?).await
        }
        _ => Response::error("route", 404),
    }
}

#[event(scheduled)]
async fn scheduled(_ev: ScheduledEvent, env: Env, _ctx: ScheduleContext) {
    if let Ok(db) = env.d1("DB") {
        let _ = db.exec("CREATE TABLE IF NOT EXISTS cron(n INTEGER)").await;
        let _ = db.prepare("INSERT INTO cron(n) VALUES(1)").run().await;
    }
}

#[durable_object]
pub struct Live {
    state: State,
}

impl Live {
    fn peers(&self) -> Vec<Peer> {
        self.state.get_websockets().iter().filter_map(|w| w.deserialize_attachment::<Peer>().ok().flatten()).collect()
    }
    fn broadcast(&self, t: &str, except: Option<&str>) {
        for w in self.state.get_websockets() {
            if let Ok(Some(a)) = w.deserialize_attachment::<Peer>() {
                if Some(a.device.as_str()) != except {
                    let _ = w.send_with_str(t);
                }
            }
        }
    }
    fn left(&self, ws: &WebSocket) {
        let me = ws.deserialize_attachment::<Peer>().ok().flatten().map(|p| p.device);
        let list: Vec<Peer> = self.peers().into_iter().filter(|p| Some(&p.device) != me.as_ref()).collect();
        let t = serde_json::json!({"type": "peers", "devices": list}).to_string();
        for w in self.state.get_websockets() {
            if w != *ws {
                let _ = w.send_with_str(&t);
            }
        }
    }
}

impl DurableObject for Live {
    fn new(state: State, _env: Env) -> Self {
        Self { state }
    }
    async fn fetch(&self, mut req: Request) -> Result<Response> {
        let url = req.url()?;
        if url.path() == "/notify" {
            let t = req.text().await?;
            self.broadcast(&t, None);
            return Response::ok("ok");
        }
        let q = |k: &str| url.query_pairs().find(|(a, _)| a == k).map(|(_, v)| v.into_owned()).unwrap_or_default();
        let (device, name) = (q("device"), q("name"));
        for w in self.state.get_websockets() {
            if let Ok(Some(a)) = w.deserialize_attachment::<Peer>() {
                if a.device == device {
                    let _ = w.close(Some(4000), Some("remplacé"));
                }
            }
        }
        let pair = WebSocketPair::new()?;
        self.state.accept_web_socket(&pair.server);
        pair.server.serialize_attachment(Peer { device, name })?;
        self.broadcast(&serde_json::json!({"type": "peers", "devices": self.peers()}).to_string(), None);
        Response::from_websocket(pair.client)
    }
    async fn websocket_message(&self, ws: WebSocket, msg: WebSocketIncomingMessage) -> Result<()> {
        let WebSocketIncomingMessage::String(s) = msg else { return Ok(()) };
        let Ok(m) = serde_json::from_str::<serde_json::Value>(&s) else { return Ok(()) };
        let me = ws.deserialize_attachment::<Peer>()?.map(|p| p.device).unwrap_or_default();
        match (m["type"].as_str(), m["to"].as_str()) {
            (Some("signal"), Some(to)) if to != me && s.encode_utf16().count() <= 65536 => {
                let t = serde_json::json!({"type": "signal", "from": me, "data": m["data"]}).to_string();
                for w in self.state.get_websockets() {
                    if let Ok(Some(a)) = w.deserialize_attachment::<Peer>() {
                        if a.device == to {
                            let _ = w.send_with_str(&t);
                        }
                    }
                }
            }
            (Some("ping"), _) => ws.send_with_str("{\"type\":\"pong\"}")?,
            _ => {}
        }
        Ok(())
    }
    async fn websocket_close(&self, ws: WebSocket, _c: usize, _r: String, _w: bool) -> Result<()> {
        self.left(&ws);
        Ok(())
    }
    async fn websocket_error(&self, ws: WebSocket, _e: Error) -> Result<()> {
        self.left(&ws);
        Ok(())
    }
}
