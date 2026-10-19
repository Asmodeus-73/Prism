/* ===== 0.4: Double exposition, like the multiple exposure mode of a Fujifilm camera (Additif, Moyenne, Clair, Sombre, plus Écran)
   or done by the AI in one click (Silhouette: the second photo fills the subject, the background goes white).
   Non-destructive: the second photo is a layer (blend mode + opacity, mask for the silhouette), adjustable live in the dialog. ===== */

const DX={};
{const st=document.createElement('style');st.textContent='@media (min-width:701px){.scrim.light .dlg.dx-dlg{right:10px;top:92px;width:360px;max-height:calc(100dvh - 110px);overflow:auto}}';document.body.appendChild(st)}
const DX_MODES=[['screen','Écran','Le rendu film classique : seules les lumières s’additionnent'],['average','Moyenne','Les deux photos à parts égales (Fujifilm : Moyenne)'],['add','Additif','Les deux expositions s’additionnent, comme sur pellicule (Fujifilm : Additif)'],['lighten','Clair','Garde le plus clair des deux (Fujifilm : Clair)'],['darken','Sombre','Garde le plus sombre des deux (Fujifilm : Sombre)'],['silhouette','Silhouette (IA)','La seconde photo remplit le sujet, le fond devient clair']];
const pick1=()=>new Promise(res=>{const i=document.createElement('input');i.type='file';i.accept='image/*,.heic,.heif,.tif,.tiff,'+RAW_ACCEPT;i.onchange=()=>res(i.files[0]||null);i.oncancel=()=>res(null);i.click()});
const pick2=()=>new Promise(res=>{const i=document.createElement('input');i.type='file';i.multiple=true;i.accept='image/*,.heic,.heif,.tif,.tiff,'+RAW_ACCEPT;i.onchange=()=>res([...i.files]);i.oncancel=()=>res([]);i.click()});
async function decode(f){let bm=null;if(!RAW_EXT.test(f.name||'')&&!/\.(heic|heif|tiff?)$/i.test(f.name||'')){try{bm=await createImageBitmap(f)}catch(e){}}
  const src=bm||await styleFromFile(f);const d=S.doc,lim=d?Math.max(d.w,d.h)*1.5:6000,s=Math.min(1,lim/Math.max(src.width,src.height));
  const c=mk(Math.max(1,Math.round(src.width*s)),Math.max(1,Math.round(src.height*s)));const g=rx(c);g.imageSmoothingQuality='high';g.drawImage(src,0,0,c.width,c.height);bm&&bm.close&&bm.close();return c}
function grayOf(c){const o=mk(c.width,c.height),g=rx(o);g.drawImage(c,0,0);for(let y0=0;y0<c.height;y0+=512){const h=Math.min(512,c.height-y0),im=g.getImageData(0,y0,c.width,h),a=im.data;for(let i=0;i<a.length;i+=4){const l=0.2126*a[i]+0.7152*a[i+1]+0.0722*a[i+2];a[i]=a[i+1]=a[i+2]=l}g.putImageData(im,0,y0)}return o}

// draws the second photo into a document-size canvas: "cover" fit, then zoom, offset (in % of the document) and mirror
function drawB(st){const d=S.doc,c=st.Lb.canvas.width===d.w&&st.Lb.canvas.height===d.h?st.Lb.canvas:mk(d.w,d.h),g=cx(c),src=st.bw?(st.gray||(st.gray=grayOf(st.src))):st.src;
  g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.globalAlpha=1;g.clearRect(0,0,d.w,d.h);
  const box=st.mode==='silhouette'&&st.bb?st.bb:{x0:0,y0:0,x1:d.w,y1:d.h},bw=box.x1-box.x0,bh=box.y1-box.y0;
  const k=Math.max(bw/src.width,bh/src.height)*st.zoom,w=src.width*k,h=src.height*k,cxp=(box.x0+box.x1)/2+st.ox/100*d.w,cyp=(box.y0+box.y1)/2+st.oy/100*d.h;
  g.imageSmoothingQuality='high';g.save();g.translate(cxp,cyp);if(st.flip)g.scale(-1,1);g.drawImage(src,-w/2,-h/2,w,h);g.restore();
  if(st.mode==='add'){// additive: baked against the photo below, the layer is then shown normally
    const base=st.flat;g.globalCompositeOperation='lighter';g.drawImage(base,0,0);g.globalCompositeOperation='source-over'}
  st.Lb.canvas=c}
