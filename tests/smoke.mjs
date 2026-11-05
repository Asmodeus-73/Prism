// Prism smoke tests: open the built page (web/index.html) in Chromium and exercise the editor.
// Run: node tests/smoke.mjs        (needs the "playwright" package and its Chromium)
//      PRISM_BROWSER=webkit node tests/smoke.mjs   (WebKit, the engine of the Mac app)
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

const ENGINE=process.env.PRISM_BROWSER||'chromium';
const browser=ENGINE==='chromium'?await pw.chromium.launch({args:['--enable-unsafe-swiftshader','--use-gl=swiftshader']}):await pw[ENGINE].launch();
console.log('Navigateur : '+ENGINE+' '+browser.version());
const results=[];let page,errs,logs=[];
// fonts and the update check go to the internet; the tests do not depend on them
const IGNORE=/fonts\.(googleapis|gstatic)|api\.github\.com|net::ERR_|Failed to load resource|GroupMarkerNotSet|swiftshader/i;
async function fresh(){if(page)await page.close();page=await browser.newPage({viewport:{width:1440,height:900}});errs=[];
  page.on('pageerror',e=>errs.push('pageerror: '+(e.stack||e)));page.on('console',m=>{logs.push(m.text());if(logs.length>200)logs.shift();if(m.type()==='error'&&!IGNORE.test(m.text()))errs.push('console: '+m.text())});
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
await test('réglages : finitions couleur (interrupteur, rendu 8 et 16 bits, annulation)',async()=>{await ev(()=>{const i=S.doc.layers.findIndex(l=>l.kind==='adjust'&&!l.mask);if(i>=0)S.doc.active=i;syncAll();pushHistory('Base du test')});/* fixe l'état de départ : le test précédent change un réglage sans étape d'historique */
  const mean=bits=>ev(async b=>{const old=S.doc.bits;S.doc.bits=b;S.docVer++;try{let c=b===16?await renderDoc16(0.2):await renderDoc(0.2);const d=c.data||(c.canvas||c).getContext('2d').getImageData(0,0,c.width,c.height).data,k=d instanceof Float32Array?255:d instanceof Uint16Array?1/257:1;let s=0;for(let i=0;i<d.length;i+=4)s+=d[i]-d[i+2];return s/(d.length/4)*k}finally{S.doc.bits=old}},bits);
  const a=await mean(8);await ev(()=>document.querySelector('[data-fxadd]').scrollIntoView());await page.click('[data-fxadd]');await page.locator('.mi',{hasText:'Noir et blanc'}).click();await page.waitForTimeout(150);await page.click('[data-fx=bw] [data-fxon]');await page.waitForTimeout(150);
  const on=await ev(()=>!!(AL().dev.fx&&AL().dev.fx.bw&&AL().dev.fx.bw.on));const b8=await mean(8),b16=await mean(16);
  if(!on||Math.abs(b8)>0.6||Math.abs(b16)>0.6||Math.abs(a)<1)throw new Error(JSON.stringify({on,a,b8,b16}));
  await ev(()=>undo());const c=await mean(8);if(Math.abs(c-a)>0.01)throw new Error('annuler : '+a+' / '+c)});
await test('interface 1.0 : calques à droite, capsule d’options, pastille de zoom, mode Focus',async()=>{await ev(()=>setTool('remove'));
  const r=await ev(()=>({lay:!!document.querySelector('.side #layersPanel,#atRail #layersPanel'),cap:!!document.querySelector('#stage>#optbar'),fam:[...document.querySelectorAll('#optbar .cap-fam [data-ft]')].map(b=>b.dataset.ft+(b.getAttribute('aria-pressed')==='true'?'*':'')).join(),
    zoom:!!document.querySelector('#stage .cap-zoom #zoomLbl'),rows:getComputedStyle(document.querySelector('#app')).gridTemplateRows.split(' ').length}));
  if(!r.lay||!r.cap||!r.zoom||r.rows!==2||!/remove\*/.test(r.fam))throw new Error(JSON.stringify(r));
  await page.click('#optbar .cap-fam [data-ft=clone]');if(await ev(()=>S.tool)!=='clone')throw new Error('famille : '+await ev(()=>S.tool));
  await ev(()=>document.activeElement&&document.activeElement.blur());await page.keyboard.press('Tab');await page.waitForTimeout(300);
  const f=await ev(()=>[document.body.classList.contains('focus'),getComputedStyle(document.querySelector('.side')).visibility]);
  await page.keyboard.press('Tab');await page.waitForTimeout(300);const g=await ev(()=>document.body.classList.contains('focus'));
  if(!f[0]||f[1]!=='hidden'||g)throw new Error('focus '+JSON.stringify([f,g]))});
await test('atelier : panneau de gauche repliable, colonne de droite fixe, bascule photothèque, paramètres',async()=>{
  const a=await ev(()=>[document.body.classList.contains('atelier'),!!document.querySelector('#atRail #atNav'),!!document.querySelector('#atSwitch [data-v=ed][aria-pressed=true]')].join());
  if(a!=='true,true,true')throw new Error('atelier '+a);
  const w0=await ev(()=>document.querySelector('#stage').getBoundingClientRect().width);
  await page.click('#atFoldBtn');
  /* the stage widens with a transition: wait for it to settle (slow CI machines) */
  for(let k=0;k<20&&await ev(w=>document.querySelector('#stage').getBoundingClientRect().width<=w+150,w0);k++)await page.waitForTimeout(100);
  const b=await ev(()=>[document.body.classList.contains('at-fold'),getComputedStyle(document.querySelector('#atStrip')).display,document.querySelector('#stage').getBoundingClientRect().width,getComputedStyle(document.querySelector('aside.insp')).display]);
  if(!b[0]||b[1]!=='flex'||!(b[2]>w0+150)||b[3]==='none')throw new Error('repli '+JSON.stringify(b));
  await page.click('#atStrip [data-k=layers]');await page.waitForTimeout(200);if(await ev(()=>document.body.classList.contains('at-fold')))throw new Error('réouverture');
  await ev(()=>PrismSettings());await page.click('#scrim .at-sw [data-acc="3"]');
  const c=await ev(()=>getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  await page.click('#scrim #atReset');const d=await ev(()=>getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());await ev(()=>closeDialog());
  if(c!=='rgb(34,160,107)'||c===d)throw new Error('accent '+c+' / '+d)});
await test('téléphone : barre de modes, grand curseur, comparer au doigt',async()=>{await page.setViewportSize({width:390,height:844});await page.waitForTimeout(400);
  try{const on=await ev(()=>document.body.classList.contains('phone'));if(!on)throw new Error('mode téléphone absent');
    await page.click('.p-modes [data-pm=reg]');await page.click('#pRegChips [data-k=exposure]');const before=await ev(()=>ADJ()&&ADJ().dev.exposure);
    const r=await page.locator('#pRange').boundingBox();await page.mouse.click(r.x+r.width*0.85,r.y+r.height/2);await page.waitForTimeout(200);
    const after=await ev(()=>ADJ()&&ADJ().dev.exposure);if(!(after>before))throw new Error('exposition '+before+' → '+after);
    const c=await page.locator('.p-cmp').boundingBox();await page.mouse.move(c.x+c.width/2,c.y+c.height/2);await page.mouse.down();const held=await ev(()=>S.holdBefore);await page.mouse.up();const rel=await ev(()=>S.holdBefore);
    if(!held||rel)throw new Error('comparer '+held+' '+rel);
    for(const m of ['ret','cal','ia','plus','reg'])await page.click(`.p-modes [data-pm=${m}]`);
    await page.click('.p-modes [data-pm=ret]');await page.click('#pTools [data-tool=clone]');if(await ev(()=>S.tool)!=='clone')throw new Error('outil');
    await ev(()=>undo())}
  finally{await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(400)}
  if(await ev(()=>document.body.classList.contains('phone')||!document.querySelector('#stage>#optbar')))throw new Error('retour au bureau')});
await test('tablette : organisation bureau, panneau qui glisse par-dessus la photo',async()=>{await page.setViewportSize({width:834,height:1194});await page.waitForTimeout(400);
  try{const a=await ev(()=>[document.body.classList.contains('compact'),document.body.classList.contains('phone'),document.body.classList.contains('side-over'),!!document.querySelector('#stage>#optbar')]);
    if(a[0]||a[1]||!a[2]||!a[3])throw new Error('mise en page '+JSON.stringify(a));
    const w0=await ev(()=>document.querySelector('#stage').getBoundingClientRect().width);
    await ev(()=>PrismTablet.toggle(false));await page.click('#bSide');await page.waitForTimeout(350);
    const o=await ev(()=>[PrismTablet.isOpen(),getComputedStyle(document.querySelector('.side')).visibility,document.querySelector('#stage').getBoundingClientRect().width]);
    if(!o[0]||o[1]!=='visible'||Math.abs(o[2]-w0)>1)throw new Error('panneau '+JSON.stringify([o,w0]));
    await page.keyboard.press('F8');await page.waitForTimeout(350);if(await ev(()=>PrismTablet.isOpen()))throw new Error('F8')}
  finally{await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(400)}
  if(await ev(()=>document.body.classList.contains('side-over')))throw new Error('retour au bureau')});
await test('accueil : titre, accès rapides, Reprendre sur une rangée, zone de dépôt',async()=>{const r=await ev(()=>{const w=document.querySelector('#empty .welcome');
    return [!!w.querySelector('.w-head h2'),w.querySelectorAll('.w-tile').length,!!w.querySelector('.w-drop .w-fmt'),!!w.querySelector('.w-rh .w-all'),PrismHome.rel(Date.now()-5*60000),PrismHome.rel(Date.now()-864e5*1.02)]});
  if(!r[0]||r[1]!==4||!r[2]||!r[3]||r[4]!=='il y a 5 min')throw new Error(JSON.stringify(r))});
await test('corbeille : une photo supprimée se restaure, ses tuiles restent',async()=>{const r=await ev(async()=>{S.doc.nosave=false;S.doc.saved=false;while(SAVE.running)await new Promise(r=>setTimeout(r,50));await saveNow();const id=S.doc.pid;await libLoad();
    if(!LIB.items.some(i=>i.id===id))return 'absente de la photothèque '+id+' '+SAVE.state+' '+(await IDB.keys('projects')).join('|')+' '+LIB.items.map(i=>i.id).join('|');const pd=libDelete([id]);let bs=[];for(let i=0;i<50&&!bs.length;i++){await new Promise(r=>setTimeout(r,100));bs=document.querySelectorAll('#scrim .foot .btn')}if(!bs.length)return 'pas de confirmation';bs[bs.length-1].click();await pd;const gone=!(await IDB.get('projects',id));await gcBlobs();
    const tr=(await PrismTrash.list()).find(e=>e.id===id);if(!tr)return 'pas dans la corbeille';const keys=manifestKeys(tr.m);let miss=0;for(const k of keys)if(!(await IDB.get('blobs',k)))miss++;
    await PrismTrash.restore(id);const back=!!(await IDB.get('projects',id))&&LIB.items.some(i=>i.id===id)&&!(await PrismTrash.list()).some(e=>e.id===id);
    await libOpen(id);return [gone,miss,back,S.doc&&S.doc.pid===id].join()});
  if(r!=='true,0,true,true')throw new Error(r)});
await test('aperçu rapide : une photo lente se calcule en plus petit pendant le glissé, en entier ensuite',async()=>{const r=await ev(async()=>{const fr=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    S.sliding=true;LQ.full=600;LQ.last=0;markContent();await fr();const k1=S.workSize.k,small=work.width<S.workSize.w;S.sliding=false;await new Promise(r=>setTimeout(r,450));await fr();
    return [k1<1,small,S.workSize.k===1,work.width===S.workSize.w].join()});
  if(r!=='true,true,true,true')throw new Error(r)});
await test('nouveaux effets : nuages, fractale, vitrail, verre dépoli, déformation, inversion polaire, croquis, peinture',async()=>{const r=await ev(()=>{const src=S.doc.layers[0].canvas,s=resample(src,320,214),bad=[];
    for(const id of ['clouds','fractal','stained','frosted','organic','polar','pencil','oil']){const F=FILTERS[id],pp={};F.params.forEach(q=>pp[q[0]]=q[5]);const o=F.run(s,pp),a=rx(o).getImageData(0,0,o.width,o.height).data,b=rx(s).getImageData(0,0,s.width,s.height).data;let df=0;for(let i=0;i<a.length;i+=16)df+=Math.abs(a[i]-b[i]);
      const o2=F.run(s,pp),same=rx(o2).getImageData(0,0,o.width,o.height).data.every((v,i)=>v===a[i]);if(o.width!==s.width||df<500||!same)bad.push(id+':'+df+':'+same)}
    const G=window.__FILTER_GROUPS.flatMap(g=>g[1]);return bad.concat(['clouds','oil','polar'].filter(x=>!G.includes(x)).map(x=>'menu '+x)).join()});
  if(r)throw new Error(r)});
await test('raccourcis personnalisables : outil sur K, B donné à Exporter, menu à jour, tout réinitialiser',async()=>{
  await ev(()=>{PrismKeys.set({});closeDialog();PrismKeys.dialog()});await page.waitForSelector('#scrim .kc-r[data-id="tool:brush"]');
  await page.click('#scrim .kc-r[data-id="tool:brush"] [data-cap]');await page.keyboard.press('k');const dbg=await ev(()=>JSON.stringify(PrismKeys.get())+' '+document.querySelector('#scrim .kc-msg').textContent+' '+document.querySelectorAll('#scrim').length);
  await page.click('#scrim .kc-r[data-id="menu:file/Exporter"] [data-cap]');await page.keyboard.press('b');
  const r1=await ev(()=>{const K=PrismKeys.get();return [K['tool:brush'],K['menu:file/Exporter'],document.querySelector('#scrim .kc-r[data-id="tool:brush"] .kc-k').textContent.trim(),document.querySelector('#scrim .kc-msg').textContent]});
  await ev(()=>closeDialog());await ev(()=>setTool('move'));await page.mouse.move(700,450);await page.keyboard.press('k');const t1=await ev(()=>S.tool);
  await page.keyboard.press('b');await page.waitForSelector('#scrim',{timeout:4000}).catch(()=>{});const ex=await ev(()=>!!document.querySelector('#scrim')&&document.querySelector('#scrim').textContent.includes('Export'));await ev(()=>closeDialog());const t2=await ev(()=>S.tool);
  const kbd=await ev(()=>{const it=MENU2.file.items().find(x=>x&&x.label==='Exporter…');return it&&it.kbd});
  await ev(()=>{PrismKeys.set({});setTool('move')});await page.keyboard.press('b');const t3=await ev(()=>S.tool);
  const r=[r1[0],r1[1],r1[2],/était à/.test(r1[3]),t1,ex,t2,kbd,t3].join('|');
  if(r!=='k|b|K|false|brush|true|brush|B|brush')throw new Error(r+' '+dbg)});
await test('versions : une à l’enregistrement, une nommée, revenir en arrière garde l’état actuel, ouvrir en copie',async()=>{const r=await ev(async()=>{const wait=async()=>{while(SAVE.running)await new Promise(r=>setTimeout(r,50))};
    const d=S.doc;d.nosave=false;d.saved=false;await wait();await saveNow();const pid=S.doc.pid;await PrismVersions.forget(pid);
    const v1=await PrismVersions.add(pid,{name:'Avant'});const n0=S.doc.layers.length;addLayer();S.doc.saved=false;await wait();await saveNow();await PrismVersions.add(pid);
    const l1=(await PrismVersions.list(pid)).length;await PrismVersions.restore(v1.id);for(let i=0;i<60&&!(S.doc&&S.doc.pid===pid);i++)await new Promise(r=>setTimeout(r,100));
    const back=S.doc&&S.doc.pid===pid&&S.doc.layers.length===n0,l2=await PrismVersions.list(pid);
    const kept=l2.some(v=>v.m.layers.length===n0+1);
    const nid=await PrismVersions.openCopy(v1.id);const copy=S.doc&&S.doc.pid===nid&&/version du/.test(S.doc.name);
    await gcBlobs();let miss=0;for(const v of l2)for(const k of manifestKeys(v.m))if(!(await IDB.get('blobs',k)))miss++;
    const menu=MENU2.file.items().some(x=>x&&x.label==='Versions de la photo…');
    await libOpen(pid);return [l1>=2,back,kept,copy,miss,menu].join()});
  if(r!=='true,true,true,true,0,true')throw new Error(r)});
await test('visite guidée : étapes sur l’interface, Suivant, Échap l’arrête',async()=>{await ev(()=>PrismTour.start());await page.waitForSelector('#tour .tr-tip h3');
  const n=await ev(()=>PrismTour.steps().length);await page.click('#tour [data-t="next"]');await page.click('#tour [data-t="next"]');await page.waitForTimeout(400);
  const r=await ev(()=>{const h=document.querySelector('#tour .tr-hole').getBoundingClientRect(),d=document.querySelector('#dock').getBoundingClientRect();return Math.abs(h.left-d.left)<12&&Math.abs(h.height-d.height)<16});
  await page.keyboard.press('Escape');const off=await ev(()=>!PrismTour.on&&!document.querySelector('#tour')&&PREF.get('tourDone',0)>0);const menu=await ev(()=>MENU2.help.items().some(x=>x&&x.label==='Visite guidée'));
  if(!(n>=8&&r&&off&&menu))throw new Error([n,r,off,menu].join())});
await test('anglais : Affichage > Langue traduit menus et panneaux, retour au français',async()=>{await ev(()=>PrismLang.set('en'));await page.waitForTimeout(300);
  const en=await ev(()=>({bar:document.querySelector('#menubar').textContent,tab:document.body.textContent.includes('Adjustments'),lang:document.documentElement.lang,menu:MENU2.view.items().some(x=>x&&x.label==='Langue')}));
  await ev(()=>PrismLang.set('fr'));await page.waitForTimeout(300);const fr=await ev(()=>document.querySelector('#menubar').textContent);
  if(!/File.*Edit.*View.*Help/.test(en.bar)||!en.tab||en.lang!=='en'||!en.menu||!/Fichier.*Édition.*Affichage.*Aide/.test(fr))throw new Error(JSON.stringify({en,fr}))});
await test('pipette : prend la couleur affichée, réglages compris',async()=>{await fresh();await sample();
  await ev(()=>{const A=newAdjust('Test');A.dev.exposure=1.2;A.dev.saturation=60;S.doc.layers.push(A);S.docVer++;markComp();render();setTool('eyedropper')});await page.waitForTimeout(300);
  const b=await page.locator('#view').boundingBox();const X=b.x+b.width*.4,Y=b.y+b.height*.4;await page.mouse.click(X,Y);await page.waitForTimeout(200);
  const r=await ev(async([X,Y])=>{const R=view.getBoundingClientRect(),p=toDoc(X-R.left,Y-R.top),full=await renderDoc(1,{before:false});const q=full.getContext('2d').getImageData(Math.floor(p.x)-1,Math.floor(p.y)-1,3,3).data;let s=[0,0,0];for(let i=0;i<36;i+=4){s[0]+=q[i];s[1]+=q[i+1];s[2]+=q[i+2]}
    const c=S.color.match(/\w\w/g).map(h=>parseInt(h,16));return {c,s:s.map(v=>v/9)}},[X,Y]);
  if(r.c.some((v,i)=>Math.abs(v-r.s[i])>3))throw new Error('pipette '+JSON.stringify(r))});
await test('panneaux détachables : Calques et une section flottent, se déplacent, se remettent',async()=>{
  await ev(()=>{PrismFloat.float('layers');PrismFloat.float('sec:base',{x:300,y:200,w:300,h:400})});await page.waitForTimeout(200);
  const a=await ev(()=>({f:PrismFloat.floating(),pos:getComputedStyle(document.querySelector('[data-sec=base]')).position,ph:document.querySelectorAll('.pf-ph').length,saved:Object.keys(PREF.get('floats',{}))}));
  const h=await page.locator('#devBody [data-sec=base] > summary').boundingBox();await page.mouse.move(h.x+30,h.y+12);await page.mouse.down();await page.mouse.move(h.x+130,h.y+52,{steps:5});await page.mouse.up();
  const moved=await ev(()=>Math.round(document.querySelector('[data-sec=base]').getBoundingClientRect().left));
  await ev(()=>PrismFloat.dockAll());const b=await ev(()=>({f:PrismFloat.floating(),ph:document.querySelectorAll('.pf-ph').length,saved:Object.keys(PREF.get('floats',{})).length}));
  if(a.f.length!==2||a.pos!=='fixed'||a.ph!==2||a.saved.length!==2||Math.abs(moved-400)>4||b.f.length||b.ph||b.saved)throw new Error(JSON.stringify({a,moved,b}))});
await test('panneaux détachables : s’aimantent à gauche comme à droite, à la souris',async()=>{
  const drag=async(sel,pts)=>{const h=await page.locator(sel).boundingBox();await page.mouse.move(h.x+30,h.y+h.height/2);await page.mouse.down();for(const [x,y] of pts)await page.mouse.move(x,y,{steps:8});await page.mouse.up();await page.waitForTimeout(250)};
  const st=()=>ev(()=>{const R=document.querySelector('#atRail').getBoundingClientRect(),b=document.querySelector('[data-sec=base]').getBoundingClientRect(),lp=document.querySelector('#layersPanel');
    return {fl:PrismFloat.floating(),inRail:b.left>=R.left-1&&b.right<=R.right+1&&b.top>=R.top-1,lp:lp.parentElement.id||lp.parentElement.className,pin:(PREF.get('floats',{})['sec:base']||{}).pin}});
  await ev(()=>switchTab('develop'));
  const s0=await page.locator('#devBody [data-sec=base] > summary').boundingBox();
  await drag('#devBody [data-sec=base] > summary',[[s0.x-200,s0.y+20],[150,640]]);const a=await st();
  await drag('#lyHead',[[600,300],[1300,700]]);const b=await st();
  const l0=await page.locator('#lyHead').boundingBox();await drag('#lyHead',[[l0.x-200,l0.y],[150,760]]);const c=await st();
  await drag('[data-sec=base] > summary',[[700,300],[1300,500]]);const d=await st();
  if(!(a.inRail&&a.pin==='left'&&a.fl.join()==='sec:base'&&b.lp.includes('insp')&&c.lp==='atRail'&&!d.fl.length))throw new Error(JSON.stringify({a,b,c,d}));
  await ev(()=>{PrismFloat.dockAll();PREF.set('pfHome',{})})});
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
await test('masque IA : les réglages suivent la photo (sombre → éclaircit, équilibrée → ne touche à rien)',async()=>{await sample();const r=await ev(async()=>{const d=S.doc,m=mk(d.w,d.h),g=cx(m);g.fillStyle='#fff';g.fillRect(0,0,d.w,d.h);
    const cm=AI.categoryMask;AI.categoryMask=async()=>m;const out={};
    try{for(const [name,paint] of [['dark',(c,x,y)=>{const v=Math.round(24+((x*7+y*13)%9));return[v,v,v]}],['balanced',(c,x,y)=>{const v=Math.round(112+((x>>2)+(y>>2))%2*32);return[v,v,v]}]]){
      const base=d.layers[0],c=base.canvas,cg=cx(c),im=cg.getImageData(0,0,c.width,c.height);for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const k=(y*c.width+x)*4,p=paint(0,x,y);im.data[k]=p[0];im.data[k+1]=p[1];im.data[k+2]=p[2];im.data[k+3]=255}cg.putImageData(im,0,0);markContent();
      await PrismAIMask.apply('subj','layer');const L=d.layers[d.layers.length-1];out[name]={exposure:L.dev.exposure,moved:Object.keys(DEV0()).filter(k=>typeof DEV0()[k]==='number'&&L.dev[k]!==DEV0()[k])}}}
    finally{AI.categoryMask=cm}return out});
  if(!(r.dark.exposure>0.3))throw new Error('photo sombre : '+JSON.stringify(r.dark));
  if(r.balanced.exposure&&Math.abs(r.balanced.exposure)>0.15)throw new Error('photo équilibrée : '+JSON.stringify(r.balanced))});
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
await test('16 bits : pinceau et densité doux restent en 16 bits, annuler les retire',async()=>{const r=await ev(async()=>{const W=600,H=400,a=new Uint16Array(W*H*4);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;a[i]=Math.round(9000+x*30.5);a[i+1]=Math.round(15000+y*20.25);a[i+2]=Math.round(20000+x*10.125);a[i+3]=65535}
    setDoc(canvasFrom16({w:W,h:H,data:a,hi:true}),'degrade.png',{meta:'PNG 16 bits'});const h0=effHi(S.doc.layers[0]).slice(),n0=S.hi;
    const stroke=(t,y)=>{setTool(t);const o=S.opts[t],sp=Math.max(1,o.size*(t==='dodge'?0.2:(o.spacing||12)/100));beginStroke({x:100,y});for(let k=1;k<=16;k++)moveStroke({x:100+k*sp+.01,y});return endStroke()};
    Object.assign(S.opts.brush,{size:120,hardness:0,opacity:.08,flow:.5,smooth:0,scatter:0,grain:0,pressSize:false});S.color='#ffffff';for(let i=0;i<3;i++)await stroke('brush',130);
    Object.assign(S.opts.dodge,{size:120,strength:.1,mode:'dodge',range:'all'});for(let i=0;i<3;i++)await stroke('dodge',280);
    const L=S.doc.layers[0],e=effHi(L),c8=rx(L.canvas).getImageData(0,0,W,H).data,o={steps:S.hi-n0};
    for(const[k,y0]of[['pinceau',130],['densité',280]]){let ch=0,fine=0,off=0;const lv=new Set();for(let y=y0-30;y<y0+30;y++)for(let x=110;x<400;x++){const i=(y*W+x)*4;
      for(let c=0;c<3;c++){const dv=e[i+c]-h0[i+c];if(dv){ch++;if(dv%257)fine++;if(!c)lv.add(dv)}if(Math.abs(c8[i+c]-e[i+c]/257)>1.01)off++}}o[k]={ch,fine,lv:lv.size,off}}
    const e1=e.slice();while(S.hi>n0)undo();let u=0;const eu=effHi(S.doc.layers[0]);for(let i=0;i<eu.length;i++)if(eu[i]!==h0[i])u++;
    while(S.hi<n0+6)redo();let rd=0;const er=effHi(S.doc.layers[0]);for(let i=0;i<er.length;i++)if(er[i]!==e1[i])rd++;o.undo=u;o.redo=rd;return o});
  const bad=[];if(r.steps!==6)bad.push('étapes '+r.steps);
  for(const k of ['pinceau','densité']){const q=r[k];if(!(q.ch>1000))bad.push(k+' : trop peu de pixels changés');if(!(q.fine>q.ch*0.5))bad.push(k+' : changements arrondis aux niveaux 8 bits ('+q.fine+'/'+q.ch+')');if(!(q.lv>200))bad.push(k+' : '+q.lv+' niveaux seulement');if(q.off)bad.push(k+' : le canevas 8 bits ne suit pas ('+q.off+')')}
  if(r.undo)bad.push('annuler laisse '+r.undo+' valeurs');if(r.redo)bad.push('rétablir diffère de '+r.redo+' valeurs');if(bad.length)throw new Error(bad.join('\n')+'\n'+JSON.stringify(r))});
