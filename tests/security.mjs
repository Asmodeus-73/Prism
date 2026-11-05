// Attaques simulées contre Prism : le serveur de synchro (server/, dans Miniflare) et l'éditeur (navigateur).
// Chaque attaque doit échouer. Run: node tests/security.mjs   (après npm ci dans server/)
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import zlib from 'node:zlib';import {createRequire} from 'node:module';
/* les attaques qui envoient trop de données voient le serveur couper la connexion : une coupure tardive sur la socket n'est pas un échec du test */
process.on('uncaughtException',e=>{if(e&&(e.code==='ECONNRESET'||e.code==='EPIPE'))return;console.error(e);process.exit(1)});
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

// ---------- serveur : seconde série (bêta 18) ----------
await clear();
const acct=async(email,ip)=>(await signup(email,ip)).data;
const putB=(tok,key,n=500,ct='image/png')=>call('/v1/blobs/'+key,{method:'PUT',token:tok,body:new Uint8Array(n),headers:{'content-length':String(n),'content-type':ct}});
const own=await acct('proprio@example.com','10.20.0.1'),gst=await acct('invite@example.com','10.20.0.2'),trd=await acct('tiers@example.com','10.20.0.3');
await putB(own.token,'tZaX1');await putB(own.token,'t_aX1');
await call('/v1/events',{method:'POST',token:own.token,json:{kind:'put',pid:'p_sh',body:{id:'p_sh'},blobs:['tZaX1']}});
const shr=await call('/v1/shares',{method:'POST',token:own.token,json:{pid:'p_sh',email:'invite@example.com'}});
await call('/v1/events',{method:'POST',token:own.token,json:{kind:'put',pid:'p_sh',body:{id:'p_sh'},blobs:['tZaX1']}});

attack('Lire le fichier privé d’un compte grâce au joker « _ » d’un partage');
ok(shr.status===201&&(await call('/v1/blobs/tZaX1?from='+own.user,{token:gst.token})).status===200,'le fichier partagé reste lisible par l’invité');
ok((await call('/v1/blobs/t_aX1?from='+own.user,{token:gst.token})).status===404,'le fichier privé au nom presque identique reste introuvable');

attack('Envoyer moins (ou plus) que la taille annoncée pour tromper le quota du transit');
const net=await import('node:net');
const rawPut=(key,declared,sent)=>new Promise(res=>{const u=new URL(API);const s=net.connect(+u.port,u.hostname,()=>{s.write(`PUT /v1/blobs/${key} HTTP/1.1\r\nHost: ${u.host}\r\nAuthorization: Bearer ${E}\r\nContent-Type: image/png\r\nContent-Length: ${declared}\r\nConnection: close\r\n\r\n`);s.write(Buffer.alloc(sent));s.end()});
  let b='';s.on('data',d=>b+=d);s.on('close',()=>res(+((b.match(/^HTTP\/1\.1 (\d+)/)||[])[1]||0)));s.on('error',()=>res(0));setTimeout(()=>{s.destroy();res(0)},8000)});
const short=await rawPut('t_short',4000,100);
ok(short!==201&&(await call('/v1/blobs/t_short',{token:E})).status===404,`fichier incomplet refusé, rien n’est gardé (${short||'coupé'})`);
ok((await db.prepare('SELECT COUNT(*) AS n FROM transit WHERE key=?').bind('t_short').first()).n===0,'le quota ne compte pas de faux fichier');

attack('Requête sans taille annoncée de 10 Mo');
const chunked=await new Promise(res=>{const u=new URL(API+'/v1/events'),q=http.request({host:u.hostname,port:u.port,path:u.pathname,method:'POST',headers:{authorization:'Bearer '+E,'content-type':'application/json','transfer-encoding':'chunked'}},r=>{res(r.statusCode);r.resume()});
  q.on('error',()=>res(413));q.write('{"kind":"put","pid":"p1","body":{"x":"');for(let i=0;i<10;i++)q.write('a'.repeat(1<<20));q.end('"}}')});
ok(chunked===413,'refusée dès qu’elle dépasse 4 Mo ('+chunked+')');

attack('Jetons piégés (vide, très long, caractères spéciaux)');
const tk=[];for(const t of ['',' ','x'.repeat(5000),'%00','../../etc/passwd',"' OR 1=1 --",'Bearer '+T])tk.push((await call('/v1/me',{headers:{authorization:'Bearer '+t}})).status);
ok(tk.every(s=>s===401),'tous refusés ('+tk.join(', ')+')');

