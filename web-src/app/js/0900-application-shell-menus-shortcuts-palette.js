/* ================= fx shell: audit of the application shell (menus, shortcuts, palette, quick actions, dialogs, layout, wording) ================= */
(()=>{
// ---------- CSS ----------
const css=document.createElement('style');css.id='fxShellCss';
css.textContent=`
/* the search pill grows to hold its Ctrl+K hint instead of letting it spill over the border and the undo button */
#bCmd.cmd-pill{width:auto;min-width:156px;flex:none}
@media (max-width:1180px){#bCmd.cmd-pill kbd{display:none}}
/* phone: icon only, otherwise it crushes the document name and covers undo */
body.compact #bCmd.cmd-pill{min-width:0;width:36px;height:36px;padding:0;justify-content:center;border-color:transparent;background:transparent}
body.compact #bCmd.cmd-pill span,body.compact #bCmd.cmd-pill kbd{display:none}
/* dialogs taller than the window: the buttons stay reachable */
.dlg .foot{position:sticky;bottom:0;z-index:2;background:var(--chrome)}
/* readable sub-label on the accent tile */
.w-tile:first-child span{color:rgba(255,255,255,.94)}
`;
document.head.appendChild(css);

// ---------- keyboard labels: Windows / Linux get Maj+ and Alt+ instead of the Mac glyphs ----------
const fmtKbd=s=>{if(IS_MAC||!s)return s;return String(s).replace(/⇧/g,'Maj+').replace(/⌥/g,'Alt+')};
window.fmtKbd=fmtKbd;
const _bm=buildMenuEl;
buildMenuEl=function(){const m=_bm.apply(this,arguments);if(!IS_MAC)m.querySelectorAll('kbd').forEach(k=>{const t=k.textContent;if(/[⇧⌥]/.test(t))k.textContent=fmtKbd(t)});return m};

// ---------- menus: precise reasons and honest disabled states ----------
const WHY={'Coller':'Rien à coller : copiez d’abord une sélection','Coller les réglages':'Copiez d’abord les réglages d’une photo','Convertir le tracé en sélection':'Aucun tracé : tracez-en un avec la plume'};
const walkFix=(items,f)=>{for(const it of items||[]){if(it&&typeof it==='object'&&it.label)f(it)}return items};
const wrapMenu=(key,f)=>{const m=MENU2[key];if(!m)return;const o=m.items;m.items=function(){const a=o.apply(this,arguments);try{f(a)}catch(e){console.warn('fxShell menu',key,e)}return a}};
const dis=(it,why)=>{if(!it.dis)it.dis=why};
// pick() took the first entry whose name STARTS with the label: "Copier" found "Copier les réglages" and "Coller" found "Coller les réglages",
// so Édition > Copier / Coller (and the same entries in the canvas menu) ran the look copy/paste. An exact name wins now.
const NEWLYR=MOD+'⌥N';
const _pick=pick;
pick=function(k,label){let r=null;try{const it=MENUS0[k]().find(x=>x&&String(x[0]).replace(/^✓ /,'')===label);if(it)r={fn:it[2],dis:!!it[3],kbd:it[1]||'',on:String(it[0]).startsWith('✓')}}catch(e){}if(!r)r=_pick.apply(this,arguments);if(k==='layer'&&label==='Nouveau calque')r.kbd=NEWLYR;return r};
const _fp=fromPick;
fromPick=function(k,label){const it=_fp.apply(this,arguments);if(it&&it.dis==='Pas disponible pour le moment'&&WHY[label])it.dis=WHY[label];return it};
wrapMenu('layer',a=>{const d=S.doc;if(!d)return;const i=d.active,n=d.layers.length;
  walkFix(a,it=>{switch(it.label){
    case 'Monter le calque':if(i>=n-1)dis(it,'Déjà tout en haut');break;
    case 'Descendre le calque':if(i<=0)dis(it,'Déjà tout en bas');break;
    case 'Fusionner avec le calque inférieur':if(i<=0)dis(it,'Aucun calque en dessous');break;
    case 'Aplatir l’image':if(n<2)dis(it,'Il n’y a qu’un seul calque');break}})});

// ---------- Ctrl+K closes an open menu first ----------
const _ock=openCmdK;
openCmdK=function(){if(!$('#cmdk')){try{closeMenus(false)}catch(e){}}return _ock.apply(this,arguments)};

// ---------- Command palette: menu entries from submenus keep their parent ("Thème › Clair"), duplicated legacy entries are dropped ----------
const _ci=cmdItems;
cmdItems=function(){let a=_ci.apply(this,arguments);
  try{
    if(!(window.LIB&&LIB.open)){
      const names={file:'Fichier',edit:'Édition',image:'Image',layer:'Calque',select:'Sélection',filter:'Filtre',view:'Affichage',help:'Aide'};
      const nz=s=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      const clean=s=>String(s).replace(/^✓ /,'').replace(/…$/,'');
      const have=new Set(a.map(i=>nz(i.label))),offs=new Set();
      for(const k of Object.keys(MENU2)){let top=[];try{top=MENU2[k].items()}catch(e){continue}const g=names[k]||k;
        const topL=new Set(top.filter(x=>x&&x.label).map(x=>clean(x.label)));
        const walk=(items,pre,pd)=>{for(const it of items||[]){if(!it||typeof it!=='object'||Array.isArray(it)||!it.label)continue;
          if(it.sub){let ch=[];try{ch=typeof it.sub==='function'?it.sub():it.sub}catch(e){}if(Array.isArray(ch))walk(ch,clean(it.label),pd||!!it.dis);continue}
          if(!pre||typeof it.fn!=='function')continue;const leaf=clean(it.label);if(pd)offs.add(g+'|'+leaf);
          if(nz(leaf).includes(nz(pre).slice(0,4)))continue;           // "Flou gaussien" already says "Flou"
          if(topL.has(leaf))continue;
          const full=pre+' › '+leaf;if(have.has(nz(full)))continue;
          a=a.filter(x=>!(x.g===g&&x.label===leaf&&!x._fxp));have.add(nz(full));
          a.push({g,label:full,kbd:it.kbd||'',fn:it.fn,dis:!!it.dis||pd,_fxp:1})}};
        walk(top,'',false)}
      a.forEach(x=>{if(offs.has(x.g+'|'+x.label))x.dis=true})
    }
    a.forEach(it=>{if(it.kbd===MOD+'⇧N')it.kbd=NEWLYR});
    // tools: the key comes from the tool table (the tooltip's first parenthesis gave "IA" for the eraser and "tracés vectoriels" for the pen)
    const tk=new Map();document.querySelectorAll('#dock [data-tool]').forEach(b=>{const t=TOOLS.find(x=>x&&x[0]===b.dataset.tool);if(t)tk.set(b.getAttribute('aria-label'),t[2]||'')});
    a.forEach(it=>{if(it.g==='Outils'&&tk.has(it.label))it.kbd=tk.get(it.label)});
    // same group + same shortcut = the same command listed by the old menu and the new one: keep the newest
    const key=it=>it.kbd?it.g+'|'+it.kbd:'';const last=new Map();a.forEach((it,i)=>{const k=key(it);if(k)last.set(k,i)});
    a=a.filter((it,i)=>{const k=key(it);return !k||last.get(k)===i});
  }catch(e){console.warn('fxShell cmdItems',e)}
  return a};

// ---------- palette: shortcut hints follow the platform ----------
new MutationObserver(ms=>{if(IS_MAC)return;for(const m of ms)for(const n of m.addedNodes){if(n.nodeType!==1)continue;const c=n.id==='cmdk'?n:n.querySelector&&n.querySelector('#cmdk');if(c){const L=c.querySelector('#cmdkL');if(L)new MutationObserver(()=>{L.querySelectorAll('kbd').forEach(k=>{const t=k.textContent;if(/[⇧⌥]/.test(t))k.textContent=fmtKbd(t)})}).observe(L,{childList:true})}}}).observe(document.body,{childList:true});

// ---------- Enter validates a dialog from its fields (the buttons keep their own behaviour) ----------
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'||e.shiftKey||e.ctrlKey||e.metaKey||e.altKey||e.defaultPrevented||e.isComposing)return;
  const s=$('#scrim');if(!s||s.classList.contains('light')||$('#cmdk'))return;const t=e.target;
  if(!t||!t.matches||!t.closest('.dlg')||!t.matches('input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=button]):not([type=file]):not([type=color])'))return;
  const pb=s.querySelector('.foot .btn.primary');if(!pb)return;
  e.preventDefault();try{t.dispatchEvent(new Event('change',{bubbles:true}))}catch(_){}pb.click()},false);