await test('16 bits : gomme, tampon, dégradé, correcteur, doigt et pot gardent les 16 bits',async()=>{const r=await ev(async()=>{const W=600,H=400,a=new Uint16Array(W*H*4);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;a[i]=Math.round(9000+x*30.5);a[i+1]=Math.round(15000+y*20.25);a[i+2]=Math.round(20000+x*10.125);a[i+3]=65535}
    setDoc(canvasFrom16({w:W,h:H,data:a,hi:true}),'degrade.png',{meta:'PNG 16 bits'});const n0=S.hi,o={};let prev=effHi(S.doc.layers[0]).slice();
    const look=k=>{const e=effHi(S.doc.layers[0]);let ch=0,fine=0;for(let i=0;i<e.length;i++){const dv=e[i]-prev[i];if(dv){ch++;if(dv%257)fine++}}o[k]=[ch,fine,S.history[S.hi].label];prev=e.slice()};
    const stroke=(t,x0,y)=>{setTool(t);const q=S.opts[t],sp=Math.max(1,q.size*(q.spacing||12)/100);beginStroke({x:x0,y});for(let k=1;k<=10;k++)moveStroke({x:x0+k*sp+.01,y});return endStroke()};
    Object.assign(S.opts.eraser,{size:80,hardness:0,opacity:.1,smooth:0,scatter:0,grain:0});await stroke('eraser',300,60);look('gomme');
    S.cloneSrc={x:100,y:330};S.cloneOff=null;Object.assign(S.opts.clone,{size:60,hardness:0,all:false,aligned:false,smooth:0});await stroke('clone',400,350);look('tampon');
    setTool('gradient');S.opts.gradient.opacity=.3;S.color='#ffffff';gradientCommit({type:'gradient',shape:'linear',x0:0,y0:0,x1:W,y1:0,target:S.doc.layers[0]});look('dégradé');
    Object.assign(S.opts.heal,{size:40,hardness:.5,mode:'spot'});await stroke('heal',300,200);look('correcteur');
    const pe=b=>({button:0,buttons:b,pointerType:'mouse',pressure:.5,shiftKey:false,altKey:false,preventDefault(){},stopPropagation(){}});setTool('smudge');Object.assign(S.opts.smudge,{size:60,strength:.5,hardness:.5});
    onDown(pe(1),{x:100,y:300});for(let k=1;k<20;k++)onMove(pe(1),{x:100+k*5,y:300});onUp(pe(0),{x:195,y:300});look('doigt');
    setTool('bucket');Object.assign(S.opts.bucket,{tol:255,contiguous:true,all:false,opacity:.07,soft:true});onDown(pe(1),{x:50,y:50});onUp(pe(0),{x:50,y:50});look('pot');
    const steps=S.hi-n0;while(S.hi>n0)undo();let u=0;const eu=effHi(S.doc.layers[0]);for(let i=0;i<eu.length;i++)if(eu[i]!==a[i])u++;return{o,steps,u}});
  const bad=[];for(const k in r.o){const[ch,fine]=r.o[k];if(!(ch>100))bad.push(k+' : rien n’a changé');else if(!(fine>ch*0.5))bad.push(k+' : changements arrondis aux niveaux 8 bits ('+fine+'/'+ch+')')}
  if(r.steps!==6)bad.push('étapes '+r.steps);if(r.u)bad.push('annuler laisse '+r.u+' valeurs');if(bad.length)throw new Error(bad.join('\n')+'\n'+JSON.stringify(r))});
