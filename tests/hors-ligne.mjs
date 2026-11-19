// Online version: the service worker (web-src/sw.js) makes the page cross-origin isolated
// (the AI then gets several threads), keeps it working offline and keeps AI models under their hash.
// Run: node tests/hors-ligne.mjs      (PRISM_BROWSER=webkit for WebKit)
// The page is served without any COOP/COEP header, like GitHub Pages.
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const root=path.join(path.dirname(new URL(import.meta.url).pathname),'..','web');
const require=createRequire(import.meta.url);
let pw;try{pw=require('playwright')}catch(e){pw=require(process.env.PLAYWRIGHT_MODULE||'/opt/node22/lib/node_modules/playwright')}
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
// served under /app/, as on the site
const server=http.createServer((q,r)=>{const u=decodeURIComponent(new URL(q.url,'http://x').pathname).replace(/^\/app/,''),f=path.join(root,u==='/'?'index.html':u);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end();return}
  r.writeHead(200,{'content-type':TYPES[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const BASE=`http://localhost:${server.address().port}/app/?sw=1`;
const browser=await pw[process.env.PRISM_BROWSER||'chromium'].launch();
const ctx=await browser.newContext();let page=await ctx.newPage();
const errs=[];page.on('pageerror',e=>errs.push(e.message));
let fails=0;const check=(ok,name,info='')=>{console.log((ok?'✓ ':'✗ ')+name+(ok?'':'  '+info));if(!ok)fails++};

await page.goto(BASE);
const iso=await page.waitForFunction(()=>self.crossOriginIsolated===true,null,{timeout:20000}).then(()=>true,()=>false);
check(iso,'page isolée après un rechargement (en-têtes COOP/COEP ajoutés par le service worker)');
await page.waitForFunction(()=>typeof loadSample==='function');
check(await page.evaluate(()=>ORTX.threads()>1||navigator.hardwareConcurrency<3),'IA sur plusieurs fils');
check(await page.evaluate(async()=>{await document.fonts.ready;return document.fonts.check('16px Geist')}),'police Geist servie par Prism, pas par Google');
const hash=await page.evaluate(async()=>{await (await fetch('ai/migan/0.wasm')).arrayBuffer();const k=await (await caches.open('prism-models')).keys();return k.map(r=>r.url.split('/').pop())});
const want=await page.evaluate(async()=>{const t=await (await fetch('sw.js')).text();return JSON.parse(/MODEL_HASH = (\{.*?\});/.exec(t)[1])['ai/migan/0.wasm']});
check(hash.includes(want),'modèle gardé sous son empreinte',JSON.stringify(hash));
await page.evaluate(()=>loadSample());await page.waitForFunction(()=>S.doc&&S.doc.layers.some(l=>l.kind==='pixel'));
// the AI eraser runs with several threads (SharedArrayBuffer) and still erases
const er=await page.evaluate(async()=>{const L=S.doc.layers.find(l=>l.kind==='pixel'),W=L.canvas.width,H=L.canvas.height;
  const m=document.createElement('canvas');m.width=W;m.height=H;const g=m.getContext('2d');g.fillStyle='#fff';g.fillRect(W*0.4,H*0.4,W*0.06,H*0.06);
  const bx={x0:Math.floor(W*0.4),y0:Math.floor(H*0.4),x1:Math.ceil(W*0.46),y1:Math.ceil(H*0.46)};
  const b0=L.canvas.getContext('2d').getImageData(0,0,W,H).data.slice(0);S.opts.remove.method='aifast';await removeObject(L,m,bx);
  const a=L.canvas.getContext('2d').getImageData(0,0,W,H).data;let ch=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b0[i])ch++;return{ch,dir:LM.dir,sab:typeof SharedArrayBuffer}}).catch(e=>({err:String(e)}));
check(er.ch>100&&er.dir==='migan'&&er.sab==='function','gomme IA rapide (MI-GAN) sur plusieurs fils',JSON.stringify(er));
await ctx.setOffline(true);
// a fresh tab rather than a reload: WebKit can crash while tearing down the AI threads of the old page
{const p2=await ctx.newPage();p2.on('pageerror',e=>errs.push(e.message));await page.close();page=p2;await page.goto(BASE);}
const off=await page.waitForFunction(()=>typeof loadSample==='function',null,{timeout:15000}).then(()=>true,()=>false);
check(off,'hors ligne : la page et son script se chargent');
check(await page.evaluate(()=>self.crossOriginIsolated),'hors ligne : toujours isolée');
const r=await page.evaluate(()=>fetch('ai/migan/0.wasm').then(r=>r.ok,()=>false));
check(r,'hors ligne : le modèle vient du cache');
check(!errs.length,'aucune erreur dans la page',errs.slice(0,3).join(' | '));
await browser.close();server.close();
console.log(fails?`${fails} échec(s)`:'tests hors ligne réussis');process.exit(fails?1:0);
