/* ================= style copy (match a reference photo) ================= */
function srgbToLab(r,g,b){const f=v=>(v/=255)<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);const R=f(r),G=f(g),B=f(b);
  let X=(0.4124*R+0.3576*G+0.1805*B)/0.95047,Y=0.2126*R+0.7152*G+0.0722*B,Z=(0.0193*R+0.1192*G+0.9505*B)/1.08883;const h=t=>t>0.008856?Math.cbrt(t):7.787*t+16/116;X=h(X);Y=h(Y);Z=h(Z);return[116*Y-16,500*(X-Y),200*(Y-Z)]}
function styleFeatures(data){const n=data.length/4,Ls=new Float32Array(n);let a=0,b=0,c=0,sa=0,sb=0,sn=0,ha=0,hb=0,hn=0,ma=0,mb=0,mn=0;
  for(let i=0;i<n;i++){const[L,A,B]=srgbToLab(data[i*4],data[i*4+1],data[i*4+2]);Ls[i]=L;a+=A;b+=B;c+=Math.hypot(A,B);if(L<35){sa+=A;sb+=B;sn++}else if(L>68){ha+=A;hb+=B;hn++}else{ma+=A;mb+=B;mn++}}
  const s=Ls.slice().sort(),q=p=>s[Math.min(n-1,Math.floor(p*n))];
  return{p:[q(0.02),q(0.1),q(0.25),q(0.5),q(0.75),q(0.9),q(0.98)],a:a/n,b:b/n,c:c/n,sh:[sn?sa/sn:a/n,sn?sb/sn:b/n],hi:[hn?ha/hn:a/n,hn?hb/hn:b/n],mid:[mn?ma/mn:a/n,mn?mb/mn:b/n]}}
function featLoss(f,t){let e=0;for(let i=0;i<7;i++)e+=((f.p[i]-t.p[i])**2)*(i===3?2:1);e+=0.8*((f.a-t.a)**2+(f.b-t.b)**2)+1.2*(f.c-t.c)**2;
  e+=0.6*((f.sh[0]-t.sh[0])**2+(f.sh[1]-t.sh[1])**2+(f.hi[0]-t.hi[0])**2+(f.hi[1]-t.hi[1])**2+(f.mid[0]-t.mid[0])**2+(f.mid[1]-t.mid[1])**2);return e}
function thumbData(c,max=150){const s=Math.min(1,max/Math.max(c.width,c.height)),t=resample(c,Math.max(1,c.width*s|0),Math.max(1,c.height*s|0));return rx(t).getImageData(0,0,t.width,t.height)}
/* Fits the develop sliders so the photo's tonal and colour statistics match the reference; runs on a ~150 px proxy through the same develop code as the full image. */
function fitStyle(srcImg,refImg){const target=styleFeatures(refImg.data),o={scale:1,ox:0,oy:0,docW:srcImg.width,docH:srcImg.height};
  const KEYS=[['exposure',-2,2,0.5],['contrast',-60,80,20],['highlights',-80,60,20],['shadows',-60,80,20],['whites',-60,60,15],['blacks',-60,60,15],['temp',-70,70,15],['tint',-60,60,15],['saturation',-80,60,15],['vibrance',-60,80,15],['shS',0,60,12],['shH',0,359,40],['midS',0,50,10],['midH',0,359,40],['hiS',0,60,12],['hiH',0,359,40]];
  const ev=dv=>{const im=new ImageData(new Uint8ClampedArray(srcImg.data),srcImg.width,srcImg.height);developCPU(im,dv,o,null,1);return featLoss(styleFeatures(im.data),target)};
  const dv=DEV0();const src=styleFeatures(srcImg.data);
  // informed starting point: exposure from median lightness, split tones from the colour casts per tonal band
  dv.exposure=clamp(Math.log2(Math.max(2,target.p[3])/Math.max(2,src.p[3]))*1.6,-2,2);
  const tone=(t,s)=>{const da=t[0]-s[0],db=t[1]-s[1],m=Math.hypot(da,db);return[(Math.atan2(db,da)*180/Math.PI+360)%360,clamp(m*3,0,50)]};
  {const a=tone(target.sh,src.sh),b=tone(target.hi,src.hi);dv.shH=a[0];dv.shS=a[1];dv.hiH=b[0];dv.hiS=b[1]}dv.shS*=0.5;dv.hiS*=0.5;
  let best=ev(dv);
  for(let it=0;it<5;it++){for(const[k,mn,mx,st0] of KEYS){const st=st0/(1+it*0.8);for(const dir of[1,-1]){let moved=false;for(let tries=0;tries<4;tries++){const old=dv[k];let nv=old+dir*st;nv=k.endsWith('H')?(nv+360)%360:clamp(nv,mn,mx);if(nv===old)break;dv[k]=nv;const e=ev(dv);if(e<best-1e-6){best=e;moved=true}else{dv[k]=old;break}}if(moved)break}}}
  for(const k of Object.keys(dv))if(typeof dv[k]==='number')dv[k]=k==='exposure'?Math.round(dv[k]*100)/100:Math.round(dv[k]);return dv}
async function styleFromFile(file){const src=RAW_EXT.test(file.name||'')?(await decodeRaw(file)).c:await loadImageFile(file);let c=src;if(src.tagName==='IMG'){c=mk(src.naturalWidth,src.naturalHeight);cx(c).drawImage(src,0,0)}return c}
let STYLE_REF=null;
async function copyStyleDialog(){if(!S.doc){toast('Ouvrez d’abord une photo');return}const f=await pickFile('image/*,.tif,.tiff,.pdf,.tga,.svg,.jxl,.bmp,.ico,.avif,.heic,.heif,'+RAW_ACCEPT);if(!f)return;busy(true,'Analyse de la photo de référence…',null);await tick();
  try{const ref=await styleFromFile(f);STYLE_REF={name:(f.name||'référence').replace(/\.[^.]+$/,''),img:thumbData(ref)};const dv=await applyStyleToDoc(STYLE_REF);busy(false);
    toast(`Style de « ${STYLE_REF.name} » appliqué dans un calque de réglage. Ajustez son opacité pour doser l’effet.`,6000)}
  catch(e){busy(false);console.error(e);toast('Analyse impossible : '+(e.message||e),5000)}}
async function applyStyleToDoc(ref,opts={}){const d=S.doc;const cur=await renderDoc(Math.min(1,300/Math.max(d.w,d.h)));const dv=fitStyle(thumbData(cur),ref.img);
  const L=newAdjust('Style : '+ref.name.slice(0,28));Object.assign(L.dev,dv);d.layers.push(L);d.active=d.layers.length-1;if(!opts.silent){markComp();pushHistory('Copier le style');syncAll();switchTab('develop')}else markComp();return dv}
function pickFile(accept,multiple){return new Promise(res=>{const i=document.createElement('input');i.type='file';i.accept=accept;i.multiple=!!multiple;i.onchange=()=>res(multiple?[...i.files]:i.files[0]||null);i.addEventListener('cancel',()=>res(multiple?[]:null));i.click()})}
const RAW_ACCEPT='.dng,.cr2,.cr3,.crw,.nef,.nrw,.arw,.srf,.sr2,.raf,.orf,.rw2,.pef,.srw,.3fr,.iiq,.erf,.mef,.mos,.kdc,.dcr,.x3f,.raw';