// sparse layers (calques épars): a text, a shape, a brush stroke and a small paste on the sample photo; helpers live in the page as window.__sp
async function spScene(compact){await sample();return ev(async compact=>{SPARSE.on=false;const d=S.doc,W=d.w,H=d.h,wait=ms=>new Promise(r=>setTimeout(r,ms));
  window.__sp={pix:c=>rx(c).getImageData(0,0,c.width,c.height).data,flat:()=>{flatCache.key='';return __sp.pix(flatSync())},
    eq:(a,b)=>{if(a.length!==b.length)return false;const x=new Uint32Array(a.buffer),y=new Uint32Array(b.buffer);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return false;return true},
    hash:a=>{const x=new Uint32Array(a.buffer);let h=0;for(let i=0;i<x.length;i++)h=(h*31+x[i])|0;return h},
    layer:L=>__sp.pix(spOf(L)?spExpand(spOf(L)):L.canvas),/* reads a layer without rebuilding it */
    small:L=>!!spOf(L)&&layerBytes(L)<W*H*4*0.25,
    stroke:async(x,y,col)=>{setTool('brush');Object.assign(S.opts.brush,{size:30,hardness:.8,opacity:1,flow:1,smooth:0,scatter:0,grain:0,pressSize:false});S.color=col;beginStroke({x,y});for(let k=1;k<=24;k++)moveStroke({x:x+k*12,y:y+Math.sin(k/3)*30});await endStroke()},
    pe:b=>({button:0,buttons:b,pointerType:'mouse',pressure:.5,shiftKey:false,altKey:false,ctrlKey:false,metaKey:false,preventDefault(){},stopPropagation(){}})};
  const T=newPixel('Texte',mk(W,H));T.txt={text:'Bonjour',font:'Georgia',size:90,bold:true,italic:false,color:'#ffee00',align:'left',lh:1.15,track:0,boxW:0,sw:2,sc:'#000000',x:200,y:150};
  T.fx={shadow:{on:true,color:'#000000',op:.5,blur:12,dx:4,dy:6}};d.layers.splice(d.active+1,0,T);d.active++;finalizeMeta(T);markComp();pushHistory('Texte');
  const F=newPixel('Forme',mk(W,H));F.shp={type:'star',x:1100,y:700,w:300,h:280,fill:'#e8574a',stroke:'#ffffff',sw:6,r:40,n:5};d.layers.splice(d.active+1,0,F);d.active++;finalizeMeta(F);markComp();pushHistory('Forme');
  addLayer();await __sp.stroke(300,900,'#22cc88');
  const pc=mk(220,140);{const q=cx(pc);q.fillStyle='#3388ff';q.fillRect(0,0,220,140);q.fillStyle='#fff';q.fillRect(40,40,140,60)}pc.pos={x:1400,y:150};pasteClip(pc,'Collage');
  window.__sp.idx=[2,3,4,5];setTool('move');await wait(50);if(compact){SPARSE.on=true;await SPARSE.compactAll()}
  return d.layers.map(L=>L.name)},compact)}
await test('calques épars : au repos, un calque presque vide se compacte et le rendu reste identique au pixel près',async()=>{await spScene(false);
  const r=await ev(async()=>{const d=S.doc,o={},A=__sp.idx.map(i=>d.layers[i]);ditherSeed=1;const f0=__sp.flat(),r0=__sp.pix(await renderDoc(1)),th0=A.map(L=>__sp.hash(__sp.layer(L))),b0=d.bits;const r16=async()=>{d.bits=16;S.docVer++;ditherSeed=1;try{return __sp.pix(await renderDoc(1))}finally{d.bits=b0;S.docVer++}},q0=await r16();
    o.before=A.map(L=>!!spOf(L));const delay=SPARSE.delay;SPARSE.delay=150;SPARSE.on=true;SPARSE.act=0;SPARSE.schedule(0);
    for(let i=0;i<200&&!(A.every(L=>spOf(L))&&!spCandidates().length);i++)await new Promise(r=>setTimeout(r,50));SPARSE.delay=delay;
    o.after=A.map(L=>__sp.small(L));o.kb=A.map(L=>Math.round(layerBytes(L)/1024));o.fullKb=Math.round(d.w*d.h*4/1024);
    o.hist=S.history.every(h=>h.layers.every(l=>l.kind!=='pixel'||l===h.layers[0]||!!spOf(l)||!Object.getOwnPropertyDescriptor(l,'canvas').value));
    SPARSE.log=[];const e0=SPARSE.stats.expand;ditherSeed=1;o.flat=__sp.eq(f0,__sp.flat());o.full=__sp.eq(r0,__sp.pix(await renderDoc(1)));o.layers=A.every((L,k)=>__sp.hash(__sp.layer(L))===th0[k]);o.full16=__sp.eq(q0,await r16());
    S.contentDirty=true;render();syncAll();drawLayerThumbs();renderThumbs();undo();redo();await buildManifest(d);memEstimate();o.view=SPARSE.stats.expand-e0;o.where=SPARSE.log.map(s=>s.split('\n').slice(3,6).map(x=>x.trim().split(' ')[1]).join(' < '));SPARSE.log=null;
    o.still=__sp.idx.every(i=>!!spOf(S.doc.layers[i]));return o});
  const bad=[];if(r.before.some(Boolean))bad.push('compacté trop tôt');if(!r.after.every(Boolean))bad.push('pas compacté : '+r.kb.join(',')+' Ko sur '+r.fullKb);if(!r.hist)bad.push('historique non compacté');
  if(!r.flat)bad.push('aplati différent');if(!r.full)bad.push('rendu pleine résolution différent');if(!r.layers)bad.push('pixels du calque différents');if(!r.full16)bad.push('rendu 16 bits différent');if(r.view)bad.push(r.view+' reconstruction(s) pendant rendu, vignettes, historique ou enregistrement');if(!r.still)bad.push('le calque ne reste pas épars');
  if(bad.length)throw new Error(bad.join('\n')+'\n'+JSON.stringify(r))});
