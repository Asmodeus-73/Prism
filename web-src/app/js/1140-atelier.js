/* ================= 1.0 : l'atelier (nouvelle interface, écrans larges) =================
   Mise en page en cartes : outils | panneau de gauche (Navigateur, Calques) | photo | colonne de droite (réglages).
   - Le panneau de gauche se replie en barre d'icônes et garde son organisation ; la colonne de droite reste fixe.
   - En-tête : bascule Photothèque / Éditeur, espaces de travail, engrenage des paramètres.
   - Paramètres : compte, personnalisation (accent, thème, arrondis), langue, raccourcis.
   Rien ne change sur téléphone et tablette (≤ 1100 px), ni l'identité par défaut (couleurs, logo, Geist). */
(()=>{
const WIDE=matchMedia('(min-width:1101px)');
const LOOK0={acc:0,custom:'#e0567a',tint:'',rnd:1};
const ACC=[['Indigo',null],['Violet','#8b6cf0'],['Bleu','#2f8cf0'],['Vert','#22a06b'],['Ambre','#e08a1e'],['Rose','#e0567a']];
const TINTS={graphite:{bg:'#1e1e22',stage:'#1e1e22',chrome:'#2a2a2f',chrome2:'#323238',raise:'#3a3a40',hover:'#36363c',menu:'#303036',line:'#38383e',line2:'#46464d',field:'#1f1f23'},
  nuit:{bg:'#0a0d16',stage:'#0a0d16',chrome:'#141a2a',chrome2:'#1a2133',raise:'#232b40',hover:'#1f2639',menu:'#1a2133',line:'#232b3d',line2:'#2f384e',field:'#0d111c'}};
const RND=[[4,3,6],[8,6,12],[12,9,16]];
const ICO={
  rail:'<svg viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="12" rx="2"/><path d="M8 4v12"/></svg>',
  nav:'<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7"/><path d="m12.8 7.2-1.7 3.9-3.9 1.7 1.7-3.9z"/></svg>',
  layers:'<svg viewBox="0 0 20 20"><path d="m10 3 7 4-7 4-7-4z"/><path d="m3 10.5 7 4 7-4"/><path d="m3 14 7 4 7-4"/></svg>',
  grid:'<svg viewBox="0 0 20 20"><rect x="3" y="3" width="6" height="6" rx="1.2"/><rect x="11" y="3" width="6" height="6" rx="1.2"/><rect x="3" y="11" width="6" height="6" rx="1.2"/><rect x="11" y="11" width="6" height="6" rx="1.2"/></svg>',
  edit:'<svg viewBox="0 0 20 20"><path d="M4 16h3l8.5-8.5a2.1 2.1 0 0 0-3-3L4 13z"/></svg>',
  gear:'<svg viewBox="0 0 24 24"><path d="M10.3 3.6a1.7 1.7 0 0 1 3.4 0 1.7 1.7 0 0 0 2.6 1.1 1.7 1.7 0 0 1 2.4 2.4 1.7 1.7 0 0 0 1.1 2.6 1.7 1.7 0 0 1 0 3.4 1.7 1.7 0 0 0-1.1 2.6 1.7 1.7 0 0 1-2.4 2.4 1.7 1.7 0 0 0-2.6 1.1 1.7 1.7 0 0 1-3.4 0 1.7 1.7 0 0 0-2.6-1.1 1.7 1.7 0 0 1-2.4-2.4 1.7 1.7 0 0 0-1.1-2.6 1.7 1.7 0 0 1 0-3.4 1.7 1.7 0 0 0 1.1-2.6 1.7 1.7 0 0 1 2.4-2.4 1.7 1.7 0 0 0 2.6-1.1z"/><circle cx="12" cy="12" r="3"/></svg>',
  chev:'<svg viewBox="0 0 20 20"><path d="m6 8 4 4 4-4"/></svg>',
  user:'<svg viewBox="0 0 20 20"><circle cx="10" cy="7" r="3.2"/><path d="M4 17a6 6 0 0 1 12 0"/></svg>',
  brush:'<svg viewBox="0 0 20 20"><circle cx="6" cy="14" r="3"/><path d="m8.5 11.5 7-7"/></svg>',
  globe:'<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7"/><path d="M3 10h14M10 3c2.2 2 2.2 12 0 14M10 3c-2.2 2-2.2 12 0 14"/></svg>',
  keys:'<svg viewBox="0 0 20 20"><rect x="2.5" y="5" width="15" height="10" rx="2"/><path d="M6 8.5h1M9.5 8.5h1M13 8.5h1M6.5 11.8h7"/></svg>'};
const WS=[['dev','Développer','Lumière, couleur, effets','#ffb648'],['ret','Retouche','Pinceaux, correcteur, IA','#5fcf86'],['comp','Composer','Calques et mise en page','#9a78ff'],['mine','Mon espace','Votre disposition','#46b3ff']];

const st=document.createElement('style');st.id='atCss';st.textContent=`
#atSwitch{display:none}
body.atelier #atSwitch{display:inline-flex;align-items:center;gap:2px;height:30px;padding:2px;margin:0 4px 0 6px;border-radius:calc(var(--r) + 1px);background:var(--chrome-2);flex:none}
#atSwitch button{height:26px;padding:0 12px;border:0;border-radius:var(--r-s);background:none;color:var(--fg-3);font:500 12.5px var(--ui);cursor:pointer;white-space:nowrap}
#atSwitch button:hover{color:var(--fg)}
#atSwitch button[aria-pressed=true]{background:var(--raise);color:var(--fg);box-shadow:var(--shadow-s)}
body.atelier #bLib{display:none!important}
#atWs,#atGear{display:none}
body.atelier:not(.no-doc) #atWs{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 10px 0 11px;border:1px solid var(--line);border-radius:var(--r);background:var(--chrome);color:var(--fg-3);font:12.5px var(--ui);white-space:nowrap;cursor:pointer}
#atWs:hover{border-color:var(--line-2);color:var(--fg)}
#atWs b{color:var(--fg);font-weight:600}#atWs i{width:7px;height:7px;border-radius:50%;flex:none}
#atWs svg,#atGear svg,#atRail .at-h svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
#atWs svg{width:14px;height:14px}
body.atelier #atGear{display:inline-grid;place-items:center;width:32px;height:32px;border:0;border-radius:var(--r);background:none;color:var(--fg-2);cursor:pointer;flex:none}
body.atelier.no-doc .bar-r>#atGear{display:inline-grid!important}
body.atelier.no-doc #docname{display:none!important}
body.no-doc #atSwitch button[data-v=ed]{opacity:.55}
#atGear:hover{background:var(--hover);color:var(--fg)}
/* --- la mise en page en cartes --- */
body.atelier:not(.no-doc) .work{--railw:280px;grid-template-columns:var(--toolw) var(--railw) minmax(0,1fr) var(--side);gap:8px;padding:8px;background:var(--bg)}
body.atelier.at-fold:not(.no-doc) .work{--railw:44px}
body.atelier:not(.no-doc) .work>#dock,body.atelier:not(.no-doc) .work>#stage,body.atelier:not(.no-doc) .work>.insp,#atRail .at-card{border:1px solid var(--line);border-radius:var(--r-l);overflow:hidden}
body.atelier:not(.no-doc) .work>#dock{background:var(--chrome)}
body.atelier:not(.no-doc) .work>.insp{background:var(--chrome);border-left:1px solid var(--line)}
body.atelier:not(.no-doc) #stage{background:var(--stage)}
body.atelier #lySplit{display:none!important}
body.atelier.focus:not(.no-doc) .work{grid-template-columns:0 0 minmax(0,1fr) 0!important;gap:0;padding:0}
body.atelier.focus:not(.no-doc) .work>#stage{border:0;border-radius:0}
body.atelier.focus #atRail,body.atelier.focus #atStrip{overflow:hidden;visibility:hidden;border:0}
body.atelier:not(.no-doc) .insp #pane-develop{flex:1 1 auto}
#atRail{display:none}
body.atelier:not(.no-doc) #atRail{display:flex;flex-direction:column;gap:8px;min-height:0;min-width:0}
#atRail .at-card{background:var(--chrome);display:flex;flex-direction:column;min-height:0}
#atRail .at-h{display:flex;align-items:center;gap:8px;height:34px;padding:0 6px 0 12px;font-weight:600;font-size:12.5px;color:var(--fg);flex:none}
#atRail .at-h .dot{width:6px;height:6px;border-radius:50%;background:#46b3ff;flex:none}
#atRail .at-h span{flex:1}
#atRail .at-h button,#atStrip button{display:grid;place-items:center;width:26px;height:26px;border:0;border-radius:var(--r-s);background:none;color:var(--fg-3);cursor:pointer}
#atRail .at-h button:hover,#atStrip button:hover{background:var(--hover);color:var(--fg)}
#atNav{flex:none}
#atNav .at-prev{position:relative;margin:0 12px;height:150px;border-radius:var(--r-s);background:var(--field);overflow:hidden;cursor:crosshair}
#atNav canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
#atNav .at-vp{position:absolute;border:1.5px solid #fff;border-radius:2px;box-shadow:0 0 0 999px rgba(0,0,0,.28);pointer-events:none}
#atNav .at-zoom{display:flex;align-items:center;gap:8px;padding:10px 12px 12px;font:11.5px var(--num);color:var(--fg-2)}
#atNav .at-zoom input{flex:1;min-width:0}
#atNav .at-zoom button{height:24px;padding:0 8px;border:1px solid var(--line);border-radius:var(--r-s);background:none;color:var(--fg-2);font:500 11.5px var(--ui);cursor:pointer}
#atNav .at-zoom button:hover{color:var(--fg);border-color:var(--line-2)}
#atNav .at-zoom output{width:42px;text-align:right}
body.atelier #atRail #layersPanel{flex:1 1 auto;height:auto!important;min-height:120px;border:1px solid var(--line);border-radius:var(--r-l);background:var(--chrome);overflow:hidden;display:flex;flex-direction:column}
body.atelier #atRail #layersPanel #pane-layers{flex:1 1 auto;min-height:0}
#atRail.closed-nav #atNav .at-body{display:none}
#atRail.closed-nav #atNavFold svg{transform:rotate(-90deg)}
body.atelier #atRail .lyr-btns{flex-wrap:nowrap;gap:0;padding:4px;justify-content:space-between}
body.atelier #atRail .lyr-btns .ib{width:28px}
#atStrip{display:none}
body.atelier.at-fold:not(.no-doc) #atRail{display:none}
body.atelier.at-fold:not(.no-doc) #atStrip{display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 0;border:1px solid var(--line);border-radius:var(--r-l);background:var(--chrome);min-height:0}
#atStrip button{width:32px;height:32px;position:relative}
#atStrip button svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
#atStrip button i{position:absolute;right:5px;top:5px;width:5px;height:5px;border-radius:50%}
#atRailBtn{display:none}
body.atelier:not(.no-doc) #atRailBtn{display:grid;place-items:center;width:30px;height:28px;margin-right:4px;border:0;border-radius:var(--r-s);background:var(--hover);color:var(--fg);cursor:pointer;flex:none}
body.atelier.at-fold #atRailBtn{background:none;color:var(--fg-3)}
#atRailBtn svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6}
/* --- photothèque en cartes --- */
body.atelier .library{padding:8px;gap:8px;grid-template-rows:48px minmax(0,1fr)}
body.atelier .lb-top{border:1px solid var(--line);border-radius:var(--r-l);padding:0 8px 0 12px}
body.atelier .lb-body{gap:8px}
body.atelier .library:not(.has-info) .lb-body{grid-template-columns:240px minmax(0,1fr) 0;gap:8px 0}
body.atelier .library:not(.has-info) .lb-main{margin-left:8px}
body.atelier .library.has-info .lb-body{grid-template-columns:240px minmax(0,1fr) 300px}
body.atelier .lb-side,body.atelier .lb-main,body.atelier .lb-info{border:1px solid var(--line);border-radius:var(--r-l);background:var(--chrome)}
body.atelier .library:not(.has-info) .lb-info{border:0;padding:0}
body.atelier .lb-main{overflow:hidden}
body.atelier .lb-grid{gap:14px;padding:14px 16px}
body.atelier .lb-card{background:var(--chrome-2);border-color:transparent}
body.atelier .lb-card:hover{border-color:var(--line-2)}
body.atelier .lb-filters{gap:6px 10px;padding:8px 12px}
body.atelier .lb-filters .btn{height:28px}
/* --- paramètres --- */
.dlg:has(.at-set){width:min(800px,calc(100vw - 32px))}
.at-set{display:grid;grid-template-columns:190px minmax(0,1fr);gap:0;min-height:420px;margin:-4px -4px 0}
.at-set nav{display:flex;flex-direction:column;gap:2px;padding:0 12px 0 0;border-right:1px solid var(--line)}
.at-set nav button{display:flex;align-items:center;gap:10px;height:34px;padding:0 10px;border:0;border-radius:var(--r-s);background:none;color:var(--fg-2);font:13px var(--ui);text-align:left;cursor:pointer}
.at-set nav button:hover{background:var(--hover);color:var(--fg)}
.at-set nav button[aria-current=true]{background:var(--accent-soft);color:var(--fg)}
.at-set nav svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;flex:none}
.at-set section{padding:0 4px 0 22px;display:flex;flex-direction:column;gap:18px}
.at-set h4{margin:0 0 9px;font-size:12.5px;font-weight:600;color:var(--fg)}
.at-set p.muted{margin:0;font-size:12.5px;line-height:1.5}
.at-sw{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.at-sw button{width:28px;height:28px;border-radius:50%;border:0;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(255,255,255,.15)}
.at-sw button[aria-pressed=true]{box-shadow:0 0 0 2px var(--chrome),0 0 0 4px var(--fg)}
.at-sw label{position:relative;width:28px;height:28px;border-radius:50%;background:conic-gradient(#ff5d6c,#ffb648,#5fe39b,#46b3ff,#9a78ff,#ff5d6c);cursor:pointer}
.at-sw label.on{box-shadow:0 0 0 2px var(--chrome),0 0 0 4px var(--fg)}
.at-sw input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.at-th{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
.at-th button{display:flex;flex-direction:column;gap:7px;padding:6px 6px 8px;border:1px solid var(--line);border-radius:var(--r);background:none;color:var(--fg-2);font:12px var(--ui);cursor:pointer;text-align:left}
.at-th button:hover{border-color:var(--line-2)}
.at-th button[aria-pressed=true]{border-color:var(--accent);color:var(--fg);box-shadow:0 0 0 1px var(--accent)}
.at-th i{display:block;height:40px;border-radius:5px;position:relative;overflow:hidden}
.at-th i::before,.at-th i::after{content:"";position:absolute;top:6px;bottom:6px;border-radius:3px;background:var(--a)}
.at-th i::before{left:6px;width:7px}.at-th i::after{right:6px;width:22px}
.at-seg{display:inline-flex;gap:2px;padding:2px;border-radius:calc(var(--r) + 1px);background:var(--chrome-2)}
.at-seg button{height:28px;padding:0 12px;border:0;border-radius:var(--r-s);background:none;color:var(--fg-3);font:12.5px var(--ui);cursor:pointer}
.at-seg button[aria-pressed=true]{background:var(--accent-soft);color:var(--fg)}
.at-row{display:flex;align-items:center;justify-content:space-between;gap:16px}
.at-row>span{font-size:12.5px;font-weight:600;color:var(--fg)}
.at-acts{display:flex;gap:8px;flex-wrap:wrap}
`;document.body.appendChild(st);

/* ---- apparence : accent, teinte, arrondis ---- */
const look=()=>Object.assign({},LOOK0,PREF.get('look',{}));
const hex=h=>{h=String(h||'').replace('#','');if(h.length===3)h=h.replace(/./g,'$&$&');const n=parseInt(h,16);return isNaN(n)?[91,103,240]:[n>>16&255,n>>8&255,n&255]};
const mix=(c,t,a)=>c.map((v,i)=>Math.round(v+(t[i]-v)*a));
const css=c=>'rgb('+c.join(',')+')';
function applyLook(){const L=look();let s='';
  const a=L.acc===-1?L.custom:(ACC[L.acc]||ACC[0])[1];
  if(a){const c=hex(a);
    s+=`:root{--accent:${css(c)};--accent-fg:${css(mix(c,[255,255,255],.45))};--accent-soft:rgba(${c},.2);--accent-line:rgba(${mix(c,[255,255,255],.2)},.6)}`;
    s+=`:root[data-theme="light"]{--accent:${css(c)};--accent-fg:${css(mix(c,[0,0,0],.25))};--accent-soft:rgba(${c},.12);--accent-line:rgba(${c},.55)}`;
    s+=`#bExport{background:var(--accent)!important;box-shadow:0 1px 0 rgba(255,255,255,.18) inset,0 4px 14px -4px rgba(${c},.7)!important}`;
    s+=`@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){--accent:${css(c)};--accent-fg:${css(mix(c,[0,0,0],.25))};--accent-soft:rgba(${c},.12);--accent-line:rgba(${c},.55)}}`}
  const T=TINTS[L.tint];if(T)s+=`:root[data-theme="dark"]{--bg:${T.bg};--stage:${T.stage};--chrome:${T.chrome};--chrome-2:${T.chrome2};--raise:${T.raise};--hover:${T.hover};--menu:${T.menu};--line:${T.line};--line-2:${T.line2};--field:${T.field}}`;
  const R=RND[L.rnd]||RND[1];if(L.rnd!==1)s+=`:root{--r:${R[0]}px;--r-s:${R[1]}px;--r-l:${R[2]}px}`;
  let el=$('#atLook');if(!el){el=document.createElement('style');el.id='atLook';document.body.appendChild(el)}el.textContent=s;
  try{S.contentDirty=true;requestRender()}catch(e){}}
function setLook(o){PREF.set('look',Object.assign(look(),o));applyLook()}
function setTheme(k){const L=look();if(k==='graphite'||k==='nuit'){themeSet('dark');setLook({tint:k})}else{if(L.tint)setLook({tint:''});themeSet(k)}}
const themeNow=()=>{const L=look(),t=PREF.get('theme','auto');return t==='dark'&&L.tint?L.tint:t};
applyLook();

/* ---- en-tête ---- */
const bar=$('header.bar'),barR=$('.bar-r'),mark=$('.bar-l .mark');
const sw=document.createElement('div');sw.id='atSwitch';sw.setAttribute('role','group');sw.setAttribute('aria-label','Vue');
sw.innerHTML='<button type="button" data-v="lib">Photothèque</button><button type="button" data-v="ed">Éditeur</button>';
if(mark)mark.after(sw);
sw.onclick=e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.v==='lib'){if(!LIB.open)openLibrary()}
  else{if(LIB.open)closeLibrary();if(!S.doc)toast('Ouvrez une photo pour l’éditer')}
  paintSwitch()};
