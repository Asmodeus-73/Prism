// Prism : la version Rust (web/px/prism_px.wasm) de la réduction du bruit donne le même résultat que la version JS,
// tuile par tuile, et le temps de chacune est affiché. Sans navigateur : le noyau de web-src/feat/denoise.js tourne dans Node.
// Run: node tests/pixels.mjs            (photo de 3000 x 2000)
//      PRISM_MPX=24 node tests/pixels.mjs  (vraie taille, 24 Mpx)
import fs from 'node:fs';import path from 'node:path';
const root=path.join(path.dirname(new URL(import.meta.url).pathname),'..');
const src=fs.readFileSync(path.join(root,'web-src/feat/denoise.js'),'utf8');
const core=src.slice(src.indexOf('/*CORE_BEGIN*/'),src.indexOf('/*CORE_END*/'));
const {dnPlan,dnTile,dnRegion,pxTile}=new Function(core+';return {dnPlan,dnTile,dnRegion,pxTile}')();
const X=(await WebAssembly.instantiate(fs.readFileSync(path.join(root,'web/px/prism_px.wasm')),{})).instance;
if(X.exports.px_version()!==1)throw new Error('version du module');

/* photo de test : dégradés, bords nets, texture fine, bruit de capteur (luma et couleur), un peu de transparence */
function photo(W,H,seed){const d=new Uint8ClampedArray(W*H*4);let s=seed>>>0;const rnd=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296};
  const gauss=()=>{let a=0;for(let i=0;i<4;i++)a+=rnd();return (a-2)*1.73};
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const q=(y*W+x)*4,edge=((x/97|0)+(y/61|0))&1,tex=Math.sin(x*0.9)*Math.cos(y*0.7)*12,n=gauss()*14;
    d[q]=40+150*x/W+(edge?40:0)+tex+n+gauss()*8;d[q+1]=60+120*y/H+tex+n;d[q+2]=180-120*x/W+(edge?-30:20)+n+gauss()*8;d[q+3]=(x<8&&y<8)?128:255}
  return {data:d,w:W,h:H}}
const getReg=im=>(x,y,w,h)=>{const o=new Uint8ClampedArray(w*h*4);for(let j=0;j<h;j++)o.set(im.data.subarray(((y+j)*im.w+x)*4,((y+j)*im.w+x+w)*4),j*w*4);return {data:o,w,h}};

const mpx=+(process.env.PRISM_MPX||0);
const cases=[
  {name:'réglages par défaut',W:mpx?6000:3000,H:mpx?4000:2000,p:{}},
  {name:'tout au maximum',W:1500,H:1000,p:{a:100,c:100,d:100,e:100}},
  {name:'luminance seule',W:1203,H:801,p:{a:80,c:0,d:0}},
  {name:'couleur seule',W:999,H:777,p:{a:0,c:60}},
  {name:'petites tuiles, taille impaire',W:517,H:389,p:{a:30,c:20,d:60,e:0},tile:128},
  {name:'image minuscule',W:7,H:5,p:{}},
];
let fails=0,tJS=0,tRS=0;
for(const k of cases){const im=photo(k.W,k.H,k.W*31+k.H),reg=getReg(im),pl=dnPlan(k.W,k.H,k.p,reg,k.tile);
  let diff=0,maxd=0,ms0=0,ms1=0;
  for(const c of pl.tiles){const r=dnRegion(pl.P,c),rd=reg(r.x,r.y,r.w,r.h),job={P:pl.P,core:c,reg:{x:r.x,y:r.y,w:r.w,h:r.h,data:rd.data}};
    let t=performance.now();const a=dnTile(job);ms0+=performance.now()-t;
    t=performance.now();const b=pxTile(X,job);ms1+=performance.now()-t;
    for(let i=0;i<a.out.length;i++){const e=Math.abs(a.out[i]-b.out[i]);if(e){diff++;if(e>maxd)maxd=e}}}
  tJS+=ms0;tRS+=ms1;
  /* le même calcul dans le même ordre : au plus une valeur sur un million différente, et d'un seul niveau */
  const n=k.W*k.H*4,ok=maxd<=1&&diff<=Math.max(2,n*1e-6);if(!ok)fails++;
  console.log(`${ok?'✓':'✗'} ${k.name} (${k.W}×${k.H}) : JS ${Math.round(ms0)} ms, Rust ${Math.round(ms1)} ms (×${(ms0/Math.max(1,ms1)).toFixed(1)}) · valeurs différentes : ${diff}${diff?` (écart max ${maxd})`:''}`)}
console.log(`total : JS ${Math.round(tJS)} ms, Rust ${Math.round(tRS)} ms, soit ${(tJS/tRS).toFixed(1)} fois plus rapide`);
console.log(fails?`${fails} échec(s)`:'mêmes résultats');process.exit(fails?1:0);
