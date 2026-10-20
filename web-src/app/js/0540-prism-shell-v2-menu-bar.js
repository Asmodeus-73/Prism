/* ================= Prism shell v2: menu bar, context menus, docked panels, status bar ================= */
const IC2={
  open:'<path d="M3 6.5V15a1.5 1.5 0 001.5 1.5h11A1.5 1.5 0 0017 15V8a1.5 1.5 0 00-1.5-1.5H10L8.3 4.5H4.5A1.5 1.5 0 003 6v.5z"/>',
  new:'<path d="M5 2.5h6.5L15 6v11.5H5z"/><path d="M11 2.5V6.5h4M10 9.5v5M7.5 12h5"/>',
  lib:'<rect x="3" y="3" width="6" height="6" rx="1.2"/><rect x="11" y="3" width="6" height="6" rx="1.2"/><rect x="3" y="11" width="6" height="6" rx="1.2"/><rect x="11" y="11" width="6" height="6" rx="1.2"/>',
  save:'<path d="M4 3.5h9.5L16.5 6.5v10H4z"/><path d="M7 3.5v4h6v-4M7 16.5v-5h6v5"/>',
  export:'<path d="M10 3v10M6 9l4 4 4-4M4 15.5h12"/>',import:'<path d="M10 13V3M6 7l4-4 4 4M4 15.5h12"/>',
  cloud:'<path d="M6 15.5h8.5a3.5 3.5 0 00.4-7 5 5 0 00-9.6 1.3A3 3 0 006 15.5z"/>',share:'<circle cx="5" cy="10" r="2"/><circle cx="15" cy="5" r="2"/><circle cx="15" cy="15" r="2"/><path d="M6.8 9l6.4-3M6.8 11l6.4 3"/>',
  batch:'<rect x="5" y="5" width="11" height="11" rx="1.5"/><path d="M3 13V4.5A1.5 1.5 0 014.5 3H13"/>',undo:'<path d="M7 4L3 8l4 4"/><path d="M3 8h9a5 5 0 010 10H9"/>',redo:'<path d="M13 4l4 4-4 4"/><path d="M17 8H8a5 5 0 000 10h3"/>',
  cut:'<circle cx="5.5" cy="14.5" r="2.5"/><circle cx="14.5" cy="14.5" r="2.5"/><path d="M7.3 12.7 15 3M12.7 12.7 5 3"/>',copy:'<rect x="6" y="6" width="11" height="11" rx="2"/><path d="M14 3.5H5A1.5 1.5 0 003.5 5v9"/>',paste:'<rect x="4" y="4" width="12" height="13.5" rx="2"/><path d="M7.5 4V2.5h5V4"/>',
  fill:'<path d="M4 10l6-6 6 6-6 6z"/><path d="M16 13.5s1.5 1.8 1.5 2.8a1.5 1.5 0 01-3 0c0-1 1.5-2.8 1.5-2.8z"/>',trash:'<path d="M4 6h12M8 6V4h4v2M5.5 6l.8 10.5h7.4L14.5 6"/>',
  wand:'<path d="M3 17 13 7M12 3v2M16 8h-2M15.5 4.5l-1.4 1.4"/>',sliders:'<path d="M4 6h8M15 6h1M4 14h2M9 14h7"/><circle cx="13.5" cy="6" r="1.8"/><circle cx="7.5" cy="14" r="1.8"/>',
  search:'<circle cx="9" cy="9" r="5.5"/><path d="M13.2 13.2 17 17"/>',auto:'<path d="M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6z"/>',
  resize:'<rect x="3" y="3" width="14" height="14" rx="2"/><path d="M8 12l4-4M9 8h3v3"/>',crop:'<path d="M5.5 2.5V14.5h12M2.5 5.5h12v12"/>',rotate:'<path d="M15.5 7A6 6 0 104 10"/><path d="M16 3v4h-4"/>',flip:'<path d="M10 2.5v15M7.5 5 3 15h4.5zM12.5 5 17 15h-4.5z"/>',
  layer:'<path d="M10 3 17 6.8 10 10.6 3 6.8z"/><path d="M3 10.2l7 3.8 7-3.8M3 13.6l7 3.8 7-3.8"/>',adj:'<circle cx="10" cy="10" r="7"/><path d="M10 3v14" /><path d="M10 3a7 7 0 010 14z" fill="currentColor" stroke="none" opacity=".45"/>',
  mask:'<rect x="3" y="4" width="14" height="12" rx="2"/><circle cx="10" cy="10" r="3.2"/>',dup:'<rect x="6" y="6" width="11" height="11" rx="2"/><path d="M14 3.5H5A1.5 1.5 0 003.5 5v9"/>',rename:'<path d="M3.5 16.5h3l9-9-3-3-9 9z"/><path d="M11 6l3 3"/>',
  eye:'<path d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10z"/><circle cx="10" cy="10" r="2.6"/>',up:'<path d="M10 16V4M5 9l5-5 5 5"/>',down:'<path d="M10 4v12M5 11l5 5 5-5"/>',
  merge:'<path d="M6 3v5l4 4 4-4V3M10 12v5"/>',sel:'<rect x="3" y="3" width="14" height="14" rx="1" stroke-dasharray="2.5 2"/>',lasso:'<ellipse cx="10" cy="8" rx="7" ry="4.6"/><path d="M6 12c-1.3 1.4-1.4 3.5.4 4.5"/>',
  subject:'<circle cx="10" cy="7" r="3"/><path d="M4 17c.8-3.4 3.2-5 6-5s5.2 1.6 6 5"/>',path:'<path d="M3.5 16C6 6 14 14 16.5 4"/><circle cx="3.5" cy="16" r="1.4"/><circle cx="16.5" cy="4" r="1.4"/>',feather:'<path d="M15.5 4.5c-6 0-10 4-10 10.5M5.5 15 15.5 4.5c.5 5-2 9-7.5 9.5"/>',
  filter:'<circle cx="7.5" cy="8" r="4.5"/><circle cx="12.5" cy="8" r="4.5"/><circle cx="10" cy="12.5" r="4.5"/>',zoomin:'<circle cx="9" cy="9" r="5.5"/><path d="M13.2 13.2 17 17M7 9h4M9 7v4"/>',zoomout:'<circle cx="9" cy="9" r="5.5"/><path d="M13.2 13.2 17 17M7 9h4"/>',
  fit:'<path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4"/>',compare:'<rect x="2.5" y="4" width="15" height="12" rx="2"/><path d="M10 2.5v15"/>',proof:'<rect x="4" y="2.5" width="12" height="15" rx="1.5"/><path d="M7 7h6M7 10h6M7 13h3"/>',
  theme:'<circle cx="10" cy="10" r="7"/><path d="M10 3a7 7 0 000 14z" fill="currentColor" stroke="none"/>',panels:'<rect x="2.5" y="3.5" width="15" height="13" rx="2"/><path d="M12 3.5v13"/>',help:'<circle cx="10" cy="10" r="7.5"/><path d="M7.8 7.8a2.3 2.3 0 114 1.6c-.9.6-1.8 1.2-1.8 2.4M10 14.5v.1"/>',
  keys:'<rect x="2.5" y="5" width="15" height="10" rx="1.5"/><path d="M5.5 8h1M9.5 8h1M13.5 8h1M6 12h8"/>',info:'<circle cx="10" cy="10" r="7.5"/><path d="M10 9v5M10 6.2v.1"/>',hand:'<path d="M7 10V4.5a1.3 1.3 0 012.6 0V9M9.6 8.5V3.5a1.3 1.3 0 012.6 0V9M12.2 9V5a1.3 1.3 0 012.6 0v6.5c0 3.4-2.2 6-5.5 6-2.6 0-3.8-1.4-5.2-3.6L3.6 11a1.3 1.3 0 012.1-1.5L7 11"/>',
  star:'<path d="M10 2.8l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 8.1l5-.7z"/>',tag:'<path d="M3 3.5h6.5L17 11l-6 6-7.5-7.5z"/><circle cx="7" cy="7" r="1.2"/>',reset:'<path d="M4 10a6 6 0 106-6H7"/><path d="M8 1.5 5.5 4 8 6.5"/>',
  history:'<circle cx="10" cy="10" r="7"/><path d="M10 6v4.3l2.8 1.8"/>',brush:'<path d="M16.5 3.5c-2.2 1.4-5.6 4.6-7.6 7l2 2c2.4-2 5.6-5.4 7-7.6z"/><path d="M8.6 11.2C6 11.4 5 13 4.6 15.4L3.5 16.5c2.6.4 5.6-.5 6.6-3.4"/>',grad:'<rect x="3" y="3" width="14" height="14" rx="2"/><path d="M3 17 17 3" opacity=".6"/>',radial:'<circle cx="10" cy="10" r="7"/><circle cx="10" cy="10" r="3"/>',
  invert:'<circle cx="10" cy="10" r="7"/><path d="M10 3a7 7 0 010 14z" fill="currentColor" stroke="none"/>',check:'<path d="M4.5 10.5l3.5 3.5 7.5-8"/>'};