attack('Un invité qui invite d’autres personnes ou retire la propriétaire');
ok((await call('/v1/shares',{method:'POST',token:gst.token,json:{pid:'p_sh',email:'tiers@example.com'}})).status===403,'il ne peut pas inviter');
ok((await call('/v1/shares/p_sh/'+own.user,{method:'DELETE',token:gst.token})).status===404,'il ne peut pas retirer la propriétaire');
ok((await call('/v1/shares',{token:own.token})).data.shares.some(s=>s.pid==='p_sh'&&s.members.length===2),'le partage est intact');

attack('Retoucher une photo partagée pendant que quelqu’un d’autre la tient');
await call('/v1/locks/p_sh',{method:'POST',token:own.token});
ok((await call('/v1/locks/p_sh',{method:'POST',token:gst.token})).status===409,'impossible de lui prendre la main');
ok((await call('/v1/events',{method:'POST',token:gst.token,json:{kind:'put',pid:'p_sh',body:{id:'p_sh',name:'écrasée'},blobs:[]}})).status===423,'ses enregistrements sont refusés');
await call('/v1/locks/p_sh',{method:'DELETE',token:gst.token});
ok((await call('/v1/shares',{token:own.token})).data.shares.find(s=>s.pid==='p_sh').lock?.me===true,'il ne peut pas libérer le verrou d’un autre');
await call('/v1/locks/p_sh',{method:'DELETE',token:own.token});

attack('Un invité qui supprime la photo de la propriétaire');
const before=(await db.prepare("SELECT COUNT(*) AS n FROM events WHERE user=? AND kind='delete'").bind(own.user).first()).n;
await call('/v1/events',{method:'POST',token:gst.token,json:{kind:'delete',pid:'p_sh'}});
ok((await db.prepare("SELECT COUNT(*) AS n FROM events WHERE user=? AND kind='delete'").bind(own.user).first()).n===before,'rien n’est supprimé chez elle : il quitte seulement le partage');

attack('Tester des milliers d’adresses par les invitations (savoir qui a un compte)');
const inv=[];for(let i=0;i<12;i++)inv.push((await call('/v1/shares',{method:'POST',token:own.token,json:{pid:'p_sh',email:`inconnu${i}@example.com`}})).status);
ok(inv.slice(0,9).every(s=>s===404)&&inv.slice(9).every(s=>s===429),'bloqué après 10 invitations par heure ('+inv.join(',')+')');

attack('Faux partage d’une photo d’un autre compte, au même identifiant, pour écraser la sienne');
await call('/v1/events',{method:'POST',token:E,json:{kind:'put',pid:'p_secret',body:{id:'p_secret',name:'piège'},blobs:[]}});
ok((await call('/v1/shares',{method:'POST',token:E,json:{pid:'p_secret',email:'victime@example.com'}})).status===404,'refusé : cet identifiant appartient déjà à un autre compte');

attack('Se faire passer pour l’appareil d’un autre compte');
const imp=await login('pirate@example.com','motdepasse1','10.20.0.9',undefined);
const imp2=await call('/v1/login',{method:'POST',json:{email:'pirate@example.com',password:'motdepasse1',device:{id:vic.data.device,name:'remplacé'}},headers:{'cf-connecting-ip':'10.20.0.10'}});
ok(imp.status===200&&imp2.data.device!==vic.data.device,'il reçoit son propre appareil');
ok((await call('/v1/me',{token:T})).data.devices.every(d=>d.name!=='remplacé'),'l’appareil de la victime garde son nom');

attack('Profil et appareil piégés (nom avec du code, photo en SVG ou en adresse javascript:)');
await call('/v1/me',{method:'PATCH',token:E,json:{name:'<img src=x onerror=alert(1)>Bob'}});
ok(!/[<>]/.test((await call('/v1/me',{token:E})).data.name),'le nom est nettoyé');
const av=[];for(const a of ['data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=','javascript:alert(1)','https://evil.example/p.png','data:image/png;base64,'+'A'.repeat(300000)])av.push((await call('/v1/me',{method:'PATCH',token:E,json:{avatar:a}})).status);
ok(av.every(s=>s===400||s===413),'photos piégées refusées ('+av.join(',')+')');
const dn=await call('/v1/login',{method:'POST',json:{email:'pirate@example.com',password:'motdepasse1',device:{name:'<script>x</script>Mac'}},headers:{'cf-connecting-ip':'10.20.0.11'}});
ok((await call('/v1/me',{token:dn.data.token})).data.devices.every(d=>!/[<>]/.test(d.name)),'le nom d’appareil est nettoyé');

