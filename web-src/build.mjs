// Builds web/index.html from the sources in web-src/:
//   app/page.html   the page, with @@CSS@@ and @@JS@@ where the style sheet and the script go
//   app/css/*.css   the style sheet, joined in file-name order
//   app/js/*.js     the editor, joined in file-name order into one classic script (they share its scope)
//   feat/*.js       features loaded last, each in its own { } block, in file-name order
// Usage: node web-src/build.mjs [--check]   (--check: fail if web/index.html is not up to date)
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import os from 'node:os';
const here=path.dirname(new URL(import.meta.url).pathname),root=path.join(here,'..');
const list=d=>fs.readdirSync(path.join(here,d)).filter(f=>/\.(css|js)$/.test(f)).sort().map(f=>path.join(here,d,f));
const read=f=>fs.readFileSync(f,'utf8');
const version=JSON.parse(read(path.join(root,'package.json'))).version;
const css=list('app/css').map(read).join(''),js=list('app/js').map(read).join('');
const feats=list('feat');
const add='\nwindow.PRISM_VERSION='+JSON.stringify(version)+';\n'+feats.map(f=>`\n/* ===== feat: feat/${path.basename(f)} ===== */\n{\n${read(f)}\n}\n`).join('');
const page=read(path.join(here,'app/page.html'));
if(page.split('@@CSS@@').length!==2||page.split('@@JS@@').length!==2)throw new Error('page.html: @@CSS@@ and @@JS@@ must appear once each');
const out=page.replace('@@CSS@@',()=>css).replace('@@JS@@',()=>js+add);
// syntax check of the whole script, as the browser will see it
const tmp=path.join(os.tmpdir(),`prism-check-${process.pid}.js`);fs.writeFileSync(tmp,js+add);
const r=spawnSync(process.execPath,['--check',tmp],{stdio:'inherit'});fs.rmSync(tmp);if(r.status!==0){console.error('SYNTAX_FAIL');process.exit(1)}
const dest=path.join(root,'web','index.html');
if(process.argv.includes('--check')){if(!fs.existsSync(dest)||read(dest)!==out){console.error('web/index.html is out of date: run node web-src/build.mjs');process.exit(1)}console.log('web/index.html is up to date');}
else{fs.writeFileSync(dest,out);console.log('built',Buffer.byteLength(out),'bytes,',list('app/js').length,'scripts,',feats.length,'features');}
console.log('SYNTAX_OK');
