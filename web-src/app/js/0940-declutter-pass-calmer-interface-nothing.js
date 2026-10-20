/* ================= fx_zclean: declutter pass (calmer interface, nothing removed) =================
   Runs after fx_ui47 / fx_zgrad / fx_zmask. Everything is scoped under body.zclean so the kill switch (PREF 'zclean' = false) restores the previous look.
   Rules: one style node, every JS pass idempotent + try/catch, observers debounced with rAF and never writing what they observe.
   What changes (desktop unless said otherwise):
   - status bar: no mirrored toast (the toast already says it), tool hint fades after a few seconds, document facts reduced to the size (rest in the tooltip), zoom reduced to - 42 % +
   - top bar: no "Exemple" tag, no "Modifié" word (the dot stays), search / compare / assistant as quiet icons (tooltips keep the name and the shortcut)
   - histogram: smaller, no border, clipping numbers only when there is clipping (and as an overlay, so nothing jumps)
   - inspector: quick-actions row hidden until asked (Affichage > Panneaux > Actions rapides, existing entry), tabs without icons or counter
   - develop: quieter values, no hairlines between the first groups, zone icons without caption
   - layers: the second line is written only when it says something (blend mode other than Normal, local adjustment...)
   - options bar: the target badge only when it tells something the layers panel does not (mask, other layer than the active one)
   - home: the three tip cards go (Ctrl+K stays in the search icon tooltip) */
