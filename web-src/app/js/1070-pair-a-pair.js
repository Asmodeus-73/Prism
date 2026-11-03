/* ================= 1.0: transfert direct entre appareils (WebRTC) =================
   Quand deux appareils du même compte sont allumés, les fichiers d'un projet passent directement de l'un à l'autre,
   chiffrés (DTLS), sans rien stocker chez Cloudflare : le serveur ne fait que présenter les appareils (messages « signal »).
   Un appareil demande un fichier par sa clé ; l'autre l'envoie par morceaux de 64 Ko. Si la connexion directe échoue,
   la synchronisation redemande le projet en passant par le transit. */
const PEER = {
  ICE: [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }],
  CHUNK: 64 * 1024,
  conns: new Map(),          // appareil -> {pc, dc, open: Promise, q: [], cur}
};
function peerConn(dev, initiator) {
  let c = PEER.conns.get(dev);
  if (c && !['failed', 'closed'].includes(c.pc.connectionState)) return c;
  const pc = new RTCPeerConnection({ iceServers: PEER.ICE });
  c = { pc, dc: null, q: [], cur: null };
  let openRes, openRej; c.open = new Promise((r, j) => { openRes = r; openRej = j }); c.open.catch(() => { });
  const setup = dc => { c.dc = dc; dc.binaryType = 'arraybuffer'; dc.bufferedAmountLowThreshold = 1 << 20; dc.onopen = () => openRes(dc); dc.onclose = () => peerDrop(dev); dc.onmessage = ev => peerMsg(dev, c, ev.data) };
  pc.onicecandidate = e => { if (e.candidate) PrismSync.signal(dev, { k: 'ice', c: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }) };
  pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) { openRej(new Error('connexion directe impossible')); peerDrop(dev) } };
  if (initiator) { setup(pc.createDataChannel('prism', { ordered: true })); pc.createOffer().then(o => pc.setLocalDescription(o)).then(() => PrismSync.signal(dev, { k: 'offer', sdp: pc.localDescription.sdp })).catch(openRej) }
  else pc.ondatachannel = e => setup(e.channel);
  setTimeout(() => openRej(new Error('délai dépassé')), 15000);
  PEER.conns.set(dev, c); return c;
}
function peerDrop(dev) { const c = PEER.conns.get(dev); if (!c) return; PEER.conns.delete(dev); try { c.pc.close() } catch (e) { }
  for (const r of [c.cur, ...c.q].filter(Boolean)) r.reject(new Error('connexion coupée')) }
async function peerOnSignal(from, d) {
  try {
    if (d.k === 'offer') { const c = peerConn(from, false); await c.pc.setRemoteDescription({ type: 'offer', sdp: d.sdp }); const a = await c.pc.createAnswer(); await c.pc.setLocalDescription(a); PrismSync.signal(from, { k: 'answer', sdp: c.pc.localDescription.sdp }) }
    else if (d.k === 'answer') { const c = PEER.conns.get(from); if (c) await c.pc.setRemoteDescription({ type: 'answer', sdp: d.sdp }) }
    else if (d.k === 'ice') { const c = PEER.conns.get(from); if (c && d.c) await c.pc.addIceCandidate(d.c).catch(() => { }) }
  } catch (e) { console.warn('[direct] signal', e) }
}
/* réception : une réponse à la fois, dans l'ordre des demandes */
function peerMsg(dev, c, data) {
  if (typeof data === 'string') {
    let m; try { m = JSON.parse(data) } catch (e) { return }
    if (m.t === 'get') { peerServe(c, m.key); return }
    const r = c.cur; if (!r) return;
    if (m.t === 'none') { c.cur = null; r.resolve(null); peerNext(c) }
    else if (m.t === 'blob') { r.size = m.size; r.type = m.type; r.parts = []; r.got = 0; if (!m.size) { c.cur = null; r.resolve(new Blob([], { type: m.type })); peerNext(c) } }
    return;
  }
  const r = c.cur; if (!r || !r.parts) return;
  r.parts.push(data); r.got += data.byteLength;
  if (r.got >= r.size) { c.cur = null; clearTimeout(r.tm); r.resolve(new Blob(r.parts, { type: r.type })); peerNext(c) }
}
function peerNext(c) { if (c.cur || !c.q.length || !c.dc || c.dc.readyState !== 'open') return; c.cur = c.q.shift(); c.cur.tm = setTimeout(() => { const r = c.cur; if (r) { c.cur = null; r.reject(new Error('délai dépassé')); peerNext(c) } }, 120000); c.dc.send(JSON.stringify({ t: 'get', key: c.cur.key })) }
/* envoi : le fichier demandé, par morceaux, en attendant que le tampon se vide */
let peerServing = Promise.resolve();
function peerServe(c, key) {
  peerServing = peerServing.then(async () => {
    const dc = c.dc; if (!dc || dc.readyState !== 'open') return;
    const b = typeof key === 'string' ? await IDB.get('blobs', key).catch(() => null) : null;
    if (!b) { dc.send(JSON.stringify({ t: 'none', key })); return }
    dc.send(JSON.stringify({ t: 'blob', key, size: b.size, type: b.type || '' }));
    for (let o = 0; o < b.size; o += PEER.CHUNK) {
      if (dc.readyState !== 'open') return;
      if (dc.bufferedAmount > 4 << 20) await new Promise(r => { dc.onbufferedamountlow = () => { dc.onbufferedamountlow = null; r() } });
      dc.send(await b.slice(o, o + PEER.CHUNK).arrayBuffer());
    }
  }).catch(e => console.warn('[direct] envoi', e));
}
async function peerGet(dev, key) {
  const c = peerConn(dev, true); await c.open;
  return new Promise((resolve, reject) => { c.q.push({ key, resolve, reject }); peerNext(c) });
}
/* récupère des fichiers chez les appareils allumés ; rend les clés obtenues */
async function peerFetchMany(keys) {
  const S2 = PrismSync._SY, peers = (S2.peers || []).map(p => p.device), got = [];
  for (const dev of peers) {
    const left = keys.filter(k => !got.includes(k)); if (!left.length) break;
    try { for (const k of left) { const b = await peerGet(dev, k); if (b) { await IDB.put('blobs', k, b); got.push(k) } } }
    catch (e) { console.warn('[direct]', dev, e.message) }
  }
  return got;
}
if (typeof RTCPeerConnection === 'function') window.PrismPeer = { onSignal: peerOnSignal, fetchMany: peerFetchMany, get: peerGet, _PEER: PEER };
