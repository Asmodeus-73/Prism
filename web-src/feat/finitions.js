/* ===== finitions : réglages de couleur ajoutés au panneau Réglages =====
   Clarté sélective, Teinte et luminosité, Niveaux, Remplacer la couleur, Supprimer la couleur, Décolorer, Noir et blanc,
   Couleur monochrome, Sépia, Mélangeur de couches, Inverser.
   Conception
   - Rangés sur le calque de réglage : L.dev.fx = {id: {on, ...valeurs}}. La clé n'existe que si un groupe a été touché, donc devIsId() reste vrai
     pour un réglage neutre. Le reste de dev (curseurs, courbes...) passe d'abord, ces finitions ensuite, puis la LUT (lutxmp.js enveloppe ce fichier).
   - Rendu sur le processeur, en enveloppant applyAdjust (pile 8 bits) et devFloat (pile 16 bits / flottante), masque et opacité respectés.
   - Chaque groupe a un interrupteur. Bouger un de ses curseurs l'allume. ===== */
const FX_SECS=[
  {id:'selcl',after:'presence',title:'Clarté sélective',tabs:['Tons foncés','Tons moyens','Tons clairs'],rows:i=>[['tx'+i,'Texture',-100,100,1,0],['cl'+i,'Clarté',-100,100,1,0]]},
  {id:'hue',after:'fx-selcl',title:'Teinte et luminosité',rows:()=>[['hue','Teinte',-180,180,1,0,'hue'],['bril','Brillance',-100,100,1,0],['bright','Luminosité',-100,100,1,0]]},
  {id:'lv',after:'curve',title:'Niveaux',tabs:['RVB','Rouge','Vert','Bleu'],hist:true,rows:i=>[['ib'+i,'Noir (entrée)',0,253,1,0],['gm'+i,'Tons moyens',0.1,9.99,0.01,1],['iw'+i,'Blanc (entrée)',2,255,1,255],['ob'+i,'Noir (sortie)',0,255,1,0],['ow'+i,'Blanc (sortie)',0,255,1,255]]},
  {id:'repl',after:'hsl',title:'Remplacer la couleur',colors:[['from','Couleur à changer',null],['to','Nouvelle couleur',null]],rows:()=>[['range','Intervalle',0,100,1,50],['k','Intensité',0,100,1,100]]},
  {id:'rmc',after:'grade',title:'Supprimer la couleur',colors:[['col','Couleur',null]],rows:()=>[['cr','Plage de couleurs',0,100,1,50],['lr','Plage de luminance',0,100,1,25],['k','Intensité',0,100,1,100]]},
  {id:'fade',after:'fx-rmc',title:'Décolorer',rows:()=>[['nb','Noirs',0,100,1,100],['wb','Blancs',0,100,1,0]]},
  {id:'bw',after:'fx-fade',title:'Noir et blanc',rows:()=>[['r','Rouge',-100,100,1,0,'linear-gradient(90deg,#3a1d1d,#e5483d)'],['g','Vert',-100,100,1,0,'linear-gradient(90deg,#1d3a20,#45b450)'],['b','Bleu',-100,100,1,0,'linear-gradient(90deg,#1d253a,#4a7be6)'],['tone','Ton',-100,100,1,0,'linear-gradient(90deg,#5b86c9,#bdbdbd,#c99a5b)'],['k','Intensité',0,100,1,100]]},
  {id:'mono',after:'fx-bw',title:'Couleur monochrome',colors:[['col','Couleur','#8d7454']],rows:()=>[['k','Intensité',0,100,1,100]]},
  {id:'sepia',after:'fx-mono',title:'Sépia',rows:()=>[['k','Intensité',0,100,1,100]]},
  {id:'mix',after:'fx-sepia',title:'Mélangeur de couches',tabs:['Rouge','Vert','Bleu'],rows:i=>{const o='rgb'[i];return[[o+'r','Rouge',-200,200,1,i===0?100:0],[o+'g','Vert',-200,200,1,i===1?100:0],[o+'b','Bleu',-200,200,1,i===2?100:0],[o+'c','Constante',-200,200,1,0]]}},
  {id:'inv',after:'fx-mix',title:'Inverser',rows:()=>[['k','Intensité',0,100,1,100]]},
  /* lueur : une lumière qui déborde des zones claires, en cinq styles (choix « style »). Les deux derniers curseurs ne servent qu'aux styles filé et traînée. */
  {id:'glow',after:'effects',title:'Lueur',choice:['style','Style',['Éclat','Diffusion','Halo','Filé','Traînée']],
   rows:()=>[['k','Intensité',0,100,1,40],['thr','Seuil',0,100,1,60],['spread','Étendue',0,100,1,40],['warm','Chaleur',-100,100,1,0,'linear-gradient(90deg,#4f7fd8,#d8d0b8,#e2b23c)'],['dir','Direction',0,180,1,0,null,[3,4]],['soft','Douceur',0,100,1,40,null,[3,4]]]}];
/* valeurs par défaut et bornes, par groupe */
const FXD={},FXR={},FXT={};
for(const s of FX_SECS){const d={},r={};const pages=s.tabs?s.tabs.map((_,i)=>s.rows(i)):[s.rows(0)];for(const rows of pages)for(const q of rows){d[q[0]]=q[5];r[q[0]]=q}for(const c of s.colors||[])d[c[0]]=c[2];if(s.choice)d[s.choice[0]]=0;FXD[s.id]=d;FXR[s.id]=r;FXT[s.id]=s.title}
const fxv=(fx,s,k)=>{const o=fx&&fx[s];return o&&o[k]!==undefined?o[k]:FXD[s][k]};
const fxOn=(fx,s)=>!!(fx&&fx[s]&&fx[s].on);
function fxAny(fx){if(!fx)return false;for(const s in fx)if(fx[s]&&fx[s].on)return true;return false}
const hexRGB=h=>{const v=parseInt(String(h).slice(1),16);return[((v>>16)&255)/255,((v>>8)&255)/255,(v&255)/255]};
const sm=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
function rgb2hsl(r,g,b){const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;if(mx-mn<1e-6)return[0,0,l];const d=mx-mn,s=l>0.5?d/(2-mx-mn):d/(mx+mn);
  let h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;return[h/6,s,l]}

