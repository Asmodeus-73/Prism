/* ================= Remplissage génératif (application de bureau seulement) ================= */
/* Stable Diffusion 1.5 inpainting, exécuté par le moteur IA natif (src-tauri/src/sd.rs) : le modèle (1,9 Go) est téléchargé une fois puis lu sur le disque, jamais envoyé à la page. */
/* La page découpe une fenêtre autour de la sélection (environ 512 px), la donne au moteur avec le masque et la description, puis pose le résultat en nouveau calque avec masque progressif. */
const GF={WORK:512,MINCTX:256,GROW:6,STEPS:{rapide:12,standard:20,soignee:30},busyNow:false,abort:false,last:null,OVR:{},
  NEG:'blurry, deformed, low quality, text, watermark'};
GF.T=()=>window.__TAURI__||null;
GF.inv=(cmd,a,o)=>GF.T().core.invoke(cmd,a,o);
GF.listen=async(ev,fn)=>{try{return await GF.T().event.listen(ev,e=>fn(e.payload))}catch(e){return()=>{}}};
GF.fmtT=ms=>{const s=Math.round(ms/1000);return s<90?s+' s':Math.round(s/60)+' min'};
/* fenêtre de travail autour de la zone : carrée si l'image le permet, au moins MINCTX px et deux fois la zone (le contexte guide le modèle), recalée dans l'image ; mise à l'échelle pour que son grand côté fasse WORK px (multiples de 8) */
GF.plan=(bx,W,H,work)=>{work=work||GF.WORK;const bw=bx.x1-bx.x0,bh=bx.y1-bx.y0,side=Math.max(GF.MINCTX,Math.round(Math.max(bw,bh)*2));
  const axis=(a,b,N)=>{const s=Math.min(N,side);let c=Math.round((a+b)/2),x0=Math.round(c-s/2);x0=Math.max(0,Math.min(N-s,x0));return[x0,x0+s]};
  const[x0,x1]=axis(bx.x0,bx.x1,W),[y0,y1]=axis(bx.y0,bx.y1,H),w=x1-x0,h=y1-y0,f=work/Math.max(w,h);
  const r8=v=>Math.max(64,Math.round(v/8)*8),rw=r8(w*f),rh=r8(h*f);
  return{x0,y0,x1,y1,w,h,rw,rh,f:rw/w,fx:rw/w,fy:rh/h}};
/* agrandit un masque 0/1 de r pixels (maximum séparable) : le modèle remplit un peu au-delà de la sélection, le fondu du calque s'y appuie */
GF.grow=(a,w,h,r)=>{if(r<1)return a;const t=new Uint8Array(w*h),o=new Uint8Array(w*h);
  for(let y=0;y<h;y++){const q=y*w;for(let x=0;x<w;x++){let v=0;for(let k=Math.max(0,x-r),e=Math.min(w-1,x+r);k<=e;k++)if(a[q+k]){v=1;break}t[q+x]=v}}
  for(let x=0;x<w;x++)for(let y=0;y<h;y++){let v=0;for(let k=Math.max(0,y-r),e=Math.min(h-1,y+r);k<=e;k++)if(t[k*w+x]){v=1;break}o[y*w+x]=v}
  return o};
/* masque du calque : la sélection de la fenêtre, plus un fondu vers l'extérieur (l'intérieur reste plein, le modèle a rempli au-delà du bord) */
GF.layerMask=(sel,P,W,H)=>{const{x0,y0,w,h,f}=P,crop=mk(w,h);cx(crop).drawImage(sel,x0,y0,w,h,0,0,w,h);
  const soft=blurCanvas(crop,Math.max(1.2,Math.min(30,GF.GROW*0.6/f))),g=cx(soft);g.drawImage(crop,0,0);
  const m=mk(W,H);cx(m).drawImage(soft,x0,y0);return m};
