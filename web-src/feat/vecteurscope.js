/* ===== Histogramme (fiche d'infos) et vectorscope =====
   - Un clic sur l’histogramme (ou le vectorscope) ouvre une fiche : grand histogramme par couche, valeurs au survol,
     moyenne, médiane, écart type, écrêtage par couche. Échap ou un clic ailleurs la ferme.
   - Vectorscope : la répartition des couleurs de la photo (teinte = angle, saturation = distance au centre).
     Il remplace l’histogramme par le petit bouton rond en haut à droite de celui-ci, par la fiche, par un clic droit
     ou par Affichage > Panneaux > Vectorscope.
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
#histoPanel .histo{position:relative}
#histoPanel .histo canvas{cursor:pointer;width:100%}
#histoPanel .histo canvas:focus-visible{outline:2px solid var(--accent,#6b7bff);outline-offset:1px}
#vsToggle{position:absolute;top:12px;right:16px;width:22px;height:22px;padding:0;border:0;border-radius:6px;display:grid;place-items:center;background:color-mix(in srgb,var(--hist-bg,#111) 70%,transparent);color:var(--fg-2,#aaa);cursor:pointer;opacity:.75;z-index:2}
#vsToggle:hover,#vsToggle:focus-visible{opacity:1;color:var(--fg,#fff)}
#vsToggle svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.6}
body.zclean .hmeta #hmL.zc-on,body.zclean .hmeta #hmR.zc-on{background:color-mix(in srgb,var(--hist-bg,#111) 78%,transparent);border-radius:4px;padding:0 4px}
#histoInfo{position:fixed;z-index:60;width:400px;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);overflow:auto;box-sizing:border-box;padding:12px 14px 12px;border-radius:12px;background:var(--panel,var(--bg-2,#1b1b1f));color:var(--fg,#eee);border:1px solid var(--line,#333);box-shadow:0 14px 40px rgba(0,0,0,.35);font:12px/1.4 var(--sans,system-ui,sans-serif)}
#histoInfo[hidden]{display:none}
#histoInfo .hi-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
#histoInfo .hi-head b{font-size:13px;font-weight:600;flex:1}
#histoInfo .hi-x{width:24px;height:24px;border:0;border-radius:6px;background:none;color:var(--fg-2,#aaa);cursor:pointer;font-size:16px;line-height:1}
#histoInfo .hi-x:hover{background:var(--line,#333);color:var(--fg,#fff)}
#histoInfo .hi-tabs{display:flex;gap:2px;margin-bottom:8px;background:var(--line,#2a2a2e);padding:2px;border-radius:7px}
#histoInfo .hi-tabs button{flex:1;border:0;background:none;color:var(--fg-2,#aaa);padding:3px 0;border-radius:5px;font:inherit;cursor:pointer}
#histoInfo .hi-tabs button.on{background:var(--panel,var(--bg-2,#1b1b1f));color:var(--fg,#fff)}
#histoInfo canvas{display:block;width:100%;height:150px;border-radius:8px;background:var(--hist-bg,#0c0c0e);cursor:crosshair}
#histoInfo .hi-read{min-height:17px;margin:6px 0 8px;font:11px var(--num,ui-monospace,monospace);color:var(--fg-2,#aaa);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#histoInfo table{width:100%;border-collapse:collapse;font:11px var(--num,ui-monospace,monospace)}
#histoInfo th,#histoInfo td{padding:3px 4px;text-align:right;border-top:1px solid var(--line,#2a2a2e);white-space:nowrap}
#histoInfo th:first-child,#histoInfo td:first-child{text-align:left;font-family:var(--sans,system-ui,sans-serif);color:var(--fg-2,#aaa);font-weight:400}
#histoInfo thead th{border-top:0;font-family:var(--sans,system-ui,sans-serif);font-weight:600}
#histoInfo td.warn{color:var(--warn,#e8a33a)}
#histoInfo .hi-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;color:var(--fg-3,#888);font-size:11px}
#histoInfo .hi-foot button{border:1px solid var(--line,#333);background:none;color:var(--fg,#eee);border-radius:7px;padding:4px 10px;font:inherit;cursor:pointer}
#histoInfo .hi-foot button:hover{background:var(--line,#333)}`;document.head.appendChild(css);
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
  if(Rr)Rr.textContent=''}
/* toujours à la taille affichée : le disque reste rond */
function size(){histoFit(c)}
function setOn(on){VS.on=on;PREF.set('vscope',on);document.body.classList.toggle('vscope',on);size();c.setAttribute('aria-label',on?'Vectorscope de la photo':'Histogramme de la photo');
  c.title='Cliquez pour plus d’infos';VS.hover=null;paintToggle();
  if(on){requestAnimationFrame(()=>{size();if(VS.img)VS.pts=count(VS.img);draw()})}else{requestAnimationFrame(()=>{try{histoNow()}catch(e){}})}}
