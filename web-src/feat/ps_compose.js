/* ===== Photo Studio (MIT), suite : harmoniser un calque, remplacer le ciel, mise à l'échelle selon le contenu,
   sélection des zones nettes, nettoyage des franges de couleur, export d'une LUT .cube depuis les calques de réglage. ===== */
const PSX=window.PSX;
const hex=c=>'#'+c.map(v=>Math.round(clamp(v,0,255)).toString(16).padStart(2,'0')).join('');
const fillC=(w,h,col)=>{const c=mk(w,h),g=cx(c);g.fillStyle=col;g.fillRect(0,0,w,h);return c};
const docOK=()=>S.doc?false:NODOC;

/* ---------- Calque > Harmoniser avec le dessous… : le calque prend la lumière et la dominante de ce qu'il recouvre ---------- */
async function harmonizeOpen(){const d=S.doc;if(!d)return;const L=PSX.target();if(!L)return;const i=d.layers.indexOf(L);
  if(i<1){toast('Il n’y a rien sous ce calque : placez-le au-dessus de la photo');return}
  const b=maskBBox(L.canvas);if(!b){toast('Ce calque est vide');return}
  busy(true,'Analyse du calque…',null);
  try{const k=Math.min(1,1200/Math.max(d.w,d.h)),below=await renderDoc(k,{upto:i});
    /* la zone à imiter : le cadre du calque élargi d'un quart de chaque côté */
    const mx=(b.x1-b.x0)*.25,my=(b.y1-b.y0)*.25,x0=Math.max(0,(b.x0-mx)*k|0),y0=Math.max(0,(b.y0-my)*k|0),x1=Math.min(below.width,Math.ceil((b.x1+mx)*k)),y1=Math.min(below.height,Math.ceil((b.y1+my)*k));
    await PSX.load();const ts=PSI.run('labStats',{img:PSX.img(below,x0,y0,Math.max(1,x1-x0),Math.max(1,y1-y0))});
    FILTERS.harmonize.last={...(FILTERS.harmonize.last||{}),ts}}
  catch(e){console.error(e);toast('Analyse impossible : '+(e.message||e),4000);return}finally{busy(false)}
  filterDialog('harmonize')}
PSX.filter('harmonize',{name:'Harmoniser avec le dessous',
  note:'Le calque prend la lumière et la dominante de couleur de ce qu’il recouvre, pour un montage plus crédible.',
  params:[['strength','Intensité',0,100,1,100,' %'],['luminance','Luminosité et contraste',0,100,1,50,' %'],['color','Couleur',0,100,1,35,' %']],
    needs:'ouvrez Calque > Harmoniser avec le dessous',
  /* p.ts : la lumière et la couleur du dessous, mesurées à l'ouverture et gardées avec l'effet modifiable */
  job:(img,p)=>p.ts?['harmonize',{img,targetStats:p.ts,o:{strength:p.strength,luminance:p.luminance,color:p.color}}]:null});

