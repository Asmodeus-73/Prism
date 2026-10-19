/* ================= v18: clearer tool icons, optional names beside the icons, addTool helper ================= */
const ICN={
 move:'<path d="M10 2.5v15M2.5 10h15"/><path d="M10 2.5 7.8 4.7M10 2.5l2.2 2.2M10 17.5l-2.2-2.2M10 17.5l2.2-2.2M2.5 10l2.2-2.2M2.5 10l2.2 2.2M17.5 10l-2.2-2.2M17.5 10l-2.2 2.2"/>',
 marquee:'<rect x="3" y="4" width="14" height="12" rx="1" stroke-dasharray="2.4 2"/>',
 lasso:'<path d="M10 3.2c-4.3 0-7.5 2.2-7.5 5 0 2.7 3.2 4.9 7.5 4.9s7.5-2.2 7.5-4.9c0-2.8-3.2-5-7.5-5z"/><path d="M6.8 12.4c-.8 1.3-.6 3 .8 3.8 1.1.6 1.6 1.2 1.4 2"/>',
 wand:'<path d="M3 17 12 8"/><path d="M12.8 4.2V2M12.8 4.2h2.2M16.8 4.2h2M12.8 4.2l-1.5-1.5M12.8 4.2l1.6-1.6M15 7.6l1.6 1.6"/><path d="M15.5 12v3M14 13.5h3" />',
 pen:'<path d="M10 2.5 14.8 8.4 11.2 16H8.8L5.2 8.4z"/><circle cx="10" cy="9.6" r="1.3"/><path d="M10 10.9V16M7.5 17.6h5"/>',
 crop:'<path d="M5 1.5V15h13.5"/><path d="M1.5 5H15v13.5"/>',
 eyedropper:'<path d="M13.2 2.8a2.2 2.2 0 0 1 3.1 3.1l-1.7 1.7-3.1-3.1z"/><path d="m11.5 6.5-7.6 7.6c-.4.4-.6.9-.6 1.4v1.2h1.2c.5 0 1-.2 1.4-.6l7.6-7.6"/><path d="m10.4 7.6 3 3"/>',
 heal:'<rect x="2" y="7" width="16" height="6" rx="3" transform="rotate(-45 10 10)"/><path d="m8.2 11.8 3.6-3.6"/><path d="M8.7 8.4h.01M11.6 11.6h.01M8.4 11.3h.01M11.6 8.7h.01"/>',
 remove:'<path d="M7 16.5 3.2 12.7a1.5 1.5 0 0 1 0-2.1l6.1-6.1a1.5 1.5 0 0 1 2.1 0l3.4 3.4a1.5 1.5 0 0 1 0 2.1L9.6 16.5z"/><path d="M5.5 8.3 11.6 14.4M9 16.5h8"/><path d="M16 2.4v2.6M14.7 3.7h2.6"/>',
 clone:'<path d="M7.6 10.6h4.8l.9-3.4a3.3 3.3 0 1 0-6.6 0z"/><path d="M4 12.4h12v3H4z"/><path d="M3 17.6h14"/>',
 brush:'<path d="M17.2 2.8c-3.4 1.7-6.4 4.8-8 7.4l1.6 1.6c2.6-1.6 5.7-4.6 7.4-8z"/><path d="M8.2 11.4c-2.3-.4-3.7 1-3.8 2.8-.1 1.7-1 2.6-2 3 2.8 1 6.4.3 7.1-2.4"/>',
 eraser:'<path d="M3.2 12.2 11 4.4a1.5 1.5 0 0 1 2.1 0l3.1 3.1a1.5 1.5 0 0 1 0 2.1l-7 7H6.6z"/><path d="m7.8 8.8 4.6 4.6M9 16.6h8.3"/>',
 gradient:'<rect x="2.5" y="3.5" width="15" height="13" rx="2"/><path d="M6.5 13.5 13.5 6.5M11.4 6.5h2.1v2.1" /><path d="M4.5 15.5 5.5 14.5M7 13l.8-.8" opacity=".5"/>',
 dodge:'<circle cx="10" cy="10" r="6.5"/><path d="M10 3.5v13"/><path d="M10 3.5a6.5 6.5 0 0 0 0 13z" fill="currentColor" stroke="none"/>',
 text:'<path d="M4 5.5V3.8h12v1.7M10 3.8v12.4M7.4 16.2h5.2"/>',
 shape:'<rect x="2.8" y="9.5" width="8" height="7.7" rx="1"/><circle cx="13" cy="7" r="4"/>',
 hand:'<path d="M7 10V4.6a1.4 1.4 0 0 1 2.8 0V9M9.8 9V3.4a1.4 1.4 0 0 1 2.8 0V9M12.6 9V5a1.4 1.4 0 0 1 2.8 0v6.3c0 3.8-2.4 6.7-5.8 6.7-2.3 0-3.7-1.1-5.1-3.4L3 11.5c-.7-1.1.7-2.3 1.7-1.4L7 12.3"/>',
 zoom:'<circle cx="8.5" cy="8.5" r="5.5"/><path d="m12.7 12.7 4.8 4.8M6 8.5h5M8.5 6v5"/>',
 bucket:'<path d="m3.6 10.4 5.8-6.6 6.2 5.6-5.3 6.3a1.5 1.5 0 0 1-2.1.1l-4.5-4a1.5 1.5 0 0 1-.1-1.4z"/><path d="M3.8 10.6h10.8"/><path d="M16.6 11.5c1 1.4 1.5 2.3 1.5 3.1a1.6 1.6 0 0 1-3.2 0c0-.8.7-1.7 1.7-3.1z" fill="currentColor"/>',
 transform:'<rect x="5" y="5" width="10" height="10"/><path d="M3.4 3.4h3.2v3.2H3.4zM13.4 3.4h3.2v3.2h-3.2zM3.4 13.4h3.2v3.2H3.4zM13.4 13.4h3.2v3.2h-3.2z" fill="var(--chrome)"/>',
 liquify:'<path d="M2.5 7c2-2.2 3.5-2.2 5 0s3 2.2 5 0 3.500-2.200 5 0"/><path d="M2.5 11.5c2-2.2 3.5-2.2 5 0s3 2.2 5 0 3.500-2.200 5 0"/><path d="M2.5 16c2-2.2 3.5-2.2 5 0s3 2.2 5 0 3.500-2.200 5 0" opacity=".45"/>',
 smudge:'<path d="M3 15c3.500-.5 5-2.200 6.500-5l2.800-5.500a1.500 1.500 0 0 1 2.700 1.200L13.500 10"/><path d="M8.500 16c1.800 0 3.800-.8 5.200-2.800l2-3.100"/><path d="M3 18h8" opacity=".5"/>',
 patch:'<path d="M4 4h5v3H7v3H4z"/><path d="M16 16h-5v-3h2v-3h3z"/><path d="M9 7h2v2M11 13H9v-2M7 7l6 6" opacity=".6"/>',
 redeye:'<path d="M1.800 10S5 4.500 10 4.500 18.200 10 18.200 10 15 15.500 10 15.500 1.800 10 1.800 10z"/><circle cx="10" cy="10" r="3"/><circle cx="10" cy="10" r="1.200" fill="currentColor"/><path d="M10 1.800V3M4.300 3.600l.8.9M15.700 3.600l-.8.9" opacity=".6"/>'};
