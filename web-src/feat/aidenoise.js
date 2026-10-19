/* ================= Débruitage IA (SCUNet, réseau neuronal exécuté localement par ONNX Runtime web) ================= */
/* Modèle : SCUNet "real image" (Zhang et al., KAIR/SCUNet), poids fp16 découpés en 4 morceaux ai/aidenoise/N.wasm, tuiles fixes 256 px. */
const DN={sess:null,loadP:null,TILE:256,OV:32,N:4,tms:null,abort:false,busyNow:false,lastEp:'wasm'};
DN.WSRC=`let sess=null;
self.onmessage=async e=>{const m=e.data;
 if(m.t==='init'){try{
   importScripts(m.ort);const ort=self.ort;ort.env.wasm.wasmPaths=m.wasm;ort.env.wasm.numThreads=m.threads;ort.env.wasm.proxy=false;
   const n=m.chunks.length,parts=new Array(n);let done=0;
   await Promise.all(m.chunks.map(async(u,i)=>{const r=await fetch(u);if(!r.ok)throw new Error('modèle '+r.status);parts[i]=new Uint8Array(await r.arrayBuffer());done++;postMessage({t:'prog',v:done/n*0.85})}));
   const tot=parts.reduce((a,p)=>a+p.length,0),buf=new Uint8Array(tot);let o=0;for(const p of parts){buf.set(p,o);o+=p.length}
   postMessage({t:'prog',v:0.92,prep:1});
   let eps=(m.eps||['wasm']).filter(x=>x!=='webgpu'||self.navigator.gpu),ep=eps[0];self.CPU=()=>ort.InferenceSession.create(buf.buffer,{executionProviders:['wasm'],graphOptimizationLevel:'all'});self.EP=ep;self.RUN=async f=>{try{return await sess.run(f)}catch(e){if(self.EP!=='webgpu')throw e;self.EP='wasm';sess=await self.CPU();return sess.run(f)}};try{sess=await ort.InferenceSession.create(buf.buffer,{executionProviders:eps,graphOptimizationLevel:'all'})}catch(er){if(ep==='wasm')throw er;ep=self.EP='wasm';sess=await self.CPU()}postMessage({t:'ready',threads:ort.env.wasm.numThreads,ep})}
  catch(err){postMessage({t:'err',msg:String(err&&err.message||err)})}}
 else if(m.t==='run'){try{const ort=self.ort;const out=await self.RUN({[sess.inputNames[0]]:new ort.Tensor('float32',new Float32Array(m.buf),m.dims)});const d=out[sess.outputNames[0]].data;const c=new Float32Array(d);postMessage({t:'res',id:m.id,buf:c.buffer},[c.buffer])}
  catch(err){postMessage({t:'err',id:m.id,msg:String(err&&err.message||err)})}}};`;
DN.abs=u=>new URL(u,location.href).href;
DN.load=()=>DN.sess?Promise.resolve(DN.sess):(DN.loadP||(DN.loadP=DN._load().finally(()=>{DN.loadP=null})));
DN._load=()=>new Promise(async res=>{DN.loadRes=res;
  busy(true,'Chargement du moteur IA…',0.02);
  let w;try{w=new Worker(URL.createObjectURL(new Blob([DN.WSRC],{type:'text/javascript'})))}catch(e){console.error(e);busy(false);toast('Le modèle de débruitage n’a pas pu se charger : '+(e.message||e),5000);res(null);return}
  const thr=self.crossOriginIsolated?Math.max(1,Math.min(4,navigator.hardwareConcurrency||1)):1;
  w.onmessage=e=>{const m=e.data;
    if(m.t==='prog'){DN.busyCancel(true);busy(true,m.prep?'Préparation du modèle…':'Téléchargement du modèle de débruitage (43 Mo, une seule fois)…',m.v);DN.busyCancel(true)}
    else if(m.t==='ready'){DN.threads=m.threads;DN.lastEp=m.ep||'wasm';DN.loadRes=null;DN.sess=DN.w=w;w.onmessage=DN._onmsg;res(w)}
    else if(m.t==='err'){console.error(m.msg);w.terminate();busy(false);toast('Le modèle de débruitage n’a pas pu se charger : '+m.msg,5000);res(null)}};
  w.onerror=e=>{console.error(e);w.terminate();busy(false);toast('Le modèle de débruitage n’a pas pu se charger : '+(e.message||'worker'),5000);res(null)};
  w.postMessage({t:'init',ort:DN.abs(await PrismORT.bundle()),eps:await PrismORT.eps(),wasm:DN.abs(asset('ai/')),chunks:[...Array(DN.N).keys()].map(i=>DN.abs(asset(`ai/aidenoise/${i}.wasm`))),threads:thr})});