const ico=n=>n&&IC2[n]?`<svg viewBox="0 0 20 20" aria-hidden="true">${IC2[n]}</svg>`:'<span class="mi-noi"></span>';
const NODOC='Ouvrez d’abord une photo',NOSEL='Faites d’abord une sélection';
/* original menu commands, so every action stays wired to the engine */
const MENUS0=MENUS;function pick(k,label){let it=null;try{it=MENUS0[k]().find(x=>x&&String(x[0]).replace(/^✓ /,'').startsWith(label))}catch(e){}return it?{fn:it[2],dis:!!it[3],kbd:it[1]||'',on:String(it[0]).startsWith('✓')}:{fn:()=>{},dis:true,kbd:''}}
const MI=(label,o={})=>({label,...o});const SEP='-';
const docDis=()=>S.doc?false:NODOC;const selDis=()=>!S.doc?NODOC:!S.doc.sel?NOSEL:false;
function fromPick(k,label,name,icon,extra={}){const p=pick(k,label);return MI(name||label,{icon,kbd:p.kbd,fn:p.fn,dis:p.dis?(S.doc?'Pas disponible pour le moment':NODOC):false,...extra})}
function setActiveLayer(i){const d=S.doc;if(!d||i<0||i>=d.layers.length)return;d.active=i;syncAll()}
function setLayerProp(i,k,v,label){const d=S.doc,L=d&&d.layers[i];if(!L)return;L[k]=v;markComp();pushHistory(label);syncLayers()}
function cutSel(){if(!S.doc||!S.doc.sel){toast(NOSEL);return}copySel();clearSel()}
function renameDocDialog(){const d=S.doc;if(!d)return;dialog({title:'Renommer le document',body:`<label class="field">Nom<input type="text" id="rnD" value="${esc(d.name)}"></label>`,onOpen:el=>setTimeout(()=>$('#rnD',el).select(),30),buttons:[{label:'Annuler'},{label:'Renommer',primary:true,onClick:el=>{const n=$('#rnD',el).value.trim();if(n){d.name=n;updateDocName();scheduleSave()}}}]})}
function newDocDialog(){const st={bg:'white'};dialog({title:'Nouveau document',body:`<div class="grid2"><label class="field">Largeur (px)<input type="number" id="ndW" min="1" max="20000" value="3000"></label><label class="field">Hauteur (px)<input type="number" id="ndH" min="1" max="20000" value="2000"></label></div>
  <label class="field">Fond<div class="seg" id="ndB" role="radiogroup"><button data-v="white" class="on" role="radio" aria-checked="true">Blanc</button><button data-v="black" role="radio" aria-checked="false">Noir</button><button data-v="transparent" role="radio" aria-checked="false">Transparent</button></div></label>
  <label class="field">Format courant<select id="ndP"><option value="">Personnalisé</option><option value="3000x2000">Photo 3:2 (3000 × 2000)</option><option value="1080x1080">Instagram carré (1080 × 1080)</option><option value="1080x1350">Instagram portrait (1080 × 1350)</option><option value="1920x1080">Full HD (1920 × 1080)</option><option value="3840x2160">4K (3840 × 2160)</option><option value="2480x3508">A4 à 300 ppp (2480 × 3508)</option></select></label>`,
  onOpen:el=>{$$('#ndB button',el).forEach(b=>b.onclick=()=>{st.bg=b.dataset.v;$$('#ndB button',el).forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-checked',x===b)})});$('#ndP',el).onchange=e=>{const v=e.target.value;if(v){const[w,h]=v.split('x');$('#ndW',el).value=w;$('#ndH',el).value=h}}},
  buttons:[{label:'Annuler'},{label:'Créer',primary:true,onClick:el=>{const w=clamp(+$('#ndW',el).value|0,1,20000),h=clamp(+$('#ndH',el).value|0,1,20000);if(w*h>MAX_PX){toast('Trop grand pour ce navigateur');return false}
    const c=mk(w,h);if(st.bg!=='transparent'){const g=cx(c);g.fillStyle=st.bg==='white'?'#fff':'#000';g.fillRect(0,0,w,h)}setDoc(c,'Sans titre');toast(`Nouveau document ${w} × ${h} px`)}}]})}
function quickExport(fmt){const d=S.doc;if(!d)return;const base=(d.name||'photo').replace(/\.[a-z0-9]+$/i,'');const o={fmt,q:fmt==='jpeg'?0.92:fmt==='webp'?0.9:1,depth:{png:8,tiff:8,avif:8},chroma:'444',meta:true,colors:256,dither:true};exportAs(o,1,base)}
function themeSet(t){if(t==='auto')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=t;PREF.set('theme',t)}
if(PREF.get('theme','auto')!=='auto')document.documentElement.dataset.theme=PREF.get('theme','auto');
const UI2={histo:PREF.get('uiHisto',true),layersH:PREF.get('uiLayersH',250)};
/* ---- the menus ---- */
const MENU2={
  file:{label:'Fichier',items:()=>[MI('Nouveau document…',{icon:'new',fn:newDocDialog}),MI('Ouvrir…',{icon:'open',kbd:MOD+'O',fn:openFile}),MI('Ouvrir comme calque…',{icon:'layer',fn:()=>$('#fileLayer').click(),dis:docDis()}),MI('Photothèque…',{icon:'lib',kbd:MOD+'⇧O',fn:()=>openLibrary()}),MI('Photo d’exemple',{fn:loadSample}),SEP,
    fromPick('file','Enregistrer maintenant','Enregistrer','save'),MI('Synchroniser sur mon compte',{icon:'cloud',check:!!(S.doc&&S.doc.sync),fn:toggleDocSync,dis:!S.doc?NODOC:!Cloud.ok?'Disponible quand Prism est ouvert depuis votre compte Claude':false}),MI('Renommer le document…',{icon:'rename',fn:renameDocDialog,dis:docDis()}),SEP,
    MI('Exporter…',{icon:'export',kbd:MOD+'⇧E',fn:exportDialog,dis:docDis()}),MI('Exporter rapidement',{icon:'export',dis:docDis(),sub:()=>[MI('JPEG haute qualité',{fn:()=>quickExport('jpeg')}),MI('PNG sans perte',{fn:()=>quickExport('png')}),MI('TIFF sans perte',{fn:()=>quickExport('tiff')}),MI('PSD avec calques',{fn:exportPSD})]}),
    MI('Exporter le projet (.zip avec calques)…',{fn:exportProjectFile,dis:docDis()}),MI('Importer un projet ou un PSD…',{icon:'import',fn:()=>$('#fileProject').click()}),SEP,
    MI('Traitement par lot…',{icon:'batch',fn:()=>batchDialog()}),fromPick('file','Partager pour avis','Partager pour avis…','share',{dis:!S.doc?NODOC:!Cloud.ok?'Disponible quand Prism est ouvert depuis votre compte Claude':false})]},
  edit:{label:'Édition',items:()=>{const u=S.hi>0?S.history[S.hi].label:'',r=S.hi<S.history.length-1?S.history[S.hi+1].label:'';return[
    MI(u?`Annuler « ${u} »`:'Annuler',{icon:'undo',kbd:MOD+'Z',fn:undo,dis:S.hi>0?false:'Rien à annuler'}),MI(r?`Rétablir « ${r} »`:'Rétablir',{icon:'redo',kbd:MOD+'⇧Z',fn:redo,dis:r?false:'Rien à rétablir'}),MI('Historique',{icon:'history',fn:()=>switchTab('history'),dis:docDis()}),SEP,
    MI('Couper',{icon:'cut',kbd:MOD+'X',fn:cutSel,dis:selDis()}),fromPick('edit','Copier','Copier','copy',{dis:selDis()}),fromPick('edit','Coller','Coller','paste'),SEP,
    fromPick('edit','Remplir avec la couleur',null,'fill',{dis:selDis()}),fromPick('edit','Effacer la sélection','Effacer le contenu de la sélection','trash',{dis:selDis()}),fromPick('edit','Supprimer l’objet','Supprimer l’objet sélectionné (IA)','wand',{dis:selDis()}),SEP,
    fromPick('edit','Copier les réglages',null,'copy'),fromPick('edit','Coller les réglages',null,'paste'),SEP,MI('Rechercher une commande…',{icon:'search',kbd:MOD+'K',fn:openCmdK})]}},
  image:{label:'Image',items:()=>[fromPick('image','Réglages automatiques',null,'auto'),MI('Développer le RAW (16 bits)…',{icon:'sliders',fn:rawDialog,dis:!S.doc?NODOC:!S.doc.raw?'Uniquement pour les photos RAW':false}),SEP,
    fromPick('image','Taille de l’image','Taille de l’image…','resize'),MI('Recadrer et redresser',{icon:'crop',kbd:'C',fn:()=>setTool('crop'),dis:docDis()}),MI('Recadrer sur la sélection',{fn:cropToSel,dis:selDis()}),
    MI('Rotation',{icon:'rotate',dis:docDis(),sub:()=>[fromPick('image','Rotation 90° horaire','90° dans le sens horaire'),fromPick('image','Rotation 90° antihoraire','90° dans le sens antihoraire'),fromPick('image','Rotation 180°','180°')]}),
    MI('Symétrie',{icon:'flip',dis:docDis(),sub:()=>[fromPick('image','Symétrie horizontale','Horizontale'),fromPick('image','Symétrie verticale','Verticale')]}),SEP,
    fromPick('image','Agrandir ×2','Agrandir ×2 avec l’IA…','wand'),fromPick('image','Copier le style','Copier le style d’une photo…','auto'),SEP,
    MI('Espace colorimétrique',{icon:'theme',dis:docDis(),sub:()=>[MI('sRGB (standard, web)',{check:S.doc&&S.doc.space!=='display-p3',fn:()=>S.doc.space!=='srgb'&&convertSpace('srgb')}),MI('Display P3 (couleurs étendues)',{check:S.doc&&S.doc.space==='display-p3',fn:()=>S.doc.space!=='display-p3'&&convertSpace('display-p3'),dis:P3_OK?false:'Écran ou navigateur non compatible'})]}),
    MI('Précision 16 bits',{check:!!PREC.on,fn:togglePrec})]},
  layer:{label:'Calque',items:()=>{const d=S.doc,L=d&&AL(),i=d?d.active:-1;return[fromPick('layer','Nouveau calque','Nouveau calque de pixels','layer'),
    MI('Nouveau calque de réglage',{icon:'adj',dis:docDis(),sub:adjSub}),MI('Dupliquer le calque',{icon:'dup',kbd:MOD+'J',fn:dupLayer,dis:docDis()}),MI('Renommer le calque…',{icon:'rename',fn:()=>renameLayerUI(i),dis:docDis()}),MI('Supprimer le calque',{icon:'trash',kbd:'Suppr',fn:delLayer,danger:true,dis:!d?NODOC:d.layers.length<2?'Il faut garder au moins un calque':false}),SEP,
    MI('Masque',{icon:'mask',dis:docDis(),sub:maskSub}),SEP,
    MI(L&&L.visible===false?'Afficher le calque':'Masquer le calque',{icon:'eye',fn:()=>setLayerProp(i,'visible',!L.visible,L.visible?'Masquer le calque':'Afficher le calque'),dis:docDis()}),
    MI('Opacité',{dis:docDis(),sub:()=>[100,75,50,25].map(v=>MI(v+' %',{check:L&&Math.round(L.opacity*100)===v,fn:()=>setLayerProp(i,'opacity',v/100,'Opacité du calque')}))}),
    MI('Mode de fusion',{dis:!d?NODOC:L.kind==='adjust'?'Pas pour un calque de réglage':false,sub:()=>BLENDS.map(([v,n])=>MI(n,{check:L&&L.blend===v,fn:()=>setLayerProp(i,'blend',v,'Mode de fusion')}))}),SEP,
    fromPick('layer','Monter le calque',null,'up'),fromPick('layer','Descendre le calque',null,'down'),fromPick('layer','Fusionner avec le calque inférieur',null,'merge'),fromPick('layer','Fusionner les calques visibles'),fromPick('layer','Aplatir l’image')]}},
  select:{label:'Sélection',items:()=>[fromPick('select','Tout sélectionner',null,'sel'),fromPick('select','Désélectionner'),fromPick('select','Intervertir','Intervertir la sélection','invert'),SEP,fromPick('select','Sélectionner le sujet','Sélectionner le sujet (IA)','subject'),SEP,
    MI('Contour progressif…',{icon:'feather',kbd:'⇧F6',fn:featherDialog,dis:selDis()}),MI('Affiner le contour (cheveux)…',{kbd:MOD+'⌥R',fn:refineDialog,dis:selDis()}),SEP,MI('Convertir la sélection en tracé',{icon:'path',fn:selToPath,dis:selDis()}),fromPick('select','Tracé → sélection','Convertir le tracé en sélection','path'),SEP,
    MI('Outils de sélection',{icon:'lasso',sub:()=>['marquee','lasso','wand','pen'].map(t=>{const x=TOOLS.find(y=>y&&y[0]===t);return MI(x[1],{kbd:x[2],check:S.tool===t,fn:()=>setTool(t)})})})]},
  filter:{label:'Filtre',items:()=>{let a=[];try{a=MENUS0.filter()}catch(e){}return a.filter(Boolean).map(x=>MI(x[0],{icon:'filter',fn:x[2],dis:x[3]?NODOC:false}))}},
  view:{label:'Affichage',items:()=>[fromPick('view','Ajuster à l’écran',null,'fit'),fromPick('view','Taille réelle','Taille réelle (100 %)'),fromPick('view','Zoom avant',null,'zoomin'),fromPick('view','Zoom arrière',null,'zoomout'),SEP,
    MI('Comparer avant / après',{icon:'compare',kbd:'Y',check:S.compare==='split',fn:toggleCompare,dis:docDis()}),MI('Afficher le masque',{icon:'mask',kbd:'⇧M',check:!!S.showMask,fn:toggleMask,dis:docDis()}),SEP,
    MI('Épreuvage écran (impression)',{icon:'proof',kbd:MOD+'⇧Y',check:!!PROOF.on,fn:pick('view','Épreuvage').fn,dis:docDis()}),MI('Format d’épreuve…',{fn:proofDialog}),SEP,
    MI('Panneaux',{icon:'panels',sub:()=>[MI('Histogramme',{check:UI2.histo,fn:()=>setHisto(!UI2.histo)}),MI('Assistant de retouche',{check:!$('#composer').hidden,fn:()=>$('#bAssist').click(),dis:$('#bAssist').hidden?'Disponible quand Prism est ouvert depuis claude.ai':false})]}),
    MI('Thème',{icon:'theme',sub:()=>{const t=PREF.get('theme','auto');return[MI('Automatique (comme le système)',{check:t==='auto',fn:()=>themeSet('auto')}),MI('Clair',{check:t==='light',fn:()=>themeSet('light')}),MI('Sombre',{check:t==='dark',fn:()=>themeSet('dark')})]}}),SEP,MI('Avis partagés',{icon:'share',fn:openReview})]},
  help:{label:'Aide',items:()=>[MI('Raccourcis clavier',{icon:'keys',kbd:'?',fn:shortcutsDialog}),MI('Rechercher une commande…',{icon:'search',kbd:MOD+'K',fn:openCmdK}),MI('Formats pris en charge',{icon:'info',fn:formatsDialog}),SEP,MI('À propos de Prism',{icon:'help',fn:aboutDialog})]}};
function adjSub(){const nd=k=>()=>{if(k==='subject'||k==='background')addSubjectAdjust(k==='background');else addAdjust(k)};return[MI('Global (toute la photo)',{icon:'adj',fn:nd('global')}),MI('Au pinceau',{icon:'brush',fn:nd('brush')}),MI('Dégradé linéaire',{icon:'grad',fn:nd('linear')}),MI('Dégradé radial',{icon:'radial',fn:nd('radial')}),SEP,MI('Sur le sujet (IA)',{icon:'subject',fn:nd('subject')}),MI('Sur l’arrière-plan (IA)',{icon:'subject',fn:nd('background')}),MI('Sur la sélection',{icon:'sel',fn:nd('selection'),dis:selDis()})]}
function maskSub(){const L=S.doc&&AL(),has=!!(L&&L.mask);return[fromPick('layer','Ajouter un masque','Ajouter un masque','mask',{dis:has?'Ce calque a déjà un masque':S.doc?false:NODOC}),MI('Inverser le masque',{icon:'invert',fn:invertMask,dis:has?false:'Ce calque n’a pas de masque'}),MI('Affiner le masque…',{fn:refineDialog,dis:has?false:'Ce calque n’a pas de masque'}),MI('Afficher le masque',{kbd:'⇧M',check:!!S.showMask,fn:toggleMask,dis:has?false:'Ce calque n’a pas de masque'}),MI('Supprimer le masque',{icon:'trash',danger:true,fn:deleteMask,dis:has?false:'Ce calque n’a pas de masque'})]}
function renameLayerUI(i){if(!S.doc)return;if(document.body.classList.contains('compact'))switchTab('layers');setTimeout(()=>startRename(i),30)}
/* ---- menu engine: menu bar, submenus, context menus, phone sheet ---- */
const MEN={levels:[],bar:null,anchorBtn:null,ret:null,hoverT:0};
function menuItemsOf(x){return(typeof x==='function'?x():x)||[]}
function closeMenus(focusBack){MEN.levels.forEach(l=>l.el.remove());MEN.levels=[];clearTimeout(MEN.hoverT);$$('#menubar>button').forEach(b=>{b.classList.remove('open');b.setAttribute('aria-expanded','false')});const sh=$('#msheet');if(sh)sh.remove();
  if(focusBack&&MEN.ret&&MEN.ret.isConnected)try{MEN.ret.focus({preventScroll:true})}catch(e){}MEN.ret=null;MEN.anchorBtn=null}
closeMenu=()=>closeMenus(false);
function buildMenuEl(items,level){const m=document.createElement('div');m.className='menu';m.setAttribute('role','menu');m.tabIndex=-1;let lastSep=true;
  items.forEach(it=>{if(it===SEP){if(!lastSep){const s=document.createElement('div');s.className='msep';s.setAttribute('role','separator');m.appendChild(s);lastSep=true}return}
    if(it.head){const h=document.createElement('div');h.className='mhead';h.textContent=it.head;m.appendChild(h);return}
    const b=document.createElement('button');b.type='button';b.className='mi'+(it.danger?' danger':'');b.tabIndex=-1;const dis=!!it.dis;b.setAttribute('role',it.check!==undefined?'menuitemcheckbox':'menuitem');if(it.check!==undefined)b.setAttribute('aria-checked',!!it.check);
    if(dis){b.setAttribute('aria-disabled','true');if(typeof it.dis==='string'){b.title=it.dis;b.setAttribute('aria-description',it.dis)}}if(it.sub){b.setAttribute('aria-haspopup','menu');b.setAttribute('aria-expanded','false')}
    b.innerHTML=`<span class="mi-i">${it.check!==undefined?(it.check?ico('check'):'<span class="mi-noi"></span>'):ico(it.icon)}</span><span class="mi-l">${esc(it.label)}</span>${it.sub?'<svg class="mi-sub" viewBox="0 0 20 20" aria-hidden="true"><path d="M8 5l5 5-5 5"/></svg>':`<kbd>${esc(it.kbd||'')}</kbd>`}`;
    b._it=it;lastSep=false;m.appendChild(b)});
  const last=m.lastElementChild;if(last&&last.classList.contains('msep'))last.remove();
  m.addEventListener('pointerover',e=>{const b=e.target.closest('.mi');if(!b||e.pointerType!=='mouse')return;b.focus({preventScroll:true});clearTimeout(MEN.hoverT);MEN.hoverT=setTimeout(()=>{closeLevelsAbove(level);if(b._it.sub&&!b._it.dis)openSub(b,level,false)},140)});
  m.addEventListener('click',e=>{const b=e.target.closest('.mi');if(!b)return;activate(b,level,false)});m.addEventListener('keydown',e=>menuKey(e,m,level));m.addEventListener('contextmenu',e=>e.preventDefault());return m}
function placeMenu(m,x,y,alt){document.body.appendChild(m);const r=m.getBoundingClientRect(),W=innerWidth,H=innerHeight;let px=x,py=y;if(px+r.width>W-6)px=alt!=null?alt-r.width:W-r.width-6;if(px<6)px=6;if(py+r.height>H-6)py=Math.max(6,H-r.height-6);m.style.left=px+'px';m.style.top=py+'px'}
function openMenuAt(items,x,y,opts={}){closeMenus(false);MEN.ret=opts.ret||document.activeElement;const m=buildMenuEl(menuItemsOf(items),0);m.classList.add(opts.ctx?'ctx':'drop');placeMenu(m,x,y);MEN.levels=[{el:m}];if(opts.focus!==false)focusItem(m,0)}
function closeLevelsAbove(level){while(MEN.levels.length>level+1){const l=MEN.levels.pop();l.el.remove();if(l.from){l.from.setAttribute('aria-expanded','false');l.from.classList.remove('sub-open')}}}
function openSub(b,level,focus){const it=b._it;if(MEN.levels[level+1]&&MEN.levels[level+1].from===b)return;closeLevelsAbove(level);const m=buildMenuEl(menuItemsOf(it.sub),level+1);m.classList.add('sub');const r=b.getBoundingClientRect();placeMenu(m,r.right+2,r.top-5,r.left-2);
  MEN.levels.push({el:m,from:b});b.setAttribute('aria-expanded','true');b.classList.add('sub-open');if(focus)focusItem(m,0)}
function activate(b,level,kbd){const it=b._it;if(it.dis){if(typeof it.dis==='string')toast(it.dis);return}if(it.sub){openSub(b,level,kbd);return}closeMenus(true);setTimeout(()=>{try{it.fn&&it.fn()}catch(e){console.error(e);toast('Action impossible : '+(e.message||e))}},0)}
function menuBtns(m){return[...m.querySelectorAll(':scope>.mi')]}
function focusItem(m,i){const bs=menuBtns(m);if(!bs.length)return;const k=(i+bs.length)%bs.length;bs[k].focus({preventScroll:true});bs[k].scrollIntoView({block:'nearest'})}
function menuKey(e,m,level){const bs=menuBtns(m),cur=bs.indexOf(document.activeElement);const k=e.key;
  if(k==='ArrowDown'){e.preventDefault();focusItem(m,cur+1)}else if(k==='ArrowUp'){e.preventDefault();focusItem(m,cur<0?bs.length-1:cur-1)}else if(k==='Home'){e.preventDefault();focusItem(m,0)}else if(k==='End'){e.preventDefault();focusItem(m,bs.length-1)}
  else if(k==='ArrowRight'){e.preventDefault();const b=bs[cur];if(b&&b._it.sub&&!b._it.dis)openSub(b,level,true);else if(MEN.anchorBtn)barStep(1,true)}
  else if(k==='ArrowLeft'){e.preventDefault();if(level>0){const from=MEN.levels[level].from;closeLevelsAbove(level-1);from&&from.focus()}else if(MEN.anchorBtn)barStep(-1,true)}
  else if(k==='Enter'||k===' '){e.preventDefault();const b=bs[cur];b&&activate(b,level,true)}
  else if(k==='Escape'){e.preventDefault();if(level>0){const from=MEN.levels[level].from;closeLevelsAbove(level-1);from&&from.focus()}else{const a=MEN.anchorBtn;closeMenus(!a);a&&a.focus()}}
  else if(k==='Tab'){e.preventDefault();closeMenus(true)}
  else if(k.length===1&&/\S/.test(k)){const n=norm(k);for(let j=1;j<=bs.length;j++){const b=bs[(cur+j)%bs.length];if(norm(b.textContent.trim()).startsWith(n)){b.focus();break}}}
  e.stopPropagation()}
/* menu bar */
function buildMenubar(){const bar=$('#menubar');bar.innerHTML=Object.entries(MENU2).map(([k,v],i)=>`<button type="button" role="menuitem" aria-haspopup="menu" aria-expanded="false" data-m2="${k}" tabindex="${i?-1:0}">${v.label}</button>`).join('');
  bar.addEventListener('click',e=>{const b=e.target.closest('[data-m2]');if(!b)return;b.classList.contains('open')?closeMenus(false):openBar(b,false)});
  bar.addEventListener('pointerover',e=>{const b=e.target.closest('[data-m2]');if(b&&e.pointerType==='mouse'&&MEN.anchorBtn&&MEN.anchorBtn!==b)openBar(b,false)});
  bar.addEventListener('keydown',e=>{const b=e.target.closest('[data-m2]');if(!b)return;const bs=[...bar.children],i=bs.indexOf(b);
    if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const n=bs[(i+(e.key==='ArrowRight'?1:-1)+bs.length)%bs.length];bs.forEach(x=>x.tabIndex=-1);n.tabIndex=0;n.focus();if(MEN.anchorBtn)openBar(n,true)}
    else if(e.key==='ArrowDown'||e.key==='Enter'||e.key===' '){e.preventDefault();openBar(b,true)}else if(e.key==='Escape'){closeMenus(false)}})}
function openBar(b,focus){const k=b.dataset.m2;closeMenus(false);MEN.ret=document.activeElement===b?b:document.activeElement;const m=buildMenuEl(menuItemsOf(MENU2[k].items),0);m.classList.add('drop');const r=b.getBoundingClientRect();placeMenu(m,r.left,r.bottom+4);
  MEN.levels=[{el:m}];MEN.anchorBtn=b;b.classList.add('open');b.setAttribute('aria-expanded','true');$$('#menubar>button').forEach(x=>x.tabIndex=x===b?0:-1);if(focus)focusItem(m,0)}
function barStep(dir,focus){const bs=[...$('#menubar').children],i=bs.indexOf(MEN.anchorBtn),n=bs[(i+dir+bs.length)%bs.length];openBar(n,focus);if(!focus)n.focus()}
document.addEventListener('pointerdown',e=>{if(!MEN.levels.length&&!$('#msheet'))return;if(e.target.closest('.menu,#menubar,#msheet,#bMenu'))return;closeMenus(false)},true);
window.addEventListener('resize',()=>closeMenus(false));window.addEventListener('blur',()=>{if(MEN.levels.length)closeMenus(false)});
document.addEventListener('keydown',e=>{if(e.key==='F10'&&!e.shiftKey){e.preventDefault();const f=$('#menubar>button');if(f&&getComputedStyle($('#menubar')).display!=='none')f.focus();else $('#bMenu').click()}},true);
/* phone: one sheet, menus drill down */
function openSheet(stack){const old=$('#msheet');if(old)old.remove();const top=stack[stack.length-1];const s=document.createElement('div');s.id='msheet';s.className='msheet';s.setAttribute('role','dialog');s.setAttribute('aria-modal','true');s.setAttribute('aria-label',top.title);
  const items=menuItemsOf(top.items);s.innerHTML=`<div class="ms-h">${stack.length>1?`<button class="ib" data-back aria-label="Retour"><svg viewBox="0 0 20 20"><path d="M12 4l-6 6 6 6"/></svg></button>`:''}<b>${esc(top.title)}</b><button class="ib" data-x aria-label="Fermer"><svg viewBox="0 0 20 20"><path d="M5 5l10 10M15 5L5 15"/></svg></button></div>`;
  const m=buildMenuEl(items,0);m.classList.add('inline');m.replaceWith&&0;s.appendChild(m);document.body.appendChild(s);
  m.onclick=null;m.addEventListener('click',e=>{const b=e.target.closest('.mi');if(!b)return;e.stopImmediatePropagation();const it=b._it;if(it.dis){if(typeof it.dis==='string')toast(it.dis);return}if(it.sub){openSheet([...stack,{title:it.label,items:it.sub}]);return}s.remove();setTimeout(()=>it.fn&&it.fn(),0)},true);
  s.querySelector('[data-x]').onclick=()=>s.remove();const bk=s.querySelector('[data-back]');if(bk)bk.onclick=()=>openSheet(stack.slice(0,-1));focusItem(m,0)}
function rootSheetItems(){return Object.entries(MENU2).map(([k,v])=>MI(v.label,{sub:v.items}))}
$('#bMenu').onclick=e=>{e.stopImmediatePropagation();if($('#msheet')){$('#msheet').remove();return}openSheet([{title:'Menu',items:rootSheetItems}])};
openMenuSheet=()=>openSheet([{title:'Menu',items:rootSheetItems}]);
/* ---- context menus (right click, Shift+F10, long press on touch) ---- */
function layerCtx(i){const d=S.doc;if(!d)return[];if(d.active!==i)setActiveLayer(i);const L=d.layers[i];return[
  MI('Renommer…',{icon:'rename',fn:()=>renameLayerUI(i)}),MI('Dupliquer',{icon:'dup',kbd:MOD+'J',fn:dupLayer}),MI('Supprimer',{icon:'trash',kbd:'Suppr',danger:true,fn:delLayer,dis:d.layers.length<2?'Il faut garder au moins un calque':false}),SEP,
  MI(L.visible===false?'Afficher':'Masquer',{icon:'eye',fn:()=>setLayerProp(i,'visible',L.visible===false,L.visible===false?'Afficher le calque':'Masquer le calque')}),
  MI('Opacité',{sub:()=>[100,75,50,25].map(v=>MI(v+' %',{check:Math.round(L.opacity*100)===v,fn:()=>setLayerProp(i,'opacity',v/100,'Opacité du calque')}))}),
  MI('Mode de fusion',{dis:L.kind==='adjust'?'Pas pour un calque de réglage':false,sub:()=>BLENDS.map(([v,n])=>MI(n,{check:L.blend===v,fn:()=>setLayerProp(i,'blend',v,'Mode de fusion')}))}),
  MI('Masque',{icon:'mask',sub:maskSub}),SEP,
  MI('Monter',{icon:'up',kbd:MOD+']',fn:()=>moveLayer(1),dis:i>=d.layers.length-1?'Déjà tout en haut':false}),MI('Descendre',{icon:'down',kbd:MOD+'[',fn:()=>moveLayer(-1),dis:i<=0?'Déjà tout en bas':false}),
  MI('Fusionner avec le calque inférieur',{icon:'merge',kbd:MOD+'E',fn:mergeDown,dis:i<=0?'Aucun calque en dessous':false}),fromPick('layer','Fusionner les calques visibles'),fromPick('layer','Aplatir l’image'),SEP,
  MI('Nouveau calque de pixels',{icon:'layer',fn:addLayer}),MI('Nouveau calque de réglage',{icon:'adj',sub:adjSub})]}
function canvasCtx(){const d=S.doc;if(!d)return[MI('Ouvrir…',{icon:'open',fn:openFile}),MI('Photothèque…',{icon:'lib',fn:()=>openLibrary()}),MI('Nouveau document…',{icon:'new',fn:newDocDialog})];const sel=!!d.sel,L=AL();
  const top=sel?[MI('Couper',{icon:'cut',kbd:MOD+'X',fn:cutSel}),fromPick('edit','Copier','Copier','copy'),fromPick('edit','Coller','Coller','paste'),SEP,fromPick('edit','Effacer la sélection','Effacer le contenu','trash',{danger:true}),fromPick('edit','Remplir avec la couleur','Remplir avec la couleur','fill'),fromPick('edit','Supprimer l’objet','Supprimer l’objet (IA)','wand'),SEP,
      fromPick('select','Désélectionner',null,null),fromPick('select','Intervertir','Intervertir la sélection','invert'),MI('Contour progressif…',{icon:'feather',fn:featherDialog}),MI('Affiner le contour…',{fn:refineDialog}),MI('Recadrer sur la sélection',{icon:'crop',fn:cropToSel}),MI('Nouveau calque par copier',{icon:'dup',kbd:MOD+'J',fn:dupLayer}),MI('Nouveau réglage sur la sélection',{icon:'adj',fn:()=>addAdjust('selection')})]
    :[fromPick('edit','Coller','Coller','paste'),fromPick('select','Tout sélectionner',null,'sel'),fromPick('select','Sélectionner le sujet','Sélectionner le sujet (IA)','subject')];
  return[...top,SEP,MI(S.hi>0?`Annuler « ${S.history[S.hi].label} »`:'Annuler',{icon:'undo',kbd:MOD+'Z',fn:undo,dis:S.hi>0?false:'Rien à annuler'}),SEP,
    MI(`Calque « ${L?L.name:''} »`,{icon:'layer',sub:()=>layerCtx(d.active)}),MI('Nouveau calque de réglage',{icon:'adj',sub:adjSub}),SEP,
    fromPick('view','Ajuster à l’écran',null,'fit'),fromPick('view','Taille réelle','Taille réelle (100 %)'),MI('Comparer avant / après',{icon:'compare',kbd:'Y',check:S.compare==='split',fn:toggleCompare}),SEP,MI('Exporter…',{icon:'export',kbd:MOD+'⇧E',fn:exportDialog})]}
function historyCtx(i){return[MI('Revenir à cette étape',{icon:'history',fn:()=>restore(i),dis:i===S.hi?'Vous y êtes déjà':false}),MI('Annuler la dernière action',{icon:'undo',fn:undo,dis:S.hi>0?false:'Rien à annuler'}),MI('Rétablir',{icon:'redo',fn:redo,dis:S.hi<S.history.length-1?false:'Rien à rétablir'})]}
function rowCtx(row){const lab=(row.querySelector('label')||{}).textContent||'ce réglage',sec=row.closest('details.sec'),rs=sec&&sec.querySelector('[data-reset]'),title=sec&&sec.querySelector('summary')?sec.querySelector('summary').childNodes[0].textContent.trim():'';
  return[MI(`Réinitialiser « ${lab} »`,{icon:'reset',fn:()=>row.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))}),rs?MI(`Réinitialiser la section ${title}`,{fn:()=>rs.click()}):null,MI('Tout réinitialiser',{danger:true,fn:()=>$('#btnResetAll')&&$('#btnResetAll').click()}),SEP,fromPick('edit','Copier les réglages',null,'copy'),fromPick('edit','Coller les réglages',null,'paste')].filter(Boolean)}