VS.set=setOn;window.PrismScope=VS;
/* l'histogramme reçoit la petite copie de l'image : on la garde, et on dessine le vectorscope à sa place quand il est affiché */
{const _h=histogram;histogram=function(img){VS.img=img;let r;if(!VS.on)r=_h.apply(this,arguments);
  else{try{/* l'histogramme calcule ses chiffres (S.lastHist, courbe) ; le vectorscope se dessine par-dessus */_h.apply(this,arguments)}catch(e){}
    size();VS.pts=count(img);draw()}
  if(HC.open)try{infoDraw()}catch(e){}
  return r}}
/* ---- bouton rond en haut à droite : histogramme <-> vectorscope ---- */
const tg=document.createElement('button');tg.id='vsToggle';tg.type='button';
function paintToggle(){const t=VS.on?'Afficher l’histogramme':'Afficher le vectorscope';tg.title=t;tg.setAttribute('aria-label',t);tg.setAttribute('aria-pressed',VS.on?'true':'false');
  tg.innerHTML=VS.on?'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 14V9M5.5 14V5M9 14V7M12.5 14V3"/></svg>':'<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 2v12M2 8h12"/></svg>';
  const b=document.querySelector('#histoInfo [data-hi-vs]');if(b)b.textContent=VS.on?'Revenir à l’histogramme':'Afficher le vectorscope'}
c.parentNode.insertBefore(tg,c.nextSibling);
tg.addEventListener('click',e=>{e.stopPropagation();setOn(!VS.on)});
/* ---- fiche d'infos : un clic sur l'histogramme ---- */
const HC={open:false,ch:'rgb',hover:-1,el:null,cv:null,fit:null};
const CH=[['rgb','RVB'],['L','Luminance'],['R','Rouge'],['G','Vert'],['B','Bleu']];
const fr=(v,d=1)=>v.toFixed(d).replace('.',',');
function stats(A,n){let s=0,s2=0,mn=-1,mx=-1,acc=0,med=0,half=n/2,fm=false;for(let i=0;i<256;i++){const v=A[i];if(!v)continue;if(mn<0)mn=i;mx=i;s+=v*i;s2+=v*i*i;acc+=v;if(!fm&&acc>=half){med=i;fm=true}}
  const m=n?s/n:0;return{mean:m,med,sd:n?Math.sqrt(Math.max(0,s2/n-m*m)):0,min:mn<0?0:mn,max:mx<0?0:mx,lo:n?(A[0]+A[1])/n*100:0,hi:n?(A[254]+A[255])/n*100:0}}