function applyMode(st){const L=st.Lb,m=st.mode;
  L.blend=m==='screen'||m==='silhouette'?'screen':m==='lighten'?'lighten':m==='darken'?'darken':'source-over';
  L.opacity=m==='average'?st.mix/200:st.mix/100;// Moyenne: 100 % on the slider = an exact 50/50 average
  L.mask=m==='silhouette'&&st.subj?st.subj:null;
  if(st.Lf){st.Lf.visible=m==='silhouette';st.Lf.opacity=st.bg/100}
  if(m==='add'||st.addWas){drawB(st)}st.addWas=m==='add';
  markComp();requestRender()}
async function ensureSubject(st){if(st.subj!==undefined)return st.subj;const d=S.doc;let m=null;try{m=await AI.subjectMask()}catch(e){console.warn(e)}
  if(S.doc!==d)return null;let bb=m?maskBBox(m):null;if(bb&&(bb.x1-bb.x0)*(bb.y1-bb.y0)<d.w*d.h*0.02)bb=null;
  st.subj=bb?m:null;st.bb=bb;
  if(st.subj){const inv=fullMask(),g=cx(inv);g.globalCompositeOperation='destination-out';g.drawImage(st.subj,0,0);const wc=mk(d.w,d.h),wg=cx(wc);wg.fillStyle='#ffffff';wg.fillRect(0,0,d.w,d.h);
    st.Lf=newPixel('Fond clair',wc);st.Lf.mask=inv;st.Lf.visible=false;const i=d.layers.indexOf(st.Lb);d.layers.splice(i,0,st.Lf);d.active=d.layers.indexOf(st.Lb);syncAll()}
  return st.subj}

async function dexpDialog(file){const d=S.doc;if(!d){toast('Ouvrez d’abord une photo');return}
  if(!file)file=await pick1();if(!file)return;
  busy(true,'Lecture de la seconde photo…',null);let src;try{await tick();src=await decode(file)}catch(e){busy(false);console.error(e);toast('Cette photo ne s’ouvre pas : '+(e.message||e),5000);return}busy(false);
  if(S.doc!==d)return;
  const h0=S.history[S.hi],a0=d.active,n0=d.layers.length;
  const st={src,gray:null,bw:false,mode:'screen',mix:100,bg:90,zoom:1,ox:0,oy:0,flip:false,flat:flatSync&&cloneC(flatSync()),subj:undefined,bb:null,Lf:null};
  st.Lb=newPixel('Double exposition · '+(file.name||'photo').replace(/\.[^.]+$/,''),mk(d.w,d.h));d.layers.push(st.Lb);d.active=d.layers.length-1;
  drawB(st);applyMode(st);syncAll();
  let done=false;
  const cleanup=()=>{if(done)return;done=true;for(const L of [st.Lb,st.Lf]){const i=L?d.layers.indexOf(L):-1;if(i>=0)d.layers.splice(i,1)}d.active=Math.min(a0,d.layers.length-1);markComp();syncAll()};
  const modes=DX_MODES.map(([v,l,t])=>`<button class="btn sm dx-m" data-m="${v}" title="${esc(t)}">${esc(l)}</button>`).join('');
  dialog({title:'Double exposition',light:true,body:`<p class="muted" style="margin:0 0 10px">Choisissez un mode comme sur l’appareil, ou laissez l’IA composer. Tout reste modifiable ensuite : la seconde photo est un calque.</p>
    <button class="btn primary" id="dxAI" style="width:100%;margin-bottom:10px">Composer avec l’IA</button>
    <div class="dx-modes" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">${modes}</div>
    <p class="muted" id="dxHint" style="margin:0 0 8px;font-size:12px"></p>
    ${rangeRow('dxMix','Intensité',0,100,1,100,' %')}${rangeRow('dxZoom','Échelle',50,300,1,100,' %')}${rangeRow('dxX','Position horizontale',-50,50,1,0,' %')}${rangeRow('dxY','Position verticale',-50,50,1,0,' %')}
    <div id="dxBgRow">${rangeRow('dxBg','Fond clair',0,100,1,90,' %')}</div>
    <div style="display:flex;gap:14px;margin-top:8px"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="dxBW"> Seconde photo en noir et blanc</label><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="dxFlip"> Miroir</label></div>`,
    onOpen:el=>{
      el.classList.add('dx-dlg');const q=s=>el.querySelector(s);
      const sync=()=>{el.querySelectorAll('.dx-m').forEach(b=>b.classList.toggle('primary',b.dataset.m===st.mode));q('#dxHint').textContent=(DX_MODES.find(x=>x[0]===st.mode)||[])[2]||'';q('#dxBgRow').style.display=st.mode==='silhouette'?'':'none'};
      const setMode=async m=>{if(m==='silhouette'){const s=await ensureSubject(st);if(!s){toast('Aucun sujet net trouvé : le mode Écran est gardé',4500);m='screen'}}st.mode=m;drawB(st);applyMode(st);sync()};
      el.querySelectorAll('.dx-m').forEach(b=>b.onclick=()=>setMode(b.dataset.m));
      const bind=(id,k,fn)=>{const r=q('#'+id),o=q('#'+id+'-o');r.addEventListener('input',()=>{st[k]=+r.value;o.textContent=r.value+' %';fn()})};
      bind('dxMix','mix',()=>applyMode(st));bind('dxZoom','zoom',()=>{st.zoom=+q('#dxZoom').value/100;drawB(st);markComp()});
      bind('dxX','ox',()=>{drawB(st);markComp()});bind('dxY','oy',()=>{drawB(st);markComp()});bind('dxBg','bg',()=>applyMode(st));
      q('#dxBW').onchange=e=>{st.bw=e.target.checked;drawB(st);markComp()};q('#dxFlip').onchange=e=>{st.flip=e.target.checked;drawB(st);markComp()};
      q('#dxAI').onclick=async()=>{const s=await ensureSubject(st);
        if(s){st.mode='silhouette';st.zoom=1.08;st.ox=0;st.oy=-3;st.mix=100;st.bg=90}else{st.mode='screen';st.zoom=1;st.ox=0;st.oy=0;st.mix=100}
        for(const [id,v] of [['dxMix',st.mix],['dxZoom',Math.round(st.zoom*100)],['dxX',st.ox],['dxY',st.oy],['dxBg',st.bg]]){q('#'+id).value=v;q('#'+id+'-o').textContent=v+' %'}
        drawB(st);applyMode(st);sync();toast(s?'Silhouette composée : réglez l’échelle et la position si besoin':'Pas de sujet net : fondu en mode Écran',4000)};
      sync()},
    buttons:[{label:'Annuler',onClick:()=>{cleanup()}},{label:'Appliquer',primary:true,onClick:()=>{if(S.doc!==d||S.history[S.hi]!==h0){cleanup();return}
      done=true;if(st.Lf&&!st.Lf.visible){const i=d.layers.indexOf(st.Lf);if(i>=0)d.layers.splice(i,1)}d.active=d.layers.indexOf(st.Lb);markComp();pushHistory('Double exposition');syncAll();toast('Double exposition ajoutée en calque')}}]});}
