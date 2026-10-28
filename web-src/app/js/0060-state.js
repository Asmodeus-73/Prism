/* ================= state ================= */
const BLENDS=[['source-over','Normal'],['darken','Obscurcir'],['multiply','Produit'],['color-burn','Densité couleur +'],['lighten','Éclaircir'],['screen','Superposition'],['color-dodge','Densité couleur −'],['lighter','Addition'],['overlay','Incrustation'],['soft-light','Lumière tamisée'],['hard-light','Lumière crue'],['difference','Différence'],['exclusion','Exclusion'],['hue','Teinte'],['saturation','Saturation'],['color','Couleur'],['luminosity','Luminosité']];
const S={doc:null,tool:'heal',zoom:1,panX:0,panY:0,pr:1,fitted:true,history:[],hi:-1,maxHist:30,color:'#f4efe6',docVer:0,
  compare:'off',splitX:0.5,holdBefore:false,showMask:false,
  opts:{selMode:'new',marquee:{shape:'rect',feather:0,ratio:'free'},lasso:{feather:0},wand:{tol:28,contiguous:true,all:true},crop:{ratio:'free'},
    heal:{mode:'spot',size:36,hardness:0.55},remove:{size:46},clone:{size:60,hardness:0.5,opacity:1,aligned:true,all:false},
    brush:{size:30,hardness:0.8,opacity:1,flow:1},eraser:{size:40,hardness:0.8,opacity:1},gradient:{shape:'linear'},dodge:{mode:'dodge',size:90,strength:0.5},
    text:{font:'Geist',size:120,bold:true,italic:false,shadow:true}},
  contentDirty:true,selVer:0,stroke:null,drag:null,crop:null,cloneSrc:null,cloneOff:null,pickSource:false,wbPick:false,pointer:null,spaceDown:false,antPhase:0,nextId:1,sample:false,meta:''};
const view=$('#view'),vctx=view.getContext('2d',P3_OK?{colorSpace:'display-p3'}:{}),stage=$('#stage');
let work=mk(1,1),wctx=rx(work),workB=mk(1,1);
const AL=()=>S.doc&&S.doc.layers[S.doc.active];
function newPixel(name,canvas){return{id:S.nextId++,kind:'pixel',name,canvas,mask:null,editMask:false,visible:true,opacity:1,blend:'source-over'}}
function newAdjust(name,mask){return{id:S.nextId++,kind:'adjust',name,dev:DEV0(),mask:mask||null,visible:true,opacity:1,blend:'source-over'}}
function pixelTarget(){const d=S.doc;if(!d)return null;for(let i=d.active;i>=0;i--)if(d.layers[i].kind==='pixel')return d.layers[i];return null}
function setDoc(src,name,opts={}){setCS(opts.space||(src._raw&&src._cs)||'srgb');let w=src.naturalWidth||src.width,h=src.naturalHeight||src.height;
  if(w*h>MAX_PX){const f=Math.sqrt(MAX_PX/(w*h));w=Math.floor(w*f);h=Math.floor(h*f);toast(`Photo réduite à ${w} × ${h} px pour rester fluide`)}
  const c=mk(w,h),g=cx(c);g.imageSmoothingQuality='high';g.drawImage(src,0,0,w,h);
  S.doc={w,h,name:name||'photo',layers:[newPixel('Arrière-plan',c),newAdjust('Réglages')],active:1,sel:null,pid:uid8(),sync:!opts.sample&&Cloud.ok&&PREF.get('autoSync',true),saved:false,space:CS,path:null,raw:null};if(src._hi&&w===src.width&&h===src.height){S.doc.layers[0].hi=src._hi;S.doc.layers[0].hiC=S.doc.layers[0].canvas}S.sample=!!opts.sample;
  if(opts.dev)Object.assign(S.doc.layers[1].dev,opts.dev);
  S.sample=!!opts.sample;S.meta=opts.meta||'';S.history=[];S.hi=-1;S.crop=null;S.cloneSrc=null;S.cloneOff=null;S.maxHist=clamp(Math.floor(HIST_BUDGET/(w*h*4)),3,40);AI.subjectCache=null;
  pushHistory(opts.raw?'Ouverture du RAW':'Ouverture');selChanged();markComp();fit(true);syncAll();$('#empty').hidden=true;updateDocName();if(S.tool==='crop')initCrop()}
var updateDocName; /* défini dans 0530-prism-interface-brand-tooltips-command.js */