function build(){const el=document.createElement('div');el.id='histoInfo';el.setAttribute('role','dialog');el.setAttribute('aria-label','Infos de l’histogramme');el.hidden=true;
  el.innerHTML=`<div class="hi-head"><b>Histogramme</b><button type="button" class="hi-x" aria-label="Fermer" title="Fermer (Échap)">×</button></div>
<div class="hi-tabs" role="tablist">${CH.map(([k,l])=>`<button type="button" role="tab" data-hi-ch="${k}">${l}</button>`).join('')}</div>
<canvas aria-label="Histogramme agrandi : survolez pour lire un niveau"></canvas><div class="hi-read"></div>
<table><thead><tr><th></th><th>Rouge</th><th>Vert</th><th>Bleu</th><th>Lum.</th></tr></thead><tbody></tbody></table>
<div class="hi-foot"><span class="hi-n"></span><button type="button" data-hi-vs></button></div>`;
  document.body.appendChild(el);HC.el=el;HC.cv=el.querySelector('canvas');
  el.querySelector('.hi-x').addEventListener('click',()=>infoOpen(false));
  el.querySelector('.hi-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-hi-ch]');if(!b)return;HC.ch=b.dataset.hiCh;try{PREF.set('histoCh',HC.ch)}catch(_){}infoDraw()});
  el.querySelector('[data-hi-vs]').addEventListener('click',()=>setOn(!VS.on));
  HC.cv.addEventListener('pointermove',e=>{const r=HC.cv.getBoundingClientRect();HC.hover=Math.max(0,Math.min(255,Math.round((e.clientX-r.left)/r.width*255)));infoDraw()});
  HC.cv.addEventListener('pointerleave',()=>{HC.hover=-1;infoDraw()});
  paintToggle();return el}
function place(){const el=HC.el,p=document.getElementById('histoPanel'),r=(p&&p.offsetParent?p:c).getBoundingClientRect(),w=el.offsetWidth||400,h=el.offsetHeight||420,M=12;
  let x=r.left-w-10,y=r.top;if(x<M){x=Math.max(M,Math.min(innerWidth-w-M,r.left+r.width/2-w/2));y=r.bottom+8;if(y+h>innerHeight-M)y=Math.max(M,r.top-h-8)}
  y=Math.max(M,Math.min(y,innerHeight-h-M));el.style.left=Math.round(x)+'px';el.style.top=Math.round(y)+'px'}
function infoDraw(){const el=HC.el;if(!el||!HC.open)return;const h=S.lastHist;
  el.querySelectorAll('[data-hi-ch]').forEach(b=>{const on=b.dataset.hiCh===HC.ch;b.classList.toggle('on',on);b.setAttribute('aria-selected',on?'true':'false')});
  const tb=el.querySelector('tbody'),rd=el.querySelector('.hi-read'),nn=el.querySelector('.hi-n');
  if(!h||!h.n||!h.L){tb.innerHTML='';rd.textContent='Ouvrez une photo';nn.textContent='';const g=HC.cv.getContext('2d');g.clearRect(0,0,HC.cv.width,HC.cv.height);return}
  histoFit(HC.cv);const C=histoColors(),chs=HC.ch==='rgb'?[[h.R,C.R],[h.G,C.G],[h.B,C.B]]:[[h[HC.ch],C[HC.ch]]];const P=histoPaint(HC.cv,chs);
  if(HC.hover>=0){const g=HC.cv.getContext('2d'),x=Math.round(HC.hover/255*HC.cv.width)+.5;g.strokeStyle=rootStyle().getPropertyValue('--fg')||'#fff';g.lineWidth=1;g.setLineDash([3,3]);g.beginPath();g.moveTo(x,0);g.lineTo(x,HC.cv.height);g.stroke();g.setLineDash([])}
  const st={R:stats(h.R,h.n),G:stats(h.G,h.n),B:stats(h.B,h.n),L:stats(h.L,h.n)},K=['R','G','B','L'];
  const row=(lbl,f,warn)=>`<tr><th scope="row">${lbl}</th>${K.map(k=>{const v=f(st[k]);return`<td${warn&&warn(st[k])?' class="warn"':''}>${v}</td>`}).join('')}</tr>`;
  tb.innerHTML=row('Moyenne',s=>fr(s.mean))+row('Médiane',s=>s.med)+row('Écart type',s=>fr(s.sd))+row('Min – max',s=>s.min+'–'+s.max)
    +row('Ombres écrêtées',s=>fr(s.lo)+' %',s=>s.lo>=1)+row('Lumières écrêtées',s=>fr(s.hi)+' %',s=>s.hi>=1);
  const lo=h.lo/h.n*100,hi=h.hi/h.n*100;
  if(HC.hover>=0){const i=HC.hover,pc=A=>fr(A[i]/h.n*100,2),A=HC.ch==='rgb'?h.L:h[HC.ch];let below=0;for(let k=0;k<i;k++)below+=A[k];
    rd.textContent=`Niveau ${i} : R ${pc(h.R)} · V ${pc(h.G)} · B ${pc(h.B)} % · ${fr(below/h.n*100,0)} % en dessous`}
  else rd.textContent=`Noir pur ${fr(lo)} % · blanc pur ${fr(hi)} % · survolez pour lire un niveau`;
  nn.textContent=`${h.n.toLocaleString('fr-FR')} pixels analysés`;nn.title=h.w?`Calculé sur un aperçu de ${h.w} × ${h.h} px de la photo entière`:''}