GF.busyCancel=on=>{const b=document.querySelector('#busy>div');if(!b)return;let e=b.querySelector('.gf-cancel');if(on&&!e){e=document.createElement('button');e.className='btn sm gf-cancel';e.textContent='Annuler';e.style.marginTop='10px';e.onclick=()=>{e.disabled=true;e.textContent='Annulation…';GF.cancel()};b.appendChild(e)}else if(!on&&e)e.remove()};
GF.cancel=()=>{GF.abort=true;try{GF.inv('sd_cancel').catch(()=>{})}catch(e){}};
GF.onKey=e=>{if(e.key==='Escape'&&GF.busyNow){GF.cancel();e.stopPropagation()}};
GF.show=(msg,p)=>{busy(true,msg,p);GF.busyCancel(true)};
/* télécharge (une fois) puis charge le modèle ; renvoie false si impossible ou annulé */
GF.prepare=async()=>{const st=await GF.inv('sd_status');
  if(!st.ok){toast('Le moteur IA natif est indisponible : la génération ne peut pas démarrer.',5000);return false}
  if(st.loaded){return true}
  const gb=(st.total/1e9).toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1})+' Go';
  const un=await GF.listen('sd-download',e=>{if(GF.abort)return;
    if(e.phase==='verify')GF.show('Vérification du modèle de génération…',null);
    else if(e.phase==='load')GF.show('Chargement du modèle de génération…',null);
    else{const p=e.total?e.done/e.total:0,g=(e.done/1e9).toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1});GF.show(`Téléchargement du modèle de génération (${gb}, une seule fois)… ${Math.round(p*100)} % (${g} Go)`,p)}});
  GF.show(st.cached?'Chargement du modèle de génération…':`Téléchargement du modèle de génération (${gb}, une seule fois)…`,st.cached?null:0);
  try{const r=await GF.inv('sd_prepare');GF.ep=r.ep;return true}
  catch(e){const m=String(e&&e.message||e);if(m==='annulé'||GF.abort)return false;
    toast(/^Téléchargement impossible/.test(m)?'Le modèle de génération n’a pas pu être téléchargé : vérifiez votre connexion internet puis réessayez. ('+m.replace(/^Téléchargement impossible : /,'').slice(0,140)+')':'Le modèle de génération n’a pas pu se charger : '+m.slice(0,200),7000);return false}
  finally{un()}};
/* cœur : génère la fenêtre ; renvoie {res(canvas rw×rh), plan} ou null (annulé / échec) */
GF.generate=async(sel,opts)=>{const d=S.doc,bx=maskBBox(sel);if(!bx)return null;
  const P=GF.plan(bx,d.w,d.h,opts.work),{x0,y0,w,h,rw,rh}=P,n=rw*rh;
  if(P.f<0.4)toast('Zone très grande : le résultat sera moins détaillé. Une sélection plus petite donne plus de précision.',5000);
  const flat=flatSync(),src=mk(rw,rh),sg=rx(src);sg.fillStyle='#808080';sg.fillRect(0,0,rw,rh);sg.imageSmoothingQuality='high';sg.drawImage(flat,x0,y0,w,h,0,0,rw,rh);
  const mc=mk(rw,rh),mg=rx(mc);mg.imageSmoothingQuality='high';mg.drawImage(sel,x0,y0,w,h,0,0,rw,rh);
  const sd=sg.getImageData(0,0,rw,rh).data,md=mg.getImageData(0,0,rw,rh).data;let hole=new Uint8Array(n),hc=0;
  for(let i=0;i<n;i++)if(md[i*4+3]>127){hole[i]=1;hc++}
  if(!hc){toast('La sélection est trop petite');return null}
  hole=GF.grow(hole,rw,rh,GF.GROW);
  const body=new Uint8Array(n*4);for(let i=0;i<n;i++){body[i*3]=sd[i*4];body[i*3+1]=sd[i*4+1];body[i*3+2]=sd[i*4+2];body[n*3+i]=hole[i]?255:0}
  const seed=opts.seed!=null?opts.seed:Math.floor(Math.random()*4294967295),steps=opts.steps||GF.STEPS.standard;
  const prm={w:rw,h:rh,prompt:opts.prompt||'',negative:opts.negative==null?GF.NEG:opts.negative,steps,guidance:opts.guidance||7.5,seed};
  GF.show('Chargement du modèle de génération…',null);
  if(!(await GF.prepare())||GF.abort)return null;
  const t0=performance.now();let tStep=null;
  const un=await GF.listen('sd-progress',e=>{if(GF.abort)return;
    if(e.phase==='denoise'){if(e.step===1)tStep=performance.now();
      const left=e.step>1&&tStep?(steps-e.step)*((performance.now()-tStep)/(e.step-1)):null;
      GF.show(`Génération… étape ${Math.min(e.step+1,e.total)} sur ${e.total}${left!=null?' (environ '+GF.fmtT(left)+' restantes)':''} · Échap pour annuler`,0.03+0.94*e.step/e.total)}
    else GF.show(e.phase==='decode'?'Finalisation de l’image…':'Préparation de la zone…',e.phase==='decode'?0.97:0.02)});
  let out;try{out=await GF.inv('sd_generate',body,{headers:{'x-params':encodeURIComponent(JSON.stringify(prm))}})}
  catch(e){const m=String(e&&e.message||e);if(m!=='annulé'&&!GF.abort){console.warn('genfill',e);toast('La génération a échoué : '+m.slice(0,200),7000)}return null}finally{un()}
  if(GF.abort)return null;
  const u8=out instanceof Uint8Array?out:new Uint8Array(out);if(u8.length!==n*3){toast('Réponse inattendue du moteur de génération');return null}
  const res=mk(rw,rh),rg=cx(res),im=rg.createImageData(rw,rh);for(let i=0;i<n;i++){im.data[i*4]=u8[i*3];im.data[i*4+1]=u8[i*3+1];im.data[i*4+2]=u8[i*3+2];im.data[i*4+3]=255}rg.putImageData(im,0,0);
  GF.last={ms:Math.round(performance.now()-t0),w:rw,h:rh,steps,seed,ep:GF.ep};return{res,plan:P,seed}};
