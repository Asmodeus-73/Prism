/* ================= tools ================= */
const IC={
  move:'<path d="M10 2v16M2 10h16M10 2L7.5 4.5M10 2l2.5 2.5M10 18l-2.5-2.5M10 18l2.5-2.5M2 10l2.5-2.5M2 10l2.5 2.5M18 10l-2.5-2.5M18 10l-2.5 2.5"/>',
  marquee:'<rect x="3" y="4" width="14" height="12" rx="1" stroke-dasharray="2.2 2"/>',
  lasso:'<path d="M5 12.5C3.3 11.6 2.5 10.3 2.5 9c0-3 3.4-5.5 7.5-5.5s7.5 2.5 7.5 5.5-3.4 5.5-7.5 5.5c-1 0-2-.1-2.9-.4"/><path d="M5 12.5c-.8 1-.6 2.5.5 3s1.4 1.6.6 2.5"/>',
  wand:'<path d="M3 17l9.5-9.5"/><path d="M14 2.5v2.5M17.5 6H15M16.2 3.8l-1.6 1.6M11.5 4.5L13 6"/>',
  crop:'<path d="M5 1.5V15h13.5"/><path d="M1.5 5H15v13.5"/>',
  eyedropper:'<path d="M12.5 3.5l4 4-1.8 1.8-4-4z"/><path d="M11.2 6.3l-7 7V16h2.7l7-7"/>',
  heal:'<rect x="1.8" y="7" width="16.4" height="6" rx="3" transform="rotate(-45 10 10)"/><path d="M8.6 10h.01M11.4 10h.01M10 8.6v.01M10 11.4v.01"/>',
  remove:'<path d="M3 13.5l7-7 4.5 4.5-4 4H6z"/><path d="M8 17.5h9"/><path d="M15 2v3M13.5 3.5h3M17.5 7.5v2M16.5 8.5h2"/>',
  clone:'<path d="M7.5 10.5h5l.8-3.2A3.4 3.4 0 1 0 6.7 7.3z"/><path d="M3.5 12.5h13v3h-13zM3 18h14"/>',
  brush:'<path d="M17.5 2.5l-8 9-2.3-.6.6-2.3z"/><path d="M6.6 10.5c-2 0-3 1.4-3.1 3-.1 1.8-.9 2.9-2 3.3 2.7 1 6.3.4 6.8-2.6l.3-1.5"/>',
  eraser:'<path d="M8 17.5h9.5"/><path d="M3 12.5l8.3-8.3a1.5 1.5 0 0 1 2.1 0l3.4 3.4a1.5 1.5 0 0 1 0 2.1L10 16.5H7z"/><path d="M6.5 9l5.5 5.5"/>',
  gradient:'<rect x="2.5" y="3.5" width="15" height="13" rx="2"/><path d="M6 3.5v13M9.5 3.5v13" opacity=".7"/><path d="M13 3.5v13" opacity=".35"/>',
  dodge:'<circle cx="7" cy="7" r="4.5"/><path d="M10.3 10.3l7 7"/>',
  text:'<path d="M4 5V3.5h12V5M10 3.5v13M7.5 16.5h5"/>',
  hand:'<path d="M7 10V4.6a1.4 1.4 0 0 1 2.8 0V9M9.8 9V3.4a1.4 1.4 0 0 1 2.8 0V9M12.6 9V5a1.4 1.4 0 0 1 2.8 0v6.3c0 3.8-2.4 6.7-5.8 6.7-2.3 0-3.7-1.1-5.1-3.4L3 11.5c-.7-1.1.7-2.3 1.7-1.4L7 12.3"/>',
  zoom:'<circle cx="8.5" cy="8.5" r="5.5"/><path d="M12.5 12.5l5 5M6 8.5h5M8.5 6v5"/>'};
const TOOLS=[['move','Déplacement','V'],['marquee','Sélection rectangle / ellipse','M'],['lasso','Lasso','L'],['wand','Baguette magique','W'],0,['crop','Recadrage et redressement','C'],['eyedropper','Pipette','I'],0,
  ['heal','Correcteur','J'],['remove','Gomme magique (IA)','R'],['clone','Tampon de duplication','S'],['brush','Pinceau','B'],['eraser','Gomme','E'],['gradient','Dégradé','G'],['dodge','Densité, goutte d’eau, éponge','O'],['text','Texte','T'],0,['hand','Main','H'],['zoom','Zoom','Z']];
function buildDock(){const t=$('#dock');t.innerHTML=TOOLS.map(x=>x?`<button class="ib" data-tool="${x[0]}" title="${x[1]} (${x[2]})" aria-label="${x[1]}"><svg viewBox="0 0 20 20">${IC[x[0]]}</svg></button>`:'<div class="sep"></div>').join('')+`<div class="sep"></div><div class="fg" title="Couleur"><input type="color" class="swatch" id="fg" value="${esc(S.color)}" aria-label="Couleur de premier plan"></div>`;
  t.addEventListener('click',e=>{const b=e.target.closest('[data-tool]');if(b)setTool(b.dataset.tool)});$('#fg').addEventListener('input',e=>{S.color=e.target.value;const oc=$('#optColor');if(oc)oc.value=S.color})}