Object.assign(IC,ICN);
const TOOL_NAMES={move:'Déplacer',marquee:'Sélection',lasso:'Lasso',wand:'Baguette',pen:'Plume',crop:'Recadrer',eyedropper:'Pipette',heal:'Correcteur',remove:'Gomme IA',clone:'Tampon',brush:'Pinceau',eraser:'Gomme',gradient:'Dégradé',dodge:'Densité',text:'Texte',shape:'Formes',hand:'Main',zoom:'Zoom',bucket:'Pot de peinture',transform:'Transformer',liquify:'Fluidité',smudge:'Doigt',patch:'Pièce',redeye:'Yeux rouges'};
const TOOL_SUB={heal:'retouche les taches',remove:'gomme magique : efface un objet (IA)',clone:'copie une zone',dodge:'éclaircir, assombrir, éponge',lasso:'libre, polygonal, magnétique',marquee:'rectangle, ellipse',wand:'baguette magique : sélection par couleur',pen:'tracés vectoriels',eraser:'efface les pixels',gradient:'dégradé',bucket:'remplit par tolérance',transform:'taille, rotation, perspective',liquify:'pousse, gonfle, pince',smudge:'étale la matière',patch:'remplace une zone',redeye:'corrige les yeux'};
const TOOLLB={on:PREF.get('toolLabels',innerWidth>=1500)};
function decorateDock(){const dock=$('#dock');if(!dock)return;$$('[data-tool]',dock).forEach(b=>{const id=b.dataset.tool,t=TOOLS.find(x=>x&&x[0]===id);const svg=b.querySelector('svg');if(svg&&IC[id])svg.innerHTML=IC[id];
  let l=b.querySelector('.tl');if(!l){l=document.createElement('span');l.className='tl';b.appendChild(l)}l.innerHTML=`<b>${TOOL_NAMES[id]||(t&&t[1])||id}</b><kbd>${t&&t[2]?t[2]:''}</kbd>`;
  if(t)b.title=`${(TOOL_NAMES[id]||t[1])}${TOOL_SUB[id]?' : '+TOOL_SUB[id]:''} ${t[2]?' ('+t[2]+')':''}`})}
