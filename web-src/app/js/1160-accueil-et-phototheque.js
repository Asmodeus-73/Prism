/* ================= 1.0 : accueil et photothèque refaits =================
   Même langage que l'éditeur (cartes arrondies sur le fond, une couleur d'accent, Geist) :
   - Accueil : salutation, « Reprendre » avec la dernière photo en grand, une colonne « Commencer »
     (ouvrir, nouveau, photothèque, tri express, avec leurs raccourcis) et les astuces. Glisser des photos
     n'importe où affiche un grand cadre de dépôt.
   - Photothèque : barre du haut plus calme (recherche, tri, taille, « Importer ▾ », « Ajouter des photos »),
     filtres en pastilles sur une ligne, vignettes sans cadre avec la note au survol, icônes dans la colonne
     de gauche, fiche de droite rangée (aperçu, infos, « Ouvrir » en grand).
   Rien ne change dans le fonctionnement : les éléments existants sont seulement déplacés et restylés. */
(()=>{
const I=(d,c='black')=>`url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='${c}' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'>${d}</svg>`)}")`;
const ICO={all:'<rect x="3" y="3" width="6" height="6" rx="1.2"/><rect x="11" y="3" width="6" height="6" rx="1.2"/><rect x="3" y="11" width="6" height="6" rx="1.2"/><rect x="11" y="11" width="6" height="6" rx="1.2"/>',
  recent:'<circle cx="10" cy="10" r="7"/><path d="M10 6v4l2.5 2"/>',fav:'<path d="M10 3l2.1 4.4 4.8.6-3.5 3.3.9 4.7L10 13.8 5.7 16l.9-4.7L3.1 8l4.8-.6z"/>',
  picked:'<path d="M5 17V3.5M5 4h9l-2 3.5 2 3.5H5"/>',rejected:'<circle cx="10" cy="10" r="7"/><path d="M7.5 7.5l5 5M12.5 7.5l-5 5"/>',
  unrated:'<path d="M10 3l2.1 4.4 4.8.6-3.5 3.3.9 4.7L10 13.8 5.7 16l.9-4.7L3.1 8l4.8-.6z" stroke-dasharray="2 2"/>',raw:'<rect x="3" y="5" width="14" height="10" rx="2"/><path d="M6.5 12V8h1.6a1.2 1.2 0 010 2.4H6.5M8.3 10.4L9.4 12M11 12V8h1.6l1.4 4"/>',
  dups:'<rect x="6" y="6" width="11" height="11" rx="2"/><path d="M4 13V4.8C4 4.4 4.4 4 4.8 4H13"/>',trash:'<path d="M4 6h12M8 6V4h4v2M5.5 6l.8 10h7.4l.8-10"/>',
  album:'<rect x="3" y="4" width="14" height="12" rx="2"/><path d="M3 13l4-4 3 3 2-2 5 5"/>',smart:'<path d="M4 5h12M6 10h8M8 15h4"/>',date:'<rect x="3" y="4.5" width="14" height="12" rx="2"/><path d="M3 8.5h14M7 3v3M13 3v3"/>',
  tag:'<path d="M3.5 10.5V4.5a1 1 0 011-1h6l6 6-7 7z"/><circle cx="7.5" cy="7.5" r="1"/>',cam:'<path d="M3 7.5a1.5 1.5 0 011.5-1.5h2l1.5-2h4l1.5 2h2A1.5 1.5 0 0117 7.5v7A1.5 1.5 0 0115.5 16h-11A1.5 1.5 0 013 14.5z"/><circle cx="10" cy="11" r="3"/>',
  dev:'<rect x="3" y="4" width="14" height="9.5" rx="1.5"/><path d="M7 16.5h6"/>'};
