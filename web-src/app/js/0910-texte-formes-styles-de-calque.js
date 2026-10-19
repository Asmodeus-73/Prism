/* ===== fx_textshape: texte, formes, styles de calque, objets dynamiques : correctifs ===== */
/* -- helpers -- */
function keepName(L,auto,re){return(!L.name||re.test(L.name))?auto:L.name}
function onFirstHistory(pre,run){const prev=pushHistory;let fired=false;
  const mine=function(){if(!fired){fired=true;try{pre()}catch(e){console.warn('textshape',e)}}return prev.apply(this,arguments)};
  pushHistory=mine;try{return run()}finally{if(pushHistory===mine)pushHistory=prev}}
function xfShp(s,k,e,f){if(!s)return s;
  if(s.parts)return{...s,parts:s.parts.map(p=>({...p,s:xfShp(p.s,k,e,f)}))};
  const sw=s.sw>0?Math.max(1,Math.round(s.sw*k)):s.sw;
  return{...s,x:Math.round(s.x*k+e),y:Math.round(s.y*k+f),w:Math.round(s.w*k),h:Math.round(s.h*k),sw,r:Math.round((s.r||0)*k*100)/100}}
function xfTxt(t,k,e,f){const r=v=>Math.round(v*k*100)/100;
  const n={...t,x:Math.round((t.x*k+e)*100)/100,y:Math.round((t.y*k+f)*100)/100,size:r(t.size),boxW:t.boxW?Math.round(t.boxW*k):0,sw:r(t.sw||0),track:r(t.track||0)};delete n.bbox;return n}
function xfFx(fx,k){if(!fx||k===1)return fx;const f=clone(fx),r=v=>Math.round(v*k*100)/100;
  if(f.shadow){f.shadow.blur=r(f.shadow.blur);f.shadow.dx=r(f.shadow.dx);f.shadow.dy=r(f.shadow.dy)}
  if(f.stroke)f.stroke.w=Math.max(1,r(f.stroke.w));if(f.glow)f.glow.blur=Math.max(1,r(f.glow.blur));return f}
function shpBoxTS(s){
  if(s.type==='compound'){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;(s.parts||[]).forEach(p=>{const q=p.s,a=Math.min(q.x,q.x+q.w),b=Math.min(q.y,q.y+q.h);x0=Math.min(x0,a);y0=Math.min(y0,b);x1=Math.max(x1,a+Math.abs(q.w));y1=Math.max(y1,b+Math.abs(q.h))});
    if(x1<x0)return[0,0,1,1];return[x0-2,y0-2,x1-x0+4,y1-y0+4]}
  const x0=Math.min(s.x,s.x+s.w),y0=Math.min(s.y,s.y+s.h),e=s.sw+Math.max(14,s.sw*4);return[x0-e,y0-e,Math.abs(s.w)+e*2,Math.abs(s.h)+e*2]}
/* -- geometry changes keep text, shapes and styles editable (crop, resize, crop to selection) -- */
const soOK=L=>!!(L&&L.so&&L.so.out===L.canvas);
function geoRun(mat,run){const d=S.doc;let dropped=false;const saved=d.layers.map(L=>({L,txt:L.txt,shp:L.shp,fx:L.fx,so:soOK(L)}));
  return onFirstHistory(()=>{const dd=S.doc;saved.forEach(s=>{const L=s.L;if(!dd.layers.includes(L))return;
    if(s.txt||s.shp){
      if(mat){if(s.txt)L.txt=xfTxt(s.txt,mat.k,mat.e,mat.f);else L.shp=xfShp(s.shp,mat.k,mat.e,mat.f);L.fx=xfFx(s.fx,mat.k);finalizeMeta(L)}
      else{delete L.txt;delete L.shp;dropped=true}}
    else if(mat&&s.fx&&mat.k!==1)L.fx=xfFx(s.fx,mat.k);
    if(s.so&&L.canvas&&!soOK(L))L.so={src:cloneC(L.canvas),m:{s:100,rot:0,dx:0,dy:0,fx:false,fy:false},out:L.canvas}});if(dropped)toast('Texte et formes rastérisés : cette transformation les fait devenir des pixels',4000)},run)}
function matOf(fn){try{const g=cx(mk(1,1));fn(g);const m=g.getTransform();if(Math.abs(m.b)<1e-9&&Math.abs(m.c)<1e-9&&m.a>0&&Math.abs(m.a-m.d)<1e-6)return{k:m.a,e:m.e,f:m.f}}catch(e){}return null}
{const _t=transformDoc;transformDoc=function(nw,nh,fn,...r){if(!S.doc)return _t.apply(this,arguments);const mat=matOf(fn);return geoRun(mat,()=>_t.call(this,nw,nh,fn,...r))};
 const _r=resizeDoc;resizeDoc=function(w,h,label,layerFn){const d=S.doc;if(!d)return _r.apply(this,arguments);const kx=w/d.w,ky=h/d.h;const mat=Math.abs(kx-ky)<=0.005*kx?{k:kx,e:0,f:0}:null;return geoRun(mat,()=>_r.apply(this,arguments))};
 const _c=applyCrop;applyCrop=function(){const c=S.crop,d=S.doc;if(!c||!d)return _c.apply(this,arguments);const w=Math.round(c.w),h=Math.round(c.h),x=Math.round(c.x),y=Math.round(c.y);
   if(w<2||h<2||(!c.angle&&!x&&!y&&w===d.w&&h===d.h))return _c.apply(this,arguments);
   return geoRun(c.angle?null:{k:1,e:-x,f:-y},()=>_c.apply(this,arguments))}}
