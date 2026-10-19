/* ================= mipmaps for large layers ================= */
const MIP=new WeakMap();
function mipLevel(src,scale){if(scale>=0.5||src.width*src.height<4e6)return src;let e=MIP.get(src);if(!e){e=[];MIP.set(src,e)}
  let cur=src,k=0;while(scale<0.5/(1<<k)&&cur.width>64&&cur.height>64){let n=e[k];if(!n){n=mk(Math.max(1,cur.width>>1),Math.max(1,cur.height>>1));const g=cx(n);g.imageSmoothingQuality='high';g.drawImage(cur,0,0,n.width,n.height);e[k]=n}cur=n;k++}return cur}
function drawMip(g,src,x,y,scale,ok){const s=ok?mipLevel(src,scale):src;if(s===src)g.drawImage(src,x,y);else g.drawImage(s,0,0,s.width,s.height,x,y,src.width,src.height)}
function mipForget(){const L=AL();if(L&&L.kind==='pixel'){L.canvas&&MIP.delete(L.canvas);L.mask&&MIP.delete(L.mask)}const st=S.stroke;if(st&&st.layer){st.layer.canvas&&MIP.delete(st.layer.canvas);st.layer.mask&&MIP.delete(st.layer.mask)}}

