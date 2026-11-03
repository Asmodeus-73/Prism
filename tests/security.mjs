// Attaques simulées contre Prism : le serveur de synchro (server/, dans Miniflare) et l'éditeur (navigateur).
// Chaque attaque doit échouer. Run: node tests/security.mjs   (après npm ci dans server/)
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import zlib from 'node:zlib';import {createRequire} from 'node:module';
const here=path.dirname(new URL(import.meta.url).pathname),root=path.join(here,'..','web'),srv=path.join(here,'..','server');
const require=createRequire(import.meta.url);const sreq=createRequire(path.join(srv,'package.json'));
let pw;try{pw=require('playwright')}catch(e){pw=require(process.env.PLAYWRIGHT_MODULE||'/opt/node22/lib/node_modules/playwright')}
const {Miniflare}=sreq('miniflare');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.wasm':'application/wasm','.json':'application/json','.png':'image/png','.jpg':'image/jpeg'};
const server=http.createServer((q,r)=>{let u;try{u=decodeURIComponent(new URL(q.url,'http://x').pathname)}catch(e){r.writeHead(400);r.end();return}const f=path.join(root,u==='/'?'index.html':u);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end();return}r.writeHead(200,{'content-type':TYPES[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const PAGE=`http://127.0.0.1:${server.address().port}/index.html`;
const mf=new Miniflare({modules:true,scriptPath:path.join(srv,'src/index.js'),compatibilityDate:'2026-07-30',host:'127.0.0.1',port:0,
  d1Databases:['DB'],r2Buckets:['TRANSIT'],durableObjects:{LIVE:{className:'Live',useSQLite:true}},bindings:{TRANSIT_LIMIT:'50000000',USER_LIMIT:'30000000',TRANSIT_HOURS:'24',EVENTS_DAYS:'30'}});
const API=(await mf.ready).toString().replace(/\/$/,'');const db=await mf.getD1Database('DB');
for(const s of fs.readFileSync(path.join(srv,'schema.sql'),'utf8').replace(/--.*\n/g,'').split(';').map(x=>x.trim().replace(/\s+/g,' ')).filter(Boolean))await db.exec(s);

let fails=0,n=0;const ok=(c,m)=>{console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)fails++};const attack=t=>console.log(`\n${++n}. ${t}`);
const call=async(p,{method='GET',token,json,body,headers={}}={})=>{const h={...headers};if(token)h.authorization='Bearer '+token;if(json)h['content-type']='application/json';
  const r=await fetch(API+p,{method,headers:h,body:json?JSON.stringify(json):body});const t=r.headers.get('content-type')||'';return {status:r.status,headers:r.headers,data:t.includes('json')?await r.json():await r.text()}};
const signup=(email,ip,name='Mac')=>call('/v1/signup',{method:'POST',json:{email,password:'motdepasse1',device:{name,platform:'web'}},headers:{'cf-connecting-ip':ip}});
const login=(email,password,ip,name='Tour')=>call('/v1/login',{method:'POST',json:{email,password,device:{name}},headers:{'cf-connecting-ip':ip}});
const clear=()=>db.exec('DELETE FROM attempts');

// ---------- serveur ----------
const vic=await signup('victime@example.com','10.0.0.1'),T=vic.data.token;
const evil=await signup('pirate@example.com','10.0.0.2'),E=evil.data.token;

attack('Deviner le mot de passe d’un compte (force brute)');
let st=[];for(let i=0;i<12;i++)st.push((await login('victime@example.com','essai'+i,'10.1.0.'+i)).status);
ok(st.slice(0,10).every(s=>s===401)&&st.slice(10).every(s=>s===429),'bloqué après 10 essais, même en changeant d’adresse IP');
ok((await login('victime@example.com','motdepasse1','10.1.0.99')).status===429,'même le bon mot de passe attend un quart d’heure : l’attaquant ne peut pas savoir s’il a trouvé');
await clear();

attack('Essayer un mot de passe courant sur des centaines de comptes depuis un même réseau');
st=[];for(let i=0;i<33;i++)st.push((await login(`cible${i}@example.com`,'azerty123','10.2.0.1')).status);
ok(st.slice(0,30).every(s=>s===401)&&st.slice(30).every(s=>s===429),'bloqué après 30 échecs depuis ce réseau');
await clear();
st=[];for(let i=0;i<7;i++)st.push((await signup(`spam${i}@example.com`,'10.3.0.1')).status);
ok(st.slice(0,5).every(s=>s===201)&&st.slice(5).every(s=>s===429),'pas plus de 5 comptes créés par heure depuis un même réseau');
await clear();

attack('Savoir si une adresse a un compte Prism');
const t0=performance.now(),a1=await login('victime@example.com','faux-mot','10.4.0.1'),t1=performance.now(),a2=await login('personne@example.com','faux-mot','10.4.0.2'),t2=performance.now();
ok(a1.status===a2.status&&a1.data.message===a2.data.message,'même réponse pour une adresse inconnue et un mauvais mot de passe');
ok(Math.abs((t1-t0)-(t2-t1))<Math.max(60,(t1-t0)*.6),`même temps de réponse (${Math.round(t1-t0)} ms contre ${Math.round(t2-t1)} ms)`);
await clear();

attack('Lire les photos d’un autre compte (directement ou par un faux partage)');
await call('/v1/blobs/t_secret',{method:'PUT',token:T,body:new Uint8Array(2000),headers:{'content-length':'2000','content-type':'image/png'}});
await call('/v1/events',{method:'POST',token:T,json:{kind:'put',pid:'p_secret',body:{id:'p_secret',name:'privé.jpg',w:10,h:10},blobs:['t_secret']}});
ok((await call('/v1/blobs/t_secret',{token:E})).status===404,'le fichier de la victime est introuvable pour le pirate');
ok(!(await call('/v1/events?after=0',{token:E})).data.events.some(e=>e.pid==='p_secret'),'son journal ne montre rien de la victime');
ok((await call('/v1/devices/'+vic.data.device,{method:'DELETE',token:E})).status===404,'il ne peut pas retirer un appareil de la victime');
ok((await call('/v1/me',{token:E})).data.devices.every(d=>d.id!==vic.data.device),'il ne voit pas ses appareils');
ok((await call('/v1/shares',{method:'POST',token:E,json:{pid:'p_secret',email:'pirate@example.com'}})).status===404,'il ne peut pas « partager » la photo de la victime avec lui-même');
ok((await call('/v1/blobs/t_secret?from='+vic.data.user,{token:E})).status===404,'ni lire ses fichiers en se faisant passer pour un invité');
ok((await call('/v1/locks/p_secret',{method:'POST',token:E})).status===404,'ni bloquer sa photo');

attack('Sortir de son dossier avec des noms de fichier piégés');
const keys=['..','../'+vic.data.user+'/t_secret','%2e%2e%2f'+vic.data.user+'%2ft_secret','a/b','%E0%A4%A','x'.repeat(200),'t_secret%00.png'];
const ks=[];for(const k of keys)ks.push((await call('/v1/blobs/'+k,{token:E})).status);
ok(ks.every(s=>s===400||s===404),'tous refusés ('+ks.join(', ')+')');
ok(ks.every(s=>s!==500),'aucune erreur du serveur');

attack('Entrer sans le bon jeton');
ok((await call('/v1/me',{token:'0'.repeat(64)})).status===401,'jeton inventé refusé');
ok((await call('/v1/me?token='+T)).status===401,'jeton glissé dans l’adresse refusé (il finirait dans des journaux)');
const tmp=(await login('victime@example.com','motdepasse1','10.5.0.1','Portable')).data;
await call('/v1/logout',{method:'POST',token:tmp.token});ok((await call('/v1/me',{token:tmp.token})).status===401,'jeton refusé après déconnexion');
const lost=(await login('victime@example.com','motdepasse1','10.5.0.1','Téléphone volé')).data;
await call('/v1/devices/'+lost.device,{method:'DELETE',token:T});ok((await call('/v1/me',{token:lost.token})).status===401,'téléphone volé retiré du compte : son jeton ne marche plus');

attack('Injection SQL');
const inj=[await login("' OR '1'='1' --@x.fr","x' OR '1'='1",'10.6.0.1'),await call('/v1/events',{method:'POST',token:E,json:{kind:'put',pid:"p' OR 1=1--",blobs:[]}}),
  await call('/v1/events?after=0%20OR%201=1',{token:E}),await call("/v1/devices/x'%20OR%20'1'='1",{method:'DELETE',token:E})];
ok(inj[0].status===401&&inj[1].status===400,'adresse et identifiant piégés refusés');
ok(!(inj[2].data.events||[]).some(e=>e.pid==='p_secret'),'curseur piégé : toujours rien de la victime');
ok((await db.prepare('SELECT COUNT(*) AS n FROM users').first()).n>=2&&(await db.prepare('SELECT COUNT(*) AS n FROM devices WHERE user=?').bind(vic.data.user).first()).n>=1,'aucune table vidée');
await clear();

attack('Déposer une page piégée sur le serveur (HTML ou SVG avec script)');
const page='<html><script>alert(document.cookie)</script></html>';
await call('/v1/blobs/t_html',{method:'PUT',token:E,body:page,headers:{'content-length':String(page.length),'content-type':'text/html'}});
await call('/v1/blobs/t_svg',{method:'PUT',token:E,body:page,headers:{'content-length':String(page.length),'content-type':'image/svg+xml'}});
const g1=await call('/v1/blobs/t_html',{token:E}),g2=await call('/v1/blobs/t_svg',{token:E});
ok([g1,g2].every(g=>g.headers.get('content-type')==='application/octet-stream'),'renvoyées en binaire brut, jamais comme une page');
ok([g1,g2].every(g=>g.headers.get('x-content-type-options')==='nosniff'&&/sandbox/.test(g.headers.get('content-security-policy')||'')&&/attachment/.test(g.headers.get('content-disposition')||'')),'le navigateur a interdiction de les exécuter');
ok((await call('/v1/blobs/t_secret',{token:T})).headers.get('content-type')==='image/png','une vraie photo garde son type');

attack('Saturer le serveur (fichiers énormes, transit rempli par un seul compte)');
const lie=await new Promise(res=>{const u=new URL(API+'/v1/blobs/t_big'),q=http.request({host:u.hostname,port:u.port,path:u.pathname,method:'PUT',headers:{authorization:'Bearer '+E,'content-length':String(600<<20)}},r=>{res(r.statusCode);r.resume();q.destroy()});q.on('error',()=>res(0));q.write(Buffer.alloc(10))});
ok(lie===413,'fichier annoncé à 600 Mo refusé d’emblée');
const big=await call('/v1/events',{method:'POST',token:E,json:{kind:'put',pid:'p1',body:{x:'a'.repeat(5<<20)}}}).catch(e=>({status:e.cause&&e.cause.code==='ECONNRESET'?413:0}));
ok(big.status===413,'projet de 5 Mo refusé (le serveur coupe avant la fin)');
let full=0;for(let i=0;i<4&&!full;i++){const r=await call('/v1/blobs/t_fill'+i,{method:'PUT',token:E,body:new Uint8Array(9e6),headers:{'content-length':String(9e6)}});if(r.status===507)full=i}
ok(full===3,'le pirate est arrêté à sa part du transit (30 Mo ici, 6 Go en vrai)');
ok((await call('/v1/blobs/t_v2',{method:'PUT',token:T,body:new Uint8Array(9e6),headers:{'content-length':String(9e6)}})).status===201,'la victime peut encore envoyer ses photos');

attack('Espionner le transfert direct entre les appareils d’un autre compte');
const wsOpen=tok=>new Promise((res,rej)=>{const w=new WebSocket(API.replace(/^http/,'ws')+'/v1/live?token='+tok);const got=[];w.onmessage=e=>got.push(JSON.parse(e.data));w.onopen=()=>res({w,got});w.onerror=rej});
const vws=await wsOpen(T),ews=await wsOpen(E);await new Promise(r=>setTimeout(r,300));
ews.w.send(JSON.stringify({type:'signal',to:vic.data.device,data:{sdp:'offre piégée'}}));await new Promise(r=>setTimeout(r,500));
ok(!vws.got.some(m=>m.type==='signal'),'son message n’arrive pas chez la victime');
ok(!ews.got.some(m=>m.type==='peers'&&m.devices.some(d=>d.device===vic.data.device)),'il ne voit pas les appareils allumés de la victime');
let wsBad=false;try{await wsOpen('0'.repeat(64))}catch(e){wsBad=true}ok(wsBad,'connexion en direct refusée sans vrai jeton');
vws.w.close();ews.w.close();

// ---------- l'éditeur ----------
const ENGINE=process.env.PRISM_BROWSER||'chromium';
const browser=ENGINE==='chromium'?await pw.chromium.launch({args:['--enable-unsafe-swiftshader','--use-gl=swiftshader']}):await pw[ENGINE].launch();
const c=await browser.newContext({viewport:{width:1280,height:800}}),p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e)));
p.on('dialog',d=>{errs.push('dialog '+d.message());d.dismiss()});
await p.route(/fonts\.(googleapis|gstatic)\.com|api\.github\.com/,r=>r.abort());await p.goto(PAGE);await p.waitForFunction(()=>window.PrismSync&&typeof loadSample==='function');
const until=async(fn,arg,ms=15000)=>{try{await p.waitForFunction(fn,arg,{timeout:ms,polling:200});return true}catch(e){return false}};
const pwned=()=>p.evaluate(()=>window.__pwn||null);
try{
  await p.evaluate(([u])=>PrismSync.connect('login',u,'victime@example.com','motdepasse1'),[API]);
  const base=await p.evaluate(async()=>{await loadSample();await new Promise(r=>setTimeout(r,400));S.doc.nosave=false;S.doc.saved=false;while(SAVE.running)await new Promise(r=>setTimeout(r,50));await saveNow();
    const m=await IDB.get('projects',S.doc.pid);closeDoc();return {m,keys:[...manifestKeys(m)]}});
  // un « appareil » du compte, piraté, envoie des projets piégés
  const bad=(await login('victime@example.com','motdepasse1','10.7.0.1','Appareil piraté')).data.token;
  const XSS='<img src=x onerror="window.__pwn=1">"><svg onload="window.__pwn=2"><script>window.__pwn=3</script>';
  const send=(pid,body,raw)=>fetch(API+'/v1/events',{method:'POST',headers:{authorization:'Bearer '+bad,'content-type':'application/json'},body:raw||JSON.stringify({kind:'put',pid,body,blobs:base.keys})});

  attack('Photo au nom piégé envoyée par un appareil piraté (code caché dans le nom)');
  await send('p_xss',{...base.m,id:'p_xss',name:XSS,updatedAt:Date.now()+1});
  ok(await until(()=>LIB.items.some(i=>i.id==='p_xss'),null,20000),'la photo arrive');
  await p.evaluate(async()=>{await openLibrary();await new Promise(r=>setTimeout(r,500));closeLibrary&&closeLibrary();const e=$('#empty');if(e)e.dispatchEvent(new Event('prism-refresh'));await new Promise(r=>setTimeout(r,300));
    await libOpen('p_xss');await new Promise(r=>setTimeout(r,800));
    for(const k of Object.keys(MENU2)){try{openBar(k);await new Promise(r=>setTimeout(r,60))}catch(e){}}document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));
    try{PrismTrash.dialog();await new Promise(r=>setTimeout(r,200));closeDialog()}catch(e){}});
  ok(!(await pwned()),'Photothèque, accueil, onglet, menus : le code n’est jamais exécuté');
  ok(await p.evaluate(()=>!document.querySelector('img[src="x"],svg[onload],body script:not([src])')||![...document.querySelectorAll('img[src="x"]')].length),'aucune balise piégée dans la page');

  attack('Projet piégé : prendre la place d’une autre photo, dimensions folles, « pollution » des objets');
  const nb0=await p.evaluate(()=>LIB.items.length);
  await send('p_a',{...base.m,id:base.m.id,name:'remplacée !',updatedAt:Date.now()+5});
  await send('p_big',{...base.m,id:'p_big',w:65536,h:65536,updatedAt:Date.now()+5});
  await send(null,null,JSON.stringify({kind:'put',pid:'p_proto',blobs:base.keys,body:{...base.m,id:'p_proto',name:'proto',updatedAt:Date.now()+5}}).replace('"body":{','"body":{"__proto__":{"pwn":1},"constructor":{"prototype":{"pwn":1}},'));
  await send('p_mark',{...base.m,id:'p_mark',name:'témoin',updatedAt:Date.now()+6});
  ok(await until(()=>LIB.items.some(i=>i.id==='p_mark'),null,20000),'les évènements sont traités');
  ok(await p.evaluate(async id=>((await IDB.get('projects',id))||{}).name!=='remplacée !',base.m.id),'une photo ne peut pas en écraser une autre sous un faux identifiant');
  ok(await p.evaluate(async()=>!(await IDB.get('projects','p_big'))),'projet de 65 536 × 65 536 px refusé');
  ok(await until(()=>LIB.items.some(i=>i.id==='p_proto'),null,5000),'le projet « contaminé » arrive (nettoyé)');
  ok(await p.evaluate(async()=>{try{await libOpen('p_proto')}catch(e){}await new Promise(r=>setTimeout(r,300));return ({}).pwn===undefined&&Object.prototype.pwn===undefined}),'les objets de Prism ne sont pas contaminés');
  ok(nb0>0&&!errs.length,'aucun plantage '+errs.slice(0,2).join(' | '));

  attack('Fichiers piégés ouverts dans Prism (SVG avec script, PNG géant, PSD, TIFF, RAW et ZIP corrompus)');
  const crc=b=>{let c=~0;for(const x of b){c^=x;for(let k=0;k<8;k++)c=c&1?(c>>>1)^0xedb88320:c>>>1}return ~c>>>0};
  const chunk=(t,d)=>{const b=Buffer.alloc(12+d.length);b.writeUInt32BE(d.length,0);b.write(t,4,'ascii');d.copy(b,8);b.writeUInt32BE(crc(Buffer.concat([Buffer.from(t),d])),8+d.length);return b};
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(60000,0);ihdr.writeUInt32BE(60000,4);ihdr[8]=16;ihdr[9]=6;
  const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(Buffer.alloc(1<<16))),chunk('IEND',Buffer.alloc(0))]);
  const junk=n=>{const b=Buffer.alloc(n);for(let i=0;i<n;i++)b[i]=(i*2654435761>>>13)&255;return b};
  const psd=Buffer.concat([Buffer.from('8BPS'),Buffer.from([0,1,0,0,0,0,0,0,0,3,0,0,0xff,0xff,0,0,0xff,0xff,0,16,0,3]),junk(4000)]);
  const files=[{name:'piege.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" onload="window.__pwn=4"><script>window.__pwn=5</script><rect width="40" height="40"/></svg>')},
    {name:'geant.png',mimeType:'image/png',buffer:png},{name:'piege.psd',mimeType:'image/vnd.adobe.photoshop',buffer:psd},
    {name:'piege.tif',mimeType:'image/tiff',buffer:Buffer.concat([Buffer.from([0x49,0x49,42,0,8,0,0,0,0xff,0xff]),junk(3000)])},
    {name:'piege.cr2',mimeType:'application/octet-stream',buffer:junk(5000)},
    {name:'piege.zip',mimeType:'application/zip',buffer:Buffer.concat([Buffer.from('PK\x03\x04'),junk(3000)])}];
  const res=[];
  for(const f of files){await p.evaluate(()=>{window.__d0=S.doc});await p.setInputFiles('#fileOpen',f);
    const done=await until(()=>{const b=$('#busy');return (!b||b.hidden)&&(S.doc!==window.__d0||!$('#toast').hidden)},null,30000);
    res.push(f.name+(done?'':' (bloqué)'));await p.evaluate(()=>{closeDialog&&closeDialog();if(S.doc&&S.doc.w*S.doc.h>MAX_PX)window.__toobig=S.doc.w+'x'+S.doc.h})}
  ok(res.every(r=>!r.includes('bloqué')),'Prism reste utilisable après chacun : '+res.join(', '));
  ok(!(await pwned()),'le script du SVG ne s’exécute pas');
  ok(!(await p.evaluate(()=>window.__toobig||null)),'le PNG géant n’est pas chargé en entier en mémoire');
  ok(!errs.length,'aucun plantage '+errs.slice(0,2).join(' | '));

  attack('Réglages de l’app de bureau : ce que la page a le droit de faire');
  const tc=JSON.parse(fs.readFileSync(path.join(here,'..','src-tauri','tauri.conf.json'),'utf8')),csp=tc.app?.security?.csp||'';const cs=typeof csp==='string'?csp:Object.entries(csp).map(([k,v])=>k+' '+v).join(';');
  ok(!!cs&&!/script-src[^;]*'unsafe-eval'/.test(cs)&&!/script-src[^;]*\*/.test(cs.replace(/https:\/\/\*\.\w+/g,'')),'pas de scripts venus de n’importe où');
  ok(/object-src 'none'|default-src 'self'/.test(cs),'pas de plugins ni de contenu étranger par défaut');
  ok(!/frame-src[^;]*\*/.test(cs),'pas de page étrangère dans un cadre');
}finally{await browser.close();await mf.dispose();server.close()}
console.log('\n'+(fails?fails+' échec(s)':`${n} attaques, toutes repoussées`));process.exit(fails?1:0);