function paintSwitch(){const lib=!!LIB.open;for(const b of sw.children)b.setAttribute('aria-pressed',String(b.dataset.v==='lib'?lib:!lib&&!!S.doc))}
const wsB=document.createElement('button');wsB.id='atWs';wsB.type='button';wsB.setAttribute('aria-haspopup','menu');
const gear=document.createElement('button');gear.id='atGear';gear.type='button';gear.title='Paramètres';gear.setAttribute('aria-label','Paramètres');gear.innerHTML=ICO.gear;gear.onclick=()=>settings();
if(barR){barR.prepend(wsB);barR.append(gear)}
/* la photothèque a son propre en-tête : la bascule y vient aussi */
const _ol=openLibrary;openLibrary=async function(...a){const r=await _ol.apply(this,a);try{placeSwitch()}catch(e){}return r};
const _cl=closeLibrary;closeLibrary=function(...a){const r=_cl.apply(this,a);try{placeSwitch()}catch(e){}return r};
function placeSwitch(){const top=$('#library .lb-top');if(LIB.open&&top&&document.body.classList.contains('atelier')){const t=top.querySelector('.lb-title');(t||top.firstElementChild).after(sw);if(t)t.hidden=true}else if(mark&&sw.previousElementSibling!==mark)mark.after(sw);paintSwitch()}