/* ---------------------------------------------------------------- lueur */
/* Taille de la lueur en pixels de la photo : Étendue 0..100 -> 0,4 % à 8 % du petit côté. Filé et traînée s'étirent plus loin. */
function glowSigma(fx,docW,docH){const s=fxv(fx,'glow','spread')/100,st=fxv(fx,'glow','style'),base=Math.min(docW,docH)*(0.004+0.076*s*s);return Math.min(Math.min(docW,docH)*0.1,st===3?base*2.2:st===4?base*6:base)}
/* flou le long d'une direction (dx,dy), par passes de pas croissant (1, 4, 16...) : coût indépendant de la longueur */
function dirBlur(P,w,h,dx,dy,len){let a=P,b=new Float32Array(P.length);const T=[-3,-2,-1,0,1,2,3],Wt=T.map(t=>Math.exp(-t*t/4.5)),ws=Wt.reduce((x,y)=>x+y,0);
  for(let st=1;st<=len/3;st*=4){for(let y=0,i=0;y<h;y++)for(let x=0;x<w;x++,i++){let acc=0;for(let k=0;k<7;k++){let sx=x+T[k]*st*dx,sy=y+T[k]*st*dy;sx=sx<0?0:sx>w-1?w-1:sx;sy=sy<0?0:sy>h-1?h-1:sy;
      const x0=sx|0,y0=sy|0,x1=x0<w-1?x0+1:x0,y1=y0<h-1?y0+1:y0,fx_=sx-x0,fy=sy-y0,r0=y0*w,r1=y1*w;acc+=Wt[k]*((a[r0+x0]*(1-fx_)+a[r0+x1]*fx_)*(1-fy)+(a[r1+x0]*(1-fx_)+a[r1+x1]*fx_)*fy)}
    b[i]=acc/ws}const t=a;a=b;b=t===P?new Float32Array(P.length):t}return a}
/* calcule la lumière ajoutée, à une définition réduite (la lueur est floue : inutile de la calculer pixel par pixel) */
function glowBuf(data,W,H,mul,flip,fx,o){const k=fxv(fx,'glow','k')/100;if(!k)return null;const sc=o.scale||1,st=fxv(fx,'glow','style'),dW=S.doc?S.doc.w:W,dH=S.doc?S.doc.h:H;
  const sig=Math.max(1,glowSigma(fx,dW,dH)*sc),thr=fxv(fx,'glow','thr')/100,dirl=st>=3,soft=fxv(fx,'glow','soft')/100;
  const perp=dirl?Math.max(0.6,sig*(0.01+0.1*soft)):sig;const f=Math.max(sig>6?2:1,Math.min(24,Math.floor(dirl?Math.max(perp/2,sig/10):st===2?sig*0.12:sig/4))),w=Math.max(1,Math.ceil(W/f)),h=Math.max(1,Math.ceil(H/f)),inv=1/mul;
  const R=new Float32Array(w*h),G=new Float32Array(w*h),B=new Float32Array(w*h),cnt=new Float32Array(w*h);
  const t0=st===1?0:thr*0.9,t1=st===1?1:Math.min(1.02,thr*0.9+0.25);
  for(let y=0;y<H;y++){const yy=flip?H-1-y:y,row=((yy/f)|0)*w;for(let x=0,j=y*W*4;x<W;x++,j+=4){const r=data[j]*inv,g=data[j+1]*inv,b=data[j+2]*inv,a=data[j+3]*inv,l=0.2126*r+0.7152*g+0.0722*b;
    let m=st===1?(0.2+0.8*l*l):sm((l-t0)/(t1-t0));m*=a;const q=row+((x/f)|0);R[q]+=r*m;G[q]+=g*m;B[q]+=b*m;cnt[q]++}}
  for(let i=0;i<w*h;i++){const c=cnt[i]||1;R[i]/=c;G[i]/=c;B[i]/=c}
  const s=sig/f;let out;
  if(dirl){const an=fxv(fx,'glow','dir')*Math.PI/180,dx=Math.cos(an),dy=-Math.sin(an),ps=perp/f;out=[R,G,B].map(P=>{let q=dirBlur(P,w,h,dx,dy,s*3);if(ps>0.5)q=gaussF(q,w,h,ps);return q});
    if(st===4){const q=out.map(P=>dirBlur(P,w,h,dx,dy,s*0.8));out=out.map((P,c)=>{for(let i=0;i<P.length;i++)P[i]=P[i]*0.6+q[c][i]*0.8;return P})}}
  else if(st===2){const a=[R,G,B].map(P=>gaussF(P,w,h,s*0.5)),b=[R,G,B].map(P=>gaussF(P,w,h,Math.max(0.5,s*0.12)));
    /* halo : la frange autour des zones claires, rouge orangé comme la lumière renvoyée par le dos d'un film */
    out=[0,1,2].map(()=>new Float32Array(w*h));const T=[1,0.32,0.1];for(let i=0;i<w*h;i++){const la=0.2126*a[0][i]+0.7152*a[1][i]+0.0722*a[2][i],lb=0.2126*b[0][i]+0.7152*b[1][i]+0.0722*b[2][i],v=Math.max(0,la-lb)*2.4;for(let c=0;c<3;c++)out[c][i]=v*T[c]}}
  else out=[R,G,B].map(P=>gaussF(P,w,h,st===1?s*0.6:s));
  const wm=fxv(fx,'glow','warm')/100,tint=[1+0.35*wm,1+0.05*wm,1-0.35*wm],gain=st===1?1:st===2?1.4:st===4?3:st===3?1.8:2.4;
  for(let c=0;c<3;c++){const P=out[c],g=tint[c]*gain*k;for(let i=0;i<P.length;i++)P[i]*=g}
  const Q={f,w,h,R:out[0],G:out[1],B:out[2],diff:st===1?k*0.5:0};glowTabs(Q,W,H);return Q}
