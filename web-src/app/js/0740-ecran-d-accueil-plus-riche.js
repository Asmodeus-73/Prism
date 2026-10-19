/* ===== wave28: écran d'accueil plus riche (accès rapides, récents élargis, astuces) ===== */
(()=>{
const st=document.createElement('style');st.textContent=`
body.no-doc .empty{align-items:flex-start;overflow:auto;padding:max(48px,9vh) 32px 40px}
body.no-doc .welcome{max-width:1040px;width:100%;margin:0 auto;gap:8px}
.w-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;width:100%;margin-top:28px}
.w-tile{display:grid;grid-template-columns:36px 1fr;gap:2px 12px;align-items:center;text-align:left;padding:14px 16px;border:1px solid var(--line);background:var(--chrome);border-radius:var(--r);cursor:pointer;color:inherit;font:inherit}
.w-tile:hover{border-color:var(--accent-line);background:var(--chrome-2)}
.w-tile svg{grid-row:span 2;width:36px;height:36px;padding:8px;border-radius:9px;background:var(--chrome-2);stroke:var(--fg);fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.w-tile b{font-weight:600;font-size:13.5px}
.w-tile span{font-size:12px;color:var(--fg-2)}
.w-recent{margin-top:34px}
.w-recent h3{font-size:13px;color:var(--fg)}
body.no-doc .w-grid{grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px}
.w-card{position:relative}
.w-card small{position:absolute;top:8px;right:8px;padding:2px 7px;border-radius:99px;background:rgba(0,0,0,.55);color:#fff;font-size:11px}
.w-card:first-child::after{content:'Dernière retouche';position:absolute;top:8px;left:8px;padding:2px 8px;border-radius:99px;background:var(--accent);color:#fff;font-size:11px;font-weight:600}
.w-tips{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;width:100%;margin-top:34px;text-align:left}
.w-tips div{padding:12px 14px;border-radius:var(--r);background:var(--chrome);font-size:12.5px;color:var(--fg-2);line-height:1.45}
.w-tips kbd{font-family:var(--mono);font-size:11px;padding:1px 5px;border:1px solid var(--line);border-radius:4px;color:var(--fg)}
.w-acts{display:none!important}
.w-tile:first-child{background:var(--accent);border-color:var(--accent);color:#fff}
.w-tile:first-child:hover{filter:brightness(1.1)}
.w-tile:first-child svg{background:rgba(255,255,255,.18);stroke:#fff}
.w-tile:first-child span{color:rgba(255,255,255,.8)}
body.no-doc .w-logo .logo{width:92px;height:92px}
.w-fmt{margin-top:30px!important}
`;document.head.appendChild(st);
const I={
 open:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 lib:'<rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 tri:'<path d="M5 12l4 4 10-10"/>',
 key:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8"/>'};
const svg=k=>`<svg viewBox="0 0 24 24">${I[k]}</svg>`;
const tiles=[
 ['open','Ouvrir une photo','Depuis votre appareil',()=>openFile()],
 ['plus','Nouveau document','Toile vide, taille libre',()=>newDocDialog()],
 ['lib','Photothèque','Toutes vos photos',()=>openLibrary()],
 ['tri','Tri express','Trier une série de photos',()=>openLibrary().then(()=>window.triageLib(libFiltered().map(i=>i.id)))]];
const box=$('#wTiles');
if(box){box.innerHTML=tiles.map((t,i)=>`<button class="w-tile" data-i="${i}">${svg(t[0])}<b>${t[1]}</b><span>${t[2]}</span></button>`).join('');
 box.onclick=e=>{const b=e.target.closest('.w-tile');if(b)try{tiles[+b.dataset.i][3]()}catch(err){console.warn(err)}}}
const tips=$('#wTips');
if(tips)tips.innerHTML=`<div><kbd>Ctrl/⌘ K</kbd> cherche n'importe quelle commande, outil ou réglage.</div><div>Double-cliquez une photo de la Photothèque pour l'ouvrir en retouche.</div><div>Glissez des photos n'importe où dans la fenêtre pour les ouvrir.</div>`;
})();