/* ---- espaces de travail ---- */
const wsCur=()=>PREF.get('atWs','dev');
function paintWs(){const w=WS.find(x=>x[0]===wsCur())||WS[0];wsB.innerHTML=`<i style="background:${w[3]}"></i>Espace <b>${w[1]}</b>${ICO.chev}`;wsB.title='Espace de travail : '+w[1]}
function snapshot(){const t=$('.tabs [data-tab][aria-selected=true]');return{fold:document.body.classList.contains('at-fold'),tab:t?t.dataset.tab:'develop',nav:!$('#atRail')?.classList.contains('closed-nav')}}
function useWs(k){const P={dev:{fold:false,tab:'develop',nav:true},ret:{fold:false,tab:'ai',nav:false,tool:'heal'},comp:{fold:false,tab:'history',nav:true,tool:'move'},mine:PREF.get('atMine',null)||{fold:false,tab:'develop',nav:true}}[k];if(!P)return;
  PREF.set('atWs',k);setFold(!!P.fold,false);$('#atRail')?.classList.toggle('closed-nav',!P.nav);try{switchTab(P.tab||'develop')}catch(e){}
  if(P.tool&&S.doc){try{setTool(P.tool)}catch(e){}}paintWs();toast('Espace '+WS.find(x=>x[0]===k)[1])}