/* tables d'interpolation (colonnes et lignes) de la définition réduite vers la photo : calculées une fois par rendu */
function glowTabs(Q,W,H){const ax=(n,N,f)=>{const i0=new Int32Array(n),i1=new Int32Array(n),t=new Float32Array(n);for(let x=0;x<n;x++){const u=(x+0.5)/f-0.5,a=Math.max(0,Math.min(N-1,Math.floor(u)));i0[x]=a;i1[x]=Math.min(N-1,a+1);t[x]=Math.max(0,Math.min(1,u-a))}return{i0,i1,t}};
  Q.X=ax(W,Q.w,Q.f);Q.Y=ax(H,Q.h,Q.f);Q.row=new Float32Array(W*3);Q.ry=-1}
/* une ligne de la lueur, interpolée, mise en cache tant qu'on reste sur la même ligne */
function glowRow(Q,y){if(Q.ry===y)return Q.row;Q.ry=y;const r0=Q.Y.i0[y]*Q.w,r1=Q.Y.i1[y]*Q.w,ty=Q.Y.t[y],X=Q.X,o=Q.row,P=[Q.R,Q.G,Q.B];
  for(let c=0;c<3;c++){const A=P[c];for(let x=0,k=c;x<X.i0.length;x++,k+=3){const a=X.i0[x],b=X.i1[x],t=X.t[x],top=A[r0+a]+(A[r0+b]-A[r0+a])*t,bot=A[r1+a]+(A[r1+b]-A[r1+a])*t;o[k]=top+(bot-top)*ty}}return o}

