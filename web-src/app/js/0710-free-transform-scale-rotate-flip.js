/* ================= v19: free transform (scale, rotate, flip, perspective, warp) ================= */
(()=>{
const TO=S.opts.transform={mode:'free',prop:true};
const V=(x,y)=>({x,y}),sub=(a,b)=>V(a.x-b.x,a.y-b.y),add=(a,b)=>V(a.x+b.x,a.y+b.y),mul=(a,k)=>V(a.x*k,a.y*k),dot=(a,b)=>a.x*b.x+a.y*b.y,len=a=>Math.hypot(a.x,a.y);
function homography(q,w,h){ // unit rect (0..w,0..h) -> quad q (tl,tr,br,bl)
 const x0=q[0].x,y0=q[0].y,x1=q[1].x,y1=q[1].y,x2=q[2].x,y2=q[2].y,x3=q[3].x,y3=q[3].y;
 const dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3,dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3;let a,b,c,d,e,f,g,hh;
 if(Math.abs(dx3)<1e-9&&Math.abs(dy3)<1e-9){a=x1-x0;b=x2-x1;c=x0;d=y1-y0;e=y2-y1;f=y0;g=0;hh=0}
 else{const den=dx1*dy2-dx2*dy1;g=(dx3*dy2-dx2*dy3)/den;hh=(dx1*dy3-dx3*dy1)/den;a=x1-x0+g*x1;b=x3-x0+hh*x3;c=x0;d=y1-y0+g*y1;e=y3-y0+hh*y3;f=y0}
 return(u,v)=>{const s=u/w,t=v/h,den=g*s+hh*t+1;return V((a*s+b*t+c)/den,(d*s+e*t+f)/den)}}
const lag=(p0,p1,p2,u)=>add(add(mul(p0,2*(u-.5)*(u-1)),mul(p1,-4*u*(u-1))),mul(p2,2*u*(u-.5)));
function meshPoint(M,s,t){const r=[0,1,2].map(i=>lag(M[i][0],M[i][1],M[i][2],s));return lag(r[0],r[1],r[2],t)}
function tri(g,img,s0,s1,s2,d0,d1,d2){const den=(s1.x-s0.x)*(s2.y-s0.y)-(s2.x-s0.x)*(s1.y-s0.y);if(Math.abs(den)<1e-9)return;
 const a=((d1.x-d0.x)*(s2.y-s0.y)-(d2.x-d0.x)*(s1.y-s0.y))/den,c=((d2.x-d0.x)*(s1.x-s0.x)-(d1.x-d0.x)*(s2.x-s0.x))/den,b=((d1.y-d0.y)*(s2.y-s0.y)-(d2.y-d0.y)*(s1.y-s0.y))/den,d=((d2.y-d0.y)*(s1.x-s0.x)-(d1.y-d0.y)*(s2.x-s0.x))/den,e=d0.x-a*s0.x-c*s0.y,f=d0.y-b*s0.x-d*s0.y;
 const cen=V((d0.x+d1.x+d2.x)/3,(d0.y+d1.y+d2.y)/3),ex=p=>{const v=sub(p,cen),l=len(v)||1;return add(p,mul(v,.9/l))};
 g.save();g.beginPath();const e0=ex(d0),e1=ex(d1),e2=ex(d2);g.moveTo(e0.x,e0.y);g.lineTo(e1.x,e1.y);g.lineTo(e2.x,e2.y);g.closePath();g.clip();g.setTransform(a,b,c,d,e,f);g.drawImage(img,0,0);g.restore()}
const isPara=q=>Math.hypot(q[0].x+q[2].x-q[1].x-q[3].x,q[0].y+q[2].y-q[1].y-q[3].y)<.01;
function drawWarped(g,img,T){const w=img.width,h=img.height,q=T.q;g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
 if(T.mode!=='warp'&&isPara(q)){g.save();g.setTransform((q[1].x-q[0].x)/w,(q[1].y-q[0].y)/w,(q[3].x-q[0].x)/h,(q[3].y-q[0].y)/h,q[0].x,q[0].y);g.drawImage(img,0,0);g.restore();return}
 const N=T.mode==='warp'?18:14,H=homography(q,w,h),P=(i,j)=>{const u=i/N,v=j/N;return T.mode==='warp'?meshPoint(T.mesh,u,v):H(u*w,v*h)};
 const grid=[];for(let j=0;j<=N;j++){grid[j]=[];for(let i=0;i<=N;i++)grid[j][i]=P(i,j)}
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const s00=V(i/N*w,j/N*h),s10=V((i+1)/N*w,j/N*h),s01=V(i/N*w,(j+1)/N*h),s11=V((i+1)/N*w,(j+1)/N*h);tri(g,img,s00,s10,s01,grid[j][i],grid[j][i+1],grid[j+1][i]);tri(g,img,s10,s11,s01,grid[j][i+1],grid[j+1][i+1],grid[j+1][i])}}
// ---------- session ----------
S.tf=null;let prevTool='move';
function bboxOf(c){return maskBBox(c)}
function tfStart(){const d=S.doc;if(!d)return false;const L=AL();if(!L||L.kind!=='pixel'||L.editMask){toast('Sélectionnez un calque de pixels à transformer.');return false}
 if(L.visible===false){toast('Ce calque est masqué');return false}
 let bb,src,base=null,selMask=null;
 if(d.sel){const sb=maskBBox(d.sel);if(!sb){toast('Sélection vide.');return false}bb=sb;selMask=d.sel;src=mk(bb.x1-bb.x0,bb.y1-bb.y0);const g=cx(src);g.drawImage(L.canvas,-bb.x0,-bb.y0);g.globalCompositeOperation='destination-in';g.drawImage(d.sel,-bb.x0,-bb.y0);base=cloneC(L.canvas);const bg=cx(base);bg.globalCompositeOperation='destination-out';bg.drawImage(d.sel,0,0)}
 else{bb=bboxOf(L.canvas);if(!bb){toast('Ce calque est vide.');return false}src=mk(bb.x1-bb.x0,bb.y1-bb.y0);cx(src).drawImage(L.canvas,-bb.x0,-bb.y0)}
 const w=src.width,h=src.height,q=[V(bb.x0,bb.y0),V(bb.x0+w,bb.y0),V(bb.x0+w,bb.y0+h),V(bb.x0,bb.y0+h)];
 let msrc=null;if(!selMask&&L.mask){msrc=mk(bb.x1-bb.x0,bb.y1-bb.y0);cx(msrc).drawImage(L.mask,-bb.x0,-bb.y0)}
 S.tf={L,src,base,selMask,msrc,bb,w,h,q,dw:d.w,dh:d.h,q0:q.map(p=>({...p})),mode:TO.mode,mesh:null,angle:0,hi:!!L.hi,drag:null};tfMesh(S.tf);tfPreview();return true}
function tfMesh(T){const q=T.q,m=[];for(let j=0;j<3;j++){m[j]=[];for(let i=0;i<3;i++){const s=i/2,t=j/2,top=add(mul(q[0],1-s),mul(q[1],s)),bot=add(mul(q[3],1-s),mul(q[2],s));m[j][i]=add(mul(top,1-t),mul(bot,t))}}T.mesh=m}
let raf=0;function tfPreview(){const T=S.tf;if(!T)return;if(raf)return;raf=requestAnimationFrame(()=>{raf=0;const T=S.tf;if(!T)return;const d=S.doc,c=mk(d.w,d.h),g=cx(c);if(T.base)g.drawImage(T.base,0,0);drawWarped(g,T.src,T);T.L.preview=c;if(T.msrc){const mc=mk(d.w,d.h);drawWarped(cx(mc),T.msrc,T);T.L.maskPreview=mc}markComp();requestRender()})}
function tfCancel(){const T=S.tf;if(!T)return;delete T.L.preview;delete T.L.maskPreview;S.tf=null;markComp();requestRender();renderPill()}
function tfApply(){const T=S.tf;if(!T)return;const d=S.doc,L=T.L;if(!d||!d.layers.includes(L)||!T.dw||T.dw!==d.w||T.dh!==d.h){tfCancel();return}if(raf){cancelAnimationFrame(raf);raf=0}
 const changed=T.q.some((p,i)=>Math.hypot(p.x-T.q0[i].x,p.y-T.q0[i].y)>.01)||(T.mode==='warp'&&T.warped);if(!changed){tfCancel();return}
 const c=mk(d.w,d.h),g=cx(c);if(T.base)g.drawImage(T.base,0,0);drawWarped(g,T.src,T);delete L.preview;delete L.maskPreview;
 const affine=T.mode!=='warp'&&isPara(T.q)&&!T.selMask;let e=null;if(L.hi){if(affine)e=effHi(L)}
 L.canvas=c;
 if(L.hi){if(affine&&e){const q=T.q,M=new DOMMatrix([(q[1].x-q[0].x)/T.w,(q[1].y-q[0].y)/T.w,(q[3].x-q[0].x)/T.h,(q[3].y-q[0].y)/T.h,q[0].x,q[0].y]).translate(-T.bb.x0,-T.bb.y0);hiXform(L,e,d.w,d.h,d.w,d.h,M)}else{L.hi=null;L.hiC=null;toast('Cette transformation a converti le calque en 8 bits.')}}
 if(T.msrc){const mc=mk(d.w,d.h);drawWarped(cx(mc),T.msrc,T);L.mask=mc}
 if(T.selMask){const sm=mk(d.w,d.h),sg=cx(sm);const ms=mk(T.w,T.h);cx(ms).drawImage(d.sel,-T.bb.x0,-T.bb.y0);drawWarped(sg,ms,T);d.sel=sm;selChanged()}
 if(L.txt||L.shp){L.txt=null;L.shp=null}
 S.tf=null;markComp();pushHistory('Transformation libre');syncLayers();renderPill()}
// ---------- interaction ----------
const toS=p=>V(S.panX+p.x*S.zoom,S.panY+p.y*S.zoom),centerOf=q=>V((q[0].x+q[1].x+q[2].x+q[3].x)/4,(q[0].y+q[1].y+q[2].y+q[3].y)/4);
function handles(T){const q=T.q;if(T.mode==='warp'){const o=[];for(let j=0;j<3;j++)for(let i=0;i<3;i++)o.push({k:'m'+j+i,p:T.mesh[j][i]});return o}
 const o=[{k:'c0',p:q[0]},{k:'c1',p:q[1]},{k:'c2',p:q[2]},{k:'c3',p:q[3]}];if(T.mode==='free')o.push({k:'e0',p:mul(add(q[0],q[1]),.5)},{k:'e1',p:mul(add(q[1],q[2]),.5)},{k:'e2',p:mul(add(q[2],q[3]),.5)},{k:'e3',p:mul(add(q[3],q[0]),.5)});return o}
function inQuad(p,q){let s=0,n=0;for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4],cr=(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);if(cr>0)s++;else if(cr<0)n++}return s===0||n===0}
function hit(T,p){const sp=toS(p);for(const h of handles(T)){const hp=toS(h.p);if(Math.hypot(hp.x-sp.x,hp.y-sp.y)<=10)return h.k}
 if(inQuad(p,T.q))return'move';if(T.mode==='free'){for(let i=0;i<4;i++){const hp=toS(T.q[i]);if(Math.hypot(hp.x-sp.x,hp.y-sp.y)<=34)return'rot'}}return null}
