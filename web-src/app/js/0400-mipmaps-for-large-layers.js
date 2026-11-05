/* ================= mipmaps for large layers ================= */
const MIP=new WeakMap();
function mipLevel(src,scale){if(scale>=0.5||src.width*src.height<4e6)return src;let e=MIP.get(src);if(!e){e=[];MIP.set(src,e)}
  let cur=src,k=0;while(scale<0.5/(1<<k)&&cur.width>64&&cur.height>64){let n=e[k];if(!n){n=mk(Math.max(1,cur.width>>1),Math.max(1,cur.height>>1));const g=cx(n);g.imageSmoothingQuality='high';g.drawImage(cur,0,0,n.width,n.height);e[k]=n}cur=n;k++}return cur}
/* pendant un trait, le calque « vivant » change à chaque image. Réduire une photo de 24 Mpx en « haute qualité » oblige le navigateur à refaire toute sa pyramide à chaque image (près de 30 ms ici).
   On garde donc la pyramide nous-mêmes et on ne remet à jour que la zone touchée, chaque niveau étant le niveau du dessus réduit de moitié exactement (échantillonnage « low » : moyenne de 2 × 2 pixels, sans pyramide interne). */
function mipRegion(src,x,y,w,h){const e=MIP.get(src);if(!e||!e.length)return;let cur=src,x0=x-2,y0=y-2,x1=x+w+2,y1=y+h+2;
  for(let k=0;k<e.length;k++){const n=e[k];if(!n)break;const fx=cur.width/n.width,fy=cur.height/n.height;
    const nx0=Math.max(0,Math.floor(x0/fx)-1),ny0=Math.max(0,Math.floor(y0/fy)-1),nx1=Math.min(n.width,Math.ceil(x1/fx)+1),ny1=Math.min(n.height,Math.ceil(y1/fy)+1);
    if(nx1<=nx0||ny1<=ny0)break;const g=cx(n);g.globalCompositeOperation='source-over';g.globalAlpha=1;g.imageSmoothingEnabled=true;g.imageSmoothingQuality='low';
    g.clearRect(nx0,ny0,nx1-nx0,ny1-ny0);g.drawImage(cur,nx0*fx,ny0*fy,(nx1-nx0)*fx,(ny1-ny0)*fy,nx0,ny0,nx1-nx0,ny1-ny0);
    cur=n;x0=nx0;y0=ny0;x1=nx1;y1=ny1}}
function drawMip(g,src,x,y,scale,ok){if(src.__sp){x+=src.__sx;y+=src.__sy}const s=ok?mipLevel(src,scale):src,q=src.__live?g.imageSmoothingQuality:null;if(q)g.imageSmoothingQuality='low';
  if(s===src)g.drawImage(src,x,y);else g.drawImage(s,0,0,s.width,s.height,x,y,src.width,src.height);if(q)g.imageSmoothingQuality=q}
function mipForget(){const L=AL();if(L&&L.kind==='pixel'){lcv(L)&&MIP.delete(lcv(L));L.mask&&MIP.delete(L.mask)}const st=S.stroke;if(st&&st.layer){lcv(st.layer)&&MIP.delete(lcv(st.layer));st.layer.mask&&MIP.delete(st.layer.mask)}}