/* génère puis pose le résultat en calque + masque (annulable avec Ctrl+Z) */
GF.fill=async(opts)=>{opts=opts||{};const d=S.doc;if(!d)return false;
  if(!GF.T()){toast('Le remplissage génératif est disponible dans l’application de bureau.',4500);return false}
  const sel=d.sel;if(!sel||!maskBBox(sel)){toast('Sélectionnez d’abord la zone à remplir (lasso, rectangle…).',4500);return false}
  if(GF.busyNow)return false;GF.busyNow=true;GF.abort=false;document.addEventListener('keydown',GF.onKey,true);
  const h0=S.history[S.hi];let r=null;
  try{r=await GF.generate(sel,opts)}catch(e){console.warn('genfill',e);toast('La génération a échoué : '+String(e&&e.message||e).slice(0,200),7000)}
  finally{GF.busyNow=false;document.removeEventListener('keydown',GF.onKey,true);busy(false);GF.busyCancel(false)}
  if(GF.abort){toast('Génération annulée');return false}
  if(!r)return false;
  if(S.doc!==d||S.history[S.hi]!==h0){toast('Génération abandonnée : le document a changé');return false}
  const{res,plan:P}=r,{x0,y0,w,h}=P,cv=mk(d.w,d.h),g=cx(cv);g.imageSmoothingQuality='high';g.drawImage(res,0,0,res.width,res.height,x0,y0,w,h);
  const L=newPixel('Remplissage génératif',cv);L.mask=GF.layerMask(sel,P,d.w,d.h);L.editMask=true;
  insertLayer(L,'Remplissage génératif',true);
  toast(`Remplissage terminé en ${GF.fmtT(GF.last.ms)}. Peignez le masque pour retoucher les bords, ou annulez (Ctrl+Z) et relancez pour une autre variante.`,7000);return true};