function basis(q){const U=mul(add(sub(q[1],q[0]),sub(q[2],q[3])),.5),W=mul(add(sub(q[3],q[0]),sub(q[2],q[1])),.5);return[U,W]}
function coords(v,U,W){const det=U.x*W.y-U.y*W.x||1e-9;return[(v.x*W.y-v.y*W.x)/det,(U.x*v.y-U.y*v.x)/det]}
function scaleAbout(T,pivot,su,sv){const[U,W]=basis(T.q0s);T.q=T.q0s.map(p=>{const[a,b]=coords(sub(p,pivot),U,W);return add(pivot,add(mul(U,a*su),mul(W,b*sv)))})}
function tfDown(e,p){const T=S.tf;if(!T)return false;const k=hit(T,p);if(!k)return true;T.drag={k,s:V(p.x,p.y),q0s:T.q.map(x=>({...x})),mesh0:T.mesh.map(r=>r.map(x=>({...x}))),ang0:T.angle,alt:e.altKey};T.q0s=T.drag.q0s;S.drag={type:'tf'};return true}
function tfMove(e,p){const T=S.tf;if(!T||!T.drag)return;const D=T.drag,k=D.k,dv=sub(p,D.s);
 if(k==='move'){T.q=D.q0s.map(x=>add(x,dv));if(T.mode==='warp')T.mesh=D.mesh0.map(r=>r.map(x=>add(x,dv)))}
 else if(k==='rot'){const c=centerOf(D.q0s),a0=Math.atan2(D.s.y-c.y,D.s.x-c.x);let da=Math.atan2(p.y-c.y,p.x-c.x)-a0;if(e.shiftKey)da=Math.round(da/(Math.PI/12))*(Math.PI/12);const cs=Math.cos(da),sn=Math.sin(da),R=x=>{const v=sub(x,c);return V(c.x+v.x*cs-v.y*sn,c.y+v.x*sn+v.y*cs)};T.q=D.q0s.map(R);T.angle=D.ang0+da*180/Math.PI}
 else if(k[0]==='m'){const j=+k[1],i=+k[2];T.mesh[j][i]=add(D.mesh0[j][i],dv);T.warped=true}
 else if(T.mode==='persp'&&k[0]==='c'){const i=+k[1];T.q=D.q0s.map((x,n)=>n===i?add(x,dv):x)}
 else if(k[0]==='c'){const i=+k[1],pivot=D.alt?centerOf(D.q0s):D.q0s[(i+2)%4],[U,W]=basis(D.q0s),v0=sub(D.q0s[i],pivot),v1=sub(p,pivot),[a0,b0]=coords(v0,U,W),[a1,b1]=coords(v1,U,W);let su=Math.abs(a0)>1e-6?a1/a0:1,sv=Math.abs(b0)>1e-6?b1/b0:1;if(TO.prop!==e.shiftKey){const s=Math.max(Math.abs(su),Math.abs(sv))*Math.sign(su*sv>=0?su:Math.abs(su)>Math.abs(sv)?su:sv);su=sv=s}scaleAbout(T,pivot,su,sv)}
 else if(k[0]==='e'){const i=+k[1],a=D.q0s[i],b=D.q0s[(i+1)%4],mid=mul(add(a,b),.5),c=centerOf(D.q0s),pivot=D.alt?c:add(c,sub(c,mid)),[U,W]=basis(D.q0s),v0=sub(mid,pivot),v1=sub(p,pivot),[a0,b0]=coords(v0,U,W),[a1,b1]=coords(v1,U,W);let su=1,sv=1;if(i%2===0){sv=Math.abs(b0)>1e-6?b1/b0:1}else{su=Math.abs(a0)>1e-6?a1/a0:1}
  scaleAbout(T,pivot,su,sv)}
 if(T.mode!=='warp')tfMesh(T);else if(k!=='move'&&k[0]!=='m'){}tfPreview();syncPillNums()}
