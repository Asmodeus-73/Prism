/* ================= copy / paste settings ================= */
let LOOK=null;
function captureLook(withLocal){const d=S.doc;return{layers:d.layers.filter(L=>L.kind==='adjust'&&(withLocal||!L.mask)).map(L=>({name:L.name,dev:JSON.parse(JSON.stringify(L.dev)),opacity:L.opacity,visible:L.visible!==false,mask:L.mask?{c:L.mask,w:d.w,h:d.h}:null}))}}
function pasteLook(look,opts={}){const d=S.doc;if(!look||!look.layers.length)return 0;let n=0;
  for(const l of look.layers){let mask=null;if(l.mask){mask=resample(l.mask.c,d.w,d.h)}const L=newAdjust(l.name,mask);L.dev=JSON.parse(JSON.stringify(l.dev));L.opacity=l.opacity;L.visible=l.visible;
    // the base "Réglages" layer of a fresh photo is replaced rather than stacked
    const base=d.layers.findIndex(x=>x.kind==='adjust'&&!x.mask&&devIsId(x.dev));if(!l.mask&&base>=0&&n===0){d.layers[base]={...L,name:d.layers[base].name};}else d.layers.push(L);n++}
  d.active=d.layers.length-1;markComp();if(!opts.silent){pushHistory('Coller les réglages');syncAll()}return n}
function copyLookCmd(){const d=S.doc;if(!d)return;const loc=d.layers.some(L=>L.kind==='adjust'&&L.mask);LOOK=captureLook(true);toast(`${LOOK.layers.length} calque${LOOK.layers.length>1?'s':''} de réglage copié${LOOK.layers.length>1?'s':''}${loc?' (les masques locaux seront redimensionnés)':''}`)}
function pasteLookCmd(){if(!LOOK){toast('Copiez d’abord les réglages d’une photo');return}const n=pasteLook(LOOK);toast(n+' réglage'+(n>1?'s':'')+' collé'+(n>1?'s':''))}