GF.dialog=async()=>{const d=S.doc;if(!d){toast('Ouvrez d’abord une photo');return}
  if(!GF.T()){toast('Le remplissage génératif est disponible dans l’application de bureau.',4500);return}
  if(!d.sel||!maskBBox(d.sel)){toast('Sélectionnez d’abord la zone à remplir (lasso, rectangle…), puis relancez.',5000);return}
  let st=null,gpu=null;try{st=await GF.inv('sd_status');const a=await GF.inv('ai_status');gpu=a&&a.gpu}catch(e){}
  const notes=[];if(st&&!st.cached)notes.push(`Premier usage : le modèle (${((st.total||2.1e9)/1e9).toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1})} Go) est téléchargé une seule fois.`);
  if(!gpu)notes.push('Sans carte graphique prise en charge, la génération prend plusieurs minutes.');
  const q=PREF.get('gfQual','standard');
  dialog({title:'Remplissage génératif',body:`<label class="field">Que doit-il apparaître dans la zone ?<textarea id="gfP" rows="3" placeholder="Ex. : a red balloon · green grass and wild flowers · (vide : prolonge le décor)">${esc(PREF.get('gfPrompt',''))}</textarea></label>
    <p class="muted">Écrivez en anglais : le modèle comprend bien mieux l’anglais que le français. Laissez vide pour combler la zone avec le décor environnant.</p>
    <label class="field">À éviter (anglais)<input type="text" id="gfN" value="${esc(PREF.get('gfNeg',GF.NEG))}"></label>
    <label class="field">Qualité<select id="gfQ"><option value="rapide" ${q==='rapide'?'selected':''}>Rapide (${GF.STEPS.rapide} étapes)</option><option value="standard" ${q==='standard'?'selected':''}>Standard (${GF.STEPS.standard} étapes)</option><option value="soignee" ${q==='soignee'?'selected':''}>Soignée (${GF.STEPS.soignee} étapes)</option></select></label>
    <p class="muted">Le calcul se fait sur votre appareil : la photo n’est pas envoyée. Le résultat arrive dans un nouveau calque avec masque, modifiable et annulable.${notes.length?' '+esc(notes.join(' ')):''}</p>`,
    onOpen:el=>{setTimeout(()=>{const t=$('#gfP',el);if(t)t.focus()},30)},
    buttons:[{label:'Annuler'},{label:'Générer',primary:true,onClick:el=>{const prompt=$('#gfP',el).value.trim(),neg=$('#gfN',el).value.trim(),ql=$('#gfQ',el).value;
      PREF.set('gfPrompt',prompt);PREF.set('gfNeg',neg);PREF.set('gfQual',ql);setTimeout(()=>GF.fill({prompt,negative:neg,steps:GF.STEPS[ql]||GF.STEPS.standard,...GF.OVR}),30)}}]})};
window.PrismGF=GF;
/* menu Image, palette de commandes (elle reprend les commandes des menus) et carte de l'onglet IA (application de bureau) */
{const _mi=MENU2.image.items;MENU2.image.items=()=>{const a=_mi();if(!a.some(x=>x&&x.label==='Remplissage génératif…'))a.push(MI('Remplissage génératif…',{icon:'subject',fn:GF.dialog,dis:docDis()}));return a}}
{const CARD=`<div class="card gf-card"><h4><svg viewBox="0 0 20 20"><rect x="2.5" y="2.5" width="15" height="15" rx="3" stroke-dasharray="2 2"/><path d="M10 6v8M6 10h8"/></svg>Remplissage génératif</h4><p>Sélectionnez une zone, décrivez en anglais ce qui doit y apparaître : l’IA le crée et le fond dans la photo, dans un calque avec masque. Le calcul se fait sur votre appareil.</p><div class="acts"><button class="btn sm primary" data-gf-go="1">Remplir la sélection…</button></div></div>`;
  const inject=()=>{const p=document.getElementById('pane-ai');if(!p||!GF.T()||p.querySelector('.gf-card'))return;const cards=[...p.querySelectorAll('.card')],ref=cards.find(c=>/Gomme/.test(c.querySelector('h4')?.textContent||''));
    const t=document.createElement('div');t.innerHTML=CARD;const c=t.firstChild;if(ref&&ref.nextSibling)ref.parentNode.insertBefore(c,ref.nextSibling);else p.appendChild(c)};
  const p=document.getElementById('pane-ai');if(p){p.addEventListener('click',e=>{if(e.target.closest('[data-gf-go]')){e.stopPropagation();GF.dialog()}},true);new MutationObserver(inject).observe(p,{childList:true});inject()}}
