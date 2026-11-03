// Travail à plusieurs de bout en bout : deux comptes (Draconix et Marie), une photo partagée, chacun son tour.
// Run: node tests/collab.mjs   (après npm ci dans server/)
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
  await p.route(/fonts\.(googleapis|gstatic)\.com|api\.github\.com/,r=>r.abort());await p.goto(PAGE);await p.waitForFunction(()=>window.PrismSync&&typeof loadSample==='function');return {p,c,errs}};
let fails=0;const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m);if(!c)fails++};
const until=async(p,fn,arg,ms=20000)=>{try{await p.waitForFunction(fn,arg,{timeout:ms,polling:200});return true}catch(e){return false}};
const A=await dev(),B=await dev();
const toastHas=(p,re)=>p.evaluate(r=>{const t=document.querySelector('#toast');return !!t&&!t.hidden&&new RegExp(r).test(t.textContent)},re);
try{
  await A.p.evaluate(([u])=>PrismSync.connect('signup',u,'draco@example.com','motdepasse1'),[API]);
  await B.p.evaluate(([u])=>PrismSync.connect('signup',u,'marie@example.com','motdepasse2'),[API]);
  ok(await A.p.evaluate(()=>!!PrismSync.state.cfg)&&await B.p.evaluate(()=>!!PrismSync.state.cfg),'deux comptes séparés');
  const pid=await A.p.evaluate(async()=>{await loadSample();await new Promise(r=>setTimeout(r,400));S.doc.nosave=false;S.doc.saved=false;while(SAVE.running)await new Promise(r=>setTimeout(r,50));await saveNow();return S.doc.pid});
  // Draconix partage depuis Fichier > Partager avec quelqu'un…
  ok(await A.p.evaluate(()=>MENU2.file.items().some(x=>x&&x.label==='Partager avec quelqu’un…')),'menu Fichier : Partager avec quelqu’un…');
  await A.p.evaluate(()=>PrismShare.dialog());await A.p.waitForSelector('#shEmail');await A.p.fill('#shEmail','marie@example.com');await A.p.click('#shInv');
  ok(await until(A.p,()=>PrismShare.isShared(S.doc.pid)),'la photo est partagée');
  ok(await until(A.p,()=>PrismShare.state.held===S.doc.pid),'Draconix l’a ouverte : il la tient');
  ok(await until(B.p,id=>!!LIB.items.find(i=>i.id===id),pid,30000),'elle arrive dans la Photothèque de Marie');
  ok(await B.p.evaluate(async id=>{const m=await IDB.get('projects',id);for(const k of manifestKeys(m))if(!(await IDB.get('blobs',k)))return false;return true},pid),'avec tous ses fichiers');
  // Marie l'ouvre pendant que Draconix la retouche
  await B.p.evaluate(async id=>{await PrismShare.refresh();await libOpen(id)},pid);
  ok(await until(B.p,id=>S.doc&&S.doc.pid===id&&S.doc.readonly&&/draco/.test(S.doc.shareRO||''),pid),'chez Marie : lecture seule, « draco retouche »');
  ok(await B.p.evaluate(()=>/retouche/.test(document.querySelector('#docname').textContent)),'le nom du document le dit');
  // Draconix ferme : Marie est prévenue et la reprend
  await A.p.evaluate(()=>closeDoc());
  ok(await until(B.p,()=>{const t=document.querySelector('#toast');return t&&!t.hidden&&/est libre :/.test(t.textContent)},null,20000),'Marie est prévenue qu’elle est libre');
  await B.p.evaluate(()=>document.querySelector('#toast button').click());
  ok(await until(B.p,id=>S.doc&&S.doc.pid===id&&!S.doc.readonly&&PrismShare.state.held===id,pid,20000),'elle la reprend et peut la retoucher');
  // Marie retouche et enregistre : Draconix reçoit
  const n=await B.p.evaluate(async()=>{addLayer();S.doc.saved=false;while(SAVE.running)await new Promise(r=>setTimeout(r,50));await saveNow();return S.doc.layers.length});
  ok(await until(A.p,([id,n])=>IDB.get('projects',id).then(m=>m&&m.layers.length===n),[pid,n],30000),'sa retouche arrive chez Draconix');
  // Draconix ne peut pas l'enregistrer pendant que Marie la tient
  await A.p.evaluate(id=>libOpen(id),pid);
  ok(await until(A.p,id=>S.doc&&S.doc.pid===id&&S.doc.readonly,pid),'chez Draconix, à son tour : lecture seule');
  // Marie quitte le partage
  await B.p.evaluate(()=>PrismShare.dialog());await B.p.waitForSelector('#scrim .foot .btn');
  await B.p.evaluate(()=>[...document.querySelectorAll('#scrim .foot .btn')].find(b=>b.textContent==='Quitter le partage').click());
  ok(await until(B.p,id=>!PrismShare.isShared(id),pid),'Marie quitte le partage');
  ok(await until(A.p,async id=>{await PrismShare.refresh();const s=PrismShare.state.by.get(id);return !s||s.members.length===1},pid),'Draconix le voit');
  ok(!A.errs.length&&!B.errs.length,'aucune erreur dans les pages '+[...A.errs,...B.errs].slice(0,3).join(' | '));
}finally{await browser.close();await mf.dispose();server.close()}
console.log(fails?fails+' échec(s)':'tout est bon');process.exit(fails?1:0);