function tfUp(){const T=S.tf;if(T)T.drag=null}
function syncPillNums(){const r=$('#tfRot'),o=$('#tfRotV');if(r&&S.tf){const v=((S.tf.angle+180)%360+360)%360-180;r.value=v;if(o)o.textContent=v.toFixed(1)+'°'}}
function flip(h){const T=S.tf;if(!T)return;const c=centerOf(T.q);const F=p=>h?V(2*c.x-p.x,p.y):V(p.x,2*c.y-p.y);T.q=T.q.map(F);if(T.mode==='warp'&&T.mesh)T.mesh=T.mesh.map(r=>r.map(F));else tfMesh(T);T.angle=-T.angle;T.flipped=true;tfPreview();syncPillNums()}
function setRotation(deg){const T=S.tf;if(!T)return;const da=(deg-T.angle)*Math.PI/180,c=centerOf(T.q),cs=Math.cos(da),sn=Math.sin(da);const R=x=>{const v=sub(x,c);return V(c.x+v.x*cs-v.y*sn,c.y+v.x*sn+v.y*cs)};T.q=T.q.map(R);if(T.mode==='warp'&&T.mesh)T.mesh=T.mesh.map(r=>r.map(R));else tfMesh(T);T.angle=deg;tfPreview()}
function rot90(){const T=S.tf;if(!T)return;setRotation(T.angle+90)}
function resetTf(){const T=S.tf;if(!T)return;T.q=T.q0.map(p=>({...p}));T.angle=0;T.warped=false;tfMesh(T);tfPreview();renderPill()}
// ---------- hooks ----------
addTool('transform','Transformation libre','F',IC.transform,'move','taille, rotation, perspective');
const _st=setTool;setTool=function(t){const was=S.tool;if(S.tf&&t!=='transform'){tfApply()}
 if(t==='transform'){if(S.stroke)return;if(was!=='transform')prevTool=was;_st.call(this,t);if(!S.tf&&!tfStart()){_st.call(this,prevTool==='transform'?'move':prevTool)}else renderPill();return}
 return _st.apply(this,arguments)};