await test('calques épars : peindre sur un calque compacté, annuler, rétablir sont exacts',async()=>{await spScene(true);
  const r=await ev(async()=>{const d=S.doc,i=4,o={};d.active=i;const s0=spOf(d.layers[i]),p0=__sp.layer(d.layers[i]),f0=__sp.flat();o.sparse0=!!s0;
    await __sp.stroke(250,1000,'#ff2244');const p1=__sp.pix(d.layers[i].canvas),f1=__sp.flat();o.changed=!__sp.eq(p0,p1);
    undo();o.undoStore=spOf(d.layers[i])===s0;o.undo=__sp.eq(__sp.layer(d.layers[i]),p0)&&__sp.eq(__sp.flat(),f0);
    redo();o.redo=__sp.eq(__sp.layer(d.layers[i]),p1)&&__sp.eq(__sp.flat(),f1);
    await SPARSE.compactAll();o.recompact=__sp.small(d.layers[i])&&__sp.eq(__sp.layer(d.layers[i]),p1)&&__sp.eq(__sp.flat(),f1);
    undo();o.undo2=__sp.eq(__sp.layer(d.layers[i]),p0)&&__sp.eq(__sp.flat(),f0);redo();o.redo2=__sp.eq(__sp.layer(d.layers[i]),p1)&&__sp.eq(__sp.flat(),f1);
    setTool('eraser');Object.assign(S.opts.eraser,{size:60,hardness:.5,opacity:1,smooth:0,scatter:0,grain:0});beginStroke({x:300,y:900});for(let k=1;k<=10;k++)moveStroke({x:300+k*15,y:900});await endStroke();
    const p2=__sp.layer(d.layers[i]);o.erased=!__sp.eq(p2,p1);undo();o.undo3=__sp.eq(__sp.layer(d.layers[i]),p1);return o});
  const bad=Object.entries(r).filter(([k,v])=>!v).map(([k])=>k);if(bad.length)throw new Error('échec : '+bad.join(', ')+'\n'+JSON.stringify(r))});
await test('calques épars : enregistrer puis rouvrir un projet aux calques compactés est identique',async()=>{await spScene(true);
  const r=await ev(async()=>{const d=S.doc,o={},A=__sp.idx.map(i=>d.layers[i]);o.sparse=A.every(L=>__sp.small(L));const f0=__sp.flat(),lp=A.map(L=>__sp.hash(__sp.layer(L)));
    const m=await buildManifest(d);const area=e=>(e.canvas||[]).reduce((n,t)=>n+t.w*t.h,0);o.tiles=__sp.idx.map(i=>area(m.layers[i])<d.w*d.h*0.25);await IDB.put('projects',m.id,m);
    SPARSE.log=[];const e0=SPARSE.stats.expand;await loadManifest(m,t=>IDB.get('blobs',t.key));const D=S.doc;o.loadedSparse=__sp.idx.map(i=>!!spOf(D.layers[i]));o.noRebuild=SPARSE.stats.expand===e0;o.where=SPARSE.log.map(s=>s.split('\n').slice(3,6).map(x=>x.trim().split(' ')[1]).join(' < ')).join(' | ')||1;SPARSE.log=null;
    o.flat=__sp.eq(__sp.flat(),f0);o.layers=__sp.idx.every((i,k)=>__sp.hash(__sp.layer(D.layers[i]))===lp[k]);o.meta=!!(D.layers[2].txt&&D.layers[2].fx&&D.layers[3].shp);
    await IDB.del('projects',m.id);return o});
  const bad=Object.entries(r).filter(([k,v])=>!(Array.isArray(v)?v.every(Boolean):v)).map(([k])=>k);if(bad.length)throw new Error('échec : '+bad.join(', ')+'\n'+JSON.stringify(r))});
await test('calques épars : un projet enregistré en calques pleine taille s’ouvre toujours, puis se compacte',async()=>{await spScene(false);
  const r=await ev(async()=>{const d=S.doc,o={};const f0=__sp.flat();const m=await buildManifest(d);o.fullTiles=__sp.idx.every(i=>m.layers[i].canvas.reduce((n,t)=>n+t.w*t.h,0)===d.w*d.h);
    await loadManifest(m,t=>IDB.get('blobs',t.key));const D=S.doc;o.plain=__sp.idx.every(i=>!spOf(D.layers[i])&&D.layers[i].canvas.width===d.w);o.flat=__sp.eq(__sp.flat(),f0);
    SPARSE.on=true;await SPARSE.compactAll();o.compacted=__sp.idx.every(i=>__sp.small(D.layers[i]));o.flat2=__sp.eq(__sp.flat(),f0);await IDB.del('projects',m.id);return o});
  const bad=Object.entries(r).filter(([k,v])=>!v).map(([k])=>k);if(bad.length)throw new Error('échec : '+bad.join(', ')+'\n'+JSON.stringify(r))});
await test('calques épars : déplacer, transformer, recadrer, filtrer, exporter, fusionner, aplatir, dupliquer, réordonner sur des calques compactés',async()=>{await spScene(false);
  const r=await ev(async()=>{const d=S.doc,h0=S.hi,pe=__sp.pe,out={};let psd=0;const sf=saveFile;saveFile=async b=>{psd=b.size};
    const mv=(i,dx,dy)=>{d.active=i;setTool('move');onDown(pe(1),{x:500,y:500});onMove(pe(1),{x:500+dx/2,y:500+dy/2});onMove(pe(1),{x:500+dx,y:500+dy});onUp(pe(0),{x:500+dx,y:500+dy})};
    const ops={
      'déplacer (pixels)':()=>mv(4,60,40),'déplacer (texte)':()=>mv(2,-30,25),'déplacer (collage)':()=>mv(5,-200,300),
      'transformation libre':()=>{d.active=3;if(!tfStart())throw new Error('tfStart');const T=S.tf,tfMesh=PrismTF.mesh,c=T.q.reduce((a,p)=>({x:a.x+p.x/4,y:a.y+p.y/4}),{x:0,y:0});T.q.forEach(p=>{p.x=c.x+(p.x-c.x)*1.3;p.y=c.y+(p.y-c.y)*1.3});tfMesh(T);tfApply()},
      'recadrer':()=>{setTool('crop');S.crop={x:100,y:80,w:1500,h:1000,angle:0};applyCrop();setTool('move')},
      'redimensionner':()=>resizeDoc(900,600,'Test'),
      'filtre':()=>{d.active=5;const L=AL();applyMasked(L,FILTERS.blur.run(L.canvas,{r:3}),FILTERS.blur.name)},
      'fusionner vers le bas':()=>{d.active=3;mergeDown()},
      'aplatir':async()=>{await flatten()},
      'dupliquer':()=>{d.active=2;dupLayer()},
      'réordonner':()=>{d.active=4;moveLayer(-1)},
      'copier-coller':()=>{d.active=5;S.doc.sel=null;copySel();pasteClip(clip,'Collé')},
      'export PSD':async()=>{psd=0;await exportPSD();return psd>1000?'psd':'psd vide'},
      'export PNG':async()=>{const c=await renderDoc(1);const b=await new Promise(r=>c.toBlob(r,'image/png'));return b.size>1000?'png':'png vide'}};
    try{for(const [name,fn] of Object.entries(ops)){const res=[];
      for(const comp of [false,true]){restore(h0);SPARSE.on=false;if(comp){SPARSE.on=true;await SPARSE.compactAll();SPARSE.on=false}else for(const L of S.doc.layers)void L.canvas;
        const nsp=S.doc.layers.filter(L=>spOf(L)).length;ditherSeed=1;let tag='';try{tag=(await fn())||''}catch(e){tag='erreur : '+e.message}const D=S.doc,f=__sp.flat();
        res.push({nsp,tag,w:D.w,h:D.h,n:D.layers.length,hash:__sp.hash(f),lay:D.layers.map(L=>L.kind==='pixel'?__sp.hash(__sp.layer(L)):0).join()})}
      const [a,b]=res;out[name]=b.nsp<4?'pas de calque compacté ('+b.nsp+')':a.tag.startsWith('erreur')||b.tag.startsWith('erreur')?a.tag+' / '+b.tag:(a.tag&&a.tag!==b.tag)?a.tag+' / '+b.tag:(a.w!==b.w||a.h!==b.h||a.n!==b.n||a.hash!==b.hash||a.lay!==b.lay)?'résultat différent '+JSON.stringify([a,b].map(x=>[x.w,x.h,x.n,x.hash])):a.hash===0?'vide':'ok'}}
    finally{saveFile=sf;SPARSE.on=true}return out});
  const bad=Object.entries(r).filter(([k,v])=>v!=='ok').map(([k,v])=>k+' : '+v);if(bad.length)throw new Error(bad.join('\n'))});
// ---- remplissage génératif (application de bureau) : la partie page, avec un moteur natif simulé ----
await test('remplissage génératif : hors application de bureau, un message et rien de modifié',async()=>{await sample();
  const r=await ev(async()=>{const d=S.doc,n=d.layers.length;const had=!!window.__TAURI__;d.sel=maskFromU8(new Uint8Array(d.w*d.h).fill(1),d.w,d.h,false);
    const items=MENU2.image.items().filter(x=>x&&x.label==='Remplissage génératif…').length;await PrismGF.dialog();const t1=document.getElementById('toast').textContent;const ok=await PrismGF.fill({prompt:'x'});
    return{had,items,t1,ok,same:d.layers.length===n,dlg:!!document.querySelector('#scrim')}});
  if(r.had||r.items!==1||!/application de bureau/.test(r.t1)||r.ok||!r.same||r.dlg)throw new Error(JSON.stringify(r))});
await test('remplissage génératif : fenêtre de travail (position, taille, multiples de 8)',async()=>{await sample();
  const bad=await ev(()=>{const bad=[],W=1800,H=1200;const cases=[[10,10,60,50],[W-40,H-30,W,H],[0,0,W,H],[800,500,1000,700],[100,100,1500,1100],[5,600,25,640]];
    for(const[x0,y0,x1,y1]of cases)for(const work of[512,256]){const P=PrismGF.plan({x0,y0,x1,y1},W,H,work),t=`${[x0,y0,x1,y1]} w${work}`;
      if(!(P.x0>=0&&P.y0>=0&&P.x1<=W&&P.y1<=H))bad.push(t+' hors image');
      if(!(P.x0<=x0&&P.y0<=y0&&P.x1>=x1&&P.y1>=y1))bad.push(t+' ne contient pas la zone');
      if(P.rw%8||P.rh%8||P.rw<64||P.rh<64)bad.push(t+' taille '+P.rw+'x'+P.rh);
      if(Math.max(P.rw,P.rh)!==work&&Math.max(P.w,P.h)>=work/8)bad.push(t+' grand côté '+Math.max(P.rw,P.rh));
      if(P.x1-P.x0!==P.w||P.y1-P.y0!==P.h)bad.push(t+' w/h')}
    const q=PrismGF.plan({x0:800,y0:500,x1:900,y1:560},W,H,512);if(q.w!==256||q.h!==256||q.rw!==512||q.x0!==(850-128))bad.push('zone moyenne '+JSON.stringify(q));
    const g=new Uint8Array(9*9);g[4*9+4]=1;const a=PrismGF.grow(g,9,9,2);let n=0;for(const v of a)n+=v;if(n!==25||!a[2*9+2]||a[1*9+1])bad.push('grow '+n);
    return bad});
  if(bad.length)throw new Error(bad.join('\n'))});