/* ---------------------------------------------------------------- calcul */
/* data : RVBA (0..mul), W x H ; flip : lignes de bas en haut (pile flottante) alors que le masque est de haut en bas */
function fxRun(data,W,H,mul,flip,fx,amt,mask,o){
  const N=W*H,inv=1/mul,sc=o.scale||1;
  /* clarté sélective : flous de la luminance */
  let Y=null,Bc=null,Bt=null,sTx=null,sCl=null;
  if(fxOn(fx,'selcl')){sTx=[0,1,2].map(i=>fxv(fx,'selcl','tx'+i)/100);sCl=[0,1,2].map(i=>fxv(fx,'selcl','cl'+i)/100);
    if(sTx.some(v=>v)||sCl.some(v=>v)){Y=new Float32Array(N);for(let i=0,j=0;i<N;i++,j+=4)Y[i]=(0.2126*data[j]+0.7152*data[j+1]+0.0722*data[j+2])*inv;
      const short=Math.min(S.doc?S.doc.w:W,S.doc?S.doc.h:H);if(sCl.some(v=>v))Bc=gaussF(Y,W,H,Math.max(0.6,short*0.012*sc));if(sTx.some(v=>v))Bt=gaussF(Y,W,H,Math.max(0.5,3.5*sc))}}
  /* teinte et luminosité */
  let HM=null,bril=0,bgam=1;if(fxOn(fx,'hue')){const a=fxv(fx,'hue','hue')*Math.PI/180;bril=fxv(fx,'hue','bril')/100;bgam=Math.pow(2,-fxv(fx,'hue','bright')/100*0.8);
    if(a){const c=Math.cos(a),s=Math.sin(a);HM=[0.213+c*0.787-s*0.213,0.715-c*0.715-s*0.715,0.072-c*0.072+s*0.928,0.213-c*0.213+s*0.143,0.715+c*0.285+s*0.140,0.072-c*0.072-s*0.283,0.213-c*0.213-s*0.787,0.715-c*0.715+s*0.715,0.072+c*0.928+s*0.072]}}
  /* niveaux : tables 0..1 -> 0..1 (4096 cases) */
  let LV=null;if(fxOn(fx,'lv')){const mkT=i=>{const ib=fxv(fx,'lv','ib'+i),iw=Math.max(ib+2,fxv(fx,'lv','iw'+i)),gm=fxv(fx,'lv','gm'+i),ob=fxv(fx,'lv','ob'+i),ow=fxv(fx,'lv','ow'+i);
      if(ib===0&&iw===255&&gm===1&&ob===0&&ow===255)return null;const T=new Float32Array(4097);for(let k=0;k<=4096;k++){let t=(k/4096*255-ib)/(iw-ib);t=t<0?0:t>1?1:t;t=Math.pow(t,1/gm);T[k]=(ob+t*(ow-ob))/255}return T};
    LV=[mkT(0),mkT(1),mkT(2),mkT(3)];if(!LV.some(Boolean))LV=null}
  const lk=(T,v)=>{if(v<=0)return T[0];if(v>=1)return T[4096];const f=v*4096,i=f|0;return T[i]+(T[i+1]-T[i])*(f-i)};
  /* remplacer la couleur */
  let RP=null;if(fxOn(fx,'repl')){const f=fxv(fx,'repl','from'),t=fxv(fx,'repl','to');if(f&&t){const a=hexRGB(f),b=hexRGB(t),ya=0.2126*a[0]+0.7152*a[1]+0.0722*a[2],ha=rgb2hsl(...a),hb=rgb2hsl(...b);
    RP={y:ya,cb:a[2]-ya,cr:a[0]-ya,tol:0.03+fxv(fx,'repl','range')/100*0.45,k:fxv(fx,'repl','k')/100,dh:hb[0]-ha[0],ds:hb[1]-ha[1],dl:hb[2]-ha[2],grey:ha[1]<0.04,hb}}}
  /* supprimer la couleur */
  let RM=null;if(fxOn(fx,'rmc')){const c=fxv(fx,'rmc','col');if(c){const a=hexRGB(c),ya=0.2126*a[0]+0.7152*a[1]+0.0722*a[2];RM={y:ya,cb:a[2]-ya,cr:a[0]-ya,tc:0.02+fxv(fx,'rmc','cr')/100*0.4,tl:0.02+fxv(fx,'rmc','lr')/100*0.98,k:fxv(fx,'rmc','k')/100}}}
  const FD=fxOn(fx,'fade')?{nb:fxv(fx,'fade','nb')/100*0.22,wb:fxv(fx,'fade','wb')/100*0.22}:null;
  let BW=null;if(fxOn(fx,'bw')){const t=fxv(fx,'bw','tone')/100;BW={r:fxv(fx,'bw','r')/100,g:fxv(fx,'bw','g')/100,b:fxv(fx,'bw','b')/100,k:fxv(fx,'bw','k')/100,t:Math.abs(t),off:t?hueOff(t>0?35:215):null}}
  const MO=fxOn(fx,'mono')?{c:hexRGB(fxv(fx,'mono','col')||'#8d7454'),k:fxv(fx,'mono','k')/100}:null;
  const SP=fxOn(fx,'sepia')?fxv(fx,'sepia','k')/100:0;
  let MX=null;if(fxOn(fx,'mix')){MX=[];for(const o of 'rgb')for(const i of 'rgbc')MX.push(fxv(fx,'mix',o+i)/100);if(MX.join()==='1,0,0,0,0,1,0,0,0,0,1,0')MX=null}
  const IV=fxOn(fx,'inv')?fxv(fx,'inv','k')/100:0;
  const GL=fxOn(fx,'glow')?glowBuf(data,W,H,mul,flip,fx,o):null;
  if(!Y&&!HM&&!bril&&bgam===1&&!LV&&!RP&&!RM&&!FD&&!BW&&!MO&&!SP&&!MX&&!IV&&!GL)return false;
  for(let y=0,i=0;y<H;y++){const my=flip?H-1-y:y;for(let x=0;x<W;x++,i++){const j=i*4;
    const r0=data[j]*inv,g0=data[j+1]*inv,b0=data[j+2]*inv,a0=data[j+3]*inv;let r=r0,g=g0,b=b0,a=a0;
    if(Y){const yy=Y[i],ws=(1-yy)*(1-yy),wh=yy*yy,wm=1-ws-wh;let dy=0;
      if(Bc){const m=1-Math.abs(2*yy-1),cl=ws*sCl[0]+wm*sCl[1]+wh*sCl[2];dy+=cl*1.1*(yy-Bc[i])*(0.25+0.75*m)}
      if(Bt){const tx=ws*sTx[0]+wm*sTx[1]+wh*sTx[2];dy+=tx*1.3*(yy-Bt[i])}r+=dy;g+=dy;b+=dy}
    if(HM){const nr=HM[0]*r+HM[1]*g+HM[2]*b,ng=HM[3]*r+HM[4]*g+HM[5]*b,nb=HM[6]*r+HM[7]*g+HM[8]*b;r=nr;g=ng;b=nb}
    if(bril){const k=bril*0.5*(Math.max(r,g,b)-Math.min(r,g,b));if(k>0){r+=(1-r)*k;g+=(1-g)*k;b+=(1-b)*k}else{r*=1+k;g*=1+k;b*=1+k}}
    if(bgam!==1){r=r>0?Math.pow(r,bgam):r;g=g>0?Math.pow(g,bgam):g;b=b>0?Math.pow(b,bgam):b}
    if(LV){if(LV[1])r=lk(LV[1],r);if(LV[2])g=lk(LV[2],g);if(LV[3])b=lk(LV[3],b);if(LV[0]){r=lk(LV[0],r);g=lk(LV[0],g);b=lk(LV[0],b)}}
    if(RP){const yy=0.2126*r+0.7152*g+0.0722*b,d=Math.hypot(b-yy-RP.cb,r-yy-RP.cr,0.5*(yy-RP.y));if(d<RP.tol){const w=(1-sm(d/RP.tol))*RP.k;
      const h=rgb2hsl(r<0?0:r>1?1:r,g<0?0:g>1?1:g,b<0?0:b>1?1:b);let hh=RP.grey?RP.hb[0]:h[0]+RP.dh;hh-=Math.floor(hh);
      const c=hsl2rgbA(hh,Math.min(1,Math.max(0,h[1]+RP.ds)),Math.min(1,Math.max(0,h[2]+RP.dl)));r+=(c[0]-r)*w;g+=(c[1]-g)*w;b+=(c[2]-b)*w}}
    if(RM){const yy=0.2126*r+0.7152*g+0.0722*b,dc=Math.hypot(b-yy-RM.cb,r-yy-RM.cr),dl=Math.abs(yy-RM.y);if(dc<RM.tc&&dl<RM.tl)a*=1-(1-sm(dc/RM.tc))*(1-sm(dl/RM.tl))*RM.k}
    if(FD){r=FD.nb+r*(1-FD.nb);g=FD.nb+g*(1-FD.nb);b=FD.nb+b*(1-FD.nb);if(FD.wb){const f=1-FD.wb;r*=f;g*=f;b*=f}}
    if(BW){const l=0.2126*r+0.7152*g+0.0722*b;let v=l+1.2*(BW.r*(r-l)+BW.g*(g-l)+BW.b*(b-l));v=v<0?0:v>1?1:v;let nr=v,ng=v,nb=v;
      if(BW.off){const q=BW.t*0.72*v*(1-v);nr+=BW.off[0]*q;ng+=BW.off[1]*q;nb+=BW.off[2]*q}r+=(nr-r)*BW.k;g+=(ng-g)*BW.k;b+=(nb-b)*BW.k}
    if(MO){let l=0.2126*r+0.7152*g+0.0722*b;l=l<0?0:l>1?1:l;const c=MO.c,f=v=>l<0.5?2*l*v:1-2*(1-l)*(1-v);r+=(f(c[0])-r)*MO.k;g+=(f(c[1])-g)*MO.k;b+=(f(c[2])-b)*MO.k}
    if(SP){const nr=0.393*r+0.769*g+0.189*b,ng=0.349*r+0.686*g+0.168*b,nb=0.272*r+0.534*g+0.131*b;r+=(nr-r)*SP;g+=(ng-g)*SP;b+=(nb-b)*SP}
    if(MX){const nr=MX[0]*r+MX[1]*g+MX[2]*b+MX[3],ng=MX[4]*r+MX[5]*g+MX[6]*b+MX[7],nb=MX[8]*r+MX[9]*g+MX[10]*b+MX[11];r=nr;g=ng;b=nb}
    if(IV){r+=(1-2*r)*IV;g+=(1-2*g)*IV;b+=(1-2*b)*IV}
    if(GL){const gw=glowRow(GL,my),gr=gw[x*3],gg=gw[x*3+1],gb=gw[x*3+2];if(GL.diff){const d=GL.diff;r+=(0.5-r)*d*0.12;g+=(0.5-g)*d*0.12;b+=(0.5-b)*d*0.12}
      r=1-(1-r)*(1-Math.min(1,gr));g=1-(1-g)*(1-Math.min(1,gg));b=1-(1-b)*(1-Math.min(1,gb))}
    const m=amt*(mask?mask[(my*W+x)*4+3]/255:1);if(m<1){r=r0+(r-r0)*m;g=g0+(g-g0)*m;b=b0+(b-b0)*m;a=a0+(a-a0)*m}
    data[j]=(r<0?0:r>1?1:r)*mul;data[j+1]=(g<0?0:g>1?1:g)*mul;data[j+2]=(b<0?0:b>1?1:b)*mul;data[j+3]=(a<0?0:a>1?1:a)*mul}}
  return true}
