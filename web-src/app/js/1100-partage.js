/* ================= 1.0 : travail à plusieurs sur une même photo (chacun son tour) =================
   Fichier > Partager avec quelqu’un… : on invite un autre compte Prism par son adresse. La photo part chez lui par le transit,
   et chaque retouche enregistrée repart chez tous les membres.
   Chacun son tour : celui qui ouvre la photo la « tient » (10 min, renouvelées tant qu'elle est ouverte) ; chez les autres elle
   s'ouvre en lecture seule, et Prism prévient quand elle est libre. Le serveur refuse aussi l'enregistrement de qui ne la tient pas. */
(()=>{
const SH={list:[],by:new Map(),held:null,beat:null,waiting:new Set(),known:null};
const on=()=>!!(window.PrismSync&&PrismSync.state.cfg);
const api=(p,o)=>PrismSync.api(p,o);
async function refresh(){if(!on()){SH.list=[];SH.by=new Map();return SH.list}
  try{const r=await api('/v1/shares');SH.list=r.shares||[];SH.by=new Map(SH.list.map(s=>[s.pid,s]))
    /* une photo partagée avec moi pour la première fois : on le dit */
    const mine=new Set(SH.list.map(s=>s.pid));if(SH.known){for(const s of SH.list)if(!SH.known.has(s.pid)&&s.role!=='owner'){const o=s.members.find(x=>x.role==='owner');toast(`${o?o.email:'Quelqu’un'} partage une photo avec vous : elle arrive dans la Photothèque`,6000)}}SH.known=mine}
  catch(e){}try{updateDocName()}catch(e){}return SH.list}
const who=s=>s&&s.lock?s.lock.name:'';
/* ---------- chacun son tour ---------- */
async function take(pid){const d=S.doc;if(!d||d.pid!==pid||!SH.by.has(pid))return;
  try{await api('/v1/locks/'+encodeURIComponent(pid),{method:'POST'});SH.held=pid;SH.waiting.delete(pid);
    if(d.shareRO){d.shareRO=false;d.readonly=false;d.nosave=false;updateDocName()}
    clearInterval(SH.beat);SH.beat=setInterval(()=>{if(S.doc&&S.doc.pid===SH.held)api('/v1/locks/'+encodeURIComponent(SH.held),{method:'POST'}).catch(()=>{});else release()},4*60e3)}
  catch(e){if(e.status!==409)return;const h=(e.data&&e.data.holder&&e.data.holder.name)||'Quelqu’un';
    d.nosave=true;d.readonly=true;d.shareRO=h;SH.waiting.add(pid);updateDocName();
    toast(`${h} retouche cette photo en ce moment : elle s’ouvre en lecture seule. Prism vous prévient dès qu’elle est libre.`,7000)}}
function release(pid=SH.held,beacon){if(!pid)return;clearInterval(SH.beat);SH.beat=null;if(SH.held===pid)SH.held=null;if(!on())return;
  const c=PrismSync.state.cfg;if(beacon){try{fetch(c.url.replace(/\/+$/,'')+'/v1/locks/'+encodeURIComponent(pid),{method:'DELETE',keepalive:true,headers:{authorization:'Bearer '+PrismSync._SY.cfg.token}})}catch(e){}return}
  api('/v1/locks/'+encodeURIComponent(pid),{method:'DELETE'}).catch(()=>{})}
addEventListener('pagehide',()=>release(SH.held,true));
async function reopen(pid){const d=S.doc;if(d&&d.pid===pid){d.nosave=true;clearTimeout(SAVE.timer);SAVE.timer=null;closeDoc()}await libLoad();await libOpen(pid)}
async function onLive(m){await refresh();
  if(m.type==='lock'&&SH.waiting.has(m.pid)){const s=SH.by.get(m.pid);if(s&&!s.lock){SH.waiting.delete(m.pid);const d=S.doc,nm=d&&d.pid===m.pid?d.name:'La photo partagée';
    if(d&&d.pid===m.pid)toastAction(`« ${nm} » est libre : vous pouvez la retoucher.`,'La reprendre',()=>reopen(m.pid));else toast(`« ${nm} » est libre`)}}}
/* ouvrir une photo partagée = demander la main ; la fermer ou en ouvrir une autre = la rendre */
{const _olp=openLocalProject;openLocalProject=async function(id){if(SH.held&&SH.held!==id)release();const r=await _olp.apply(this,arguments);
  if(r!==false&&S.doc&&S.doc.pid===id){if(!SH.list.length&&on())await refresh();if(SH.by.has(id))await take(id)}return r}}
{const _cd=closeDoc;closeDoc=function(){const pid=S.doc&&S.doc.pid;const r=_cd.apply(this,arguments);if(pid&&pid===SH.held)release(pid);return r}}
/* le nom du document dit qu'elle est partagée, et qui la tient */
{const _u=updateDocName;updateDocName=function(){const r=_u.apply(this,arguments);try{const d=S.doc,el=$('#docname');if(d&&el&&SH.by.has(d.pid)&&!el.querySelector('.sh-tag')){const s=SH.by.get(d.pid);
  el.insertAdjacentHTML('beforeend',`<em class="tag sh-tag" title="${esc(s.members.map(x=>x.email).join(', '))}">${d.shareRO?esc(d.shareRO)+' retouche':'Partagée'}</em>`)}}catch(e){}return r}}

/* ---------- la fenêtre de partage ---------- */
async function shareDialog(){const d=S.doc;if(!d||!d.pid){toast('Ouvrez une photo à partager');return}
  if(!on()){dialog({title:'Partager avec quelqu’un',body:`<p>Pour partager une photo, connectez-vous d’abord à votre compte Prism. La personne invitée a besoin de son propre compte.</p>`,buttons:[{label:'Annuler'},{label:'Se connecter…',primary:true,onClick:()=>setTimeout(()=>PrismSync.dialog(),0)}]});return}
  await refresh();const pid=d.pid,s=SH.by.get(pid),owner=!s||s.role==='owner';
  const role=r=>r==='owner'?'Propriétaire':'Peut retoucher';
  const mem=s?s.members.map(x=>`<div class="sh-m"><span><b>${esc(x.email)}</b>${x.me?' <small>(vous)</small>':''}<small>${role(x.role)}</small></span>${owner&&!x.me?`<button class="btn sm" data-rm="${esc(x.user)}">Retirer</button>`:''}</div>`).join(''):'';
  const body=`${owner?`<div class="sh-add"><input id="shEmail" type="email" placeholder="Adresse de son compte Prism" autocomplete="off" aria-label="Adresse e-mail"><button class="btn primary" id="shInv">Inviter</button></div>`:''}
    ${mem?`<div class="sh-h">Personnes</div><div class="sh-list">${mem}</div>`:''}
    <p class="muted sh-p">Chacun son tour : la personne qui ouvre la photo la tient, les autres la voient en lecture seule jusqu’à ce qu’elle la ferme. Chaque retouche enregistrée arrive chez tout le monde.</p>
    ${s&&s.lock?`<p class="sh-p">En ce moment : <b>${esc(s.lock.me?'vous':who(s))}</b></p>`:''}<p class="sh-msg muted" aria-live="polite"></p>
    <style>.dlg:has(.sh-add),.dlg:has(.sh-list){width:min(520px,calc(100vw - 32px));max-width:none}.sh-add{display:flex;gap:8px}.sh-add input{flex:1}.sh-h{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--fg-3);margin:14px 0 6px}
    .sh-list{display:grid;gap:6px}.sh-m{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 10px;border-radius:9px;background:var(--chrome-2)}.sh-m small{display:block;color:var(--fg-2);font-size:11.5px}.sh-m b{font-weight:600}.sh-p{font-size:12.5px;margin:12px 0 0}.sh-msg{min-height:1.2em}</style>`;
  const buttons=[{label:'Fermer',primary:!owner}];
  if(s&&owner)buttons.unshift({label:'Arrêter le partage',onClick:()=>{(async()=>{if(!await askConfirm('Arrêter le partage ? Les autres gardent leur copie, mais ne reçoivent plus vos retouches.',{title:'Arrêter le partage',ok:'Arrêter'}))return;
    const me=s.members.find(x=>x.me);await api(`/v1/shares/${encodeURIComponent(pid)}/${encodeURIComponent(me.user)}`,{method:'DELETE'}).catch(()=>{});release(pid);await refresh();toast('Partage arrêté')})()}});
  if(s&&!owner)buttons.unshift({label:'Quitter le partage',onClick:()=>{(async()=>{const me=s.members.find(x=>x.me);await api(`/v1/shares/${encodeURIComponent(pid)}/${encodeURIComponent(me.user)}`,{method:'DELETE'}).catch(()=>{});release(pid);
    if(d.shareRO){d.shareRO=false;d.readonly=false;d.nosave=false}await refresh();toast('Vous avez quitté le partage : la photo reste chez vous')})()}});
  const dl=dialog({title:'Partager « '+(d.name||'Sans titre')+' »',body,buttons});
  const msg=$('.sh-msg',dl);
  const invite=async()=>{const em=$('#shEmail',dl).value.trim();if(!em)return;msg.textContent='Invitation…';
    try{/* la photo doit être passée par le compte avant d'être partagée */
      if(!d.saved){d.nosave=false;while(SAVE.running)await new Promise(r=>setTimeout(r,50));await saveNow()}
      const send=()=>api('/v1/shares',{method:'POST',json:{pid,email:em}});
      try{await send()}catch(e){if(e.code!=='pid')throw e;PrismSync.push(pid);await PrismSync.run();await send()}
      await refresh();closeDialog();toast(`Photo partagée avec ${em}`);if(S.doc&&S.doc.pid===pid&&SH.by.has(pid))take(pid)}
    catch(e){msg.textContent=e.message||'Invitation impossible'}};
  const b=$('#shInv',dl);if(b){b.onclick=invite;$('#shEmail',dl).onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();invite()}}}
  dl.addEventListener('click',async e=>{const r=e.target.closest('[data-rm]');if(!r)return;await api(`/v1/shares/${encodeURIComponent(pid)}/${encodeURIComponent(r.dataset.rm)}`,{method:'DELETE'}).catch(err=>{msg.textContent=err.message});await refresh();r.closest('.sh-m').remove();msg.textContent='Personne retirée du partage.'})}
{const F=MENU2.file,_f=F.items;F.items=function(){const a=_f.apply(this,arguments),i=a.findIndex(x=>x&&/^Partager pour avis/.test(x.label||''));const it=MI('Partager avec quelqu’un…',{icon:'share',fn:shareDialog,dis:S.doc?false:NODOC});
  if(i>=0)a.splice(i,0,it);else a.push(it);return a}}
/* au démarrage et à la connexion : la liste des partages */
setTimeout(()=>{if(on())refresh()},2500);
document.addEventListener('prism-peers',()=>{if(!SH.known&&on())refresh()});
window.PrismShare={isShared:pid=>SH.by.has(pid),onLive,refresh,dialog:shareDialog,take,release,state:SH};
})();