function presetCtx(b){return[MI('Appliquer',{icon:'auto',fn:()=>b.click()}),MI('Appliquer dans un nouveau calque de réglage',{icon:'adj',fn:()=>{addAdjust('global');setTimeout(()=>{const nb=$(`#presets [data-p="${b.dataset.p}"]`);nb&&nb.click()},60)}})]}
function libCtx(id){const it=LIB.items.find(x=>x.id===id);if(!it)return[];if(!LIB.sel.has(id)){LIB.sel=new Set([id]);LIB.anchor=id;renderLibrary()}const ids=[...LIB.sel],r=(it.lib&&it.lib.rating)||0,lb=(it.lib&&it.lib.label)||'';
  return[MI(ids.length>1?`Ouvrir « ${it.name} »`:'Ouvrir',{icon:'open',fn:()=>libOpen(id)}),MI('Renommer…',{icon:'rename',fn:()=>{const n=$('#lbName');if(n){n.focus();n.select()}},dis:ids.length>1?'Sélectionnez une seule photo':false}),SEP,
    MI('Note',{icon:'star',sub:()=>[0,1,2,3,4,5].map(v=>MI(v?'★'.repeat(v):'Sans note',{check:r===v,kbd:String(v),fn:()=>libSet(ids,{rating:v}).then(()=>renderLibrary())}))}),
    MI('Étiquette de couleur',{icon:'tag',sub:()=>[MI('Aucune',{check:!lb,fn:()=>libSet(ids,{label:''}).then(()=>renderLibrary())}),...LBL.map(([k,n],j)=>MI(n,{check:lb===k,kbd:String(6+j)!=='10'?String(6+j):'',fn:()=>libSet(ids,{label:k}).then(()=>renderLibrary())}))]}),SEP,
    MI(it.cloud||(it.local&&it.local.sync)?'Arrêter la synchronisation':'Synchroniser sur mon compte',{icon:'cloud',fn:()=>libSync(it),dis:Cloud.ok?false:'Disponible quand Prism est ouvert depuis votre compte Claude'}),MI('Traiter par lot…',{icon:'batch',fn:()=>{const loc=ids.filter(i=>LIB.items.find(x=>x.id===i&&x.local));if(!loc.length){toast('Le traitement par lot porte sur les projets présents sur cet appareil');return}closeLibrary();batchDialog(loc)}}),SEP,
    MI(ids.length>1?`Supprimer ${ids.length} photos…`:'Supprimer…',{icon:'trash',danger:true,fn:()=>libDelete(ids)})]}