window.PrismFinish={run:fxRun,sections:FX_SECS};
const stripFx=dv=>{const d={...dv};delete d.fx;return d};
{const _aa=applyAdjust;
 applyAdjust=function(tc,W,H,L,mc,o){const fx=L.dev&&L.dev.fx;if(!fx)return _aa.apply(this,arguments);
  const rest=stripFx(L.dev);if(!devIsId(rest))_aa(tc,W,H,{...L,dev:rest},mc,o);if(!fxAny(fx))return;
  const img=tc.getImageData(0,0,W,H);if(fxRun(img.data,W,H,255,false,fx,L.opacity,mc?rx(mc).getImageData(0,0,W,H).data:null,o))tc.putImageData(img,0,0)};
 const _df=devFloat;
 devFloat=function(F,W,H,L,mc,o){const fx=L.dev&&L.dev.fx;if(!fx)return _df.apply(this,arguments);
  const rest=stripFx(L.dev);if(!devIsId(rest))F=_df(F,W,H,{...L,dev:rest},mc,o);if(!fxAny(fx))return F;
  fxRun(F,W,H,1,true,fx,L.opacity,mc?rx(mc).getImageData(0,0,W,H).data:null,o);return F};
 /* la clarté sélective a besoin d'une marge entre les tuiles du rendu final */
 const _ms=maxSigma;
 maxSigma=function(dv,docW,docH,scale){let s=_ms.apply(this,arguments);const fx=dv&&dv.fx;if(fxOn(fx,'selcl')){for(let i=0;i<3;i++){if(fxv(fx,'selcl','cl'+i))s=Math.max(s,Math.min(docW,docH)*0.012*scale);if(fxv(fx,'selcl','tx'+i))s=Math.max(s,3.5*scale)}}if(fxOn(fx,'glow')&&fxv(fx,'glow','k'))s=Math.max(s,glowSigma(fx,docW,docH)*scale);return s}}

