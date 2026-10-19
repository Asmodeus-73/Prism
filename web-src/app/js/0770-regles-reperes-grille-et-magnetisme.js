/* ===== wave31: règles, repères, grille et magnétisme ===== */
(()=>{
const RW=20;
const st={rulers:PREF.get('rulers',false),grid:PREF.get('grid',false),snap:PREF.get('snap',true)};
const G=()=>{const d=S.doc;if(!d)return null;return d.guides||(d.guides={v:[],h:[]})};
const NICE=[1,2,5,10,20,25,50,100,200,250,500,1000,2000,2500,5000,10000,20000];
const stepFor=(minPx)=>NICE.find(n=>n*S.zoom>=minPx)||20000;
let tint='#888';
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function paint(c,pr){
  const d=S.doc;if(!d)return;const W=view.width/pr,H=view.height/pr,z=S.zoom;
  c.setTransform(pr,0,0,pr,0,0);c.save();
  const X=x=>S.panX+x*z,Y=y=>S.panY+y*z,g=G();
  if(st.grid){const s=stepFor(40);c.beginPath();c.lineWidth=1;c.strokeStyle='rgba(140,160,255,.28)';
    const x0=Math.max(0,Math.ceil(-S.panX/z/s)*s),x1=Math.min(d.w,(W-S.panX)/z),y0=Math.max(0,Math.ceil(-S.panY/z/s)*s),y1=Math.min(d.h,(H-S.panY)/z);
    for(let x=x0;x<=x1;x+=s){const px=Math.round(X(x))+.5;c.moveTo(px,Math.max(0,Y(0)));c.lineTo(px,Math.min(H,Y(d.h)))}
    for(let y=y0;y<=y1;y+=s){const py=Math.round(Y(y))+.5;c.moveTo(Math.max(0,X(0)),py);c.lineTo(Math.min(W,X(d.w)),py)}
    c.stroke()}
  if(g&&(st.rulers||g.v.length||g.h.length)){c.beginPath();c.lineWidth=1;c.strokeStyle='#2fd4ff';
    g.v.forEach(x=>{const px=Math.round(X(x))+.5;c.moveTo(px,0);c.lineTo(px,H)});g.h.forEach(y=>{const py=Math.round(Y(y))+.5;c.moveTo(0,py);c.lineTo(W,py)});c.stroke()}
  const sl=S.snapLines;if(sl){c.beginPath();c.strokeStyle='#ff4fd8';c.lineWidth=1;(sl.v||[]).forEach(x=>{const px=Math.round(X(x))+.5;c.moveTo(px,0);c.lineTo(px,H)});(sl.h||[]).forEach(y=>{const py=Math.round(Y(y))+.5;c.moveTo(0,py);c.lineTo(W,py)});c.stroke()}
  if(st.rulers){
    const bg=css('--chrome')||'#1c1c1f',ln=css('--line-2')||'#3a3a40',fg=css('--fg-3')||'#888',fg2=css('--fg-2')||'#aaa';
    c.fillStyle=bg;c.globalAlpha=.94;c.fillRect(0,0,W,RW);c.fillRect(0,0,RW,H);c.globalAlpha=1;
    c.strokeStyle=ln;c.beginPath();c.moveTo(RW+.5,0);c.lineTo(RW+.5,H);c.moveTo(0,RW+.5);c.lineTo(W,RW+.5);c.stroke();
    const major=stepFor(70),minor=major/ (major%5===0&&major%10!==0?5:major===2||major===20||major===200?4:5);
    c.font='10px "Geist Mono",monospace';c.fillStyle=fg;c.textBaseline='top';c.strokeStyle=fg;c.lineWidth=1;
    const sx=Math.floor((RW-S.panX)/z/major)*major,ex=(W-S.panX)/z;
    c.beginPath();for(let v=sx;v<=ex;v+=major){const px=Math.round(X(v))+.5;if(px<RW)continue;c.moveTo(px,RW-9);c.lineTo(px,RW);}c.stroke();
    c.beginPath();for(let v=sx;v<=ex;v+=minor){const px=Math.round(X(v))+.5;if(px<RW)continue;c.moveTo(px,RW-4);c.lineTo(px,RW)}c.stroke();
    for(let v=sx;v<=ex;v+=major){const px=X(v);if(px<RW)continue;c.fillText(String(Math.round(v)),px+3,2)}
    const sy=Math.floor((RW-S.panY)/z/major)*major,ey=(H-S.panY)/z;
    c.beginPath();for(let v=sy;v<=ey;v+=major){const py=Math.round(Y(v))+.5;if(py<RW)continue;c.moveTo(RW-9,py);c.lineTo(RW,py)}c.stroke();
    c.beginPath();for(let v=sy;v<=ey;v+=minor){const py=Math.round(Y(v))+.5;if(py<RW)continue;c.moveTo(RW-4,py);c.lineTo(RW,py)}c.stroke();
    c.save();for(let v=sy;v<=ey;v+=major){const py=Y(v);if(py<RW)continue;c.save();c.translate(2,py+3);c.rotate(-Math.PI/2);c.textBaseline='top';c.textAlign='right';c.translate(0,0);c.fillText(String(Math.round(v)),0,0);c.restore()}c.restore();
    c.fillStyle=bg;c.fillRect(0,0,RW,RW);c.strokeStyle=ln;c.strokeRect(.5,.5,RW,RW)}
  c.restore()}
const _do=drawOverlays;
drawOverlays=function(c,pr){_do(c,pr);try{paint(c,pr)}catch(e){console.warn(e)}};
function bbox(L,d){const k=Math.min(1,512/Math.max(d.w,d.h)),w=Math.max(1,Math.round(d.w*k)),h=Math.max(1,Math.round(d.h*k)),t=mk(w,h);cx(t).drawImage(L.canvas,0,0,w,h);const a=rx(t).getImageData(0,0,w,h).data;let x0=w,y0=h,x1=-1,y1=-1;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(a[(y*w+x)*4+3]>8){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
  if(x1<0)return null;return{l:x0/k,t:y0/k,r:(x1+1)/k,b:(y1+1)/k}}
const scrPt=e=>{const r=view.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
const near=(arr,v,tol)=>{let b=null,bd=tol;arr.forEach(x=>{const dd=Math.abs(x-v);if(dd<=bd){bd=dd;b=x}});return b};
const _down=onDown;
onDown=function(e,p){const d=S.doc;
  if(d&&e.button===0&&!S.spaceDown){const[sx,sy]=scrPt(e),g=G();
    if(st.rulers&&(sx<RW||sy<RW)&&!(sx<RW&&sy<RW)){S.drag={type:'guide',axis:sx<RW?'v':'h',pos:sx<RW?p.x:p.y,isNew:true};S.snapLines=null;requestRender();return}
    if(S.tool==='move'&&g){const tol=5/S.zoom,gx=near(g.v,p.x,tol),gy=gx===null?near(g.h,p.y,tol):null;
      if(gx!==null){g.v.splice(g.v.indexOf(gx),1);S.drag={type:'guide',axis:'v',pos:gx};requestRender();return}
      if(gy!==null){g.h.splice(g.h.indexOf(gy),1);S.drag={type:'guide',axis:'h',pos:gy};requestRender();return}}}
  _down(e,p);
  const dr=S.drag;if(dr&&dr.type==='move'&&dr.L&&st.snap){try{dr.bb=bbox(dr.L,d)}catch(err){dr.bb=null}}};
const _move=onMove;
onMove=function(e,p){const dr=S.drag;
  if(dr&&dr.type==='guide'){dr.pos=dr.axis==='v'?p.x:p.y;if(e.shiftKey)dr.pos=Math.round(dr.pos);requestRender();return}
  _move(e,p);
  const d=S.doc;
  if(dr&&dr.type==='move'&&st.snap&&dr.bb&&d&&!e.altKey&&dr.L){
    const g=G(),tol=7/S.zoom,xs=[0,d.w/2,d.w,...g.v],ys=[0,d.h/2,d.h,...g.h],b=dr.bb;let dx=dr.L.dx||0,dy=dr.L.dy||0,sv=[],sh=[];
    const fit=(pts,list,cur)=>{let best=null,bd=tol;pts.forEach(q=>list.forEach(l=>{const dd=l-(q+cur);if(Math.abs(dd)<=bd){bd=Math.abs(dd);best={adj:dd,line:l}}}));return best};
    const fx=fit([b.l,(b.l+b.r)/2,b.r],xs,dx),fy=fit([b.t,(b.t+b.b)/2,b.b],ys,dy);
    if(fx){dx+=fx.adj;sv=[fx.line]}if(fy){dy+=fy.adj;sh=[fy.line]}
    dr.L.dx=Math.round(dx);dr.L.dy=Math.round(dy);if(dr.mates)dr.mates.forEach(m=>{m.dx=dr.L.dx;m.dy=dr.L.dy});
    S.snapLines=(sv.length||sh.length)?{v:sv,h:sh}:null;markComp();requestRender()}};
const _up=onUp;
onUp=function(){const dr=S.drag;
  if(dr&&dr.type==='guide'){S.drag=null;const d=S.doc,g=G(),lim=dr.axis==='v'?d.w:d.h;if(dr.pos>=0&&dr.pos<=lim){(dr.axis==='v'?g.v:g.h).push(Math.round(dr.pos*10)/10)}try{scheduleSave()}catch(e){}requestRender();return}
  S.snapLines=null;_up();requestRender()};
const _cd=cancelDrag;
cancelDrag=function(){const dr=S.drag;if(dr&&dr.type==='guide'){S.drag=null;requestRender();return}S.snapLines=null;_cd()};
/* repère en cours de glisser : tracé par-dessus */
const _do2=drawOverlays;
drawOverlays=function(c,pr){_do2(c,pr);const dr=S.drag;if(dr&&dr.type==='guide'){c.setTransform(pr,0,0,pr,0,0);c.strokeStyle='#2fd4ff';c.lineWidth=1;c.beginPath();if(dr.axis==='v'){const x=Math.round(S.panX+dr.pos*S.zoom)+.5;c.moveTo(x,0);c.lineTo(x,view.height/pr)}else{const y=Math.round(S.panY+dr.pos*S.zoom)+.5;c.moveTo(0,y);c.lineTo(view.width/pr,y)}c.stroke();
  c.fillStyle='#2fd4ff';c.font='11px "Geist Mono",monospace';const sx=dr.axis==='v'?S.panX+dr.pos*S.zoom+6:30,sy=dr.axis==='v'?30:S.panY+dr.pos*S.zoom-16;c.fillText(Math.round(dr.pos)+' px',sx,sy)}};
const tog=k=>{st[k]=!st[k];PREF.set(k,st[k]);requestRender()};
function guideDialog(){const d=S.doc;if(!d)return;
  dialog({title:'Nouveau repère',light:true,body:`<div class="dlg-grid"><label>Orientation<select id="gAx"><option value="v">Vertical</option><option value="h">Horizontal</option></select></label><label>Position (px)<input type="number" id="gPos" value="${Math.round(d.w/2)}" min="0" step="1"></label></div>`,
    onOpen:el=>{const a=$('#gAx',el),p=$('#gPos',el);a.onchange=()=>{p.value=Math.round(a.value==='v'?d.w/2:d.h/2)}},
    buttons:[{label:'Annuler'},{label:'Ajouter',primary:true,onClick:()=>{const a=$('#gAx').value,v=+$('#gPos').value;if(!(isFinite(v)&&v>=0&&v<=(a==='v'?S.doc.w:S.doc.h))){toast('Le repère doit être placé sur la photo');return false}{(a==='v'?G().v:G().h).push(Math.round(v));requestRender();try{scheduleSave()}catch(e){}}}}]})}
const clearGuides=()=>{const g=G();if(g){g.v.length=0;g.h.length=0;requestRender();try{scheduleSave()}catch(e){}}};
const _vi=MENU2.view.items;
MENU2.view.items=()=>[..._vi(),SEP,
  MI('Règles',{check:st.rulers,kbd:MOD+'⇧R',fn:()=>tog('rulers')}),
  MI('Grille',{check:st.grid,kbd:MOD+'\'',fn:()=>tog('grid')}),
  MI('Magnétisme (repères et bords)',{check:st.snap,fn:()=>tog('snap')}),
  MI('Nouveau repère…',{dis:S.doc?false:NODOC,fn:guideDialog}),
  MI('Effacer les repères',{dis:S.doc?false:NODOC,fn:clearGuides})];
document.addEventListener('keydown',e=>{const m=e.metaKey||e.ctrlKey;if(!m||e.altKey||$('#scrim')||(e.target.closest&&e.target.closest('input,textarea,select')))return;
  if(e.shiftKey&&(e.code==='KeyR')){e.preventDefault();e.stopPropagation();tog('rulers')}
  else if(!e.shiftKey&&(e.code==='Quote'||e.key==="'")){e.preventDefault();e.stopPropagation();tog('grid')}},true);
window.PrismGuides={st,G,tog,clearGuides};
})();