await test('remplissage génératif : calque + masque progressif, annulation, échec réseau, annulation de l’utilisateur',async()=>{await sample();
  const r=await ev(async()=>{const d=S.doc,out={};const sc=document.createElement('canvas');
    const sel=mk(d.w,d.h),g=cx(sel);g.fillStyle='#fff';g.fillRect(600,400,200,120);d.sel=sel;selChanged();
    const calls=[],hand={};let sawBody=null,mode='ok';
    window.__TAURI__={event:{listen:async(ev,fn)=>{hand[ev]=fn;return()=>{delete hand[ev]}}},core:{invoke:async(cmd,a,o)=>{calls.push(cmd);
      if(cmd==='sd_status')return{ok:true,cached:false,loaded:false,total:2.1e9,error:null};
      if(cmd==='ai_status')return{ok:true,gpu:null};
      if(cmd==='sd_cancel'){mode='cancel';return}
      if(cmd==='sd_prepare'){if(mode==='offline')throw 'Téléchargement impossible : https://x/y : error sending request';
        hand['sd-download']&&hand['sd-download']({payload:{phase:'download',done:1e9,total:2.1e9}});out.busyDl=document.querySelector('#busy span').textContent;return{ep:'CPU',load_ms:1}}
      if(cmd==='sd_generate'){const p=JSON.parse(decodeURIComponent(o.headers['x-params'])),n=p.w*p.h;sawBody={p,len:a.length,n,a};
        hand['sd-progress']&&hand['sd-progress']({payload:{phase:'denoise',step:3,total:p.steps,ms:1}});out.busyGen=document.querySelector('#busy span').textContent;
        if(mode==='cancel')throw 'annulé';
        const rgb=new Uint8Array(n*3);for(let i=0;i<n;i++){rgb[i*3]=255;rgb[i*3+1]=0;rgb[i*3+2]=0}return rgb.buffer}}}};
    const n0=d.layers.length,h0=S.hi;
    PrismGF.OVR={work:256,steps:8,seed:5};
    const ok=await PrismGF.fill({prompt:'a red balloon',...PrismGF.OVR});
    out.ok=ok;out.layers=d.layers.length-n0;const L=d.layers[d.layers.length-1];out.name=L.name;out.hasMask=!!L.mask&&L.mask.width===d.w&&L.mask.height===d.h;out.edit=L.editMask;
    const px=(c,x,y)=>Array.from(rx(c).getImageData(x,y,1,1).data);
    out.mid=px(L.mask,700,460);out.edge=px(L.mask,598,460);out.far=px(L.mask,100,100);out.layerMid=px(L.canvas,700,460);
    out.ps=sawBody&&{w:sawBody.p.w,h:sawBody.p.h,steps:sawBody.p.steps,seed:sawBody.p.seed,prompt:sawBody.p.prompt,len:sawBody.len,n:sawBody.n};
    // the body: photo window then mask; the hole covers the selection and the margin, nothing far from it
    if(sawBody){const P=PrismGF.plan({x0:600,y0:400,x1:800,y1:520},d.w,d.h,256),n=sawBody.n,m=sawBody.a.subarray(n*3);const at=(x,y)=>m[Math.floor((y-P.y0)*P.fy)*P.rw+Math.floor((x-P.x0)*P.fx)];
      out.holeIn=at(700,460);out.holeNear=at(598,460);out.holeFar=at(P.x0+4,P.y0+4);
      const flat=cx(flatSync()).getImageData(P.x0+3,P.y0+3,1,1).data,k=(Math.floor(3*P.fy)*P.rw+Math.floor(3*P.fx))*3;out.srcOk=Math.abs(sawBody.a[k]-flat[0])<24}
    out.sel=!!d.sel;out.dlBusy=/Téléchargement du modèle de génération \(2,1 Go, une seule fois\)/.test(out.busyDl||'');out.genBusy=/étape 4 sur 8/.test(out.busyGen||'');
    out.busyOff=document.getElementById('busy').hidden;
    undo();out.afterUndo=d.layers.length-n0;redo();out.afterRedo=d.layers.length-n0;undo();d.sel=sel;selChanged();
    // offline: clear French message, nothing added
    mode='offline';const ok2=await PrismGF.fill({prompt:'x',...PrismGF.OVR});out.offline=ok2===false&&d.layers.length===n0&&/connexion/.test(document.getElementById('toast').textContent);
    // the person cancels during generation
    mode='cancelling';const calls0=calls.length;const orig=window.__TAURI__.core.invoke;window.__TAURI__.core.invoke=async(c,a,o)=>{if(c==='sd_generate'){PrismGF.cancel();throw 'annulé'}return orig(c,a,o)};
    const ok3=await PrismGF.fill({prompt:'x',...PrismGF.OVR});out.cancelled=ok3===false&&d.layers.length===n0&&/annulée/.test(document.getElementById('toast').textContent)&&calls.includes('sd_cancel');
    delete window.__TAURI__;PrismGF.OVR={};return out});
  const e=[];if(!r.ok||r.layers!==1)e.push('calque non créé');if(r.name!=='Remplissage génératif')e.push('nom '+r.name);if(!r.hasMask)e.push('masque absent');
  if(r.mid[3]!==255)e.push('masque plein attendu au centre : '+r.mid);if(!(r.edge[3]>0&&r.edge[3]<255))e.push('bord non progressif : '+r.edge);if(r.far[3]!==0)e.push('masque loin : '+r.far);
  if(r.layerMid.join()!=='255,0,0,255')e.push('pixel du calque '+r.layerMid);
  if(!r.ps||r.ps.w!==256||r.ps.h!==256||r.ps.steps!==8||r.ps.seed!==5||r.ps.prompt!=='a red balloon'||r.ps.len!==r.ps.n*4)e.push('paramètres '+JSON.stringify(r.ps));
  if(r.holeIn!==255||r.holeNear!==255||r.holeFar!==0)e.push(`masque envoyé ${r.holeIn}/${r.holeNear}/${r.holeFar}`);if(!r.srcOk)e.push('photo envoyée');
  if(!r.sel)e.push('sélection perdue');if(!r.dlBusy)e.push('texte de téléchargement : '+r.busyDl);if(!r.genBusy)e.push('texte de génération : '+r.busyGen);if(!r.busyOff)e.push('overlay encore là');
  if(r.afterUndo!==0||r.afterRedo!==1)e.push(`annuler/rétablir ${r.afterUndo}/${r.afterRedo}`);if(!r.offline)e.push('message hors ligne');if(!r.cancelled)e.push('annulation');
  if(e.length)throw new Error(e.join('\n')+'\n'+JSON.stringify(r))});
// ---- outils repris de Photo Studio (web/ps, MIT) : moteur en arrière-plan, filtres, ciel, mise à l'échelle selon le contenu ----
const psIdle=()=>page.waitForFunction(()=>{const b=document.querySelector('#busy');return !b||b.hidden||getComputedStyle(b).display==='none'},null,{timeout:120000});
const psHash=()=>ev(()=>{const c=flatSync(),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let h=0;for(let i=0;i<d.length;i+=13)h=(h*31+d[i])|0;return h});
await test('Photo Studio : chaque filtre s’ouvre, prévisualise et s’applique (une étape d’historique)',async()=>{await sample();await page.waitForFunction(()=>!!window.PSI,null,{timeout:20000});
  const bad=[];for(const id of['sharpdet','nlmeans','shhl','levels','chmix','selcolor','photofilter','gradmap']){const h0=await psHash(),n0=await ev(()=>S.hi);
    await ev(id=>filterDialog(id),id);await page.waitForSelector('#scrim .foot');
    await ev(id=>{const F=FILTERS[id],q=F.params.find(q=>!(F.choices&&F.choices[q[0]])&&!(F.checks||[]).includes(q[0])),i=document.querySelector('#ps-'+q[0]);i.value=Math.min(q[3],q[5]+(q[3]-q[2])*0.3);i.dispatchEvent(new Event('input'))},id);
    await page.waitForFunction(()=>{const L=pixelTarget();return L&&L.preview},null,{timeout:60000}).catch(()=>bad.push(id+' : pas d’aperçu'));
    await page.locator('#scrim .foot .btn.primary').click();await psIdle();await page.waitForTimeout(150);
    const r=await ev(()=>[S.hi,S.history[S.hi].label]);if(await psHash()===h0)bad.push(id+' : image inchangée');if(r[0]!==n0+1)bad.push(id+' : historique '+JSON.stringify(r))}
  if(bad.length)throw new Error(bad.join('\n'))});
await test('Photo Studio : remplir d’après le contenu ne touche que la sélection',async()=>{await sample();
  const r=await ev(async()=>{const d=S.doc,L=pixelTarget(),sel=mk(d.w,d.h);cx(sel).fillStyle='#fff';cx(sel).fillRect(700,500,120,90);d.sel=sel;selChanged();
    const before=cx(L.canvas).getImageData(0,0,d.w,d.h).data.slice();await PSX.contentFill(d,L,maskBBox(sel),{col:1,rot:0,scale:1,mirror:0});
    const after=cx(pixelTarget().canvas).getImageData(0,0,d.w,d.h).data;let inside=0,outside=0;
    for(let y=0;y<d.h;y+=3)for(let x=0;x<d.w;x+=3){const i=(y*d.w+x)*4,ch=before[i]!==after[i]||before[i+1]!==after[i+1];if(x>=700&&x<820&&y>=500&&y<590)inside+=ch;else if(x<690||x>830||y<490||y>600)outside+=ch}
    return{inside,outside,label:S.history[S.hi].label}});
  if(!(r.inside>100)||r.outside>0||r.label!=='Remplir d’après le contenu')throw new Error(JSON.stringify(r))});
await test('Photo Studio : remplacer le ciel donne trois calques groupés, annulables',async()=>{await sample();
  const n0=await ev(()=>{const d=S.doc,c=mk(d.w,d.h);cx(c).fillStyle='#fff';cx(c).fillRect(0,0,d.w,Math.round(d.h*.35));d.sel=c;selChanged();PSX.skyOpen();return S.doc.layers.length});
  await page.waitForSelector('#sk-preset');await page.selectOption('#sk-preset','3');await page.locator('#scrim .foot .btn',{hasText:'Remplacer'}).click();await psIdle();await page.waitForTimeout(200);
  const r=await ev(n0=>{const A=S.doc.layers,L=A.filter(l=>l.grp&&l.grp.name==='Remplacement du ciel');const out={n:A.length-n0,names:L.map(l=>l.name).join(),grp:new Set(L.map(l=>l.grp.id)).size,blends:L.map(l=>l.blend).join(),masked:L.every(l=>!!l.mask),
      underAdjust:A.slice(A.indexOf(L[2])+1).every(l=>l.kind==='adjust'),active:A[S.doc.active]===L[2]};undo();out.undo=S.doc.layers.length-n0;return out},n0);
  if(r.n!==3||r.names!=='Éclairage du ciel,Couleur du ciel,Ciel'||r.grp!==1||r.blends!=='multiply,color,source-over'||!r.masked||!r.underAdjust||!r.active||r.undo!==0)throw new Error(JSON.stringify(r))});
await test('Photo Studio : Échap annule un long calcul sans rien modifier',async()=>{await sample();
  await ev(()=>{const d=S.doc;PSX.seamApply(d,pixelTarget(),900,1200,'none',1)});await page.waitForFunction(()=>!!document.querySelector('#busy .ps-cancel'),null,{timeout:10000});
  await page.keyboard.press('Escape');await psIdle();await page.waitForTimeout(200);
  const r=await ev(()=>({size:[S.doc.w,S.doc.h],btn:!!document.querySelector('#busy .ps-cancel'),cur:!!PSX.cur,label:S.history[S.hi].label}));
  if(r.size.join()!=='1800,1200'||r.btn||r.cur||/échelle/.test(r.label))throw new Error(JSON.stringify(r))});
await test('Photo Studio : harmoniser reste un effet modifiable (mesure du dessous gardée)',async()=>{await sample();
  await ev(()=>{const d=S.doc,c=mk(d.w,d.h);cx(c).fillStyle='#e02020';cx(c).fillRect(700,500,300,200);d.active=0;insertLayer(newPixel('Patch',c),'Patch')});
  await ev(()=>PSX.harmonizeOpen());await page.waitForSelector('#ps-strength');await page.locator('#scrim .foot .btn.primary').click();await psIdle();await page.waitForTimeout(150);
  const r=await ev(()=>{const L=pixelTarget(),f=(L.filters||[]).find(x=>x.id==='harmonize');const px=c=>Array.from(rx(c).getImageData(800,600,1,1).data).join();
    const o={has:!!f,ts:!!(f&&f.p.ts&&f.p.ts.mean),px:px(L.canvas)};if(f){const again=FILTERS.harmonize.run(L.fbase,f.p);o.same=px(again)===o.px;delete f.p.ts;o.noTs=px(FILTERS.harmonize.run(L.fbase,f.p))}return o});
  if(!r.has||!r.ts||r.px==='224,32,32,255'||!r.same||r.noTs!=='224,32,32,255')throw new Error(JSON.stringify(r))});
await test('Photo Studio : mise à l’échelle selon le contenu, une seule étape d’historique',async()=>{await sample();
  await ev(()=>PSX.seamOpen());await page.waitForSelector('#cs-w');await page.selectOption('#cs-r','1:1');await page.selectOption('#cs-p','none');
  await page.locator('#scrim .foot .btn',{hasText:'Appliquer'}).click();await psIdle();await page.waitForTimeout(200);
  const r=await ev(()=>{const d=S.doc,o={size:[d.w,d.h],layers:d.layers.filter(L=>L.canvas).every(L=>L.canvas.width===d.w&&L.canvas.height===d.h),label:S.history[S.hi].label};undo();o.undo=[S.doc.w,S.doc.h];return o});
  if(r.size.join()!=='1200,1200'||!r.layers||r.label!=='Mise à l’échelle selon le contenu'||r.undo.join()!=='1800,1200')throw new Error(JSON.stringify(r))});