function ctxFor(t){if(t.closest('input,textarea,[contenteditable]'))return null;
  const li=t.closest('#pane-layers .lyr');if(li)return()=>layerCtx(+li.dataset.i);
  const h=t.closest('#pane-history [data-h]');if(h)return()=>historyCtx(+h.dataset.h);
  const pr=t.closest('#presets .preset');if(pr)return()=>presetCtx(pr);
  const row=t.closest('#pane-develop .row[data-k]');if(row)return()=>rowCtx(row);
  const card=t.closest('.lb-card');if(card)return()=>libCtx(card.dataset.id);
  if(t.closest('#stage')&&!t.closest('.composer,.empty'))return canvasCtx;
  if(t.closest('#docname'))return()=>[MI('Renommer le document…',{icon:'rename',fn:renameDocDialog,dis:docDis()}),MI('Photothèque…',{icon:'lib',fn:()=>openLibrary()}),MI('Exporter…',{icon:'export',fn:exportDialog,dis:docDis()})];
  return null}
document.addEventListener('contextmenu',e=>{const f=ctxFor(e.target);if(!f)return;e.preventDefault();e.stopPropagation();if(S.stroke||S.drag)return;let x=e.clientX,y=e.clientY;if(!x&&!y){const r=e.target.getBoundingClientRect();x=r.left+12;y=r.top+r.height/2}
  openMenuAt(f,x,y,{ctx:true,focus:e.button!==2})},true);
