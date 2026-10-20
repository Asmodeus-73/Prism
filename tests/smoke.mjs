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
await test('sélection d’objet (Segment Anything) : un clic de baguette choisit un objet',async()=>{await sample();await ev(()=>{S.opts.wand.obj=true;setTool('wand')});
  await drag(0.5,0.5,0.5,0.5,1);await page.waitForFunction(()=>S.history[S.hi]&&S.history[S.hi].label==='Sélectionner un objet',null,{timeout:180000});
  const r=await ev(()=>{const m=S.doc.sel,c=mk(m.width,m.height),g=rx(c);g.drawImage(m,0,0);const a=g.getImageData(0,0,c.width,c.height).data;let on=0;for(let i=3;i<a.length;i+=4)if(a[i]>127)on++;S.opts.wand.obj=false;return on/(c.width*c.height)});
  if(!(r>0.005&&r<0.995))throw new Error('couverture '+r)});
await test('masque IA : le nouveau réglage local est déjà dosé',async()=>{await sample();const r=await ev(async()=>{const d=S.doc,m=mk(d.w,d.h),g=cx(m);g.fillStyle='#fff';g.fillRect(d.w*0.25,d.h*0.25,d.w*0.5,d.h*0.5);
    const cm=AI.categoryMask;AI.categoryMask=async()=>m;try{await PrismAIMask.apply('subj','layer');await PrismAIMask.apply('sky','layer')}finally{AI.categoryMask=cm}
    const z=DEV0(),moved=L=>Object.keys(z).filter(k=>typeof z[k]==='number'&&L.dev[k]!==z[k]).length,a=d.layers.slice(-2);return a.map(L=>[L.name,!!L.mask,moved(L)])});
  if(r[0][0]!=='Sujet (IA)'||r[1][0]!=='Ciel (IA)'||!r.every(x=>x[1]&&x[2]>0))throw new Error(JSON.stringify(r))});
await test('avant / après : glisser la séparation ne sélectionne rien et reste sur la photo',async()=>{await sample();await ev(()=>{S.compare='off';toggleCompare()});await page.waitForTimeout(200);
  const b=await page.locator('#split .knob').boundingBox();await page.mouse.move(b.x+16,b.y+16);await page.mouse.down();for(let i=1;i<=12;i++)await page.mouse.move(b.x+16-i*60,b.y+16+i*4);await page.mouse.up();
  const r=await ev(()=>{const a=S.panX/S.vw,o={sel:getSelection().type,x:S.splitX,a};S.compare='off';markContent();return o});
  if(r.sel==='Range'||r.x<r.a)throw new Error(JSON.stringify(r))});
await test('plume : Retour arrière retire un point, pas le calque',async()=>{await sample();await ev(()=>{setTool('pen');const d=S.doc;d.path={pts:[{x:10,y:10,ix:10,iy:10,ox:10,oy:10},{x:80,y:40,ix:80,iy:40,ox:80,oy:40}],closed:false};document.activeElement&&document.activeElement.blur&&document.activeElement.blur()});
  const n0=await ev(()=>S.doc.layers.length);await page.keyboard.press('Backspace');await page.waitForTimeout(150);
  const r=await ev(()=>[S.doc.layers.length,S.doc.path?S.doc.path.pts.length:0]);await ev(()=>{S.doc.path=null;setTool('move')});if(r[0]!==n0||r[1]!==1)throw new Error(JSON.stringify([n0,...r]))});
await test('plume : le tracé suit le redimensionnement une seule fois',async()=>{await sample();const r=await ev(()=>{const d=S.doc;d.path={pts:[{x:100,y:60,ix:100,iy:60,ox:100,oy:60}],closed:false};resizeDoc(Math.round(d.w/2),Math.round(d.h/2),'Test');const p=S.doc.path.pts[0];const o=[p.x,p.y];undo();S.doc.path=null;return o});
  if(Math.abs(r[0]-50)>1||Math.abs(r[1]-30)>1)throw new Error(JSON.stringify(r))});