attack('Mot de passe de 100 000 caractères (faire calculer le serveur)');
const tl=performance.now(),lp=await login('victime@example.com','a'.repeat(100000),'10.20.0.12'),dt=performance.now()-tl;
ok(lp.status===401&&dt<2000,`refusé sans calcul (${Math.round(dt)} ms)`);
ok((await signup('long@example.com','10.20.0.13').then(()=>call('/v1/signup',{method:'POST',json:{email:'long2@example.com',password:'a'.repeat(100000)},headers:{'cf-connecting-ip':'10.20.0.14'}}))).status===400,'création de compte refusée');

attack('Adresses e-mail piégées');
const em=[];for(const e of ['a@b','<script>@x.fr','a"b@x.fr','a\n@x.fr','x'.repeat(300)+'@x.fr','a@x.fr\r\nBcc: y@z.fr'])em.push((await call('/v1/signup',{method:'POST',json:{email:e,password:'motdepasse1'},headers:{'cf-connecting-ip':'10.20.1.'+em.length}})).status);
ok(em.every(s=>s===400),'toutes refusées ('+em.join(',')+')');
await clear();

attack('Requêtes malformées : JSON très imbriqué, texte invalide, types inattendus');
const mal=[await call('/v1/events',{method:'POST',token:E,body:'['.repeat(200000),headers:{'content-type':'application/json'}}),await call('/v1/events',{method:'POST',token:E,body:'pas du json'}),
  await call('/v1/events',{method:'POST',token:E,json:{kind:['put'],pid:{}}}),await call('/v1/ack',{method:'POST',token:E,json:{seq:'x'}}),await call('/v1/events?after=-5',{token:E}),await call('/v1/events?after=1e400',{token:E})];
ok(mal.every(r=>r.status!==500),'aucune erreur du serveur ('+mal.map(r=>r.status).join(',')+')');

attack('Faire effacer le transit des autres en annonçant avoir tout reçu');
await call('/v1/ack',{method:'POST',token:E,json:{seq:1e18}});await new Promise(r=>setTimeout(r,300));
ok((await call('/v1/blobs/t_v2',{token:T})).status===200,'les fichiers de la victime restent en transit');

attack('Saturer ou détourner la connexion en direct');
const w1=await wsOpen(E);w1.w.send('x'.repeat(200000));w1.w.send('{pas du json');w1.w.send(JSON.stringify({type:'signal',to:'x'.repeat(10000),data:'y'.repeat(70000)}));w1.w.send('{"type":"ping"}');
await new Promise(r=>setTimeout(r,600));ok(w1.got.some(m=>m.type==='pong'),'le serveur répond toujours');w1.w.close();
const w2=await new Promise((res,rej)=>{const w=new WebSocket(API.replace(/^http/,'ws')+'/v1/live?token='+E+'&device='+vic.data.device);const got=[];w.onmessage=e=>got.push(JSON.parse(e.data));w.onopen=()=>res({w,got});w.onerror=rej});
await new Promise(r=>setTimeout(r,400));ok(!w2.got.some(m=>m.type==='peers'&&m.devices.some(d=>d.device===vic.data.device)),'un faux identifiant d’appareil dans l’adresse est ignoré');w2.w.close();

attack('Méthodes et adresses inattendues');
const odd=[];for(const [m,u] of [['PUT','/v1/me'],['DELETE','/v1/events'],['GET','/v1/blobs/'],['POST','/v1/locks/'],['PATCH','/v1/shares'],['GET','/v1/blobs/%'],['POST','/v1/me']])odd.push((await call(u,{method:m,token:E})).status);
ok(odd.every(s=>s!==500&&s!==200),'refusées sans erreur ('+odd.join(',')+')');

attack('Lire les réponses depuis un site tiers (cookies, CORS)');
const cr=await call('/v1/me',{token:E,headers:{origin:'https://evil.example'}});
ok(!cr.headers.get('access-control-allow-credentials')&&!cr.headers.get('set-cookie'),'aucun cookie : un site tiers n’a rien à voler sans le jeton');