await test('Photo Studio : zones nettes donne une sélection, export .cube valide',async()=>{await sample();
  await ev(()=>{S.doc.sel=null;selChanged();PSX.focusOpen()});await page.waitForSelector('#fa-r');await page.waitForFunction(()=>!!S.doc.sel,null,{timeout:30000});
  await page.locator('#scrim .foot .btn',{hasText:'Sélectionner'}).click();await page.waitForTimeout(200);
  const r=await ev(async()=>{const o={sel:!!S.doc.sel&&!!maskBBox(S.doc.sel)};const sf=saveFile;let saved=null;saveFile=async(b,n)=>{saved=[n,await b.text()]};
    try{await PSX.exportCube()}finally{saveFile=sf}
    if(saved){const lines=saved[1].trim().split('\n').filter(l=>/^[\d.]+ [\d.]+ [\d.]+$/.test(l));o.name=saved[0];o.size=/LUT_3D_SIZE 33/.test(saved[1]);o.rows=lines.length;o.first=lines[0]}else o.toast=document.getElementById('toast').textContent;return o});
  if(!r.sel||(r.name?(!r.size||r.rows!==33*33*33||!/\.cube$/.test(r.name)):!/réglage/.test(r.toast||'')))throw new Error(JSON.stringify(r))});
// ---- photos animées et formats en plus (QOI, JPEG 2000, PPM, PNG animé, Motion Photo), ouverts par Fichier > Ouvrir ----
const FIX=path.join(path.dirname(new URL(import.meta.url).pathname),'fixtures');
async function openFix(...names){await ev(()=>{window.__d0=S.doc});await page.setInputFiles('#fileOpen',names.map(n=>path.join(FIX,n)));
  await page.waitForFunction(()=>S.doc&&S.doc!==window.__d0,null,{timeout:30000});await page.waitForFunction(()=>{const b=document.querySelector('#busy');return !b||b.hidden},null,{timeout:30000});await page.waitForTimeout(400)}
const layerPx=(x,y)=>ev(([x,y])=>{const L=S.doc.layers.find(l=>l.kind==='pixel');return Array.from(rx(L.canvas).getImageData(x,y,1,1).data)},[x,y]);
await test('formats : QOI, JPEG 2000 et PPM s’ouvrent au bon pixel',async()=>{await fresh();const e=[],near=(a,b,t=4)=>a.every((v,i)=>Math.abs(v-b[i])<=t);
  await openFix('photo.qoi');let r=await ev(()=>[S.doc.w,S.doc.h]);if(r.join()!=='64,48')e.push('QOI taille '+r);let px=await layerPx(2,3);if(px.join()!=='8,24,90,255')e.push('QOI pixel '+px);px=await layerPx(62,3);if(px[3]!==128)e.push('QOI alpha '+px);px=await layerPx(32,24);if(px.join()!=='240,200,40,255')e.push('QOI centre '+px);
  await openFix('photo.jp2');r=await ev(()=>[S.doc.w,S.doc.h,S.doc.name]);if(r.join()!=='64,48,photo.jp2')e.push('JP2 '+r);px=await layerPx(3,44);if(!near(px,[40,90,160,255]))e.push('JP2 pixel '+px);px=await layerPx(32,24);if(!near(px,[240,200,40,255]))e.push('JP2 centre '+px);if(e.some(x=>x.startsWith('JP2')))e.push(...logs.filter(t=>/warn|jpx|jpeg ?2000|openjpeg|wasm/i.test(t)).slice(-8));
  await openFix('photo.ppm');px=await layerPx(32,24);if(px.join()!=='240,200,40,255')e.push('PPM '+px);
  if(e.length)throw new Error(e.join('\n'))});
await test('photo animée : Motion Photo lue, image choisie ouverte, PNG animé en calques',async()=>{await fresh();
  await openFix(ENGINE==='webkit'?'motion-h264.jpg':'motion.jpg');const m=await ev(()=>S.doc.motion&&{from:S.doc.motion.from,ts:S.doc.motion.ts,size:S.doc.motion.blob.size,type:S.doc.motion.type});
  if(!m||m.from!=='Motion Photo'||m.ts!==500000||!(m.size>500))throw new Error('Motion Photo non détectée '+JSON.stringify(m));
  await ev(()=>PSX.motionDialog());await page.waitForSelector('#mo-v');await page.waitForFunction(()=>document.querySelector('#mo-v').readyState>=2,null,{timeout:15000});
  const sl=await page.locator('#mo-t').boundingBox();await page.mouse.click(sl.x+sl.width*0.2,sl.y+sl.height/2);await page.waitForTimeout(300);
  await page.locator('#scrim .foot .btn',{hasText:'Ouvrir cette image'}).click();await page.waitForTimeout(500);
  const o=await ev(()=>[S.doc.name,S.doc.w,S.doc.h]);if(o.join()!==(ENGINE==='webkit'?'motion-h264-image.png':'motion-image.png')+',64,48')throw new Error('image choisie '+o);
  await openFix('anim.png');const ak=await ev(()=>S.doc.anim&&S.doc.anim.kind);if(ak!=='apng')throw new Error('PNG animé non détecté : '+ak);
  await ev(()=>PSX.motionDialog());await page.waitForSelector('#mo-all');await page.locator('#mo-all').click();await page.waitForTimeout(300);
  const L=await ev(()=>{const A=S.doc.layers,g=A.filter(l=>l.grp&&/Animation/.test(l.grp.name));return{n:g.length,vis:g.filter(l=>l.visible!==false).length,top:A.slice(A.indexOf(g[g.length-1])+1).every(l=>l.kind==='adjust')}});
  if(L.n!==4||L.vis!==1||!L.top)throw new Error('calques '+JSON.stringify(L));
  const live=await ev(()=>{const enc=s=>new TextEncoder().encode(s),u32=n=>[n>>>24&255,n>>>16&255,n>>>8&255,n&255],box=(t,body)=>[...u32(8+body.length),...enc(t),...body];
    const mp4=[...box('ftyp',[...enc('isom'),0,0,0,0]),...box('mdat',[1,2,3,4])],heic=new Uint8Array([...box('ftyp',[...enc('heic'),0,0,0,0]),...box('meta',[0,0,0,0]),...box('mpvd',mp4)]);
    const r=PSX.findMotion(heic);return r&&[r.end-r.start,mp4.length]});
  if(!live||live[0]!==live[1])throw new Error('HEIC mpvd '+live)});

// ---- couleur et transparence (fond vert, couleur vers transparence, remplacer une couleur) et photos d'identité ----
await test('fond vert : fond transparent, sujet intact, reflet vert retiré ; couleur vers transparence ; couleur remplacée',async()=>{await fresh();
  const r=await ev(()=>{const W=400,H=300,c=mk(W,H),g=cx(c);g.fillStyle='rgb(20,175,70)';g.fillRect(0,0,W,H);g.fillStyle='rgb(220,140,100)';g.beginPath();g.arc(200,150,90,0,7);g.fill();g.fillStyle='rgb(160,190,120)';g.fillRect(195,55,10,8);
    const F=window.PrismFV,k=F.guessKey(c),o=rx(F.chromaKey(c,{key:null,tol:22,soft:18,spill:80,shrink:0,feather:0})).getImageData(0,0,W,H).data,at=(x,y)=>[...o.slice((y*W+x)*4,(y*W+x)*4+4)];
    const w=mk(4,1),wg=cx(w);wg.fillStyle='#fff';wg.fillRect(0,0,2,1);wg.fillStyle='#000';wg.fillRect(2,0,2,1);const t=rx(F.colorToAlpha(w,{color:[255,255,255],th:0})).getImageData(0,0,4,1).data;
    const q=mk(2,1),qg=cx(q);qg.fillStyle='rgb(200,30,30)';qg.fillRect(0,0,1,1);qg.fillStyle='rgb(200,200,200)';qg.fillRect(1,0,1,1);const u=rx(F.replaceColor(q,{from:[200,30,30],to:[30,60,200],tol:15,soft:10,light:60})).getImageData(0,0,2,1).data;
    return{k:k.map(Math.round),bg:at(5,5),sub:at(200,150),spill:at(199,58),c2a:[t[3],t[11]],rep:[...u]}});
  if(!(r.k[1]>150&&r.k[0]<60))throw new Error('fond deviné '+r.k);
  if(r.bg[3]!==0||r.sub[3]!==255||r.sub[0]!==220)throw new Error('incrustation '+JSON.stringify(r));
  if(!(r.spill[1]<=(r.spill[0]+r.spill[2])/2+12))throw new Error('reflet vert '+r.spill);
  if(r.c2a[0]!==0||r.c2a[1]!==255)throw new Error('couleur vers transparence '+r.c2a);
  if(!(r.rep[2]>r.rep[0]+60)||r.rep.slice(4,7).join()!=='200,200,200')throw new Error('remplacement '+r.rep)});
await test('photos d’identité : planche 10 × 15 cm à 300 ppp ouverte, glisser l’aperçu recadre',async()=>{await fresh();await sample();
  await ev(()=>PrismFV.id());await page.waitForSelector('#id-prev');const b=await page.locator('#id-prev').boundingBox();
  const before=await ev(()=>document.querySelector('#id-prev').toDataURL());
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2-30,b.y+b.height/2,{steps:5});await page.mouse.up();
  if(await ev(()=>document.querySelector('#id-prev').toDataURL())===before)throw new Error('l’aperçu ne bouge pas');
  await page.locator('#scrim .foot .btn',{hasText:'Créer la planche'}).click();await page.waitForFunction(()=>/photos-identite/.test(S.doc.name));
  const o=await ev(()=>[S.doc.w,S.doc.h]);if(o.join()!=='1772,1181')throw new Error('taille '+o)});
// ---- profondeur et visages (IA) : modèles chargés depuis web/ai/depth1 et web/ai/face1 ----
const viewPt=(x,y)=>ev(([x,y])=>{const r=view.getBoundingClientRect();return [r.left+S.panX+x*S.zoom,r.top+S.panY+y*S.zoom]},[x,y]);
const lpx=(x,y)=>ev(([x,y])=>Array.from(rx(pixelTarget().canvas).getImageData(x,y,1,1).data).join(),[x,y]);
await test('profondeur : brume, rééclairage placé à la souris, sélection selon la distance',async()=>{await fresh();await sample();
  const [W,H]=await ev(()=>[S.doc.w,S.doc.h]);const before=await lpx(W*0.5|0,H*0.15|0);
  await ev(()=>PrismDepth.fog());await page.waitForSelector('#dp-density',{timeout:180000});await page.waitForTimeout(400);
  await page.locator('#scrim .foot .btn',{hasText:'Appliquer'}).click();await page.waitForTimeout(200);
  const fog=await ev(()=>S.history[S.hi].label);if(fog!=='Brume selon la distance')throw new Error('brume '+fog);
  await ev(()=>undo());await ev(()=>PrismDepth.relight());await page.waitForSelector('#dp-power');
  const a=await viewPt(W*0.2,H*0.7),b=await viewPt(W*0.3,H*0.6);await page.mouse.move(a[0],a[1]);await page.mouse.down();await page.mouse.move(b[0],b[1],{steps:4});await page.mouse.up();await page.waitForTimeout(600);
  const pv=await ev(()=>!!pixelTarget().preview);await page.locator('#scrim .foot .btn',{hasText:'Appliquer'}).click();await page.waitForTimeout(200);
  const r=await ev(()=>({label:S.history[S.hi].label,prev:!pixelTarget().preview}));if(!pv||r.label!=='Rééclairage 3D'||!r.prev)throw new Error(JSON.stringify(r));
  if(await lpx(W*0.5|0,H*0.15|0)===before)throw new Error('rééclairage sans effet');
  await ev(()=>PrismDepth.depthSel());await page.waitForSelector('#ds-near');await page.waitForTimeout(300);await page.locator('#scrim .foot .btn',{hasText:'Sélectionner'}).click();
  const s=await ev(()=>({sel:!!S.doc.sel&&!!maskBBox(S.doc.sel),label:S.history[S.hi].label}));if(!s.sel||s.label!=='Sélectionner selon la distance')throw new Error(JSON.stringify(s))});
await test('visages : le modèle tourne, un clic masque une zone oubliée, le reste ne bouge pas',async()=>{await fresh();await sample();
  const [W,H]=await ev(()=>[S.doc.w,S.doc.h]);const F=await ev(async()=>(await PrismDepth.detectFaces()));if(!Array.isArray(F))throw new Error('détection '+F);
  await ev(()=>{S.doc.sel=null;PrismDepth.faces()});await page.waitForSelector('#fa-n');const cx0=W*0.15|0,cy0=H*0.8|0,far=[W*0.9|0,H*0.1|0];
  const out0=await lpx(...far),in0=await lpx(cx0,cy0);const p=await viewPt(cx0,cy0);await page.mouse.click(p[0],p[1]);await page.waitForTimeout(200);
  await page.selectOption('#fa-style','fill');await page.waitForTimeout(200);await page.locator('#scrim .foot .btn',{hasText:'Appliquer'}).click();await page.waitForTimeout(200);
  const r={label:await ev(()=>S.history[S.hi].label),in:await lpx(cx0,cy0),out:await lpx(...far)};
  if(r.label!=='Anonymiser les visages'||r.in!=='32,32,32,255'||r.in===in0||(F.length===0&&r.out!==out0))throw new Error(JSON.stringify({...r,n:F.length}))});