/* ---------------------------------------------------------------- panneau */
const pane=$('#pane-develop');
const RESET='<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10a6 6 0 1 0 1.9-4.4"/><path d="M4 3.8v3.4h3.4"/></svg>';
const PIP='<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13.2 2.8a2.2 2.2 0 0 1 3.1 3.1l-1.7 1.7-3.1-3.1z"/><path d="m11.5 6.5-7.6 7.6c-.4.4-.6.9-.6 1.4v1.2h1.2c.5 0 1-.2 1.4-.6l7.6-7.6"/><path d="m10.4 7.6 3 3"/></svg>';
const TAB={};
const HIDE='<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 10h10"/></svg>';
/* groupes affichés : ceux que l'on a ajoutés (mémorisés) et ceux qui servent sur le réglage choisi */
const PIN=new Set((()=>{try{const a=PREF.get('fxPinned',[]);return Array.isArray(a)?a:[]}catch(e){return[]}})());
const savePin=()=>{try{PREF.set('fxPinned',[...PIN])}catch(e){}};
const shown=(fx,s)=>PIN.has(s)||!!(fx&&fx[s]);
const css=document.createElement('style');css.textContent=`
details.sec>summary .fxsw{margin-left:auto;flex:none;width:28px;height:16px;border-radius:8px;border:0;padding:0;background:var(--line-2);position:relative;cursor:pointer}
details.sec>summary .fxsw::after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:var(--bg);box-shadow:0 1px 2px rgba(0,0,0,.25);transition:left .15s}
details.sec>summary .fxsw[aria-checked=true]{background:var(--accent)}
details.sec>summary .fxsw[aria-checked=true]::after{left:14px}
details.sec.fxsec:not(.fxlive) .secbody .row{opacity:.6}
.fxcol{display:flex;align-items:center;gap:8px;padding:4px 0}
.fxcol label{flex:1;font-size:12px;color:var(--fg-2)}
.fxcol input[type=color]{width:56px;height:24px;padding:0 2px;border:1px solid var(--field-line);border-radius:var(--r-s);background:var(--field);cursor:pointer}
.fxcol input[type=color].none{opacity:.35}
.fxcol button{width:28px;height:24px;display:grid;place-items:center;border:1px solid var(--field-line);border-radius:var(--r-s);background:var(--field);color:var(--fg-2);padding:0;cursor:pointer}
.fxcol button.on{background:var(--accent-soft);color:var(--accent-fg);border-color:var(--accent-line)}
#pane-develop .row[data-fk]{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"l o" "s s";column-gap:8px;row-gap:0;min-height:42px;align-content:center;padding:3px 0}
#pane-develop .row[data-fk] label{grid-area:l;font-size:12.5px}
#pane-develop .row[data-fk] output{grid-area:o;font-size:12.5px;padding:1px 6px;border-radius:5px;min-width:44px}
#pane-develop .row[data-fk] input[type=range]{grid-area:s;width:100%}
.fxadd{padding:10px 14px 14px;border-top:1px solid var(--line)}
.fxadd button{width:100%;justify-content:center}
details.sec>summary .fxhide{width:24px;height:24px;display:grid;place-items:center;border:0;background:none;border-radius:var(--r-s);color:var(--fg-3);padding:0;opacity:0;transition:opacity .12s}
details.sec>summary:hover .fxhide,details.sec>summary .fxhide:focus-visible{opacity:1}
details.sec>summary .fxhide:hover{background:var(--raise);color:var(--fg)}
.fxhist{width:100%;height:auto;display:block;margin:6px 0 2px;border-radius:var(--r-s);background:var(--hist-bg,transparent)}`;
document.head.appendChild(css);
const fmt=(q,v)=>q[4]<1?(+v).toFixed(2):(q[6]==='hue'?Math.round(v)+'°':(q[2]<0&&v>0?'+':'')+Math.round(v));
function rowHTML(s,q){const tr=q[6]==='hue'?`style="--track:${HUE_TRACK}"`:q[6]?`style="--track:${q[6]}"`:'';const id=`fx-${s.id}-${q[0]}`;
  return`<div class="row" data-fk="${s.id}:${q[0]}"${q[7]?` data-only="${q[7].join(' ')}"`:''}><label for="${id}" title="Double-clic pour réinitialiser">${q[1]}</label><input type="range" id="${id}" data-fk="${s.id}:${q[0]}" min="${q[2]}" max="${q[3]}" step="${q[4]}" ${tr}><output></output></div>`}
function secHTML(s){let b='';
  if(s.hist)b+=`<canvas class="fxhist" data-fxhist="${s.id}" width="520" height="110"></canvas>`;
  if(s.tabs){TAB[s.id]=TAB[s.id]||0;b+=`<div class="subtabs" data-fxtabs="${s.id}">${s.tabs.map((t,i)=>`<button type="button" data-fxtab="${i}" class="${i===TAB[s.id]?'on':''}">${t}</button>`).join('')}</div>`+
    s.tabs.map((_,i)=>`<div data-fxpage="${i}" ${i===TAB[s.id]?'':'hidden'}>${s.rows(i).map(q=>rowHTML(s,q)).join('')}</div>`).join('')}
  else b+=s.rows(0).map(q=>rowHTML(s,q)).join('');
  if(s.choice){const[k,l,opts]=s.choice;b=`<div class="subtabs fxchoice" role="radiogroup" aria-label="${l}">${opts.map((t,i)=>`<button type="button" role="radio" data-fch="${s.id}:${k}" data-v="${i}">${t}</button>`).join('')}</div>`+b}
  if(s.colors)b=s.colors.map(([k,l])=>`<div class="fxcol"><label>${l}</label><input type="color" data-fc="${s.id}:${k}" aria-label="${l}"><button type="button" data-fxpick="${s.id}:${k}" title="Prélever la couleur dans la photo" aria-label="Prélever ${l.toLowerCase()} dans la photo">${PIP}</button></div>`).join('')+b;
  return`<details class="sec fxsec" data-sec="fx-${s.id}" data-fx="${s.id}"><summary>${s.title}<span class="dot" aria-hidden="true"></span><button type="button" class="fxsw" role="switch" aria-checked="false" data-fxon="${s.id}" title="Activer ou désactiver" aria-label="Activer « ${s.title} »"></button><button type="button" class="fxhide" data-fxhide="${s.id}" title="Retirer du panneau" aria-label="Retirer « ${s.title} » du panneau">${HIDE}</button><button type="button" class="rs" data-fxreset="${s.id}" title="Réinitialiser ce groupe" aria-label="Réinitialiser « ${s.title} »">${RESET}</button></summary><div class="secbody">${b}</div></details>`}
function mount(){const body=$('#devBody');if(!body||body.querySelector('[data-fx]'))return;let open={};try{open=JSON.parse(PREF.get('w47Sec','{}'))||{}}catch(e){}
  for(const s of FX_SECS){const t=document.createElement('div');t.innerHTML=secHTML(s);const el=t.firstChild;if(open['fx-'+s.id])el.open=true;
    const ref=body.querySelector(`details[data-sec="${s.after}"]`);if(ref)ref.after(el);else body.appendChild(el)}
  const add=document.createElement('div');add.className='fxadd';add.innerHTML='<button type="button" class="btn sm" data-fxadd aria-haspopup="menu">+ Ajouter un réglage</button>';body.appendChild(add);
  fxSync()}