// ---------- right click on the photo opens the context menu instead of painting / selecting with the right button ----------
// (onDown had no button check: the right button started a stroke, S.drag was set and the contextmenu handler gave up)
{const rc=e=>e.button===2||(IS_MAC&&e.button===0&&e.ctrlKey);
 view.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'&&rc(e)){e.stopImmediatePropagation()}},true);
 view.addEventListener('pointerup',e=>{if(e.pointerType!=='touch'&&(e.button===2||(IS_MAC&&e.button===0&&e.ctrlKey))&&!S.drag&&!S.stroke){e.stopImmediatePropagation()}},true)}

// ---------- New layer: Ctrl/Cmd+Shift+N is reserved by every browser (private window), so Ctrl/Cmd+Alt+N does the same ----------
document.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||!e.altKey||e.shiftKey||e.code!=='KeyN'||!S.doc)return;const t=e.target;
  if(t&&t.closest&&t.closest('input,textarea,select,[contenteditable]'))return;if($('#scrim:not(.light)')||$('#library')||$('#cmdk')||$('#msheet'))return;
  e.preventDefault();e.stopPropagation();addLayer()},true);

// ---------- shortcuts dialog: no empty key cells, platform labels ----------
const _sd=shortcutsDialog;
shortcutsDialog=function(){const r=_sd.apply(this,arguments);const s=$('#scrim');if(s){s.querySelectorAll('tr').forEach(tr=>{const k=tr.querySelector('kbd');if(k&&!k.textContent.trim())tr.remove();else if(k&&/Nouveau calque/.test(tr.textContent)&&k.textContent.includes('⇧N'))k.textContent=NEWLYR;else if(k&&!IS_MAC&&/[⇧⌥]/.test(k.textContent))k.textContent=fmtKbd(k.textContent)})}return r};

// ---------- quick actions: clearer wording ----------
try{const a=QA_ALL.find(x=>x[0]==='reset');if(a)a[1]='Réinitialiser'}catch(e){}
try{renderQA()}catch(e){}

// ---------- welcome tips: the shortcut matches the platform ----------
try{document.querySelectorAll('#wTips kbd').forEach(k=>{if(/Ctrl\/⌘/.test(k.textContent))k.textContent=IS_MAC?'⌘ K':'Ctrl K'})}catch(e){}
})();