/* long press on touch screens for layers, history and the library */
(()=>{let t=0,st=null;document.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;const el=e.target.closest('#pane-layers .lyr,#pane-history [data-h],.lb-card,#presets .preset');if(!el)return;st={x:e.clientX,y:e.clientY,el};clearTimeout(t);
    t=setTimeout(()=>{if(!st)return;const f=ctxFor(st.el);if(f){navigator.vibrate&&navigator.vibrate(10);openMenuAt(f,st.x,st.y,{ctx:true});st.fired=true}},520)},true);
  document.addEventListener('pointermove',e=>{if(st&&Math.hypot(e.clientX-st.x,e.clientY-st.y)>10){clearTimeout(t);st=null}},true);
  document.addEventListener('pointerup',e=>{clearTimeout(t);if(st&&st.fired){e.preventDefault();const k=ev=>{ev.stopPropagation();ev.preventDefault()};document.addEventListener('click',k,{capture:true,once:true});setTimeout(()=>document.removeEventListener('click',k,true),400)}st=null},true)})();
/* ---- dialogs: help ---- */
function shortcutsDialog(){const tools=TOOLS.filter(Boolean).map(t=>`<tr><td>${esc(t[1])}</td><td><kbd>${t[2]}</kbd></td></tr>`).join('');
  const gen=[['Rechercher une commande',MOD+'K'],['Ouvrir',MOD+'O'],['Photothèque',MOD+'⇧O'],['Enregistrer',MOD+'S'],['Exporter',MOD+'⇧E'],['Annuler / rétablir',MOD+'Z  /  '+MOD+'⇧Z'],['Couper / copier / coller',MOD+'X / C / V'],['Tout sélectionner / désélectionner',MOD+'A  /  '+MOD+'D'],['Intervertir la sélection',MOD+'⇧I'],['Nouveau calque',MOD+'⌥N'],['Dupliquer le calque',MOD+'J'],['Fusionner avec le calque inférieur',MOD+'E'],['Ajuster à l’écran / 100 %',MOD+'0  /  '+MOD+'1'],['Zoom avant / arrière',MOD+'+  /  '+MOD+'−'],['Comparer avant / après','Y'],['Voir l’original (maintenir)','\\'],['Afficher le masque','⇧M'],['Réglages automatiques',MOD+'⇧L'],['Menu clic droit au clavier','⇧F10'],['Aller au menu','F10'],['Déplacer la vue','Espace + glisser'],['Masque rapide','Q'],['Inverser couleur de premier plan / arrière-plan','X'],['Taille du pinceau / dureté','[ ]  /  ⇧[ ]'],['Pinceau : ligne droite','⇧ + clic'],['Baguette : régler la tolérance en direct','Glisser après le clic'],['Lasso polygonal : fermer','Double-clic / Entrée'],['Transformation libre : valider / annuler','Entrée / Échap'],['Sélectionner plusieurs calques','Ctrl + clic  /  Maj + clic'],['Remettre un curseur à zéro','Double-clic'],['Saisir une valeur','Clic sur le chiffre'],['Aperçu rapide (photothèque)','Espace']].map(([a,b])=>`<tr><td>${esc(a)}</td><td><kbd>${esc(b)}</kbd></td></tr>`).join('');
  const dl=dialog({title:'Raccourcis clavier',body:`<div class="keys"><table><caption>Général</caption>${gen}</table><table><caption>Outils</caption>${tools}</table></div>`,buttons:[{label:'Fermer',primary:true}]});dl.classList.add('wide')}