const _od=onDown;onDown=function(e,p){if(S.tool==='transform'&&e.button!==1&&!S.spaceDown){if(!S.tf)tfStart();if(S.tf&&tfDown(e,p))return;}_od(e,p)};
const _om=onMove;onMove=function(e,p){if(S.drag&&S.drag.type==='tf'){tfMove(e,p);return}_om(e,p)};
const _ou=onUp;onUp=function(e){if(S.drag&&S.drag.type==='tf'){S.drag=null;tfUp();return}_ou(e)};
view.addEventListener('pointermove',e=>{if(S.tool!=='transform'||!S.tf||S.drag)return;const p=S.pointer;if(!p)return;const k=hit(S.tf,{x:p.dx,y:p.dy});view.style.cursor=!k?'default':k==='move'?'move':k==='rot'?'alias':k[0]==='e'?(((+k[1])%2===0)?'ns-resize':'ew-resize'):k[0]==='m'?'grab':'nwse-resize'});
window.addEventListener('keydown',e=>{if(!S.tf)return;const t=e.target;if(t&&(/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)&&t.type!=='range'))return;if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();const prev=prevTool;tfApply();_st.call(window,prev==='transform'?'move':prev)}else if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();tfCancel();_st.call(window,prevTool==='transform'?'move':prevTool)}else if((e.ctrlKey||e.metaKey)&&(e.key==='z'||e.key==='Z')){e.preventDefault();e.stopImmediatePropagation();tfCancel();_st.call(window,prevTool==='transform'?'move':prevTool)}},true);
const _dov=drawOverlays;drawOverlays=function(c,pr){_dov.apply(this,arguments);const T=S.tf;if(!T||S.tool!=='transform')return;c.save();c.setTransform(pr,0,0,pr,0,0);const P=p=>toS(p);
 const q=T.q.map(P);c.beginPath();q.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.lineWidth=3;c.strokeStyle='rgba(0,0,0,.45)';c.stroke();c.lineWidth=1.2;c.strokeStyle='#fff';c.stroke();
 if(T.mode==='warp'){c.lineWidth=1;c.strokeStyle='rgba(255,255,255,.8)';for(let n=0;n<=8;n++){const s=n/8;c.beginPath();for(let m=0;m<=24;m++){const t=m/24,a=P(meshPoint(T.mesh,s,t));m?c.lineTo(a.x,a.y):c.moveTo(a.x,a.y)}c.stroke();c.beginPath();for(let m=0;m<=24;m++){const t=m/24,a=P(meshPoint(T.mesh,t,s));m?c.lineTo(a.x,a.y):c.moveTo(a.x,a.y)}c.stroke()}}
 else if(T.mode==='persp'||!isPara(T.q)){}
 for(const h of handles(T)){const a=P(h.p);c.beginPath();if(T.mode==='free'||T.mode==='warp')c.rect(a.x-4.5,a.y-4.5,9,9);else c.arc(a.x,a.y,5.5,0,7);c.fillStyle='#fff';c.fill();c.lineWidth=1;c.strokeStyle='#000';c.stroke()}
 const cc=P(centerOf(T.q));c.beginPath();c.moveTo(cc.x-6,cc.y);c.lineTo(cc.x+6,cc.y);c.moveTo(cc.x,cc.y-6);c.lineTo(cc.x,cc.y+6);c.strokeStyle='rgba(255,255,255,.8)';c.stroke();c.restore()};