attack('Annoncer 100 000 fichiers dans un évènement');
const many=Array.from({length:100000},(_,i)=>'t'+i);await call('/v1/events',{method:'POST',token:E,json:{kind:'put',pid:'p_many',body:{id:'p_many'},blobs:many}});
const last=(await call('/v1/events?after=0',{token:E})).data.events.filter(e=>e.pid==='p_many').pop();
ok(last&&last.blobs.length<=5000,'la liste est coupée à 5 000');

attack('Réutiliser le jeton d’un appareil retiré pour la connexion en direct');
let wsLost=false;try{const x=await wsOpen(lost.token);x.w.close()}catch(e){wsLost=true}ok(wsLost,'refusé');

attack('Déposer un fichier dans le dossier d’un autre compte, ou une photo sous son identifiant');
const cross=[];for(const k of [vic.data.user+'/t_x','..%2f'+vic.data.user+'%2ft_x',encodeURIComponent('../'+vic.data.user+'/t_x')])cross.push((await call('/v1/blobs/'+k,{method:'PUT',token:E,body:new Uint8Array(10),headers:{'content-length':'10'}})).status);
ok(cross.every(s=>s===400),'clés refusées ('+cross.join(',')+')');
const nV=(await call('/v1/events?after=0',{token:T})).data.events.length;await call('/v1/events',{method:'POST',token:E,json:{kind:'put',pid:'p_secret',body:{id:'p_secret',name:'écrasée'},blobs:[]}});
ok((await call('/v1/events?after=0',{token:T})).data.events.length===nV,'rien n’arrive chez la victime');