/* ---------- Image > Remplacer le ciel… ---------- */
const SKY_FR={clear:'Bleu dégagé',fair:'Beau temps',scattered:'Nuages épars',sunset:'Coucher de soleil',dusk:'Heure bleue',storm:'Orage',overcast:'Ciel couvert'};
const SKY_IDS=['clear','fair','scattered','sunset','dusk','storm','overcast'];
const SKYST={preset:1,shift:0,fade:12,brightness:0,temperature:0,scale:100,offsetX:0,offsetY:0,flip:false,lighting:40,mode:0,color:50};
async function skyOpen(){const d=S.doc;if(!d)return;await PSX.load();let mc=d.sel;
  if(!mc){busy(true,'Recherche du ciel…',0);try{mc=AI.skyMask?await AI.skyMask(p=>busy(true,'Recherche du ciel…',p)):null}catch(e){console.error(e)}finally{busy(false)}
    if(S.doc!==d)return;if(!mc||!maskBBox(mc)){toast('Aucun ciel trouvé : sélectionnez-le d’abord (Sélection > Sélectionner le ciel), puis réessayez',5000);return}}
  const W=d.w,H=d.h,full=PSX.mask(mc,W,H),horizon=PSI.run('skyHorizon',{mask:full});
  /* aperçu dans la fenêtre : tout est recalculé à petite taille, sur la page (quelques millisecondes) */
  const k=Math.min(1,420/Math.max(W,H)),pw=Math.max(8,Math.round(W*k)),ph=Math.max(8,Math.round(H*k));
  const base=PSX.up(await renderDoc(Math.min(1,900/Math.max(W,H))),pw,ph),smallMask=PSX.mask(PSX.maskCanvas(full),pw,ph),hS=Math.max(1,Math.round(horizon*k));
  const st={...SKYST},cache=new Map();let custom=null;
  const skyBase=(id,w,h)=>{if(id==='custom'&&custom)return custom;const key=id+w;if(!cache.has(key))cache.set(key,PSI.run('skyRender',{preset:id,width:w,height:h,seed:7}));return cache.get(key)};
  const skyH=w=>Math.max(16,Math.round(w*Math.max(horizon,H*.3)/W));
  function parts(w,h,mask,hz,kk){const id=st.preset===7?'custom':SKY_IDS[st.preset],sw=Math.min(2400,w);
    const sky=PSI.run('skyLayer',{sky:skyBase(id,sw,skyH(sw)),width:w,height:h,placement:{scale:st.scale/100,flip:st.flip,offsetX:st.offsetX/100,offsetY:st.offsetY/100},horizon:hz,brightness:st.brightness,temperature:st.temperature});
    const m=PSI.run('skyMask',{mask:mask,shift:Math.round(st.shift*kk),fade:st.fade*kk});
    const light=PSI.run('skyLight',{sky,mask:m,horizon:hz}),fg=PSI.run('foregroundLight',{mask:m,horizon:hz});return{sky,m,light,fg}}
  function compose(g,w,h,P){const sky=PSX.canvas(P.sky),sm=PSX.maskCanvas(P.m),fg=PSX.maskCanvas(P.fg),col=hex(P.light);
    const lay=(c,mask,blend,op)=>{const t=cloneC(c),tg=cx(t);tg.globalCompositeOperation='destination-in';tg.drawImage(mask,0,0,w,h);g.globalCompositeOperation=blend;g.globalAlpha=op;g.drawImage(t,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over'};
    lay(fillC(w,h,col),fg,st.mode?'screen':'multiply',st.lighting/100*.6);lay(fillC(w,h,col),fg,'color',st.color/100*.4);lay(sky,sm,'source-over',1)}
  let tmr=null;const draw=()=>{clearTimeout(tmr);tmr=setTimeout(()=>{const cv=$('#sk-prev');if(!cv)return;try{const P=parts(pw,ph,smallMask,hS,k),g=cx(cv);g.clearRect(0,0,pw,ph);g.drawImage(base,0,0);compose(g,pw,ph,P)}catch(e){console.error(e)}},40)};
  const R=(key,l,a,b,s,u)=>rangeRow('sk-'+key,l,a,b,s,st[key],u),SEC=(t,open,h)=>`<details class="sk-s" ${open?'open':''}><summary><b>${t}</b></summary>${h}</details>`;
  dialog({title:'Remplacer le ciel',light:true,
    body:`<canvas id="sk-prev" width="${pw}" height="${ph}" style="max-width:100%;max-height:200px;border-radius:6px;display:block;margin:0 auto 8px"></canvas>
      <div class="row"><label for="sk-preset">Ciel</label><select id="sk-preset">${SKY_IDS.map((id,i)=>`<option value="${i}" ${st.preset===i?'selected':''}>${SKY_FR[id]}</option>`).join('')}<option value="7">Ma photo…</option></select><output></output></div>`+
      /* trois volets, un seul ouvert : la fenêtre reste assez basse pour laisser voir la photo et les boutons */
      SEC('Ciel',true,R('shift','Bord du ciel',-50,50,1,' px')+R('fade','Fondu',0,100,1,' px')+R('brightness','Luminosité du ciel',-100,100,1,'')+R('temperature','Température du ciel',-100,100,1,''))+
      SEC('Position',false,R('scale','Échelle',50,300,1,' %')+R('offsetX','Décalage horizontal',-50,50,1,' %')+R('offsetY','Décalage vertical',-50,50,1,' %')+
        `<div class="row"><label for="sk-flip">Miroir</label><input type="checkbox" id="sk-flip" ${st.flip?'checked':''} style="justify-self:start"><output></output></div>`)+
      SEC('Premier plan',false,R('lighting','Éclairage du premier plan',0,100,1,' %')+`<div class="row"><label for="sk-mode">Mode d’éclairage</label><select id="sk-mode"><option value="0">Produit</option><option value="1" ${st.mode?'selected':''}>Superposition claire</option></select><output></output></div>`+R('color','Couleur du premier plan',0,100,1,' %'))+
      '<p class="muted" style="margin:6px 0 0">Le résultat arrive en calques groupés (ciel masqué, éclairage, couleur) : chacun reste modifiable.</p>',
    onOpen:el=>{['shift','fade','brightness','temperature','scale','offsetX','offsetY','lighting','color'].forEach(key=>{const i=$('#sk-'+key,el);i.oninput=()=>{st[key]=+i.value;$('#sk-'+key+'-o',el).textContent=i.value+(i.parentNode.querySelector('output').textContent.replace(/^-?[\d.]+/,''));draw()}});
      $$('details.sk-s',el).forEach(dt=>dt.addEventListener('toggle',()=>{if(dt.open)$$('details.sk-s',el).forEach(o=>{if(o!==dt)o.open=false})}));
      $('#sk-flip',el).onchange=e=>{st.flip=e.target.checked;draw()};$('#sk-mode',el).onchange=e=>{st.mode=+e.target.value;draw()};
      $('#sk-preset',el).onchange=e=>{const v=+e.target.value;if(v<7){st.preset=v;draw();return}
        const inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.onchange=async()=>{const f=inp.files&&inp.files[0];if(!f){e.target.value=st.preset;return}
          try{const bm=await createImageBitmap(f),kk=Math.min(1,2400/bm.width),c=mk(bm.width*kk,bm.height*kk);cx(c).drawImage(bm,0,0,c.width,c.height);custom=PSX.img(c);st.preset=7;draw()}catch(err){toast('Photo illisible');e.target.value=st.preset}};inp.click()};
      draw()},
    buttons:[{label:'Annuler',onClick:()=>clearTimeout(tmr)},{label:'Remplacer',primary:true,onClick:()=>{clearTimeout(tmr);Object.assign(SKYST,st,{preset:st.preset===7?1:st.preset});skyApply(d,full,horizon,st,custom)}}]})}
async function skyApply(d,full,horizon,st,custom){const W=d.w,H=d.h;busy(true,'Remplacement du ciel…',0);let j=null;const T=x=>(j=PSX.track(x)).promise;
  try{const id=st.preset===7&&custom?'custom':SKY_IDS[st.preset===7?1:st.preset],sw=Math.min(2400,W),sh=Math.max(16,Math.round(sw*Math.max(horizon,H*.3)/W));
    const base=id==='custom'?custom:await T(PSX.run('skyRender',{preset:id,width:sw,height:sh,seed:7}));busy(true,'Remplacement du ciel…',.3);
    const sky=await T(PSX.run('skyLayer',{sky:base,width:W,height:H,placement:{scale:st.scale/100,flip:st.flip,offsetX:st.offsetX/100,offsetY:st.offsetY/100},horizon,brightness:st.brightness,temperature:st.temperature},{copy:true}));busy(true,'Remplacement du ciel…',.6);
    const m=await T(PSX.run('skyMask',{mask:full,shift:st.shift,fade:st.fade},{copy:true}));busy(true,'Remplacement du ciel…',.8);
    const light=PSI.run('skyLight',{sky,mask:m,horizon}),fg=PSI.run('foregroundLight',{mask:m,horizon});
    if(S.doc!==d){toast('La photo a changé : ciel non remplacé');return}
    const col=hex(light),fgC=PSX.maskCanvas(fg),grp={id:'g'+uid8(),name:'Remplacement du ciel'};
    const Ll=newPixel('Éclairage du ciel',fillC(W,H,col));Ll.mask=fgC;Ll.blend=st.mode?'screen':'multiply';Ll.opacity=st.lighting/100*.6;Ll.grp={...grp};
    const Lc=newPixel('Couleur du ciel',fillC(W,H,col));Lc.mask=cloneC(fgC);Lc.blend='color';Lc.opacity=st.color/100*.4;Lc.grp={...grp};
    const Ls=newPixel('Ciel',PSX.canvas(sky));Ls.mask=PSX.maskCanvas(m);Ls.grp={...grp};
    /* au-dessus de la photo, mais sous les calques de réglage du haut : le ciel reçoit le même rendu que le reste */
    let at=d.layers.length;while(at>0&&d.layers[at-1].kind==='adjust')at--;
    d.layers.splice(at,0,Ll,Lc,Ls);d.active=at+2;markComp();pushHistory('Remplacer le ciel');syncAll()}
  catch(e){if(!PSX.cancelled(e)){console.error(e);toast('Remplacement du ciel impossible : '+(e.message||e),4000)}}
  finally{PSX.untrack(j);busy(false)}}

/* ---------- Image > Mise à l'échelle selon le contenu… : change le format en retirant ou doublant des « coutures » peu visibles ---------- */
function seamOpen(){const d=S.doc;if(!d)return;const L=PSX.target();if(!L)return;let lock=false;
  dialog({title:'Mise à l’échelle selon le contenu',
    body:`<p class="muted" style="margin:0 0 8px">Change la largeur ou la hauteur en retirant (ou doublant) des lignes de pixels là où l’image a peu de détails : le sujet garde ses proportions. Le calque « ${esc(L.name)} » est traité ainsi, les autres sont simplement redimensionnés.</p>
      <div class="inline"><label class="field">Largeur (px)<input type="number" id="cs-w" value="${d.w}" min="16" max="30000"></label><label class="field">Hauteur (px)<input type="number" id="cs-h" value="${d.h}" min="16" max="30000"></label></div>
      <div class="row"><label for="cs-r">Format</label><select id="cs-r"><option value="">Libre</option>${[['1:1','Carré 1:1'],['4:5','Portrait 4:5'],['2:3','Portrait 2:3'],['3:2','Paysage 3:2'],['16:9','Paysage 16:9']].map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select><output></output></div>
      <div class="row"><label for="cs-p">Protéger</label><select id="cs-p"><option value="subj">Le sujet (IA)</option><option value="skin">Les tons chair</option>${d.sel?'<option value="sel">La sélection</option>':''}<option value="none">Rien</option></select><output></output></div>
      ${rangeRow('cs-a','Part des coutures',0,100,1,100,' %')}`,
    onOpen:el=>{$('#cs-r',el).onchange=e=>{const v=e.target.value;if(!v)return;const[a,b]=v.split(':').map(Number);/* on garde la plus grande dimension possible sans agrandir */
        if(d.w/d.h>a/b){$('#cs-h',el).value=d.h;$('#cs-w',el).value=Math.round(d.h*a/b)}else{$('#cs-w',el).value=d.w;$('#cs-h',el).value=Math.round(d.w*b/a)}};
      $('#cs-a',el).oninput=e=>{$('#cs-a-o',el).textContent=e.target.value+' %'}},
    buttons:[{label:'Annuler'},{label:'Appliquer',primary:true,onClick:el=>{const w=clamp(Math.round(+$('#cs-w',el).value||0),16,30000),h=clamp(Math.round(+$('#cs-h',el).value||0),16,30000);
      if(w===d.w&&h===d.h){toast('Choisissez une autre taille');return false}if(w*h>MAX_PX){toast('Taille trop grande pour ce navigateur');return false}
      seamApply(d,L,w,h,$('#cs-p',el).value,+$('#cs-a',el).value/100)}}]})}
async function seamApply(d,L,w,h,prot,amount){const orig=L.canvas,NAME='Mise à l’échelle selon le contenu';let j=null;
  try{let protect=null,skin=false;
    if(prot==='subj'){const m=AI.subjectMask?await AI.subjectMask():null;if(m)protect=PSX.mask(m,d.w,d.h);else toast('Pas de sujet trouvé : rien n’est protégé',3500)}
    else if(prot==='sel'&&d.sel)protect=PSX.mask(d.sel,d.w,d.h);else if(prot==='skin')skin=true;
    busy(true,NAME+'…',0);
    j=PSX.track(PSX.run('seamScale',{img:PSX.img(orig),width:w,height:h,amount,protect,skin},{onProgress:f=>busy(true,NAME+'…',f)}));const r=await j.promise;
    if(!PSX.alive(d,L)||L.canvas!==orig||d.w!==orig.width){toast('La photo a changé pendant le calcul : rien n’a été modifié');return}
    const out=PSX.canvas(r);resizeDoc(w,h,NAME);
    /* le calque traité reçoit le résultat des coutures (les autres ont été redimensionnés normalement) ; une seule étape d'historique */
    if(PSX.alive(d,L)){L.canvas=out;delete L.hi;S.history[S.hi]=snap(NAME);markComp();scheduleSave();syncAll()}}
  catch(e){if(!PSX.cancelled(e)){console.error(e);toast(NAME+' impossible : '+(e.message||e),4000)}}
  finally{PSX.untrack(j);busy(false)}}

/* ---------- Sélection > Zones nettes… : sélectionne ce qui est au point ---------- */
async function focusOpen(){const d=S.doc;if(!d)return;await PSX.load();const flatC=flatSync(),sm=PSX.small(flatC,1000),img=PSX.img(sm.c);
  const st={range:Math.round(PSI.run('autoFocusRange',{img})),noise:0,soft:1},sel0=d.sel;let tmr=null,job=null;
  const show=()=>{clearTimeout(tmr);tmr=setTimeout(async()=>{if(job)job.cancel();job=PSX.run('focusArea',{img,o:{range:st.range,noise:st.noise,softenEdges:!!st.soft}},{copy:true});
    try{const m=await job.promise;job=null;if(S.doc!==d)return;d.sel=PSX.up(PSX.maskCanvas(m),d.w,d.h);selChanged();markComp()}catch(e){if(!PSX.cancelled(e))console.error(e)}},150)};
  dialog({title:'Zones nettes',light:true,body:'<p class="muted" style="margin:0 0 8px">Sélectionne les parties de la photo qui sont au point.</p>'+rangeRow('fa-r','Plage de netteté',0,100,1,st.range,'')+rangeRow('fa-n','Bruit à ignorer',0,100,1,0,'')+
      `<div class="row"><label for="fa-s">Adoucir les bords</label><input type="checkbox" id="fa-s" checked style="justify-self:start"><output></output></div>`,
    onOpen:el=>{$('#fa-r',el).oninput=e=>{st.range=+e.target.value;$('#fa-r-o',el).textContent=e.target.value;show()};$('#fa-n',el).oninput=e=>{st.noise=+e.target.value;$('#fa-n-o',el).textContent=e.target.value;show()};$('#fa-s',el).onchange=e=>{st.soft=e.target.checked;show()};show()},
    buttons:[{label:'Annuler',onClick:()=>{clearTimeout(tmr);if(job)job.cancel();d.sel=sel0;selChanged();markComp()}},
      {label:'Sélectionner',primary:true,onClick:()=>{clearTimeout(tmr);const m=d.sel;d.sel=sel0;if(m&&m!==sel0)combineSel(m,'new','Sélectionner les zones nettes');else selChanged()}}]})}

/* ---------- Calque > Masque > Nettoyer les franges de couleur… : retire le liseré de l'ancien fond autour d'un détourage ---------- */
PSX.filter('decontam',{name:'Nettoyer les franges de couleur',
  note:'Pour un calque détouré : les bords prennent la couleur du sujet au lieu de celle de l’ancien fond. Utilise le masque du calque (ou la sélection).',
  params:[['amount','Intensité',0,100,1,80,' %']],
  needs:'ajoutez d’abord un masque au calque ou faites une sélection',
  job:(img,p)=>{const d=S.doc,L=pixelTarget(),src=(L&&L.mask)||(d&&d.sel);if(!src)return null;
    return['decontaminate',{img,mask:PSX.mask(src,img.width,img.height),amount:p.amount/100}]}});

/* ---------- Image > Looks et LUT > Exporter une LUT .cube… : les calques de réglage globaux visibles, en table de couleurs ---------- */
const SPATIAL=['texture','clarity','dehaze','sharpen','noise','vignette','grain'];
async function exportCube(){const d=S.doc;if(!d)return;const Ls=d.layers.filter(L=>L.kind==='adjust'&&L.visible!==false&&!L.mask&&L.dev);
  if(!Ls.length){toast('Aucun calque de réglage global visible à exporter');return}
  const N=33,n=N*N*N,w=N*N,h=N,c=mk(w,h),g=rx(c),im=g.createImageData(w,h),a=im.data;
  for(let b=0;b<N;b++)for(let gg=0;gg<N;gg++)for(let r=0;r<N;r++){const i=((gg*w)+b*N+r)*4;a[i]=Math.round(r*255/(N-1));a[i+1]=Math.round(gg*255/(N-1));a[i+2]=Math.round(b*255/(N-1));a[i+3]=255}
  let skipped=false;
  for(const L of Ls){const dv=JSON.parse(JSON.stringify(L.dev));SPATIAL.forEach(k=>{if(dv[k]){skipped=true;dv[k]=0}});developCPU(im,dv,{scale:1,ox:0,oy:0,docW:w,docH:h},null,L.opacity==null?1:L.opacity)}
  const lines=['# Prism : calques de réglage de « '+String(d.name||'photo').replace(/[\r\n]/g,' ')+' »','TITLE "'+String(d.name||'Prism').replace(/["\r\n]/g,'')+'"','LUT_3D_SIZE '+N,'DOMAIN_MIN 0 0 0','DOMAIN_MAX 1 1 1'];
  for(let b=0;b<N;b++)for(let gg=0;gg<N;gg++)for(let r=0;r<N;r++){const i=((gg*w)+b*N+r)*4;lines.push((a[i]/255).toFixed(6)+' '+(a[i+1]/255).toFixed(6)+' '+(a[i+2]/255).toFixed(6))}
  const name=String(d.name||'prism').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]/g,'_')+'.cube';
  await saveFile(new Blob([lines.join('\n')+'\n'],{type:'text/plain'}),name);
  if(skipped)toast('LUT exportée. Texture, clarté, voile, netteté, bruit, vignette et grain ne tiennent pas dans une LUT : ils n’y sont pas.',6000)}
Object.assign(PSX,{exportCube,harmonizeOpen,skyOpen,skyApply,seamOpen,seamApply,focusOpen});

/* ---------- menus ---------- */
PSX.addToMenu('layer',null,()=>[MI('Harmoniser avec le dessous…',{icon:'filter',dis:docOK(),fn:harmonizeOpen})],/^Monter le calque/);
PSX.addToMenu('image',null,()=>[MI('Remplacer le ciel…',{icon:'filter',dis:docOK(),fn:skyOpen}),MI('Mise à l’échelle selon le contenu…',{icon:'filter',dis:docOK(),fn:seamOpen})],/^Rotation/);
PSX.addToMenu('image','Looks et LUT',()=>[MI('Exporter une LUT .cube…',{dis:docOK(),fn:exportCube})]);
PSX.addToMenu('select',null,()=>[MI('Zones nettes…',{dis:docOK(),fn:focusOpen})],/^Détourer le sujet/);
{const _ms=maskSub;maskSub=function(){const a=_ms.apply(this,arguments)||[];return a.concat([SEP,MI('Nettoyer les franges de couleur…',{dis:docOK(),fn:()=>filterDialog('decontam')})])}}
Object.assign(PSX,{harmonizeOpen,skyOpen,seamOpen,focusOpen});
