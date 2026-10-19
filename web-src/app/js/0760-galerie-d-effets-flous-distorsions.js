/* ===== wave30: galerie d'effets (flous, distorsions, stylisation, lumière) avec aperçu en direct ===== */
(()=>{
const px=s=>rx(s).getImageData(0,0,s.width,s.height);
const put=(w,h,im)=>{const c=mk(w,h);rx(c).putImageData(im,0,0);return c};
const rad=a=>a*Math.PI/180;
function padEdge(src,p){const w=src.width,h=src.height,big=mk(w+2*p,h+2*p),b=cx(big);b.drawImage(src,p,p);b.drawImage(src,0,0,1,h,0,p,p,h);b.drawImage(src,w-1,0,1,h,w+p,p,p,h);b.drawImage(big,0,p,w+2*p,1,0,0,w+2*p,p);b.drawImage(big,0,h+p-1,w+2*p,1,0,h+p,w+2*p,p);return big}
function accum(w,h,n,draw){const o=mk(w,h),g=cx(o);for(let i=0;i<n;i++){g.globalAlpha=1/(i+1);draw(g,n>1?i/(n-1):0)}g.globalAlpha=1;return o}
function warp(src,map){const w=src.width,h=src.height,sd=px(src).data,o=new ImageData(w,h),od=o.data,q=[0,0];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){map(x,y,q);let sx=q[0],sy=q[1];if(sx<0)sx=0;else if(sx>w-1)sx=w-1;if(sy<0)sy=0;else if(sy>h-1)sy=h-1;
    const x0=sx|0,y0=sy|0,x1=x0+1<w?x0+1:x0,y1=y0+1<h?y0+1:y0,fx=sx-x0,fy=sy-y0,a=(y0*w+x0)*4,b=(y0*w+x1)*4,c=(y1*w+x0)*4,d=(y1*w+x1)*4,j=(y*w+x)*4,w00=(1-fx)*(1-fy),w10=fx*(1-fy),w01=(1-fx)*fy,w11=fx*fy;
    od[j]=sd[a]*w00+sd[b]*w10+sd[c]*w01+sd[d]*w11;od[j+1]=sd[a+1]*w00+sd[b+1]*w10+sd[c+1]*w01+sd[d+1]*w11;od[j+2]=sd[a+2]*w00+sd[b+2]*w10+sd[c+2]*w01+sd[d+2]*w11;od[j+3]=sd[a+3]*w00+sd[b+3]*w10+sd[c+3]*w01+sd[d+3]*w11}
  return put(w,h,o)}
const luma=(d,i)=>d[i]*.299+d[i+1]*.587+d[i+2]*.114;
function sobel(src){const w=src.width,h=src.height,d=px(src).data,L=new Float32Array(w*h),E=new Float32Array(w*h);for(let i=0;i<w*h;i++)L[i]=luma(d,i*4);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x,gx=L[i-w+1]+2*L[i+1]+L[i+w+1]-L[i-w-1]-2*L[i-1]-L[i+w-1],gy=L[i+w-1]+2*L[i+w]+L[i+w+1]-L[i-w-1]-2*L[i-w]-L[i-w+1];E[i]=Math.sqrt(gx*gx+gy*gy)}
  return E}
function hsl(h,s,l){h=((h%360)+360)%360/360;if(s===0)return[l,l,l];const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q,f=t=>{t=(t+1)%1;return t<1/6?p+(q-p)*6*t:t<.5?q:t<2/3?p+(q-p)*(2/3-t)*6:p};return[f(h+1/3),f(h),f(h-1/3)]}
const P=(k,l,a,b,st,d,u,scl)=>{const q=[k,l,a,b,st,d,u];if(scl)q[7]=true;return q};