DN.pend=new Map();DN.rid=0;
DN._onmsg=e=>{const m=e.data,p=DN.pend.get(m.id);if(!p)return;DN.pend.delete(m.id);m.t==='res'?p.res(new Float32Array(m.buf)):p.rej(new Error(m.msg))};
DN.tile=(f,dims)=>new Promise((res,rej)=>{const id=++DN.rid;DN.pend.set(id,{res,rej});DN.w.postMessage({t:'run',id,buf:f.buffer,dims},[f.buffer])});
/* annulation immédiate : on arrête le worker (le modèle sera rechargé au prochain usage) */
DN.kill=()=>{if(DN.loadRes){DN.loadRes(null);DN.loadRes=null}if(DN.w){DN.w.terminate();DN.w=null;DN.sess=null}DN.pend.forEach(p=>p.rej(new Error('annulé')));DN.pend.clear()};
/* indice miroir (bords de l'image) */
const dnMir=(i,n)=>{if(n<2)return 0;const p=2*n-2;i=((i%p)+p)%p;return i<n?i:p-i};
/* positions de tuiles sur un axe pour la zone [r0,r1[ */
DN.axis=(r0,r1)=>{const T=DN.TILE,L=r1-r0,st=T-DN.OV;if(L<=T)return[r0-((T-L)>>1)];const a=[];for(let o=r0;;o+=st){if(o+T>=r1){a.push(r1-T);break}a.push(o)}return a};
/* poids 1D d'une tuile : rampes sur les recouvrements avec les voisines (partition de l'unité) */
DN.ramp=(o,prev,next,r0,r1)=>{const T=DN.TILE,w=new Float32Array(T);for(let i=0;i<T;i++){let v=1;const g=o+i;if(g<r0||g>=r1){w[i]=0;continue}
    if(prev!=null){const lo=prev+T-o;if(lo>0&&i<lo)v=Math.min(v,(i+.5)/lo)}
    if(next!=null){const ro=o+T-next;if(ro>0&&i>=T-ro)v=Math.min(v,1-(i-(T-ro)+.5)/ro)}
    w[i]=v}return w};
/* débruite la zone (rx0,ry0,rx1,ry1) de src (ImageData). Renvoie un Uint8ClampedArray RGBA de la taille de src (hors zone = inchangé). */
DN.process=async(img,reg,onP)=>{const sess=await DN.load();if(!sess)return null;const T=DN.TILE,W=img.width,H=img.height,s=img.data;
  const [x0,y0,x1,y1]=reg,xs=DN.axis(x0,x1),ys=DN.axis(y0,y1),res=new Uint8ClampedArray(s),acc=new Uint8Array(W*H),N=T*T,total=xs.length*ys.length;let k=0;
  const t00=performance.now();DN.abort=false;
  for(let j=0;j<ys.length;j++){const wy=DN.ramp(ys[j],j>0?ys[j-1]:null,j<ys.length-1?ys[j+1]:null,y0,y1);
    for(let i=0;i<xs.length;i++){if(DN.abort)return null;
      const wx=DN.ramp(xs[i],i>0?xs[i-1]:null,i<xs.length-1?xs[i+1]:null,x0,x1),ox=xs[i],oy=ys[j];
      const f=new Float32Array(3*N);for(let yy=0;yy<T;yy++){const sy=dnMir(oy+yy,H)*W;for(let xx=0;xx<T;xx++){const q=(sy+dnMir(ox+xx,W))*4,p=yy*T+xx;f[p]=s[q]/255;f[p+N]=s[q+1]/255;f[p+2*N]=s[q+2]/255}}
      const t0=performance.now();let o;try{o=await DN.tile(f,[1,3,T,T])}catch(err){if(DN.abort)return null;throw err}if(DN.abort)return null;const dt=performance.now()-t0;DN.tms=DN.tms==null?dt:DN.tms*.5+dt*.5;
      for(let yy=0;yy<T;yy++){const gy=oy+yy;if(gy<y0||gy>=y1)continue;const wyv=wy[yy];if(wyv<=0)continue;
        for(let xx=0;xx<T;xx++){const gx=ox+xx;if(gx<x0||gx>=x1)continue;const w=wx[xx]*wyv;if(w<=0)continue;const gi=gy*W+gx,q=gi*4,p=yy*T+xx,pv=acc[gi]/255,tot=pv+w,a=w/tot;
          for(let c=0;c<3;c++){const nv=o[p+c*N]*255,cur=res[q+c];res[q+c]=pv>0?cur+(nv-cur)*a:nv}
          acc[gi]=Math.min(255,Math.round(tot*255))}}
      k++;onP&&onP(k,total);await tick()}}
  return res};