(()=>{
if(PREF.get('zclean',true)===false)return;
const safe=(n,f)=>{try{return f()}catch(e){console.warn('zclean',n,e)}};
const rafOnce=(f,n)=>{let q=0;return(...a)=>{if(q)return;q=1;requestAnimationFrame(()=>{q=0;safe(n||'raf',()=>f(...a))})}};
if(window.ZCLEAN)return;const Z=window.ZCLEAN={ver:1};
document.body.classList.add('zclean');
const isCompact=()=>document.body.classList.contains('compact');

/* ---------------------------------------------------------------- CSS */
const css=document.createElement('style');css.id='zcleanCss';
css.textContent=`
/* ---- status bar ---- */
body.zclean .statusbar #bFit,body.zclean .statusbar #b100{display:none}
body.zclean .st-doc span:nth-child(n+2){display:none}
body.zclean .statusbar .st-doc{color:var(--fg-3);font-size:11px}
body.zclean #w47hint{color:var(--fg-3);font-size:11px}
body.zclean #w47hint:empty{display:block}
/* ---- top bar ---- */
body.zclean .docname .tag:not(.w48-ro){display:none}
body.zclean .w47-save em{display:none}
body.zclean:not(.no-doc) #bCmd{width:32px;padding:0;justify-content:center;gap:0;border-color:transparent;background:none}
body.zclean:not(.no-doc) #bCmd span,body.zclean:not(.no-doc) #bCmd kbd{display:none}
body.zclean:not(.no-doc) #bCmd:hover{background:var(--hover)}
body.zclean #bCompare span,body.zclean #bAssist span{display:none}
body.zclean #bCompare,body.zclean #bAssist{width:32px;padding:0;justify-content:center;gap:0}
body.zclean .bar-r .vsep{display:none}
body.zclean:not(.compact) .bar-r{gap:4px}
/* ---- histogram: smaller and quieter; clipping numbers are an overlay shown only when something clips ---- */
body.zclean:not(.compact) #histoPanel{min-height:72px;border-bottom:0}
body.zclean:not(.compact) #histoPanel .histo{position:relative;padding:8px 12px 6px}
body.zclean:not(.compact) #histoPanel .histo canvas{height:56px;min-height:56px;max-height:56px;border:0;border-radius:var(--r-s);background:var(--stage,#111113)}
body.zclean:not(.compact) .hmeta{position:absolute;left:18px;right:18px;bottom:11px;height:auto;margin:0;pointer-events:none;display:flex;justify-content:space-between;font-size:10px}
body.zclean .hmeta #hexif{display:none!important}
body.zclean .hmeta #hmL:not(.zc-on),body.zclean .hmeta #hmR:not(.zc-on){visibility:hidden}
/* ---- inspector tabs: text only, no counter (desktop) ---- */
body.zclean .tabs .cnt{display:none}
body.zclean:not(.compact) .tabs button svg{display:none}
/* ---- develop pane: quieter numbers, fewer hairlines ---- */
body.zclean #pane-develop .row output{font-size:11px;color:var(--fg-3);font-weight:400}
body.zclean #pane-develop .row.zero output{opacity:.55}
body.zclean #pane-develop .row:hover output,body.zclean #pane-develop .row output:focus{color:var(--fg-2);opacity:1}
body.zclean #pane-develop .w47-gap{background:transparent}
body.zclean #w47head{border-bottom-color:var(--line)}
body.zclean #w47head #w47zone .tg-l{display:none}
body.zclean #w47head .w47-zone{justify-content:flex-end}
body.zclean #pane-develop details.sec+details.sec{border-top-color:var(--line)}
/* ---- layers: a second line only when it says something ---- */
body.zclean .lyr .bl.zc-q{display:none}
body.zclean .lyr .nm:has(.bl.zc-q){display:flex;align-items:center}
/* ---- options bar: target badge only when informative ---- */
body.zclean #w47badge.zc-q{display:none}
/* ---- home: no tip cards ---- */
body.zclean #wTips{display:none}
`;
document.body.appendChild(css);

/* ---------------------------------------------------------------- toast / hint: say it once */
safe('hint',()=>{
  const W=window.W47;if(!W)return;
  W.mirrorToast=()=>{};                                   /* the toast is on screen already: no echo in the status bar */
  const _sh=W.setToolHint;let tt=0;
  if(typeof _sh==='function')W.setToolHint=t=>{_sh(t);clearTimeout(tt);if(t)tt=setTimeout(()=>_sh(''),5000)};
  const h=document.getElementById('w47hint');if(h)h.textContent=''});
safe('toast',()=>{if(typeof toast!=='function')return;const _t=toast;
  toast=function(msg){
    if(typeof msg==='string'){const m=msg.replace(/^Photo d’exemple chargée\. Ouvrez la vôtre \(JPEG, HEIC ou RAW\) avec Fichier > Ouvrir ou en la glissant ici\.?$/,'Photo d’exemple · Fichier > Ouvrir pour la vôtre');
      if(m!==msg){const a=[...arguments];a[0]=m;return _t.apply(this,a)}}
    return _t.apply(this,arguments)}});

/* ---------------------------------------------------------------- status: facts in the tooltip */
const paintStatus=rafOnce(()=>{
  const s=document.getElementById('stDoc');if(!s)return;
  const parts=[...s.children].map(x=>x.textContent.trim()).filter(Boolean);
  const t=parts.length?'Taille de l’image · '+parts.join(' · '):'Taille de l’image';
  if(s.title!==t)s.title=t},'zc.status');
safe('status.obs',()=>{const s=document.getElementById('stDoc');if(s)new MutationObserver(paintStatus).observe(s,{childList:true,subtree:true,characterData:true});paintStatus()});

/* ---------------------------------------------------------------- tooltips of the icon-only buttons keep name + shortcut */
safe('titles',()=>{
  const set=(id,t)=>{const b=document.getElementById(id);if(b){b.title=t;if(!b.getAttribute('aria-label'))b.setAttribute('aria-label',t.replace(/\s*\(.*$/,''))}};
  set('bCmd','Rechercher une commande (Ctrl+K)');
  set('bAssist','Assistant : retoucher en décrivant ce que vous voulez');
  const c=document.getElementById('bCompare');if(c&&!/Avant/.test(c.title))c.title='Avant / après (Y)';
  const c2=document.getElementById('bCompare');if(c2){c2.setAttribute('aria-label','Avant / après')}
  const a=document.getElementById('bAssist');if(a)a.setAttribute('aria-label','Assistant')});

/* ---------------------------------------------------------------- histogram: clipping numbers only if clipping */
const paintClip=rafOnce(()=>{
  for(const id of ['hmL','hmR']){const el=document.getElementById(id);if(!el)continue;
    const m=/(\d+)[,.](\d)/.exec(el.textContent||'');const v=m?parseFloat(m[1]+'.'+m[2]):0;
    el.classList.toggle('zc-on',v>=0.1)}},'zc.clip');
safe('clip.obs',()=>{const b=document.querySelector('.hmeta');if(b)new MutationObserver(paintClip).observe(b,{childList:true,subtree:true,characterData:true});paintClip()});

/* ---------------------------------------------------------------- quick actions: hidden until asked (existing Affichage > Panneaux entry), desktop only, never overrides a stored choice */
safe('qa',()=>{
  if(isCompact())return;
  let stored;try{stored=PREF.get('w47qa','__none__')}catch(e){}
  if(stored==='__none__')document.body.classList.add('w47-noqa')});

/* ---------------------------------------------------------------- layers: quiet second line */
const QUIET_BL=new Set(['Normal','Réglage global']);
const paintLayers=rafOnce(()=>{
  document.querySelectorAll('.lyrs .lyr .bl').forEach(b=>b.classList.toggle('zc-q',QUIET_BL.has(b.textContent.trim())))},'zc.layers');
safe('layers.obs',()=>{const u=document.querySelector('.lyrs');if(u)new MutationObserver(paintLayers).observe(u,{childList:true,subtree:true,characterData:true});
  const p=document.getElementById('pane-layers');if(p&&p!==u)new MutationObserver(paintLayers).observe(p,{childList:true});paintLayers()});

/* ---------------------------------------------------------------- options bar badge */
const paintBadgeQuiet=rafOnce(()=>{
  const b=document.getElementById('w47badge');if(!b)return;
  const idx=+b.dataset.idx,txt=b.textContent||'';
  let quiet=false;
  if(b.dataset.mask!=='1'){
    if(/^(Sélection|Nouveau calque)/.test(txt))quiet=true;
    else if(S.doc&&idx>=0&&idx===S.doc.active)quiet=true}
  b.classList.toggle('zc-q',quiet)},'zc.badge');
safe('badge.obs',()=>{const b=document.getElementById('w47badge');if(b)new MutationObserver(paintBadgeQuiet).observe(b,{childList:true,attributes:true,attributeFilter:['data-idx','data-mask']});paintBadgeQuiet();
  if(typeof setActiveLayer==='function'){const _s=setActiveLayer;setActiveLayer=function(){const r=_s.apply(this,arguments);paintBadgeQuiet();return r}}});

/* re-run everything once the first paint is done (observers may have attached before the nodes were filled) */
setTimeout(()=>{paintStatus();paintClip();paintLayers();paintBadgeQuiet()},600);
})();