const _pe=PILL_EXTRA;PILL_EXTRA=function(t,o){let h=_pe.apply(this,arguments)||'';
 if(t==='transform'){const T=S.tf,a=T?(((T.angle+180)%360+360)%360-180):0;h=seg('transform.mode',[['free','Libre'],['persp','Perspective'],['warp','Déformation']])+`<label>Rotation<input type="range" id="tfRot" min="-180" max="180" step="0.1" value="${a}"><span class="val" id="tfRotV">${a.toFixed(1)}°</span></label><label><input type="checkbox" data-chk="transform.prop" ${o.transform.prop?'checked':''}>Proportionnel</label><button class="btn sm" data-act="tfFlipH" title="Retourner horizontalement">⇄</button><button class="btn sm" data-act="tfFlipV" title="Retourner verticalement">⇅</button><button class="btn sm" data-act="tfRot90">90°</button><button class="btn sm" data-act="tfReset">Réinitialiser</button><button class="btn sm primary" data-act="tfApply">Appliquer</button><button class="btn sm" data-act="tfCancel">Annuler</button>`+h}
 return h};
Object.assign(PILL_ACT,{tfApply:()=>{const p=prevTool;tfApply();_st.call(window,p==='transform'?'move':p)},tfCancel:()=>{const p=prevTool;tfCancel();_st.call(window,p==='transform'?'move':p)},tfReset:resetTf,tfFlipH:()=>flip(true),tfFlipV:()=>flip(false),tfRot90:rot90});
document.addEventListener('input',e=>{if(e.target&&e.target.id==='tfRot'){const v=+e.target.value;setRotation(v);const o=$('#tfRotV');if(o)o.textContent=v.toFixed(1)+'°'}});
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-seg="transform.mode"]');if(b&&S.tf){const m=b.dataset.v;setTimeout(()=>{S.tf.mode=m;if(m==='warp')tfMesh(S.tf);else if(S.tf.warped){S.tf.warped=false;tfMesh(S.tf)}tfPreview()},0)}},true);
const _mie=MENU2.edit.items;MENU2.edit.items=()=>{const a=_mie();const i=a.findIndex(x=>x&&x.label&&/Copier/.test(x.label));a.splice(i<0?a.length:i,0,MI('Transformation libre',{kbd:'F',fn:()=>setTool('transform'),dis:!S.doc}),SEP);return a};
window.tfApply=tfApply;window.tfStart=tfStart;window.PrismTF={preview:tfPreview,mesh:tfMesh,cancel:tfCancel,apply:tfApply,sync:syncPillNums};
})();