wsB.onclick=()=>{const r=wsB.getBoundingClientRect(),c=wsCur();
  openMenuAt([...WS.map(w=>MI(w[1]+' · '+w[2],{check:c===w[0],fn:()=>useWs(w[0])})),SEP,
    MI('Enregistrer dans « Mon espace »',{fn:()=>{PREF.set('atMine',snapshot());PREF.set('atWs','mine');paintWs();toast('Disposition enregistrée dans « Mon espace »')}}),
    MI('Réinitialiser cet espace',{fn:()=>{if(c==='mine')PREF.set('atMine',null);useWs(c)}})],r.left,r.bottom+4)};
paintWs();

/* ---- panneau de gauche : Navigateur + Calques, repliable ---- */
const work=$('main.work'),dockEl=$('#dock');
const rail=document.createElement('aside');rail.id='atRail';rail.setAttribute('aria-label','Panneau de gauche');
rail.innerHTML=`<section class="at-card" id="atNav" aria-label="Navigateur"><div class="at-h"><i class="dot"></i><span>Navigateur</span><button type="button" id="atNavFold" title="Replier" aria-label="Replier le navigateur">${ICO.chev}</button><button type="button" id="atFoldBtn" title="Replier le panneau de gauche" aria-label="Replier le panneau de gauche">${ICO.rail}</button></div>
<div class="at-body"><div class="at-prev" id="atPrev"><canvas id="atPrevC" width="240" height="150"></canvas><div class="at-vp" id="atVp" hidden></div></div>
<div class="at-zoom"><button type="button" id="atFit">Ajuster</button><input type="range" id="atZ" min="0" max="100" value="50" aria-label="Zoom"><output id="atZo">100 %</output></div></div></section>`;
const strip=document.createElement('nav');strip.id='atStrip';strip.setAttribute('aria-label','Panneau de gauche replié');
strip.innerHTML=`<button type="button" data-k="open" title="Rouvrir le panneau de gauche" aria-label="Rouvrir le panneau de gauche">${ICO.rail}</button><button type="button" data-k="nav" title="Navigateur" aria-label="Navigateur">${ICO.nav}<i style="background:#46b3ff"></i></button><button type="button" data-k="layers" title="Calques" aria-label="Calques">${ICO.layers}<i style="background:#9a78ff"></i></button>`;
strip.onclick=e=>{const b=e.target.closest('button');if(!b)return;setFold(false);if(b.dataset.k==='nav')rail.classList.remove('closed-nav')};
const railBtn=document.createElement('button');railBtn.id='atRailBtn';railBtn.type='button';railBtn.innerHTML=ICO.rail;railBtn.onclick=()=>setFold(!document.body.classList.contains('at-fold'));
function paintRailBtn(){const f=document.body.classList.contains('at-fold');const t=f?'Rouvrir le panneau de gauche':'Replier le panneau de gauche';railBtn.title=t;railBtn.setAttribute('aria-label',t);railBtn.setAttribute('aria-pressed',String(!f))}
function setFold(f,save=true){document.body.classList.toggle('at-fold',!!f);if(save)PREF.set('atFold',!!f);paintRailBtn();setTimeout(()=>{try{if(S.doc&&S.fitted)fit();S.contentDirty=true;requestRender()}catch(e){}},30)}
rail.querySelector('#atFoldBtn').onclick=()=>setFold(true);
rail.querySelector('#atNavFold').onclick=()=>rail.classList.toggle('closed-nav');
/* zoom du navigateur : curseur logarithmique 5 % → 1600 % */
const zr=rail.querySelector('#atZ'),zo=rail.querySelector('#atZo');
const z2v=z=>Math.round(100*(Math.log(z)-Math.log(.05))/(Math.log(16)-Math.log(.05))),v2z=v=>Math.exp(Math.log(.05)+v/100*(Math.log(16)-Math.log(.05)));
zr.oninput=()=>{try{zoomAt(v2z(+zr.value))}catch(e){}};
rail.querySelector('#atFit').onclick=()=>{try{S.fitted=true;fit()}catch(e){}};
/* aperçu : clic ou glisser = déplacer la vue */
const prev=rail.querySelector('#atPrev'),pc=rail.querySelector('#atPrevC'),vp=rail.querySelector('#atVp');let pv={ver:-1,busy:false,box:null};
function prevBox(){const d=S.doc;if(!d)return null;const W=prev.clientWidth,H=prev.clientHeight,k=Math.min(W/d.w,H/d.h);return{k,x:(W-d.w*k)/2,y:(H-d.h*k)/2}}
function panTo(e){const d=S.doc,b=prevBox();if(!d||!b)return;const r=prev.getBoundingClientRect(),px=(e.clientX-r.left-b.x)/b.k,py=(e.clientY-r.top-b.y)/b.k;S.fitted=false;S.panX=S.vw/2-px*S.zoom;S.panY=S.vh/2-py*S.zoom;try{markContent()}catch(e){requestRender()}}
prev.addEventListener('pointerdown',e=>{if(!S.doc)return;prev.setPointerCapture(e.pointerId);panTo(e);const mv=ev=>panTo(ev),up=()=>{prev.removeEventListener('pointermove',mv);prev.removeEventListener('pointerup',up)};prev.addEventListener('pointermove',mv);prev.addEventListener('pointerup',up)});
async function tick(){if(S.sliding||!document.body.classList.contains('atelier')||document.body.classList.contains('at-fold')||rail.classList.contains('closed-nav')||!S.doc){vp.hidden=true;return}
  const d=S.doc,b=prevBox();if(!b||!prev.clientWidth)return;
  const dpr=Math.min(2,devicePixelRatio||1),W=Math.round(prev.clientWidth*dpr),H=Math.round(prev.clientHeight*dpr);
  const stable=pv.seen===S.docVer;pv.seen=S.docVer;
  if((pv.ver!==S.docVer||pc.width!==W||pv.doc!==d)&&stable&&!pv.busy&&!S.stroke){pv.busy=true;const ver=S.docVer;
    try{const sc=Math.min(1,b.k*dpr);const c=await renderDoc(sc,{before:false});pc.width=W;pc.height=H;const g=pc.getContext('2d');g.clearRect(0,0,W,H);g.imageSmoothingQuality='high';g.drawImage(c,b.x*dpr,b.y*dpr,d.w*b.k*dpr,d.h*b.k*dpr);pv.ver=ver;pv.doc=d}catch(e){pv.ver=S.docVer}
    pv.busy=false}
  const x0=-S.panX/S.zoom,y0=-S.panY/S.zoom,x1=x0+S.vw/S.zoom,y1=y0+S.vh/S.zoom;
  const cx0=Math.max(0,x0),cy0=Math.max(0,y0),cx1=Math.min(d.w,x1),cy1=Math.min(d.h,y1);
  const full=x0<=0&&y0<=0&&x1>=d.w&&y1>=d.h;vp.hidden=full||cx1<=cx0||cy1<=cy0;
  if(!vp.hidden)Object.assign(vp.style,{left:b.x+cx0*b.k+'px',top:b.y+cy0*b.k+'px',width:(cx1-cx0)*b.k+'px',height:(cy1-cy0)*b.k+'px'});
  if(document.activeElement!==zr)zr.value=z2v(S.zoom);zo.textContent=Math.round(S.zoom*100)+' %'}
