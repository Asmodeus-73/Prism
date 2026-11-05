/* ================= 1.0: écran d'accueil =================
   Comme la maquette : titre à gauche avec le petit logo, les quatre accès rapides, « Reprendre » sur une seule rangée
   (six photos au plus, avec « il y a 5 min », « hier »…), puis une grande zone de dépôt qui ouvre aussi le sélecteur au clic. */
(()=>{const st=document.createElement('style');st.textContent=`
body.no-doc .empty{padding:max(40px,10vh) 32px 40px}
body.no-doc .welcome{max-width:1040px;justify-items:stretch;text-align:left}
.w-head{display:grid;grid-template-columns:auto 1fr;column-gap:12px;align-items:center}
.w-head .w-logo{grid-row:span 2;align-self:center}
body.no-doc .w-head .w-logo .logo{width:40px;height:40px}
.w-head h2{margin:0;font-size:26px;letter-spacing:-.01em}
.w-head p{margin:2px 0 0;color:var(--fg-2)}
body.no-doc .w-tiles{margin-top:26px}
body.no-doc .w-recent{margin-top:30px}
.w-rh{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px}
.w-rh h3{margin:0}
.w-all{border:0;background:none;padding:0;color:var(--fg-2);font:12.5px var(--ui);cursor:pointer}
.w-all:hover{color:var(--accent-fg,var(--fg));text-decoration:underline}
body.no-doc .w-grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));grid-template-rows:auto;grid-auto-rows:0;row-gap:0;overflow:hidden;gap:0 14px}
body.no-doc .w-card{border:0;background:none;border-radius:0;gap:2px;cursor:pointer;color:inherit}
body.no-doc .w-card img{border-radius:10px;box-shadow:0 2px 8px rgba(20,20,40,.12);transition:transform .15s}
body.no-doc .w-card:hover img{transform:translateY(-2px)}
body.no-doc .w-card span{padding:6px 0 0;font-size:13px}
body.no-doc .w-card small{position:static;padding:0;background:none;color:var(--fg-3,var(--fg-2));font-size:11.5px}
body.no-doc .w-card:first-child::after{display:none}
body.no-doc .w-card:nth-child(n+7){display:none}
.w-drop{display:grid;justify-items:center;gap:6px;margin-top:30px;padding:46px 20px;border:1.5px dashed var(--line-2,var(--line));border-radius:14px;background:none;color:var(--fg-2);font:inherit;cursor:pointer;width:100%;transition:border-color .15s,background .15s}
.w-drop:hover,.w-drop.over{border-color:var(--accent);background:var(--accent-soft,rgba(80,90,230,.06))}
.w-drop svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.w-drop b{color:var(--fg);font:600 14px var(--ui)}
.w-drop .w-fmt{margin:0!important;font:11.5px var(--mono,monospace)}
body.no-doc #wTips,body.no-doc #w47hint,body.no-doc .p-zoom,body.no-doc .p-cmp{display:none!important}
body.no-doc #w49{order:0;margin-top:22px}
body.no-doc .welcome>*:not(.w-head):not(.w-tiles):not(.w-recent):not(.w-drop){justify-self:center;text-align:center}
@media (max-width:640px){
  body.no-doc .empty{padding:28px 16px}
  body.no-doc .w-tiles{grid-template-columns:1fr 1fr;gap:8px}
  body.no-doc .w-tile{grid-template-columns:1fr;padding:12px}
  body.no-doc .w-tile svg{grid-row:auto;margin-bottom:6px}
  body.no-doc .w-grid{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:42%;grid-auto-rows:auto;overflow-x:auto;scrollbar-width:none}
  body.no-doc .w-card:nth-child(n+7){display:grid}
  .w-drop{padding:28px 16px}
}
`;document.head.appendChild(st)})();
(()=>{const wl=$('#empty .welcome');if(!wl)return;
  /* titre */
  const head=document.createElement('div');head.className='w-head';['.w-logo','h2','p:not(.w-fmt)'].forEach(s=>{const n=wl.querySelector(':scope>'+s);if(n)head.appendChild(n)});wl.prepend(head);
  /* « Reprendre » + « Tout voir » */
  const rec=$('#wRecent'),h3=rec&&rec.querySelector('h3');
  if(h3){const rh=document.createElement('div');rh.className='w-rh';h3.before(rh);rh.appendChild(h3);const all=document.createElement('button');all.className='w-all';all.textContent='Tout voir';all.onclick=()=>openLibrary();rh.appendChild(all)}
  /* zone de dépôt */
  const dz=document.createElement('button');dz.type='button';dz.className='w-drop';
  dz.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v10M6 9l4 4 4-4M4 16h12"/></svg><b>Déposez des photos ici</b>';
  const fmt=wl.querySelector('.w-fmt');if(fmt)dz.appendChild(fmt);dz.onclick=()=>openFile();
  (rec||$('#wTiles')).after(dz);
  const w49=()=>{const n=$('#w49');if(n&&n.previousElementSibling!==dz)dz.after(n)};w49();setTimeout(w49,0);
  ['dragenter','dragover'].forEach(t=>dz.addEventListener(t,()=>dz.classList.add('over')));['dragleave','drop'].forEach(t=>dz.addEventListener(t,()=>dz.classList.remove('over')));
  /* dates relatives */
  const rel=t=>{const d=Date.now()-t,m=Math.round(d/60000);if(m<1)return'à l’instant';if(m<60)return`il y a ${m} min`;const h=Math.round(m/60);
    const a=new Date(t),n=new Date();if(a.toDateString()===n.toDateString())return`il y a ${h} h`;const y=new Date(n);y.setDate(n.getDate()-1);if(a.toDateString()===y.toDateString())return'hier';
    return a.toLocaleDateString('fr-FR',{day:'numeric',month:'short',...(a.getFullYear()!==n.getFullYear()?{year:'numeric'}:{})})};
  const g=$('#wGrid');const fix=()=>{if(typeof LIB==='undefined')return;g.querySelectorAll('.w-card').forEach(c=>{const it=LIB.items.find(i=>i.id===c.dataset.id);if(!it||!it.updatedAt)return;
    let s=c.querySelector('small');if(!s){s=document.createElement('small');c.appendChild(s)}const v=rel(it.updatedAt);if(s.textContent!==v)s.textContent=v})};
  if(g)new MutationObserver(fix).observe(g,{childList:true});
  window.PrismHome={rel}})();