function formatsDialog(){dialog({title:'Formats pris en charge',body:`<table class="fmts"><tr><th>Ouvrir</th><td>JPEG, HEIC / HEIF, PNG 8 et 16 bits, TIFF 8, 16 et 32 bits (LZW, ZIP, CMJN), WebP, AVIF, PSD / PSB, PDF, GIF, BMP, TGA, SVG, ICO et les RAW de tous les grands fabricants (CR2, CR3, NEF, ARW, DNG, RAF, ORF, RW2…)</td></tr><tr><th>Exporter</th><td>JPEG (4:4:4), PNG 8 et 16 bits, TIFF 8 et 16 bits, WebP, AVIF 8 et 10 bits, PSD avec calques, PDF, GIF, BMP, TGA, ICO</td></tr><tr><th>Projet</th><td>.zip Prism (tous les calques, masques et réglages)</td></tr></table><p class="muted">Profils couleur et données de prise de vue (EXIF) conservés. Jusqu’à 120 Mpx sur ordinateur, 16,7 Mpx sur iPhone et iPad (limite de Safari).</p>`,buttons:[{label:'Fermer',primary:true}]})}
function aboutDialog(){dialog({title:'À propos de Prism',body:`<div class="about">${PRISM_LOGO}<div><b>Prism</b><p class="muted">Retouche photo dans le navigateur : RAW 16 bits, calques et masques, réglages non destructifs, outils IA sur l’appareil, photothèque et export dans tous les formats courants.</p></div></div>
  <details class="credits" style="margin-top:12px;font-size:12px"><summary style="cursor:pointer">Logiciels et modèles intégrés</summary><ul class="muted" style="margin:6px 0 0;padding-left:18px;line-height:1.55">
  <li>ONNX Runtime (MIT), TensorFlow.js (Apache 2.0)</li><li>LibRaw (LGPL 2.1 / CDDL 1.0), Little CMS (MIT), libheif (LGPL 3), pdf.js (Apache 2.0), ag-psd (MIT), encodeur AVIF libavif/aom (BSD)</li>
  <li>Détourage : ISNet, DIS (Apache 2.0) · Scènes : DeepLabv3+ ADE20K, TensorFlow Models (Apache 2.0) · Personnes : MediaPipe Selfie Multiclass (Apache 2.0)</li>
  <li>Débruitage : SCUNet (Apache 2.0) · Suppression d’objet : LaMa (Apache 2.0) · Sélection d’objet : Segment Anything ViT-B, Meta AI (Apache 2.0) · Agrandissement : Real-ESRGAN (BSD 3 clauses)</li>
  <li>Profils d’objectif : base lensfun (CC BY-SA 3.0, lensfun.github.io)</li></ul></details>`,buttons:[{label:'Fermer',primary:true}]})}