/* zone de travail : sélection ou image entière, + marge de contexte */
DN.region=(d,W,H)=>{if(!d.sel)return[0,0,W,H];const a=rx(d.sel).getImageData(0,0,d.sel.width,d.sel.height).data,sw=d.sel.width,sh=d.sel.height;let x0=sw,y0=sh,x1=-1,y1=-1;
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++)if(a[(y*sw+x)*4+3]>0){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
  if(x1<0)return null;return[Math.max(0,x0),Math.max(0,y0),Math.min(W,x1+1),Math.min(H,y1+1)]};
DN.tilesFor=reg=>DN.axis(reg[0],reg[2]).length*DN.axis(reg[1],reg[3]).length;
DN.fmtT=ms=>{const s=Math.round(ms/1000);return s<90?s+' s':s<5400?Math.round(s/60)+' min':(s/3600).toFixed(1).replace('.',',')+' h'};
/* mélange original / débruité selon la force (0..1) */
DN.blend=(orig,den,k,W,H)=>{const o=new Uint8ClampedArray(orig.data);if(k>=1){for(let i=0;i<o.length;i+=4){o[i]=den[i];o[i+1]=den[i+1];o[i+2]=den[i+2]}}else{for(let i=0;i<o.length;i+=4){o[i]+=(den[i]-o[i])*k;o[i+1]+=(den[i+1]-o[i+1])*k;o[i+2]+=(den[i+2]-o[i+2])*k}}
  const c=mk(W,H);rx(c).putImageData(new ImageData(o,W,H),0,0);return c};
DN.busyCancel=on=>{const b=document.querySelector('#busy>div');if(!b)return;let e=b.querySelector('.dn-cancel');if(on&&!e){e=document.createElement('button');e.className='btn sm dn-cancel';e.textContent='Annuler';e.style.marginTop='10px';e.onclick=()=>{DN.abort=true;e.disabled=true;e.textContent='Annulation…';DN.kill()};b.appendChild(e)}else if(!on&&e)e.remove()};
DN.onKey=e=>{if(e.key==='Escape'&&DN.busyNow){DN.abort=true;DN.kill();e.stopPropagation()}};
DN.start=async()=>{const d=S.doc;if(!d)return;const mt=maskTarget();if(mt){toast('Le débruitage IA agit sur les pixels, pas sur un masque');return}
  const L=pixelTarget();if(!L){toast('Aucun calque de pixels à filtrer');return}
  if(L.visible===false){toast('Ce calque est masqué : affichez-le pour appliquer un filtre');return}
  const W=L.canvas.width,H=L.canvas.height,reg=DN.region(d,W,H);if(!reg){toast('La sélection est vide');return}
  const nt=DN.tilesFor(reg),per=DN.tms||12000,est=nt*per*1.08;
  dialog({title:'Débruitage IA',light:true,body:`<p class="muted">Un réseau de neurones (SCUNet) réduit le bruit numérique en gardant les détails. Le calcul se fait sur votre appareil.${DN.sess?'':' Le premier usage télécharge le modèle (43 Mo).'}</p>
      <p class="muted">${reg[2]-reg[0]} × ${reg[3]-reg[1]} px${d.sel?' (sélection)':''} · ${nt} tuile${nt>1?'s':''} · durée estimée ${DN.tms?'':'(prudente) '}${DN.fmtT(est)}.${est>600000?' C’est long : pensez à sélectionner la zone utile.':''}</p>`,
    buttons:[{label:'Annuler'},{label:'Lancer',primary:true,onClick:()=>{setTimeout(()=>DN.run(d,L,reg),30)}}]})};