Object.assign(FILTERS,{
 motion:{name:'Flou de mouvement',params:[P('len','Longueur',1,300,1,40,' px',1),P('ang','Angle',-90,90,1,0,'°')],run:(s,p)=>{const w=s.width,h=s.height,pd=Math.ceil(p.len/2)+2,big=padEdge(s,pd),n=Math.min(48,Math.max(2,Math.round(p.len))),ca=Math.cos(rad(p.ang)),sa=Math.sin(rad(p.ang));return accum(w,h,n,(g,t)=>{const d=(t-.5)*p.len;g.drawImage(big,Math.round(d*ca)-pd,Math.round(d*sa)-pd)})}},
 zoomblur:{name:'Flou de zoom',params:[P('a','Intensité',1,60,1,16,' %'),P('x','Centre horizontal',0,100,1,50,' %'),P('y','Centre vertical',0,100,1,50,' %')],run:(s,p)=>{const w=s.width,h=s.height,cxp=w*p.x/100,cyp=h*p.y/100;return accum(w,h,28,(g,t)=>{const k=1+p.a/100*t;g.drawImage(s,0,0,w,h,cxp-cxp*k,cyp-cyp*k,w*k,h*k)})}},
 tilt:{name:'Décalage d’inclinaison',params:[P('r','Flou',1,80,1,18,' px',1),P('pos','Position de la zone nette',0,100,1,50,' %'),P('bw','Largeur de la zone nette',0,90,1,25,' %'),P('ang','Angle',-90,90,1,0,'°')],run:(s,p)=>{const w=s.width,h=s.height,bl=blurCanvas(s,p.r),H=Math.hypot(w,h)/2,m=Math.min(w,h),a=rad(p.ang),nx=-Math.sin(a),ny=Math.cos(a),c0=[w/2,h*p.pos/100],d=p.bw/100*m/2,f=Math.max(8,m*.3);
   const mk2=mk(w,h),mg=cx(mk2),gr=mg.createLinearGradient(c0[0]-nx*H,c0[1]-ny*H,c0[0]+nx*H,c0[1]+ny*H),t=v=>clamp(.5+v/(2*H),0,1);gr.addColorStop(0,'rgba(0,0,0,1)');gr.addColorStop(t(-d-f),'rgba(0,0,0,1)');gr.addColorStop(t(-d),'rgba(0,0,0,0)');gr.addColorStop(t(d),'rgba(0,0,0,0)');gr.addColorStop(t(d+f),'rgba(0,0,0,1)');gr.addColorStop(1,'rgba(0,0,0,1)');mg.fillStyle=gr;mg.fillRect(0,0,w,h);
   const bg=cx(bl);bg.globalCompositeOperation='destination-in';bg.drawImage(mk2,0,0);const o=cloneC(s);cx(o).drawImage(bl,0,0);return o}},
 bulge:{name:'Renflement / Pincement',params:[P('a','Intensité',-100,100,1,50,' %'),P('r','Rayon',5,100,1,50,' %'),P('x','Centre horizontal',0,100,1,50,' %'),P('y','Centre vertical',0,100,1,50,' %')],run:(s,p)=>{const w=s.width,h=s.height,cxp=w*p.x/100,cyp=h*p.y/100,R=Math.min(w,h)*p.r/100,a=p.a/100;return warp(s,(x,y,q)=>{const dx=x-cxp,dy=y-cyp,d=Math.sqrt(dx*dx+dy*dy);if(d>=R){q[0]=x;q[1]=y;return}const t=d/R,f=1-a*(1-t)*(1-t);q[0]=cxp+dx*f;q[1]=cyp+dy*f})}},
 twirl:{name:'Tourbillon',params:[P('a','Angle',-720,720,1,180,'°'),P('r','Rayon',5,100,1,50,' %'),P('x','Centre horizontal',0,100,1,50,' %'),P('y','Centre vertical',0,100,1,50,' %')],run:(s,p)=>{const w=s.width,h=s.height,cxp=w*p.x/100,cyp=h*p.y/100,R=Math.min(w,h)*p.r/100;return warp(s,(x,y,q)=>{const dx=x-cxp,dy=y-cyp,d=Math.sqrt(dx*dx+dy*dy);if(d>=R){q[0]=x;q[1]=y;return}const t=1-d/R,th=rad(p.a)*t*t,c=Math.cos(th),sn=Math.sin(th);q[0]=cxp+dx*c-dy*sn;q[1]=cyp+dx*sn+dy*c})}},
 ripple:{name:'Ondulation',params:[P('a','Amplitude',1,100,1,12,' px',1),P('l','Longueur d’onde',10,600,1,120,' px',1)],run:(s,p)=>warp(s,(x,y,q)=>{q[0]=x+p.a*Math.sin(2*Math.PI*y/p.l);q[1]=y+p.a*Math.sin(2*Math.PI*x/p.l)})},
 kaleido:{name:'Kaléidoscope',params:[P('n','Segments',2,16,1,6,''),P('ang','Rotation',0,360,1,0,'°'),P('z','Zoom',50,300,1,100,' %')],run:(s,p)=>{const w=s.width,h=s.height,cxp=w/2,cyp=h/2,seg=2*Math.PI/p.n,rot=rad(p.ang),z=100/p.z;return warp(s,(x,y,q)=>{const dx=x-cxp,dy=y-cyp,r=Math.sqrt(dx*dx+dy*dy)*z;let a=Math.atan2(dy,dx)-rot;a=((a%seg)+seg)%seg;if(a>seg/2)a=seg-a;a+=rot;q[0]=cxp+r*Math.cos(a);q[1]=cyp+r*Math.sin(a)})}},
 edges:{name:'Contours',params:[P('k','Force',1,100,1,40,' %'),P('m','Style (0 à 2)',0,2,1,1,'')],run:(s,p)=>{const w=s.width,h=s.height,E=sobel(s),d=px(s),a=d.data,k=p.k/40;for(let i=0;i<w*h;i++){const e=Math.min(255,E[i]*k),j=i*4;if(p.m===0){a[j]=a[j+1]=a[j+2]=e}else if(p.m===1){a[j]=a[j+1]=a[j+2]=255-e}else{const f=1-e/255;a[j]*=f;a[j+1]*=f;a[j+2]*=f}}return put(w,h,d)}},
 emboss:{name:'Relief',params:[P('d','Profondeur',1,100,1,40,' %'),P('ang','Direction',0,360,1,135,'°'),P('c','Garder la couleur',0,100,1,0,' %')],run:(s,p)=>{const w=s.width,h=s.height,d=px(s),a=d.data,L=new Float32Array(w*h);for(let i=0;i<w*h;i++)L[i]=luma(a,i*4);const dx=Math.round(Math.cos(rad(p.ang))*1.2),dy=Math.round(Math.sin(rad(p.ang))*1.2),k=p.d/20,cc=p.c/100;
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const x1=clamp(x+dx,0,w-1),y1=clamp(y+dy,0,h-1),x2=clamp(x-dx,0,w-1),y2=clamp(y-dy,0,h-1),v=128+(L[y1*w+x1]-L[y2*w+x2])*k,j=(y*w+x)*4,f=v/128;a[j]=clamp(a[j]*cc*f+v*(1-cc),0,255);a[j+1]=clamp(a[j+1]*cc*f+v*(1-cc),0,255);a[j+2]=clamp(a[j+2]*cc*f+v*(1-cc),0,255)}return put(w,h,d)}},
 halftone:{name:'Demi-teinte',params:[P('s','Taille de trame',3,80,1,10,' px',1),P('ang','Angle',0,90,1,45,'°'),P('m','Couleur (0 ou 1)',0,1,1,1,'')],run:(s,p)=>{const w=s.width,h=s.height,cell=p.s,sm=resample(s,Math.max(1,Math.ceil(w/Math.max(2,cell/2))),Math.max(1,Math.ceil(h/Math.max(2,cell/2)))),sd=px(sm),sw=sm.width,sh=sm.height,o=mk(w,h),g=cx(o);g.fillStyle='#fff';g.fillRect(0,0,w,h);const a=rad(p.ang),ca=Math.cos(a),sa=Math.sin(a),D=Math.hypot(w,h),n=Math.ceil(D/cell)+2;
   for(let v=-n;v<=n;v++)for(let u=-n;u<=n;u++){const ux=u*cell,vy=v*cell,x=w/2+ux*ca-vy*sa,y=h/2+ux*sa+vy*ca;if(x<-cell||y<-cell||x>w+cell||y>h+cell)continue;const ix=clamp(Math.floor(x/w*sw),0,sw-1),iy=clamp(Math.floor(y/h*sh),0,sh-1),j=(iy*sw+ix)*4,r=sd.data[j],gg=sd.data[j+1],b=sd.data[j+2],dark=1-luma(sd.data,j)/255,rr=cell*.72*Math.sqrt(dark);if(rr<.25)continue;g.fillStyle=p.m?`rgb(${r|0},${gg|0},${b|0})`:'#000';g.beginPath();g.arc(x,y,rr,0,6.2832);g.fill()}return o}},
 comic:{name:'Bande dessinée',params:[P('n','Niveaux de couleur',2,10,1,5,''),P('k','Épaisseur des traits',0,100,1,45,' %')],run:(s,p)=>{const w=s.width,h=s.height,E=sobel(s),d=px(blurCanvas(s,Math.max(.8,Math.max(w,h)/2500))),a=d.data,st=255/(p.n-1),k=p.k/30;for(let i=0;i<w*h;i++){const j=i*4,f=1-Math.min(1,E[i]*k/255*2);for(let c=0;c<3;c++)a[j+c]=Math.round(a[j+c]/st)*st*f}return put(w,h,d)}},
 threshold:{name:'Seuil',params:[P('t','Niveau',1,254,1,128,'')],run:(s,p)=>pixFilter(s,a=>{for(let i=0;i<a.length;i+=4){const v=luma(a,i)>=p.t?255:0;a[i]=a[i+1]=a[i+2]=v}})},
 solarize:{name:'Solarisation',params:[P('t','Seuil',1,254,1,128,'')],run:(s,p)=>pixFilter(s,a=>{for(let i=0;i<a.length;i+=4)for(let c=0;c<3;c++)if(a[i+c]>p.t)a[i+c]=255-a[i+c]})},
 bloom:{name:'Lueur',params:[P('r','Rayon',2,150,1,30,' px',1),P('t','Seuil',0,250,1,170,''),P('i','Intensité',0,100,1,60,' %')],run:(s,p)=>{const br=pixFilter(s,a=>{for(let i=0;i<a.length;i+=4){const k=Math.max(0,(luma(a,i)-p.t)/(255-p.t||1));a[i]*=k;a[i+1]*=k;a[i+2]*=k}}),bl=blurCanvas(br,p.r),o=cloneC(s),g=cx(o);g.globalCompositeOperation='screen';g.globalAlpha=Math.min(1,p.i/100*1.4);g.drawImage(bl,0,0);return o}},
 softfocus:{name:'Éclat doux',params:[P('r','Rayon',2,100,1,16,' px',1),P('i','Intensité',0,100,1,50,' %')],run:(s,p)=>{const bl=blurCanvas(s,p.r),o=cloneC(s),g=cx(o);g.globalAlpha=p.i/100*.7;g.drawImage(bl,0,0);g.globalCompositeOperation='screen';g.globalAlpha=p.i/100*.3;g.drawImage(bl,0,0);return o}},
 leak:{name:'Fuite de lumière',params:[P('x','Position horizontale',-20,120,1,95,' %'),P('y','Position verticale',-20,120,1,20,' %'),P('h','Teinte',0,360,1,25,'°'),P('r','Taille',10,150,1,70,' %'),P('i','Intensité',0,100,1,60,' %')],run:(s,p)=>{const w=s.width,h=s.height,o=cloneC(s),g=cx(o),m=Math.max(w,h),R=m*p.r/100,x=w*p.x/100,y=h*p.y/100,c=hsl(p.h,1,.55).map(v=>Math.round(v*255)),gr=g.createRadialGradient(x,y,0,x,y,R);gr.addColorStop(0,`rgba(255,${(c[1]+255)>>1},${(c[2]+200)>>1},${p.i/100})`);gr.addColorStop(.35,`rgba(${c[0]},${c[1]},${c[2]},${p.i/100*.65})`);gr.addColorStop(1,`rgba(${c[0]},${c[1]},${c[2]},0)`);g.globalCompositeOperation='screen';g.fillStyle=gr;g.fillRect(0,0,w,h);return o}},
 chroma:{name:'Aberration chromatique',params:[P('a','Décalage',0,100,1,25,' %')],run:(s,p)=>{const w=s.width,h=s.height,k=p.a/100*.012,cxp=w/2,cyp=h/2,R=warp(s,(x,y,q)=>{q[0]=cxp+(x-cxp)*(1+k);q[1]=cyp+(y-cyp)*(1+k)}),B=warp(s,(x,y,q)=>{q[0]=cxp+(x-cxp)*(1-k);q[1]=cyp+(y-cyp)*(1-k)}),o=px(s),rd=px(R).data,bd=px(B).data,a=o.data;for(let i=0;i<a.length;i+=4){a[i]=rd[i];a[i+2]=bd[i+2]}return put(w,h,o)}},
 duotone:{name:'Bichromie',params:[P('hs','Teinte des ombres',0,360,1,235,'°'),P('hh','Teinte des hautes lumières',0,360,1,35,'°'),P('s','Saturation',0,100,1,70,' %'),P('k','Intensité',0,100,1,100,' %')],run:(s,p)=>{const A=hsl(p.hs,p.s/100,.2),B=hsl(p.hh,p.s/100,.78),k=p.k/100;return pixFilter(s,a=>{for(let i=0;i<a.length;i+=4){const l=luma(a,i)/255;for(let c=0;c<3;c++){const v=(A[c]+(B[c]-A[c])*l)*255;a[i+c]=a[i+c]*(1-k)+v*k}}})}}
});