/* -- advanced text options stay in the live preview when another field changes -- */
{const _lp=livePreview;livePreview=function(L){if(L&&L.txt&&document.getElementById('tAdv')&&document.getElementById('taG')){const v=id=>document.getElementById(id);
    L.txt={...L.txt,adv:{grad:v('taG').checked?{c1:v('taC1').value,c2:v('taC2').value,angle:+v('taA').value}:null,ul:v('taU').checked,st:v('taS').checked,caps:v('taK').checked,curve:+v('taR').value}}}
  return _lp.apply(this,arguments)}}
/* -- combined shapes: keep their type when styled, translate their parts when moved -- */
{const _fm=finalizeMeta;finalizeMeta=function(L){if(L&&L.shp&&L.shp.parts&&L.shp.type!=='compound')L.shp={...L.shp,type:'compound'};return _fm.apply(this,arguments)};
 const _bm=bakeMove;bakeMove=function(L,dx,dy){if(L&&L.shp&&L.shp.type==='compound'){L.dx=0;L.dy=0;if(dx||dy){L.shp=xfShp(L.shp,1,dx,dy);finalizeMeta(L)}return}return _bm.apply(this,arguments)}}
/* -- smart objects: history snapshots own their data, moving keeps them non destructive -- */
{const _sl=snapLayer;snapLayer=function(L){const r=_sl(L);if(r.so)r.so={...r.so,m:{...r.so.m}};return r};
 const _up=onUp;onUp=function(e){const dr=S.drag;
   if(dr&&dr.type==='move'&&dr.L&&(dr.L.dx||dr.L.dy)){const tg=[dr.L,...(dr.mates||[])].filter(soOK);
     if(tg.length){const dx=dr.L.dx,dy=dr.L.dy;return onFirstHistory(()=>{const d=S.doc;tg.forEach(L=>{if(!d.layers.includes(L)||!L.so)return;const so=L.so;so.m={...so.m,dx:so.m.dx+dx*100/d.w,dy:so.m.dy+dy*100/d.h};L.canvas=PrismSO.render(so,so.m);so.out=L.canvas;if(L.fbase){L.fbase=null;L.filters=null;L.fout=null}})},()=>_up.call(this,e))}}
   return _up.call(this,e)}}
/* -- text dialog: no empty text layer, Ctrl+Entrée applies -- */
{const _te=textEdit;textEdit=function(L,isNew){const r=_te.apply(this,arguments);
   try{const ta=document.getElementById('tTxt'),sc=document.getElementById('scrim');if(ta&&sc){const ok=[...sc.querySelectorAll('button')].find(b=>/^(Ajouter le texte|Appliquer)$/.test(b.textContent.trim()));
     const sync=()=>{if(ok){ok.disabled=!ta.value.trim();ok.title=ok.disabled?'Saisissez du texte':''}};ta.addEventListener('input',sync);sync();
     ta.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&ok&&!ok.disabled){e.preventDefault();e.stopPropagation();ok.click()}})}}catch(e){console.warn(e)}
   return r}}
/* -- default text size follows the document until the user picks one; explicit rasterize -- */
{const _ta=textAt;textAt=function(p){const d=S.doc,o=S.opts.text;if(d&&o&&!o.__set){o.size=Math.max(24,Math.min(400,Math.round(Math.min(d.w,d.h)/12/5)*5))}return _ta.apply(this,arguments)};
 const _te2=textEdit;textEdit=function(L,isNew){const r=_te2.apply(this,arguments);try{const sc=document.getElementById('scrim');const ok=sc&&[...sc.querySelectorAll('button')].find(b=>/^(Ajouter le texte|Appliquer)$/.test(b.textContent.trim()));if(ok)ok.addEventListener('click',()=>{S.opts.text.__set=true})}catch(e){}return r}}
function rasterMeta(){const d=S.doc,L=d&&AL();if(!L||!MEDIT(L)){toast('Ce calque n’est ni un texte ni une forme');return}
  delete L.txt;delete L.shp;markComp();pushHistory('Rastériser le calque');syncAll();toast('Calque rastérisé : le texte ou la forme n’est plus modifiable')}
{const _mi=MENU2.layer.items;MENU2.layer.items=()=>{const a=_mi(),L=S.doc&&AL();if(!L||!MEDIT(L))return a;const k=a.findIndex(x=>x&&x.label==='Styles de calque…');a.splice(k<0?a.length:k+1,0,MI(L.txt?'Rastériser le texte':'Rastériser la forme',{fn:rasterMeta}));return a};
 const _lc=layerCtx;layerCtx=function(i){const a=_lc.apply(this,arguments),L=S.doc&&S.doc.layers[i];if(!L||!MEDIT(L))return a;const k=a.findIndex(x=>x&&x.label==='Styles de calque…');a.splice(k<0?a.length:k+1,0,MI(L.txt?'Rastériser le texte':'Rastériser la forme',{fn:()=>{S.doc.active=i;rasterMeta()}}));return a}}
/* -- a refused "merge down" must not strip the text, shape or styles of the layers it looked at -- */
{const _md=mergeDown;mergeDown=function(){const d=S.doc;if(!d)return _md.apply(this,arguments);const i=d.active,ls=[d.layers[i],d.layers[i-1]].filter(Boolean);
   const sv=ls.map(L=>({L,txt:L.txt,shp:L.shp,fx:L.fx,canvas:L.canvas})),h0=S.history[S.hi],n0=d.layers.length;
   const r=_md.apply(this,arguments);
   if(S.doc===d&&d.layers.length===n0&&S.history[S.hi]===h0)sv.forEach(s=>{const L=s.L;if(s.txt!==undefined)L.txt=s.txt;if(s.shp!==undefined)L.shp=s.shp;L.fx=s.fx;L.canvas=s.canvas;});
   return r}}

