/* ===== App de bureau : fichiers projet .prism sur le disque (src-tauri/src/project.rs).
   Fichier > Enregistrer dans un fichier… lie la photo à un fichier .prism (le zip de « Exporter le projet ») ;
   ensuite Cmd/Ctrl+S le réécrit en plus de la photothèque. Un .prism ouvert depuis le Finder ou l'Explorateur
   (double-clic, Ouvrir avec) s'ouvre dans Prism. La page ne nomme jamais un chemin : l'app n'accepte que les
   fichiers choisis dans une fenêtre du système ou ouverts depuis lui. ===== */
(()=>{
const D=()=>window.PRISM_DESKTOP;
if(!window.__TAURI__)return;
const FILES=()=>PREF.get('files',{});
const fileOf=d=>d&&d.pid&&FILES()[d.pid]||null;
const link=(pid,path)=>{const f={...FILES()};if(path)f[pid]=path;else delete f[pid];PREF.set('files',f)};
const base=p=>String(p).split(/[\\/]/).pop();
const bytes=async b=>new Uint8Array(await b.arrayBuffer());
async function writeTo(d,path){const z=await projectZip(d);await D().invoke('project_save',await bytes(z),{headers:{'x-path':encodeURIComponent(path)}})}
async function saveAs(){const d=S.doc;if(!d)return;busy(true,'Préparation du projet…',null);
  try{const z=await projectZip(d);busy(false);const name=(d.name||'Projet').replace(/\.[a-z0-9]+$/i,'').replace(/[\\/:*?"<>|]+/g,'-')+'.prism';
    const path=await D().invoke('project_save_as',await bytes(z),{headers:{'x-filename':encodeURIComponent(name)}});
    if(!path){toast('Enregistrement annulé');return}link(d.pid,path);toast('Projet enregistré : '+base(path))}
  catch(e){busy(false);console.error(e);toast('Enregistrement impossible : '+(e.message||e),5000)}}
// Cmd/Ctrl+S (saveNow(false)): the library as before, then the linked file
const _save=saveNow;
saveNow=async function(quiet=true){const d=S.doc,r=await _save.apply(this,arguments);const path=!quiet&&fileOf(d);
  if(path){try{await writeTo(d,path);toast('Projet enregistré : '+base(path))}catch(e){console.error(e);toast('Fichier non mis à jour : '+(e.message||e),5000)}}
  return r};
async function openPath(path){busy(true,'Ouverture du projet…',null);
  try{const b=await D().invoke('project_read',{path});const before=S.doc;await openBlob(new File([b],base(path)),false);
    if(S.doc&&S.doc!==before&&S.doc.pid)link(S.doc.pid,path)}
  catch(e){console.error(e);toast('Ouverture impossible : '+(e.message||e),5000)}finally{busy(false)}}
async function pickOpen(){try{const p=await D().invoke('project_open');if(p)await openPath(p)}catch(e){toast(String(e.message||e),5000)}}
let recent=[];const refresh=()=>D()&&D().invoke('project_recent').then(r=>{recent=r||[]},()=>{});
{const F=MENU2.file,_f=F.items;F.items=function(){const a=_f.apply(this,arguments);if(!D())return a;refresh();
  const i=a.findIndex(x=>x&&/^Exporter le projet/.test(x.label||''));const linked=fileOf(S.doc);
  const items=[MI(linked?'Enregistrer dans un autre fichier…':'Enregistrer dans un fichier…',{icon:'save',fn:saveAs,dis:S.doc?false:NODOC}),
    MI('Ouvrir un fichier projet…',{icon:'open',fn:pickOpen})];
  if(recent.length)items.push(MI('Fichiers projet récents',{icon:'history',sub:()=>recent.slice(0,10).map(p=>MI(base(p),{fn:()=>openPath(p)}))}));
  a.splice(i<0?a.length:i,0,...items);return a}}
// files opened from the system: at launch (waiting list) and while Prism is open (event)
const take=async()=>{try{for(const p of await D().invoke('project_pending'))await openPath(p)}catch(e){}};
const start=()=>{if(!D())return setTimeout(start,200);refresh();window.__TAURI__.event.listen('project-opened',()=>take());setTimeout(take,600)};
start();
window.PrismFiles={saveAs,openPath,fileOf};
})();
