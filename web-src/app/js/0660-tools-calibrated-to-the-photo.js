/* ================= v15: tools calibrated to the photo (size vs resolution, [ ] keys, stabiliser, Shift straight line) ================= */
(()=>{
const BASE={heal:36,remove:46,clone:60,brush:30,eraser:40,dodge:90},AUTO={};
const longSide=()=>S.doc?Math.max(S.doc.w,S.doc.h):1800;
const factor=()=>clamp(longSide()/1800,1,6);
function scaleTools(){if(!S.doc||S.doc.__tsc)return;S.doc.__tsc=1;const f=factor();
 for(const k in BASE){const o=S.opts[k];if(!o)continue;const cur=AUTO[k]??BASE[k];if(Math.round(o.size)===cur){const n=Math.round(BASE[k]*f);o.size=n;AUTO[k]=n}}
 if(S.opts.brush.smooth==null)S.opts.brush.smooth=20;if(S.opts.eraser.smooth==null)S.opts.eraser.smooth=20;
 try{renderPill()}catch(e){}}
const _sd=setDoc;setDoc=function(){const r=_sd.apply(this,arguments);try{if(r&&typeof r.then==='function')r.then(scaleTools);else scaleTools()}catch(e){}return r};
if(S.opts.brush.smooth==null)S.opts.brush.smooth=20;if(S.opts.eraser.smooth==null)S.opts.eraser.smooth=20;
// size sliders follow the resolution of the photo
const _or=optRange;optRange=function(key,label,min,max,step,unit,scale){if(/\.size$/.test(key)){const lim=Math.max(max,Math.round(longSide()/4));max=lim}return _or.call(this,key,label,min,max,step,unit,scale)};
// [ ] change the size, Maj+[ ] the hardness
window.addEventListener('keydown',e=>{if(window.PAINTKEY&&PAINTKEY(e))return;if(e.key!=='['&&e.key!==']'&&e.key!=='{'&&e.key!=='}')return;if(e.ctrlKey||e.metaKey||e.altKey)return;const t=e.target;if(t&&(/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)||t.isContentEditable)&&t.type!=='range')return;
 if(!S.doc||(typeof LIB!=='undefined'&&LIB.open))return;const o=S.opts[S.tool];if(!o||o.size==null)return;
 e.preventDefault();e.stopImmediatePropagation();const up=e.key===']'||e.key==='}';
 if(e.shiftKey&&o.hardness!=null)o.hardness=clamp(Math.round((o.hardness+(up?.1:-.1))*10)/10,0,1);
 else o.size=clamp(Math.round(o.size*(up?1.12:1/1.12))+(up?1:-1),1,Math.max(600,Math.round(longSide()/3)));
 renderPill();requestRender()},true);
// stabiliser: the dab follows the pointer with a delay proportional to "Lissage"
const _ms=moveStroke;moveStroke=function(p,e){const st=S.stroke;if(st&&(st.tool==='brush'||st.tool==='eraser')){const k=(S.opts[st.tool].smooth||0)/100;if(k>0&&!st.noSm){const q=st.sm||(st.sm={x:st.last.x,y:st.last.y}),a=1-k*.93;q.x+=(p.x-q.x)*a;q.y+=(p.y-q.y)*a;p={x:q.x,y:q.y}}}return _ms.call(this,p,e)};
// Maj+clic: straight line from the end of the previous stroke
const _bs=beginStroke;beginStroke=function(p,e){const t=S.tool,lp=S.lastPt;
 if(e&&e.shiftKey&&(t==='brush'||t==='eraser')&&lp&&lp.doc===S.doc&&lp.tool===t&&lp.layer===S.doc.active){const r=_bs.call(this,{x:lp.x,y:lp.y},e);if(S.stroke){S.stroke.noSm=true;_ms.call(this,p,e)}return r}
 return _bs.apply(this,arguments)};
const _es=endStroke;endStroke=function(){const st=S.stroke;if(st&&(st.tool==='brush'||st.tool==='eraser'))S.lastPt={x:st.last.x,y:st.last.y,doc:S.doc,tool:st.tool,layer:S.doc.active};return _es.apply(this,arguments)};
const _pe=PILL_EXTRA;PILL_EXTRA=function(t,o){let h=_pe.apply(this,arguments)||'';
 if(t==='brush'||t==='eraser'){if(o[t].smooth==null)o[t].smooth=20;h=optRange(t+'.smooth','Lissage',0,100,1,' %')+h+`<span class="hint kbhint">[ ] taille, ⇧+[ ] dureté, ⇧+clic ligne droite</span>`}
 return h};
})();