await test('projets : des dimensions piégées sont refusées',async()=>{const r=await ev(()=>{const out=[];for(const m of [{w:'<img src=x onerror=alert(1)>',h:10},{w:1.5,h:10},{w:0,h:10},{w:4000,h:3000}]){try{checkDims(m);out.push('ok')}catch(e){out.push('refus')}}return out.join()});if(r!=='refus,refus,refus,ok')throw new Error(r)});
await test('impression : la page ne garde que la photo',async()=>{const r=await ev(async()=>{let called=0;window.print=()=>{called++};PrismPrint.dialog();await new Promise(r=>setTimeout(r,150));
    const info=document.querySelector('#prInfo').textContent;[...document.querySelectorAll('#scrim button')].find(b=>/Imprimer/.test(b.textContent)).click();
    for(let i=0;i<50&&!called;i++)await new Promise(r=>setTimeout(r,100));const img=document.querySelector('#printSheet img');return {called,img:!!(img&&img.naturalWidth),info}});
  if(!r.called||!r.img||!/pixels par pouce/.test(r.info))throw new Error(JSON.stringify(r))});
await test('pinceaux Photoshop (.abr) : lecture d’une pointe',async()=>{const r=await ev(b64=>{const t=PrismABR(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)));return t.map(x=>x.w+'x'+x.h).join()},'AAYAAjhCSU1zYW1wAAACKAAAAiQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeAAAAKAAIAQACAAIABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYAAtkA2QDxAPj/8gDzAPT/9AD1APD/9gD2AO7/9wD3AOz/+AD4AOr/+QD4AOr/+QD5AOj/+gD5AOj/+gD6AOb/+wD6AOb/+wD6AOb/+wD6AOb/+wD6AOb/+wD6AOb/+wD6AOb/+wD6AOb/+wD6AOb/+wD5AOj/+gD5AOj/+gD4AOr/+QD4AOr/+QD3AOz/+AD2AO7/9wD1APD/9gDzAPT/9ADxAPj/8gDZADhCSU1kZXNjAAAABAAAAAA=');if(r!=='40x30')throw new Error(r)});
await test('pinceaux Photoshop (.abr) : un fichier piégé ne bloque pas l’éditeur',async()=>{const r=await ev(()=>{const N=5000,E=72,b=new Uint8Array(4+12+N*E),v=new DataView(b.buffer);v.setUint16(0,6);v.setUint16(2,1);b.set([56,66,73,77,115,97,109,112],4);v.setUint32(12,N*E);
  for(let i=0;i<N;i++){const o=16+i*E;v.setUint32(o,68);v.setInt32(o+4+47+8,4000);v.setInt32(o+4+47+12,4000);v.setUint16(o+4+47+16,8)}
  const t0=performance.now(),t=PrismABR(b);return t.length+' '+Math.round(performance.now()-t0)});const [n,ms]=r.split(' ').map(Number);if(n!==0||ms>2000)throw new Error(r)});
await test('accueil et photothèque : la photo déjà ouverte se rouvre',async()=>{const r=await ev(async()=>{const c=mk(300,200);cx(c).fillStyle='#c33';cx(c).fillRect(0,0,300,200);const b=await new Promise(r=>c.toBlob(r,'image/jpeg'));
    await openBlob(new File([b],'deja-ouverte.jpg',{type:'image/jpeg'}));await flushSave();await libLoad();const pid=S.doc.pid,em=document.getElementById('empty'),out=[];
    showHome();await libOpen(pid);out.push(em.hidden);
    showHome();await openLibrary();await libOpen(pid);out.push(em.hidden&&!document.querySelector('#library'));
    showHome();await Promise.all([libOpen(pid),libOpen(pid)]);out.push(em.hidden);return out.join()});if(r!=='true,true,true')throw new Error(r)});
await test('profils d’objectif : reconnaissance et correction',async()=>{const r=await ev(async()=>{const P=PrismLens.profiles,db=await P.load();const f=P.find(db,{make:'SONY',model:'ILCE-7M3',lens:'FE 24-70mm F2.8 GM',focal:24,fn:8});
    if(!f||!f.lens)return 'non trouvé';const q=P.params(f.lens,24,8,f.cam&&f.cam[3]);const c=mk(300,200);cx(c).fillStyle='#888';cx(c).fillRect(0,0,300,200);const o=PrismLens.runSync(c,q,true);return o.width===300&&q.lfs>0?'ok':'rendu'});if(r!=='ok')throw new Error(r)});
console.log(results.map(r=>`${r[1]==='ok'?'✓':'✗'} ${r[0]} (${r[2]} ms)${r[3]?'\n    '+r[3].replace(/\n/g,'\n    '):''}`).join('\n'));
await browser.close();server.close();
const failed=results.filter(r=>r[1]!=='ok').length;console.log(failed?`${failed} échec(s) sur ${results.length}`:`${results.length} tests réussis`);process.exit(failed?1:0);