// ---- rendu film (simulation spectrale portée de vkdt) et contraste local ----
await test('rendu film : pellicule couleur, diapositive, noir et blanc, négatif scanné ; contraste local',async()=>{await fresh();await sample();
  const r=await ev(async()=>{const F=PrismFilm,D=await F.loadData(),L=pixelTarget(),c=mk(240,160);rx(c).drawImage(L.canvas,0,0,240,160);const im=rx(c).getImageData(0,0,240,160),o={};
    const run=async(film,proc,paper,x)=>{const Z=F.tables(D,F.setup(D,{film,paper,proc,evFilm:0,gFilm:1,couplers:0.5,halation:1,grain:x?1:0,fullW:1800,fullH:1200}));return await F.render(D,Z,im,0.13)};
    const px=(m,x,y)=>Array.from(m.data.slice((y*240+x)*4,(y*240+x)*4+3));
    const a=await run(4,0,3),b=await run(19,1,3),g=await run(21,1,3,1),n=await run(4,2,3);
    o.portra=px(a,120,40);o.velvia=px(b,120,40);o.trix=px(g,120,40);o.neg=px(n,120,40);
    o.grey=px(g,30,30).every((v,i,s)=>Math.abs(v-s[0])<=1);o.alpha=a.data[3];
    const lc=await F.localContrast(im,{clarity:0.6,shadows:1,highlights:1,sigma:0.12});let nd=0;for(let i=0;i<lc.data.length;i+=4)if(Math.abs(lc.data[i]-im.data[i])>2)nd++;o.lc=nd>500;return o});
  const ok=v=>v.every(x=>x>=0&&x<=255)&&!(v[0]===v[1]&&v[1]===v[2]&&(v[0]===0||v[0]===255));
  if(!ok(r.portra)||!ok(r.velvia)||!ok(r.neg)||!r.grey||r.alpha!==255||!r.lc||r.portra.join()===r.velvia.join())throw new Error(JSON.stringify(r));
  await ev(()=>PrismFilm.film());await page.waitForSelector('#lm-film');await page.waitForFunction(()=>!!pixelTarget().preview,null,{timeout:60000});
  await page.selectOption('#lm-film','20');await page.waitForTimeout(400);await page.locator('#scrim .foot .btn',{hasText:'Appliquer'}).click();
  await page.waitForFunction(()=>S.history[S.hi].label==='Simulation de pellicule',null,{timeout:120000});
  const bw=await ev(()=>{const d=rx(pixelTarget().canvas).getImageData(900,300,1,1).data;return Math.abs(d[0]-d[1])<=2&&Math.abs(d[1]-d[2])<=2});if(!bw)throw new Error('Double-X pas en noir et blanc')});
await test('photothèque : une photo importée est gardée telle quelle (pas de ré-encodage), se rouvre au pixel près',async()=>{await fresh();
  const r=await ev(async()=>{const c=mk(1200,800),g=cx(c);const gr=g.createLinearGradient(0,0,1200,800);gr.addColorStop(0,'#c0392b');gr.addColorStop(1,'#2e86de');g.fillStyle=gr;g.fillRect(0,0,1200,800);for(let i=0;i<400;i++){g.fillStyle=`hsl(${i*7},70%,${30+i%40}%)`;g.fillRect((i*37)%1180,(i*53)%780,18,14)}
    const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));const f=new File([b],'essai.jpg',{type:'image/jpeg'});
    await importToLibrary([f]);const d=S.doc,pid=d.pid;const m=await IDB.get('projects',pid);const t=m.layers[0].canvas,blob=await IDB.get('blobs',t[0].key);
    const ref=rx(d.layers[0].canvas).getImageData(0,0,1200,800).data;S.doc=null;await openLocalProject(pid);const L=S.doc.layers[0],cv=L.canvas;const got=rx(cv).getImageData(0,0,1200,800).data;let diff=0;for(let i=0;i<ref.length;i++)diff=Math.max(diff,Math.abs(ref[i]-got[i]));
    return [d.name,t.length,blob&&blob.type,!LIB.open,diff].join('|')});
  if(r!=='essai.jpg|1|image/jpeg|true|0')throw new Error(r)});
await test('photothèque : le double-clic ouvre la photo même si la grille se redessine entre les deux clics',async()=>{
  await ev(()=>openLibrary());await page.waitForSelector('.lb-card');const id=await page.$eval('.lb-card',e=>e.dataset.id);
  await ev(()=>{S.doc=null});const box=await page.locator(`.lb-card[data-id="${id}"]`).boundingBox();const x=box.x+box.width/2,y=box.y+box.height/3;
  await page.mouse.click(x,y);await ev(()=>{LIB._press=0;renderLibrary()});await page.mouse.click(x,y);
  await page.waitForFunction(id=>S.doc&&S.doc.pid===id&&!LIB.open,id,{timeout:15000})});
await test('accueil et photothèque refaits : grande dernière photo, Commencer, Importer, dépôt plein écran, tablette',async()=>{await fresh();
  await ev(async()=>{for(let i=0;i<3;i++){const c=mk(900,600),g=cx(c);g.fillStyle=`hsl(${i*120},60%,50%)`;g.fillRect(0,0,900,600);g.fillStyle='#fff';g.fillRect(100+i*200,100,150,300);const b=await new Promise(r=>c.toBlob(r,'image/jpeg',.9));await importToLibrary([new File([b],'h'+i+'.jpg',{type:'image/jpeg'})])}});
  await ev(()=>{if(LIB.open)closeLibrary();closeDoc()});await page.waitForTimeout(600);
  const h=await ev(()=>{const g=document.querySelector('.hm-grid'),cards=[...document.querySelectorAll('#wGrid .w-card')],b0=cards[0]&&cards[0].getBoundingClientRect(),b1=cards[1]&&cards[1].getBoundingClientRect();
    return {grid:!!g,side:!!document.querySelector('.hm-side #wTiles'),n:cards.length,big:b0&&b1&&b0.width>b1.width*1.8,h2:document.querySelector('#empty .w-head h2').textContent}});
  await ev(()=>{const dt=new DataTransfer();dt.items.add(new File(['x'],'a.jpg',{type:'image/jpeg'}));window.dispatchEvent(new DragEvent('dragenter',{dataTransfer:dt}))});
  const drop=await ev(()=>document.getElementById('hmDrop').classList.contains('on'));await ev(()=>window.dispatchEvent(new DragEvent('drop')));
  await page.setViewportSize({width:900,height:900});await page.waitForTimeout(300);const tw=await ev(()=>document.querySelector('#empty').getBoundingClientRect().width);await page.setViewportSize({width:1440,height:900});
  await ev(()=>openLibrary());await page.waitForSelector('#library .lb-impbtn');const l=await ev(()=>({imp:!!document.querySelector('.lb-top .lb-impbtn'),tri:!!document.querySelector('.lb-top [data-triage]'),filTri:getComputedStyle(document.querySelector('#lbFil [data-triage]')||document.body).display}));
  await page.click('.lb-top .lb-impbtn');const menu=await ev(()=>[...document.querySelectorAll('.menu button, [role=menuitem]')].map(b=>b.textContent).join('|'));await page.keyboard.press('Escape');
  if(!(h.grid&&h.side&&h.n===3&&h.big&&/^Bon(jour|soir)/.test(h.h2)&&drop&&tw>800&&l.imp&&l.tri&&l.filTri==='none'&&/dossier/.test(menu)))throw new Error(JSON.stringify({h,drop,tw,l,menu}))});
await test('connexion : vrai formulaire reconnu par les gestionnaires de mots de passe (1Password…)',async()=>{
  await ev(()=>{closeDialog();if(SY.cfg)return syLogout()});await ev(()=>syAccountDialog());await page.waitForSelector('#syForm');
  const a=await ev(()=>{const f=document.querySelector('#syForm'),u=f.querySelector('input[name=email]'),p=f.querySelector('input[name=password]');return [f.tagName,u.type,u.autocomplete,p.type,p.autocomplete,!!f.querySelector('[type=submit]'),f.querySelector('#syUrl')?f.querySelector('#syUrl').hasAttribute('data-1p-ignore'):true].join('|')});
  if(a!=='FORM|email|username|password|current-password|true|true')throw new Error(a);
  await page.click('.sy-mode [data-m=signup]');const b=await ev(()=>document.querySelector('#syPw').autocomplete+'|'+document.querySelector('.foot .btn.primary').textContent);if(b!=='new-password|Créer le compte')throw new Error(b);
  await page.fill('#syEmail','essai-1p@example.com');await page.fill('#syPw','un-mot-de-passe');await page.press('#syPw','Enter');
  await page.waitForFunction(()=>SY.cfg&&!document.querySelector('#syForm'),null,{timeout:15000});await ev(()=>syLogout())});
await test('effets modifiables : filtre sur une sélection, liste dans Calques, œil, modifier, réouverture, peindre fusionne',async()=>{await fresh();await sample();
  await ev(()=>{setTool('marquee');switchTab('layers')});await drag(.3,.3,.6,.6);
  await ev(()=>filterDialog('blur'));await page.waitForSelector('#scrim');await page.click('#scrim button.primary');await page.waitForTimeout(200);
  const r1=await ev(()=>{const L=S.doc.layers.find(l=>l.filters),w=L.canvas.width,h=L.canvas.height,at=(c,x,y)=>[...c.getContext('2d').getImageData(w*x|0,h*y|0,1,1).data].join();
    return{ok:PrismEffects.valid(L)&&!!L.filters[0].m,rows:document.querySelectorAll('#pane-layers li.lfx .lfx-r').length,out:at(L.canvas,.1,.1)===at(L.fbase,.1,.1),inn:at(L.canvas,.45,.45)!==at(L.fbase,.45,.45)}});
  await page.click('#pane-layers [data-fxt]');await page.waitForTimeout(300);
  const r2=await ev(()=>{const L=S.doc.layers.find(l=>l.filters);return L.filters[0].off===true&&L.canvas===L.fout&&!!document.querySelector('#pane-layers .lfx-r.off')});
  await page.click('#pane-layers [data-fxt]');await page.waitForTimeout(300);
  await page.click('#pane-layers [data-fxe]');await page.waitForSelector('#scrim input[type=range]');
  await ev(()=>{const i=document.querySelector('#scrim input[type=range]');i.value=i.max;i.dispatchEvent(new Event('input',{bubbles:true}))});await page.click('#scrim button.primary');await page.waitForTimeout(300);
  const r3=await ev(async()=>{const L0=S.doc.layers.find(l=>l.filters),edited=!L0.filters[0].off&&L0.filters[0].p.r>50;const before=L0.canvas.getContext('2d').getImageData(0,0,S.doc.w,S.doc.h).data;
    S.doc.nosave=false;S.doc.saved=false;while(SAVE.running)await new Promise(r=>setTimeout(r,50));await saveNow();await openLocalProject(S.doc.pid);await new Promise(r=>setTimeout(r,300));
    const L=S.doc.layers.find(l=>l.filters);if(!L)return 'perdu à la réouverture';const str=typeof L.filters[0].m==='string';
    await PrismEffects.setList(L,L.filters.map(f=>({...f,off:true})),'a');await PrismEffects.setList(L,L.filters.map(f=>({...f,off:false})),'b');
    const after=L.canvas.getContext('2d').getImageData(0,0,S.doc.w,S.doc.h).data;let diff=0;for(let i=0;i<after.length;i+=97)diff=Math.max(diff,Math.abs(after[i]-before[i]));return edited&&str&&diff<=1});
  await ev(()=>{S.doc.sel=null;selChanged();setTool('brush');S.color='#ff0000'});await drag(.1,.8,.2,.85);await page.waitForTimeout(300);
  const r4=await ev(()=>!S.doc.layers.some(l=>l.filters)&&!document.querySelector('#pane-layers li.lfx'));
  await ev(()=>undo());await page.waitForTimeout(200);const r5=await ev(()=>S.doc.layers.some(l=>PrismEffects.valid(l)));
  if(!(r1.ok&&r1.rows===1&&r1.out&&r1.inn&&r2&&r3===true&&r4&&r5))throw new Error(JSON.stringify({r1,r2,r3,r4,r5}))});
