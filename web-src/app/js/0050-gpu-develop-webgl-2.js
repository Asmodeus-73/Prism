/* ================= GPU develop (WebGL 2) ================= */
const GPU=(()=>{const G={ok:false};let gl,cv,P={},vao,tSrc,tMask,tLut,tHsl,tOne,fbs={};
  const VS=`#version 300 es
in vec2 p;out vec2 vUv;void main(){vUv=p*.5+.5;gl_Position=vec4(p,0.,1.);}`;
  const COPY=`#version 300 es
precision highp float;in vec2 vUv;out vec4 o;uniform sampler2D t;void main(){o=texture(t,vUv);}`;
  const BLUR=`#version 300 es
precision highp float;in vec2 vUv;out vec4 o;uniform sampler2D t;uniform vec2 dir;uniform float sig;
void main(){float ws=0.;vec4 a=vec4(0.);int r=int(ceil(sig*3.));for(int i=-40;i<=40;i++){if(i<-r||i>r)continue;float w=exp(-float(i*i)/(2.*sig*sig));a+=texture(t,vUv+dir*float(i))*w;ws+=w;}o=a/ws;}`;
  const DEV=`#version 300 es
precision highp float;in vec2 vUv;out vec4 o;
uniform sampler2D uSrc,uLut,uHsl,uMask,uBc,uBt,uBs,uBn;uniform int uF;
uniform float uCl,uTx,uSp,uNr,uSat,uVib,uDhs,uBal,uVg,uR0,uR1,uGr,uGs,uOp,uSc;uniform vec3 uSo,uMo,uHo;uniform vec2 uOr,uDoc,uSize;
const vec3 LW=vec3(.2126,.7152,.0722);
float lut(int c,float v){float f=clamp(v,0.,1.)*4095.;int i=int(floor(f));int j=min(i+1,4095);return mix(texelFetch(uLut,ivec2(i,0),0)[c],texelFetch(uLut,ivec2(j,0),0)[c],f-float(i));}
vec3 rgb2hsl(vec3 c){float mx=max(c.r,max(c.g,c.b)),mn=min(c.r,min(c.g,c.b)),l=(mx+mn)*.5,d=mx-mn;if(d<1e-4)return vec3(0.,0.,l);float s=l>.5?d/(2.-mx-mn):d/(mx+mn);float h;
 if(mx==c.r)h=(c.g-c.b)/d+(c.g<c.b?6.:0.);else if(mx==c.g)h=(c.b-c.r)/d+2.;else h=(c.r-c.g)/d+4.;return vec3(h/6.,s,l);}
vec3 hsl2rgb(vec3 c){vec3 rgb=clamp(abs(mod(c.x*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.);return c.z+c.y*(rgb-.5)*(1.-abs(2.*c.z-1.));}
void main(){vec4 s=texture(uSrc,vUv);vec3 c=s.rgb,orig=c;
 if((uF&15)!=0){float y=dot(c,LW),dy=0.;
  if((uF&1)!=0){float b=dot(texture(uBc,vUv).rgb,LW);float m=1.-abs(2.*y-1.);dy+=uCl*1.1*(y-b)*(.25+.75*m);}
  if((uF&2)!=0){dy+=uTx*1.3*(y-dot(texture(uBt,vUv).rgb,LW));}
  if((uF&4)!=0){dy+=uSp*1.8*(y-dot(texture(uBs,vUv).rgb,LW));}
  if((uF&8)!=0){vec3 bn=texture(uBn,vUv).rgb;float df=y-dot(bn,LW);float e=min(1.,abs(df)*14.);dy-=uNr*df*(1.-e);vec3 cc=c-y,bc=bn-dot(bn,LW);c+=(bc-cc)*min(1.,uNr*1.2)*(1.-smoothstep(.04,.12,length(cc-bc)));}
  c+=dy;}
 c=vec3(lut(0,c.r),lut(1,c.g),lut(2,c.b));
 if((uF&16)!=0){float l=dot(c,LW);float f=1.+uSat+uDhs;if(uVib!=0.){float mx=max(c.r,max(c.g,c.b)),mn=min(c.r,min(c.g,c.b));f+=uVib*(1.-(mx-mn))*(uVib>0.?1.1:1.);}c=l+(c-l)*max(f,0.);}
 if((uF&32)!=0){c=clamp(c,0.,1.);vec3 h=rgb2hsl(c);if(h.y>0.){int hi=min(359,int(h.x*360.));vec4 t=texelFetch(uHsl,ivec2(hi,0),0);float w=min(1.,h.y*2.2);
   float h2=fract(h.x+t.r*w/360.);c=hsl2rgb(vec3(h2,clamp(h.y*(1.+max(t.g,0.)),0.,1.),clamp(h.z*(1.+t.b*w),0.,1.)));if(t.g<0.){float yy=dot(c,LW);c=mix(vec3(yy),c,1.+t.g);}}}
 if((uF&64)!=0){float l=dot(c,LW);float t=clamp(l+uBal,0.,1.);float ws=(1.-t)*(1.-t),wh=t*t,wm=1.-ws-wh;c+=ws*uSo+wm*uMo+wh*uHo;}
 vec2 px=vec2(gl_FragCoord.x,uSize.y-gl_FragCoord.y);vec2 dp=(px-uOr)/uSc;
 if((uF&128)!=0){vec2 v=(dp-uDoc*.5)/(uDoc*.5);float dd=length(v)/1.4142;float w=smoothstep(uR0,uR1,dd);if(uVg<0.)c*=1.+uVg*w;else c+=(1.-c)*uVg*w;}
 if((uF&256)!=0){vec2 g=floor(dp/uGs);float n=fract(sin(dot(g,vec2(12.9898,78.233)))*43758.5453)-.5;float l=dot(c,LW);c+=n*uGr*(.35+2.6*l*(1.-l));}
 c=clamp(c,0.,1.);float m=uOp;if((uF&512)!=0)m*=texture(uMask,vUv).a;
 o=vec4(mix(orig,c,m),s.a);}`;
  function sh(t,src){const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s}
  function prog(fs){const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,VS));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.bindAttribLocation(p,0,'p');gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));p.u={};const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);for(let i=0;i<n;i++){const a=gl.getActiveUniform(p,i);p.u[a.name]=gl.getUniformLocation(p,a.name)}return p}
  function tex(f){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,f);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,f);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t}
  function fb(name,w,h){let f=fbs[name];if(f&&f.w===w&&f.h===h)return f;if(f){gl.deleteTexture(f.t);gl.deleteFramebuffer(f.f)}const t=tex(gl.LINEAR);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);const fo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);f=fbs[name]={t,f:fo,w,h};return f}
  function draw(p,fbo,w,h){gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.viewport(0,0,w,h);gl.useProgram(p);gl.bindVertexArray(vao);gl.drawArrays(gl.TRIANGLE_STRIP,0,4)}
  function bindT(u,t){gl.activeTexture(gl.TEXTURE0+u);gl.bindTexture(gl.TEXTURE_2D,t)}
  function blur(src,w,h,sig,name){let cw=w,ch=h,cur=src,k=0;const f=Math.max(1,Math.floor(sig/3));const tw=Math.max(1,Math.round(w/f)),th=Math.max(1,Math.round(h/f));
    while(cw/2>=tw&&ch/2>=th&&cw>2&&ch>2){cw=Math.max(1,cw>>1);ch=Math.max(1,ch>>1);const d=fb(name+'h'+k++,cw,ch);bindT(0,cur);gl.useProgram(P.copy);gl.uniform1i(P.copy.u.t,0);draw(P.copy,d.f,cw,ch);cur=d.t}
    if(cw!==tw||ch!==th){const d=fb(name+'f',tw,th);bindT(0,cur);gl.useProgram(P.copy);gl.uniform1i(P.copy.u.t,0);draw(P.copy,d.f,tw,th);cur=d.t}
    const s2=sig*tw/w,a=fb(name+'a',tw,th),b=fb(name+'b',tw,th);gl.useProgram(P.blur);gl.uniform1i(P.blur.u.t,0);gl.uniform1f(P.blur.u.sig,Math.max(0.3,s2));
    bindT(0,cur);gl.uniform2f(P.blur.u.dir,1/tw,0);draw(P.blur,a.f,tw,th);bindT(0,a.t);gl.uniform2f(P.blur.u.dir,0,1/th);draw(P.blur,b.f,tw,th);return b.t}
  let f32o=null;function fb32(w,h){if(f32o&&f32o.w===w&&f32o.h===h)return f32o;if(f32o){gl.deleteTexture(f32o.t);gl.deleteFramebuffer(f32o.f)}const t=tex(gl.NEAREST);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,w,h,0,gl.RGBA,gl.FLOAT,null);const fo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);f32o={t,f:fo,w,h};return f32o}
  G.init=()=>{try{cv=document.createElement('canvas');gl=cv.getContext('webgl2',{premultipliedAlpha:false,preserveDrawingBuffer:true,antialias:false,depth:false,stencil:false,alpha:true});if(!gl)return;
    P.copy=prog(COPY);P.blur=prog(BLUR);P.dev=prog(DEV);vao=gl.createVertexArray();gl.bindVertexArray(vao);const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    tSrc=tex(gl.LINEAR);tMask=tex(gl.LINEAR);tLut=tex(gl.NEAREST);tHsl=tex(gl.NEAREST);tOne=tex(gl.NEAREST);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
    G.max=Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE),gl.getParameter(gl.MAX_VIEWPORT_DIMS)[0]);G.float=!!gl.getExtension('EXT_color_buffer_float');G.flin=!!gl.getExtension('OES_texture_float_linear');G.canvas=cv;cv.width=cv.height=G.max;G.area=gl.drawingBufferWidth*gl.drawingBufferHeight;cv.width=cv.height=1;G.ok=true;
    cv.addEventListener('webglcontextlost',e=>{e.preventDefault();G.ok=false;toast('Le moteur graphique a été réinitialisé : passage en mode processeur')})}catch(e){console.warn('WebGL2 indisponible',e);G.ok=false}};
  let lutKey='',hslKey='';
  G.develop=(src,dv,mask,opacity,o)=>{const W=src.width,H=src.height,FL=!!src.f32;if(!FL){if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}if(gl.drawingBufferWidth!==W||gl.drawingBufferHeight!==H)throw new Error('drawing buffer')}G.space&&G.space(gl);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
    bindT(0,tSrc);if(FL){gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,G.flin?gl.RGBA32F:gl.RGBA16F,W,H,0,gl.RGBA,gl.FLOAT,src.f32);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true)}else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src);
    if(mask){bindT(3,tMask);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,mask)}else bindT(3,tOne);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
    const L=getLUTs(dv),lk=JSON.stringify([dv.temp,dv.tint,dv.exposure,dv.contrast,dv.highlights,dv.shadows,dv.whites,dv.blacks,dv.dehaze,dv.curve]);bindT(1,tLut);
    if(lk!==lutKey){const a=new Float32Array(4096*4);for(let i=0;i<4096;i++){a[i*4]=L[0][i];a[i*4+1]=L[1][i];a[i*4+2]=L[2][i];a[i*4+3]=1}gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,4096,1,0,gl.RGBA,gl.FLOAT,a);lutKey=lk}
    const HT=getHSLT(dv);bindT(2,tHsl);const hk=dv.hslH.join()+'|'+dv.hslS.join()+'|'+dv.hslL.join();if(HT&&hk!==hslKey){const a=new Float32Array(360*4);for(let i=0;i<360;i++){a[i*4]=HT.H[i];a[i*4+1]=HT.Sa[i];a[i*4+2]=HT.Lu[i];a[i*4+3]=1}gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,360,1,0,gl.RGBA,gl.FLOAT,a);hslKey=hk}
    const p=devParams(dv,o);let F=0;const bl=[];
    if(p.cl){F|=1;bl[4]=blur(tSrc,W,H,p.sigC,'c')}if(p.tx){F|=2;bl[5]=blur(tSrc,W,H,p.sigT,'t')}if(p.sp){F|=4;bl[6]=blur(tSrc,W,H,p.sigS,'s')}if(p.nr){F|=8;bl[7]=blur(tSrc,W,H,p.sigN,'n')}
    if(p.sat||p.vib||p.dhs)F|=16;if(HT)F|=32;if(p.grade)F|=64;if(p.vg)F|=128;if(p.gr)F|=256;if(mask)F|=512;
    bindT(0,tSrc);bindT(1,tLut);bindT(2,tHsl);bindT(3,mask?tMask:tOne);for(let u=4;u<8;u++)bindT(u,bl[u]||tOne);
    const pr=P.dev,U=pr.u;gl.useProgram(pr);['uSrc','uLut','uHsl','uMask','uBc','uBt','uBs','uBn'].forEach((n,i)=>U[n]&&gl.uniform1i(U[n],i));
    gl.uniform1i(U.uF,F);const f1=(n,v)=>U[n]&&gl.uniform1f(U[n],v);f1('uCl',p.cl);f1('uTx',p.tx);f1('uSp',p.sp);f1('uNr',p.nr);f1('uSat',p.sat);f1('uVib',p.vib);f1('uDhs',p.dhs);f1('uBal',p.bal);f1('uVg',p.vg);f1('uR0',p.r0);f1('uR1',p.r1);f1('uGr',p.gr);f1('uGs',p.gs);f1('uOp',opacity);f1('uSc',o.scale);
    U.uSo&&gl.uniform3fv(U.uSo,p.so);U.uMo&&gl.uniform3fv(U.uMo,p.mo);U.uHo&&gl.uniform3fv(U.uHo,p.ho);U.uOr&&gl.uniform2f(U.uOr,o.ox,o.oy);U.uDoc&&gl.uniform2f(U.uDoc,o.docW,o.docH);U.uSize&&gl.uniform2f(U.uSize,W,H);
    if(FL){const f=fb32(W,H);bindT(7,bl[7]||tOne);draw(pr,f.f,W,H);const out=new Float32Array(W*H*4);gl.readPixels(0,0,W,H,gl.RGBA,gl.FLOAT,out);gl.bindFramebuffer(gl.FRAMEBUFFER,null);return out}draw(pr,null,W,H);return cv};
  return G})();
GPU.init();