document.addEventListener('keydown',e=>{const t=e.target;if(t.closest&&t.closest('input,textarea,select,[contenteditable]'))return;if(e.key==='?'&&!e.metaKey&&!e.ctrlKey){e.preventDefault();shortcutsDialog()}
  if((e.metaKey||e.ctrlKey)&&!e.shiftKey&&!e.altKey&&(e.key==='x'||e.key==='X')&&S.doc&&S.doc.sel){e.preventDefault();cutSel()}});
/* dialogs keep focus inside, and their first field gets focus */
document.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const s=$('#scrim:not(.light)')||$('#msheet')||$('#cmdk');if(!s)return;const f=[...s.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(x=>!x.disabled&&x.offsetParent);if(!f.length)return;
  const a=f[0],z=f[f.length-1];if(!s.contains(document.activeElement)){e.preventDefault();a.focus();return}if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}},true);
new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.id==='scrim'&&!n.classList.contains('light'))setTimeout(()=>{if(n.contains(document.activeElement))return;const f=n.querySelector('.body input:not([type=range]):not([type=checkbox]),.body select,.foot .btn.primary,.foot .btn');f&&f.focus({preventScroll:true})},40)}).observe(document.body,{childList:true});
/* ---- layout: docked layers panel on large screens, tabs on phones ---- */
const COMPACT=matchMedia('(max-width:900px) and (orientation:portrait),(max-height:560px) and (orientation:landscape)');
function applyLayout(){const c=COMPACT.matches;document.body.classList.toggle('compact',c);const lp=$('#pane-layers');
  if(c){lp.hidden=!$('.tabs [data-tab="layers"]').classList.contains('on')}else{lp.hidden=false;if($('.tabs [data-tab="layers"]').classList.contains('on'))switchTab('develop');syncLayers()}
  $('#layersPanel').style.height=c?'':UI2.layersH+'px'}
