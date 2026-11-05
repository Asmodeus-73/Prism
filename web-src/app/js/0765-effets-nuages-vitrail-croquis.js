/* ===== 1.0 : nouveaux effets (lot 3, d'après les idées de Pinta, réécrits pour Prism) =====
   Nuages, Fractale, Vitrail, Verre dépoli, Déformation organique, Inversion polaire, Croquis au crayon, Peinture à l'huile.
   Chacun est un filtre ordinaire : aperçu en direct, appliqué dans la sélection, et modifiable après coup (Filtre > Effets du calque). */
(()=>{
const px=s=>rx(s).getImageData(0,0,s.width,s.height);
const put=(w,h,im)=>{const c=mk(w,h);rx(c).putImageData(im,0,0);return c};
const P=(k,l,a,b,st,d,u,scl)=>{const q=[k,l,a,b,st,d,u];if(scl)q[7]=true;return q};
const luma=(d,i)=>d[i]*.299+d[i+1]*.587+d[i+2]*.114;
const rad=a=>a*Math.PI/180;
/* hasard reproductible : le même réglage donne toujours le même résultat (aperçu = résultat, effet rejouable) */
const hash=(x,y,s)=>{let h=(x*374761393+y*668265263+s*982451653)|0;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296};
const fade=t=>t*t*(3-2*t);
function vnoise(x,y,s){const xi=Math.floor(x),yi=Math.floor(y),fx=fade(x-xi),fy=fade(y-yi),a=hash(xi,yi,s),b=hash(xi+1,yi,s),c=hash(xi,yi+1,s),d=hash(xi+1,yi+1,s);return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy}
function fbm(x,y,oct,s,rough){let v=0,amp=1,tot=0,f=1;for(let o=0;o<oct;o++){v+=vnoise(x*f,y*f,s+o*17)*amp;tot+=amp;amp*=rough;f*=2}return v/tot}
/* champ de bruit calculé en petit puis agrandi : rapide même sur 45 Mpx, et doux */
function noiseField(w,h,scale,oct,seed,rough){const k=Math.min(1,900/Math.max(w,h)),sw=Math.max(2,Math.round(w*k)),sh=Math.max(2,Math.round(h*k)),c=mk(sw,sh),im=new ImageData(sw,sh),a=im.data,sc=scale*k;
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const v=fbm(x/sc,y/sc,oct,seed,rough)*255,j=(y*sw+x)*4;a[j]=a[j+1]=a[j+2]=v;a[j+3]=255}
  rx(c).putImageData(im,0,0);const o=mk(w,h),g=cx(o);g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(c,0,0,w,h);return o}
function hsl(h,s,l){h=((h%360)+360)%360/360;const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q,f=t=>{t=(t+1)%1;return t<1/6?p+(q-p)*6*t:t<.5?q:t<2/3?p+(q-p)*(2/3-t)*6:p};return[f(h+1/3),f(h),f(h-1/3)]}
const MODES=['source-over','multiply','screen','overlay','soft-light'];
function blendOver(s,top,mode,op){const o=cloneC(s),g=cx(o);g.globalCompositeOperation=MODES[mode]||'source-over';g.globalAlpha=op;g.drawImage(top,0,0);g.globalAlpha=1;g.globalCompositeOperation='destination-in';g.drawImage(s,0,0);return o}
function warpBy(src,map){const w=src.width,h=src.height,sd=px(src).data,o=new ImageData(w,h),od=o.data,q=[0,0];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){map(x,y,q);let sx=q[0],sy=q[1];if(sx<0)sx=0;else if(sx>w-1)sx=w-1;if(sy<0)sy=0;else if(sy>h-1)sy=h-1;
    const x0=sx|0,y0=sy|0,x1=x0+1<w?x0+1:x0,y1=y0+1<h?y0+1:y0,fx=sx-x0,fy=sy-y0,a=(y0*w+x0)*4,b=(y0*w+x1)*4,c=(y1*w+x0)*4,d=(y1*w+x1)*4,j=(y*w+x)*4,w00=(1-fx)*(1-fy),w10=fx*(1-fy),w01=(1-fx)*fy,w11=fx*fy;
    for(let k=0;k<4;k++)od[j+k]=sd[a+k]*w00+sd[b+k]*w10+sd[c+k]*w01+sd[d+k]*w11}
  return put(w,h,o)}