function infoOpen(on){if(on&&!S.doc)return;const el=HC.el||build();HC.open=on;el.hidden=!on;c.setAttribute('aria-expanded',on?'true':'false');
  if(on){HC.hover=-1;el.style.visibility='hidden';infoDraw();place();el.style.visibility='';infoDraw()}}
VS.info=infoOpen;VS.infoState=HC;
try{const k=PREF.get('histoCh','rgb');if(CH.some(([x])=>x===k))HC.ch=k}catch(_){}
c.tabIndex=0;c.setAttribute('role','button');c.setAttribute('aria-haspopup','dialog');c.setAttribute('aria-expanded','false');
c.addEventListener('click',()=>infoOpen(!HC.open));
c.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();infoOpen(!HC.open)}});
c.addEventListener('contextmenu',e=>{e.preventDefault();setOn(!VS.on)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&HC.open){e.stopPropagation();infoOpen(false);c.focus()}},true);
document.addEventListener('pointerdown',e=>{if(HC.open&&HC.el&&!HC.el.contains(e.target)&&e.target!==c&&e.target!==tg&&!tg.contains(e.target))infoOpen(false)},true);
addEventListener('resize',()=>{if(HC.open)place()});
/* la petite copie change de taille avec le panneau : on redessine à la bonne taille */
if(window.ResizeObserver)new ResizeObserver(()=>{if(!S.doc)return;if(VS.on){size();draw()}else{try{histoNow()}catch(_){}}}).observe(c);
/* réticule : la couleur sous la souris, lue sur l'image affichée */
const view=document.getElementById('view');
if(view)view.addEventListener('pointermove',e=>{if(!VS.on||!S.doc||!S.workPos||typeof work==='undefined')return;const r=view.getBoundingClientRect(),pr=S.pr||1,k=S.workSize?S.workSize.k||1:1;
  const x=Math.floor(((e.clientX-r.left)*pr-S.workPos.x)*k),y=Math.floor(((e.clientY-r.top)*pr-S.workPos.y)*k);
  if(x<0||y<0||x>=work.width||y>=work.height){if(VS.hover){VS.hover=null;draw()}return}
  if(VS.raf)return;VS.raf=requestAnimationFrame(()=>{VS.raf=0;try{const p=rx(work).getImageData(x,y,1,1).data;if(p[3]<10){VS.hover=null}else VS.hover=[p[0],p[1],p[2]];draw()}catch(_){}})});
if(view)view.addEventListener('pointerleave',()=>{if(VS.hover){VS.hover=null;draw()}});
setOn(VS.on);
}
