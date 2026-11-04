// Prism : tests de vitesse sur de vraies tailles de photo (24 Mpx), avec la souris comme un utilisateur.
// Run: node tests/vitesse.mjs                       (Chromium)
//      PRISM_BROWSER=webkit node tests/vitesse.mjs  (WebKit, le moteur de l'app Mac)
// Chaque parcours a un temps maximum : au-delà, le test échoue. Les temps mesurés sont affichés.
// Parcours : ouvrir une photo dans l'éditeur, passer à la photothèque, ajouter deux photos,
// double-cliquer trois fois pour rouvrir des photos, revenir à l'éditeur.
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const root=path.join(path.dirname(new URL(import.meta.url).pathname),'..','web');
const require=createRequire(import.meta.url);
let pw;try{pw=require('playwright')}catch(e){pw=require(process.env.PLAYWRIGHT_MODULE||'/opt/node22/lib/node_modules/playwright')}
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg'};
const server=http.createServer((q,r)=>{const u=decodeURIComponent(new URL(q.url,'http://x').pathname),f=path.join(root,u==='/'?'index.html':u);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end();return}
  r.writeHead(200,{'content-type':TYPES[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const ENGINE=process.env.PRISM_BROWSER||'chromium';
const browser=ENGINE==='chromium'?await pw.chromium.launch({args:['--enable-unsafe-swiftshader','--use-gl=swiftshader']}):await pw[ENGINE].launch();
console.log('Navigateur : '+ENGINE+' '+browser.version());
/* temps maximums (ms), larges pour les machines de test partagées ; un retour au niveau d'avant la bêta 10 les dépasse */
const MAX={ouvrir:6000,phototheque:2000,ajouter2:12000,rouvrir:4000,retour:2000};
const page=await browser.newPage({viewport:{width:1440,height:900}});const errs=[];
page.on('pageerror',e=>errs.push(String(e)));
await page.route(/fonts\.(googleapis|gstatic)\.com|api\.github\.com/,r=>r.abort());
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);await page.waitForFunction(()=>typeof loadSample==='function'&&document.querySelector('#view'));
/* trois photos de 6000 × 4000 avec du détail (dégradé + bruit), fabriquées dans la page et gardées comme des fichiers :
   les passer par le protocole du navigateur coûterait à lui seul ~2 s et fausserait la mesure */
const photo=seed=>page.evaluate(async seed=>{const w=6000,h=4000,c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
  const gr=g.createLinearGradient(0,0,w,h);gr.addColorStop(0,`hsl(${seed*90},60%,35%)`);gr.addColorStop(1,`hsl(${seed*90+150},55%,70%)`);g.fillStyle=gr;g.fillRect(0,0,w,h);
  const t=document.createElement('canvas');t.width=512;t.height=512;const tg=t.getContext('2d'),id=tg.createImageData(512,512);let s=seed*9301+49297;for(let i=0;i<id.data.length;i+=4){s=(s*9301+49297)%233280;const v=s/233280*90;id.data[i]=id.data[i+1]=id.data[i+2]=v;id.data[i+3]=70}tg.putImageData(id,0,0);
  g.fillStyle=g.createPattern(t,'repeat');g.fillRect(0,0,w,h);const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.92));(window.__F=window.__F||[])[seed]=new File([b],`photo-${seed+1}.jpg`,{type:'image/jpeg'});return b.size},seed);
const sizes=[];for(let i=0;i<3;i++)sizes.push(await photo(i));
if(process.env.PRISM_TRACE){console.log('tailles',sizes.map(n=>(n/1e6).toFixed(1)+' Mo').join(', '));await page.evaluate(()=>{window.__T=[];const W=n=>{const f=eval(n);eval(n+'=async function(...a){const t=performance.now();try{return await f.apply(this,a)}finally{__T.push(n+" "+Math.round(performance.now()-t))}}')};['loadImageFile','buildManifest','encodeCanvas','projectThumb','openLocalProject'].forEach(W);const sd=setDoc;setDoc=function(...a){const t=performance.now();try{return sd.apply(this,a)}finally{__T.push('setDoc '+Math.round(performance.now()-t))}}})}
const idle=()=>page.waitForFunction(()=>{const b=document.getElementById('busy');return !b||b.hidden},null,{timeout:120000});
const res=[];let fails=0;
async function step(name,max,fn){const t=Date.now();let err='';try{await fn()}catch(e){err=String(e.message||e).split('\n')[0]}const ms=Date.now()-t;const ok=!err&&ms<=max;if(!ok)fails++;
  res.push(`${ok?'✓':'✗'} ${name} : ${ms} ms (max ${max})${err?' · '+err:''}`)}
await step('ouvrir une photo de 24 Mpx dans l’éditeur',MAX.ouvrir,async()=>{await page.evaluate(()=>{const i=document.getElementById('fileOpen'),dt=new DataTransfer();dt.items.add(__F[0]);i.files=dt.files;i.dispatchEvent(new Event('change',{bubbles:true}))});await page.waitForFunction(()=>S.doc&&S.doc.name==='photo-1.jpg',null,{timeout:60000});await idle()});
await page.evaluate(async()=>{await flushSave()});
await step('passer à la photothèque',MAX.phototheque,async()=>{await page.click('#atSwitch [data-v=lib]');await page.waitForSelector('#library .lb-card',{timeout:30000})});
await step('ajouter deux photos de 24 Mpx',MAX.ajouter2,async()=>{await page.evaluate(()=>{const _p=pickFiles;pickFiles=async()=>{pickFiles=_p;return [__F[1],__F[2]]}});await page.click('#lbAdd');
  await page.waitForFunction(()=>LIB.open&&document.querySelectorAll('#library .lb-card').length>=3,null,{timeout:120000});await idle()});
for(let i=0;i<3;i++){const id=await page.evaluate(i=>[...document.querySelectorAll('#library .lb-card')].map(c=>c.dataset.id).filter(x=>!S.doc||x!==S.doc.pid)[i%2],i);
  await step(`double-clic pour rouvrir une photo (${i+1}/3)`,MAX.rouvrir,async()=>{const b=await page.locator(`#library .lb-card[data-id="${id}"]`).boundingBox();await page.mouse.dblclick(b.x+b.width/2,b.y+b.height/3);
    await page.waitForFunction(id=>S.doc&&S.doc.pid===id&&!LIB.open,id,{timeout:30000});await idle()});
  await page.click('#atSwitch [data-v=lib]');await page.waitForSelector('#library .lb-card')}
await step('revenir à l’éditeur',MAX.retour,async()=>{await page.click('#atSwitch [data-v=ed]');await page.waitForFunction(()=>!LIB.open&&S.doc,null,{timeout:30000})});
if(errs.length){fails++;res.push('✗ erreurs dans la page : '+errs.slice(0,3).join(' | '))}
console.log(res.join('\n'));if(process.env.PRISM_TRACE)console.log((await page.evaluate(()=>__T)).join(' · '));console.log(fails?`${fails} échec(s)`:'tout est assez rapide');
await browser.close();server.close();process.exit(fails?1:0);