const st=document.createElement('style');st.textContent=`
/* ---------- accueil ---------- */
/* sur tablette, l’accueil occupait une seule colonne étroite de la grille de l’éditeur */
body.no-doc .work>#stage{grid-column:1/-1!important;grid-row:1/-1!important}
body.no-doc .empty{padding:clamp(28px,6vh,64px) 32px 32px;align-items:flex-start;overflow:auto}
body.no-doc .welcome.hm{max-width:1180px;width:100%;display:block;text-align:left}
.hm .w-head{margin:0 0 22px;column-gap:14px}
body.no-doc .hm .w-head .w-logo .logo{width:44px;height:44px}
.hm .w-head h2{font-size:30px;font-weight:650;letter-spacing:-.02em}
.hm .w-head p{font-size:14px;color:var(--fg-3)}
.hm-grid{width:100%;text-align:left;display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start}
.hm-main,.hm-card{background:var(--chrome);border:1px solid var(--line);border-radius:var(--r-l,14px)}
.hm-main{padding:16px 18px 18px;min-height:360px}
.hm-side{display:grid;gap:16px}
.hm-card{padding:14px;text-align:left}
.hm-card>h3,.hm .w-rh h3{margin:0 0 10px;font:600 12px var(--ui);letter-spacing:.06em;text-transform:uppercase;color:var(--fg-3)}
.hm .w-rh{margin-bottom:12px}
body.no-doc .hm .w-recent{margin:0}
body.no-doc .hm .w-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:auto;gap:14px;overflow:visible}
body.no-doc .hm .w-card{position:relative;display:grid;gap:4px;align-content:start;text-align:left;padding:0;min-width:0}
body.no-doc .hm .w-card:nth-child(n+7){display:grid}
body.no-doc .hm .w-card:nth-child(n+10){display:none}
body.no-doc .hm .w-card img{width:100%;aspect-ratio:3/2;object-fit:cover;border-radius:10px;background:var(--chrome-2);box-shadow:none;outline:1px solid var(--line);outline-offset:-1px}
body.no-doc .hm .w-card span{padding:4px 2px 0;font-size:13px;font-weight:550;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
body.no-doc .hm .w-card small{padding:0 2px;font-size:11.5px}
body.no-doc .hm .w-card:first-child:hover img{transform:none}
body.no-doc .hm .w-card:hover img{transform:translateY(-2px);box-shadow:0 10px 24px rgba(0,0,0,.18)}
body.no-doc .hm .w-card:focus-visible{outline:none}body.no-doc .hm .w-card:focus-visible img{outline:2px solid var(--accent);outline-offset:2px}
/* la dernière photo en grand */
body.no-doc .hm .w-card:first-child{grid-column:span 2;grid-row:span 2;min-height:280px}
body.no-doc .hm .w-card:first-child img{position:absolute;inset:0;aspect-ratio:auto;height:100%}
body.no-doc .hm .w-card:first-child span{position:absolute;left:12px;bottom:34px;right:110px;padding:0;color:#fff;font-size:16px;font-weight:650;text-shadow:0 1px 8px rgba(0,0,0,.5)}
body.no-doc .hm .w-card:first-child small{position:absolute;top:auto;right:auto;left:12px;bottom:14px;background:none;color:rgba(255,255,255,.85);text-shadow:0 1px 6px rgba(0,0,0,.5)}
body.no-doc .hm .w-card:first-child::before{content:"";position:absolute;inset:0;border-radius:10px;background:linear-gradient(transparent 55%,rgba(0,0,0,.55));pointer-events:none;z-index:1}
body.no-doc .hm .w-card:first-child span,body.no-doc .hm .w-card:first-child small{z-index:2}
body.no-doc .hm .w-card:first-child::after{content:var(--hm-go,"Reprendre");display:block!important;position:absolute;inset:auto 12px 14px auto;width:auto;height:auto;transform:none;border:0;box-shadow:none;line-height:1.2;z-index:2;padding:7px 14px;border-radius:999px;background:var(--accent);color:#fff;font:600 12.5px var(--ui)}
body.no-doc .hm .w-card:first-child:hover::after{filter:brightness(1.08)}
.hm-none{display:grid;place-items:center;align-content:center;gap:8px;min-height:320px;border:1.5px dashed var(--line-2);border-radius:12px;color:var(--fg-2);text-align:center;cursor:pointer;background:none;font:inherit;width:100%}
.hm-none:hover{border-color:var(--accent);background:var(--accent-soft)}
.hm-none svg{width:34px;height:34px;fill:none;stroke:var(--accent-fg,var(--accent));stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}
.hm-none b{font:650 17px var(--ui);color:var(--fg)}
.hm-none .w-fmt{font:11.5px var(--mono,monospace)!important;color:var(--fg-3);margin:4px 0 0!important}
.hm-main:has(#wRecent:not([hidden])) .hm-none{display:none}
/* Commencer */
body.no-doc .hm .w-tiles{display:grid;grid-template-columns:1fr;gap:4px;margin:0}
body.no-doc .hm .w-tile{display:grid;grid-template-columns:34px 1fr auto;grid-template-rows:auto auto;column-gap:12px;align-items:center;padding:9px 10px;border:0;border-radius:10px;background:none;box-shadow:none;text-align:left;color:var(--fg);min-height:0}
body.no-doc .hm .w-tile:hover{background:var(--hover)}
body.no-doc .hm .w-tile svg{grid-row:span 2;width:34px;height:34px;padding:8px;box-sizing:border-box;border-radius:9px;background:var(--chrome-2);margin:0}
body.no-doc .hm .w-tile:first-child svg{background:var(--accent);color:#fff;stroke:#fff}
body.no-doc .hm .w-tile b{grid-column:2;grid-row:1;align-self:end;font-size:13.5px;color:var(--fg)}
body.no-doc .hm .w-tile span:not(.hm-kbd){grid-column:2;grid-row:2;align-self:start;font-size:12px;color:var(--fg-3)}
body.no-doc .hm .w-tile:first-child{background:var(--accent-soft)}
body.no-doc .hm .w-tile:first-child b,body.no-doc .hm .w-tile:first-child span{color:var(--fg)}
.hm-kbd{grid-column:3;grid-row:1/3;align-self:center;font:11px var(--mono,monospace);color:var(--fg-3);padding:2px 6px;border:1px solid var(--line);border-radius:6px}
/* astuces, app, version */
body.no-doc .hm #wTips{display:grid!important;gap:8px;margin:0;font-size:12.5px;color:var(--fg-2);text-align:left}
body.no-doc .hm #wTips>div{padding:0;background:none;border:0}
body.no-doc .hm #wTips kbd{font:11px var(--mono,monospace);padding:1px 5px;border:1px solid var(--line);border-radius:5px;background:var(--chrome-2)}
body.no-doc .hm #w49 svg{display:none}body.no-doc .hm #w49 a{display:inline-block;margin-top:4px;font-weight:600}
body.no-doc .hm #w49{display:block;margin:0;line-height:1.6;font-size:12.5px;color:var(--fg-2);text-align:left;justify-self:stretch}
body.no-doc .hm .w-ver{margin:2px 0 0;text-align:left;justify-self:start;color:var(--fg-3);font:11px var(--mono,monospace)}
body.no-doc .hm .w-drop,body.no-doc .hm .w-acts{display:none!important}
/* dépôt n'importe où */
#hmDrop{position:fixed;inset:10px;z-index:60;display:none;place-items:center;border:2px dashed var(--accent);border-radius:18px;background:color-mix(in srgb,var(--bg) 80%,transparent);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);pointer-events:none}
#hmDrop.on{display:grid}
#hmDrop div{display:grid;justify-items:center;gap:8px;color:var(--fg)}#hmDrop b{font:650 20px var(--ui)}#hmDrop span{color:var(--fg-2);font-size:13px}
#hmDrop svg{width:40px;height:40px;fill:none;stroke:var(--accent-fg,var(--accent));stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
@media (max-width:1000px){.hm-grid{grid-template-columns:1fr}.hm-side{grid-template-columns:1fr 1fr}.hm-side>.hm-card:first-child{grid-column:1/-1}}
@media (max-width:640px){body.no-doc .empty{padding:20px 14px}.hm .w-head h2{font-size:24px}.hm-side{grid-template-columns:1fr}
  body.no-doc .hm .w-grid{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-flow:row;overflow:visible}
  body.no-doc .hm .w-card:nth-child(n+6){display:none}.hm-main{padding:12px}.hm-kbd{display:none}}

/* ---------- photothèque ---------- */
body.atelier .library{background:var(--bg)}
body.atelier .lb-top{gap:8px;height:52px;padding:0 8px 0 12px;background:var(--chrome)}
body.atelier #lbQ{flex:1 1 280px;max-width:420px;height:34px;padding:0 12px 0 34px;border-radius:999px;border:1px solid var(--line);background:var(--chrome-2) ${I('<circle cx="9" cy="9" r="5.5"/><path d="M13 13l4 4"/>','#8a8a96')} no-repeat 12px 50%/15px}
body.atelier #lbQ:focus{border-color:var(--accent);outline:none;background-color:var(--chrome)}
body.atelier #lbSort{flex:0 0 auto;width:190px;height:34px;border-radius:999px;padding:0 30px 0 12px;border:1px solid var(--line);background-color:var(--chrome)}
body.atelier .lb-top .btn.sm{height:34px;border-radius:999px;padding:0 14px}
body.atelier .lb-top #lbImp,body.atelier .lb-top #lbFolder{display:none}
.lb-impbtn::after{content:"";display:inline-block;width:7px;height:7px;margin-left:8px;border:solid currentColor;border-width:0 1.5px 1.5px 0;transform:translateY(-2px) rotate(45deg)}
body.atelier .lb-filters{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--line)}
body.atelier .lb-filters .lb-tools{display:contents!important}
body.atelier .lb-filters span.lb-fl{display:none}
body.atelier .lb-filters label.lb-fl{font-size:12.5px;color:var(--fg-2);display:inline-flex;align-items:center;gap:6px;order:6}
body.atelier .lb-filters .lb-minr{order:1}
body.atelier .lb-filters .lb-tools>button:nth-of-type(1),body.atelier .lb-filters .lb-tools>button:nth-of-type(2){order:2;width:30px;padding:0!important}
body.atelier .lb-filters .lb-dot{order:3}
body.atelier .lb-filters .lb-count{order:5}
body.atelier .lb-filters #lbSize{order:7}
body.atelier .lb-filters .lb-tools>button:nth-of-type(3){display:none}
body.atelier .lb-filters .lb-tools>button:nth-of-type(4){order:8}
body.atelier #lbFil [data-triage]{display:none!important}
body.atelier .lb-filters .btn.sm.primary{background:var(--accent-soft)!important;color:var(--accent-fg)!important;border-color:var(--accent-line)!important}
body.atelier .lb-filters .lb-mob{order:9}
body.atelier .lb-filters .lb-dot:first-of-type{margin-left:6px}
body.atelier .lb-filters .btn.sm{height:30px;border-radius:999px;padding:0 12px;background:var(--chrome-2);border-color:transparent}
body.atelier .lb-filters .btn.sm:hover{background:var(--hover)}
body.atelier .lb-filters .btn.sm.on,body.atelier .lb-filters .btn.sm[aria-pressed=true]{background:var(--accent-soft);color:var(--accent-fg);border-color:var(--accent-line)}
body.atelier .lb-minr{display:inline-flex;padding:2px;border-radius:999px;background:var(--chrome-2);gap:0}
body.atelier .lb-minr button{height:26px;padding:0 10px;border:0;border-radius:999px;background:none;color:var(--fg-2);font:12px var(--ui);cursor:pointer}
body.atelier .lb-minr button.on{background:var(--chrome);color:var(--fg);box-shadow:0 1px 3px rgba(0,0,0,.15)}
body.atelier .lb-dot{width:18px;height:18px}
body.atelier .lb-count{margin-left:auto;font-size:12px;color:var(--fg-3)}
body.atelier #lbSize{width:90px}
.lb-sep{width:1px;height:20px;background:var(--line);margin:0 2px}
body.atelier .lb-grid{gap:18px 16px;padding:18px 20px 24px}
body.atelier .lb-gh{font:650 15px var(--ui);color:var(--fg);letter-spacing:-.01em;padding:6px 0 0}
body.atelier .lb-card{overflow:visible!important;background:none!important;border:0!important;border-radius:12px;padding:0;box-shadow:none;transition:transform .15s}
body.atelier .lb-card .lb-th{border-radius:10px;overflow:hidden;background:var(--chrome-2);outline:1px solid var(--line);outline-offset:-1px;transition:box-shadow .15s,transform .15s}
body.atelier .lb-card:hover .lb-th{transform:translateY(-2px);box-shadow:0 10px 24px rgba(0,0,0,.18)}
body.atelier .lb-card.on .lb-th{outline:3px solid var(--accent);outline-offset:-3px;box-shadow:none}
body.atelier .lb-card.on{outline:0!important;box-shadow:none!important}
body.atelier .lb-card .lb-meta{padding:7px 2px 0;display:flex;align-items:center;gap:6px;min-width:0}
body.atelier .lb-card .lb-meta b{flex:1;min-width:0;font-size:12.5px;font-weight:550;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
body.atelier .lb-card .stars.sm{opacity:0;transition:opacity .12s}
body.atelier .lb-card:hover .stars.sm,body.atelier .lb-card.on .stars.sm,body.atelier .lb-card .stars.sm:has(.on){opacity:1}
body.atelier .lb-badge{font:600 10.5px var(--ui);padding:3px 8px;border-radius:999px;background:rgba(15,15,20,.55);color:#fff;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:0}
body.atelier .lb-badge.dup{background:rgba(15,15,20,.4);color:rgba(255,255,255,.9)}
body.atelier .lb-side{padding:12px 8px}
body.atelier .lb-side .lb-h{margin:14px 10px 6px;font:600 11px var(--ui);letter-spacing:.07em;text-transform:uppercase;color:var(--fg-3)}
body.atelier .lb-side .lb-h:first-child{margin-top:2px}
body.atelier .lb-nav{display:flex;align-items:center;gap:10px;height:32px;padding:0 10px;border-radius:8px;font-size:13px}
body.atelier .lb-nav::before{content:"";flex:none;width:16px;height:16px;background:currentColor;opacity:.75;-webkit-mask:var(--ic,${I(ICO.album)}) center/contain no-repeat;mask:var(--ic,${I(ICO.album)}) center/contain no-repeat}
body.atelier .lb-nav span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
body.atelier .lb-nav small{font:11px var(--mono,monospace);color:var(--fg-3)}
body.atelier .lb-nav:has(svg)::before{display:none}
body.atelier .lb-nav.on{background:var(--accent-soft);color:var(--accent-fg)}body.atelier .lb-nav.on::before{opacity:1}
${Object.entries({all:'all',recent:'recent',fav:'fav',picked:'picked',rejected:'rejected',unrated:'unrated',raw:'raw',dups:'dups',trash:'trash'}).map(([k,v])=>`.lb-nav[data-coll="${k}"]{--ic:${I(ICO[v])}}`).join('')}
.lb-nav[data-smart]{--ic:${I(ICO.smart)}}.lb-nav[data-date],.lb-nav[data-year],.lb-nav[data-month]{--ic:${I(ICO.date)}}.lb-nav[data-tag]{--ic:${I(ICO.tag)}}.lb-nav[data-cam]{--ic:${I(ICO.cam)}}.lb-nav[data-src],.lb-nav[data-folder]{--ic:${I(ICO.dev)}}
body.atelier .lb-info{padding:14px;display:flex;flex-direction:column;gap:10px}
body.atelier .lb-info .lb-big{border-radius:10px;overflow:hidden;background:var(--chrome-2)}
body.atelier .lb-info .lb-name{font:650 16px var(--ui);border:1px solid transparent;border-radius:8px;padding:4px 6px;margin:0 -6px;background:none}
body.atelier .lb-info .lb-name:hover{border-color:var(--line)}body.atelier .lb-info .lb-name:focus{border-color:var(--accent);outline:none}
body.atelier .lb-info .lb-sub{font-size:12px;color:var(--fg-3);line-height:1.6;margin:0}
body.atelier .lb-info .btn{border-radius:999px}
body.atelier .lb-info .lb-acts{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:auto;padding-top:6px}
body.atelier .lb-info .lb-acts .btn{height:32px;justify-content:center}
body.atelier .lb-info .lb-acts [data-act=open]{grid-column:1/-1;order:-2;height:40px;font-size:14px;font-weight:600}
body.atelier .lb-info .lb-acts [data-act=del]{color:#e5484d}
body.atelier .lb-info .lb-acts [data-act=del]:hover{background:rgba(229,72,77,.12)}
body.atelier .lb-info .lb-hint{color:var(--fg-3);font-size:12.5px;line-height:1.7}
body.atelier .lb-empty{display:grid;justify-items:center;gap:12px;padding:80px 20px;color:var(--fg-2)}
body.atelier .lb-empty p{font:600 16px var(--ui);color:var(--fg);margin:0}
`;document.body.appendChild(st);

