/* ================= PSD (Photoshop) ================= */
async function ensurePSD(){if(!window.agPsd)await loadScript(asset('psd/ag-psd.min.js'));return window.agPsd}
const PSD_BLEND={'normal':'source-over','multiply':'multiply','screen':'screen','overlay':'overlay','darken':'darken','lighten':'lighten','color dodge':'color-dodge','linear dodge':'lighter','color burn':'color-burn','hard light':'hard-light','soft light':'soft-light','difference':'difference','exclusion':'exclusion','hue':'hue','saturation':'saturation','color':'color','luminosity':'luminosity'};
const BLEND_PSD=Object.fromEntries(Object.entries(PSD_BLEND).map(([a,b])=>[b,a]));
function grayToAlpha(src,w,h,left,top,def){const m=mk(w,h),g=rx(m);if(def){g.fillStyle='#fff';g.fillRect(0,0,w,h)}if(src){const t=mk(src.width,src.height),tg=rx(t);tg.drawImage(src,0,0);const id=tg.getImageData(0,0,t.width,t.height),p=id.data;for(let i=0;i<p.length;i+=4){p[i+3]=p[i];p[i]=p[i+1]=p[i+2]=255}tg.putImageData(id,0,0);g.clearRect(left,top,t.width,t.height);g.drawImage(t,left,top)}return m}
async function importPSD(file,name){busy(true,'Lecture du fichier Photoshop…',null);try{setCS('srgb');const ag=await ensurePSD();const buf=await file.arrayBuffer();const psd=ag.readPsd(buf,{skipThumbnail:true,useImageData:false});
    const W=psd.width,H=psd.height;if(W*H>MAX_PX)throw new Error(`image trop grande (${W} × ${H})`);const layers=[];let skipped=0;
    const walk=(arr,hidden,op)=>{for(const l of arr||[]){const hid=hidden||l.hidden,o=op*(l.opacity??1);if(l.children){walk(l.children,hid,o);continue}
      if(l.adjustment){skipped++;continue}if(!l.canvas){continue}const c=mk(W,H);cx(c).drawImage(l.canvas,l.left||0,l.top||0);
      const L=newPixel(l.name||'Calque',c);L.visible=!hid;L.opacity=clamp(o,0,1);L.blend=PSD_BLEND[l.blendMode]||'source-over';
      if(l.mask&&!l.mask.disabled&&(l.mask.canvas||l.mask.defaultColor)){L.mask=grayToAlpha(l.mask.canvas,W,H,l.mask.left||0,l.mask.top||0,(l.mask.defaultColor||0)>127)}layers.push(L)}};
    walk(psd.children,false,1);if(!layers.length&&psd.canvas){layers.push(newPixel('Arrière-plan',(()=>{const c=mk(W,H);cx(c).drawImage(psd.canvas,0,0);return c})()))}
    if(!layers.length)throw new Error('aucun calque lisible');layers.push(newAdjust('Réglages'));
    S.doc={w:W,h:H,name:(name||file.name||'photoshop.psd'),layers,active:layers.length-1,sel:null,pid:uid8(),sync:Cloud.ok&&PREF.get('autoSync',true),saved:false};
    S.sample=false;S.meta='PSD · '+(layers.length-1)+' calque'+(layers.length>2?'s':'');S.history=[];S.hi=-1;S.crop=null;S.cloneSrc=null;S.cloneOff=null;S.maxHist=clamp(Math.floor(HIST_BUDGET/(W*H*4)),3,40);AI.subjectCache=null;
    pushHistory('Ouverture du PSD');selChanged();markComp();fit(true);syncAll();$('#empty').hidden=true;updateDocName();busy(false);
    toast(`PSD ouvert : ${layers.length-1} calque${layers.length>2?'s':''}${skipped?` (${skipped} calque${skipped>1?'s':''} de réglage Photoshop ignoré${skipped>1?'s':''})`:''}`,5000);scheduleSave(500)}
  catch(e){busy(false);console.error(e);toast('Ce PSD n’a pas pu être lu : '+(e.message||e),6000)}}
async function exportPSD(){const d=S.doc;if(!d)return;busy(true,'Création du fichier Photoshop…',0);try{const ag=await ensurePSD();const children=[];
    for(const L of d.layers){if(L.kind!=='pixel')continue;const e={name:L.name,canvas:srgbC(L.canvas),left:0,top:0,opacity:L.opacity,hidden:L.visible===false,blendMode:BLEND_PSD[L.blend]||'normal'};
      if(L.mask){const m=mk(d.w,d.h),g=rx(m);g.drawImage(L.mask,0,0);const id=g.getImageData(0,0,d.w,d.h),p=id.data;for(let i=0;i<p.length;i+=4){p[i]=p[i+1]=p[i+2]=p[i+3];p[i+3]=255}g.putImageData(id,0,0);e.mask={canvas:m,left:0,top:0,defaultColor:0}}children.push(e)}
    const full=await renderDoc(1,{progress:p=>busy(true,'Création du fichier Photoshop…',p*0.5)});const hasAdj=d.layers.some(L=>L.kind==='adjust'&&L.visible!==false&&(!devIsId(L.dev)));
    if(hasAdj)children.push({name:'Rendu Prism (réglages appliqués)',canvas:srgbC(full),left:0,top:0});
    busy(true,'Compression…',0.7);await tick();const buf=ag.writePsd({width:d.w,height:d.h,children,canvas:srgbC(full)},{generateThumbnail:false,compress:true});
    const base=(d.name||'photo').replace(/\.[a-z0-9]+$/i,'').replace(/[\\/:*?"<>|]+/g,'-');const z=await makeZip([{name:base+'.psd',data:new Uint8Array(buf)}]);busy(false);await saveFile(z,base+'-psd.zip')}
  catch(e){busy(false);console.error(e);toast('Export PSD impossible : '+(e.message||e),5000)}}

