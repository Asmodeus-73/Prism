//! Un Durable Object par compte : qui est connecté, « il y a du nouveau », et le relais WebRTC entre appareils
//! (spec sync-live). Les WebSockets utilisent l'hibernation : une connexion qui ne dit rien ne coûte rien.
use crate::auth::Me;
use crate::http::{fail, Res};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use worker::*;

/// Envoie un message aux appareils connectés d'un compte (personne de connecté : rien à faire).
pub async fn send(env: &Env, user: &str, msg: &Value) {
    let go = async {
        let init = RequestInit { method: Method::Post, body: Some(msg.to_string().into()), ..Default::default() };
        env.durable_object("LIVE")?.get_by_name(user)?.fetch_with_request(Request::new_with_init("https://live/notify", &init)?).await
    };
    let _ = go.await;
}

/// Même chose, en arrière-plan.
pub fn notify(env: &Env, ctx: &Context, user: &str, msg: Value) {
    let (env, user) = (env.clone(), user.to_string());
    ctx.wait_until(async move { send(&env, &user, &msg).await });
}

/// `/v1/live` : la WebSocket du compte.
pub async fn connect(req: &Request, env: &Env, me: &Me) -> Res {
    let mut u = Url::parse("https://live/ws").map_err(|e| Error::RustError(e.to_string()))?;
    u.query_pairs_mut().append_pair("device", &me.device).append_pair("name", &me.name);
    let init = RequestInit { headers: req.headers().clone(), ..Default::default() };
    let fwd = Request::new_with_init(u.as_str(), &init)?;
    let r = env.durable_object("LIVE")?.get_by_name(&me.user)?.fetch_with_request(fwd).await;
    r.map_err(|_| fail(500, "server", "Erreur du serveur."))
}

#[derive(Serialize, Deserialize, Clone)]
struct Peer {
    device: String,
    name: String,
}

#[durable_object]
pub struct Live {
    state: State,
}

impl Live {
    fn peer(ws: &WebSocket) -> Option<Peer> {
        ws.deserialize_attachment::<Peer>().ok().flatten()
    }
    fn peers(&self) -> Vec<Peer> {
        self.state.get_websockets().iter().filter_map(Self::peer).collect()
    }
    fn broadcast(&self, t: &str) {
        for w in self.state.get_websockets() {
            if Self::peer(&w).is_some() {
                let _ = w.send_with_str(t);
            }
        }
    }
    fn left(&self, ws: &WebSocket) {
        let me = Self::peer(ws).map(|p| p.device);
        let list: Vec<Peer> = self.peers().into_iter().filter(|p| Some(&p.device) != me.as_ref()).collect();
        let t = json!({ "type": "peers", "devices": list }).to_string();
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
            self.broadcast(&t);
            return Response::ok("ok");
        }
        let q = |k: &str| url.query_pairs().find(|(a, _)| a == k).map(|(_, v)| v.into_owned()).unwrap_or_default();
        let (device, name) = (q("device"), q("name"));
        for w in self.state.get_websockets() {
            if Self::peer(&w).is_some_and(|a| a.device == device) {
                let _ = w.close(Some(4000), Some("remplacé"));
            }
        }
        let pair = WebSocketPair::new()?;
        self.state.accept_web_socket(&pair.server);
        pair.server.serialize_attachment(Peer { device, name })?;
        self.broadcast(&json!({ "type": "peers", "devices": self.peers() }).to_string());
        Response::from_websocket(pair.client)
    }

    async fn websocket_message(&self, ws: WebSocket, msg: WebSocketIncomingMessage) -> Result<()> {
        let WebSocketIncomingMessage::String(data) = msg else { return Ok(()) };
        let Ok(Value::Object(m)) = serde_json::from_str::<Value>(&data) else { return Ok(()) };
        let me = Self::peer(&ws).map(|p| p.device).unwrap_or_default();
        match (m.get("type").and_then(Value::as_str), m.get("to")) {
            (Some("signal"), Some(Value::String(to))) if *to != me && crate::js::len(&data) <= 65536 => {
                let mut out = serde_json::Map::new();
                out.insert("type".into(), json!("signal"));
                out.insert("from".into(), json!(me));
                if let Some(d) = m.get("data") {
                    out.insert("data".into(), d.clone());
                }
                let t = Value::Object(out).to_string();
                for w in self.state.get_websockets() {
                    if Self::peer(&w).is_some_and(|a| a.device == *to) {
                        let _ = w.send_with_str(&t);
                    }
                }
            }
            (Some("ping"), _) => ws.send_with_str("{\"type\":\"pong\"}")?,
            _ => {}
        }
        Ok(())
    }

    async fn websocket_close(&self, ws: WebSocket, _code: usize, _reason: String, _clean: bool) -> Result<()> {
        self.left(&ws);
        Ok(())
    }

    async fn websocket_error(&self, ws: WebSocket, _e: Error) -> Result<()> {
        self.left(&ws);
        Ok(())
    }
}
