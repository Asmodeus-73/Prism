/* ===== Vectorscope : la répartition des couleurs de la photo (teinte = angle, saturation = distance au centre) =====
   - Remplace l’histogramme d’un clic sur celui-ci (ou clic droit, ou Affichage > Panneaux > Vectorscope) ; un autre clic le ramène.
   - Lu sur la même petite copie de l'image que l'histogramme : aucun calcul de plus sur la photo, seulement quand il est affiché.
   - Ligne des tons chair (la teinte moyenne des peaux, quelle que soit leur couleur), cibles des six couleurs primaires et secondaires.
   - Si le calque choisi est un réglage avec un masque, seuls les pixels de ce masque sont comptés.
   - Au survol de la photo, un réticule montre la couleur du pixel et ses valeurs RVB. ===== */
const VS={on:!!PREF.get('vscope',false),img:null,hover:null,raf:0,pts:null};
const c=document.getElementById('histo');
if(c){
const css=document.createElement('style');css.textContent=`
body.vscope #histoPanel .histo canvas{height:208px!important;min-height:208px!important;max-height:208px!important;cursor:pointer}
body.compact.vscope #histoPanel .histo canvas{height:168px!important;min-height:168px!important;max-height:168px!important}
#histoPanel .histo canvas{cursor:pointer}`;document.head.appendChild(css);
/* plan Cb/Cr (BT.709) : direction d'une couleur sur le disque */
const uv=(r,g,b)=>{const y=0.2126*r+0.7152*g+0.0722*b;return[(b-y)/1.8556,(r-y)/1.5748]};
const N=200;/* grille de comptage */
const TGT=[['R',[1,0,0]],['Mg',[1,0,1]],['B',[0,0,1]],['Cy',[0,1,1]],['V',[0,1,0]],['J',[1,1,0]]];
const SKIN=(()=>{const[u,v]=uv(0.86,0.64,0.52),a=Math.atan2(v,u);return a})();
/* le masque du réglage choisi, ramené à la taille de la copie lue par l'histogramme */
function maskProxy(w,h){const A=typeof AL==='function'?AL():null;if(!A||A.kind!=='adjust'||!A.mask||!S.workSize||S.workPos0x==null)return null;
  const m=mk(w,h),g=rx(m),T=viewMatrix(S.workPos0x,S.workPos0y),kx=w/S.workSize.w,ky=h/S.workSize.h;g.setTransform(T[0]*kx,T[1]*ky,T[2]*kx,T[3]*ky,T[4]*kx,T[5]*ky);g.drawImage(A.mask,0,0);
  return{a:g.getImageData(0,0,w,h).data,name:A.name||'Réglage'}}
function count(img){const d=img.data,n=d.length/4,step=Math.max(1,Math.floor(n/120000)),M=maskProxy(img.width,img.height),H=new Float32Array(N*N),C=new Float32Array(N*N*3);let tot=0;
  for(let i=0;i<n;i+=step){const j=i*4;if(d[j+3]<10)continue;let w=1;if(M){w=M.a[j+3]/255;if(w<0.03)continue}const r=d[j]/255,g=d[j+1]/255,b=d[j+2]/255,[u,v]=uv(r,g,b);
    const x=Math.round((u*1.9+1)/2*(N-1)),y=Math.round((1-(v*1.9+1)/2)*(N-1));if(x<0||y<0||x>=N||y>=N)continue;const q=y*N+x;H[q]+=w;C[q*3]+=r*w;C[q*3+1]+=g*w;C[q*3+2]+=b*w;tot+=w}
  return{H,C,tot,mask:M&&M.name}}
function draw(){if(!VS.on)return;const g=c.getContext('2d'),W=c.width,Hh=c.height,st=rootStyle(),R=Hh/2-6,cx0=W/2,cy0=Hh/2;g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.clearRect(0,0,W,Hh);
  const line=st.getPropertyValue('--line-2')||'#555',fg3=st.getPropertyValue('--fg-3')||'#888';
  g.strokeStyle=line;g.lineWidth=1;for(const k of [1,0.75,0.5,0.25]){g.beginPath();g.arc(cx0,cy0,R*k,0,Math.PI*2);g.stroke()}
  g.beginPath();g.moveTo(cx0-R,cy0);g.lineTo(cx0+R,cy0);g.moveTo(cx0,cy0-R);g.lineTo(cx0,cy0+R);g.stroke();
  /* ligne des tons chair */
  g.strokeStyle=fg3;g.setLineDash([4,3]);g.beginPath();g.moveTo(cx0,cy0);g.lineTo(cx0+Math.cos(SKIN)*R,cy0-Math.sin(SKIN)*R);g.stroke();g.setLineDash([]);
  g.fillStyle=fg3;g.font=`${Math.round(Hh/20)}px system-ui,sans-serif`;g.textAlign='center';g.textBaseline='middle';
  for(const[l,col]of TGT){const[u,v]=uv(...col),x=cx0+u*1.9*R*0.75,y=cy0-v*1.9*R*0.75;g.strokeStyle=`rgb(${col.map(v=>v*200+30).join()})`;g.strokeRect(x-5,y-5,10,10);g.fillText(l,cx0+u*1.9*R*0.93,cy0-v*1.9*R*0.93)}
  const P=VS.pts;if(P&&P.tot){const sc=2*R/N,img=g.createImageData(N,N),D=img.data;let mx=0;for(let i=0;i<N*N;i++)if(P.H[i]>mx)mx=P.H[i];const lm=Math.log1p(mx);
    for(let i=0;i<N*N;i++){const h=P.H[i];if(!h)continue;const a=Math.log1p(h)/lm,k=1/h,j=i*4;let r=P.C[i*3]*k,gg=P.C[i*3+1]*k,b=P.C[i*3+2]*k;const mxc=Math.max(r,gg,b,1e-3),f=0.55/mxc+0.45;
      D[j]=Math.min(255,r*f*255+40);D[j+1]=Math.min(255,gg*f*255+40);D[j+2]=Math.min(255,b*f*255+40);D[j+3]=Math.round(60+195*a)}
    const t=VS.tmp||(VS.tmp=mk(N,N));rx(t).putImageData(img,0,0);g.imageSmoothingEnabled=true;g.globalCompositeOperation=st.getPropertyValue('--hist-blend').trim()==='multiply'?'multiply':'lighter';g.drawImage(t,cx0-R,cy0-R,2*R,2*R);g.globalCompositeOperation='source-over'}
  const hv=VS.hover;if(hv){const[u,v]=uv(hv[0]/255,hv[1]/255,hv[2]/255),x=cx0+u*1.9*R,y=cy0-v*1.9*R;g.strokeStyle=st.getPropertyValue('--fg')||'#fff';g.lineWidth=1.5;g.beginPath();g.moveTo(x-9,y);g.lineTo(x+9,y);g.moveTo(x,y-9);g.lineTo(x,y+9);g.stroke();g.lineWidth=1}
  const L=document.getElementById('hmL'),Rr=document.getElementById('hmR');
  if(L)L.textContent=hv?`R ${hv[0]} · V ${hv[1]} · B ${hv[2]}`:(P&&P.mask?`Vectorscope · masque « ${P.mask} »`:'Vectorscope');
  if(Rr)Rr.textContent=hv?'':'Clic : histogramme'}
function size(){if(VS.on){if(c.width!==560||c.height!==400){c.width=560;c.height=400}}else if(c.width!==620||c.height!==172){c.width=620;c.height=172}}
function setOn(on){VS.on=on;PREF.set('vscope',on);document.body.classList.toggle('vscope',on);size();c.setAttribute('aria-label',on?'Vectorscope de la photo':'Histogramme de la photo');
  c.title=on?'Vectorscope : cliquez pour revenir à l’histogramme':'Cliquez pour afficher le vectorscope';VS.hover=null;
  if(on){if(VS.img)VS.pts=count(VS.img);draw()}else{try{histoNow()}catch(e){}}}
VS.set=setOn;window.PrismScope=VS;
/* l'histogramme reçoit la petite copie de l'image : on la garde, et on dessine le vectorscope à sa place quand il est affiché */
{const _h=histogram;histogram=function(img){VS.img=img;if(!VS.on)return _h.apply(this,arguments);
  try{const sv=c.width,sh=c.height;/* l'histogramme calcule ses chiffres (S.lastHist, courbe) sans être vu */
    _h.apply(this,arguments);if(c.width!==sv||c.height!==sh){c.width=sv;c.height=sh}}catch(e){}
  VS.pts=count(img);draw()}}
c.addEventListener('click',()=>setOn(!VS.on));
c.addEventListener('contextmenu',e=>{e.preventDefault();setOn(!VS.on)});
/* réticule : la couleur sous la souris, lue sur l'image affichée */
const view=document.getElementById('view');
if(view)view.addEventListener('pointermove',e=>{if(!VS.on||!S.doc||!S.workPos||typeof work==='undefined')return;const r=view.getBoundingClientRect(),pr=S.pr||1,k=S.workSize?S.workSize.k||1:1;
  const x=Math.floor(((e.clientX-r.left)*pr-S.workPos.x)*k),y=Math.floor(((e.clientY-r.top)*pr-S.workPos.y)*k);
  if(x<0||y<0||x>=work.width||y>=work.height){if(VS.hover){VS.hover=null;draw()}return}
  if(VS.raf)return;VS.raf=requestAnimationFrame(()=>{VS.raf=0;try{const p=rx(work).getImageData(x,y,1,1).data;if(p[3]<10){VS.hover=null}else VS.hover=[p[0],p[1],p[2]];draw()}catch(_){}})});
if(view)view.addEventListener('pointerleave',()=>{if(VS.hover){VS.hover=null;draw()}});
setOn(VS.on);
}
