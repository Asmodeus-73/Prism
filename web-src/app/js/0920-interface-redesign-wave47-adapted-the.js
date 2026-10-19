/* ================= fx_ui47: interface redesign "wave47", adapted: the layers stay in the left dock (#lyrDock) =================
   One IIFE, runs last (after wave46 and every audit fix). Rules: the style node goes to the end of <body> (the main <style> lives in the body),
   wrappers instead of rewrites, every pass idempotent and wrapped in try/catch, kill switch PREF 'w47' (false = old interface).
   Parts: 0 base · H histogram (owner correction 1) · S status bar and toasts · R rail · O options bar · T top bar · I inspector top · D develop · A IA/Historique · M menus/palette · P phone · L dock polish */
(()=>{
if(PREF.get('w47',true)===false)return;
const W47=window.W47={ver:47};
const safe=(n,f)=>{try{return f()}catch(e){console.warn('w47',n,e)}};
const rafOnce=(f,n)=>{let q=0;return(...a)=>{if(q)return;q=1;requestAnimationFrame(()=>{q=0;safe(n||'raf',()=>f(...a))})}};
const svg=(d,w=16)=>`<svg viewBox="0 0 20 20" width="${w}" height="${w}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const isCompact=()=>document.body.classList.contains('compact');
W47.safe=safe;

/* ====================================================================== 0. CSS ====================================================================== */
const CSS=`
/* ---- 0. surfaces (spec section 11): stage a little darker than the chrome, one chrome plane for bars and panels ---- */
:root{--stage:#111113;--line:#2a2a2f}
:root[data-theme="light"]{--line-2:#cdcdd4;--fg-3:#686871}
@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){--line-2:#cdcdd4;--fg-3:#686871}}
body:not(.compact):not(.no-doc) #app{grid-template-rows:44px 40px minmax(0,1fr) 26px}
body.compact.has-tabs #app{grid-template-rows:48px 44px minmax(0,1fr)}
@media (orientation:landscape){body.compact.has-tabs #app{grid-template-rows:40px 40px minmax(0,1fr)}}
body:not(.compact) .work{--toolw:var(--w47rail,48px)}
body:not(.compact).tl-on .work{--toolw:168px}
.statusbar{height:26px;font-size:11px;gap:12px}

/* ---- H. histogram: always there. flex:none, a guaranteed height, no header to click by accident ---- */
#histoPanel{flex:none;min-height:96px;border-bottom:1px solid var(--line)}
#histoPanel.closed{min-height:0}
#histoHead{display:none}
#histoPanel .histo{padding:8px 12px 4px;flex:none}
#histoPanel .histo canvas{height:64px;min-height:64px;max-height:64px;border:1px solid var(--line);box-sizing:border-box}
.hmeta{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center;margin-top:4px;height:18px;font:400 10.5px var(--num);color:var(--fg-3);flex-wrap:nowrap;justify-content:normal}
.hmeta #hmL{grid-column:1;display:inline-flex;align-items:center;gap:5px}
.hmeta #hexif{grid-column:2;display:block;margin:0;font:400 10.5px var(--num);color:var(--fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;min-width:0}
.hmeta #hexif span,.hmeta #hexif span:first-child{display:inline;font:400 10.5px var(--num);color:inherit;flex-basis:auto}
.hmeta #hexif span+span::before{content:" · "}
.hmeta #hmR{grid-column:3;display:inline-flex;align-items:center;gap:5px}
.w47-tri{width:0;height:0;border:4px solid transparent;display:inline-block}
.w47-tri.lo{border-left-color:#5aa0ff;border-bottom-color:#5aa0ff}
.w47-tri.hi{border-right-color:#ff7b6b;border-bottom-color:#ff7b6b}
body.compact .insp[data-sheet=peek] #histoPanel{display:none}
body.compact .insp:not([data-sheet=peek]) #histoPanel{display:block}
body.compact #histoPanel{min-height:84px}
body.compact #histoPanel .histo canvas{height:56px;min-height:56px;max-height:56px}

/* ---- S. status bar: hint on the left, coordinates, document facts, zoom group ---- */
#w47hint{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:400 11.5px var(--ui);color:var(--fg-2)}
#w47hint.toast-on{color:var(--fg)}
.statusbar .status{flex:none;min-width:84px;justify-content:flex-end;overflow:hidden}
.statusbar .st-doc{flex:none}
.statusbar .st-doc{color:var(--fg-3)}
.statusbar .st-doc button{border:0;background:none;color:inherit;font:inherit;cursor:pointer;padding:0 4px;border-radius:4px}
.zoom .zb{border:0;background:none;font:11px var(--ui);color:var(--fg-2);height:22px;padding:0 6px;border-radius:var(--r-s);white-space:nowrap}
.zoom .zb:hover{background:var(--hover);color:var(--fg)}
#stDoc{cursor:pointer}
#stDoc:hover{color:var(--fg-2)}
#toast.toast{position:fixed;transform:none;width:max-content;max-width:min(420px,calc(100vw - 32px));text-align:left;background:var(--raise);color:var(--fg);border:1px solid var(--line-2);border-radius:var(--r);padding:8px 12px;font-size:12.5px;font-weight:400;line-height:1.4;box-shadow:0 6px 20px rgba(0,0,0,.35)}
#toast.toast .btn{margin-left:10px;color:var(--accent-fg);border:0;background:none;min-height:0;padding:2px 6px;font-weight:500}
@media (max-width:1380px){.st-doc span:nth-child(n+3){display:none}}
`;
const style=document.createElement('style');style.id='w47Css';document.body.appendChild(style);
let cssParts=[CSS];
W47.addCss=t=>{cssParts.push(t);style.textContent=cssParts.join('\n')};
style.textContent=CSS;

/* ====================================================================== sizes ====================================================================== */
/* the breakpoints are written inline on <html> (inline beats every sheet, including wave42b which sets --side from a media query) */
const SZ={last:''};
function sizes(){
  const w=innerWidth,h=innerHeight,de=document.documentElement.style,b=document.body.classList;
  const short=h<=860,tall=h>=1000,xshort=h<=740;
  const side=w>=1700?336:w<=1380?288:304,rail=w<=1380?44:48,tool=xshort?30:(w<=1380||h<860)?32:36;
  const key=[side,rail,tool,short,tall,xshort].join();
  if(key===SZ.last)return;SZ.last=key;
  de.setProperty('--side',side+'px');de.setProperty('--w47rail',rail+'px');de.setProperty('--w47tool',tool+'px');
  b.toggle('w47-short',short);b.toggle('w47-tall',tall);b.toggle('w47-xshort',xshort);
  requestAnimationFrame(()=>safe('sizes.rv',()=>{resizeView();S.contentDirty=true;requestRender();W47.afterLayout&&W47.afterLayout()}));
}
sizes();
addEventListener('resize',rafOnce(sizes,'sizes'));

/* ====================================================================== H. histogram ====================================================================== */
/* Root causes found by test (R/sb/ui/t_histo_diag*.js):
   1. the 34px "Histogramme" header was a button that folded the panel and stored the fold forever in PREF 'uiHisto' (one stray click, still gone after a reload);
   2. body.compact hides it (any window narrower than 900px in portrait, or shorter than 560px in landscape);
   3. while S.sliding / S.drag stayed true (a pointerup lost outside the window) the read-back was postponed on every render;
   4. nothing refreshed it after a theme change, a tab switch whose first render was skipped, or a panel re-show.
   Fix: no header and no stored fold (the menu entry only hides it for the session), flex:none + fixed height, S.sliding heals itself,
   and a watchdog redraws it whenever the picture changed and no read-back came. */
const HI={last:0,lastDoc:null,lastTheme:'',dirtyAt:0,sliding0:0,lastMove:0};
function themeKey(){return document.documentElement.getAttribute('data-theme')||(matchMedia('(prefers-color-scheme: light)').matches?'auto-light':'auto-dark')}
safe('histo.pref',()=>{if(PREF.get('uiHisto',true)===false){PREF.set('uiHisto',true)}if(typeof UI2!=='undefined'&&UI2.histo===false){setHisto(true)}});
if(typeof setHisto==='function'){const _sh=setHisto;setHisto=function(on){const r=_sh.apply(this,arguments);try{PREF.set('uiHisto',true)}catch(e){}return r}}
/* the Affichage > Panneaux entry stays, but only for the session */
if(typeof histogram==='function'){
  const _hg=histogram;
  histogram=function(img){
    const r=_hg.apply(this,arguments);
    HI.last=performance.now();HI.lastDoc=S.doc;HI.lastTheme=themeKey();
    safe('histo.meta',()=>{
      for(const [id,cls] of [['hmL','lo'],['hmR','hi']]){const el=document.getElementById(id);if(!el)continue;
        const m=/(\d+)[.,](\d) %/.exec(el.textContent);
        if(m){const full=(id==='hmL'?'Ombres écrêtées ':'Hautes lumières ')+m[1]+','+m[2]+' %';el.title=full;
          el.innerHTML=id==='hmL'?`<i class="w47-tri lo"></i>${m[1]},${m[2]} %`:`${m[1]},${m[2]} %<i class="w47-tri hi"></i>`}
        else if(el.querySelector('.w47-tri')||el.textContent==='—'){/* keep */}}
    });
    return r};
  histogram.t=_hg.t}
safe('histo.exif',()=>{const hm=document.querySelector('.hmeta'),hx=document.getElementById('hexif');
  if(hm&&hx&&hx.parentNode!==hm){hm.insertBefore(hx,document.getElementById('hmR'))}
  if(typeof updateExifLine==='function'){const _ue=updateExifLine;updateExifLine=function(){const r=_ue.apply(this,arguments);const e=document.getElementById('hexif');if(e)e.title=e.textContent;return r}}});
/* S.sliding self-heals: any pointerup / pointercancel / mouseup / blur / lost capture / hidden tab clears it, a move without a button clears it,
   and a watchdog clears it when no pointer activity was seen for 4 s */
const healSliding=why=>{if(S.sliding){S.sliding=false;try{markContent()}catch(e){}}};
['pointerup','pointercancel','mouseup','dragend','lostpointercapture'].forEach(t=>addEventListener(t,()=>healSliding(t),true));
addEventListener('blur',()=>healSliding('blur'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)healSliding('hidden')});
document.addEventListener('pointermove',e=>{if(S.sliding){if(e.buttons===0)healSliding('move0');else HI.lastMove=performance.now()}},true);
document.addEventListener('pointerdown',e=>{if(e.target&&e.target.type==='range'){HI.lastMove=performance.now()}},true);
/* every change of picture is time-stamped; the watchdog compares it with the last read-back */
if(typeof markContent==='function'){const _mc=markContent;markContent=function(){HI.dirtyAt=performance.now();return _mc.apply(this,arguments)}}
if(typeof markComp==='function'){const _mk=markComp;markComp=function(){HI.dirtyAt=performance.now();return _mk.apply(this,arguments)}}
const histoVisible=()=>{const c=document.getElementById('histo');return !!c&&c.clientWidth>8&&c.clientHeight>8};
function histoRefresh(){
  if(!S.doc||!histoVisible())return;
  if(S.contentDirty){requestRender();return}
  try{if(typeof work!=='undefined'&&work.width>1&&S.workPos&&S.workSize)histoNow();else{S.contentDirty=true;requestRender()}}
  catch(e){S.contentDirty=true;requestRender()}}
W47.histoRefresh=histoRefresh;
const histoKick=(()=>{let t=0;return(ms=120)=>{clearTimeout(t);t=setTimeout(()=>safe('histoKick',histoRefresh),ms)}})();
W47.histoKick=histoKick;
function histoWatch(){
  if(document.hidden||!S.doc||document.body.classList.contains('no-doc'))return;
  const vis=histoVisible(),shownNow=vis&&!HI.wasVis;HI.wasVis=vis;if(!vis)return;
  const now=performance.now();
  if(S.sliding&&now-HI.lastMove>4000)healSliding('timeout');
  if(S.stroke||S.drag||S.sliding)return;
  const c=document.getElementById('histo'),p=document.getElementById('histoPanel');
  if(!c||!p||p.classList.contains('closed'))return;
  const never=!HI.last,otherDoc=HI.lastDoc!==S.doc,stale=HI.dirtyAt>HI.last&&now-HI.dirtyAt>700,theme=HI.lastTheme!==themeKey();
  if(never||otherDoc||stale||theme||shownNow)histoRefresh()}
setInterval(()=>safe('histoWatch',histoWatch),800);
/* explicit refreshes: theme change, panel shown again, tab / document / layer change, window back in front */
new MutationObserver(()=>histoKick(60)).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
safe('histo.mq',()=>matchMedia('(prefers-color-scheme: light)').addEventListener('change',()=>histoKick(60)));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)histoKick(200)});
addEventListener('focus',()=>histoKick(200));
if(typeof setHisto==='function'){const _sh2=setHisto;setHisto=function(on){const r=_sh2.apply(this,arguments);if(on)histoKick(80);return r}}
if(typeof syncLayers==='function'){const _sl=syncLayers;syncLayers=function(){const r=_sl.apply(this,arguments);histoKick(200);return r}}
if(typeof updateDocName==='function'){const _ud=updateDocName;updateDocName=function(){const r=_ud.apply(this,arguments);histoKick(250);return r}}
if(typeof switchTab==='function'){const _sw=switchTab;switchTab=function(){const r=_sw.apply(this,arguments);histoKick(150);return r}}
COMPACT.addEventListener('change',()=>histoKick(300));

/* ====================================================================== S. status bar, hints and toasts ====================================================================== */
const hintEl=document.createElement('div');hintEl.id='w47hint';hintEl.setAttribute('aria-live','off');
{const st=document.getElementById('status');st.parentNode.insertBefore(hintEl,st)}
const HINT={tool:'',toast:'',tt:0};
function showHint(){const t=HINT.toast||HINT.tool;hintEl.textContent=t;hintEl.title=t;hintEl.classList.toggle('toast-on',!!HINT.toast)}
W47.setToolHint=t=>{HINT.tool=t||'';showHint()};
W47.mirrorToast=(txt,ms)=>{HINT.toast=txt;showHint();clearTimeout(HINT.tt);HINT.tt=setTimeout(()=>{HINT.toast='';showHint()},ms||6000)};
if(typeof toast==='function'){const _t=toast;toast=function(msg,ms){const r=_t.apply(this,arguments);safe('toast',()=>{
    const t=document.getElementById('toast');if(!t)return;
    const sg=document.getElementById('stage').getBoundingClientRect();
    if(!isCompact()){t.style.left=Math.round(sg.left+16)+'px';t.style.bottom=Math.round(innerHeight-sg.bottom+16)+'px';t.style.right='auto';t.style.top='auto'}
    else{t.style.left='12px';t.style.right='12px';t.style.top=Math.round(sg.top+8)+'px';t.style.bottom='auto';t.style.maxWidth='none';t.style.width='auto'}
    if(typeof msg==='string'&&msg)W47.mirrorToast(msg,6000)});return r}}
/* the zoom value, the "Réglage : X" and the "photo d'exemple" spans leave #status (the chip and the badge carry them) */
if(typeof updateStatus==='function'){const _us=updateStatus;updateStatus=function(){const r=_us.apply(this,arguments);safe('status',()=>{
    const st=document.getElementById('status');if(!st)return;[...st.children].forEach(s=>{const t=s.textContent;if(/^\d+ %$/.test(t)||/^(Réglage|Calque) :/.test(t)||/^photo d’exemple$/.test(t))s.remove()})});return r}}
safe('zoom.buttons',()=>{const z=document.querySelector('.zoom');if(!z||document.getElementById('bFit'))return;
  const f=document.createElement('button');f.className='zb';f.id='bFit';f.textContent='Ajuster';f.title='Ajuster à l’écran (Ctrl+0)';f.onclick=()=>fit();
  const o=document.createElement('button');o.className='zb';o.id='b100';o.textContent='100 %';o.title='Taille réelle (100 %)';o.onclick=()=>zoomAt(1);
  z.appendChild(f);z.appendChild(o)});
safe('stDoc.click',()=>{const s=document.getElementById('stDoc');if(s){s.title='Taille de l’image';s.addEventListener('click',()=>{if(S.doc&&typeof resizeDialog==='function')resizeDialog()})}});
/* ====================================================================== R. tool rail: groups, stacks, repeat-press cycling, single names ====================================================================== */
const NAMES={move:'Déplacer',transform:'Transformer',crop:'Recadrer',heal:'Correcteur',patch:'Pièce',redeye:'Yeux rouges',clone:'Tampon',remove:'Gomme IA',marquee:'Sélection',lasso:'Lasso',wand:'Baguette',pen:'Plume',brush:'Pinceau',eraser:'Gomme',gradient:'Dégradé',bucket:'Pot de peinture',dodge:'Densité',smudge:'Doigt',liquify:'Fluidité',text:'Texte',shape:'Formes',eyedropper:'Pipette',hand:'Main',zoom:'Zoom'};
const GROUPS=[['Cadrer',['move','transform','crop']],['Retoucher',['heal','clone','remove']],['Sélectionner',['marquee','lasso','wand']],['Peindre et masquer',['brush','eraser','gradient','dodge']],['Ajouter',['text','shape']],['Vue',['eyedropper','hand']]];
const STACKS={heal:['patch','redeye'],wand:['pen'],gradient:['bucket'],dodge:['smudge','liquify'],hand:['zoom']};
const STACK_OF={};Object.entries(STACKS).forEach(([h,m])=>{STACK_OF[h]=h;m.forEach(x=>STACK_OF[x]=h)});
const stackIds=h=>[h,...STACKS[h]];
const SHOWN={};Object.keys(STACKS).forEach(h=>SHOWN[h]=h);
const LQKEY=()=>fmtKbdSafe(MOD+'⇧X');
function fmtKbdSafe(s){return typeof fmtKbd==='function'?fmtKbd(s):s}
const toolKey=id=>{const t=TOOLS.find(x=>x&&x[0]===id);return id==='liquify'?LQKEY():(t&&t[2])||''};
W47.NAMES=NAMES;W47.STACKS=STACKS;
W47.oldToolNames={};
function applyNames(){
  TOOLS.forEach(t=>{if(t&&NAMES[t[0]]&&t[1]!==NAMES[t[0]]&&!Object.values(W47.oldToolNames).includes(NAMES[t[0]]))W47.oldToolNames[t[1]]=NAMES[t[0]]});
  TOOLS.forEach(t=>{if(t&&NAMES[t[0]])t[1]=NAMES[t[0]]});
  Object.assign(TOOL_NAMES,NAMES);
  document.querySelectorAll('#dock [data-tool]').forEach(b=>{const id=b.dataset.tool,n=NAMES[id];if(!n)return;
    const k=toolKey(id);b.setAttribute('aria-label',n);b.removeAttribute('title');
    b.dataset.tip=`${n}${k?` (${k})`:''} ${(typeof TOOL_HELP!=='undefined'&&TOOL_HELP[id])||''}`.trim();
    if(k)b.setAttribute('aria-keyshortcuts',k.replace(/\+/g,'+'));
    const l=b.querySelector('.tl');if(l)l.innerHTML=`<b>${n}</b><kbd>${k}</kbd>`});
  const ot=document.getElementById('optTool');if(ot){const t=TOOLS.find(x=>x&&x[0]===S.tool);const b=ot.querySelector('b');if(b&&t)b.textContent=t[1]}}
function stackify(){
  const dock=document.getElementById('dock');if(!dock)return;
  W47.stacking=true;
  try{
    const btn={};dock.querySelectorAll('[data-tool]').forEach(b=>btn[b.dataset.tool]=b);
    const fg=dock.querySelector('.fg'),tlt=dock.querySelector('#tlToggle');
    dock.querySelectorAll('.sep').forEach(x=>x.remove());
    const used=new Set();
    GROUPS.forEach(([cap,ids],gi)=>{
      ids.forEach(id=>{const b=btn[id];if(!b)return;used.add(id);dock.insertBefore(b,fg);
        const st=STACKS[id];if(st)st.forEach(m=>{const mb=btn[m];if(mb){used.add(m);dock.insertBefore(mb,fg)}})});
      const s=document.createElement('div');s.className='sep';s.setAttribute('role','separator');s.dataset.grp=cap;dock.insertBefore(s,fg)});
    /* any other tool added later by another area stays visible after the last group */
    Object.keys(btn).forEach(id=>{if(!used.has(id))dock.insertBefore(btn[id],fg)});
    if(tlt)dock.appendChild(tlt);
    Object.keys(STACKS).forEach(h=>paintStack(h));
  }finally{W47.stacking=false}}
function paintStack(h){
  const dock=document.getElementById('dock');if(!dock)return;
  stackIds(h).forEach(id=>{const b=dock.querySelector(`[data-tool="${id}"]`);if(!b)return;const shown=SHOWN[h]===id;
    b.classList.toggle('w47-stacked',!shown);b.classList.toggle('w47-stack',shown);
    if(shown)b.dataset.w47stack=h;else delete b.dataset.w47stack})}
function stackFollow(t){const h=STACK_OF[t];if(!h)return;if(SHOWN[h]!==t){SHOWN[h]=t;paintStack(h)}}
function railInit(){applyNames();stackify();stackFollow(S.tool)}
safe('rail',railInit);
if(typeof decorateDock==='function'){const _dd=decorateDock;decorateDock=function(){const r=_dd.apply(this,arguments);safe('rail.dd',()=>{applyNames();if(!W47.stacking)stackify()});return r}}
if(typeof decorateTools==='function'){const _dt=decorateTools;decorateTools=function(){const r=_dt.apply(this,arguments);safe('rail.dt',applyNames);return r}}
{const _stk=setTool;setTool=function(t){const r=_stk.apply(this,arguments);safe('rail.set',()=>{if(S.tool===t)stackFollow(t)});return r}}
new MutationObserver(rafOnce(()=>{if(W47.stacking)return;const dock=document.getElementById('dock');if(dock&&dock.querySelector('[data-tool]')&&!dock.querySelector('.sep[data-grp]'))stackify()},'rail.mo')).observe(document.getElementById('dock'),{childList:true});
/* repeat-press: the key of the active tool cycles through its stack. Ctrl/Cmd+Shift+X = Fluidité. */
const typing=e=>{const tg=e.target;return tg&&tg.matches&&tg.matches('textarea,select,[contenteditable],input:not([type=range]):not([type=checkbox]):not([type=color]):not([type=radio]):not([type=button])')};
const dialogOpen=()=>{const s=document.getElementById('scrim');return(s&&!s.classList.contains('light'))||document.getElementById('cmdk')||document.getElementById('library')||document.getElementById('msheet')||document.getElementById('pop')};
const busyOn=()=>{const b=document.getElementById('busy');return b&&!b.hidden};
window.addEventListener('keydown',e=>{
  try{
    if(!S.doc||typing(e)||dialogOpen()||busyOn())return;
    const mod=e.metaKey||e.ctrlKey;
    if(mod&&e.shiftKey&&!e.altKey&&(e.code==='KeyX'||(e.key||'').toLowerCase()==='x')){e.preventDefault();e.stopImmediatePropagation();setTool('liquify');return}
    if(mod||e.altKey||e.shiftKey||e.repeat)return;
    const k=(e.key||'').toLowerCase();
    const h=STACK_OF[S.tool];if(!h||KEYTOOLS[k]!==h)return;
    const ring=stackIds(h),next=ring[(ring.indexOf(S.tool)+1)%ring.length];
    e.preventDefault();e.stopImmediatePropagation();setTool(next);
  }catch(err){console.warn('w47 keys',err)}},true);
/* flyout: right-click, long press, or the arrow beside the tool name */
const IC2ref=typeof IC2!=='undefined'?IC2:null;
function flyoutItems(h){
  const grp=GROUPS.find(g=>g[1].includes(h))||['Outils'];
  const items=[{head:grp[0]}];
  stackIds(h).forEach(id=>{if(IC2ref&&!IC2ref['t-'+id]&&IC[id])IC2ref['t-'+id]=IC[id];
    items.push(MI(NAMES[id],{icon:'t-'+id,kbd:toolKey(id),fn:()=>setTool(id)}))});
  items.push(SEP,{head:'Touche répétée : outil suivant'});
  return items}
W47.flyoutItems=flyoutItems;
function markActive(){requestAnimationFrame(()=>safe('fly.on',()=>{const n=NAMES[S.tool];document.querySelectorAll('.menu.ctx .mi').forEach(b=>{const l=b.querySelector('.mi-l');if(l&&l.textContent===n)b.classList.add('w47-on')})}))}
W47.addCss(`.menu .mi.w47-on{background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--fg)}.menu .mi.w47-on .mi-i{color:var(--accent)}`);
function openFlyout(btn){const h=STACK_OF[btn.dataset.tool];if(!h)return false;const r=btn.getBoundingClientRect();openMenuAt(flyoutItems(h),r.right+6,r.top-4,{ctx:true});markActive();return true}
function railMenu(){return[MI('Noms des outils',{icon:'panels',check:!!(typeof TOOLLB!=='undefined'&&TOOLLB.on),fn:()=>{const t=document.getElementById('tlToggle');if(t)t.click()}})]}
{const _cf=ctxFor;ctxFor=function(t){
  const b=t.closest&&t.closest('#dock [data-tool]');
  if(b&&b.closest('#dock')&&!isCompact()){const h=STACK_OF[b.dataset.tool];if(h)return()=>{markActive();return[...flyoutItems(h),SEP,...railMenu()]}}
  if(t.closest&&t.closest('#dock')&&!isCompact())return railMenu;
  return _cf.apply(this,arguments)}}
{let timer=0,st=null,block=0;
  const dock=document.getElementById('dock');
  dock.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-w47stack]');if(!b||e.button>0)return;st={x:e.clientX,y:e.clientY,b};clearTimeout(timer);
    timer=setTimeout(()=>{if(!st)return;if(openFlyout(st.b)){block=Date.now();try{navigator.vibrate&&navigator.vibrate(8)}catch(_){}}st=null},450)},true);
  const cancel=()=>{clearTimeout(timer);st=null};
  dock.addEventListener('pointermove',e=>{if(st&&Math.hypot(e.clientX-st.x,e.clientY-st.y)>8)cancel()},true);
  dock.addEventListener('pointerup',cancel,true);dock.addEventListener('pointercancel',cancel,true);dock.addEventListener('pointerleave',cancel,true);
  dock.addEventListener('click',e=>{if(Date.now()-block<500){e.preventDefault();e.stopImmediatePropagation()}},true);
  dock.addEventListener('contextmenu',e=>{if(Date.now()-block<800&&e.pointerType==='touch')e.preventDefault()},true)}
W47.railCss=`
body:not(.compact) #dock{padding:6px 0;gap:1px;overflow-y:auto;overflow-x:hidden}
body:not(.compact) .tools .ib{width:var(--w47tool,36px);height:var(--w47tool,36px);border-radius:var(--r-s)}
body:not(.compact) .tools .ib svg{width:17px;height:17px;stroke-width:1.6}
body:not(.compact) .tools .sep{width:20px;margin:4px 0}
body:not(.compact).w47-xshort .tools .sep{margin:2px 0}
body:not(.compact) .tools .fg{width:var(--w47tool,36px);height:var(--w47tool,36px);margin-top:auto}
body:not(.compact) #tlToggle{display:none}
.tools .w47-stacked{display:none!important}
.tools .w47-stack{position:relative}
.tools .w47-stack::after{content:"";position:absolute;right:3px;bottom:3px;border:2.5px solid transparent;border-right-color:currentColor;border-bottom-color:currentColor;opacity:.55;pointer-events:none}
body:not(.compact).tl-on .tools .w47-stack::after{right:8px;bottom:12px}
body:not(.compact).tl-on .tools .ib{width:100%}
body.compact .tools .w47-stack::after{right:5px;bottom:5px}
`;
W47.addCss(W47.railCss);
/* ====================================================================== O. options bar: tool chip, target badge, "Plus (N)" overflow, hints to the status bar ====================================================================== */
const optbar=document.getElementById('optbar'),optTool=document.getElementById('optTool'),pill=document.getElementById('pill');
const PIXTOOLS=['heal','clone','remove','patch','redeye','dodge','smudge','liquify','bucket','brush','eraser','gradient'];
const SELTOOLS=['marquee','lasso','wand','pen'];
function targetInfo(){
  const d=S.doc;if(!d)return null;const A=AL(),t=S.tool;if(!A)return null;
  const mt=typeof maskTarget==='function'?maskTarget():null;
  if(['brush','eraser','gradient'].includes(t)&&mt)return{txt:`Masque « ${mt.name} »`,idx:d.layers.indexOf(mt),mask:true};
  if(PIXTOOLS.includes(t)){const L=A.kind==='pixel'?A:pixelTarget();return L?{txt:`Calque « ${L.name} »`,idx:d.layers.indexOf(L)}:{txt:'Aucun calque de pixels',idx:-1}}
  if(SELTOOLS.includes(t))return{txt:'Sélection',idx:-1};
  if(t==='text'||t==='shape')return{txt:'Nouveau calque',idx:-1};
  if(t==='transform')return{txt:`Calque « ${A.name} »`,idx:d.active};
  return null}
const badge=document.createElement('button');badge.type='button';badge.id='w47badge';badge.className='w47-badge';badge.hidden=true;
optTool.after(badge);
badge.addEventListener('click',()=>{const i=+badge.dataset.idx;if(i>=0&&S.doc){const L=S.doc.layers[i];if(L&&badge.dataset.mask==='1'&&L.kind==='pixel')L.editMask=true;setActiveLayer(i)}});
function paintBadge(){
  const ti=targetInfo();
  if(!ti){badge.hidden=true;return}
  badge.hidden=false;badge.dataset.idx=ti.idx;badge.dataset.mask=ti.mask?'1':'0';
  badge.innerHTML=(ti.mask?svg('<rect x="3" y="3" width="14" height="14" rx="3"/><circle cx="10" cy="10" r="3.6" fill="currentColor" stroke="none"/>',13):'')+`<span>${esc(ti.txt)}</span>`;
  badge.title=ti.idx>=0?'Cible de l’outil : cliquez pour sélectionner ce calque':ti.txt;
  badge.style.cursor=ti.idx>=0?'pointer':'default'}
W47.paintBadge=paintBadge;
/* tool chip: icon, short name and, for a stacked tool, a small arrow that opens the flyout */
function paintChip(){
  const t=S.tool,stk=STACK_OF[t];
  const old=optTool.querySelector('.w47-chev');if(old)old.remove();
  const nm=NAMES[t];const b=optTool.querySelector('b');if(b&&nm)b.textContent=nm;
  if(stk){optTool.insertAdjacentHTML('beforeend',`<span class="w47-chev">${svg('<path d="M6 8l4 4 4-4"/>',12)}</span>`);optTool.setAttribute('role','button');optTool.tabIndex=0;optTool.removeAttribute('aria-hidden');optTool.title='Outils de la même famille';optTool.classList.add('w47-stk')}
  else{optTool.removeAttribute('role');optTool.removeAttribute('tabindex');optTool.setAttribute('aria-hidden','true');optTool.removeAttribute('title');optTool.classList.remove('w47-stk')}}
optTool.addEventListener('click',()=>{const h=STACK_OF[S.tool];if(!h)return;const r=optTool.getBoundingClientRect();openMenuAt(flyoutItems(h),r.left,r.bottom+4,{ctx:true});markActive()});
optTool.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&optTool.classList.contains('w47-stk')){e.preventDefault();optTool.click()}});
/* Plus (N) */
const more=document.createElement('div');more.id='w47more';more.hidden=true;
const moreBtn=document.createElement('button');moreBtn.type='button';moreBtn.id='w47moreBtn';moreBtn.hidden=true;moreBtn.setAttribute('aria-haspopup','true');moreBtn.setAttribute('aria-expanded','false');
const OV={busy:false,open:false};
const isPinned=n=>n.id==='cropApply'||n.id==='cropReset'||(n.matches&&n.matches('[data-act=apply],[data-act=reset],[data-pin]'));
const isKeep=n=>n.id==='srcBtn';
const isCtl=n=>n.nodeType===1&&n!==more&&n!==moreBtn&&!n.classList.contains('tname')&&!n.classList.contains('hint')&&!n.classList.contains('kbhint');
function closeMore(){OV.open=false;more.hidden=true;moreBtn.setAttribute('aria-expanded','false');moreBtn.classList.remove('on')}
function openMore(){if(!more.children.length)return;OV.open=true;more.hidden=false;moreBtn.setAttribute('aria-expanded','true');moreBtn.classList.add('on');
  const r=moreBtn.getBoundingClientRect();more.style.top=Math.round(r.bottom+6)+'px';const w=more.offsetWidth;more.style.left=Math.max(8,Math.min(innerWidth-w-8,Math.round(r.right-w)))+'px'}
moreBtn.addEventListener('click',e=>{e.stopPropagation();OV.open?closeMore():openMore()});
document.addEventListener('pointerdown',e=>{if(OV.open&&!e.target.closest('#w47more,#w47moreBtn'))closeMore()},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&OV.open){closeMore();e.stopPropagation()}},true);
function ensureMore(){if(more.parentNode!==pill)pill.appendChild(more);if(moreBtn.parentNode!==pill)pill.appendChild(moreBtn)}
function hintText(){
  const out=[];pill.querySelectorAll('.hint').forEach(h=>{const t=(h.textContent||'').trim();if(t&&!out.includes(t))out.push(t)});
  if(!out.length&&typeof TOOL_HELP!=='undefined'&&TOOL_HELP[S.tool])out.push(TOOL_HELP[S.tool]);
  return out.join(' · ')}
function layoutPill(){
  if(OV.busy)return;OV.busy=true;
  try{
    ensureMore();
    /* 1. everything back in the bar, in its original order */
    const kids=[...more.children];
    kids.forEach(n=>{pill.insertBefore(n,moreBtn)});
    const ctl=[...pill.children].filter(isCtl);
    /* keep the original order: nodes that came back sit before the button, original order is stored in data-w47i */
    ctl.forEach((n,i)=>{if(n.dataset.w47i==null)n.dataset.w47i=i});
    ctl.sort((a,b)=>a.dataset.w47i-b.dataset.w47i).forEach(n=>{pill.insertBefore(n,moreBtn)});
    pill.querySelectorAll('[data-fit]').forEach(x=>x.style.display='');
    closeMore();moreBtn.hidden=true;
    /* pinned nodes sit at the far right, after the button */
    const pinned=ctl.filter(isPinned);pinned.forEach((n,i)=>{n.style.marginLeft=i===0?'auto':''});
    const movable=ctl.filter(n=>!isPinned(n));
    const over=()=>pill.scrollWidth>pill.clientWidth+1;
    const maxVis=isCompact()?2:Infinity;
    let moved=0;
    const need=()=>over()||movable.length-moved>maxVis;
    if(need()&&movable.length){
      moreBtn.hidden=false;moreBtn.innerHTML=`${svg('<circle cx="4.5" cy="10" r="1.2" fill="currentColor"/><circle cx="10" cy="10" r="1.2" fill="currentColor"/><circle cx="15.5" cy="10" r="1.2" fill="currentColor"/>',14)}<span>Plus (0)</span>`;
      if(pinned.length)pill.insertBefore(moreBtn,pinned[0]);
      const order=[...movable.filter(n=>!isKeep(n)).reverse(),...movable.filter(isKeep).reverse()];
      for(const n of order){if(!need())break;more.insertBefore(n,more.firstChild);moved++;moreBtn.lastChild.textContent=`Plus (${moved})`}
      if(!moved)moreBtn.hidden=true}
    if(pinned.length&&!moreBtn.hidden){/* button right before the pinned group */pill.insertBefore(moreBtn,pinned[0])}
    else if(!moreBtn.hidden)pill.appendChild(moreBtn);
    pill.appendChild(more);
    moreBtn.title=moved?`${moved} option${moved>1?'s':''} de plus`:'';
  }finally{
    /* drop the records our own moves produced */
    try{pillMO.takeRecords()}catch(e){}
    OV.busy=false}
  W47.setToolHint(hintText());paintBadge();paintChip()}
const layoutPillSoon=rafOnce(layoutPill,'pill');
const pillMO=new MutationObserver(()=>{if(!OV.busy)layoutPillSoon()});pillMO.observe(pill,{childList:true});
new ResizeObserver(()=>{if(!OV.busy)layoutPillSoon()}).observe(optbar);
{const _rp47=renderPill;renderPill=function(){const r=_rp47.apply(this,arguments);safe('pill.sync',()=>{while(more.firstChild)more.removeChild(more.firstChild);OV.open=false;more.hidden=true;pill.querySelectorAll(':scope > :not(#w47more):not(#w47moreBtn)').forEach((n,i)=>{n.dataset.w47i=i})});layoutPillSoon();return r}}
{const _st47=setTool;setTool=function(){const r=_st47.apply(this,arguments);safe('pill.setTool',()=>{paintChip();paintBadge();W47.setToolHint(hintText())});return r}}
if(typeof syncLayers==='function'){const _sl47=syncLayers;syncLayers=function(){const r=_sl47.apply(this,arguments);safe('badge.sl',paintBadge);return r}}
if(typeof updateDocName==='function'){const _ud47=updateDocName;updateDocName=function(){const r=_ud47.apply(this,arguments);safe('badge.ud',paintBadge);return r}}
W47.addCss(`
.optbar{gap:8px;padding:0 8px 0 10px;min-width:0}
.opt-tool{border-right:0;padding:0 4px 0 6px;height:28px;border-radius:var(--r-s);gap:7px;font-size:12.5px;flex:none}
.opt-tool b{font-weight:600}
.opt-tool.w47-stk{cursor:pointer}.opt-tool.w47-stk:hover{background:var(--hover)}
.opt-tool .w47-chev svg{width:11px;height:11px;stroke:var(--fg-3);fill:none;margin-left:-2px}
.w47-badge{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 8px 0 6px;border-radius:4px;border:0;background:var(--accent-soft);color:var(--accent-fg);font:500 11.5px var(--ui);flex:none;white-space:nowrap;max-width:240px}
.w47-badge span{overflow:hidden;text-overflow:ellipsis}
.w47-badge svg{stroke:currentColor}
.w47-badge+.pill{border-left:1px solid var(--line-2);padding-left:10px;margin-left:2px}
#pill{flex:1;min-width:0;overflow:hidden;gap:12px;position:relative}
#pill .hint{display:none}
#pill label{flex:none}
#pill input[type=range]{flex:none}
#pill .val{min-width:38px}
#w47moreBtn{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:var(--r-s);border:1px solid var(--line-2);background:none;color:var(--fg-2);font-size:12px;flex:none;margin-left:auto}
#w47moreBtn[hidden]{display:none}
#w47moreBtn:hover,#w47moreBtn.on{background:var(--hover);color:var(--fg)}
#w47more{position:fixed;z-index:60;display:flex;flex-direction:column;align-items:stretch;gap:10px;min-width:240px;max-width:min(420px,calc(100vw - 16px));max-height:calc(100dvh - 120px);overflow:auto;padding:12px;background:var(--menu);border:1px solid var(--line-2);border-radius:var(--r);box-shadow:var(--shadow);white-space:normal}
#w47more[hidden]{display:none}
#w47more>*{margin:0!important;flex:none}
#w47more>label{display:flex;justify-content:space-between;gap:12px;align-items:center}
#w47more>label input[type=range]{width:150px}
#w47more>.seg{align-self:flex-start}
#w47more .hint{display:block}
body.compact .w47-badge{max-width:120px}
body.compact #w47more{left:8px!important;right:8px;width:auto;max-width:none}
`);
/* ====================================================================== T. top bar: document chip with save state, inline tabs, search pill, compare label ====================================================================== */
const docname=document.getElementById('docname'),hdr=document.querySelector('header.bar');
const SAVE_WORD={saved:'Enregistré',pending:'Modifié',saving:'Enregistrement…',idle:'',error:'Échec',syncing:'Synchronisation…',synced:'Synchronisé',syncerr:'Sync. impossible'};
function saveWord(){return SAVE_WORD[SAVE.state]||''}
function paintSave(){
  const s=docname.querySelector('.w47-save');if(!s)return;
  s.dataset.st=SAVE.state;s.querySelector('em').textContent=saveWord();
  const sy=document.getElementById('bSync');let tip=sy&&sy.title?sy.title.replace(/\s*·\s*Ouvrir mes projets\s*$/,''):saveWord();
  if(S.doc)docname.title=`${S.doc.name} · ${tip}`}
function drawChipThumb(c){
  const d=S.doc;if(!d)return;const L=d.layers.find(l=>l.kind==='pixel'&&l.canvas);if(!L)return;
  const g=c.getContext('2d'),cw=c.width,ch=c.height,sw=L.canvas.width,sh=L.canvas.height;if(!sw||!sh)return;
  const k=Math.max(cw/sw,ch/sh),w=sw*k,h=sh*k;g.clearRect(0,0,cw,ch);g.imageSmoothingQuality='high';g.drawImage(L.canvas,(cw-w)/2,(ch-h)/2,w,h)}
function paintChip47(){
  const d=S.doc;if(!d||!docname)return;
  const tags=[...docname.querySelectorAll('.tag')].map(t=>t.textContent.trim()).filter(Boolean);
  if(S.sample&&!tags.includes('Exemple'))tags.push('Exemple');
  docname.innerHTML=`<canvas class="w47-th" width="60" height="40" aria-hidden="true"></canvas><b>${esc(d.name)}</b>${tags.map(t=>`<i class="tag">${esc(t)}</i>`).join('')}<span class="w47-save" data-st="${SAVE.state}"><i></i><em>${saveWord()}</em></span><span class="w47-chev" role="button" aria-label="Menu du document" title="Menu du document">${svg('<path d="M6 8l4 4 4-4"/>',12)}</span>`;
  safe('chipThumb',()=>drawChipThumb(docname.querySelector('.w47-th')));
  paintSave()}
{const _udc=updateDocName;updateDocName=function(){const r=_udc.apply(this,arguments);safe('chip',paintChip47);return r}}
{const _ssc=setSaveState;setSaveState=function(){const r=_ssc.apply(this,arguments);safe('chip.save',paintSave);return r}}
function docMenuItems(){
  const pickIt=(label,name,icon)=>{try{const it=MENU2.file.items().find(x=>x&&x.label===label);return it?MI(name||label,{icon,fn:it.fn,dis:it.dis,kbd:it.kbd}):null}catch(e){return null}};
  return[MI('Renommer le document…',{icon:'rename',fn:renameDocDialog,dis:docDis()}),MI('Photothèque…',{icon:'lib',fn:()=>openLibrary(),kbd:fmtKbdSafe(MOD+'⇧O')}),MI('Exporter…',{icon:'export',fn:exportDialog,dis:docDis(),kbd:fmtKbdSafe(MOD+'⇧E')}),SEP,
    pickIt('Fermer la photo','Fermer la photo','close'),pickIt('Synchroniser ce projet sur mon compte','Synchroniser sur mon compte','cloud'),pickIt('Enregistrer maintenant','Enregistrer maintenant','save')].filter(Boolean)}
W47.docMenuItems=docMenuItems;
{const _cf2=ctxFor;ctxFor=function(t){if(t.closest&&t.closest('#docname,#tabbar .tab.on')&&S.doc&&!t.closest('#tabbar .tab:not(.on)'))return docMenuItems;return _cf2.apply(this,arguments)}}
function openDocMenu(el){const r=el.getBoundingClientRect();openMenuAt(docMenuItems(),Math.max(8,r.left),r.bottom+6,{ctx:true})}
docname.addEventListener('click',e=>{if(e.target.closest('.w47-chev')){e.preventDefault();e.stopImmediatePropagation();openDocMenu(docname)}},true);
/* tabs: the existing #tabbar moves into the bar, next to the chip, and the chip steps aside while there are 2+ photos */
const tabbar=document.getElementById('tabbar');
if(tabbar&&hdr){docname.after(tabbar)}
function tabsPost(){
  if(!tabbar)return;
  const on=tabbar.querySelector('.tab.on');
  if(on&&!on.querySelector('.w47-chev')){const x=on.querySelector('button[data-x]');const c=document.createElement('span');c.className='w47-chev';c.setAttribute('role','button');c.setAttribute('aria-label','Menu du document');c.title='Menu du document';c.innerHTML=svg('<path d="M6 8l4 4 4-4"/>',12);if(x)on.insertBefore(c,x);else on.appendChild(c)}
  tabbar.classList.toggle('w47-ovf',tabbar.scrollWidth>tabbar.clientWidth+2)}
const tabsPostSoon=rafOnce(tabsPost,'tabs');
if(tabbar){new MutationObserver(tabsPostSoon).observe(tabbar,{childList:true});new ResizeObserver(tabsPostSoon).observe(tabbar);tabbar.addEventListener('scroll',tabsPostSoon,{passive:true});
  tabbar.addEventListener('click',e=>{const c=e.target.closest('.w47-chev');if(c){e.preventDefault();e.stopImmediatePropagation();openDocMenu(c.closest('.tab')||c)}},true);tabsPost()}
W47.addCss(`
.bar{background:var(--chrome);gap:8px;padding:0 8px 0 10px}
.menubar>button{padding:0 9px}
.docname,#tabbar{grid-column:2;grid-row:1;justify-self:center}
.docname{height:30px;max-width:min(360px,100%);padding:0 6px 0 4px;border-radius:var(--r);background:var(--chrome-2);border:1px solid var(--line);gap:8px;color:var(--fg)}
.docname .w47-th{width:30px;height:20px;border-radius:3px;flex:none;box-shadow:0 0 0 1px var(--line-2);background:var(--bg)}
.docname b{font-weight:500;font-size:12.5px}
.docname .tag{display:inline-block;font:500 10px/15px var(--num);letter-spacing:0;color:var(--fg-3);border:1px solid var(--line-2);border-radius:3px;padding:0 4px;flex:none}
.docname .dim{display:none}
.w47-save{display:inline-flex;align-items:center;gap:5px;color:var(--fg-3);font:400 11.5px var(--ui);white-space:nowrap;flex:none}
.w47-save i{width:6px;height:6px;border-radius:50%;background:var(--ok);display:block}
.w47-save[data-st=pending] i,.w47-save[data-st=saving] i{background:var(--warn)}
.w47-save[data-st=pending]{color:var(--warn)}
.w47-save[data-st=syncing] i{background:var(--accent-fg)}
.w47-save[data-st=error] i,.w47-save[data-st=syncerr] i{background:var(--bad)}
.w47-save[data-st=error],.w47-save[data-st=syncerr]{color:var(--bad)}
.w47-save[data-st=idle] i{background:var(--fg-3)}
.w47-chev{display:inline-grid;place-items:center;width:18px;height:18px;border-radius:4px;color:var(--fg-3);flex:none;cursor:pointer}
.w47-chev:hover{background:var(--hover);color:var(--fg)}
.w47-chev svg{width:12px;height:12px}
@media (max-width:1359px){.w47-save em{display:none}.docname .tag{display:none}}
body.has-tabs:not(.compact) #docname{display:none}
body.has-tabs:not(.compact) #tabbar{display:flex;min-width:0;max-width:100%;padding:0;border:0;background:none;align-items:center;gap:2px;overflow-x:auto;overflow-y:hidden}
#tabbar.w47-ovf{-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 14px,#000 calc(100% - 14px),transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 14px,#000 calc(100% - 14px),transparent 100%)}
#tabbar .tab{height:28px;min-width:110px;max-width:200px;padding:0 4px 0 10px;border:1px solid transparent;border-radius:var(--r-s);background:none;color:var(--fg-2);margin:0;gap:6px}
#tabbar .tab:hover{background:var(--hover);color:var(--fg)}
#tabbar .tab.on{flex:none;min-width:156px;background:var(--chrome-2);border-color:var(--line-2);color:var(--fg);height:28px;margin:0}
#tabbar .tab.on::before{left:10px;right:10px;top:auto;bottom:-1px;height:2px;border-radius:2px 2px 0 0}
#tabbar .tab-add{margin:0 0 0 4px;width:28px;height:28px;border-radius:var(--r-s)}
#bLib,#bSync{display:none!important}
#bCmd.cmd-pill{border-radius:var(--r-s);height:30px}
@media (min-width:1360px){#bCmd.cmd-pill{width:180px;min-width:180px}.tb#bCompare span{display:inline}.tb#bCompare{padding:0 11px 0 9px}}
@media (max-width:1359px){#bCmd.cmd-pill{width:32px;min-width:32px;padding:0;justify-content:center;border-color:transparent;background:none}#bCmd.cmd-pill span,#bCmd.cmd-pill kbd{display:none}#bCmd.cmd-pill svg{width:17px;height:17px}}
body.compact #bCmd.cmd-pill,body.compact #bCmd.cmd-pill+.vsep{display:none!important}
#bAssist span{display:none}#bAssist{padding:0 8px}
#bExport{border-radius:var(--r);height:30px;padding:0 12px 0 10px;background:var(--accent);box-shadow:none;margin-left:2px}
#bExport:hover{background:color-mix(in srgb,var(--accent) 88%,#fff)}
body.compact .docname{max-width:120px;justify-self:start}
body.compact .docname .tag,body.compact .docname .w47-save em{display:none}
`);
/* ====================================================================== I. inspector top: quick actions row, tabs, history counter ====================================================================== */
safe('qa.wave42c',()=>{document.querySelectorAll('style').forEach(st=>{if(st.id!=='w47Css'&&/\.qa>\*:nth-child\(n\+5\)/.test(st.textContent))st.remove()})});
safe('qa.icons',()=>{IC2.w47adjS='<circle cx="8.5" cy="6.5" r="2.6"/><path d="M3.5 16.5c.6-3 2.6-4.6 5-4.6"/><circle cx="14.5" cy="13.5" r="3.2"/><path d="M14.5 10.3a3.2 3.2 0 000 6.4z" fill="currentColor" stroke="none"/>';
  IC2.w47adjB='<rect x="2.5" y="3.5" width="15" height="13" rx="2" stroke-dasharray="2.2 2"/><circle cx="12.5" cy="11.5" r="3.2"/><path d="M12.5 8.3a3.2 3.2 0 000 6.4z" fill="currentColor" stroke="none"/>';
  const a=QA_ALL.find(x=>x[0]==='adjSubject'),b=QA_ALL.find(x=>x[0]==='adjBg');if(a)a[2]='w47adjS';if(b)b[2]='w47adjB';renderQA()});
safe('qa.catalogue',()=>{const r=QA_ALL.find(x=>x[0]==='remove');if(r){r[1]='Gomme IA';r[4]='Peignez sur ce qui doit disparaître (R)'}});
/* new defaults ONLY when the user never stored a list */
safe('qa.defaults',()=>{if(PREF.get('qaList',null)==null){const L=['crop','rotR','remove','subject','adjSubject','adjBg','copyLook','pasteLook'].filter(k=>QA_ALL.some(a=>a[0]===k));QA.list=L;renderQA()}});
const qaTip=a=>{let help=a[4]||'',key='';const m=/\s*\(([^()]{1,3})\)\s*$/.exec(help);if(m){key=m[1];help=help.slice(0,m.index)}
  return `${a[1]}${key?` (${key})`:''} ${help.replace(/\s*\(IA\)/,' avec l’IA')}`.trim()};
function qaPost(){
  const el=document.getElementById('qa');if(!el||isCompact())return;
  el.querySelectorAll('.qa-more').forEach(x=>x.remove());
  const btns=[...el.querySelectorAll('.qa-b[data-qa]')];
  btns.forEach(b=>{b.classList.remove('w47-x');const a=QA_ALL.find(x=>x[0]===b.dataset.qa);if(a){const dis=b.getAttribute('aria-disabled')==='true';b.dataset.tip=qaTip(a)+(dis?' · ouvrez d’abord une photo':'')}});
  const cs=getComputedStyle(el),room=el.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight),slot=30,cap=Math.max(1,Math.floor((room+2)/slot));
  if(btns.length>cap){
    const keep=cap-1,hidden=btns.slice(keep);hidden.forEach(b=>b.classList.add('w47-x'));
    const mb=document.createElement('button');mb.type='button';mb.className='qa-b qa-more';mb.dataset.tip='Autres actions rapides';mb.setAttribute('aria-label','Autres actions rapides');
    mb.innerHTML=svg('<circle cx="4.5" cy="10" r="1.2" fill="currentColor"/><circle cx="10" cy="10" r="1.2" fill="currentColor"/><circle cx="15.5" cy="10" r="1.2" fill="currentColor"/>',16);
    mb.onclick=e=>{e.stopPropagation();const r=mb.getBoundingClientRect();openMenuAt(hidden.map(b=>{const a=QA_ALL.find(x=>x[0]===b.dataset.qa);return MI(a[1],{icon:a[2],fn:()=>b.click(),dis:b.getAttribute('aria-disabled')==='true'?NODOC:false})}).concat([SEP,MI('Personnaliser…',{icon:'sliders',fn:qaCustomize})]),r.left,r.bottom+4,{ctx:true})};
    el.insertBefore(mb,btns[keep])}}
{const _rq=renderQA;renderQA=function(){const r=_rq.apply(this,arguments);safe('qa.post',qaPost);return r}}
safe('qa.first',qaPost);
new ResizeObserver(rafOnce(()=>safe('qa.rz',()=>{const el=document.getElementById('qa');if(el&&!isCompact())renderQA()}),'qa.rz')).observe(document.getElementById('qaPanel'));
/* history counter on the tab */
safe('tab.count',()=>{const t=document.querySelector('.tabs [data-tab=history]');if(!t||t.querySelector('.cnt'))return;const c=document.createElement('span');c.className='cnt';t.appendChild(c)});
function paintCount(){const c=document.querySelector('.tabs [data-tab=history] .cnt');if(c)c.textContent=S.doc?String(S.history.length):''}
{const _rh=renderHistory;renderHistory=function(){const r=_rh.apply(this,arguments);safe('hist.post',()=>{paintCount();histPost()});return r}}

/* ====================================================================== A. IA and Historique tabs ====================================================================== */
function toggleComposer(){const c=document.getElementById('composer'),b=document.getElementById('bAssist');if(!c)return;c.hidden=!c.hidden;PREF.set('composerHidden',c.hidden);if(!c.hidden){const i=document.getElementById('cmpIn');i&&i.focus()}b&&b.setAttribute('aria-pressed',!c.hidden)}
{const _ra=renderAI;renderAI=function(){const r=_ra.apply(this,arguments);safe('ai.post',()=>{
  const p=document.getElementById('pane-ai');if(!p)return;
  const rm=p.querySelector('[data-ai=remove]');if(rm)rm.textContent='Prendre la Gomme IA';
  p.querySelectorAll('h4').forEach(h=>{if(/Gomme magique/.test(h.lastChild&&h.lastChild.textContent||''))h.lastChild.textContent='Gomme IA'});
  const bA=document.getElementById('bAssist');
  if(bA&&!bA.hidden&&!p.querySelector('.w47-composer')){const w=document.createElement('div');w.className='w47-composer';w.innerHTML=`<button class="btn sm" type="button">${svg('<path d="M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6z"/>',15)}<span>${document.getElementById('composer').hidden?'Ouvrir la barre d’assistant':'Masquer la barre d’assistant'}</span></button>`;w.querySelector('button').onclick=()=>{toggleComposer();renderAI()};p.insertBefore(w,p.firstChild)}})
  return r}}
function histPost(){
  const p=document.getElementById('pane-history');if(!p||p.querySelector('.w47-snaps'))return;
  const d=document.createElement('div');d.className='w47-snaps';
  d.innerHTML=`<button class="btn sm" data-sn="save" type="button">Enregistrer un instantané</button><button class="btn sm" data-sn="list" type="button">Instantanés…</button>`;
  d.addEventListener('click',e=>{const b=e.target.closest('[data-sn]');if(!b)return;
    const items=MENU2.edit.items();const it=items.find(x=>x&&x.label===(b.dataset.sn==='save'?'Enregistrer un instantané':'Instantanés…'));
    if(it&&it.fn&&!it.dis)it.fn();else if(!S.doc)toast(NODOC)});
  p.insertBefore(d,p.firstChild)}
safe('hist.first',()=>{renderHistory()});
W47.addCss(`
@media (max-height:999px){body:not(.compact) #qa.qa>*:nth-child(n+5):not(.w47-x):not(.qa-add){display:inline-flex}}
/* quick actions: one row of 28px icons, no header, the customise button at the far right */
body:not(.compact) #qaPanel{position:relative;border-bottom:0}
body:not(.compact) #qaPanel .ph-row{position:absolute;right:6px;top:0;bottom:0;padding:0;display:flex;align-items:center;z-index:2}
body:not(.compact) #qaHead{display:none}
body:not(.compact) .qa-edit{width:28px;height:28px;color:var(--fg-3)}
body:not(.compact) .qa-edit:hover{color:var(--fg)}
body:not(.compact) #qa{display:flex;align-items:center;gap:2px;padding:3px 36px 3px 10px;flex-wrap:nowrap;overflow:hidden}
body:not(.compact) .qa-b{width:28px;height:28px;min-height:0;flex:none;padding:0;border:0;background:none;border-radius:var(--r-s);color:var(--fg-2);gap:0}
body:not(.compact) .qa-b span{display:none}
body:not(.compact) .qa-b svg{width:16px;height:16px;stroke:currentColor}
body:not(.compact) .qa-b:hover{background:var(--hover);color:var(--fg);border-color:transparent}
body:not(.compact) .qa-b[aria-disabled="true"],body:not(.compact) .qa-b[aria-disabled="true"] svg{color:var(--fg-3);stroke:var(--fg-3);opacity:.7}
body:not(.compact) .qa-b.w47-x{display:none!important}
body:not(.compact) #qaPanel.closed #qa{display:none}
body:not(.compact) #qaPanel.closed .ph-row{display:none}
body:not(.compact) #qaPanel.closed{min-height:0}
/* tabs */
body:not(.compact) .tabs{height:34px;padding:0 6px;border-top:1px solid var(--line)}
body:not(.compact) .tabs button{height:34px;gap:6px;font-weight:500;font-size:12.5px;color:var(--fg-3)}
body:not(.compact) .tabs button svg{width:14px;height:14px}
body:not(.compact) .tabs button.on{color:var(--fg);font-weight:500}
.tabs .cnt{font:400 10.5px var(--num);color:var(--fg-3);margin-left:-1px}
body.w47-short:not(.compact) .tabs,body.w47-short:not(.compact) .tabs button{height:32px}
.w47-composer{padding:10px 12px 0}.w47-composer .btn{width:100%;justify-content:flex-start}
.w47-snaps{display:flex;gap:6px;padding:10px 12px 4px;flex-wrap:wrap}
`);
/* ====================================================================== D. develop pane: sticky head, presets popover, WB pipette on the Température line, zone row, sections ====================================================================== */
const pane=document.getElementById('pane-develop');
const PIPETTE='<path d="M13.2 2.8a2.2 2.2 0 0 1 3.1 3.1l-1.7 1.7-3.1-3.1z"/><path d="m11.5 6.5-7.6 7.6c-.4.4-.6.9-.6 1.4v1.2h1.2c.5 0 1-.2 1.4-.6l7.6-7.6"/><path d="m10.4 7.6 3 3"/>';
const RESET_IC='<path d="M4 10a6 6 0 1 0 1.9-4.4"/><path d="M4 3.8v3.4h3.4"/>';
const GRID_IC='<rect x="3" y="3" width="6" height="6" rx="1.2"/><rect x="11" y="3" width="6" height="6" rx="1.2"/><rect x="3" y="11" width="6" height="6" rx="1.2"/><rect x="11" y="11" width="6" height="6" rx="1.2"/>';
const PLUS_IC='<path d="M10 4v12M4 10h12"/>';
const SECMAP=(()=>{try{return JSON.parse(PREF.get('w47Sec','{}'))||{}}catch(e){return{}}})();
const saveSec=()=>{try{PREF.set('w47Sec',JSON.stringify(SECMAP))}catch(e){}};
function placeWB(){
  const wb=document.getElementById('btnWB');if(!wb)return;
  const tall=document.body.classList.contains('w47-tall');
  const sub=pane.querySelector('.w47-sub[data-w47sub=wb]'),lab=pane.querySelector('.row[data-k=temp] label');
  const dest=tall&&sub?sub:lab;if(dest&&wb.parentNode!==dest)dest.appendChild(wb)}
function homeDevelop(){
  const target=document.getElementById('target'),body=document.getElementById('devBody');if(!target||!body)return;
  let head=document.getElementById('w47head');
  if(!head){head=document.createElement('div');head.id='w47head';pane.insertBefore(head,pane.firstChild)}
  if(target.parentNode!==head)head.insertBefore(target,head.firstChild);
  const act=pane.querySelector('.dev-actions');
  if(act&&act.parentNode!==head)head.appendChild(act);
  if(act){
    if(!document.getElementById('w47presetsBtn')){const b=document.createElement('button');b.type='button';b.id='w47presetsBtn';b.className='btn sm';b.setAttribute('aria-haspopup','true');b.setAttribute('aria-expanded','false');
      b.innerHTML=`${svg(GRID_IC,14)}<span>Préréglages</span>${svg('<path d="M6 8l4 4 4-4"/>',12)}`;
      const au=document.getElementById('btnAuto');au.after(b);b.addEventListener('click',e=>{e.stopPropagation();togglePresets()})}
    const au=document.getElementById('btnAuto');if(au){au.innerHTML=`${svg('<path d="M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6z"/>',14)}<span>Auto</span>`}
    const rs=document.getElementById('btnResetAll');if(rs){rs.innerHTML=svg(RESET_IC,15);rs.title='Tout réinitialiser';rs.setAttribute('aria-label','Tout réinitialiser');rs.classList.add('w47-ic')}}
  const wb=document.getElementById('btnWB');if(wb&&!wb.dataset.w47){wb.dataset.w47='1';wb.className='w47-wb';wb.innerHTML=svg(PIPETTE,14);wb.title='Balance des blancs : cliquez ensuite sur un gris ou un blanc';wb.setAttribute('aria-label','Pipette balance des blancs');
    wb.addEventListener('dblclick',e=>e.stopPropagation(),true);wb.addEventListener('contextmenu',e=>e.stopPropagation(),true)}
  /* sub-headings on tall windows, a 1px divider otherwise */
  const temp=pane.querySelector('.row[data-k=temp]'),expo=pane.querySelector('.row[data-k=exposure]');
  if(temp&&!pane.querySelector('.w47-sub[data-w47sub=wb]')){const s=document.createElement('div');s.className='w47-sub';s.dataset.w47sub='wb';s.innerHTML='<span>Balance des blancs</span>';temp.parentNode.insertBefore(s,temp)}
  if(expo&&!pane.querySelector('.w47-sub[data-w47sub=tone]')){const g=document.createElement('div');g.className='w47-gap';const s=document.createElement('div');s.className='w47-sub';s.dataset.w47sub='tone';s.innerHTML='<span>Tonalité</span>';expo.parentNode.insertBefore(g,expo);expo.parentNode.insertBefore(s,expo)}
  placeWB();
  /* section headers: reset as an icon */
  pane.querySelectorAll('details.sec[data-sec] .rs[data-reset]').forEach(b=>{if(b.dataset.w47)return;b.dataset.w47='1';b.innerHTML=svg(RESET_IC,14);b.setAttribute('aria-label','Réinitialiser ce groupe');b.title='Réinitialiser ce groupe'});
  /* remembered open / closed state */
  pane.querySelectorAll('details.sec[data-sec]').forEach(d=>{const id=d.dataset.sec;if(id==='presets')return;if(id in SECMAP)d.open=!!SECMAP[id]});
  /* on the phone the presets stay closed until asked for */
  const pr=pane.querySelector('details[data-sec=presets]');if(pr&&!pr.dataset.w47){pr.dataset.w47='1';pr.removeAttribute('open')}
}
function togglePresets(force){
  const d=pane.querySelector('details[data-sec=presets]'),b=document.getElementById('w47presetsBtn');if(!d||!b)return;
  const open=force!==undefined?force:!d.open;
  if(open){const r=b.getBoundingClientRect(),pr=pane.getBoundingClientRect();
    d.style.setProperty('--w47pl',Math.round(pr.left+8)+'px');d.style.setProperty('--w47pt',Math.round(r.bottom+6)+'px');d.style.setProperty('--w47pw',Math.round(pr.width-16)+'px');
    d.style.setProperty('--w47pm',Math.max(180,Math.round(innerHeight-r.bottom-24))+'px')}
  d.open=open;b.setAttribute('aria-expanded',open);b.classList.toggle('on',open);if(open)requestAnimationFrame(()=>{try{renderThumbs()}catch(e){}})}
document.addEventListener('pointerdown',e=>{const d=pane.querySelector('details[data-sec=presets]');if(!d||!d.open)return;if(e.target.closest('details[data-sec=presets],#w47presetsBtn,.menu'))return;togglePresets(false)},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const d=pane.querySelector('details[data-sec=presets]');if(d&&d.open&&!document.getElementById('pop')&&!document.querySelector('.menu')){togglePresets(false);e.stopPropagation()}}},true);
addEventListener('resize',()=>togglePresets(false));
pane.addEventListener('toggle',e=>{const d=e.target;if(!d||!d.matches||!d.matches('details.sec[data-sec]'))return;const id=d.dataset.sec;if(id==='presets')return;SECMAP[id]=d.open;saveSec()},true);
pane.addEventListener('click',e=>{if(!e.altKey)return;const sm=e.target.closest('summary');if(!sm||e.target.closest('button'))return;const d=sm.parentNode;if(!d||!d.matches||!d.matches('details.sec[data-sec]')||d.dataset.sec==='presets')return;
  e.preventDefault();e.stopPropagation();d.open=true;pane.querySelectorAll('details.sec[data-sec]').forEach(x=>{if(x!==d&&x.dataset.sec!=='presets')x.open=false})},true);
/* the head: target chip, actions, zone row. Wraps renderTarget (outermost). */
W47.lastAdj=null;
function noteAdj(){const A=S.doc&&AL();if(A&&A.kind==='adjust')W47.lastAdj=A}
function lastAdjIndex(){const d=S.doc;if(!d)return -1;let i=W47.lastAdj?d.layers.indexOf(W47.lastAdj):-1;if(i<0)for(let k=d.layers.length-1;k>=0;k--)if(d.layers[k].kind==='adjust'){i=k;break}return i}
function homeTarget(){
  const el=document.getElementById('target'),d=S.doc;if(!el||!d)return;
  const head=document.getElementById('w47head');if(!head)return;
  noteAdj();
  const A=AL(),sel=document.getElementById('tgSel');
  const old=document.getElementById('w47zone');if(old)old.remove();
  const zone=el.querySelectorAll('.tg-row')[1];
  if(zone&&A&&A.kind==='adjust'&&A.mask){zone.id='w47zone';zone.classList.add('w47-zone');const k=zone.querySelector('.tg-l');if(k)k.textContent='Zone du réglage';
    zone.querySelectorAll('.tbtn').forEach(b=>{const s=b.querySelector('span');if(s){b.title={brush:'Ajouter à la zone (Pinceau)',erase:'Retirer de la zone (Gomme)',linear:'Dégradé linéaire',radial:'Dégradé radial',invert:'Inverser la zone',show:'Voir la zone (⇧M)'}[b.dataset.mask]||s.textContent;b.setAttribute('aria-label',b.title)}});
    head.appendChild(zone)}
  if(sel){sel.title='Réglage modifié';sel.setAttribute('aria-label','Réglage modifié');
    [...sel.options].forEach(o=>{const i=o.value===''?-1:+o.value;const L=i>=0?d.layers[i]:null;
      if(L)o.textContent=`${L.name} · ${L.mask?'local':'toute la photo'}`;else if(A)o.textContent=`${A.name} · calque de pixels`})}
  const nw=document.getElementById('tgNew');if(nw&&!nw.dataset.w47){nw.dataset.w47='1'}
  if(nw){nw.innerHTML=svg(PLUS_IC,15);nw.title='Nouveau réglage';nw.setAttribute('aria-label','Nouveau réglage')}
  const pix=!(A&&A.kind==='adjust');head.dataset.pix=pix?'1':'0';
  const note=el.querySelector('.tnote');
  if(pix&&A){const ai=lastAdjIndex();const aN=ai>=0?d.layers[ai].name:'';
    const n=document.createElement('div');n.className='w47-notice';
    n.innerHTML=`<p>« ${esc(A.name)} » est un calque de pixels.</p><div class="w47-nb">${ai>=0?`<button class="btn sm" type="button" data-w47go="${ai}">Régler « ${esc(aN)} »</button>`:''}<button class="btn sm" type="button" data-w47new="1">Nouveau réglage au-dessus</button></div>`;
    if(note)note.replaceWith(n);else el.appendChild(n)}
  head.style.setProperty('--w47hh',head.offsetHeight+'px')}
{const _rt=renderTarget;renderTarget=function(){const r=_rt.apply(this,arguments);safe('target',()=>{homeDevelop();homeTarget()});return r}}
pane.addEventListener('click',e=>{const g=e.target.closest&&e.target.closest('[data-w47go]');if(g){const i=+g.dataset.w47go;setActiveLayer(i);return}
  if(e.target.closest&&e.target.closest('[data-w47new]')){addAdjust('global')}},false);
if(typeof syncLayers==='function'){const _sl2=syncLayers;syncLayers=function(){noteAdj();return _sl2.apply(this,arguments)}}
{const _bd=buildDevelop;buildDevelop=function(){const r=_bd.apply(this,arguments);safe('develop.build',()=>{homeDevelop();homeTarget()});return r}}
safe('develop.first',()=>{homeDevelop();renderTarget()});
const _after=W47.afterLayout;W47.afterLayout=()=>{safe('after.wb',placeWB);try{_after&&_after()}catch(e){}};
W47.addCss(`
/* sticky head: target chip, actions, zone row (all stay inside #pane-develop: its click / input handlers are delegated on it) */
#pane-develop{padding-bottom:16px;scroll-padding-top:var(--w47hh,110px)}
#w47head{position:sticky;top:0;z-index:6;background:var(--chrome);border-bottom:1px solid var(--line)}
#w47head #target{margin:0;padding:8px 8px 4px 12px;border:0;border-radius:0;background:none;display:block}
#w47head .tg-row{display:block}
#w47head .tg-l{display:none}
#w47head #w47zone .tg-l{display:block}
#w47head .tg-ctl{display:flex;gap:6px;min-width:0}
#tgSel{flex:1;min-width:0;height:28px;min-height:28px;padding:0 24px 0 28px;font-size:12.5px;font-weight:500;border-color:var(--line-2);border-radius:var(--r-s);
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Ccircle cx='10' cy='10' r='6.5' fill='none' stroke='%23999' stroke-width='1.6'/%3E%3Cpath d='M10 3.5a6.5 6.5 0 000 13z' fill='%23999'/%3E%3C/svg%3E"),url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='M6 8l4 4 4-4' fill='none' stroke='%23888' stroke-width='1.8' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:8px 50%,right 6px center;background-size:15px 15px,16px 16px;text-overflow:ellipsis}
#tgNew{width:28px;height:28px;min-height:28px;padding:0;flex:none;border-radius:var(--r-s)}
#tgNew svg{width:15px;height:15px}
#tgNew span{display:none}
#w47head .dev-actions{display:flex;align-items:center;gap:6px;padding:4px 8px 8px 12px;flex-wrap:nowrap}
#w47head .dev-actions .btn{min-height:28px;padding:0 9px;gap:6px;font-size:12.5px}
#w47head .dev-actions .btn svg{width:14px;height:14px}
#w47head .dev-actions .btn[aria-expanded=true]{background:var(--accent-soft);border-color:var(--accent-line);color:var(--accent-fg)}
#btnResetAll.w47-ic{margin-left:auto;width:28px;padding:0;border-color:transparent;background:none;color:var(--fg-2)}
#btnResetAll.w47-ic:hover{background:var(--hover);color:var(--fg)}
#w47head svg,#btnWB svg,.rs svg,.w47-composer svg{pointer-events:none}
#w47head[data-pix="1"] .dev-actions{display:none}
#w47head .w47-zone{display:flex;align-items:center;gap:6px;padding:0 8px 8px 12px}
#w47head .w47-zone .tg-l{font-size:11px;font-weight:400;color:var(--fg-3);margin-right:auto;white-space:nowrap}
#w47head .w47-zone .tg-tools{display:flex;gap:2px;grid-template-columns:none}
#w47head .w47-zone .tbtn{width:30px;height:26px;padding:0;border:0;background:none;border-radius:var(--r-s);flex-direction:row;justify-content:center}
#w47head .w47-zone .tbtn svg{width:15px;height:15px}
#w47head .w47-zone .tbtn span{display:none}
#w47head .w47-zone .tbtn:hover{background:var(--hover);color:var(--fg)}
#w47head .w47-zone .tbtn.on{background:var(--accent-soft);color:var(--accent-fg)}
.w47-notice{padding:6px 0 4px}
.w47-notice p{margin:0 0 8px;font-size:12.5px;color:var(--fg-2);line-height:1.45}
.w47-nb{display:flex;gap:6px;flex-wrap:wrap}
/* presets popover (the existing <details> grid, shown as a popover) */
details[data-sec=presets]{border:0}
details[data-sec=presets]>summary{display:none}
details[data-sec=presets]:not([open]){display:none}
details[data-sec=presets][open]{position:fixed;z-index:70;left:var(--w47pl,8px);top:var(--w47pt,120px);width:var(--w47pw,280px);max-height:var(--w47pm,60vh);overflow:auto;background:var(--menu);border:1px solid var(--line-2);border-radius:var(--r);box-shadow:var(--shadow);padding-top:8px}
details[data-sec=presets] .presets{padding:0 10px 12px;gap:8px}
/* white balance pipette + sub-headings */
.w47-wb{display:inline-grid;place-items:center;width:20px;height:18px;margin-left:6px;padding:0;border:0;border-radius:4px;background:none;color:var(--fg-3);vertical-align:-3px}
.w47-wb:hover{background:var(--hover);color:var(--fg)}
.w47-wb.on{background:var(--accent-soft);color:var(--accent-fg)}
.w47-sub{display:none;align-items:center;height:22px;margin-top:6px;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--fg-3);font-weight:500}
.w47-sub span{flex:1}
.w47-sub .w47-wb{margin:0;vertical-align:0}
.w47-gap{height:1px;background:var(--line);margin:6px 0 4px}
.secbody>div[style*="height:8px"]:has(+.w47-gap),.secbody>div[style*="height:8px"]:has(+.w47-sub){display:none}
body.w47-tall .w47-sub{display:flex}
body.w47-tall .w47-gap{display:none}
/* section headers */
details.sec>summary{min-height:34px;padding:0 8px 0 12px;font-size:12.5px;gap:6px}
details.sec>summary .eyeb{margin-left:auto}
details.sec>summary .rs{margin-left:0;padding:0;width:24px;height:24px;display:grid;place-items:center;color:var(--fg-3)}
details.sec>summary .rs svg{width:14px;height:14px}
details.sec>summary .eyeb,details.sec>summary .rs{opacity:0;transition:opacity .12s}
details.sec.mod>summary .eyeb,details.sec.mod>summary .rs,details.sec>summary:hover .eyeb,details.sec>summary:hover .rs,details.sec>summary:focus-within .eyeb,details.sec>summary:focus-within .rs,details.sec>summary .eyeb.on{opacity:1}
@media (hover:none){details.sec>summary .eyeb,details.sec>summary .rs{opacity:1}}
.secbody{padding:2px 12px 10px}
`);
/* ====================================================================== M. menus + palette ===================================================================
   Nothing is removed: items are moved, one submenu is merged, one label renamed; the palette keeps the old names as aliases. */
const isIt=x=>x&&typeof x==='object'&&x.label;
const take=(a,test)=>{const i=a.findIndex(x=>isIt(x)&&test(x.label));return i<0?null:a.splice(i,1)[0]};
const tidySep=a=>{const o=[];for(const x of a){if(x===SEP&&(!o.length||o[o.length-1]===SEP))continue;o.push(x)}while(o.length&&o[o.length-1]===SEP)o.pop();return o};
const subOf=it=>{let c=[];try{c=typeof it.sub==='function'?it.sub():it.sub}catch(e){}return Array.isArray(c)?c:[]};
safe('menus',()=>{
  if(MENU2.view.items.__w47)return;
  const wrap=(k,f)=>{const o=MENU2[k].items;const n=()=>{let a=o();try{a=f(a)||a}catch(e){console.warn('w47 menu '+k,e)}return tidySep(a)};n.__w47=1;MENU2[k].items=n};
  const moved={};
  wrap('view',a=>{moved.review=take(a,l=>l==='Avis partagés');
    const p=a.find(x=>isIt(x)&&x.label==='Panneaux');
    if(p&&!p.__w47){const s=p.sub;p.sub=()=>{const c=subOf({sub:s});
      c.push(MI('Actions rapides',{check:!document.body.classList.contains('w47-noqa'),fn:()=>W47.toggleQA()}));return c};p.__w47=1}
    return a});
  wrap('edit',a=>{moved.tf=take(a,l=>l==='Transformation libre');return a});
  wrap('layer',a=>{moved.puppet=take(a,l=>/^Déformation marionnette/.test(l));
    const mf=take(a,l=>l==='Masques et fusion'),mk=a.find(x=>isIt(x)&&x.label==='Masque'&&x.sub);
    if(mf&&mk){const ms=mk.sub;mk.sub=()=>[...subOf({sub:ms}),SEP,...subOf(mf)]}else if(mf)a.push(mf);
    return a});
  const fetchMoved=()=>{try{MENU2.view.items();MENU2.edit.items();MENU2.layer.items()}catch(e){}};
  wrap('file',a=>{fetchMoved();if(moved.review){const i=a.findIndex(x=>isIt(x)&&/^Partager pour avis/.test(x.label));a.splice(i<0?a.length:i+1,0,{...moved.review,icon:moved.review.icon||'share'})}return a});
  wrap('image',a=>{fetchMoved();const add=[];
    if(moved.tf)add.push({...moved.tf,icon:moved.tf.icon||'transform'});
    if(moved.puppet)add.push(moved.puppet);
    if(add.length){const i=a.findIndex(x=>isIt(x)&&x.label==='Symétrie');a.splice(i<0?a.length:i+1,0,...add)}return a});
  wrap('filter',a=>a.map(x=>isIt(x)&&x.label==='Effets du calque…'?{...x,label:'Effets de filtre…'}:x));
});
W47.toggleQA=()=>safe('qa.toggle',()=>{const on=document.body.classList.toggle('w47-noqa');try{PREF.set('w47qa',!on)}catch(e){}W47.afterLayout&&W47.afterLayout()});
safe('qa.pref',()=>{if(PREF.get('w47qa',true)===false)document.body.classList.add('w47-noqa')});
W47.addCss(`body.w47-noqa #qaPanel{display:none!important}`);
safe('palette',()=>{
  const prev=cmdItems;if(prev.__w47)return;
  cmdItems=function(){let a=prev.apply(this,arguments);
    try{if(window.LIB&&LIB.open)return a;
      const nz=s=>String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
      a=a.map(i=>i.g==='Panneaux'?{...i,label:String(i.label).replace(/\s*\d+$/,'')}:i);
      const have=new Set(a.map(i=>i.g+'|'+nz(i.label)));const out=[...a];
      const find=lab=>a.find(i=>nz(i.label)===nz(lab));
      const al=(old,nw)=>{const t=find(nw);if(!t)return;const k=t.g+'|'+nz(old);if(have.has(k))return;have.add(k);out.push({...t,label:old})};
      al('Effets du calque','Effets de filtre');
      al('Masques et fusion','Masque dégradé');
      const tn=W47.oldToolNames||{};for(const o in tn)al(o,tn[o]);
      return out}catch(e){return a}};
  cmdItems.__w47=1});
/* ====================================================================== L. layers dock polish (the dock stays on the left) ===================================================================== */
W47.addCss(`
.lyr-dock .lyrs li.lyr:has(.mth) .th{width:34px;height:30px}
.lyr-dock .lyrs li.lyr:has(.mth) .th.adj svg{width:15px;height:15px}
.lyr-dock .lyrs li.lyr:has(.mth){gap:5px}
.lyr-dock .lyrs li.lyr .nm{min-width:0}
`);


})();

/* zgrad: the zone touched by a gradient is always shown. While dragging: also on a global adjustment (no mask yet). After release: the zone stays visible for 2 s. */
(()=>{
let fid=0;
const flash=()=>{if(S.showMask)return;S.showMask=true;const id=++fid;S.flashZ=id;try{renderTarget()}catch(e){}requestRender();setTimeout(()=>{if(S.flashZ===id&&S.showMask){S.showMask=false;S.flashZ=0;try{renderTarget()}catch(e){}requestRender()}},2000)};
const _gc=gradientCommit;gradientCommit=function(dr){const L=dr&&dr.target,n0=L&&L.mask;const r=_gc.apply(this,arguments);try{if(L&&L.kind==='adjust'&&L.mask&&L.mask!==n0&&S.doc&&S.doc.layers.includes(L))flash()}catch(e){}return r};
const _tm=toggleMask;toggleMask=function(){S.flashZ=0;return _tm.apply(this,arguments)};
})();

