/* ================= 1.0: tablette =================
   Même organisation que le bureau (le mode téléphone ne s'applique plus qu'aux écrans de moins de 640 px en portrait).
   - écran étroit (≤ 1100 px) : le panneau de droite ne prend plus de place, il se glisse par-dessus la photo
     avec le bouton « Panneaux » de la barre du haut (ou F8) ;
   - écran tactile : cibles de 44 px (rail, outils, capsule, barre du haut). */
(()=>{const st=document.createElement('style');st.textContent=`
.only-over{display:none!important}
body.side-over:not(.compact) .only-over{display:inline-grid!important}
body.side-over:not(.compact) .work{grid-template-columns:var(--toolw) minmax(0,1fr) 0!important;position:relative}
body.side-over:not(.compact) .work>.side{position:absolute;z-index:8;top:0;right:0;bottom:0;width:var(--side);transform:translateX(100%);visibility:hidden;
  transition:transform .22s cubic-bezier(.2,.7,.2,1),visibility 0s .22s;box-shadow:-10px 0 28px rgba(20,20,40,.16)}
body.side-over.side-open:not(.compact):not(.focus) .work>.side{transform:none;visibility:visible;transition:transform .22s cubic-bezier(.2,.7,.2,1)}
body.side-over.side-open:not(.compact) #stage>.optbar,body.side-over.side-open:not(.compact) #stage>.statusbar{right:var(--side)}
body.side-over.side-open:not(.compact) #stage>.optbar{max-width:calc(100% - var(--side) - 24px)}
#bSide[aria-pressed="true"]{background:var(--accent-soft,var(--hover));color:var(--accent-fg,var(--fg))}
@media (pointer:coarse){
  body:not(.compact){--w47rail:56px;--w47tool:44px}
  body:not(.compact) .bar-r .ib,body:not(.compact) .bar-r .tb{min-width:44px;height:40px}
  body:not(.compact) #stage>.optbar{height:52px}
  body:not(.compact) .cap-fam button{height:40px;padding:0 12px}
  body:not(.compact) .cap-zoom{height:44px}
  body:not(.compact) .cap-zoom .ib,body:not(.compact) .cap-zoom .z{min-width:40px;height:40px}
  body:not(.compact) .tabs button{min-height:44px}
}
@media (prefers-reduced-motion:reduce){body.side-over .work>.side{transition:none!important}}
`;document.head.appendChild(st)})();
(()=>{const NARROW=matchMedia('(max-width:1100px)'),b=document.body;
  const btn=document.createElement('button');btn.className='ib only-over';btn.id='bSide';btn.setAttribute('aria-label','Panneaux');btn.title='Panneaux : réglages, calques, IA (F8)';
  btn.innerHTML='<svg viewBox="0 0 20 20"><rect x="2.5" y="3.5" width="15" height="13" rx="2"/><path d="M12 3.5v13"/></svg>';
  const ex=$('#bExport');ex.parentNode.insertBefore(btn,ex);
  let open=PREF.get('sideOpen',false);
  const paint=()=>{const over=NARROW.matches&&!COMPACT.matches;b.classList.toggle('side-over',over);b.classList.toggle('side-open',over&&open);btn.setAttribute('aria-pressed',over&&open);
    requestAnimationFrame(()=>{try{resizeView();markContent()}catch(e){}})};
  const toggle=v=>{open=typeof v==='boolean'?v:!open;PREF.set('sideOpen',open);if(open&&b.classList.contains('focus'))UI10.focus();paint()};
  btn.addEventListener('click',()=>toggle());
  window.addEventListener('keydown',e=>{if(e.key==='F8'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&b.classList.contains('side-over')){e.preventDefault();toggle()}});
  /* un onglet demandé (Calques, IA…) ouvre le panneau */
  const _sw=switchTab;switchTab=function(){const r=_sw.apply(this,arguments);if(b.classList.contains('side-over')&&!open)toggle(true);return r};
  NARROW.addEventListener('change',paint);COMPACT.addEventListener('change',paint);paint();
  const mi=MENU2.view.items;MENU2.view.items=()=>{const a=mi();if(b.classList.contains('side-over'))a.push(MI('Volet latéral',{kbd:'F8',check:open,fn:()=>toggle()}));return a};
  window.PrismTablet={toggle,isOpen:()=>open}})();
