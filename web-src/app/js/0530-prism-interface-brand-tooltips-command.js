/* ================= Prism interface: brand, tooltips, command palette, welcome, document chip ================= */
const PRISM_LOGO=`<svg class="logo" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="pgSpec" gradientUnits="userSpaceOnUse" x1="0" y1="7.6" x2="0" y2="19.6"><stop offset="0" stop-color="#ff4d5e"/><stop offset=".2" stop-color="#ff9a3c"/><stop offset=".38" stop-color="#ffe14a"/><stop offset=".55" stop-color="#4ee38a"/><stop offset=".72" stop-color="#38c6ff"/><stop offset=".88" stop-color="#5a6bff"/><stop offset="1" stop-color="#d04bff"/></linearGradient><linearGradient id="pgGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#9fd8ff"/></linearGradient><linearGradient id="pgBeam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><path d="M13.6 11.1 23.6 7.8V19.8z" fill="url(#pgSpec)"/><path d="M13.6 11.1 23.6 11.4M13.6 11.1 23.6 14.6M13.6 11.1 23.6 17.3" stroke="#fff" stroke-opacity=".28" stroke-width=".35" fill="none"/><path d="M10 2.8 17.6 18.2H2.4z" fill="#fff" fill-opacity=".07" stroke="url(#pgGlass)" stroke-width="1.15" stroke-linejoin="round"/><path d="M.4 14.6 5.9 12.2 13.6 11.1" fill="none" stroke="url(#pgBeam)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
$('.mark').innerHTML=PRISM_LOGO+'<span>Prism</span>';
/* histogram footer: shooting info line, as in Lightroom */
(()=>{const h=$('.histo');if(h&&!$('#hexif')){const e=document.createElement('div');e.id='hexif';e.className='hexif';h.appendChild(e)}})();
function updateExifLine(){const e=$('#hexif');if(!e)return;const d=S.doc,m=d&&S.meta&&!S.sample?S.meta:'';e.hidden=!m;e.innerHTML=m?m.split(' · ').map(x=>`<span>${esc(x)}</span>`).join(''):''}
updateDocName=function(){const d=S.doc,el=$('#docname');if(!d){el.innerHTML='<b>Photothèque</b>';updateExifLine();return}const tags=[];if(d.raw)tags.push('RAW');if(d.space==='display-p3')tags.push('P3');const pl=typeof precLabel==='function'?precLabel():'';if(pl)tags.push(pl);
  el.innerHTML=`<b>${esc(d.name)}</b><span class="dim">${d.w} × ${d.h}</span>${tags.map(t=>`<i class="tag">${esc(t)}</i>`).join('')}`;el.title='Ouvrir la photothèque';updateExifLine()};
updateDocName();
/* floating tooltips with the shortcut, for the tool dock and the top bar */
const TIP={el:null,t:0,cur:null};
function tipFor(b){let s=b.dataset.tip||b.getAttribute('title')||'';if(b.hasAttribute('title')){b.dataset.tip=s;b.removeAttribute('title')}return s}
function showTip(b){const s=tipFor(b);if(!s)return;if(!TIP.el){TIP.el=document.createElement('div');TIP.el.className='tip';TIP.el.setAttribute('role','tooltip');document.body.appendChild(TIP.el)}
  const m=s.match(/^(.*?)\s*\(([^()]+)\)\s*(.*)$/);TIP.el.innerHTML=m?`<span>${esc(m[1])}</span><kbd>${esc(m[2].replace(/Ctrl\+/,MOD).replace(/Maj\+/,'⇧'))}</kbd>${m[3]?`<small>${esc(m[3])}</small>`:''}`:`<span>${esc(s)}</span>`;
  TIP.el.hidden=false;const r=b.getBoundingClientRect(),t=TIP.el.getBoundingClientRect(),inDock=!!b.closest('.tools');
  let x=inDock?r.right+10:r.left+r.width/2-t.width/2,y=inDock?r.top+r.height/2-t.height/2:r.bottom+8;x=clamp(x,6,innerWidth-t.width-6);y=clamp(y,6,innerHeight-t.height-6);TIP.el.style.left=x+'px';TIP.el.style.top=y+'px'}
function hideTip(){clearTimeout(TIP.t);TIP.cur=null;if(TIP.el)TIP.el.hidden=true}
document.addEventListener('pointerover',e=>{if(e.pointerType!=='mouse')return;const b=e.target.closest&&e.target.closest('.tools [title],.tools [data-tip],.bar-r [title],.bar-r [data-tip],.statusbar [title],.statusbar [data-tip],.lyr-btns [title],.lyr-btns [data-tip],.ph [title],.ph [data-tip],[data-tip]');if(b===TIP.cur)return;hideTip();if(!b)return;TIP.cur=b;tipFor(b);TIP.t=setTimeout(()=>showTip(b),380)});
document.addEventListener('pointerdown',hideTip,true);window.addEventListener('blur',hideTip);
/* command palette (⌘K): every menu command, tool, panel and adjustment */
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
function cmdItems(){const out=[],names={file:'Fichier',edit:'Édition',image:'Image',layer:'Calque',select:'Sélection',filter:'Filtre',view:'Affichage'};const seen=new Set();
  const add=(g,label,kbd,fn,dis)=>{const k=g+'|'+label;if(seen.has(k))return;seen.add(k);out.push({g,label,kbd:kbd||'',fn,dis:!!dis})};
  $$('#dock [data-tool]').forEach(b=>{const s=tipFor(b),m=s.match(/\(([^()]+)\)/);add('Outils',b.getAttribute('aria-label'),m?m[1]:'',()=>b.click())});
  for(const k of Object.keys(MENUS)){let items=[];try{items=MENUS[k]()}catch(e){}for(const it of items){if(!Array.isArray(it)||typeof it[2]!=='function')continue;add(names[k]||k,String(it[0]).replace(/^✓ /,'').replace(/…$/,''),it[1],it[2],it[3])}}
  $$('.tabs [data-tab]').forEach(b=>add('Panneaux',b.textContent.trim(),'',()=>b.click()));
  $$('#pane-develop details.sec').forEach(sec=>{const sm=sec.querySelector('summary'),name=sm?sm.childNodes[0]&&sm.textContent.replace(/Réinitialiser/,'').trim():'';if(!name)return;
    const go=focusEl=>{const t=$('.tabs [data-tab="develop"]');t&&t.click();sec.open=true;setTimeout(()=>{(focusEl||sm).scrollIntoView({block:'center',behavior:'smooth'});focusEl&&focusEl.focus()},60)};
    add('Réglages',name,'',()=>go(null),!S.doc);sec.querySelectorAll('.row').forEach(r=>{const l=r.querySelector('label'),inp=r.querySelector('input[type=range]');if(l&&inp)add('Réglages',l.textContent.trim()+' · '+name,'',()=>go(inp),!S.doc)})});
  return out}
function openCmdK(){if($('#cmdk'))return;hideTip();const items=cmdItems();const s=document.createElement('div');s.className='cmdk-scrim';s.id='cmdk';
  s.innerHTML=`<div class="cmdk" role="dialog" aria-modal="true" aria-label="Rechercher une commande"><div class="cmdk-in"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="5.5"/><path d="M13.2 13.2 17 17"/></svg><input id="cmdkQ" placeholder="Rechercher une commande, un outil, un réglage…" autocomplete="off" spellcheck="false" aria-controls="cmdkL"><kbd>Échap</kbd></div><div class="cmdk-l" id="cmdkL" role="listbox"></div><div class="cmdk-f"><span><kbd>↑</kbd><kbd>↓</kbd> naviguer</span><span><kbd>↵</kbd> lancer</span></div></div>`;
  document.body.appendChild(s);const q=$('#cmdkQ',s),L=$('#cmdkL',s);let res=[],sel=0;const back=document.activeElement;
  const close=()=>{s.remove();if(back&&back.isConnected&&back.focus)try{back.focus({preventScroll:true})}catch(e){}};
  const run=i=>{const it=res[i];if(!it||it.dis)return;close();setTimeout(()=>{try{it.fn()}catch(e){console.error(e)}},0)};
  const score=(it,t)=>{if(!t)return 1;const L=norm(it.label),G=norm(it.g);if(L.startsWith(t))return 100-L.length/100;const i=L.indexOf(t);if(i>=0)return 60-i/10;if(norm(it.label+' '+it.g).includes(t))return 20;
    let k=0,f=-1;for(let i=0;i<L.length;i++){if(L[i]===t[k]){if(f<0)f=i;k++;if(k===t.length)return i-f<t.length*2+1?5:0}}return 0};
  const draw=()=>{const t=norm(q.value.trim());res=items.map(it=>({it,s:score(it,t)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s||(a.it.dis-b.it.dis)).map(x=>x.it).slice(0,t?40:60);if(!t)res.sort((a,b)=>['Outils','Fichier','Image','Calque','Sélection','Filtre','Affichage','Édition','Panneaux','Réglages'].indexOf(a.g)-['Outils','Fichier','Image','Calque','Sélection','Filtre','Affichage','Édition','Panneaux','Réglages'].indexOf(b.g));
    sel=Math.min(sel,Math.max(0,res.length-1));let g='';L.innerHTML=res.length?res.map((it,i)=>{const h=it.g!==g?`<div class="cmdk-g">${esc(it.g)}</div>`:'';g=it.g;return h+`<button role="option" data-i="${i}" class="${i===sel?'on':''}" ${it.dis?'aria-disabled="true"':''} aria-selected="${i===sel}"><span>${esc(it.label)}</span>${it.kbd?`<kbd>${esc(it.kbd)}</kbd>`:''}</button>`}).join(''):'<p class="cmdk-none">Aucun résultat</p>';
    const on=L.querySelector('.on');on&&on.scrollIntoView({block:'nearest'})};
  q.oninput=()=>{sel=0;draw()};q.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();sel=Math.min(res.length-1,sel+1);draw()}else if(e.key==='ArrowUp'){e.preventDefault();sel=Math.max(0,sel-1);draw()}else if(e.key==='Enter'){e.preventDefault();run(sel)}else if(e.key==='Escape'){e.preventDefault();close()}e.stopPropagation()};
  L.onclick=e=>{const b=e.target.closest('[data-i]');if(b)run(+b.dataset.i)};L.onpointermove=e=>{const b=e.target.closest('[data-i]');if(b&&+b.dataset.i!==sel){sel=+b.dataset.i;$$('[data-i]',L).forEach(x=>{x.classList.toggle('on',+x.dataset.i===sel);x.setAttribute('aria-selected',+x.dataset.i===sel)})}};
  s.addEventListener('pointerdown',e=>{if(e.target===s)close()});draw();q.focus()}
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&!e.altKey&&(e.key==='k'||e.key==='K'||e.code==='KeyK')){if($('#library')&&!e.target.closest('#library'))return;e.preventDefault();e.stopPropagation();$('#cmdk')?$('#cmdk').remove():openCmdK()}},true);
$('#bCmd').onclick=()=>openCmdK();
/* welcome screen */
(()=>{const e=$('#empty');e.innerHTML=`<div class="welcome"><div class="w-logo">${PRISM_LOGO}</div><h2>Bienvenue dans Prism</h2><p>Ouvrez une photo pour commencer, ou glissez-la n’importe où dans cette fenêtre.</p>
  <div class="w-acts"><button class="btn primary" id="bOpenEmpty">Ouvrir une photo…</button><button class="btn" id="bProjEmpty">Photothèque</button></div>
  <div class="w-tiles" id="wTiles"></div>
  <div class="w-recent" id="wRecent" hidden><h3>Reprendre</h3><div class="w-grid" id="wGrid"></div></div>
  <div class="w-tips" id="wTips"></div>
  <p class="w-fmt">JPEG · HEIC · PNG · TIFF · WebP · AVIF · PSD · PDF · GIF · BMP · SVG · tous les RAW</p></div>`;
  $('#bOpenEmpty').onclick=openFile;$('#bProjEmpty').onclick=()=>openLibrary();
  const fill=async()=>{if(e.hidden)return;try{await libLoad();const items=[...LIB.items].sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)).slice(0,12);const g=$('#wGrid');$('#wRecent').hidden=!items.length;
      g.innerHTML=items.map(it=>`<button class="w-card" data-id="${esc(it.id)}"><img alt=""><span>${esc(it.name||'Sans titre')}</span>${it.updatedAt?`<small>${esc(new Date(it.updatedAt).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}))}</small>`:''}</button>`).join('');$$('.w-card',g).forEach((b,i)=>{libThumb(items[i],b.querySelector('img'));b.onclick=()=>libOpen(items[i].id)})}catch(err){console.warn(err)}};
  new MutationObserver(fill).observe(e,{attributes:true,attributeFilter:['hidden']});fill()})();
