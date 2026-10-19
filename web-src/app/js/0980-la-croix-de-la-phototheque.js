/* ===== wave51: la croix de la photothèque n'existe que pour la colonne d'infos : elle enregistre puis ferme cette colonne.
   Échap fait pareil ; sans photo sélectionnée ni recherche, Échap quitte la photothèque. ===== */
(()=>{
const info=()=>LIB.open&&LIB.sel&&LIB.sel.size>0;
{const st=document.createElement('style');st.textContent='#lbBack{display:none!important}.library:not(.has-info) #lbX{display:none!important}';document.head.appendChild(st)}
const T='Enregistrer et fermer les infos';
const closeInfo=async()=>{const a=document.activeElement;if(a&&a.closest&&a.closest('#lbInfo'))a.blur();
  await new Promise(r=>setTimeout(r,0));
  try{await flushSave()}catch(err){console.warn(err)}
  LIB.sel.clear();LIB.auto=false;$$('#lbGrid .lb-card').forEach(c=>{c.classList.remove('on');c.setAttribute('aria-selected','false')});renderLibInfo()};
const _rli=renderLibInfo;renderLibInfo=function(){const r=_rli.apply(this,arguments);const x=$('#lbX');if(x){x.title=T;x.setAttribute('aria-label',T)}return r};
document.addEventListener('click',e=>{const x=e.target.closest&&e.target.closest('#lbX');if(!x||!info())return;e.preventDefault();e.stopPropagation();closeInfo()},true);
document.addEventListener('keydown',e=>{if(e.key!=='Escape'||!LIB.open||!$('#library'))return;
  if(document.querySelector('#scrim,.menu'))return;
  const t=e.target;if(LIB.q&&(!info()||t&&t.id==='lbQ'))return;
  if(t&&t.closest&&t.closest('#lbInfo input,#lbInfo textarea'))return;
  e.preventDefault();e.stopPropagation();
  if(info())closeInfo();else closeLibrary()},true);
})();