DN.run=async(d,L,reg)=>{const W=L.canvas.width,H=L.canvas.height;if(DN.busyNow)return;DN.busyNow=true;DN.abort=false;document.addEventListener('keydown',DN.onKey,true);
  try{const sess=await DN.load();if(!sess){busy(false);if(DN.abort)toast('Débruitage annulé');return}
    busy(true,'Débruitage IA…',0);DN.busyCancel(true);await tick();
    const img=rx(L.canvas).getImageData(0,0,W,H),t0=performance.now();
    const den=await DN.process(img,reg,(k,n)=>{const el=(performance.now()-t0),left=el/k*(n-k);busy(true,`Débruitage IA : tuile ${k} sur ${n} · reste environ ${DN.fmtT(left)} (Échap pour annuler)`,k/n);DN.busyCancel(true)});
    if(!den){busy(false);toast(DN.abort?'Débruitage annulé':'Débruitage impossible');return}
    if(S.doc!==d||!d.layers.includes(L)){busy(false);toast('Débruitage annulé : le calque a changé');return}
    busy(false);DN.ask(d,L,img,den)}
  catch(e){console.error(e);busy(false);toast('Débruitage impossible : '+(e.message||e),5000)}
  finally{DN.busyNow=false;document.removeEventListener('keydown',DN.onKey,true);DN.busyCancel(false)}};
DN.ask=(d,L,img,den)=>{const W=img.width,H=img.height,orig=L.canvas;let k=1,tmr=null;
  const mixSel=(o,r,sel)=>{const out=cloneC(o),g=cx(out);g.globalCompositeOperation='destination-out';g.drawImage(sel,0,0);const t=cloneC(r),tg=cx(t);tg.globalCompositeOperation='destination-in';tg.drawImage(sel,0,0);g.globalCompositeOperation='lighter';g.drawImage(t,0,0);return out};
  const make=()=>{let r=DN.blend(img,den,k,W,H);if(d.sel)r=mixSel(orig,r,d.sel);return r};
  const prev=()=>{clearTimeout(tmr);tmr=setTimeout(()=>{if(!(S.doc===d&&d.layers.includes(L)))return;L.preview=make();markComp()},90)};
  const clear=()=>{clearTimeout(tmr);delete L.preview};
  DN.lastUI={set:v=>{k=v/100;prev()}};
  dialog({title:'Débruitage IA',light:true,body:rangeRow('dn-k','Force',0,100,1,100,' %')+'<p class="muted">Mélange entre l’original (0) et la version débruitée (100).'+(d.sel?' Appliqué uniquement à la sélection.':'')+'</p>',
    onOpen:el=>{const i=$('#dn-k',el);i.oninput=()=>{k=+i.value/100;$('#dn-k-o',el).textContent=fmtN(+i.value,1)+' %';prev()};prev()},
    buttons:[{label:'Annuler',onClick:()=>{clear();markComp()}},
      {label:'Appliquer',primary:true,onClick:()=>{clear();if(!(S.doc===d&&d.layers.includes(L))){toast('Le calque n’existe plus');return}
        try{const r=DN.blend(img,den,k,W,H);applyMasked(L,r,'Débruitage IA');toast('Débruitage IA appliqué')}catch(e){console.error(e);markComp();toast('Débruitage impossible : '+(e.message||e),4000);return false}}}]})};
/* menu Filtre > Netteté et bruit, et palette Ctrl+K (la palette reprend les entrées de menu) */
{const _fi=MENU2.filter.items;
 MENU2.filter.items=function(){const a=_fi.apply(this,arguments),it=MI('Débruitage IA…',{icon:'filter',dis:S.doc?false:NODOC,fn:DN.start});
  return a.map(x=>x&&x.label==='Netteté et bruit'&&typeof x.sub==='function'?{...x,sub:()=>[...x.sub(),it]}:x)}}
