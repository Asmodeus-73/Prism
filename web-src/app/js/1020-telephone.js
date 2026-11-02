/* ================= 1.0: téléphone (compact, en portrait) =================
   Une seule barre de cinq modes en bas : Réglages, Retouche, Calques, IA, Plus. Le volet au-dessus change selon le mode :
   - Réglages : le réglage choisi en grand curseur, des puces pour passer d'un réglage à l'autre, « Tous » ouvre le panneau complet ;
   - Retouche : les outils en puces et leurs options ;
   - Calques, IA : les panneaux habituels ;
   - Plus : recadrer, pivoter, filtres, historique, texte, formes, exporter, menu.
   Sur la photo : le zoom en bas à gauche, « Maintenir pour comparer » en bas à droite.
   Le grand curseur pilote le curseur du panneau Réglages : historique, masques et 16 bits restent les mêmes. */
const PHONE=matchMedia('(max-width:900px) and (orientation:portrait)');
(()=>{const st=document.createElement('style');st.textContent=`
body.phone #app{grid-template-rows:48px minmax(0,1fr)!important}
body.phone .work{grid-template-columns:minmax(0,1fr)!important;grid-template-rows:minmax(0,1fr) auto!important}
body.phone .work>.tools{display:none!important}
body.phone #app>.optbar{display:none}
body.phone .side{grid-row:2;height:auto!important;max-height:62dvh;border-radius:0;box-shadow:0 -6px 18px rgba(0,0,0,.12);display:flex;flex-direction:column;overflow:hidden}
body.phone .side>.grab,body.phone .side>.tabs,body.phone .side>.histo-panel,body.phone .side>.qa-panel{display:none!important}
body.phone .side>.pane,body.phone .side .layers-panel .pane{display:none!important}
body.phone[data-pm="cal"] #pane-layers,body.phone[data-pm="ia"] #pane-ai,body.phone.pm-hist #pane-history,body.phone.pm-full #pane-develop{display:block!important;overflow:auto;max-height:44dvh}
body.phone.pm-full #pane-develop{max-height:52dvh}
.p-panel{display:none}
body.phone .p-panel{display:block;padding:10px 14px 6px}
body.phone .p-strip{display:none}
body.phone[data-pm="reg"]:not(.pm-full) #pReg,body.phone[data-pm="ret"] #pRet,body.phone[data-pm="plus"]:not(.pm-hist) #pPlus{display:block}
body.phone.pm-full #pReg,body.phone.pm-hist #pPlus{display:none}
body.phone .p-panel:not(:has(.p-strip[style*="block"])){}
.p-v{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:4px}
.p-v b{font:600 15px var(--ui);color:var(--fg)}
.p-v output{font:500 15px var(--num);color:var(--accent-fg)}
#pRange{width:100%;margin:4px 0 8px;height:34px}
.p-chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 0 6px}
.p-chips::-webkit-scrollbar{display:none}
.p-chips button{flex:none;display:flex;align-items:center;gap:6px;height:36px;padding:0 14px;border-radius:18px;border:1px solid var(--line-2);background:var(--raise,var(--chrome));color:var(--fg);font:500 13.5px var(--ui);cursor:pointer;white-space:nowrap}
.p-chips button.on{background:var(--accent);border-color:var(--accent);color:#fff}
.p-chips svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
body.phone #pRet>.optbar{display:flex;position:static;height:auto;min-height:44px;flex-wrap:nowrap;overflow-x:auto;padding:0;border:0;background:none;box-shadow:none;transform:none;max-width:none;width:auto}
body.phone #pRet>.optbar .cap-fam,body.phone #pRet>.optbar #optTool{display:none}
.p-modes{display:none}
body.phone .p-modes{display:grid;grid-template-columns:repeat(5,1fr);border-top:1px solid var(--line);background:var(--chrome);padding-bottom:env(safe-area-inset-bottom,0px);flex:none}
.p-modes button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;height:56px;border:0;background:none;color:var(--fg-3);font:500 11.5px var(--ui);cursor:pointer}
.p-modes button[aria-pressed="true"]{color:var(--accent-fg)}
.p-modes svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.p-zoom,.p-cmp{display:none}
body.phone .p-zoom,body.phone .p-cmp{display:flex;position:absolute;z-index:6;bottom:12px;align-items:center;gap:7px;height:34px;padding:0 12px;border-radius:17px;border:0;background:rgba(24,24,30,.78);color:#fff;font:500 12.5px var(--ui);touch-action:none;user-select:none;-webkit-user-select:none}
body.phone .p-zoom{left:12px;font-family:var(--num)}
body.phone .p-cmp{right:12px}
body.phone .p-cmp svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6}
body.phone .p-cmp.on{background:var(--accent)}
body.phone .toast{bottom:auto;top:60px}
body.phone .composer{display:none}
`;document.head.appendChild(st)})();
(()=>{const ic=p=>`<svg viewBox="0 0 20 20" aria-hidden="true">${p}</svg>`;
  const I={reg:ic('<path d="M4 6h8M15 6h1M4 14h2M9 14h7"/><circle cx="13.5" cy="6" r="1.8"/><circle cx="7.5" cy="14" r="1.8"/>'),
    ret:ic('<rect x="3" y="7.5" width="14" height="5" rx="2.5" transform="rotate(-45 10 10)"/><path d="M8.5 8.5l3 3"/>'),
    cal:ic('<path d="M10 3 17 6.8 10 10.6 3 6.8z"/><path d="M3 10.2l7 3.8 7-3.8M3 13.6l7 3.8 7-3.8"/>'),
    ia:ic('<path d="M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6z"/><path d="M15.5 13l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>'),
    plus:ic('<circle cx="4.5" cy="10" r="1.3"/><circle cx="10" cy="10" r="1.3"/><circle cx="15.5" cy="10" r="1.3"/>'),
    cmp:ic('<rect x="2.5" y="4" width="15" height="12" rx="2"/><path d="M10 2.5v15"/>')};
  const MODES=[['reg','Réglages'],['ret','Retouche'],['cal','Calques'],['ia','IA'],['plus','Plus']];
  const side=$('.side'),stage=$('#stage'),ob=$('#optbar');
  const panel=document.createElement('div');panel.className='p-panel';panel.innerHTML=`
    <div class="p-strip" id="pReg"><div class="p-v"><b id="pRegName">Exposition</b><output id="pRegVal"></output></div><input type="range" id="pRange" aria-labelledby="pRegName"><div class="p-chips" id="pRegChips"></div></div>
    <div class="p-strip" id="pRet"><div class="p-chips" id="pTools"></div></div>
    <div class="p-strip" id="pPlus"><div class="p-chips" id="pPlusChips" style="flex-wrap:wrap"></div></div>`;
  const modes=document.createElement('nav');modes.className='p-modes';modes.setAttribute('aria-label','Modes');
  modes.innerHTML=MODES.map(([m,l])=>`<button type="button" data-pm="${m}" aria-pressed="false">${I[m]}<span>${l}</span></button>`).join('');
  const zoom=document.createElement('button');zoom.type='button';zoom.className='p-zoom';zoom.title='Ajuster à l’écran';zoom.onclick=()=>{try{fit()}catch(e){}};
  const cmp=document.createElement('button');cmp.type='button';cmp.className='p-cmp';cmp.innerHTML=I.cmp+'<span>Maintenir pour comparer</span>';
  const hold=on=>{if(!S.doc)return;S.holdBefore=on;cmp.classList.toggle('on',on);markContent()};
  cmp.addEventListener('pointerdown',e=>{e.preventDefault();try{cmp.setPointerCapture(e.pointerId)}catch(_){}hold(true)});
  ['pointerup','pointercancel','lostpointercapture'].forEach(t=>cmp.addEventListener(t,()=>hold(false)));
  cmp.addEventListener('contextmenu',e=>e.preventDefault());
  /* ---- Réglages : grand curseur ---- */
  const KEYS=[['exposure','Exposition'],['contrast','Contraste'],['highlights','Hautes lumières'],['shadows','Ombres'],['whites','Blancs'],['blacks','Noirs'],['temp','Température'],['tint','Teinte'],['vibrance','Vibrance'],['saturation','Saturation'],['texture','Texture'],['clarity','Clarté'],['dehaze','Voile']];
  let cur=PREF.get('phoneKey','exposure');
  const src=k=>document.querySelector(`#pane-develop input[type=range][data-k="${k}"]`);
  const keys=()=>KEYS.filter(([k])=>src(k));
  const ensureAdj=()=>{if(!S.doc||ADJ())return;const i=S.doc.layers.findIndex(l=>l.kind==='adjust'&&!l.mask);if(i>=0){S.doc.active=i;try{syncAll()}catch(e){}}};
  const paintReg=()=>{const r=$('#pRange'),i=src(cur);const ks=keys();if(!i&&ks.length)cur=ks[0][0];const s=src(cur);
    $('#pRegChips').innerHTML=`<button type="button" data-auto>Auto</button>`+ks.map(([k,l])=>`<button type="button" data-k="${k}" class="${k===cur?'on':''}">${esc(l)}</button>`).join('')+`<button type="button" data-all>Tous les réglages</button>`;
    const nm=(KEYS.find(x=>x[0]===cur)||[])[1]||cur;$('#pRegName').textContent=nm;
    if(!s||!ADJ()){r.disabled=true;$('#pRegVal').textContent='';return}r.disabled=false;
    r.min=s.min;r.max=s.max;r.step=s.step;r.value=s.value;const row=s.closest('.row');const tr=row&&row.getAttribute('style');r.setAttribute('style',tr||'');
    const o=row&&row.querySelector('output');$('#pRegVal').textContent=o?o.textContent:s.value};
  const pipe=(type)=>{const s=src(cur);if(!s)return;s.value=$('#pRange').value;s.dispatchEvent(new Event(type,{bubbles:true}));const o=s.closest('.row')&&s.closest('.row').querySelector('output');if(o)$('#pRegVal').textContent=o.textContent};
  panel.addEventListener('input',e=>{if(e.target.id==='pRange'){ensureAdj();pipe('input')}});
  panel.addEventListener('change',e=>{if(e.target.id==='pRange')pipe('change')});
  /* ---- Retouche : outils ---- */
  const paintTools=()=>{const N=typeof W47!=='undefined'&&W47.NAMES||{};
    const PRI=['heal','remove','clone','patch','brush','eraser','dodge','gradient','marquee','lasso','wand','crop','move','transform','text','shape'];const rank=t=>{const i=PRI.indexOf(t);return i<0?99:i};
    $('#pTools').innerHTML=[...document.querySelectorAll('#dock [data-tool]')].sort((a,b)=>rank(a.dataset.tool)-rank(b.dataset.tool)).map(b=>{const t=b.dataset.tool,s=b.querySelector('svg');return`<button type="button" data-tool="${t}" class="${t===S.tool?'on':''}">${s?s.outerHTML:''}<span>${esc(N[t]||b.getAttribute('aria-label')||t)}</span></button>`}).join('');const on=$('#pTools .on');if(on)on.scrollIntoView({block:'nearest',inline:'nearest'})};
  /* ---- Plus ---- */
  const PLUS=[['Recadrer',()=>setTool('crop')],['Pivoter',()=>{try{pick('image','Rotation 90° horaire').fn()}catch(e){}}],['Filtres',b=>{const r=b.getBoundingClientRect();openMenuAt(MENU2.filter.items(),r.left,r.top-8,{ctx:true})}],
    ['Historique',()=>{switchTab('history');document.body.classList.add('pm-hist')}],['Texte',()=>{setTool('text');setMode('ret')}],['Formes',()=>{setTool('shape');setMode('ret')}],['Exporter',()=>$('#bExport').click()],['Menu',()=>$('#bMenu').click()]];
  panel.querySelector('#pPlusChips').innerHTML=PLUS.map(([l],i)=>`<button type="button" data-plus="${i}">${esc(l)}</button>`).join('');
  panel.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.k){cur=b.dataset.k;PREF.set('phoneKey',cur);paintReg();return}
    if(b.hasAttribute('data-auto')){try{autoTone()}catch(err){}setTimeout(paintReg,60);return}
    if(b.hasAttribute('data-all')){ensureAdj();switchTab('develop');document.body.classList.add('pm-full');return}
    if(b.dataset.tool){setTool(b.dataset.tool);paintTools();return}
    if(b.dataset.plus!=null){PLUS[+b.dataset.plus][1](b)}});
  /* ---- modes ---- */
  let mode=PREF.get('phoneMode','reg');
  function setMode(m){mode=m;PREF.set('phoneMode',m);document.body.dataset.pm=m;document.body.classList.remove('pm-full','pm-hist');
    modes.querySelectorAll('[data-pm]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.pm===m));
    if(m==='reg'){ensureAdj();switchTab('develop');paintReg()}
    else if(m==='cal')switchTab('layers');
    else if(m==='ia')switchTab('ai');
    else if(m==='ret'){if(['move','hand','zoom','eyedropper'].includes(S.tool)&&document.querySelector('#dock [data-tool="heal"]'))setTool('heal');paintTools()}
    requestAnimationFrame(()=>{try{resizeView();markContent()}catch(e){}})}
  modes.addEventListener('click',e=>{const b=e.target.closest('[data-pm]');if(!b)return;if(b.dataset.pm===mode&&document.body.classList.contains('pm-full')){document.body.classList.remove('pm-full');paintReg();return}setMode(b.dataset.pm)});
  /* ---- placement ---- */
  const place=()=>{const on=PHONE.matches&&COMPACT.matches;document.body.classList.toggle('phone',on);
    if(on){if(panel.parentNode!==side)side.insertBefore(panel,side.firstChild);if(modes.parentNode!==side)side.appendChild(modes);
      if(zoom.parentNode!==stage){stage.appendChild(zoom);stage.appendChild(cmp)}
      const ret=$('#pRet');if(ob.parentNode!==ret)ret.appendChild(ob);setMode(mode)}
    else{document.body.classList.remove('pm-full','pm-hist');delete document.body.dataset.pm;
      if(ob.parentNode===$('#pRet')){$('#app').insertBefore(ob,$('.work'));try{applyLayout()}catch(e){}}}
    requestAnimationFrame(()=>{try{resizeView();markContent()}catch(e){}})};
  PHONE.addEventListener('change',place);COMPACT.addEventListener('change',place);place();
  /* ---- suivre l'éditeur ---- */
  const _us=updateStatus;updateStatus=function(){const r=_us.apply(this,arguments);zoom.textContent=S.doc?Math.round(S.zoom*100)+' %':'';return r};
  const _sa=syncAll;syncAll=function(){const r=_sa.apply(this,arguments);if(document.body.classList.contains('phone')&&mode==='reg')try{paintReg()}catch(e){}return r};
  const _st=setTool;setTool=function(t){const r=_st.apply(this,arguments);if(document.body.classList.contains('phone')&&mode==='ret')try{paintTools()}catch(e){}return r};
  window.PrismPhone={setMode,paintReg}})();