function addTool(id,name,key,icon,after,sub){if(TOOLS.find(x=>x&&x[0]===id))return;IC[id]=icon;TOOL_NAMES[id]=TOOL_NAMES[id]||name;if(sub)TOOL_SUB[id]=sub;
  const at=TOOLS.findIndex(x=>x&&x[0]===after);TOOLS.splice(at<0?TOOLS.length:at+1,0,[id,name,key]);if(key&&key!=='')KEYTOOLS[key.toLowerCase()]=id;
  const dock=$('#dock'),b=document.createElement('button');b.className='ib';b.dataset.tool=id;b.setAttribute('aria-label',name);b.innerHTML=`<svg viewBox="0 0 20 20">${icon}</svg>`;
  const ref=$(`#dock [data-tool="${after}"]`);if(ref&&ref.nextSibling)dock.insertBefore(b,ref.nextSibling);else dock.insertBefore(b,$('.fg',dock));decorateDock()}
(()=>{const st=document.createElement('style');st.textContent=`
body:not(.compact) .work{--toolw:48px}
body:not(.compact).tl-on .work{--toolw:168px}
body:not(.compact).tl-on .tools{align-items:stretch;padding:8px 8px}
body:not(.compact).tl-on .tools .ib{width:100%;height:32px;display:flex;align-items:center;justify-content:flex-start;gap:10px;padding:0 8px;text-align:left}
body:not(.compact).tl-on .tools .ib svg{width:20px;height:20px;flex:none}
body:not(.compact).tl-on .tools .tl{display:flex;align-items:center;min-width:0;flex:1;line-height:1}
body:not(.compact).tl-on .tools .tl b{font-weight:500;font-size:12.5px;white-space:nowrap}
body:not(.compact).tl-on .tools .tl kbd{font:500 10.5px var(--num);opacity:.6;margin-left:auto}
body:not(.compact).tl-on .tools .sep{width:100%;margin:5px 0}
body:not(.compact).tl-on .tools .fg{width:100%;justify-content:flex-start;padding-left:6px}
.tools .tl{display:none}
.tools .tlt{flex:none;margin-top:6px;font-size:11px;color:var(--fg-3);border:0;background:none;cursor:pointer;padding:4px;border-radius:6px}
.tools .tlt:hover{background:var(--hover);color:var(--fg)}
body.compact .tools .tlt{display:none}
`;document.head.appendChild(st);
 const dock=$('#dock');const t=document.createElement('button');t.className='tlt';t.id='tlToggle';dock.appendChild(t);
 const apply=()=>{document.body.classList.toggle('tl-on',TOOLLB.on);t.textContent=TOOLLB.on?'« Réduire':'»';t.title=TOOLLB.on?'Masquer les noms des outils':'Afficher les noms des outils';t.setAttribute('aria-label',t.title);try{requestRender()}catch(e){}};
 t.onclick=()=>{TOOLLB.on=!TOOLLB.on;PREF.set('toolLabels',TOOLLB.on);apply();setTimeout(()=>{try{fit()}catch(e){}},50)};
 decorateDock();apply();
 const mv=MENU2.view.items;MENU2.view.items=()=>{const a=mv();const i=a.findIndex(x=>x&&x.label&&/Panneau Calques/.test(x.label));a.splice(i<0?a.length:i+1,0,MI('Noms des outils',{check:TOOLLB.on,fn:()=>t.click()}));return a}})();
/* home screen: no editor chrome while no photo is open */
(()=>{const st=document.createElement('style');st.textContent=`
body.no-doc #app{grid-template-rows:44px minmax(0,1fr)!important}
body.no-doc .work{grid-template-columns:minmax(0,1fr)!important;grid-template-rows:minmax(0,1fr)!important}
body.no-doc .tools,body.no-doc .lyr-dock,body.no-doc .side,body.no-doc .optbar,body.no-doc .statusbar,body.no-doc .composer,body.no-doc .sheet-handle{display:none!important}
body.no-doc .bar-r>:not(#bCmd){display:none!important}
`;document.head.appendChild(st);
const em=$('#empty');const sync=()=>{const none=!S.doc||!em.hidden;document.body.classList.toggle('no-doc',none);try{requestRender()}catch(e){}};
new MutationObserver(sync).observe(em,{attributes:true,attributeFilter:['hidden']});
const _ud=updateDocName;updateDocName=function(){const r=_ud.apply(this,arguments);sync();return r};sync()})();

