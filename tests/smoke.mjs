// Prism smoke tests: open the built page (web/index.html) in Chromium and exercise the editor.
// Run: node tests/smoke.mjs        (needs the "playwright" package and its Chromium)
// Every test fails on any uncaught error or console error in the page.
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const root=path.join(path.dirname(new URL(import.meta.url).pathname),'..','web');
const require=createRequire(import.meta.url);
let pw;try{pw=require('playwright')}catch(e){pw=require(process.env.PLAYWRIGHT_MODULE||'/opt/node22/lib/node_modules/playwright')}

const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=http.createServer((q,r)=>{const u=decodeURIComponent(new URL(q.url,'http://x').pathname),f=path.join(root,u==='/'?'index.html':u);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end();return}
  r.writeHead(200,{'content-type':TYPES[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const URL0=`http://127.0.0.1:${server.address().port}/index.html`;

const browser=await pw.chromium.launch({args:['--enable-unsafe-swiftshader','--use-gl=swiftshader']});
const results=[];let page,errs;
// fonts and the update check go to the internet; the tests do not depend on them
const IGNORE=/fonts\.(googleapis|gstatic)|api\.github\.com|net::ERR_|Failed to load resource|GroupMarkerNotSet|swiftshader/i;
async function fresh(){if(page)await page.close();page=await browser.newPage({viewport:{width:1440,height:900}});errs=[];
  page.on('pageerror',e=>errs.push('pageerror: '+(e.stack||e)));page.on('console',m=>{if(m.type()==='error'&&!IGNORE.test(m.text()))errs.push('console: '+m.text())});
  await page.route(/fonts\.(googleapis|gstatic)\.com|api\.github\.com/,r=>r.abort());
  await page.goto(URL0);await page.waitForFunction(()=>typeof loadSample==='function'&&document.querySelector('#view'));await page.waitForTimeout(300)}
const ev=(fn,arg)=>page.evaluate(fn,arg);
async function test(name,fn){const t0=Date.now();try{await fn();await page.waitForTimeout(100);if(errs.length)throw new Error(errs.slice(0,5).join('\n'));results.push([name,'ok',Date.now()-t0])}
  catch(e){results.push([name,'FAIL',Date.now()-t0,String(e.message||e).slice(0,1500)])}finally{errs.length=0}}
async function sample(){await ev(()=>loadSample());await page.waitForFunction(()=>S.doc&&S.doc.layers.length>0);await page.waitForTimeout(200)}
async function drag(x0,y0,x1,y1,steps=8){const b=await page.locator('#view').boundingBox();await page.mouse.move(b.x+b.width*x0,b.y+b.height*y0);await page.mouse.down();
  for(let i=1;i<=steps;i++)await page.mouse.move(b.x+b.width*(x0+(x1-x0)*i/steps),b.y+b.height*(y0+(y1-y0)*i/steps));await page.mouse.up();await page.waitForTimeout(80)}

await fresh();
await test('démarrage sans erreur',async()=>{const v=await ev(()=>window.PRISM_VERSION);if(!v)throw new Error('pas de version')});
await test('photo d’exemple',async()=>{await sample();const n=await ev(()=>[S.doc.w,S.doc.h,S.doc.layers.length]);if(!(n[0]>0&&n[2]>0))throw new Error(JSON.stringify(n))});
await test('menus : chaque liste et sous-liste se construit',async()=>{const bad=await ev(()=>{const bad=[];const walk=(a,w)=>a.forEach(x=>{if(x&&typeof x==='object'&&typeof x.sub==='function'){try{walk(x.sub(),w+' > '+x.label)}catch(e){bad.push(w+' > '+x.label+': '+e.message)}}});
    for(const k in MENU2){try{walk(MENU2[k].items(),k)}catch(e){bad.push(k+': '+e.message)}}return bad});if(bad.length)throw new Error(bad.join('\n'))});
await test('outils : chacun se choisit et trace sur la photo, puis annulation',async()=>{
  const tools=await ev(()=>TOOL_ORDER.filter(Boolean));const bad=[];
  for(const t of tools){if(t==='text')continue;// text opens an editor on click; tested below
    await ev(t=>{setTool(t);if(t==='clone'){S.cloneSrc=S.cloneSrc||{x:200,y:200}}},t);
    try{await drag(0.35,0.4,0.55,0.5);await ev(()=>{if(S.tf&&window.tfApply)tfApply();if(S.drag)S.drag=null});await page.keyboard.press('Escape')}catch(e){bad.push(t+': '+e.message)}
    if(errs.length){bad.push(t+': '+errs.join(' | '));errs.length=0}}
  await ev(()=>{for(let i=0;i<40;i++)undo()});if(bad.length)throw new Error(bad.join('\n'))});
await test('pinceau : un trait change les pixels, annuler le retire',async()=>{await ev(()=>{setTool('brush');S.color='#ff0000'});
  const px=()=>ev(()=>{const c=flatSync(),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let h=0;for(let i=0;i<d.length;i+=7)h=(h*31+d[i])|0;return h});
  const a=await px();await drag(0.4,0.45,0.5,0.45,12);const b=await px();await ev(()=>undo());const c=await px();
  if(a===b)throw new Error('le trait n’a rien changé');if(a!==c)throw new Error('annuler n’a pas rétabli : '+a+' / '+c)});
await test('réglages : la lumière s’applique et se rend',async()=>{const r=await ev(async()=>{const before=S.history.length;insertLayer(newAdjust('Test'),'Test',true);const L=AL();L.dev.exposure=0.8;S.docVer++;render();await new Promise(r=>setTimeout(r,300));
    const c=flatSync(),d=c.getContext('2d').getImageData(10,10,1,1).data;return {h:S.history.length-before,px:[...d]}});if(!r.px||r.px[3]!==255)throw new Error(JSON.stringify(r))});
await test('calques : nouveau, dupliquer, supprimer',async()=>{const r=await ev(()=>{const n0=S.doc.layers.length;addLayer();dupLayer();const n1=S.doc.layers.length;delLayer();return [n0,n1,S.doc.layers.length]});
  if(!(r[1]===r[0]+2&&r[2]===r[1]-1))throw new Error(JSON.stringify(r))});
await test('export : PNG, JPEG, TIFF, GIF',async()=>{const r=await ev(async()=>{const c=flatSync(),id=c.getContext('2d').getImageData(0,0,c.width,c.height);const o={};
    o.png=(await new Promise(r=>c.toBlob(r,'image/png'))).size;o.jpg=(await new Promise(r=>c.toBlob(r,'image/jpeg',0.9))).size;o.tiff=(await encodeTIFF8(id,'srgb',false)).size;
    const t=mk(160,120);t.getContext('2d').drawImage(c,0,0,160,120);o.gif=(await encodeGIF(t.getContext('2d').getImageData(0,0,160,120),64,false)).size;return o});
  for(const k in r)if(!(r[k]>100))throw new Error(k+' '+r[k])});
await test('16 bits : la chaîne haute précision se rend',async()=>{const r=await ev(async()=>{if(typeof PREC==='undefined')return 'absent';const old=S.doc.bits;try{S.doc.bits=16;S.docVer++;render();await new Promise(r=>setTimeout(r,300));return 'ok'}finally{S.doc.bits=old;S.docVer++;render()}});if(r!=='ok'&&r!=='absent')throw new Error(r)});
await test('historique : annuler / rétablir en série',async()=>{const r=await ev(()=>{const n=S.hi;for(let i=0;i<5;i++)undo();for(let i=0;i<5;i++)redo();return [n,S.hi]});if(r[0]!==r[1])throw new Error(JSON.stringify(r))});
await test('fenêtres : ouverture et fermeture des boîtes courantes',async()=>{const bad=await ev(async()=>{const bad=[];const names=['exportDialog','resizeDialog','canvasSizeDialog','shortcutsDialog'];
    for(const n of names){const f=window[n];if(typeof f!=='function')continue;try{await f();await new Promise(r=>setTimeout(r,150));closeDialog()}catch(e){bad.push(n+': '+e.message)}}return bad});if(bad.length)throw new Error(bad.join('\n'))});
await test('palette de commandes',async()=>{await page.keyboard.press('Control+k');await page.waitForTimeout(200);await page.keyboard.type('flou');await page.waitForTimeout(200);await page.keyboard.press('Escape')});
await test('double exposition : outil et annulation',async()=>{const r=await ev(async()=>{const DX=window.PrismDexp;if(!DX)return 'absent';const c=mk(900,600),g=c.getContext('2d');g.fillStyle='#246';g.fillRect(0,0,900,600);g.fillStyle='#eee';g.fillRect(300,100,300,400);
    const f=new File([await new Promise(r=>c.toBlob(r,'image/png'))],'b.png',{type:'image/png'});const n=S.doc.layers.length;await DX.start(f);await new Promise(r=>setTimeout(r,200));
    const on=S.tool==='dexp'&&S.doc.layers.length===n+1;DX.finish(false);return on&&S.doc.layers.length===n?'ok':'outil non actif ou calque resté'});if(r!=='ok'&&r!=='absent')throw new Error(r)});

await test('agrandissement IA (moteur ONNX) sur un petit extrait',async()=>{const r=await ev(async()=>{const U=__x4p.onnx;U.ok=async()=>true;const m=await U.load('fast');if(!m)return 'modèle non chargé';
    const s=mk(48,40);cx(s).drawImage(flatSync(),500,400,48,40,0,0,48,40);const o=await U.canvas(s,2,m,null);return o.width===96&&o.height===80?'ok':o.width+'x'+o.height});if(r!=='ok')throw new Error(r)});
await test('impression : la page ne garde que la photo',async()=>{const r=await ev(async()=>{let called=0;window.print=()=>{called++};PrismPrint.dialog();await new Promise(r=>setTimeout(r,150));
    const info=document.querySelector('#prInfo').textContent;[...document.querySelectorAll('#scrim button')].find(b=>/Imprimer/.test(b.textContent)).click();
    for(let i=0;i<50&&!called;i++)await new Promise(r=>setTimeout(r,100));const img=document.querySelector('#printSheet img');return {called,img:!!(img&&img.naturalWidth),info}});
  if(!r.called||!r.img||!/pixels par pouce/.test(r.info))throw new Error(JSON.stringify(r))});
console.log(results.map(r=>`${r[1]==='ok'?'✓':'✗'} ${r[0]} (${r[2]} ms)${r[3]?'\n    '+r[3].replace(/\n/g,'\n    '):''}`).join('\n'));
await browser.close();server.close();
const failed=results.filter(r=>r[1]!=='ok').length;console.log(failed?`${failed} échec(s) sur ${results.length}`:`${results.length} tests réussis`);process.exit(failed?1:0);
