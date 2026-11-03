/* ===== 1.0 : raccourcis clavier personnalisables =====
   Aide > Personnaliser les raccourcis… : chaque outil et chaque commande des menus peut recevoir la touche de son choix.
   Les raccourcis d'origine continuent de marcher, sauf s'ils sont donnés à une autre commande.
   Rangés dans PREF 'keys2' : { 'tool:brush': 'b', 'menu:file/Exporter': 'Mod+Shift+e', … } ; '' = aucun raccourci. */
(()=>{
const get=()=>{const k=PREF.get('keys2',{});return k&&typeof k==='object'?{...k}:{}};
const set=k=>PREF.set('keys2',k);
const clean=l=>String(l||'').replace(/\s*«.*»/,'').replace(/…$/,'').trim();
/* une touche pressée -> « Mod+Alt+Shift+k » ; les lettres et chiffres suivent la touche physique quand Alt change le caractère (Mac) */
function combo(e){const k=e.key||'';if(['Shift','Control','Meta','Alt','AltGraph','CapsLock','Dead','Unidentified'].includes(k))return null;
  let base=/^Key[A-Z]$/.test(e.code)&&(e.altKey||e.ctrlKey||e.metaKey)?e.code.slice(3).toLowerCase():/^Digit\d$/.test(e.code)&&(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)?e.code.slice(5):k.length===1?k.toLowerCase():k;
  if(base===' ')base='Space';
  const sh=e.shiftKey&&(/^[a-z0-9]$/.test(base)||base.length>1);   // « ? » ou « + » tapés avec Maj restent eux-mêmes
  return [(e.ctrlKey||e.metaKey)&&'Mod',e.altKey&&'Alt',sh&&'Shift',base].filter(Boolean).join('+')}
const NICE={ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓',Space:'Espace',Enter:'Entrée',Backspace:'⌫',Delete:'Suppr',Escape:'Échap',Tab:'Tab'};
function show(c){if(!c)return '';const p=c.split('+'),k=p.pop();return (p.includes('Mod')?MOD:'')+(p.includes('Alt')?(IS_MAC?'⌥':'Alt+'):'')+(p.includes('Shift')?'⇧':'')+(NICE[k]||(k.length===1?k.toUpperCase():k))}
/* « ⌘⇧E », « Ctrl+⇧E », « B » -> combo : pour reconnaître les raccourcis d'origine affichés dans les menus */
function parse(kbd){if(!kbd||typeof kbd!=='string')return null;let s=kbd.trim(),m=false,a=false,sh=false;
  for(;;){if(s.startsWith('⌘')){m=true;s=s.slice(1)}else if(s.startsWith('Ctrl+')){m=true;s=s.slice(5)}else if(s.startsWith('⌥')){a=true;s=s.slice(1)}else if(s.startsWith('Alt+')){a=true;s=s.slice(4)}else if(s.startsWith('⇧')){sh=true;s=s.slice(1)}else break}
  if(!s||s.includes(' '))return null;const k=s.length===1?s.toLowerCase():s;return [m&&'Mod',a&&'Alt',sh&&'Shift',k].filter(Boolean).join('+')}

/* toutes les commandes : outils, puis les menus (un niveau de sous-menu) */
function actions(){const out=[];
  TOOLS.filter(Boolean).forEach(t=>out.push({id:'tool:'+t[0],group:'Outils',label:(typeof TOOL_NAMES!=='undefined'&&TOOL_NAMES[t[0]])||t[1],def:t[2]?t[2].toLowerCase():'',run:()=>{if(S.doc)setTool(t[0])}}));
  for(const [mk,M] of Object.entries(MENU2)){let items=[];try{items=M.items()||[]}catch(e){continue}
    const walk=(list,path)=>list.forEach(it=>{if(!it||it==='-'||!it.label)return;const lab=clean(it.label);
      if(it.sub){let s=[];try{s=it.sub()||[]}catch(e){}walk(s,path.concat(lab));return}
      if(typeof it.fn!=='function')return;
      out.push({id:'menu:'+mk+'/'+path.concat(lab).join('/'),group:M.label,label:path.concat(lab).join(' › '),def:parse(it.kbd)||'',mk,path:path.concat(lab)})});
    walk(items,[])}
  const seen=new Set();return out.filter(a=>!seen.has(a.id)&&seen.add(a.id))}
/* la commande est retrouvée au moment de l'appui : les menus changent avec la photo ouverte */
function runMenu(a){const M=MENU2[a.mk];if(!M)return;let list=M.items()||[];let it=null;
  for(let i=0;i<a.path.length;i++){it=list.find(x=>x&&x!=='-'&&clean(x.label)===a.path[i]);if(!it)return;if(i<a.path.length-1){if(it.dis){toast(typeof it.dis==='string'?it.dis:'Indisponible pour le moment');return}list=it.sub?it.sub():[]}}
  if(!it)return;if(it.dis){toast(typeof it.dis==='string'?it.dis:'Indisponible pour le moment');return}it.fn()}

let ACT=null;const byId=id=>(ACT||(ACT=actions())).find(a=>a.id===id);
/* l'appui : avant tous les autres gestionnaires (voir 0015-raccourcis-en-premier.js) */
window.__KEYHOOK=(e=>{const K=get();if(!Object.keys(K).length||e.repeat&&!/^(\[|\])$/.test(e.key))return;
  if(CAP.on)return;const tg=e.target;if(tg&&tg.matches&&tg.matches('textarea,select,[contenteditable],input:not([type=range]):not([type=checkbox]):not([type=color]):not([type=radio]):not([type=button])'))return;
  if($('#scrim')&&!$('#scrim').classList.contains('light'))return;const bz=$('#busy');if(bz&&!bz.hidden)return;
  const c=combo(e);if(!c)return;const id=Object.keys(K).find(k=>K[k]===c);
  if(id){const a=byId(id)||(ACT=actions(),byId(id));if(!a)return;e.preventDefault();e.stopImmediatePropagation();if(a.run)a.run();else runMenu(a);return}
});

/* les menus et la liste des outils affichent les touches choisies */
for(const [mk,M] of Object.entries(MENU2)){const _i=M.items;M.items=function(){const list=_i.apply(this,arguments),K=get();if(!Object.keys(K).length)return list;
  const fix=(l,path)=>l.map(it=>{if(!it||it==='-'||!it.label)return it;const lab=clean(it.label),id='menu:'+mk+'/'+path.concat(lab).join('/');
    if(it.sub){const s=it.sub;return {...it,sub:()=>fix(s()||[],path.concat(lab))}}return id in K?{...it,kbd:show(K[id])||undefined}:it});
  return fix(list||[],[])}}
const toolKey=()=>{const K=get();TOOLS.filter(Boolean).forEach(t=>{if(t.__k0===undefined)t.__k0=t[2];const id='tool:'+t[0];t[2]=id in K?(K[id]?show(K[id]):''):t.__k0})};

/* ---------- la fenêtre de réglage ---------- */
const CAP={on:false};
function keysDialog(){ACT=actions();const K=get();let q='';
  const used=(c,except)=>{if(!c)return null;const K2=get();const own=Object.keys(K2).find(k=>K2[k]===c&&k!==except);if(own)return byId(own);return ACT.find(a=>a.id!==except&&!(a.id in K2)&&a.def===c)||null};
  const row=a=>{const cur=a.id in K?K[a.id]:a.def,ch=a.id in K;return `<div class="kc-r" data-id="${esc(a.id)}"><span class="kc-l">${esc(a.label)}</span><button type="button" class="kc-k${ch?' ch':''}" data-cap>${cur?`<kbd>${esc(show(cur))}</kbd>`:'<span class="muted">Aucun</span>'}</button>${ch?`<button type="button" class="kc-x" data-reset title="Revenir au raccourci d’origine">↺</button>`:'<span></span>'}</div>`};
  const paint=el=>{const box=$('.kc-list',el),f=q.toLowerCase(),groups=[...new Set(ACT.map(a=>a.group))];
    box.innerHTML=groups.map(g=>{const l=ACT.filter(a=>a.group===g&&(!f||a.label.toLowerCase().includes(f)||show(a.id in K?K[a.id]:a.def).toLowerCase().includes(f)));return l.length?`<div class="kc-g">${esc(g)}</div>${l.map(row).join('')}`:''}).join('')||'<p class="muted">Aucune commande ne correspond.</p>'};
  const dl=dialog({title:'Raccourcis clavier',body:`<p class="muted kc-p">Cliquez un raccourci, puis appuyez sur la touche. Retour arrière l’enlève.</p>
    <input class="kc-s" type="search" placeholder="Rechercher une commande ou une touche" aria-label="Rechercher"><div class="kc-list"></div><p class="kc-msg muted" aria-live="polite"></p>
    <style>.dlg:has(.kc-list){width:min(620px,94vw)}.kc-p{margin:0 0 8px}.kc-s{width:100%;margin-bottom:8px}.kc-list{max-height:min(56vh,520px);overflow:auto;border:1px solid var(--line);border-radius:9px;padding:4px 8px}
    .kc-g{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--fg-3);margin:10px 0 4px}.kc-r{display:grid;grid-template-columns:1fr auto 26px;gap:8px;align-items:center;padding:3px 0;border-top:1px solid var(--line)}
    .kc-g+.kc-r{border-top:0}.kc-l{font-size:13px}.kc-k{min-width:92px;height:28px;border:1px solid var(--line-2);border-radius:7px;background:var(--bg-2);color:var(--fg);cursor:pointer;font:inherit;font-size:12px}
    .kc-k.ch{border-color:var(--accent)}.kc-k.cap{outline:2px solid var(--accent)}.kc-x{border:0;background:none;color:var(--fg-2);cursor:pointer;font-size:15px}.kc-msg{min-height:1.2em;margin:8px 0 0;font-size:12px}</style>`,
    onOpen:el=>{paint(el);const s=$('.kc-s',el),msg=$('.kc-msg',el);s.oninput=()=>{q=s.value;paint(el)};
      el.addEventListener('click',e=>{const r=e.target.closest('.kc-r');if(!r)return;const id=r.dataset.id;
        if(e.target.closest('[data-reset]')){const K2=get();delete K2[id];set(K2);for(const k in K)delete K[k];Object.assign(K,K2);msg.textContent='Raccourci d’origine remis.';paint(el);toolKey();return}
        const b=e.target.closest('[data-cap]');if(!b)return;CAP.on=true;$$('.kc-k.cap',el).forEach(x=>x.classList.remove('cap'));b.classList.add('cap');b.innerHTML='<span class="muted">Appuie sur une touche…</span>';
        const kd=ev=>{if(!document.body.contains(el)){document.removeEventListener('keydown',kd,true);CAP.on=false;return}const c=combo(ev);if(!c)return;ev.preventDefault();ev.stopImmediatePropagation();document.removeEventListener('keydown',kd,true);CAP.on=false;
          const K2=get();if(ev.key==='Escape'){paint(el);msg.textContent='';return}
          if(ev.key==='Backspace'||ev.key==='Delete'){K2[id]='';set(K2);for(const k in K)delete K[k];Object.assign(K,K2);msg.textContent='Raccourci enlevé.';paint(el);toolKey();return}
          const other=used(c,id);if(other){K2[other.id]='';msg.textContent=`${show(c)} était à « ${other.label} » : cette commande n’a plus de raccourci.`}else msg.textContent=`${show(c)} pour « ${byId(id).label} ».`;
          K2[id]=c;if(byId(id).def===c)delete K2[id];set(K2);for(const k in K)delete K[k];Object.assign(K,K2);paint(el);toolKey()};
        document.addEventListener('keydown',kd,true)})},
    buttons:[{label:'Tout réinitialiser',onClick:()=>{set({});toolKey();toast('Raccourcis d’origine remis');setTimeout(keysDialog,0)}},{label:'Fermer',primary:true}]});
  return dl}
/* au menu Aide, et depuis la liste des raccourcis */
{const H=MENU2.help,_h=H.items;H.items=function(){const a=_h.apply(this,arguments),i=a.findIndex(x=>x&&x.label==='Raccourcis clavier');a.splice(i+1,0,MI('Personnaliser les raccourcis…',{icon:'keys',fn:keysDialog}));return a}}
{const _sd=shortcutsDialog;shortcutsDialog=function(){toolKey();const r=_sd.apply(this,arguments);const f=$('#scrim .foot');if(f&&!f.querySelector('[data-kc]')){const b=document.createElement('button');b.className='btn';b.dataset.kc='1';b.textContent='Personnaliser…';b.onclick=()=>{closeDialog();keysDialog()};f.prepend(b)}return r}}
setTimeout(toolKey,0);
window.PrismKeys={dialog:keysDialog,actions:()=>(ACT=actions()),combo,show,parse,get,set:k=>{set(k);toolKey()}};
})();