/* ---------- accueil : on range les éléments existants ---------- */
function home(){const wl=$('#empty .welcome');if(!wl||wl.classList.contains('hm'))return;wl.classList.add('hm');
  const grid=document.createElement('div');grid.className='hm-grid';const main=document.createElement('div');main.className='hm-main';const side=document.createElement('div');side.className='hm-side';
  grid.append(main,side);const head=wl.querySelector('.w-head');(head||wl.firstChild)?head.after(grid):wl.prepend(grid);
  const rec=$('#wRecent');if(rec)main.appendChild(rec);
  const none=document.createElement('button');none.type='button';none.className='hm-none';
  none.innerHTML='<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="5" y="9" width="30" height="22" rx="3"/><path d="M5 26l8-7 6 5 5-4 11 8"/><circle cx="27" cy="16" r="2.5"/></svg><b>Ouvrez votre première photo</b><span>Cliquez ou glissez des photos dans la fenêtre.</span>';
  const fmt=wl.querySelector('.w-fmt');if(fmt)none.appendChild(fmt.cloneNode(true));none.onclick=()=>openFile();main.appendChild(none);
  const card=(t,...n)=>{const c=document.createElement('section');c.className='hm-card';const h=document.createElement('h3');h.textContent=t;c.appendChild(h);n.filter(Boolean).forEach(x=>c.appendChild(x));side.appendChild(c);return c};
  const tiles=$('#wTiles');if(tiles){const K=[MOD+'O',MOD+'N','',''];[...tiles.children].forEach((b,i)=>{if(K[i]&&!b.querySelector('.hm-kbd')){const k=document.createElement('span');k.className='hm-kbd';k.textContent=K[i];b.appendChild(k)}})}
  card('Commencer',tiles);
  const tips=$('#wTips');card('Astuces',tips);
  const w49=$('#w49'),ver=wl.querySelector('.w-ver');if(w49||ver){const c=card('Prism',w49,ver);if(!w49)c.querySelector('h3').remove()}
  /* le module 1040 replace #w49 après la zone de dépôt : on le reprend */
  const keep=()=>{const c=side.lastElementChild,n=$('#w49'),v=wl.querySelector('.w-ver');if(!c)return;if(n&&n.parentElement!==c)c.insertBefore(n,c.querySelector('.w-ver'));if(v&&v.parentElement!==c)c.appendChild(v)};setTimeout(keep,0);setTimeout(keep,500);
  greet()}
