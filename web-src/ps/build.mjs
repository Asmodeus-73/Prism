// Builds web/ps/ps.js (Photo Studio's imaging algorithms + entry.ts) and web/ps/worker.js.
// Usage: node web-src/ps/build.mjs [--check]   (needs the esbuild dev dependency)
import fs from 'node:fs';import path from 'node:path';
const here=path.dirname(new URL(import.meta.url).pathname),root=path.join(here,'..','..'),dest=path.join(root,'web','ps');
const esbuild=await import('esbuild');
const r=await esbuild.build({entryPoints:[path.join(here,'entry.ts')],bundle:true,format:'iife',target:'es2020',minify:true,legalComments:'none',write:false,
  banner:{js:'/* Prism: algorithms from Photo Studio, Copyright (c) 2026 HeyPuter, MIT License (web-src/ps/LICENSE-photo-studio) */'}});
const files={'ps.js':r.outputFiles[0].text,
  'worker.js':"/* Prism: runs web/ps/ps.js in a worker (calculs longs hors de l'interface) */\nimportScripts('ps.js');\n",
  'LICENSE-photo-studio.txt':fs.readFileSync(path.join(here,'LICENSE-photo-studio'),'utf8')};
if(process.argv.includes('--check')){for(const[f,t]of Object.entries(files)){const p=path.join(dest,f);if(!fs.existsSync(p)||fs.readFileSync(p,'utf8')!==t){console.error('web/ps/'+f+' is out of date: run node web-src/ps/build.mjs');process.exit(1)}}console.log('web/ps is up to date')}
else{fs.mkdirSync(dest,{recursive:true});for(const[f,t]of Object.entries(files))fs.writeFileSync(path.join(dest,f),t);console.log('built web/ps/ps.js',Buffer.byteLength(files['ps.js']),'bytes')}