Object.assign(FILTERS,{
 clouds:{name:'Nuages',params:[P('sc','Taille des nuages',10,2000,1,260,' px',1),P('oct','Détail',1,8,1,6,''),P('r','Rugosité',20,80,1,52,' %'),P('h','Teinte (0 = gris)',0,360,1,0,'°'),P('mode','Mélange',0,4,1,3,''),P('op','Opacité',0,100,1,60,' %'),P('seed','Variante',1,99,1,7,'')],
  run:(s,p)=>{const w=s.width,h=s.height,n=noiseField(w,h,p.sc,p.oct,p.seed,p.r/100);if(p.h){const im=px(n),a=im.data,c=hsl(p.h,.6,.5);for(let i=0;i<a.length;i+=4){const v=a[i]/255;a[i]=255*Math.min(1,v*c[0]*2);a[i+1]=255*Math.min(1,v*c[1]*2);a[i+2]=255*Math.min(1,v*c[2]*2)}rx(n).putImageData(im,0,0)}
   return blendOver(s,n,p.mode,p.op/100)}},
 fractal:{name:'Fractale',params:[P('z','Zoom',50,800,1,140,' %'),P('cr','Forme',-100,100,1,-70,''),P('ci','Variante de forme',-100,100,1,27,''),P('h','Teinte',0,360,1,200,'°'),P('mode','Mélange',0,4,1,2,''),P('op','Opacité',0,100,1,70,' %')],
  run:(s,p)=>{const w=s.width,h=s.height,k=Math.min(1,1400/Math.max(w,h)),sw=Math.max(2,Math.round(w*k)),sh=Math.max(2,Math.round(h*k)),im=new ImageData(sw,sh),a=im.data,cr=p.cr/100,ci=p.ci/100,z=p.z/100,m=Math.min(sw,sh)/2;
   for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){let zr=(x-sw/2)/(m*z)*1.5,zi=(y-sh/2)/(m*z)*1.5,i=0;for(;i<120&&zr*zr+zi*zi<4;i++){const t=zr*zr-zi*zi+cr;zi=2*zr*zi+ci;zr=t}
     const v=i>=120?0:(i+1-Math.log2(Math.log2(zr*zr+zi*zi)/2||1))/120,c=hsl(p.h+v*300,.75,Math.min(.6,v*1.6)),j=(y*sw+x)*4;a[j]=c[0]*255;a[j+1]=c[1]*255;a[j+2]=c[2]*255;a[j+3]=255}
   const t=mk(sw,sh);rx(t).putImageData(im,0,0);const big=mk(w,h),g=cx(big);g.imageSmoothingQuality='high';g.drawImage(t,0,0,w,h);return blendOver(s,big,p.mode,p.op/100)}},
 stained:{name:'Vitrail',params:[P('s','Taille des cellules',4,300,1,64,' px',1),P('j','Épaisseur du plomb',0,20,.5,2,' px',1),P('v','Régularité',0,100,1,40,' %'),P('seed','Variante',1,99,1,3,'')],
  run:(s,p)=>{const w=s.width,h=s.height,cs=Math.max(3,p.s),gw=Math.ceil(w/cs)+1,gh=Math.ceil(h/cs)+1,jit=1-p.v/100,PX=new Float32Array(gw*gh),PY=new Float32Array(gw*gh);
   for(let gy=0;gy<gh;gy++)for(let gx=0;gx<gw;gx++){const i=gy*gw+gx;PX[i]=(gx+.5+(hash(gx,gy,p.seed)-.5)*jit)*cs;PY[i]=(gy+.5+(hash(gx,gy,p.seed+50)-.5)*jit)*cs}
   const sd=px(s).data,id=new Int32Array(w*h),d2=new Float32Array(w*h),sum=new Float64Array(gw*gh*4),cnt=new Uint32Array(gw*gh);
   for(let y=0;y<h;y++){const gy=Math.floor(y/cs);for(let x=0;x<w;x++){const gx=Math.floor(x/cs);let b=-1,bd=1e18,sb=1e18;
     for(let oy=-1;oy<=1;oy++){const yy=gy+oy;if(yy<0||yy>=gh)continue;for(let ox=-1;ox<=1;ox++){const xx=gx+ox;if(xx<0||xx>=gw)continue;const i=yy*gw+xx,dx=PX[i]-x,dy=PY[i]-y,dd=dx*dx+dy*dy;if(dd<bd){sb=bd;bd=dd;b=i}else if(dd<sb)sb=dd}}
     const q=y*w+x,j=q*4;id[q]=b;d2[q]=Math.sqrt(sb)-Math.sqrt(bd);sum[b*4]+=sd[j];sum[b*4+1]+=sd[j+1];sum[b*4+2]+=sd[j+2];sum[b*4+3]+=sd[j+3];cnt[b]++}}
   const o=new ImageData(w,h),a=o.data,lead=p.j;
   for(let q=0;q<w*h;q++){const b=id[q],n=cnt[b]||1,j=q*4,e=lead>0?Math.min(1,Math.max(0,(d2[q]-lead)/1.2)):1,glow=1+.12*Math.min(1,d2[q]/(cs*.5));
     const m=(sum[b*4]+sum[b*4+1]+sum[b*4+2])/(3*n);for(let k=0;k<3;k++)a[j+k]=Math.min(255,Math.max(0,(m+(sum[b*4+k]/n-m)*1.35)*glow))*e+18*(1-e);a[j+3]=sd[j+3]}
   return put(w,h,o)}},
 frosted:{name:'Verre dépoli',params:[P('r','Diffusion',1,60,1,6,' px',1),P('g','Grain',0,100,1,30,' %'),P('seed','Variante',1,99,1,1,'')],
  run:(s,p)=>{const w=s.width,h=s.height,sd=px(s).data,o=new ImageData(w,h),a=o.data,r=p.r,g=p.g/100*30;
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=Math.min(w-1,Math.max(0,Math.round(x+(hash(x,y,p.seed)-.5)*2*r))),sy=Math.min(h-1,Math.max(0,Math.round(y+(hash(x,y,p.seed+9)-.5)*2*r))),i=(sy*w+sx)*4,j=(y*w+x)*4,n=(hash(x,y,p.seed+31)-.5)*g;
     a[j]=Math.min(255,Math.max(0,sd[i]+n));a[j+1]=Math.min(255,Math.max(0,sd[i+1]+n));a[j+2]=Math.min(255,Math.max(0,sd[i+2]+n));a[j+3]=sd[i+3]}
   return blurCanvas(put(w,h,o),Math.max(.4,r/12))}},
 organic:{name:'Déformation organique',params:[P('a','Amplitude',1,200,1,18,' px',1),P('sc','Taille des vagues',10,1500,1,180,' px',1),P('oct','Détail',1,5,1,3,''),P('seed','Variante',1,99,1,5,'')],
  run:(s,p)=>{const w=s.width,h=s.height,nx=px(noiseField(w,h,p.sc,p.oct,p.seed,.5)).data,ny=px(noiseField(w,h,p.sc,p.oct,p.seed+40,.5)).data,A=p.a*2.2;
   return warpBy(s,(x,y,q)=>{const j=(y*w+x)*4;q[0]=x+(nx[j]/255-.5)*A;q[1]=y+(ny[j]/255-.5)*A})}},
 polar:{name:'Inversion polaire',params:[P('a','Intensité',1,100,1,40,' %'),P('x','Centre horizontal',0,100,1,50,' %'),P('y','Centre vertical',0,100,1,50,' %')],
  run:(s,p)=>{const w=s.width,h=s.height,cxp=w*p.x/100,cyp=h*p.y/100,R=Math.min(w,h)/2,k=p.a/100;
   return warpBy(s,(x,y,q)=>{const dx=(x-cxp)/R,dy=(y-cyp)/R,d2=dx*dx+dy*dy||1e-6,ix=dx/d2,iy=dy/d2;q[0]=cxp+(dx+(ix-dx)*k)*R;q[1]=cyp+(dy+(iy-dy)*k)*R;
     q[0]=((q[0]%w)+w)%w;q[1]=((q[1]%h)+h)%h})}},
 pencil:{name:'Croquis au crayon',params:[P('r','Épaisseur du trait',1,40,.5,4,' px',1),P('c','Contraste',0,100,1,75,' %'),P('col','Garder la couleur',0,100,1,0,' %')],
  run:(s,p)=>{const w=s.width,h=s.height,d=px(s),a=d.data,inv=mk(w,h),iim=new ImageData(w,h),ia=iim.data;
   for(let i=0;i<a.length;i+=4){const v=255-luma(a,i);ia[i]=ia[i+1]=ia[i+2]=v;ia[i+3]=255}rx(inv).putImageData(iim,0,0);const b=px(blurCanvas(inv,p.r)).data,gam=1+p.c/50,cc=p.col/100;
   for(let i=0;i<a.length;i+=4){const L=luma(a,i),v=Math.min(255,L*255/Math.max(1,255-b[i])),t=255*Math.pow(v/255,gam);for(let k=0;k<3;k++)a[i+k]=t*(1-cc)+Math.min(255,a[i+k]*t/Math.max(1,L))*cc}
   return put(w,h,d)}},
 oil:{name:'Peinture à l’huile',params:[P('r','Taille du pinceau',1,20,1,6,' px',1),P('n','Niveaux',4,40,1,20,'')],
  run:(s,p)=>{const w0=s.width,h0=s.height,k=Math.min(1,2400/Math.max(w0,h0)),src=k<1?resample(s,Math.round(w0*k),Math.round(h0*k)):s,w=src.width,h=src.height,r=Math.max(1,Math.round(p.r*k)),L=p.n,sd=px(src).data,o=new ImageData(w,h),a=o.data;
   const lev=new Uint8Array(w*h);for(let i=0;i<w*h;i++)lev[i]=Math.min(L-1,Math.floor(luma(sd,i*4)/256*L));const cnt=new Uint32Array(L),sr=new Uint32Array(L),sg=new Uint32Array(L),sb=new Uint32Array(L);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){cnt.fill(0);sr.fill(0);sg.fill(0);sb.fill(0);
     for(let yy=Math.max(0,y-r);yy<=Math.min(h-1,y+r);yy++)for(let xx=Math.max(0,x-r);xx<=Math.min(w-1,x+r);xx++){const q=yy*w+xx,l=lev[q],j=q*4;cnt[l]++;sr[l]+=sd[j];sg[l]+=sd[j+1];sb[l]+=sd[j+2]}
     let bl=0;for(let l=1;l<L;l++)if(cnt[l]>cnt[bl])bl=l;const j=(y*w+x)*4,n=cnt[bl]||1;a[j]=sr[bl]/n;a[j+1]=sg[bl]/n;a[j+2]=sb[bl]/n;a[j+3]=sd[j+3]}
   const out=put(w,h,o);return k<1?resample(out,w0,h0):out}},
});
/* « Mélange » se choisit dans une liste, pas avec un curseur */
const MODE_N=['Normal','Produit','Écran','Incrustation','Lumière douce'];
{const _dialog=dialog;dialog=function(o){const dl=_dialog.apply(this,arguments);
  try{if(o&&o.light&&(o.title===FILTERS.clouds.name||o.title===FILTERS.fractal.name)){const r=dl.querySelector('#f-mode');if(r){const se=document.createElement('select');MODE_N.forEach((t,i)=>{const op=document.createElement('option');op.value=i;op.textContent=t;se.appendChild(op)});se.value=r.value;
    se.onchange=()=>{r.value=se.value;r.dispatchEvent(new Event('input',{bubbles:true}))};r.style.display='none';const out=r.parentNode.querySelector('output');if(out)out.style.display='none';r.after(se)}}}catch(e){}
  return dl}}
/* au menu Filtre : dans les familles existantes, plus une famille « Créer » */
const G=window.__FILTER_GROUPS;
if(G){const add=(t,ids)=>{const g=G.find(x=>x[0]===t);if(g)g[1].push(...ids);else G.push([t,ids])};
  add('Distorsion',['organic','polar']);add('Stylisation',['stained','frosted','pencil','oil']);add('Créer',['clouds','fractal'])}
})();