function setCursor(){const t=S.tool;view.style.cursor=t==='hand'?'grab':t==='zoom'?'zoom-in':['brush','eraser','clone','heal','dodge','remove'].includes(t)?'none':'crosshair'}
function setTool(t){if(S.stroke)return;if(S.tool==='crop'&&t!=='crop'){S.crop=null;markContent()}S.tool=t;S.pickSource=false;$$('#dock [data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===t));if(t==='crop')initCrop();renderPill();
  view.style.cursor=t==='hand'?'grab':t==='zoom'?'zoom-in':['brush','eraser','clone','heal','dodge','remove'].includes(t)?'none':'crosshair';requestRender()}
function optRange(key,label,min,max,step,unit,scale=1){const[t,k]=key.split('.'),v=S.opts[t][k]*scale;return`<label>${label}<input type="range" data-opt="${key}" data-scale="${scale}" data-unit="${unit}" min="${min}" max="${max}" step="${step}" value="${v}"><span class="val" data-val="${key}">${fmtN(v,step)}${unit}</span></label>`}
function seg(key,items){const[t,k]=key.split('.'),cur=k?S.opts[t][k]:S.opts[t];return`<div class="seg" role="group">${items.map(([v,l])=>`<button data-seg="${key}" data-v="${v}" class="${cur===v?'on':''}">${l}</button>`).join('')}</div>`}
function renderPill(){const t=S.tool,o=S.opts,ob=$('#pill'),A=AL();const name=(TOOLS.find(x=>x&&x[0]===t)||[])[1]||'';let h=`<span class="tname">${name}</span>`;const SEL=seg('selMode',[['new','Nouvelle'],['add','Ajouter'],['sub','Soustraire'],['int','Intersection']]);
  const onMask=A&&((A.kind==='adjust'&&(A.mask||(t!=='brush'&&t!=='eraser')))||(A.mask&&A.editMask));
  if(t==='move')h+=`<span class="hint">Glissez pour déplacer le calque. Molette : défiler, ${IS_MAC?'⌘':'Ctrl'}+molette : zoomer.</span>`;
  if(t==='marquee')h+=seg('marquee.shape',[['rect','Rectangle'],['ellipse','Ellipse']])+SEL+optRange('marquee.feather','Contour',0,100,1,' px')+`<label>Ratio<select data-sel="marquee.ratio">${[['free','Libre'],['1:1','1:1'],['4:3','4:3'],['3:2','3:2'],['16:9','16:9']].map(([v,l])=>`<option value="${v}" ${o.marquee.ratio===v?'selected':''}>${l}</option>`).join('')}</select></label>`;
  if(t==='lasso')h+=SEL+optRange('lasso.feather','Contour',0,100,1,' px');
  if(t==='wand')h+=SEL+optRange('wand.tol','Tolérance',0,128,1,'')+`<label><input type="checkbox" data-chk="wand.contiguous" ${o.wand.contiguous?'checked':''}>Contigus</label><label><input type="checkbox" data-chk="wand.all" ${o.wand.all?'checked':''}>Tous les calques</label><button class="btn sm" data-act="subject">Sujet (IA)</button>`;
  if(t==='crop'){const a=S.crop?S.crop.angle:0;h+=`<label>Format<select data-sel="crop.ratio">${cropRatios().map(([v,l])=>`<option value="${v}" ${o.crop.ratio===v?'selected':''}>${l}</option>`).join('')}</select></label><button class="btn sm" data-act="cropswap" title="Passer de paysage à portrait">⇄</button>${cropGridSel()}<label>Redresser<input type="range" id="cropAng" min="-45" max="45" step="0.1" value="${a}"><span class="val" id="cropAngV">${a.toFixed(1)}°</span></label><button class="btn sm" id="cropReset">Réinitialiser</button><button class="btn sm primary" id="cropApply">Appliquer</button>`}
  if(t==='eyedropper')h+=`<span class="hint">Cliquez pour prélever une couleur.</span><input type="color" class="swatch" id="optColor" value="${esc(S.color)}" aria-label="Couleur">`;
  if(t==='heal')h+=seg('heal.mode',[['spot','Localisé'],['source','Avec source']])+optRange('heal.size','Taille',2,400,1,' px')+optRange('heal.hardness','Dureté',0,100,1,' %',100)+(o.heal.mode==='source'?srcBtn():`<span class="hint">Peignez sur une tache ou une poussière.</span>`);
  if(t==='remove')h+=optRange('remove.size','Taille',4,500,1,' px')+`<span class="hint">Peignez sur l’objet ou la personne à effacer, puis relâchez.</span>`;
  if(t==='clone')h+=optRange('clone.size','Taille',2,500,1,' px')+optRange('clone.hardness','Dureté',0,100,1,' %',100)+optRange('clone.opacity','Opacité',1,100,1,' %',100)+`<label><input type="checkbox" data-chk="clone.aligned" ${o.clone.aligned?'checked':''}>Aligné</label><label><input type="checkbox" data-chk="clone.all" ${o.clone.all?'checked':''}>Tous les calques</label>`+srcBtn();
  if(t==='brush')h+=(onMask?`<span class="hint">Peint le masque : la zone peinte reçoit le réglage.</span>`:`<input type="color" class="swatch" id="optColor" value="${esc(S.color)}" aria-label="Couleur">`)+optRange('brush.size','Taille',1,600,1,' px')+optRange('brush.hardness','Dureté',0,100,1,' %',100)+optRange('brush.opacity','Opacité',1,100,1,' %',100)+(onMask?'':optRange('brush.flow','Flux',1,100,1,' %',100));
  if(t==='eraser')h+=(onMask?`<span class="hint">Retire des zones du masque.</span>`:'')+optRange('eraser.size','Taille',1,600,1,' px')+optRange('eraser.hardness','Dureté',0,100,1,' %',100)+optRange('eraser.opacity','Opacité',1,100,1,' %',100);
  if(t==='gradient')h+=seg('gradient.shape',[['linear','Linéaire'],['radial','Radial'],['angular','Angulaire'],['reflect','Réfléchi']])+(onMask?`<span class="hint">${A.kind==='adjust'?'Tirez pour dessiner le masque du réglage.':'Tirez pour dessiner le masque du calque.'}</span>`:'');
  if(t==='dodge')h+=seg('dodge.mode',[['dodge','Éclaircir'],['burn','Assombrir'],['blur','Flouter'],['sharpen','Netteté'],['saturate','Saturer'],['desaturate','Désaturer']])+optRange('dodge.size','Taille',4,600,1,' px')+optRange('dodge.strength','Intensité',1,100,1,' %',100);
  if(t==='text')h+=`<span class="hint">Cliquez sur la photo pour placer du texte, ou sur un texte existant pour le modifier.</span>`;
  if(t==='hand'||t==='zoom')h+=`<button class="btn sm" data-act="fit">Ajuster</button><button class="btn sm" data-act="100">100 %</button><span class="hint">${t==='zoom'?ALT+'+clic pour dézoomer':'Barre d’espace : main temporaire'}</span>`;
  h+=PILL_EXTRA(t,o);ob.innerHTML=h;
  ob.querySelectorAll('[data-opt]').forEach(i=>i.oninput=()=>{const[a,b]=i.dataset.opt.split('.');S.opts[a][b]=+i.value/+i.dataset.scale;ob.querySelector(`[data-val="${i.dataset.opt}"]`).textContent=fmtN(+i.value,+i.step)+i.dataset.unit;requestRender()});
  ob.querySelectorAll('[data-seg]').forEach(b=>b.onclick=()=>{const[a,k]=b.dataset.seg.split('.');if(k)S.opts[a][k]=b.dataset.v;else S.opts[a]=b.dataset.v;renderPill()});
  ob.querySelectorAll('[data-chk]').forEach(c=>c.onchange=()=>{const[a,k]=c.dataset.chk.split('.');S.opts[a][k]=c.checked;if(a==='clone'&&k==='aligned')S.cloneOff=null});
  ob.querySelectorAll('[data-sel]').forEach(s=>s.onchange=()=>{const[a,k]=s.dataset.sel.split('.');S.opts[a][k]=s.value;if(a==='crop'){if(k==='grid'){PREF.set('cropGrid',s.value);requestRender();return}if(k==='ratio'){if(s.value==='custom'){cropCustomDialog();return}cropRemember(s.value)}applyRatio()}});
  ob.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{const a=b.dataset.act;if(a==='fit')fit();else if(a==='100')zoomAt(1);else if(a==='subject')AI.selectSubject();else if(a==='cropswap')cropSwapRatio();else if(PILL_ACT[a])PILL_ACT[a]()});
  const oc=$('#optColor');if(oc)oc.oninput=e=>{S.color=e.target.value;$('#fg').value=S.color};
  const sb=$('#srcBtn');if(sb)sb.onclick=()=>{S.pickSource=!S.pickSource;sb.classList.toggle('on',S.pickSource);if(S.pickSource)toast('Touchez la zone à copier')};
  if(t==='crop'){$('#cropAng').oninput=e=>{if(!S.crop)return;S.crop.angle=+e.target.value;$('#cropAngV').textContent=S.crop.angle.toFixed(1)+'°';applyRatio();markContent()};$('#cropApply').onclick=applyCrop;$('#cropReset').onclick=cancelCrop}}
function srcBtn(){return`<button class="btn sm ${S.pickSource?'on':''}" id="srcBtn">Définir la source</button><span class="hint">${S.cloneSrc?'Source définie. ':''}${ALT}+clic pour choisir la zone à copier.</span>`}