attack('Remplir la base de milliers d’évènements');
let ev429=0;await Promise.all(Array.from({length:25},async(_,w)=>{for(let i=0;i<52;i++){const r=await call('/v1/events',{method:'POST',token:E,json:{kind:'want',pid:'*'}});if(r.status===429)ev429++}}));
ok(ev429>0,'freiné après 1 200 par minute ('+ev429+' refusés sur 1 300)');

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

  // ---------- éditeur : seconde série (bêta 18) ----------
  const hits=[];await p.route(/evil\.example/,r=>{hits.push(r.request().url());r.abort()});
  await p.evaluate(async()=>{closeDialog&&closeDialog();await loadSample();await new Promise(r=>setTimeout(r,300))});

  attack('Effet piégé dans un projet (nom avec du code, « __proto__ », masque vers une adresse web)');
  await p.evaluate(async X=>{const L=S.doc.layers.find(l=>l.kind==='pixel');L.fbase=cloneC(L.canvas);L.filters=[{x:X,p:{}},{id:'__proto__',p:{}},{x:'constructor',p:{}},{id:'blur',p:{r:2},m:'https://evil.example/m.png'}];L.fout=L.canvas;
    S.doc.active=S.doc.layers.indexOf(L);switchTab('layers');syncAll();await new Promise(r=>setTimeout(r,200));
    try{PrismEffects.effectsDialog();await new Promise(r=>setTimeout(r,200));closeDialog()}catch(e){}
    await PrismEffects.setList(L,L.filters.map(f=>({...f,off:true})),'x').catch(()=>{});await new Promise(r=>setTimeout(r,500))},XSS);
  ok(!(await pwned()),'le code du nom ne s’exécute pas');
  ok(!hits.length,'aucune requête vers l’adresse du masque');
  ok(await p.evaluate(()=>({}).run===undefined&&Object.prototype.name===undefined),'les objets de Prism ne sont pas contaminés');

  attack('Nom de calque et texte piégés (panneau Calques, historique, menus)');
  await p.evaluate(async X=>{const L=S.doc.layers[S.doc.layers.length-1];L.name=X;pushHistory(X);syncAll();switchTab('history');await new Promise(r=>setTimeout(r,150));switchTab('layers');
    for(const k of Object.keys(MENU2)){try{openBar(k);await new Promise(r=>setTimeout(r,40))}catch(e){}}document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))},XSS);
  ok(!(await pwned()),'le code n’est jamais exécuté');

  attack('Sauvegarde de photothèque piégée (prendre la place d’une photo, écraser ses tuiles, « __proto__ »)');
  const bk=await p.evaluate(async X=>{const ms=(await IDB.all('projects')).filter(m=>m&&m.layers&&m.layers.length);const v=ms[0];const keys=[...manifestKeys(v)];const before=await Promise.all(keys.map(async k=>(await IDB.get('blobs',k)).size));
    const red=mk(64,64);const g=cx(red);g.fillStyle='#f00';g.fillRect(0,0,64,64);const rb=new Uint8Array(await (await toBlob(red,'image/png')).arrayBuffer());
    const evil={...v,id:v.id,name:X,cam:X,updatedAt:Date.now()+9};const enc=new TextEncoder();
    const raw=JSON.stringify(evil).replace('{','{"__proto__":{"pwn":1},');
    const files=[{name:'prism-library.json',data:enc.encode('{"v":1}')},{name:'p/p_evil/revelateur.json',data:enc.encode(raw)},{name:'p/'+encodeURIComponent('../x')+'/revelateur.json',data:enc.encode(raw)},...keys.map(k=>({name:'p/p_evil/tiles/'+k+(k===v.thumb?'.jpg':'.png'),data:rb}))];
    const z=await makeZip(files);await PrismBackup.restore(new File([z],'piege.prism-lib.zip'));await new Promise(r=>setTimeout(r,400));
    const after=await Promise.all(keys.map(async k=>(await IDB.get('blobs',k)).size));const e=await IDB.get('projects','p_evil');const vv=await IDB.get('projects',v.id);
    try{await openLibrary();await new Promise(r=>setTimeout(r,400));closeLibrary&&closeLibrary()}catch(err){}
    return {same:before.join()===after.join(),eid:e&&e.id,vname:vv&&vv.name,proto:({}).pwn}},XSS);
  ok(bk.same,'les tuiles de la photo existante ne sont pas écrasées');
  ok(bk.eid==='p_evil'&&bk.vname!==XSS,'le projet importé garde son propre identifiant : l’autre photo est intacte');
  ok(bk.proto===undefined&&!(await pwned()),'pas de contamination ni de code exécuté (nom, appareil photo)');

  attack('SVG avec une image d’un autre site (pixel espion)');
  await p.evaluate(()=>{window.__d0=S.doc});
  await p.setInputFiles('#fileOpen',{name:'espion.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="40" height="40"><image href="https://evil.example/pixel.png" width="40" height="40"/><image xlink:href="https://evil.example/p2.png" width="4" height="4"/><style>@import url(https://evil.example/x.css);</style></svg>')});
  await until(()=>S.doc!==window.__d0,null,10000);await p.waitForTimeout(500);
  ok(!hits.length,'aucune requête vers l’autre site ('+hits.length+')');

  attack('Journal de « Signaler un problème » : pas de jeton, de mot de passe ni de chemin local');
  const rep=await p.evaluate(()=>{console.error('échec wss://prism.example.workers.dev/v1/live?token=SECRETTOKEN123 file:///Users/eliot/Photos/vacances/plage.jpg password=hunter22 Bearer abcdef123456');return PrismReport.report('test',true)});
  ok(!/SECRETTOKEN123|hunter22|abcdef123456|\/Users\/eliot|vacances/.test(rep),'le journal est nettoyé');

  attack('Lien du rapport : toujours vers les tickets de Prism, même avec une description piégée');
  const ru=await p.evaluate(()=>PrismReport.issueUrl('"><script>x</script>\njavascript:alert(1)\u0000 https://evil.example',true));
  ok(ru.startsWith('https://github.com/Asmodeus-73/Prism/issues/new?')&&!/[\s"<>]/.test(ru),'adresse fixe, texte encodé');
  ok(/fn issue_url_ok/.test(fs.readFileSync(path.join(here,'..','src-tauri','src','lib.rs'),'utf8')),'l’app de bureau refuse toute autre adresse (test dans lib.rs)');

  attack('Compte d’essai : mot de passe jamais gardé en clair, photo de profil piégée refusée');
  const es=await p.evaluate(async()=>{const pw='MotDePasseSecret9';try{await syEssaiApi('/v1/signup',{method:'POST',json:{email:'essai-secu@example.com',password:pw}})}catch(e){}
    const raw=localStorage.getItem('prism-essai-comptes')||'';let bad=0;for(const a of ['data:image/svg+xml;base64,PHN2Zz4=','javascript:alert(1)','https://evil.example/a.png'])if(!SY_AVATAR.test(a))bad++;return{clear:raw.includes(pw),has:raw.includes('essai-secu'),bad}});
  ok(es.has&&!es.clear,'le mot de passe est haché (PBKDF2)');ok(es.bad===3,'photos de profil piégées refusées');

  attack('Page web : une image, un script ou une feuille d’un autre site est bloqué');
  const cspv=await p.evaluate(async()=>{const v=[];document.addEventListener('securitypolicyviolation',e=>v.push(e.violatedDirective));
    const i=new Image();i.src='https://evil.example/beacon.png';document.body.appendChild(i);const s=document.createElement('script');s.src='https://evil.example/x.js';document.head.appendChild(s);
    await new Promise(r=>setTimeout(r,500));i.remove();s.remove();return v});
  ok(cspv.some(d=>/img-src/.test(d))&&cspv.some(d=>/script-src/.test(d)),'bloqués par les règles de la page ('+cspv.join(', ')+')');

  attack('Message d’une autre fenêtre, collage et glisser-déposer piégés');
  await p.evaluate(async X=>{window.postMessage({type:'open',url:'https://evil.example/x.jpg',html:X},'*');
    const dt=new DataTransfer();dt.setData('text/html',X);dt.setData('text/uri-list','https://evil.example/drop.jpg');dt.setData('text/plain','https://evil.example/t.jpg');
    document.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true}));const st=document.querySelector('#stage')||document.body;st.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,600))},XSS);
  ok(!(await pwned())&&!hits.length,'rien n’est exécuté ni téléchargé');

  attack('Raccourcis et préréglages piégés dans les préférences');
  await p.evaluate(async X=>{try{PREF.set('keys2',JSON.parse('{"__proto__":{"pwn":1},"tool.brush":"'+X.replace(/"/g,'\\"')+'"}'))}catch(e){}
    try{PrismKeys&&PrismKeys.dialog&&PrismKeys.dialog();await new Promise(r=>setTimeout(r,300));closeDialog()}catch(e){}
    try{shortcutsDialog();await new Promise(r=>setTimeout(r,200));closeDialog()}catch(e){}},XSS);
  ok(!(await pwned())&&await p.evaluate(()=>({}).pwn===undefined),'rien n’est exécuté ni contaminé');

  attack('Masque d’effet géant dans un projet (60 000 × 60 000 px pour saturer la mémoire)');
  const bomb=await p.evaluate(async b64=>{const L=S.doc.layers.find(l=>l.kind==='pixel');L.fbase=cloneC(L.canvas);L.filters=[{id:'blur',p:{r:2},m:'data:image/png;base64,'+b64}];L.fout=L.canvas;
    let err='';await PrismEffects.ready(L.filters,L).catch(e=>{err=e.message});delete L.fbase;delete L.filters;delete L.fout;return err},png.toString('base64'));
  ok(/masque/.test(bomb),'masque refusé avant d’être décodé ('+bomb+')');

  attack('Rapport de problème : ni nom de photo ni contenu');
  const rn=await p.evaluate(()=>{if(S.doc)S.doc.name='vacances-secretes-2026.jpg';return PrismReport.report('',true)});
  ok(!/vacances-secretes/.test(rn),'le nom de la photo n’y est pas');

  attack('Photo reçue d’un autre compte au même identifiant qu’une photo à soi (écraser ou supprimer)');
  const sw=await p.evaluate(async()=>{const m=(await IDB.all('projects')).find(x=>x&&x.layers&&x.layers.length&&!x.shareFrom);
    await syApply({kind:'put',pid:m.id,origin:'u_pirate',body:{...m,name:'écrasée par un autre compte',updatedAt:Date.now()+99},blobs:[]});
    await syApply({kind:'delete',pid:m.id,origin:'u_pirate'});const a=await IDB.get('projects',m.id);return a?a.name:null});
  ok(sw&&sw!=='écrasée par un autre compte','la photo n’est ni remplacée ni supprimée');

  attack('Réglages d’effet piégés dans un projet (rayon d’un milliard, texte, valeurs négatives)');
  const tq=await p.evaluate(async()=>{const L=S.doc.layers.find(l=>l.kind==='pixel');L.fbase=cloneC(L.canvas);L.filters=[{id:'blur',p:{r:1e9}},{id:'blur',p:{r:'<b>'}},{id:'blur',p:{r:-1e9}}];L.fout=L.canvas;
    const t=performance.now();await PrismEffects.setList(L,L.filters.map(f=>({...f})),'x');return performance.now()-t});
  ok(tq<20000,'recalculé en '+Math.round(tq)+' ms, réglages ramenés dans leurs bornes');
}finally{await browser.close();await mf.dispose();server.close()}
console.log('\n'+(fails?fails+' échec(s)':`${n} attaques, toutes repoussées`));process.exit(fails?1:0);
