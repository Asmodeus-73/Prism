// Synchronisation de bout en bout : le serveur (server/, dans Miniflare) et deux « appareils » (deux navigateurs séparés).
// Run: node tests/sync.mjs   (après npm ci dans server/)
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const here=path.dirname(new URL(import.meta.url).pathname),root=path.join(here,'..','web'),srv=path.join(here,'..','server');
const require=createRequire(import.meta.url);const sreq=createRequire(path.join(srv,'package.json'));
let pw;try{pw=require('playwright')}catch(e){pw=require(process.env.PLAYWRIGHT_MODULE||'/opt/node22/lib/node_modules/playwright')}
const {Miniflare}=sreq('miniflare');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.wasm':'application/wasm','.json':'application/json','.png':'image/png','.jpg':'image/jpeg'};
const server=http.createServer((q,r)=>{const u=decodeURIComponent(new URL(q.url,'http://x').pathname),f=path.join(root,u==='/'?'index.html':u);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end();return}r.writeHead(200,{'content-type':TYPES[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const PAGE=`http://127.0.0.1:${server.address().port}/index.html`;
const mf=new Miniflare({modules:true,scriptPath:path.join(srv,'src/index.js'),compatibilityDate:'2026-07-30',host:'127.0.0.1',port:0,
  d1Databases:['DB'],r2Buckets:['TRANSIT'],durableObjects:{LIVE:{className:'Live',useSQLite:true}},bindings:{TRANSIT_LIMIT:'9500000000',TRANSIT_HOURS:'24',EVENTS_DAYS:'30'}});
const API=(await mf.ready).toString().replace(/\/$/,'');const db=await mf.getD1Database('DB');
for(const s of fs.readFileSync(path.join(srv,'schema.sql'),'utf8').replace(/--.*\n/g,'').split(';').map(x=>x.trim().replace(/\s+/g,' ')).filter(Boolean))await db.exec(s);
const ENGINE=process.env.PRISM_BROWSER||'chromium';
const browser=ENGINE==='chromium'?await pw.chromium.launch({args:['--enable-unsafe-swiftshader','--use-gl=swiftshader']}):await pw[ENGINE].launch();
const dev=async()=>{const c=await browser.newContext({viewport:{width:1280,height:800}}),p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e)));
  await p.route(/fonts\.(googleapis|gstatic)\.com|api\.github\.com/,r=>r.abort());await p.goto(PAGE);await p.waitForFunction(()=>window.PrismSync&&typeof loadSample==='function');return {p,errs}};
let fails=0;const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m);if(!c)fails++};
const until=async(p,fn,arg,ms=20000)=>{try{await p.waitForFunction(fn,arg,{timeout:ms,polling:200});return true}catch(e){return false}};
const A=await dev(),B=await dev();
try{
  await A.p.evaluate(([u])=>PrismSync.connect('signup',u,'draco@example.com','motdepasse1'),[API]);
  ok(await A.p.evaluate(()=>!!PrismSync.state.cfg),'le Mac crée son compte');
  await B.p.evaluate(([u])=>PrismSync.connect('login',u,'draco@example.com','motdepasse1'),[API]);
  ok(await B.p.evaluate(()=>!!PrismSync.state.cfg),'la tour se connecte au même compte');
  // le Mac ouvre et retouche une photo
  const pid=await A.p.evaluate(async()=>{await loadSample();await new Promise(r=>setTimeout(r,400));S.doc.nosave=false;S.doc.saved=false;while(SAVE.running)await new Promise(r=>setTimeout(r,50));await saveNow();return S.doc.pid});
  ok(!!pid,'le Mac enregistre la photo');
  ok(await until(B.p,id=>!!LIB.items.find(i=>i.id===id),pid),'la photo arrive dans la Photothèque de la tour');
  ok(await B.p.evaluate(async id=>{const m=await IDB.get('projects',id);for(const k of manifestKeys(m))if(!(await IDB.get('blobs',k)))return false;return true},pid),'tous ses fichiers sont là');
  await B.p.evaluate(id=>libOpen(id),pid);ok(await until(B.p,id=>S.doc&&S.doc.pid===id&&S.doc.layers.length>0,pid),'la tour l’ouvre');
  ok(await until(A.p,()=>true,null,1000)&&(await (async()=>{for(let i=0;i<40;i++){const u=await (await fetch(API+'/v1/usage',{headers:{authorization:'Bearer '+(await A.p.evaluate(()=>PrismSync._SY.cfg.token))}})).json();if(u.used===0)return true;await new Promise(r=>setTimeout(r,250))}return false})()),'le transit Cloudflare est vidé une fois reçu');
  // suppression sur le Mac
  await B.p.evaluate(()=>{closeDoc()});
  await A.p.evaluate(async id=>{await libLoad();const pd=libDelete([id]);let bs=[];for(let i=0;i<50&&!bs.length;i++){await new Promise(r=>setTimeout(r,100));bs=document.querySelectorAll('#scrim .foot .btn')}bs[bs.length-1].click();await pd},pid);
  ok(await until(B.p,async id=>!(await IDB.get('projects',id)),pid),'la suppression arrive sur la tour');
  ok(await A.p.evaluate(async id=>(await PrismTrash.list()).some(e=>e.id===id),pid),'la photo est dans la Corbeille du Mac seulement');
  ok(await B.p.evaluate(async id=>!(await PrismTrash.list()).some(e=>e.id===id),pid),'pas dans celle de la tour');
  // restaurer sur le Mac la renvoie
  await A.p.evaluate(id=>PrismTrash.restore(id),pid);
  ok(await until(B.p,async id=>!!(await IDB.get('projects',id)),pid),'restaurée sur le Mac, elle revient sur la tour');
  // « Synchroniser maintenant » : la tour vide sa copie, le Mac la renvoie
  await B.p.evaluate(async id=>{await IDB.del('projects',id);await libLoad()},pid);
  await B.p.evaluate(()=>PrismSync.now());
  ok(await until(B.p,async id=>!!(await IDB.get('projects',id)),pid),'« Synchroniser maintenant » récupère la photo');
  ok(!A.errs.length&&!B.errs.length,'aucune erreur dans les pages '+[...A.errs,...B.errs].slice(0,3).join(' | '));
}finally{await browser.close();await mf.dispose();server.close()}
console.log(fails?fails+' échec(s)':'tout est bon');process.exit(fails?1:0);