function greet(){const h2=$('#empty .w-head h2');if(!h2)return;const hr=new Date().getHours();let n='';try{n=(PREF.get('sync2Prof',{})||{}).name||''}catch(e){}
  n=String(n).trim().split(/\s+/)[0]||'';const en=PREF.get('lang','fr')==='en';const w=en?(hr>=5&&hr<12?'Good morning':hr<18&&hr>=5?'Good afternoon':'Good evening'):(hr>=5&&hr<18?'Bonjour':'Bonsoir');h2.textContent=n?`${w}, ${n}`:w;
  document.documentElement.style.setProperty('--hm-go',en?'"Resume"':'"Reprendre"');
  const p=$('#empty .w-head p');if(p)p.textContent='Que voulez-vous retoucher aujourd’hui ?'}
new MutationObserver(()=>{if(document.body.classList.contains('no-doc'))greet()}).observe(document.body,{attributes:true,attributeFilter:['class']});

/* glisser des fichiers : un grand cadre, sur l'accueil comme dans la photothèque */
const dropUI=document.createElement('div');dropUI.id='hmDrop';dropUI.innerHTML='<div><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 6v20M12 18l8 8 8-8M8 32h24"/></svg><b>Déposez vos photos</b><span></span></div>';document.body.appendChild(dropUI);
let dn=0;const files=e=>e.dataTransfer&&[...(e.dataTransfer.types||[])].includes('Files');
const label=()=>{dropUI.querySelector('span').textContent=typeof LIB!=='undefined'&&LIB.open?'Elles seront ajoutées à la photothèque.':document.body.classList.contains('no-doc')?'Elles s’ouvriront dans l’éditeur.':'Elles s’ouvriront dans un nouvel onglet.'};
addEventListener('dragenter',e=>{if(!files(e))return;dn++;label();dropUI.classList.add('on')},true);
addEventListener('dragleave',e=>{if(!files(e))return;dn=Math.max(0,dn-1);if(!dn)dropUI.classList.remove('on')},true);
['drop','dragend'].forEach(t=>addEventListener(t,()=>{dn=0;dropUI.classList.remove('on')},true));

/* ---------- photothèque : « Importer ▾ » et petits rangements ---------- */
function lib(){const top=$('#library .lb-top');if(!top||top.querySelector('.lb-impbtn'))return;const add=$('#lbAdd');if(!add)return;
  const b=document.createElement('button');b.type='button';b.className='btn sm lb-impbtn';b.textContent='Importer';b.setAttribute('aria-haspopup','menu');
  b.onclick=()=>{const r=b.getBoundingClientRect();openMenuAt([MI('Un projet ou un fichier PSD…',{fn:()=>$('#lbImp').click()}),MI('Un dossier entier…',{fn:()=>$('#lbFolder').click()})],r.left,r.bottom+6)};
  add.before(b);add.textContent='Ajouter des photos';
  /* Tri express monte dans la barre du haut */
  const tri=document.createElement('button');tri.type='button';tri.className='btn sm lb-tri';tri.dataset.triage='';tri.textContent='Tri express';tri.title='Détecte les photos floues, mal exposées et choisit la meilleure de chaque rafale';b.before(tri)}
const _ol=openLibrary;openLibrary=function(){const r=_ol.apply(this,arguments);try{lib()}catch(e){console.warn(e)}return r};
home();try{lib()}catch(e){}
})();
