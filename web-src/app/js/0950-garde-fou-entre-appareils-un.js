/* ===== wave48: garde-fou entre appareils. Un projet synchronisé ouvert sur un autre appareil est signalé avant de l'ouvrir ici ===== */
(()=>{
const TTL=150000,BEAT=60000,IDLE=10*60000;
const lockId=pid=>'open_'+pid;
const col=()=>Cloud.ok&&Cloud.col;
/* projects open here recently (several tabs can be open): pid -> last time it was the active document */
const active=new Map();
const mark=()=>{const d=S.doc;if(d&&d.pid&&d.sync&&!d.nosave)active.set(d.pid,Date.now())};
function release(pid){const c=col();if(!c)return;const r=c.doc(lockId(pid));r.get().then(s=>{if(s&&s.exists&&s.data().device===DEVICE)return r.delete()}).catch(()=>{})}
function beat(){mark();const c=col();if(!c)return;const now=Date.now();
  for(const [pid,t] of [...active]){if(now-t>IDLE||!(S.doc&&S.doc.pid===pid)&&!(window.PrismTabs&&PrismTabs.tabs.some(x=>x.doc&&x.doc.pid===pid))){active.delete(pid);release(pid);continue}
    c.doc(lockId(pid)).set({kind:'open',pid,device:DEVICE,deviceName:DEVNAME,at:now}).catch(()=>{})}}
setInterval(beat,BEAT);
addEventListener('pagehide',()=>{for(const pid of active.keys())release(pid)});
async function elsewhere(pid){const c=col();if(!c)return null;try{const s=await c.doc(lockId(pid)).get(),p=s&&s.exists?s.data():null;if(p&&p.device!==DEVICE&&Date.now()-(p.at||0)<TTL)return p}catch(e){}return null}
const ago=t=>{const m=Math.round((Date.now()-t)/60000);return m<1?'à l’instant':`il y a ${m} min`};
function ask(p){return new Promise(res=>{dialog({title:'Projet ouvert sur un autre appareil',
  body:`<p>Ce projet est ouvert sur <b>${esc(p.deviceName||'un autre appareil')}</b> (actif ${ago(p.at)}).</p><p class="muted">Si vous le modifiez des deux côtés, Prism garde les deux versions séparément, sans rien perdre. Pour l’éviter, ouvrez-le en lecture seule ou travaillez sur une copie.</p>`,
  buttons:[{label:'Annuler',onClick:()=>res('cancel')},{label:'Lecture seule',onClick:()=>res('ro')},{label:'Ouvrir quand même',onClick:()=>res('open')},{label:'Travailler sur une copie',primary:true,onClick:()=>res('copy')}]})})}
async function makeCopy(){const d=S.doc;if(!d)return;d.pid=uid8();d.name=d.name.replace(/ \(copie\)$/,'')+' (copie)';d.updatedAt=0;d.saved=false;d.nosave=false;d.readonly=false;updateDocName();await saveNow();toast(`Copie enregistrée : « ${d.name} »`,4000)}
function after(choice){const d=S.doc;if(!d)return;
  if(choice==='ro'){d.nosave=true;d.readonly=true;updateDocName();toastAction('Ouvert en lecture seule : vos changements ne seront pas enregistrés.','Travailler sur une copie',makeCopy)}
  else if(choice==='copy')makeCopy();
  else mark()}
let inGate=false;
const gated=fn=>async function(id,...a){
  /* the same project already open here (another device saved it, or a nested open): no question */
  if(inGate||(S.doc&&S.doc.pid===id))return fn.call(this,id,...a);
  const p=await elsewhere(id);const choice=p?await ask(p):'open';if(choice==='cancel')return false;
  inGate=true;let r;try{r=await fn.call(this,id,...a)}finally{inGate=false}
  if(r!==false&&S.doc&&S.doc.pid===id)after(choice);return r};
openLocalProject=gated(openLocalProject);
Cloud.open=gated(Cloud.open);
/* the read-only state shows next to the document name */
const _udn48=updateDocName;updateDocName=function(){const r=_udn48.apply(this,arguments);const d=S.doc,el=$('#docname');if(d&&d.readonly&&el&&!el.querySelector('.w48-ro'))el.insertAdjacentHTML('beforeend','<em class="tag w48-ro">Lecture seule</em>');return r};
/* presence notes change every minute: only real project changes refresh the lists */
const _or48=Cloud.onRemote;let sig48='';Cloud.onRemote=function(){const s=this.list.map(p=>p.id+':'+p.updatedAt).join(',');if(s===sig48)return;sig48=s;return _or48.apply(this,arguments)};
setTimeout(beat,3000);
})();

