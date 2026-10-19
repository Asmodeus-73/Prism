/* ================= float blur (CPU fallback & tools) ================= */
function boxesForGauss(s,n){const wI=Math.sqrt(12*s*s/n+1);let wl=Math.floor(wI);if(wl%2===0)wl--;const wu=wl+2;const m=Math.round((12*s*s-n*wl*wl-4*n*wl-3*n)/(-4*wl-4));const r=[];for(let i=0;i<n;i++)r.push(i<m?wl:wu);return r}
function boxH(s,d,w,h,r){const inv=1/(2*r+1);for(let y=0;y<h;y++){const o=y*w;let a=0;for(let k=-r;k<=r;k++)a+=s[o+(k<0?0:k>w-1?w-1:k)];for(let x=0;x<w;x++){d[o+x]=a*inv;let p=x+r+1,q=x-r;if(p>w-1)p=w-1;if(q<0)q=0;a+=s[o+p]-s[o+q]}}}
function boxV(s,d,w,h,r){const inv=1/(2*r+1);for(let x=0;x<w;x++){let a=0;for(let k=-r;k<=r;k++)a+=s[(k<0?0:k>h-1?h-1:k)*w+x];for(let y=0;y<h;y++){d[y*w+x]=a*inv;let p=y+r+1,q=y-r;if(p>h-1)p=h-1;if(q<0)q=0;a+=s[p*w+x]-s[q*w+x]}}}
function gaussF(src,w,h,s){if(s<0.35)return src;const a=Float32Array.from(src),b=new Float32Array(src.length);for(const bs of boxesForGauss(s,3)){const r=(bs-1)>>1;if(r<1)continue;boxH(a,b,w,h,r);boxV(b,a,w,h,r)}return a}
function blurCanvas(src,r){const w=src.width,h=src.height;if(r<0.3)return cloneC(src);
  if(filterOK()){const p=Math.ceil(r*3)+2,big=mk(w+2*p,h+2*p),b=cx(big);b.drawImage(src,p,p);b.drawImage(src,0,0,1,h,0,p,p,h);b.drawImage(src,w-1,0,1,h,w+p,p,p,h);b.drawImage(big,0,p,w+2*p,1,0,0,w+2*p,p);b.drawImage(big,0,h+p-1,w+2*p,1,0,h+p,w+2*p,p);
    const o=mk(w+2*p,h+2*p),oc=cx(o);oc.filter=`blur(${r}px)`;oc.drawImage(big,0,0);const res=mk(w,h);cx(res).drawImage(o,p,p,w,h,0,0,w,h);return res}
  const c=cloneC(src),g=rx(c),img=g.getImageData(0,0,w,h),d=img.data,n=w*h,fa=new Float32Array(n);for(let i=0;i<n;i++)fa[i]=d[i*4+3];const qa=gaussF(fa,w,h,r);for(let ch=0;ch<3;ch++){const f=new Float32Array(n);for(let i=0;i<n;i++)f[i]=d[i*4+ch]*d[i*4+3]*(1/255);const q=gaussF(f,w,h,r);for(let i=0;i<n;i++){const a=qa[i];if(a>0.5)d[i*4+ch]=q[i]*255/a}}for(let i=0;i<n;i++)d[i*4+3]=qa[i];g.putImageData(img,0,0);return c}
function resample(src,w,h){let c=src;while(c.width/2>=w&&c.height/2>=h){const n=mk(c.width/2,c.height/2),g=cx(n);g.imageSmoothingQuality='high';g.drawImage(c,0,0,n.width,n.height);c=n}const o=mk(w,h),g=cx(o);g.imageSmoothingQuality='high';g.drawImage(c,0,0,w,h);return o}