// from the home screen or with no photo: two photos at once
async function dexpStart(){if(S.doc){dexpDialog();return}
  const fs=await pick2();if(!fs.length)return;let a=fs[0],b=fs[1];
  await openBlob(a);if(!S.doc)return;if(!b)b=await pick1();if(b)dexpDialog(b)}
DX.dialog=dexpDialog;DX.start=dexpStart;window.PrismDexp=DX;

// menus: Fichier > Photos multiples, Image, and the palette (which lists menu items)
const _mfDX=MENU2.file.items;
MENU2.file.items=()=>{const a=_mfDX();const g=a.find(x=>x&&x.label==='Photos multiples'&&typeof x.sub==='function');const it=MI('Double exposition…',{fn:dexpStart});
  if(g){const s0=g.sub;if(!g.__dx){g.__dx=1;g.sub=()=>{const b=s0();return b.some(x=>x&&x.label===it.label)?b:[it,...b]}}}
  else if(!a.some(x=>x&&x.label===it.label))a.push(SEP,it);
  return a};
const _miDX=MENU2.image.items;MENU2.image.items=()=>{const a=_miDX();if(!a.some(x=>x&&x.label==='Double exposition…'))a.push(SEP,MI('Double exposition…',{fn:dexpStart,dis:docDis()}));return a};
// home screen tile
{const box=document.getElementById('wTiles');if(box&&!box.querySelector('.dx-tile')){const b=document.createElement('button');b.className='w-tile dx-tile';b.type='button';
  b.innerHTML='<svg viewBox="0 0 24 24"><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/></svg><b>Double exposition</b><span>Deux photos en une, à la main ou par l’IA</span>';
  b.addEventListener('click',e=>{e.stopPropagation();dexpStart()});box.appendChild(b)}}
