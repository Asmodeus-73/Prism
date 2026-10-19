/* ================= selection ================= */
function selChanged(){S.selVer++;requestRender()}
function maskBBox(c){const w=c.width,h=c.height,a=rx(c).getImageData(0,0,w,h).data;let x0=w,y0=h,x1=-1,y1=-1;for(let y=0;y<h;y++){const o=y*w;for(let x=0;x<w;x++)if(a[(o+x)*4+3]>8){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}}return x1<0?null:{x0,y0,x1:x1+1,y1:y1+1}}
function combineSel(mask,mode,label){const d=S.doc;let res;if(mode==='new'||!d.sel){if((mode==='sub'||mode==='int')&&!d.sel)return;res=mask}else{res=cloneC(d.sel);const g=cx(res);g.globalCompositeOperation=mode==='add'?'source-over':mode==='sub'?'destination-out':'destination-in';g.drawImage(mask,0,0)}
  d.sel=maskBBox(res)?res:null;selChanged();pushHistory(d.sel?(label||'Sélection'):'Désélection')}
const featherMask=(m,r)=>r>0.3?blurCanvas(m,r):m;
function selectAll(){const d=S.doc;if(!d)return;d.sel=fullMask();selChanged();pushHistory('Tout sélectionner')}
function deselect(){const d=S.doc;if(!d||!d.sel)return;d.sel=null;selChanged();pushHistory('Désélection')}
function invertSel(){const d=S.doc;if(!d)return;const m=fullMask();if(d.sel){const g=cx(m);g.globalCompositeOperation='destination-out';g.drawImage(d.sel,0,0)}d.sel=maskBBox(m)?m:null;selChanged();pushHistory('Intervertir la sélection')}
let wandCache={key:'',data:null};
function wandAt(px,py,mode){const d=S.doc,o=S.opts.wand;px=Math.floor(px);py=Math.floor(py);if(px<0||py<0||px>=d.w||py>=d.h)return;const T=pixelTarget();if(!o.all&&!T)return;
  const key=S.docVer+'|'+(o.all?'all':T.id);if(wandCache.key!==key){const src=o.all?flatSync():T.canvas;wandCache={key,data:rx(cloneC(src)).getImageData(0,0,d.w,d.h).data}}
  const a=wandCache.data,W=d.w,H=d.h,tol=o.tol,j0=(py*W+px)*4,r0=a[j0],g0=a[j0+1],b0=a[j0+2],a0=a[j0+3];const ok=i=>{const j=i*4;return Math.abs(a[j]-r0)<=tol&&Math.abs(a[j+1]-g0)<=tol&&Math.abs(a[j+2]-b0)<=tol&&Math.abs(a[j+3]-a0)<=tol};
  const m=new Uint8Array(W*H);if(o.contiguous){const st=[py*W+px];while(st.length){let i=st.pop();if(m[i])continue;const y=(i/W)|0;let x=i-y*W;while(x>0&&!m[i-1]&&ok(i-1)){x--;i--}let up=false,dn=false;while(x<W&&!m[i]&&ok(i)){m[i]=1;if(y>0){const u=i-W;if(!m[u]&&ok(u)){if(!up){st.push(u);up=true}}else up=false}if(y<H-1){const v=i+W;if(!m[v]&&ok(v)){if(!dn){st.push(v);dn=true}}else dn=false}x++;i++}}}else for(let i=0;i<W*H;i++)if(ok(i))m[i]=1;
  combineSel(maskFromU8(m,W,H),mode,'Baguette magique')}
function maskFromU8(m,W,H,scale255){const c=mk(W,H),g=cx(c),img=g.createImageData(W,H),dd=img.data;for(let i=0;i<W*H;i++){const v=scale255?m[i]:(m[i]?255:0);if(v){const j=i*4;dd[j]=dd[j+1]=dd[j+2]=255;dd[j+3]=v}}g.putImageData(img,0,0);return c}