function showSec(id){PIN.add(id);savePin();fxSync();const d=pane.querySelector(`[data-fx="${id}"]`);if(d){d.hidden=false;d.open=true;d.scrollIntoView({block:'nearest',behavior:'smooth'})}}
function addMenu(btn){const A=FXA(),fx=A&&A.dev.fx,hid=FX_SECS.filter(s=>!shown(fx,s.id));const r=btn.getBoundingClientRect();
  const items=hid.length?hid.map(s=>({label:s.title,fn:()=>showSec(s.id)})):[{label:'Tous les réglages sont déjà affichés',dis:true}];
  if(typeof openMenuAt==='function')openMenuAt(items,r.left,r.bottom+4,{ret:btn});}
const FXA=()=>{try{return ADJ()}catch(e){return null}};
function ensure(A,s){const d=A.dev;if(!d.fx)d.fx={};if(!d.fx[s])d.fx[s]={on:false};return d.fx[s]}
function tidy(A){const fx=A.dev.fx;if(!fx)return;for(const s in fx){const o=fx[s];if(!o.on&&Object.keys(o).every(k=>k==='on'||o[k]===FXD[s][k]))delete fx[s]}if(!Object.keys(fx).length)delete A.dev.fx}
function drawHist(){const c=pane.querySelector('[data-fxhist=lv]');if(!c||!c.closest('details').open)return;const g=c.getContext('2d'),W=c.width,H=c.height,hs=S.lastHist,A=FXA();g.clearRect(0,0,W,H);
  const ch=TAB.lv||0,st=getComputedStyle(document.documentElement);
  if(hs){const arr=ch?hs['RGB'[ch-1]]:null,v=i=>arr?arr[i]:(hs.R[i]+hs.G[i]+hs.B[i]);let mx=1;for(let i=2;i<254;i++)mx=Math.max(mx,v(i));g.fillStyle=ch?['','#e5483d','#45b450','#4a7be6'][ch]:st.getPropertyValue('--fg-3');g.globalAlpha=0.45;g.beginPath();g.moveTo(0,H);for(let i=0;i<256;i++)g.lineTo(i/255*W,H-Math.min(1,Math.sqrt(v(i)/mx))*H*0.92);g.lineTo(W,H);g.fill();g.globalAlpha=1}
  if(!A)return;const fx=A.dev.fx,ib=fxv(fx,'lv','ib'+ch),iw=fxv(fx,'lv','iw'+ch),gm=fxv(fx,'lv','gm'+ch),mid=ib+(iw-ib)*Math.pow(0.5,gm);
  g.strokeStyle=st.getPropertyValue('--fg-2');g.lineWidth=2;for(const x of [ib,mid,iw]){g.beginPath();g.moveTo(x/255*W,0);g.lineTo(x/255*W,H);g.stroke()}}
function outFx(row){const[s,k]=row.dataset.fk.split(':'),A=FXA();if(!A)return;const v=fxv(A.dev.fx,s,k);row.querySelector('output').textContent=fmt(FXR[s][k],v);row.classList.toggle('zero',v===FXD[s][k])}
function fxSync(){const A=FXA();if(!A||!pane.querySelector('[data-fx]'))return;const fx=A.dev.fx;
  pane.querySelectorAll('input[type=range][data-fk]').forEach(i=>{const[s,k]=i.dataset.fk.split(':');i.value=fxv(fx,s,k)});
  pane.querySelectorAll('.row[data-fk]').forEach(outFx);
  pane.querySelectorAll('[data-fch]').forEach(b=>{const[s,k]=b.dataset.fch.split(':'),on=fxv(fx,s,k)===+b.dataset.v;b.classList.toggle('on',on);b.setAttribute('aria-checked',on)});
  pane.querySelectorAll('.row[data-only]').forEach(r=>{const s=r.dataset.fk.split(':')[0],c=FX_SECS.find(q=>q.id===s).choice;r.hidden=!r.dataset.only.split(' ').includes(String(fxv(fx,s,c[0])))});
  pane.querySelectorAll('input[data-fc]').forEach(i=>{const[s,k]=i.dataset.fc.split(':'),v=fxv(fx,s,k);i.value=v||'#808080';i.classList.toggle('none',!v);i.title=v?v:'Aucune couleur : choisissez-en une ou prélevez-la'});
  for(const s of FX_SECS){const d=pane.querySelector(`[data-fx="${s.id}"]`);if(!d)continue;const on=fxOn(fx,s.id);d.hidden=!shown(fx,s.id);d.querySelector('[data-fxon]').setAttribute('aria-checked',on);d.classList.toggle('fxlive',on);d.classList.toggle('mod',on)}
  drawHist()}
function touch(s){const A=FXA();if(!A)return null;const o=ensure(A,s);if(!o.on){o.on=true;const d=pane.querySelector(`[data-fx="${s}"]`);if(d){d.querySelector('[data-fxon]').setAttribute('aria-checked','true');d.classList.add('fxlive','mod')}}return o}
pane.addEventListener('input',e=>{const i=e.target;if(i.dataset.fk){const[s,k]=i.dataset.fk.split(':'),o=touch(s);if(!o)return;o[k]=+i.value;outFx(i.closest('.row'));if(s==='lv')drawHist();markContent()}
  else if(i.dataset.fc){const[s,k]=i.dataset.fc.split(':'),o=touch(s);if(!o)return;o[k]=i.value;i.classList.remove('none');markContent()}});
