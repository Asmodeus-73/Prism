/* ===== lens : Correction de l'objectif (distorsion, vignettage, aberration chromatique, franges, perspective) =====
   Un filtre de plus dans FILTERS (donc modifiable via « Effets du calque… », enregistrable dans les actions).
   Calcul : WebGL2 (un seul passage de rééchantillonnage bicubique pour la géométrie et les 3 canaux, puis passage de franges),
   par bandes avec await tick() pour ne pas figer l'onglet ; repli CPU (bilinéaire) si WebGL2 est absent. */
(()=>{
const NAME='Correction de l’objectif';
const PAR=[
 ['dist','Distorsion',-100,100,1,0,''],
 ['dist2','Bords',-100,100,1,0,''],
 ['fill','Remplir le cadre',0,1,1,1,''],
 ['vig','Vignettage',-100,100,1,0,''],
 ['vmid','Point médian',0,100,1,50,' %'],
 ['vfea','Progressivité',0,100,1,50,' %'],
 ['car','Rouge',-100,100,0.5,0,''],
 ['cab','Bleu',-100,100,0.5,0,''],
 ['fr','Intensité',0,100,1,0,' %'],
 ['frw','Largeur',1,10,1,3,' px'],
 ['pv','Verticale',-100,100,1,0,''],
 ['ph','Horizontale',-100,100,1,0,'']];
const DEF={};PAR.forEach(q=>DEF[q[0]]=q[5]);
/* lens profile (lensfun), not shown as sliders: distortion polynomial in R=lfs·r (r: half-diagonal units), red/blue scale, vignetting k1..k3 in lvs·r */
Object.assign(DEF,{lfs:0,l0:1,l1:0,l2:0,l3:0,l4:0,ltr:0,ltb:0,lvs:0,lv1:0,lv2:0,lv3:0});
const NP=p=>{const o={};for(const k in DEF){const v=p&&p[k];o[k]=(typeof v==='number'&&isFinite(v))?v:DEF[k]}return o};
const idle=p=>!p.dist&&!p.dist2&&!p.vig&&!p.car&&!p.cab&&!p.fr&&!p.pv&&!p.ph&&!p.lfs&&!p.lvs&&!p.ltr&&!p.ltb;
const CLAMP=(v,a,b)=>v<a?a:v>b?b:v;

/* ---------------- modèle géométrique (partagé par le GPU, le CPU et le calcul du zoom) ---------------- */
function model(w,h,p){
 const m={w,h,H:Math.hypot(w,h)/2,f:1.5,z:1};
 m.thx=CLAMP(p.pv/100,-1,1)*0.44;m.thy=CLAMP(p.ph/100,-1,1)*0.44;   /* 25° au maximum : le zoom de remplissage reste raisonnable */
 m.a=p.dist/100*0.35;m.b=p.dist2/100*0.35;
 m.kr=(1+p.car*5e-5)*(1+p.ltr)-1;m.kb=(1+p.cab*5e-5)*(1+p.ltb)-1;
 m.ls=p.lfs;m.lc=[p.l0,p.l1,p.l2,p.l3,p.l4];m.lv=[p.lvs,p.lv1,p.lv2,p.lv3];
 m.fill=p.fill?1:0;
 m.va=p.vig/100;m.vmid=p.vmid/100;m.vhw=0.05+0.55*p.vfea/100;
 m.fr=p.fr/100;m.rad=Math.max(1,p.frw*Math.max(w,h)/2400);
 m.z=fitZoom(m);return m}
function geo(m,u,v,o){   /* (u,v) normalisés par la demi-diagonale, sortie : position dans l'image source (avant échelle par canal) */
 let x=u,y=v,z=m.f;
 if(m.thx){const c=Math.cos(m.thx),s=Math.sin(m.thx),y1=y*c-z*s,z1=y*s+z*c;y=y1;z=z1}
 if(m.thy){const c=Math.cos(m.thy),s=Math.sin(m.thy),x1=x*c+z*s,z1=-x*s+z*c;x=x1;z=z1}
 const k=m.f/Math.max(z,0.05),x2=x*k,y2=y*k,r2=x2*x2+y2*y2,fac=Math.max(1-m.a*r2-m.b*r2*r2,0.15)*lfFac(m,r2);
 o[0]=x2*fac;o[1]=y2*fac}
function lfFac(m,r2){if(!m.ls)return 1;const R=m.ls*Math.sqrt(r2),c=m.lc;return Math.max(c[0]+R*(c[1]+R*(c[2]+R*(c[3]+R*c[4]))),0.15)}
/* profile vignetting: the lens darkens by V(r) in linear light; the photo is gamma-encoded, so the gain is V^(-1/2.2) */
function lfVig(m,rs){const v=m.lv;if(!v[0])return 1;const r2=(rs*v[0])**2,V=1+r2*(v[1]+r2*(v[2]+r2*v[3]));return V>0.05?Math.pow(V,-1/2.2):1}
function fitZoom(m){
 if(!m.fill)return 1;const o=[0,0],K=[0,m.kr,m.kb],w=m.w,h=m.h,H=m.H,N=48,pts=[];
 for(let i=0;i<=N;i++){const t=i/N;pts.push([(-w/2+t*w)/H,-h/2/H],[(-w/2+t*w)/H,h/2/H],[-w/2/H,(-h/2+t*h)/H],[w/2/H,(-h/2+t*h)/H])}
 for(let z=1;z<4;z*=1.004){let ok=true;
  for(const [u,v] of pts){geo(m,u/z,v/z,o);for(const k of K){const sx=w/2+o[0]*(1+k)*H,sy=h/2+o[1]*(1+k)*H;if(sx<-1e-6||sx>w+1e-6||sy<-1e-6||sy>h+1e-6){ok=false;break}}if(!ok)break}
  if(ok)return z}
 return 4}
const hueW=(r,g,b)=>{const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;if(d<=0)return[0,0,0];let hh;if(mx===r)hh=((g-b)/d+6)%6;else if(mx===g)hh=(b-r)/d+2;else hh=(r-g)/d+4;hh*=60;return[hh,d/Math.max(mx,1e-6),0]};
const sstep=(a,b,x)=>{const t=CLAMP((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const fringeW=(hh,sat)=>Math.max(sstep(235,265,hh)*(1-sstep(315,345,hh)),sstep(60,85,hh)*(1-sstep(150,175,hh)))*sstep(0.12,0.4,sat);

/* ---------------- WebGL2 ---------------- */
const VS=`#version 300 es
in vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;
const FS1=`#version 300 es
precision highp float;precision highp int;precision highp sampler2D;
uniform sampler2D uSrc;uniform vec2 uSize,uRot,uDist,uCA;uniform vec3 uVig;uniform float uH,uZ,uF;uniform int uQ,uFill;uniform vec2 uLs;uniform vec4 uLc,uLv;
out vec4 o;
vec4 tf(ivec2 p){p=clamp(p,ivec2(0),ivec2(uSize)-ivec2(1));vec4 t=texelFetch(uSrc,p,0);return vec4(t.rgb*t.a,t.a);}
vec4 cr(float t){float t2=t*t,t3=t2*t;return vec4(-.5*t3+t2-.5*t,1.5*t3-2.5*t2+1.,-1.5*t3+2.*t2+.5*t,.5*t3-.5*t2);}
vec4 samp(vec2 sp){vec2 fl=floor(sp),t=sp-fl;ivec2 b=ivec2(fl);
 if(uQ==0){vec4 a=mix(tf(b),tf(b+ivec2(1,0)),t.x),c=mix(tf(b+ivec2(0,1)),tf(b+ivec2(1,1)),t.x);return mix(a,c,t.y);}
 vec4 wx=cr(t.x),wy=cr(t.y),acc=vec4(0.);
 for(int j=0;j<4;j++){vec4 row=vec4(0.);for(int i=0;i<4;i++)row+=tf(b+ivec2(i-1,j-1))*wx[i];acc+=row*wy[j];}
 acc.a=clamp(acc.a,0.,1.);acc.rgb=clamp(acc.rgb,0.,acc.a);return acc;}
float cov(vec2 sp){vec2 c=sp+.5;return clamp(min(min(c.x,uSize.x-c.x),min(c.y,uSize.y-c.y))+.5,0.,1.);}
void main(){
 vec2 uv=(gl_FragCoord.xy-uSize*.5)/(uH*uZ);vec3 d=vec3(uv,uF);
 if(uRot.x!=0.){float c=cos(uRot.x),s=sin(uRot.x);d=vec3(d.x,d.y*c-d.z*s,d.y*s+d.z*c);}
 if(uRot.y!=0.){float c=cos(uRot.y),s=sin(uRot.y);d=vec3(d.x*c+d.z*s,d.y,-d.x*s+d.z*c);}
 vec2 u2=d.xy*(uF/max(d.z,.05));float r2=dot(u2,u2);
 float fl=1.;if(uLs.x!=0.){float R=uLs.x*sqrt(r2);fl=max(uLs.y+R*(uLc.x+R*(uLc.y+R*(uLc.z+R*uLc.w))),.15);}
 vec2 q=u2*max(1.-uDist.x*r2-uDist.y*r2*r2,.15)*fl;
 vec2 spG=uSize*.5+q*uH-.5;vec4 sg=samp(spG),sr=sg,sb=sg;
 if(uCA.x!=0.)sr=samp(uSize*.5+q*(1.+uCA.x)*uH-.5);
 if(uCA.y!=0.)sb=samp(uSize*.5+q*(1.+uCA.y)*uH-.5);
 float cv=uFill==1?1.:cov(spG),a=sg.a*cv;
 vec3 c=vec3(sr.r/max(sr.a,1e-4),sg.g/max(sg.a,1e-4),sb.b/max(sb.a,1e-4));
 if(sg.a<1e-4)c=vec3(0.);
 if(uVig.x!=0.){float t=smoothstep(uVig.y-uVig.z,uVig.y+uVig.z,length(q));float g=uVig.x>0.?1./(1.-.8*uVig.x*t):1.+uVig.x*t;c*=g;}
 if(uLv.x!=0.){float r2v=pow(length(q)*uLv.x,2.);float V=1.+r2v*(uLv.y+r2v*(uLv.z+r2v*uLv.w));if(V>.05)c*=pow(V,-1./2.2);}
 o=vec4(clamp(c,0.,1.),a);}`;
const FS2=`#version 300 es
precision highp float;precision highp int;precision highp sampler2D;
uniform sampler2D uSrc;uniform vec2 uSize;uniform float uAmt,uRad;out vec4 o;
float lum(vec3 c){return dot(c,vec3(.299,.587,.114));}
float ss(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}
void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec4 c=texelFetch(uSrc,p,0);float lo=1.,hi=0.,st=uRad*.5;
 for(int j=-2;j<=2;j++)for(int i=-2;i<=2;i++){ivec2 q=clamp(p+ivec2(floor(vec2(float(i),float(j))*st+.5)),ivec2(0),ivec2(uSize)-ivec2(1));float l=lum(texelFetch(uSrc,q,0).rgb);lo=min(lo,l);hi=max(hi,l);}
 float ew=ss(.15,.45,hi-lo);float mx=max(c.r,max(c.g,c.b)),mn=min(c.r,min(c.g,c.b)),dd=mx-mn;
 if(dd>0.&&ew>0.){float hh;if(mx==c.r)hh=mod((c.g-c.b)/dd+6.,6.);else if(mx==c.g)hh=(c.b-c.r)/dd+2.;else hh=(c.r-c.g)/dd+4.;hh*=60.;
  float sat=dd/max(mx,1e-6);float w=max(ss(235.,265.,hh)*(1.-ss(315.,345.,hh)),ss(60.,85.,hh)*(1.-ss(150.,175.,hh)))*ss(.12,.4,sat)*ew*uAmt;
  c.rgb=mix(c.rgb,vec3(lum(c.rgb)),w);}
 o=c;}`;
let GLS=null,GLBAD=false;
function glInit(){
 if(GLBAD)return null;if(GLS&&!GLS.gl.isContextLost())return GLS;
 try{const cv=document.createElement('canvas');cv.width=cv.height=1;
  const gl=cv.getContext('webgl2',{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:false,preserveDrawingBuffer:false});
  if(!gl){GLBAD=true;return null}
  const prog=(fs)=>{const mkS=(t,s)=>{const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(x));return x};
   const P=gl.createProgram();gl.attachShader(P,mkS(gl.VERTEX_SHADER,VS));gl.attachShader(P,mkS(gl.FRAGMENT_SHADER,fs));gl.bindAttribLocation(P,0,'a');gl.linkProgram(P);
   if(!gl.getProgramParameter(P,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(P));return P};
  const p1=prog(FS1),p2=prog(FS2),vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  GLS={gl,cv,p1,p2,vao};return GLS}
 catch(e){console.warn('lens: WebGL2 indisponible',e);GLBAD=true;return null}}
const BAND=3e6;   /* pixels par bande */
function* glRender(src,p,Q){
 const G=glInit();if(!G)return null;const gl=G.gl,w=src.width,h=src.height;
 if(w>gl.getParameter(gl.MAX_TEXTURE_SIZE)||h>gl.getParameter(gl.MAX_TEXTURE_SIZE)||w>gl.getParameter(gl.MAX_RENDERBUFFER_SIZE))return null;
 const m=model(w,h,p),tex=[],fbo=[];
 const mkT=(img)=>{const t=gl.createTexture();tex.push(t);gl.bindTexture(gl.TEXTURE_2D,t);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  if(img)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,img);else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);return t};
 const mkF=(t)=>{const f=gl.createFramebuffer();fbo.push(f);gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
  if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('framebuffer');return f};
 try{
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  const p3=src._cs==='display-p3';if('unpackColorSpace' in gl)try{gl.unpackColorSpace=p3?'display-p3':'srgb'}catch(e){}
  const tS=mkT(src);const tA=mkT(null),fA=mkF(tA);let tB=null,fB=null;const needFr=m.fr>0;if(needFr){tB=mkT(null);fB=mkF(tB)}
  gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.viewport(0,0,w,h);gl.enable(gl.SCISSOR_TEST);
  const np=needFr?2:1,tiny=new Uint8Array(4);let rows=Math.max(16,Math.min(h,Math.ceil(2e5/w))),pi=0;
  /* chaque bande est dessinée puis attendue (lecture d'un pixel) : on règle sa hauteur pour qu'elle dure ~90 ms, donc l'onglet reste réactif même sur un GPU logiciel */
  const strips=function*(){let y=0;while(y<h){const n=Math.min(rows,h-y),t=performance.now();gl.scissor(0,y,w,n);gl.drawArrays(gl.TRIANGLES,0,3);gl.readPixels(0,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,tiny);
    const dt=performance.now()-t;y+=n;rows=CLAMP(Math.round(rows*90/Math.max(dt,4)),16,h);yield(pi+y/h)/(np+1)}pi++};
  /* passe 1 : géométrie + canaux + vignettage */
  gl.useProgram(G.p1);gl.bindVertexArray(G.vao);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tS);
  const U=n=>gl.getUniformLocation(G.p1,n);
  gl.uniform1i(U('uSrc'),0);gl.uniform2f(U('uSize'),w,h);gl.uniform2f(U('uRot'),m.thx,m.thy);gl.uniform2f(U('uDist'),m.a,m.b);gl.uniform2f(U('uCA'),m.kr,m.kb);
  gl.uniform3f(U('uVig'),m.va,m.vmid,m.vhw);gl.uniform1f(U('uH'),m.H);gl.uniform1f(U('uZ'),m.z);gl.uniform1f(U('uF'),m.f);gl.uniform1i(U('uQ'),Q?1:0);gl.uniform1i(U('uFill'),m.fill);gl.uniform2f(U('uLs'),m.ls,m.lc[0]);gl.uniform4f(U('uLc'),m.lc[1],m.lc[2],m.lc[3],m.lc[4]);gl.uniform4f(U('uLv'),m.lv[0],m.lv[1],m.lv[2],m.lv[3]);
  gl.bindFramebuffer(gl.FRAMEBUFFER,fA);
  yield* strips();
  let last=fA;
  if(needFr){
   gl.useProgram(G.p2);gl.bindTexture(gl.TEXTURE_2D,tA);const V=n=>gl.getUniformLocation(G.p2,n);
   gl.uniform1i(V('uSrc'),0);gl.uniform2f(V('uSize'),w,h);gl.uniform1f(V('uAmt'),m.fr);gl.uniform1f(V('uRad'),m.rad);gl.bindFramebuffer(gl.FRAMEBUFFER,fB);
   yield* strips();
   last=fB}
  /* lecture par bandes */
  gl.disable(gl.SCISSOR_TEST);gl.bindFramebuffer(gl.FRAMEBUFFER,last);
  const out=mk(w,h),og=cx(out),rr=Math.max(64,Math.ceil(BAND/w));
  for(let y=0;y<h;y+=rr){const sh=Math.min(rr,h-y),im=new ImageData(w,sh,{colorSpace:p3?'display-p3':'srgb'});
   gl.readPixels(0,y,w,sh,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(im.data.buffer));og.putImageData(im,0,y);yield(np+Math.min(1,(y+sh)/h))/(np+1)}
  if(gl.isContextLost())throw new Error('contexte WebGL perdu');
  return out}
 finally{try{tex.forEach(t=>gl.deleteTexture(t));fbo.forEach(f=>gl.deleteFramebuffer(f));gl.bindFramebuffer(gl.FRAMEBUFFER,null)}catch(e){}}}

/* ---------------- repli CPU (bilinéaire) ---------------- */
function* cpuRender(src,p,Q){
 const w=src.width,h=src.height,m=model(w,h,p),sd=rx(src).getImageData(0,0,w,h).data,buf=new Uint8ClampedArray(w*h*4),o=[0,0],H=m.H,cxp=w/2,cyp=h/2;
 const smp=(x,y,ch,res)=>{   /* x,y : coordonnées en centre de texel ; res[0]=couleur prémultipliée, res[1]=alpha */
  const x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;let c=0,a=0;
  for(let j=0;j<2;j++)for(let i=0;i<2;i++){const xx=CLAMP(x0+i,0,w-1),yy=CLAMP(y0+j,0,h-1),k=(yy*w+xx)*4,wt=(i?fx:1-fx)*(j?fy:1-fy),al=sd[k+3]/255;a+=al*wt;if(ch>=0)c+=sd[k+ch]/255*al*wt}
  res[0]=c;res[1]=a};
 const r1=[0,0],r2=[0,0],r3=[0,0];let acc=0;
 for(let y=0;y<h;y++){
  for(let x=0;x<w;x++){
   const u=(x+.5-cxp)/(H*m.z),v=(y+.5-cyp)/(H*m.z);geo(m,u,v,o);const qx=o[0],qy=o[1];
   const gx=cxp+qx*H-.5,gy=cyp+qy*H-.5;smp(gx,gy,1,r2);
   if(m.kr)smp(cxp+qx*(1+m.kr)*H-.5,cyp+qy*(1+m.kr)*H-.5,0,r1);else smp(gx,gy,0,r1);
   if(m.kb)smp(cxp+qx*(1+m.kb)*H-.5,cyp+qy*(1+m.kb)*H-.5,2,r3);else smp(gx,gy,2,r3);
   let a=r2[1];if(!m.fill){const px=gx+.5,py=gy+.5;a*=CLAMP(Math.min(px,w-px,py,h-py)+.5,0,1)}
   const j=(y*w+x)*4;if(r2[1]<1e-4){buf[j]=buf[j+1]=buf[j+2]=buf[j+3]=0;continue}
   let R=r1[0]/Math.max(r1[1],1e-4),G=r2[0]/r2[1],B=r3[0]/Math.max(r3[1],1e-4);
   if(m.va){const t=sstep(m.vmid-m.vhw,m.vmid+m.vhw,Math.hypot(qx,qy)),g=m.va>0?1/(1-.8*m.va*t):1+m.va*t;R*=g;G*=g;B*=g}
   if(m.lv[0]){const g=lfVig(m,Math.hypot(qx,qy));R*=g;G*=g;B*=g}
   buf[j]=CLAMP(R,0,1)*255+.5;buf[j+1]=CLAMP(G,0,1)*255+.5;buf[j+2]=CLAMP(B,0,1)*255+.5;buf[j+3]=CLAMP(a,0,1)*255+.5}
  acc+=w;if(acc>1.5e5){acc=0;yield y/h*.7}}
 let fin=buf;
 if(m.fr>0){fin=new Uint8ClampedArray(buf);const st=m.rad*.5;acc=0;
  for(let y=0;y<h;y++){for(let x=0;x<w;x++){let lo=1,hi=0;
    for(let j=-2;j<=2;j++){const yy=CLAMP(y+Math.floor(j*st+.5),0,h-1);for(let i=-2;i<=2;i++){const xx=CLAMP(x+Math.floor(i*st+.5),0,w-1),k=(yy*w+xx)*4,l=(buf[k]*.299+buf[k+1]*.587+buf[k+2]*.114)/255;if(l<lo)lo=l;if(l>hi)hi=l}}
    const ew=sstep(.15,.45,hi-lo);if(ew<=0)continue;const k=(y*w+x)*4,rr=buf[k]/255,gg=buf[k+1]/255,bb=buf[k+2]/255,hs=hueW(rr,gg,bb);if(hs[1]<=0)continue;
    const wt=fringeW(hs[0],hs[1])*ew*m.fr;if(wt<=0)continue;const l=rr*.299+gg*.587+bb*.114;
    fin[k]=(rr+(l-rr)*wt)*255+.5;fin[k+1]=(gg+(l-gg)*wt)*255+.5;fin[k+2]=(bb+(l-bb)*wt)*255+.5}
   acc+=w;if(acc>1e5){acc=0;yield .7+y/h*.3}}}
 const out=mk(w,h);cx(out).putImageData(new ImageData(fin,w,h,{colorSpace:src._cs==='display-p3'?'display-p3':'srgb'}),0,0);return out}

/* ---------------- pilotes synchrone / asynchrone ---------------- */
function runSync(src,p0,Q=true){
 const p=NP(p0);if(idle(p))return cloneC(src);
 let r=null;
 try{const g=glRender(src,p,Q);let s=g.next();while(!s.done)s=g.next();r=s.value}catch(e){console.warn('lens: GPU',e);r=null}
 if(!r){const g=cpuRender(src,p,Q);let s=g.next();while(!s.done)s=g.next();r=s.value}
 return r}
async function runAsync(src,p0,Q=true,onP,stale){
 const p=NP(p0);if(idle(p))return cloneC(src);
 const drive=async(g)=>{let s=g.next();while(!s.done){if(stale&&stale()){g.return(null);return undefined}onP&&onP(s.value);await tick();s=g.next()}return s.value};
 let r=null;
 try{r=await drive(glRender(src,p,Q));if(r===undefined)return null}catch(e){console.warn('lens: GPU',e);r=null}
 if(!r){r=await drive(cpuRender(src,p,Q));if(r===undefined)return null}
 return r}

/* ---------------- aberration chromatique automatique ---------------- */
function autoCA(src){
 const s=Math.min(1,1000/Math.max(src.width,src.height)),w=Math.max(8,Math.round(src.width*s)),h=Math.max(8,Math.round(src.height*s)),sm=s<1?resample(src,w,h):src;
 const d=rx(sm).getImageData(0,0,w,h).data,N=w*h,ch=[new Float32Array(N),new Float32Array(N),new Float32Array(N)];
 for(let i=0;i<N;i++){const a=d[i*4+3]/255;for(let c=0;c<3;c++)ch[c][i]=d[i*4+c]*a}
 /* passe-haut : canal moins son flou en boîte (rayon 3) */
 const hp=ch.map(v=>{const t=new Float32Array(N),o=new Float32Array(N),R=3;
  for(let y=0;y<h;y++){let a=0;const r=y*w;for(let x=-R;x<=R;x++)a+=v[r+CLAMP(x,0,w-1)];for(let x=0;x<w;x++){t[r+x]=a/(2*R+1);a+=v[r+CLAMP(x+R+1,0,w-1)]-v[r+CLAMP(x-R,0,w-1)]}}
  for(let x=0;x<w;x++){let a=0;for(let y=-R;y<=R;y++)a+=t[CLAMP(y,0,h-1)*w+x];for(let y=0;y<h;y++){o[y*w+x]=v[y*w+x]-a/(2*R+1);a+=t[CLAMP(y+R+1,0,h-1)*w+x]-t[CLAMP(y-R,0,h-1)*w+x]}}
  return o});
 const cxp=w/2,cyp=h/2,Rm=Math.hypot(w,h)/2,G=hp[1];
 const ncc=(X,k)=>{let sab=0,saa=0,sbb=0;
  for(let y=2;y<h-2;y+=2)for(let x=2;x<w-2;x+=2){const dx=x+.5-cxp,dy=y+.5-cyp;if(dx*dx+dy*dy<(0.2*Rm)*(0.2*Rm))continue;
   const sx=cxp+dx*(1+k)-.5,sy=cyp+dy*(1+k)-.5;if(sx<0||sy<0||sx>=w-1||sy>=h-1)continue;
   const x0=sx|0,y0=sy|0,fx=sx-x0,fy=sy-y0,j=y0*w+x0,a=(X[j]*(1-fx)+X[j+1]*fx)*(1-fy)+(X[j+w]*(1-fx)+X[j+w+1]*fx)*fy,b=G[y*w+x];sab+=a*b;saa+=a*a;sbb+=b*b}
  return{c:sab/Math.sqrt(saa*sbb+1e-9),e:sbb}};
 const est=(X)=>{
  const base=ncc(X,0);if(base.e<N*0.02)return null;   /* presque pas de contours */
  let best=0,bv=-2;for(let k=-0.006;k<=0.00601;k+=0.0005){const v=ncc(X,k).c;if(v>bv){bv=v;best=k}}
  let st=0.0005;for(let i=0;i<5;i++){st/=2;for(const k of[best-st,best+st]){const v=ncc(X,k).c;if(v>bv){bv=v;best=k}}}
  return{k:best,before:base.c,after:bv}};
 const r=est(hp[0]),b=est(hp[2]);if(!r||!b)return null;
 const sl=k=>CLAMP(Math.round(k/5e-5*10)/10,-100,100);
 return{car:sl(r.k),cab:sl(b.k),kr:r.k,kb:b.k,conf:{r:[r.before,r.after],b:[b.before,b.after]}}}

/* ---------------- profils d'objectif (base lensfun) ---------------- */
const LF={db:null,P:null};
LF.load=()=>LF.db?Promise.resolve(LF.db):(LF.P||(LF.P=fetch(asset('lens/lensfun.json')).then(r=>{if(!r.ok)throw new Error('profils '+r.status);return r.json()}).then(j=>{j.lenses.forEach(l=>{l.full=(l.m&&!l.n.toLowerCase().startsWith(l.m.toLowerCase().split(' ')[0])?l.m+' ':'')+l.n;l.tok=LF.tok(l.n)});return LF.db=j}).finally(()=>{LF.P=null})));
/* words of a lens name: "EF24-70mm f/2.8L II USM" -> ef, 24-70mm, 2.8l, ii, usm */
LF.tok=s=>String(s||'').toLowerCase().replace(/f\/|1:/g,' ').replace(/(\d)\s+mm\b/g,'$1mm').replace(/([a-z])(\d)/g,'$1 $2').replace(/[^a-z0-9.\-+]+/g,' ').split(' ').filter(t=>t&&t!=='-');
/* what the photo says: camera, lens, focal length, aperture */
LF.shot=d=>{let s=d.shot;if(!s&&d.exif)try{s=exifSummary(tiffRead(d.exif))}catch(e){}return s?{make:s.make||'',model:s.model||'',lens:s.lens||'',focal:+s.focal||0,fn:+s.fn||0}:null};
LF.camera=(db,sh)=>{if(!sh||!sh.model)return null;const mk=sh.make.toLowerCase().split(' ')[0],md=sh.model.toLowerCase().replace(/\s+/g,' ');
  return db.cams.find(c=>c[1].toLowerCase()===md&&c[0].toLowerCase().startsWith(mk))||db.cams.find(c=>md.endsWith(c[1].toLowerCase().replace(/^\S+\s/,''))&&c[0].toLowerCase().startsWith(mk))||null};
LF.find=(db,sh)=>{if(!sh)return null;const cam=LF.camera(db,sh);
  if(sh.lens){const et=new Set(LF.tok(sh.lens+' '+sh.make));let best=null,bs=0,bh=0;
    for(const l of db.lenses){if(!l.tok.length)continue;let hit=0,num=true;for(const t of l.tok){if(et.has(t))hit++;else if(/\d/.test(t))num=false}
      const sc=num?hit/l.tok.length:0;if(sc>bs||(sc===bs&&sc>0&&(hit>bh||(hit===bh&&cam&&l.mt.includes(cam[2])&&!best.mt.includes(cam[2]))))){bs=sc;bh=hit;best=l}}
    if(bs>=0.75)return{lens:best,cam,how:'auto'}}
  /* fixed-lens cameras: the lens carries the camera's own mount */
  if(cam){const l=db.lenses.find(x=>x.mt.includes(cam[2])&&db.cams.filter(c=>c[2]===cam[2]).length<=3);if(l)return{lens:l,cam,how:'auto'}}
  return{lens:null,cam,how:'none'}};
const lerp=(a,b,t)=>a+(b-a)*t;
const bracket=(arr,x,key)=>{if(!arr.length)return null;let lo=arr[0],hi=arr[arr.length-1];for(const e of arr){if(key(e)<=x)lo=e;if(key(e)>=x){hi=e;break}}const a=key(lo),b=key(hi);return[lo,hi,b>a?CLAMP((x-a)/(b-a),0,1):0]};
const dcoef=e=>{if(e[1]===3){const d=1-e[2];return[1,0,e[2]/d,0,0]}if(e[1]===5)return[1,0,e[2],0,e[3]];const d=1-e[2]-e[3]-e[4];return[1,e[4]/d,e[3]/d,e[2]/d,0]};
/* the slider-less parameters for one lens at one focal length and aperture */
LF.params=(l,focal,fn,camCrop)=>{const o={lfs:0,l0:1,l1:0,l2:0,l3:0,l4:0,ltr:0,ltb:0,lvs:0,lv1:0,lv2:0,lv3:0},kc=l.c/(camCrop||l.c),F=focal||(l.d||l.t||l.v||[[0]])[0][0];
  if(l.d){const [a,b,t]=bracket(l.d,F,e=>e[0]),ca=dcoef(a),cb=dcoef(b),c=ca.map((v,i)=>lerp(v,cb[i],t));o.lfs=Math.sqrt(1+l.a*l.a)*kc;[o.l0,o.l1,o.l2,o.l3,o.l4]=c}
  if(l.t){const [a,b,t]=bracket(l.t,F,e=>e[0]);o.ltr=lerp(a[1],b[1],t)-1;o.ltb=lerp(a[2],b[2],t)-1}
  if(l.v){const fs=[...new Set(l.v.map(e=>e[0]))].sort((x,y)=>x-y),at=f=>{const rows=l.v.filter(e=>e[0]===f),far=Math.max(...rows.map(e=>e[2])),R=rows.filter(e=>e[2]===far).sort((x,y)=>x[1]-y[1]);
      const [a,b,t]=bracket(R,fn||R[0][1],e=>e[1]);return[3,4,5].map(i=>lerp(a[i],b[i],t))};
    const [fa,fb,t]=bracket(fs,F,x=>x),va=at(fa),vb=at(fb);o.lvs=kc;[o.lv1,o.lv2,o.lv3]=va.map((v,i)=>lerp(v,vb[i],t))}
  return o};

/* ---------------- interface ---------------- */
let pendingSrc=null,inMine=false;
function styleOnce(){if(document.getElementById('lensCSS'))return;const st=document.createElement('style');st.id='lensCSS';
 st.textContent='.lensP{display:grid;gap:6px;margin:4px 0 6px}.lensPr{display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-size:12px}.lensPr input:not([type=checkbox]){height:28px;border:1px solid var(--line-2);border-radius:8px;background:var(--field);color:var(--fg);padding:0 8px}.lensPr #lfQ{flex:1;min-width:180px}.lensPr select{width:100%}.lensH{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--fg-3);margin:14px 0 2px}.lensH:first-child{margin-top:0}.lensDlg{max-height:calc(100vh - 120px)!important}.lensA{display:flex;justify-content:flex-end;align-items:center;gap:8px;margin:2px 0 0;font-size:11.5px;color:var(--fg-3)}';
 document.body.appendChild(st)}
function setVal(dl,id,v){const r=dl.querySelector('#f-'+id);if(!r)return;r.value=v;r.dispatchEvent(new Event('input',{bubbles:true}))}
function decorate(dl,srcFn){
 styleOnce();dl.classList.add('lensDlg');
 const H=(before,t)=>{const row=dl.querySelector('#f-'+before);const r=row&&row.closest('.row');if(!r)return;const h=document.createElement('div');h.className='lensH';h.textContent=t;r.parentNode.insertBefore(h,r)};
 H('dist','Distorsion');H('vig','Vignettage');H('car','Aberration chromatique latérale');H('fr','Franges');H('pv','Perspective');
 const cab=dl.querySelector('#f-cab'),row=cab&&cab.closest('.row');
 if(row){const a=document.createElement('div');a.className='lensA';a.innerHTML='<span>Rouge et bleu par rapport au vert</span><button class="btn sm" type="button">Auto</button>';
  row.after(a);const btn=a.querySelector('button');
  btn.onclick=async()=>{const src=srcFn&&srcFn();if(!src)return;busy(true,'Analyse de l’aberration chromatique…',null);await tick();let r=null;
   try{r=autoCA(src)}catch(e){console.error(e)}finally{busy(false)}
   if(!r){toast('Pas assez de contours nets pour estimer l’aberration chromatique');return}
   setVal(dl,'car',r.car);setVal(dl,'cab',r.cab);toast('Aberration estimée : rouge '+r.car.toFixed(1)+', bleu '+r.cab.toFixed(1))}}}
{const _d=dialog;
 dialog=function(o){const dl=_d.apply(this,arguments);
  try{if(o&&o.light&&o.title===NAME){const f=pendingSrc;pendingSrc=null;
   decorate(dl,f||(()=>{const L=pixelTarget();if(!L)return null;return(L.fbase&&L.filters&&L.fout===L.canvas)?L.fbase:L.canvas}))}}catch(e){console.error(e)}
  return dl}}

/* profile row: found from the photo's EXIF (camera + lens), or searched by name; focal length and aperture pick the calibration */
function profileUI(el,d,p,prev){const on=$('#lfOn',el),nm=$('#lfName',el),q=$('#lfQ',el),sel=$('#lfSel',el),fI=$('#lfF',el),aI=$('#lfA',el);let lens=null,cam=null;
  const put=()=>{const o=on.checked&&lens?LF.params(lens,+fI.value,+aI.value,cam&&cam[3]):LF.params({c:1,a:1.5},0,0,1);for(const k in o)p[k]=o[k];if(!on.checked||!lens){p.lfs=0;p.lvs=0;p.ltr=0;p.ltb=0}prev()};
  const pick=l=>{lens=l;nm.textContent=l?l.full+(l.d?'':' (sans distorsion)')+(l.v?'':' (sans vignettage)'):'Aucun profil';on.disabled=!l;if(l&&!fI.value){const f=(l.d||l.t||l.v)[0][0];fI.value=f}put()};
  on.onchange=put;fI.oninput=put;aI.oninput=put;
  LF.load().then(db=>{const sh=LF.shot(d);if(sh){if(sh.focal)fI.value=Math.round(sh.focal);if(sh.fn)aI.value=(+sh.fn).toFixed(1)}
    const r=LF.find(db,sh);cam=r&&r.cam;if(r&&r.lens){on.checked=true;pick(r.lens)}else{on.checked=false;pick(null);nm.textContent=sh&&sh.lens?'« '+sh.lens+' » : pas de profil, cherchez un objectif proche':'Objectif inconnu : cherchez-le par son nom'}
    q.oninput=()=>{const t=LF.tok(q.value);if(!t.length){sel.hidden=true;return}const hits=db.lenses.filter(l=>{const s=(l.full).toLowerCase();return t.every(w=>s.includes(w))}).slice(0,40);
      sel.innerHTML=hits.map((l,i)=>`<option value="${db.lenses.indexOf(l)}">${esc(l.full)}</option>`).join('')||'<option disabled>Aucun objectif</option>';sel.size=Math.min(6,Math.max(2,hits.length));sel.hidden=false};
    sel.onchange=()=>{const l=db.lenses[+sel.value];if(!l)return;on.checked=true;fI.value='';pick(l);sel.hidden=true;q.value=''}})
  .catch(e=>{console.error(e);nm.textContent='Profils indisponibles';on.disabled=true})}
function lensDialog(){
 const d=S.doc;if(!d)return;
 if(maskTarget()){toast('La correction de l’objectif s’applique à la photo, pas au masque : choisissez le calque de photo');return}
 const L=pixelTarget();if(!L){toast('Aucun calque de pixels à corriger');return}
 if(L.visible===false){toast('Ce calque est masqué : affichez-le pour appliquer une correction');return}
 const orig=L.canvas,p=NP({}),F=FILTERS.lens;
 let tmr=null,seq=0,closed=false,pv=null;
 const small=()=>{if(pv)return pv;const k=1400/Math.max(orig.width,orig.height);return pv=k<1?resample(orig,Math.max(8,Math.round(orig.width*k)),Math.max(8,Math.round(orig.height*k))):orig};
 const clear=()=>{closed=true;seq++;clearTimeout(tmr);delete L.preview};
 const prev=()=>{clearTimeout(tmr);const my=++seq;tmr=setTimeout(async()=>{
   if(closed||S.doc!==d)return;
   if(idle(p)){delete L.preview;markComp();return}
   try{const s=small();let r=await runAsync(s,p,s===orig,null,()=>my!==seq||closed);if(!r||my!==seq||closed)return;
    if(s!==orig){const up=mk(orig.width,orig.height),g=cx(up);g.imageSmoothingQuality='high';g.drawImage(r,0,0,up.width,up.height);r=up}
    if(d.sel&&window.PrismFX&&PrismFX.mixSel)r=PrismFX.mixSel(orig,r,d.sel);
    L.preview=r;markComp()}catch(e){console.error(e);toast('Aperçu impossible : '+(e.message||e),3000)}},60)};
 pendingSrc=()=>orig;
 dialog({title:NAME,light:true,
  body:`<div class="lensH">Profil de l’objectif</div><div class="lensP"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="lfOn"><span id="lfName" class="muted">Recherche du profil…</span></label>
    <div class="lensPr"><input id="lfQ" placeholder="Chercher un objectif (${'base lensfun'})" autocomplete="off"><select id="lfSel" hidden></select></div>
    <div class="lensPr"><label>Focale <input id="lfF" type="number" min="1" max="2000" step="1" style="width:70px"> mm</label><label>Ouverture f/ <input id="lfA" type="number" min="0.7" max="64" step="0.1" style="width:60px"></label></div></div>`+
   PAR.map(q=>rangeRow('f-'+q[0],q[1],q[2],q[3],q[4],q[5],q[6])).join('')+(d.sel?'<p class="muted">Appliqué uniquement à la sélection.</p>':''),
  onOpen:el=>{PAR.forEach(q=>{const i=$('#f-'+q[0],el);i.oninput=()=>{p[q[0]]=+i.value;$('#f-'+q[0]+'-o',el).textContent=fmtN(+i.value,q[4])+q[6];prev()}});profileUI(el,d,p,prev)},
  buttons:[{label:'Annuler',onClick:()=>{clear();markComp()}},
   {label:'Appliquer',primary:true,onClick:()=>{clear();if(idle(p)){toast('Aucune correction à appliquer');markComp();return}applyLens(d,L,orig,{...p})}}]})}
async function applyLens(d,L,orig,p){
 busy(true,'Correction de l’objectif…',0);
 try{const r=await runAsync(orig,p,true,f=>busy(true,'Correction de l’objectif…',f));
  if(!r)return;
  if(S.doc!==d||!d.layers.includes(L)||L.canvas!==orig){toast('Le calque a changé pendant le calcul : correction annulée');return}
  F_lp(p);applyMasked(L,r,NAME)}
 catch(e){console.error(e);markComp();toast('Correction impossible : '+(e.message||e),4000)}
 finally{busy(false)}}
function F_lp(p){FILTERS.lens._lp={...p};const R=window.PrismC&&window.PrismC.REC;if(R)R.last={id:'lens',p:{...p}}}

FILTERS.lens={name:NAME,params:PAR,run:(s,p)=>{const q=NP(p);F_lp(q);return runSync(s,q,true)}};
{const _fd=filterDialog;filterDialog=function(id){if(id==='lens')return lensDialog();return _fd.apply(this,arguments)}}
/* menu Filtre : une entrée avant « Effets du calque… » (donc aussi dans Ctrl+K) */
{const _fi=MENU2.filter.items;
 MENU2.filter.items=()=>{const a=_fi(),it=MI(NAME+'…',{icon:'filter',dis:S.doc?false:NODOC,fn:lensDialog});
  const i=a.findIndex(x=>x&&/^Effets/.test(x.label||''));if(i<0)return[...a,SEP,it];
  const at=(i>0&&a[i-1]===SEP)?i-1:i;a.splice(at,0,it);return a}}
window.PrismLens={NAME,DEF,NP,model,runSync,runAsync,cpuRender,glRender,autoCA,lensDialog,glOK:()=>!!glInit(),profiles:{load:LF.load,find:LF.find,params:LF.params,shot:LF.shot}};
})();