const _switchTab=switchTab;switchTab=function(t){if(t==='layers'&&!COMPACT.matches){const p=$('#layersPanel');p.classList.add('flash');setTimeout(()=>p.classList.remove('flash'),600);syncLayers();return}
  _switchTab(t);$$('.tabs [data-tab]').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===t));if(!COMPACT.matches)$('#pane-layers').hidden=false;
  if(COMPACT.matches){/* layers live inside the sheet on phones */const lp=$('#pane-layers');lp.hidden=t!=='layers'}};
$$('.tabs [data-tab]').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
COMPACT.addEventListener('change',applyLayout);
/* layers panel height */
(()=>{const sp=$('#lySplit');let st=null;const set=h=>{const max=$('.side').getBoundingClientRect().height-220;UI2.layersH=clamp(h,140,Math.max(160,max));$('#layersPanel').style.height=UI2.layersH+'px'};
  sp.addEventListener('pointerdown',e=>{st={y:e.clientY,h:$('#layersPanel').getBoundingClientRect().height};sp.setPointerCapture(e.pointerId);sp.classList.add('on')});
  sp.addEventListener('pointermove',e=>{if(st)set(st.h+(st.y-e.clientY))});sp.addEventListener('pointerup',()=>{if(st){st=null;sp.classList.remove('on');PREF.set('uiLayersH',UI2.layersH)}});
  sp.addEventListener('keydown',e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();set(UI2.layersH+(e.key==='ArrowUp'?24:-24));PREF.set('uiLayersH',UI2.layersH)}})})();
/* histogram can be folded away */
function setHisto(on){UI2.histo=on;PREF.set('uiHisto',on);$('#histoPanel').classList.toggle('closed',!on);$('#histoHead').setAttribute('aria-expanded',on);if(on){S.contentDirty=true;requestRender()}}
$('#histoHead').onclick=()=>setHisto(!UI2.histo);
/* tool help: name, shortcut and what it does */
const TOOL_HELP={move:'Déplace le calque actif ou le contenu de la sélection',marquee:'Sélectionne une zone rectangulaire ou elliptique',lasso:'Sélection à main levée',wand:'Sélectionne les pixels de couleur proche',pen:'Trace des chemins précis, convertibles en sélection ou en masque',crop:'Recadre, redresse et change le format',eyedropper:'Prélève une couleur dans la photo',
  heal:'Efface taches et poussières en reprenant la texture voisine',remove:'Efface un objet entier, l’IA reconstruit le fond',clone:'Recopie une zone ailleurs (Alt + clic pour choisir la source)',brush:'Peint sur le calque ou sur le masque',eraser:'Efface les pixels ou le masque',gradient:'Remplit d’un dégradé, ou crée un masque progressif',dodge:'Éclaircit, assombrit ou désature localement',text:'Ajoute du texte',hand:'Déplace la vue (ou maintenez Espace)',zoom:'Zoome (Alt pour dézoomer)'};
function decorateTools(){$$('#dock [data-tool]').forEach(b=>{const t=TOOLS.find(x=>x&&x[0]===b.dataset.tool);if(!t)return;b.removeAttribute('title');b.dataset.tip=`${t[1]} (${t[2]}) ${TOOL_HELP[t[0]]||''}`;b.setAttribute('aria-keyshortcuts',t[2]);b.setAttribute('aria-pressed',b.classList.contains('on'))})}
decorateTools();
const _setTool=setTool;setTool=function(t){_setTool(t);$$('#dock [data-tool]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.tool===t));const x=TOOLS.find(y=>y&&y[0]===t);const ot=$('#optTool');if(ot&&x){const src=$(`#dock [data-tool="${t}"] svg`);ot.innerHTML=(src?src.outerHTML:'')+`<b>${esc(x[1])}</b>`}};
/* status bar: document facts on the right */
function updateStDoc(){const d=S.doc,el=$('#stDoc');if(!el)return;if(!d){el.innerHTML='';return}const px=(d.w*d.h/1e6).toFixed(1).replace('.',',');const L=AL();
  el.innerHTML=`<span>${d.w|0} × ${d.h|0} px · ${px} Mpx</span><span>${d.space==='display-p3'?'Display P3':'sRGB'}</span><span>${PREC.on&&typeof docHasHi==='function'&&docHasHi()?'16 bits':'8 bits'}</span><span>${d.layers.length} calque${d.layers.length>1?'s':''}</span>`}
const _updateStatus=updateStatus;updateStatus=function(){_updateStatus();updateStDoc()};
const _udn2=updateDocName;updateDocName=function(){_udn2();updateStDoc()};
/* compare and assistant buttons show their state */
const _tc=toggleCompare;toggleCompare=function(){_tc();$('#bCompare').setAttribute('aria-pressed',S.compare==='split')};
$('#bAssist').addEventListener('click',()=>setTimeout(()=>$('#bAssist').setAttribute('aria-pressed',!$('#composer').hidden),0));
if(PREF.get('composerHidden',null)===null)PREF.set('composerHidden',true);
/* adjustments header: active adjustment as a select, one clear "new adjustment" button */
const _renderTarget=renderTarget;renderTarget=function(){_renderTarget();const el=$('#target'),d=S.doc;if(!el||!d)return;const A=AL(),adj=d.layers.map((l,i)=>({l,i})).filter(x=>x.l.kind==='adjust');
  let h=`<div class="tg-row"><label class="tg-l" for="tgSel">Réglage modifié</label><div class="tg-ctl"><select id="tgSel">${A&&A.kind!=='adjust'?`<option value="" selected>— Calque de pixels : ${esc(A.name)} —</option>`:''}${adj.map(({l,i})=>`<option value="${i}" ${i===d.active?'selected':''}>${esc(l.name)}${l.mask?' (local)':' (toute la photo)'}</option>`).join('')}</select><button class="btn sm" id="tgNew" aria-haspopup="menu">${ico('adj')}<span>Nouveau</span></button></div></div>`;
  if(A&&A.kind==='adjust'&&A.mask)h+=`<div class="tg-row"><span class="tg-l">Zone du réglage</span><div class="tg-tools"><button class="tbtn ${S.tool==='brush'?'on':''}" data-mask="brush" aria-pressed="${S.tool==='brush'}">${ico('brush')}<span>Ajouter</span></button><button class="tbtn ${S.tool==='eraser'?'on':''}" data-mask="erase" aria-pressed="${S.tool==='eraser'}">${ico('trash')}<span>Retirer</span></button><button class="tbtn" data-mask="linear">${ico('grad')}<span>Linéaire</span></button><button class="tbtn" data-mask="radial">${ico('radial')}<span>Radial</span></button><button class="tbtn" data-mask="invert">${ico('invert')}<span>Inverser</span></button><button class="tbtn ${S.showMask?'on':''}" data-mask="show" aria-pressed="${!!S.showMask}">${ico('eye')}<span>Voir</span></button></div></div>`;
  if(A&&A.kind!=='adjust')h+=`<p class="tnote">Ce calque contient des pixels. Choisissez un réglage dans la liste ou créez-en un nouveau pour retoucher la photo sans l’abîmer.</p>`;
  el.innerHTML=h;$('#tgSel').onchange=e=>{if(e.target.value!=='')setActiveLayer(+e.target.value)};$('#tgNew').onclick=e=>{const r=e.currentTarget.getBoundingClientRect();openMenuAt(adjSub,r.left,r.bottom+4,{ret:e.currentTarget})}};
/* go */
buildMenubar();applyLayout();setHisto(UI2.histo);setTool(S.tool);renderTarget();updateStDoc();

