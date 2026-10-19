/* ===== wave35: navigation claire entre la photothèque et la retouche ===== */
(()=>{
const st=document.createElement('style');st.textContent=`
#bLib{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 11px;margin-left:6px;border:1px solid var(--line-2);border-radius:99px;background:var(--chrome);color:var(--fg);font-size:12.5px;font-weight:500;white-space:nowrap}
#bLib:hover{border-color:var(--accent-line);background:var(--hover)}
#bLib svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linejoin:round}
body.no-doc #bLib,body.compact #bLib{display:none}
@media (max-width:1560px){#bLib span{display:none}#bLib{padding:0 9px}}
#lbBack.back-main{height:34px;padding:0 16px;font-weight:600;background:var(--accent);border-color:var(--accent);color:#fff;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#lbBack.back-main:hover{filter:brightness(1.1)}
`;document.head.appendChild(st);
const nav=document.querySelector('#menubar');
if(nav){const b=document.createElement('button');b.id='bLib';b.type='button';b.title='Ouvrir la photothèque (toutes vos photos)';b.setAttribute('aria-label','Photothèque');
  b.innerHTML='<svg viewBox="0 0 20 20"><rect x="3" y="3" width="6" height="6" rx="1.2"/><rect x="11" y="3" width="6" height="6" rx="1.2"/><rect x="3" y="11" width="6" height="6" rx="1.2"/><rect x="11" y="11" width="6" height="6" rx="1.2"/></svg><span>Photothèque</span>';
  b.onclick=()=>openLibrary();nav.after(b)}
/* le bouton du haut devient « Retour à la retouche » avec le nom de la photo */
const _ol=openLibrary;
openLibrary=async function(...a){const r=await _ol.apply(this,a);const bk=$('#lbBack');if(bk&&S.doc){bk.textContent='← Retour à « '+S.doc.name+' »';bk.classList.add('back-main');bk.title='Revenir à la retouche (Échap ne ferme plus la photothèque)'}return r};
/* un clic ou une flèche = vraie sélection : Entrée peut alors ouvrir */
const _lc=libClick;libClick=function(e){LIB.auto=false;return _lc(e)};
window.addEventListener('keydown',e=>{
  if(!LIB.open)return;
  const t=e.target,inLib=t&&t.closest&&t.closest('#library');
  if(inLib){if(/^Arrow/.test(e.key))LIB.auto=false;return}
  if(t&&t.closest&&t.closest('input,textarea,select,[contenteditable],#scrim,#cmdk,#msheet,.menu,#busy'))return;
  if((e.metaKey||e.ctrlKey)&&(e.key==='k'||e.key==='K'))return;
  /* aucune touche de retouche ne doit agir derrière la photothèque */
  e.stopImmediatePropagation();const g=$('#lbGrid');if(g)g.focus({preventScroll:true})},true);
/* palette de commandes : pas de commande de retouche depuis la photothèque */
const _ci=cmdItems;
cmdItems=function(){const a=_ci();return LIB.open?a.filter(i=>['Fichier','Aide','Affichage'].includes(i.g)||/phototh/i.test(i.label)):a};
})();