/* les rayons s'adaptent à la résolution de la photo */
const base=new WeakMap();
const _fd=filterDialog;
filterDialog=function(id){const F=FILTERS[id],d=S.doc;
  if(F&&d){if(!base.has(F))base.set(F,F.params.map(q=>q.slice()));const k=Math.max(1,Math.max(d.w,d.h)/2400);F.params=base.get(F).map(q=>{q=q.slice();if(q[7]){q[3]=Math.round(q[3]*k);q[5]=Math.round(q[5]*k)}return q})}
  return _fd(id)};
['blur','pixelate'].forEach(k=>{const F=FILTERS[k];if(F)F.params[0][7]=true});
FILTERS.unsharp.params[1][7]=true;

/* menu Filtre en groupes */
const G=[['Flous',['blur','motion','zoomblur','tilt']],['Netteté et bruit',['unsharp','denoise','noise']],['Distorsion',['bulge','twirl','ripple','kaleido']],['Stylisation',['edges','emboss','halftone','comic','pixelate','posterize','threshold','solarize']],['Lumière et couleur',['bloom','softfocus','leak','chroma','duotone','bw','sepia','invert']]];
MENU2.filter.items=()=>G.map(([t,ids])=>MI(t,{icon:'filter',dis:!S.doc?NODOC:false,sub:()=>ids.map(id=>MI(FILTERS[id].name+(FILTERS[id].params.length?'…':''),{fn:()=>filterDialog(id)}))}));
window.__FILTER_GROUPS=G;
})();