pane.addEventListener('change',e=>{const i=e.target,f=i.dataset.fk||i.dataset.fc;if(!f||!FXA())return;pushHistory(FXT[f.split(':')[0]]);try{scheduleThumbs()}catch(_){}});
pane.addEventListener('dblclick',e=>{const r=e.target.closest('.row[data-fk]');if(!r)return;e.preventDefault();e.stopPropagation();const A=FXA();if(!A)return;const[s,k]=r.dataset.fk.split(':');
  if(A.dev.fx&&A.dev.fx[s]){A.dev.fx[s][k]=FXD[s][k];tidy(A)}fxSync();markContent();pushHistory('Réinitialiser '+FXR[s][k][1].toLowerCase())},true);
pane.addEventListener('click',e=>{const t=e.target;
  const sw=t.closest('[data-fxon]');if(sw){e.preventDefault();e.stopPropagation();const A=FXA();if(!A)return;const s=sw.dataset.fxon,o=ensure(A,s);o.on=!o.on;tidy(A);fxSync();markContent();pushHistory((o.on?'Activer ':'Désactiver ')+FXT[s].toLowerCase());return}
  const hd=t.closest('[data-fxhide]');if(hd){e.preventDefault();e.stopPropagation();const s=hd.dataset.fxhide,A=FXA();PIN.delete(s);savePin();
    if(A&&A.dev.fx&&A.dev.fx[s]){delete A.dev.fx[s];tidy(A);fxSync();markContent();pushHistory('Retirer '+FXT[s].toLowerCase())}else fxSync();return}
  const ch=t.closest('[data-fch]');if(ch){e.preventDefault();const[s,k]=ch.dataset.fch.split(':'),o=touch(s);if(!o)return;o[k]=+ch.dataset.v;fxSync();markContent();pushHistory(FXT[s]+' : '+ch.textContent.toLowerCase());return}
  const ad=t.closest('[data-fxadd]');if(ad){e.preventDefault();addMenu(ad);return}
  const rs=t.closest('[data-fxreset]');if(rs){e.preventDefault();e.stopPropagation();const A=FXA();if(!A)return;const s=rs.dataset.fxreset;if(A.dev.fx){delete A.dev.fx[s];tidy(A)}fxSync();markContent();pushHistory('Réinitialiser '+FXT[s].toLowerCase());return}
  const tb=t.closest('[data-fxtab]');if(tb){const box=tb.closest('[data-fxtabs]'),s=box.dataset.fxtabs,n=+tb.dataset.fxtab;TAB[s]=n;box.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b===tb));
    box.parentNode.querySelectorAll('[data-fxpage]').forEach(p=>p.hidden=+p.dataset.fxpage!==n);if(s==='lv')drawHist();return}
  const pk=t.closest('[data-fxpick]');if(pk){e.preventDefault();if(!FXA())return;const on=!(PICK&&PICK.key===pk.dataset.fxpick);setPick(on?{key:pk.dataset.fxpick,btn:pk}:null);if(on)toast('Cliquez sur la photo pour prélever la couleur');return}});
pane.addEventListener('toggle',e=>{if(e.target&&e.target.matches&&e.target.matches('[data-fx=lv]')&&e.target.open)drawHist()},true);
/* pipette : la couleur telle que ce réglage la reçoit (calques du dessous et curseurs de ce réglage, sans ses finitions) */
let PICK=null;
function setPick(p){if(PICK&&PICK.btn)PICK.btn.classList.remove('on');PICK=p;if(p&&p.btn)p.btn.classList.add('on');try{setCursor();requestRender()}catch(e){}}
function sampleAt(p){const d=S.doc,R=clamp(Math.round(Math.min(d.w,d.h)/500),1,8),n=2*R+1,x=clamp(Math.floor(p.x)-R,0,Math.max(0,d.w-n)),y=clamp(Math.floor(p.y)-R,0,Math.max(0,d.h-n)),w=Math.min(n,d.w),h=Math.min(n,d.h);
  const c=mk(w,h),g=cx(c),o={scale:1,ox:-x,oy:-y};renderStack(g,w,h,[1,0,0,1,-x,-y],{...o,upto:d.active});
  const A=AL();if(A&&A.kind==='adjust'&&A.visible){const rest=stripFx(A.dev);delete rest.lut;if(!devIsId(rest))applyAdjust(g,w,h,{...A,dev:rest,opacity:1},null,o)}
  const a=g.getImageData(0,0,w,h).data;let r=0,gg=0,b=0,k=0;for(let i=0;i<a.length;i+=4){if(a[i+3]<10)continue;r+=a[i];gg+=a[i+1];b+=a[i+2];k++}if(!k)return null;
  const hx=v=>Math.round(v/k).toString(16).padStart(2,'0');return'#'+hx(r)+hx(gg)+hx(b)}
{const _od=onDown;onDown=function(e,p){if(PICK&&e.button===0&&!S.spaceDown){const P=PICK;setPick(null);const A=FXA();if(!A||!S.doc){toast('Sélectionnez un réglage');return}
    const col=sampleAt(p);if(!col)return;const[s,k]=P.key.split(':');touch(s)[k]=col;fxSync();markContent();pushHistory(FXT[s]);return}
  return _od.apply(this,arguments)};
 const _sc=setCursor;setCursor=function(){_sc.apply(this,arguments);if(PICK)view.style.cursor='crosshair'};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&PICK){setPick(null);toast('Pipette annulée')}},true)}
/* le panneau peut être reconstruit : on remonte les groupes et on suit chaque synchronisation */
{const _bd=buildDevelop;buildDevelop=function(){const r=_bd.apply(this,arguments);mount();return r};
 const _sd=syncDev;syncDev=function(){const r=_sd.apply(this,arguments);if(!pane.querySelector('[data-fx]'))mount();else fxSync();if(PICK&&!FXA())setPick(null);return r}}
mount();