setInterval(()=>{tick().catch(()=>{})},400);

/* ---- mise en place / retrait selon la largeur ---- */
function enable(){const on=WIDE.matches&&!document.body.classList.contains('compact');
  if(on===document.body.classList.contains('atelier'))return;
  const lp=$('#layersPanel'),side=$('aside.insp');
  if(on){dockEl.after(rail);rail.after(strip);
    if(lp&&!lp.classList.contains('pf-float'))rail.append(lp);
    document.body.classList.add('atelier');setFold(PREF.get('atFold',false),false)}
  else{document.body.classList.remove('atelier','at-fold');if(lp&&lp.parentElement===rail&&side)side.append(lp);rail.remove();strip.remove();railBtn.remove()}
  placeSwitch();try{if(S.doc&&S.fitted)fit();requestRender()}catch(e){}}
WIDE.addEventListener('change',enable);
new MutationObserver(()=>{enable();paintSwitch()}).observe(document.body,{attributes:true,attributeFilter:['class']});
enable();

/* ---- menus : Affichage > panneau de gauche, Fichier > Paramètres ---- */
{const V=MENU2.view,_v=V.items;V.items=function(){const a=_v.apply(this,arguments);if(!document.body.classList.contains('atelier'))return a;const f=document.body.classList.contains('at-fold');
  let at=a.findIndex(x=>x&&x.label==='Panneaux');if(at<0)at=a.length;a.splice(at,0,MI(f?'Rouvrir le panneau de gauche':'Replier le panneau de gauche',{icon:'layers',fn:()=>setFold(!f),dis:!S.doc?'Ouvrez une photo':false}),MI('Espace de travail',{sub:()=>WS.map(w=>MI(w[1],{check:wsCur()===w[0],fn:()=>useWs(w[0])}))}));return a}}
{const F=MENU2.file,_f=F.items;F.items=function(){const a=_f.apply(this,arguments);a.push(MI('Paramètres…',{icon:'theme',kbd:MOD+',',fn:()=>settings()}));return a}}
window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!e.altKey&&!e.shiftKey&&e.key===','){const t=e.target;if(t&&t.closest&&t.closest('input,textarea,[contenteditable]'))return;e.preventDefault();settings()}});

