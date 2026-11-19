// Builds web/index.html from the sources in web-src/:
//   app/page.html   the page, with @@CSS@@ where the style sheet goes and @@JSV@@ in the address of app.js
//                   (the script is a file of its own, so the page's CSP needs no 'unsafe-inline' for scripts)
//   app/css/*.css   the style sheet, joined in file-name order
//   app/js/*.js     the editor, joined in file-name order into one classic script (they share its scope)
//   feat/*.js       features loaded last, each in its own { } block, in file-name order
//   The style sheet and the script are minified by esbuild (whitespace and syntax only: names are kept, so error
//   reports stay readable).
// Output: web/index.html, web/app.js and web/sw.js (from sw.js).
// Usage: node web-src/build.mjs [--check]   (--check: fail if web/index.html or web/app.js is not up to date; needs the esbuild dev dependency)
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import os from 'node:os';import {createHash} from 'node:crypto';
const esbuild=await import('esbuild');
const here=path.dirname(new URL(import.meta.url).pathname),root=path.join(here,'..');
const list=d=>fs.readdirSync(path.join(here,d)).filter(f=>/\.(css|js)$/.test(f)).sort().map(f=>path.join(here,d,f));
const read=f=>fs.readFileSync(f,'utf8');
const pkg=JSON.parse(read(path.join(root,'package.json'))),version=pkg.displayVersion||pkg.version,codename=pkg.codename||'';
const css=list('app/css').map(read).join(''),js=list('app/js').map(read).join('');
const feats=list('feat');
const head='window.PRISM_VERSION='+JSON.stringify(version)+';window.PRISM_CODENAME='+JSON.stringify(codename)+';\n',add='\n'+feats.map(f=>`\n/* ===== feat: feat/${path.basename(f)} ===== */\n{\n${read(f)}\n}\n`).join('');
const page=read(path.join(here,'app/page.html'));
if(page.split('@@CSS@@').length!==2||page.split('@@JSV@@').length!==2)throw new Error('page.html: @@CSS@@ and @@JSV@@ must appear once each');
const min=(code,loader)=>{try{return esbuild.transformSync(code,{loader,minifyWhitespace:true,minifySyntax:true,charset:'utf8'}).code.trimEnd()}catch(e){console.error('SYNTAX_FAIL',e.message);process.exit(1)}};
const script=min(head+js+add,'js')+'\n';
// the page asks for app.js?v=<hash of the script>: a new version is never served from an old cache
const jsv=createHash('sha256').update(script).digest('hex').slice(0,12);
const out=page.replace('@@CSS@@',()=>min(css,'css')).replace('@@JSV@@',()=>jsv);
// syntax check of the whole script, as the browser will see it
const tmp=path.join(os.tmpdir(),`prism-check-${process.pid}.js`);fs.writeFileSync(tmp,script);
const r=spawnSync(process.execPath,['--check',tmp],{stdio:'inherit'});fs.rmSync(tmp);if(r.status!==0){console.error('SYNTAX_FAIL');process.exit(1)}
// web/sw.js: the online version's service worker, with this build's version and the SHA-256 of each AI model file
// (the same files the desktop app fetches on demand, scripts/prepare.mjs)
const models={};const aiDir=path.join(root,'web','ai');
for(const d of fs.readdirSync(aiDir).sort()){const full=path.join(aiDir,d);if(!fs.statSync(full).isDirectory())continue;
  for(const f of fs.readdirSync(full).sort())if(f.endsWith('.wasm'))models[`ai/${d}/${f}`]=createHash('sha256').update(fs.readFileSync(path.join(full,f))).digest('hex')}
const sw=read(path.join(here,'sw.js')).replace('@@VERSION@@',()=>version+'-'+createHash('sha256').update(out).update(script).digest('hex').slice(0,12)).replace('@@MODELS@@',()=>JSON.stringify(models));
const dest=path.join(root,'web','index.html'),destJs=path.join(root,'web','app.js'),destSw=path.join(root,'web','sw.js');
if(process.argv.includes('--check')){for(const [f,c] of [[dest,out],[destJs,script],[destSw,sw]])if(!fs.existsSync(f)||read(f)!==c){console.error(path.relative(root,f)+' is out of date: run node web-src/build.mjs');process.exit(1)}console.log('web/index.html, web/app.js and web/sw.js are up to date');}
else{fs.writeFileSync(dest,out);fs.writeFileSync(destJs,script);fs.writeFileSync(destSw,sw);console.log('built',Buffer.byteLength(out),'+',Buffer.byteLength(script),'bytes,',list('app/js').length,'scripts,',feats.length,'features');}
console.log('SYNTAX_OK');