await test('signaler un problème : Aide, rapport avec version et journal d’erreurs, ticket GitHub court',async()=>{
  await ev(()=>{console.warn('essai de journal');const sc=document.createElement('script');sc.textContent="setTimeout(function(){throw new Error('erreur volontaire')},0)";document.head.appendChild(sc);sc.remove()});await page.waitForTimeout(150);errs.length=0;await page.waitForTimeout(100);
  const r=await ev(()=>{const it=MENU2.help.items().some(x=>x&&x.label==='Signaler un problème…');PrismReport.dialog();const o=document.querySelector('#rpOut').value,u=PrismReport.issueUrl('Test',true);closeDialog();
    return{it,v:o.includes('Version : '+PRISM_VERSION),log:/erreur volontaire/.test(o)&&/essai de journal/.test(o),u:u.startsWith('https://github.com/Asmodeus-73/Prism/issues/new?')&&u.length<=7500}});
  if(!(r.it&&r.v&&r.log&&r.u))throw new Error(JSON.stringify(r)+'\n'+await ev(()=>ERRLOG.slice(-4).map(e=>e.k+' '+e.m).join('\n')))});
await test('effets modifiables : contraste local et visages (appliquer, œil, modifier, annuler)',async()=>{
  const idle=async()=>{await page.waitForFunction(()=>!document.querySelector('#busy:not([hidden])'),null,{timeout:120000});await page.waitForTimeout(300)};
  const primary=async()=>{await page.waitForSelector('#scrim button.primary',{timeout:60000});await page.waitForTimeout(300);await page.click('#scrim button.primary');await page.waitForTimeout(300)};
  const sum=()=>ev(()=>{const L=S.doc.layers.find(l=>l.filters),d=L.canvas.getContext('2d').getImageData(0,0,L.canvas.width,L.canvas.height).data;let s=0;for(let i=0;i<d.length;i+=31)s+=d[i];return s});
  for(const k of ['llap','faces']){await fresh();await sample();await ev(()=>{switchTab('layers');S.doc.active=S.doc.layers.findIndex(l=>l.kind==='pixel');syncAll()});
    await ev(k==='llap'?()=>PrismFilm.llap():()=>PrismDepth.faces());await idle();await page.waitForSelector('#scrim');
    if(k==='faces'){const b=await page.locator('#view').boundingBox();await page.mouse.click(b.x+b.width*.5,b.y+b.height*.5);await page.waitForTimeout(400)}
    await primary();await idle();
    const x=await ev(()=>{const L=S.doc.layers.find(l=>l.filters);return L&&L.filters[0].x});const s1=await sum();
    await page.click('#pane-layers [data-fxt]');await idle();const s0=await sum();await page.click('#pane-layers [data-fxt]');await idle();const s1b=await sum();
    await page.click('#pane-layers [data-fxe]');await idle();await page.waitForSelector('#scrim');await page.waitForTimeout(400);await page.click('#scrim button:text-is("Annuler")');await page.waitForTimeout(1500);await idle();const sc=await sum();
    await page.click('#pane-layers [data-fxe]');await idle();await page.waitForSelector('#scrim');await page.waitForTimeout(400);
    await ev(()=>{const i=[...document.querySelectorAll('#scrim input[type=range]')].pop();i.value=String(+i.min+(+i.max-+i.min)*.3);i.dispatchEvent(new Event('input',{bubbles:true}))});await page.waitForTimeout(500);await primary();await idle();await page.waitForTimeout(500);
    const s2=await sum(),n=await ev(()=>{const L=S.doc.layers.find(l=>l.filters);return L&&PrismEffects.valid(L)?L.filters.length:0});
    if(x!==k||s0===s1||s1b!==s1||sc!==s1||s2===s1||n!==1)throw new Error(JSON.stringify({k,x,s0,s1,s1b,sc,s2,n}))}});
await test('visite : proposée à la première photo importée, jamais sur la photo d’exemple, pas de photo d’exemple pour la lancer',async()=>{await fresh();
  const r=await ev(async()=>{PREF.set('tourDone',0);Object.defineProperty(navigator,'webdriver',{get:()=>false,configurable:true});const c=document.createElement('canvas');c.width=c.height=64;
    setDoc(c,'a.jpg',{sample:true});await new Promise(r=>setTimeout(r,1800));const s=!!document.querySelector('#scrim');
    closeDoc();setDoc(c,'b.jpg',{});await new Promise(r=>setTimeout(r,1800));const t=!!document.querySelector('#scrim')&&/Visite|visite/.test(document.querySelector('#scrim').textContent);
    [...document.querySelectorAll('#scrim button')].find(b=>/Plus tard/.test(b.textContent)).click();await new Promise(r=>setTimeout(r,300));closeDoc();await new Promise(r=>setTimeout(r,600));PrismTour.start();await new Promise(r=>setTimeout(r,300));return{s,t,noTour:!PrismTour.on,noDoc:!S.doc}});
  if(r.s||!r.t||!r.noTour||!r.noDoc)throw new Error(JSON.stringify(r))});
await test('trait : tous les points d’un même mouvement du navigateur sont tracés ; Ctrl+4 (AZERTY) n’allume pas la grille',async()=>{await fresh();await sample();
  const r=await ev(async()=>{setTool('brush');Object.assign(S.opts.brush,{size:20,hardness:1,opacity:1,flow:1,smooth:0,scatter:0,grain:0,pressSize:false});S.color='#ff0000';S.doc.active=0;
    const v=document.getElementById('view'),b=v.getBoundingClientRect(),X=b.x+b.width*.3,Y=b.y+b.height*.5,mk=(t,x,y,o={})=>{const e=new PointerEvent(t,{clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:1,bubbles:true,...o});return e};
    v.dispatchEvent(mk('pointerdown',X,Y));const last=mk('pointermove',X+160,Y);last.getCoalescedEvents=()=>[40,80,120,160].map(d=>mk('pointermove',X+d,Y));v.dispatchEvent(last);
    const L=S.doc.layers[0],st=S.stroke,sc=st?st.canvas:null,p=toDoc(X+80-b.x,Y-b.y);let hit=0;if(sc){hit=sc.getContext('2d').getImageData(Math.round(p.x),Math.round(p.y),1,1).data[3]}
    v.dispatchEvent(mk('pointerup',X+160,Y,{buttons:0}));
    const g0=PrismGuides.st.grid;document.dispatchEvent(new KeyboardEvent('keydown',{key:"'",code:'Digit4',ctrlKey:true,bubbles:true}));const g1=PrismGuides.st.grid;
    document.dispatchEvent(new KeyboardEvent('keydown',{key:"'",code:'Quote',ctrlKey:true,bubbles:true}));const g2=PrismGuides.st.grid;document.dispatchEvent(new KeyboardEvent('keydown',{key:"'",code:'Quote',ctrlKey:true,bubbles:true}));
    return{hit,g0,g1,g2}});
  if(!(r.hit>200&&r.g1===r.g0&&r.g2!==r.g0))throw new Error(JSON.stringify(r))});
await test('aperçu rapide : pas de liseré à damier sur les bords de la photo',async()=>{await fresh();await sample();
  const r=await ev(()=>{const edge=()=>{const w=work,d=w.getContext('2d').getImageData(0,0,w.width,w.height).data,W=w.width,H=w.height;let n=0;for(let y=2;y<H-2;y++)if(d[(y*W+W-1)*4+3]<250)n++;for(let x=2;x<W-2;x++)if(d[((H-1)*W+x)*4+3]<250)n++;return n},bad=[];
    for(const z of [0.31,0.337,0.5]){const at=k=>{S.fitted=false;S.zoom=z;S.panX=100.4;S.panY=60.7;S.sliding=k<1;S.slideEl=null;LQ.full=k<1?250:0;LQ.lock=k<1?k:0;markContent();render();return edge()};const base=at(1);
      for(const k of [.5,.6,.7]){const n=at(k);if(n>base+2)bad.push([z,k,n,base])}}
    S.sliding=false;LQ.lock=0;return bad});
  if(r.length)throw new Error(JSON.stringify(r))});
await test('trait sur une grosse photo : l’aperçu en cours de trait montre le trait et seulement lui (pyramide mise à jour par zones)',async()=>{await fresh();
  const r=await ev(async()=>{const c=document.createElement('canvas');c.width=3000;c.height=2200;const g=c.getContext('2d');g.fillStyle='#808080';g.fillRect(0,0,3000,2200);setDoc(c,'g.jpg',{});await new Promise(r=>setTimeout(r,600));
    S.doc.active=0;setTool('brush');Object.assign(S.opts.brush,{size:80,hardness:1,opacity:1,flow:1,smooth:0,scatter:0,grain:0,pressSize:false});S.color='#ff0000';S.fitted=false;S.zoom=0.2;S.panX=40;S.panY=40;markContent();render();
    const px=(x,y)=>{const w=work,d=w.getContext('2d').getImageData(Math.round(S.panX+x*S.zoom*S.pr-S.workPos.x),Math.round(S.panY+y*S.zoom*S.pr-S.workPos.y),1,1).data;return[d[0],d[1],d[2]]};
    beginStroke({x:400,y:500});render();const grey0=px(2000,1500);
    for(let k=1;k<=30;k++){moveStroke({x:400+k*50,y:500+Math.sin(k/4)*120});render()}
    const red=px(400+15*50,500+Math.sin(15/4)*120),far=px(2000,1500),before=grey0;await endStroke();render();const after=px(400+15*50,500+Math.sin(15/4)*120);
    return{red,far,before,after}});
  const ok=r.red[0]>200&&r.red[1]<60&&Math.abs(r.far[0]-128)<6&&Math.abs(r.after[0]-r.red[0])<12;if(!ok)throw new Error(JSON.stringify(r))});
await test('dézoom rapide : la partie qui n’était pas affichée montre la photo, pas le damier',async()=>{await fresh();
  const r=await ev(async()=>{const W=4000,H=3000,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');g.fillStyle='#2a6';g.fillRect(0,0,W,H);setDoc(c,'v.png',{});const w=ms=>new Promise(r=>setTimeout(r,ms));await w(600);
    fit();render();await w(1000);zoomAt(S.zoom*6,S.vw/2,S.vh/2);render();await w(100);S.contentMs=50;S.zoomRedraw=performance.now();zoomAt(S.zoom/2,S.vw/2,S.vh/2);zoomAt(S.zoom/2,S.vw/2,S.vh/2);render();
    const x=Math.max(S.panX+5,5),y=S.vh/2,d=vctx.getImageData(Math.round(x*S.pr),Math.round(y*S.pr),1,1).data;return{fast:S.workZ!==1,px:[d[0],d[1],d[2]]}});
  if(!r.fast||!(r.px[1]>130&&r.px[0]<120))throw new Error(JSON.stringify(r))});
await test('Calque > Styles de calque ouvre sa fenêtre ; un nettoyage de franges sans masque le dit sans erreur',async()=>{await fresh();await sample();
  const r=await ev(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));const errs=[];const ce=console.error;console.error=(...a)=>{errs.push(String(a[0]&&a[0].message||a[0]));ce.apply(console,a)};
    S.doc.active=S.doc.layers.findIndex(l=>l.kind==='pixel');const find=(a,l)=>a.find(x=>x&&x.label===l);const it=find(MENU2.layer.items(),'Styles de calque…');it.fn();await w(200);const t1=($('#scrim h2,#scrim .dlg-title,#scrim')||{}).textContent||'';closeDialog();
    const m=find(MENU2.layer.items(),'Masque');const fr=find(typeof m.sub==='function'?m.sub():m.sub,'Nettoyer les franges de couleur…');fr.fn();await w(900);const open=!!$('#scrim');closeDialog();console.error=ce;
    return{styles:/Ombre|Contour|Lueur|Style/i.test(t1),open,errs}});
  if(!r.styles||r.open||r.errs.length)throw new Error(JSON.stringify(r))});
console.log(results.map(r=>`${r[1]==='ok'?'✓':'✗'} ${r[0]} (${r[2]} ms)${r[3]?'\n    '+r[3].replace(/\n/g,'\n    '):''}`).join('\n'));
await browser.close();server.close();
const failed=results.filter(r=>r[1]!=='ok').length;console.log(failed?`${failed} échec(s) sur ${results.length}`:`${results.length} tests réussis`);process.exit(failed?1:0);