/* ---- paramètres ---- */
function settings(sec){sec=sec||'look';
  const NAV=[['account','Compte',ICO.user],['look','Personnalisation',ICO.brush],['lang','Langue',ICO.globe],['keys','Raccourcis',ICO.keys]];
  const dl=dialog({title:'Paramètres',body:`<div class="at-set"><nav aria-label="Rubriques">${NAV.map(n=>`<button type="button" data-s="${n[0]}">${n[2]}${n[1]}</button>`).join('')}</nav><section id="atSec" aria-live="polite"></section></div>`,buttons:[{label:'Fermer',primary:true}]});
  const root=$('#scrim .at-set');if(!root)return dl;const box=root.querySelector('#atSec');
  const seg=(k,opts,cur)=>`<div class="at-seg" role="group">${opts.map((o,i)=>`<button type="button" data-${k}="${i}" aria-pressed="${i===cur}">${o}</button>`).join('')}</div>`;
  function show(s){sec=s;for(const b of root.querySelectorAll('nav button'))b.setAttribute('aria-current',String(b.dataset.s===s));const L=look();
    if(s==='look'){const th=themeNow();
      const TH=[['auto','Automatique','linear-gradient(90deg,#1c1c1f 50%,#fafafa 50%)','#5b5b66'],['dark','Sombre','#121214','#2e2e33'],['graphite','Graphite','#1e1e22','#3a3a40'],['nuit','Nuit','#0a0d16','#232b40'],['light','Clair','#e4e4e8','#ffffff']];
      box.innerHTML=`<div><h4>Couleur d’accent</h4><div class="at-sw">${ACC.map((a,i)=>`<button type="button" data-acc="${i}" title="${a[0]}" aria-label="${a[0]}" aria-pressed="${L.acc===i}" style="background:${a[1]||'#5b67f0'}"></button>`).join('')}<label class="${L.acc===-1?'on':''}" title="Couleur personnalisée"><input type="color" id="atCustom" value="${L.custom}" aria-label="Couleur personnalisée"></label></div></div>
<div><h4>Thème</h4><div class="at-th">${TH.map(t=>`<button type="button" data-th="${t[0]}" aria-pressed="${th===t[0]}"><i style="background:${t[2]};--a:${t[3]}"></i>${t[1]}</button>`).join('')}</div></div>
<div class="at-row"><span>Arrondis</span>${seg('rnd',['Nets','Doux','Ronds'],L.rnd)}</div>
<div class="at-row"><span>Panneau de gauche</span>${seg('fold',['Ouvert','Replié'],document.body.classList.contains('at-fold')?1:0)}</div>
<div class="at-acts"><button type="button" class="btn sm" id="atReset">Revenir à l’apparence d’origine</button></div>`;
      box.onclick=e=>{const b=e.target.closest('button');if(!b)return;
        if(b.dataset.acc!=null)setLook({acc:+b.dataset.acc});else if(b.dataset.th)setTheme(b.dataset.th);else if(b.dataset.rnd!=null)setLook({rnd:+b.dataset.rnd});
        else if(b.dataset.fold!=null)setFold(b.dataset.fold==='1');else if(b.id==='atReset'){PREF.set('look',{});setTheme('auto');applyLook()}else return;show('look')};
      box.querySelector('#atCustom').oninput=e=>{setLook({acc:-1,custom:e.target.value});box.querySelector('.at-sw label').classList.add('on');for(const b of box.querySelectorAll('[data-acc]'))b.setAttribute('aria-pressed','false')}}
    else if(s==='account'){const p=PREF.get('sync2Prof',null),on=typeof SY!=='undefined'&&SY.cfg;
      box.innerHTML=`<div><h4>Compte Prism</h4><p class="muted">${on?'Connecté'+(p&&(p.name||p.email)?' : '+esc(p.name||p.email):'')+'. Nom, photo de profil et appareils se règlent dans la fenêtre du compte.':'Vous n’êtes pas connecté. Tout marche sans compte ; il sert à retrouver vos photos sur vos autres appareils.'}</p></div><div class="at-acts"><button type="button" class="btn primary sm" id="atAcc">${on?'Ouvrir mon compte…':'Se connecter ou créer un compte…'}</button></div>`;
      box.onclick=e=>{if(e.target.closest('#atAcc')){closeDialog();try{syAccountDialog()}catch(err){}}}}
    else if(s==='lang'){const it=(MENU2.view.items()||[]).find(x=>x&&x.label==='Langue'),subs=it&&typeof it.sub==='function'?it.sub():[];
      box.innerHTML=`<div class="at-row"><span>Langue de l’interface</span><div class="at-seg" role="group">${subs.map((x,i)=>`<button type="button" data-l="${i}" aria-pressed="${!!x.check}">${esc(x.label)}</button>`).join('')}</div></div><p class="muted">Les noms de vos photos, albums et calques ne sont pas traduits.</p>`;
      box.onclick=e=>{const b=e.target.closest('[data-l]');if(!b)return;const x=subs[+b.dataset.l];if(x&&x.fn)x.fn();show('lang')}}
    else if(s==='keys'){box.innerHTML=`<div><h4>Raccourcis clavier</h4><p class="muted">Chaque commande des menus peut recevoir son raccourci. ${esc(MOD)}K ouvre la recherche de commandes depuis partout.</p></div><div class="at-acts"><button type="button" class="btn sm" id="atK1">Voir les raccourcis</button><button type="button" class="btn primary sm" id="atK2">Personnaliser…</button></div>`;
      box.onclick=e=>{if(e.target.closest('#atK1')){closeDialog();shortcutsDialog()}else if(e.target.closest('#atK2')){closeDialog();try{PrismKeys.dialog()}catch(err){}}}}}
  root.querySelector('nav').onclick=e=>{const b=e.target.closest('button');if(b)show(b.dataset.s)};
  show(sec);return dl}
window.PrismSettings=settings;
paintSwitch();
})();
