/* ================= wave 3: working colour space (sRGB / Display P3) ================= */
function setCS(cs){cs=cs==='display-p3'&&P3_OK?'display-p3':'srgb';if(cs===CS&&work._cs===(cs==='srgb'?undefined:cs))return;CS=cs;
  for(const k in scratch)delete scratch[k];work=mk(1,1);wctx=rx(work);workB=mk(1,1);stackCache.c=null;stackCache.key='';flatCache={key:'',c:null};S.contentDirty=true}
function srgbC(c){if(!c||!c._cs)return c;const o=document.createElement('canvas');o.width=c.width;o.height=c.height;o.getContext('2d').drawImage(c,0,0);return o}
GPU.space=gl=>{const cs=CS==='display-p3'?'display-p3':'srgb';try{if('drawingBufferColorSpace' in gl&&gl.drawingBufferColorSpace!==cs)gl.drawingBufferColorSpace=cs;if('unpackColorSpace' in gl&&gl.unpackColorSpace!==cs)gl.unpackColorSpace=cs}catch(e){}};
function convertSpace(cs){const d=S.doc;if(!d)return;if(cs==='display-p3'&&!P3_OK){toast('Ce navigateur ne gère pas encore le Display P3 (essayez Chrome, Edge ou Safari)',5000);return}
  if((d.space||'srgb')===cs){toast('Le document est déjà dans cet espace');return}
  setCS(cs);const conv=c=>{if(!c)return c;const n=mk(c.width,c.height);cx(n).drawImage(c,0,0);return n};
  d.layers.forEach(L=>{if(L.canvas)L.canvas=conv(L.canvas)});d.space=CS;markComp();pushHistory(cs==='display-p3'?'Convertir en Display P3':'Convertir en sRGB');updateDocName();
  toast(cs==='display-p3'?'Espace de travail Display P3 : couleurs plus étendues, exportées avec leur profil':'Espace de travail sRGB : les couleurs hors gamut ont été ramenées',5000)}

