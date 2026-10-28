/* ===== Filtre > Portrait et restauration… : l'atelier de Photo Studio (MIT), avec le masque de peau de l'IA de Prism.
   Peau (séparation de fréquences qui garde les pores), artefacts JPEG, poussières et rayures, colorisation par points,
   transfert de couleurs d'une photo de référence, flou de profondeur, style artistique. Les filtres cochés s'enchaînent
   dans un ordre fixe (réparations, puis portrait et couleur, puis effets). ===== */
const PSX=window.PSX;
const NAME='Portrait et restauration';
/* [clé, libellé, min, max, pas, défaut, unité] ; c: liste de [valeur, libellé] ; k: case à cocher */
const RF=[
 {id:'skin',label:'Lissage de la peau',help:'Unifie la peau en gardant les pores et le grain fin.',params:[
   {key:'area',label:'Peau',c:[['mask','Détectée par l’IA'],['auto','D’après sa couleur'],['selection','Sélection seulement'],['all','Toute l’image']],def:'mask'},
   ['smoothness','Lissage',0,100,1,50,' %'],['detail','Détails gardés',0,100,1,60,' %'],['tone','Teint uniforme',0,100,1,30,' %'],['tolerance','Plage de couleurs',0,100,1,50,' %']]},
 {id:'jpeg',label:'Artefacts JPEG',help:'Retire les carrés de 8 × 8 pixels, les halos autour des contours et les taches de couleur d’une image trop compressée.',params:[
   {key:'strength',label:'Force',c:[['auto','Automatique'],['low','Faible'],['medium','Moyenne'],['high','Forte']],def:'auto'}]},
 {id:'restore',label:'Restauration de photo',help:'Répare poussières et rayures, réduit le bruit, ravive les couleurs passées et efface la trame d’impression.',params:[
   ['scratches','Rayures',0,100,1,50,' %'],['dust','Poussières',0,100,1,50,' %'],['size','Taille des défauts',1,20,1,4,' px'],['denoise','Réduction du bruit',0,100,1,20,' %'],['fade','Couleurs et contraste',0,100,1,50,' %'],['halftone','Trame d’impression',0,100,1,0,' %']]},
 {id:'colorize',label:'Colorisation',help:'Cliquez sur la photo pour poser la couleur choisie : elle se diffuse dans les zones semblables et s’arrête aux contours.',params:[
   ['saturation','Saturation',0,200,1,100,' %'],['spread','Diffusion',0,100,1,60,' %'],['radius','Taille des points',1,100,1,6,' px']]},
 {id:'transfer',label:'Transfert de couleurs',help:'Reprend l’ambiance de couleur d’une autre photo, séparément dans les ombres, les tons moyens et les hautes lumières.',params:[
   ['strength','Intensité',0,100,1,80,' %'],{key:'preserve',label:'Garder la luminosité',k:1,def:true},['shadows','Ombres',0,100,1,100,' %'],['midtones','Tons moyens',0,100,1,100,' %'],['highlights','Hautes lumières',0,100,1,100,' %']]},
 {id:'depth',label:'Flou de profondeur',help:'Floute selon la distance estimée, comme un grand diaphragme.',params:[
   {key:'subject',label:'Garder le sujet proche',k:1,def:true},{key:'invert',label:'Inverser la profondeur',k:1,def:false},['focal','Distance de mise au point',0,100,1,20,' %'],['range','Profondeur de champ',0,100,1,20,' %'],['blur','Intensité du flou',0,100,1,40,' %'],
   {key:'shape',label:'Diaphragme',c:[['0','Rond'],['5','Pentagone'],['6','Hexagone'],['8','Octogone']],def:'6'},['brightness','Éclat du bokeh',0,100,1,20,' %'],['haze','Brume',0,100,1,0,' %'],['warmth','Chaleur',-100,100,1,0,''],['grain','Grain',0,100,1,0,' %']]},
 {id:'style',label:'Style artistique',help:'Transforme la photo en peinture, dessin ou impression.',params:[
   {key:'style',label:'Style',c:[['painterly','Peinture'],['ink','Dessin à l’encre'],['pencil','Crayon'],['watercolor','Aquarelle'],['print','Trame imprimée']],def:'painterly'},['strength','Intensité',0,100,1,100,' %'],['brush','Taille du pinceau',1,50,1,6,' px']]}];
const pk=q=>Array.isArray(q)?q[0]:q.key,pdef=q=>Array.isArray(q)?q[5]:q.def;
const defaults=()=>{const o={};RF.forEach(f=>{o[f.id]={enabled:false,params:{}};f.params.forEach(q=>o[f.id].params[pk(q)]=pdef(q))});return o};
let LAST=null;

function toParams(st){return{filters:RF.map(f=>{const e={id:f.id,enabled:!!st[f.id].enabled,params:{...st[f.id].params}};
  if(f.id==='colorize')e.hints=(st.hints||[]).map(h=>({...h}));if(f.id==='transfer'&&st.ref)e.reference=st.ref;return e})}}
const rowHTML=(fid,q,v)=>{const id=`rs-${fid}-${pk(q)}`;
  if(Array.isArray(q))return rangeRow(id,q[1],q[2],q[3],q[4],v,q[6]);
  if(q.k)return`<div class="row"><label for="${id}">${q.label}</label><input type="checkbox" id="${id}" ${v?'checked':''} style="justify-self:start"><output></output></div>`;
  return`<div class="row"><label for="${id}">${q.label}</label><select id="${id}">${q.c.map(([val,l])=>`<option value="${esc(val)}" ${val===v?'selected':''}>${esc(l)}</option>`).join('')}</select><output></output></div>`};

/* masque de peau de l'IA (Prism), gardé pour la photo en cours */
const SK={key:null,m:null};
async function aiSkin(d,L){const key=L.canvas;if(SK.key===key)return SK.m;let m=null;try{m=await AI.categoryMask('skin')}catch(e){console.warn(e)}SK.key=key;SK.m=m;return m}

function restoreDialog(){const d=S.doc;if(!d)return;const L=PSX.target();if(!L)return;
  const st=LAST?JSON.parse(JSON.stringify(LAST)):defaults();st.hints=st.hints||[];st.ref=st.ref||null;st.refName=st.refName||'';st.hintColor=st.hintColor||'#c8875a';st.newLayer=!!st.newLayer;
  const orig=L.canvas,small=PSX.small(orig,1200);let tmr=null,job=null,seq=0,closed=false,skinSmall=null;
  const stop=()=>{clearTimeout(tmr);seq++;if(job){job.cancel();job=null}};
  const clear=()=>{closed=true;stop();delete L.preview;view.removeEventListener('pointerdown',onPick,true);markComp()};
  const state=t=>{const e=$('#rs-state');if(e)e.textContent=t||''};
  const needSkin=()=>st.skin.enabled&&st.skin.params.area==='mask';
  async function skinFor(w,h){if(!needSkin())return undefined;const m=await aiSkin(d,L);if(!m){if(!closed){st.skin.params.area='auto';const s=$('#rs-skin-area');if(s)s.value='auto';toast('Pas de peau trouvée par l’IA : détection d’après la couleur',4000)}return undefined}
    return PSX.mask(m,w,h)}
  const refresh=()=>{stop();const my=seq;tmr=setTimeout(async()=>{if(closed||!PSX.alive(d,L))return;
    if(!RF.some(f=>st[f.id].enabled)){delete L.preview;markComp();state('Cochez au moins un filtre.');return}
    state('Calcul de l’aperçu…');
    try{if(needSkin()&&!skinSmall)skinSmall=await skinFor(small.c.width,small.c.height);if(my!==seq||closed)return;
      job=PSX.run('restore',{img:PSX.img(small.c),params:toParams(st),scale:small.k,skin:skinSmall&&{...skinSmall,data:skinSmall.data.slice()}});
      const r=await job.promise;if(my!==seq||closed)return;job=null;let c=PSX.up(PSX.canvas(r.image),orig.width,orig.height);if(d.sel)c=PSX.mixSel(orig,c,d.sel);L.preview=c;markComp();state(small.k<1?'Aperçu sur une copie réduite ; l’application se fait en pleine résolution.':'')}
    catch(e){if(PSX.cancelled(e))return;console.error(e);state('');toast('Aperçu impossible : '+(e.message||e),3000)}},200)};
  /* colorisation : un clic sur la photo pose un point de la couleur choisie */
  function onPick(e){if(closed||!st.colorize.enabled||e.button!==0||S.spaceDown)return;const p=evPos(e);if(p.x<0||p.y<0||p.x>d.w||p.y>d.h)return;
    e.preventDefault();e.stopPropagation();st.hints.push({x:p.x/d.w,y:p.y/d.h,color:st.hintColor,radius:st.colorize.params.radius});hintCount();refresh()}
  const hintCount=()=>{const e=$('#rs-hints');if(e)e.textContent=st.hints.length?st.hints.length+' point'+(st.hints.length>1?'s':'')+' de couleur':'Aucun point : cliquez sur la photo'};
  const extra={colorize:()=>`<div class="row"><label for="rs-hc">Couleur à poser</label><input type="color" id="rs-hc" value="${esc(st.hintColor)}"><output></output></div><div class="row"><span class="muted" id="rs-hints"></span><button class="btn sm" id="rs-hclear" type="button">Effacer les points</button><output></output></div>`,
    transfer:()=>`<div class="row"><span class="muted" id="rs-refn">${st.refName?esc('Référence : '+st.refName):'Aucune photo de référence'}</span><button class="btn sm" id="rs-ref" type="button">Choisir…</button><output></output></div>`};
  const body=`<p class="muted" style="margin:0 0 8px">Cochez les retouches voulues ; l’aperçu se met à jour sur la photo.</p>`+RF.map((f,i)=>`<details class="rs-f" ${i===RF.findIndex(g=>st[g.id].enabled)?'open':''}><summary><label><input type="checkbox" id="rs-on-${f.id}" ${st[f.id].enabled?'checked':''}> <b>${f.label}</b></label></summary><p class="muted" style="margin:4px 0">${f.help}</p>${f.params.map(q=>rowHTML(f.id,q,st[f.id].params[pk(q)])).join('')}${extra[f.id]?extra[f.id]():''}</details>`).join('')+
    `<div class="row"><label for="rs-new">Sur un nouveau calque</label><input type="checkbox" id="rs-new" ${st.newLayer?'checked':''} style="justify-self:start"><output></output></div>`+(d.sel?'<p class="muted">Appliqué uniquement à la sélection.</p>':'')+'<p class="muted" id="rs-state" aria-live="polite" style="min-height:1.2em;margin:6px 0 0"></p>';
  dialog({title:NAME,light:true,body,
    onOpen:el=>{const dl=el.closest('.dlg');if(dl){dl.style.maxHeight='calc(100dvh - 120px)';dl.style.overflow='auto'}
      /* une seule retouche dépliée à la fois : la fenêtre reste petite et la photo visible */
      $$('details.rs-f',el).forEach(dt=>dt.addEventListener('toggle',()=>{if(dt.open)$$('details.rs-f',el).forEach(o=>{if(o!==dt)o.open=false})}));
      RF.forEach(f=>{const on=$('#rs-on-'+f.id,el);on.onchange=()=>{st[f.id].enabled=on.checked;if(on.checked)on.closest('details').open=true;refresh()};on.onclick=e=>e.stopPropagation();
        f.params.forEach(q=>{const k=pk(q),i=$(`#rs-${f.id}-${k}`,el);if(!i)return;const sel=i.tagName==='SELECT',chk=i.type==='checkbox';
          i[sel||chk?'onchange':'oninput']=()=>{st[f.id].params[k]=chk?i.checked:sel?i.value:+i.value;if(!sel&&!chk){const o=$(`#rs-${f.id}-${k}-o`,el);if(o)o.textContent=fmtN(+i.value,q[4])+(q[6]||'')}
            if(f.id==='skin'&&k==='area')skinSmall=null;if(!st[f.id].enabled){st[f.id].enabled=true;$('#rs-on-'+f.id,el).checked=true}refresh()}})});
      $('#rs-hc',el).oninput=e=>{st.hintColor=e.target.value};$('#rs-hclear',el).onclick=()=>{st.hints=[];hintCount();refresh()};hintCount();
      $('#rs-ref',el).onclick=()=>{const inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.onchange=async()=>{const f=inp.files&&inp.files[0];if(!f)return;
        try{const bm=await createImageBitmap(f),k=Math.min(1,512/Math.max(bm.width,bm.height)),c=mk(Math.max(1,bm.width*k),Math.max(1,bm.height*k));cx(c).drawImage(bm,0,0,c.width,c.height);
          st.ref=await PSX.run('transferStats',{img:PSX.img(c)}).promise;st.refName=f.name;$('#rs-refn',el).textContent='Référence : '+f.name;st.transfer.enabled=true;$('#rs-on-transfer',el).checked=true;refresh()}
        catch(e){console.error(e);toast('Photo de référence illisible : '+(e.message||e),4000)}};inp.click()};
      $('#rs-new',el).onchange=e=>{st.newLayer=e.target.checked};
      view.addEventListener('pointerdown',onPick,true);refresh()},
    buttons:[{label:'Annuler',onClick:()=>clear()},
      {label:'Appliquer',primary:true,onClick:()=>{clear();LAST=JSON.parse(JSON.stringify(st));apply(d,L,orig,st)}}]})}

async function apply(d,L,orig,st){if(!RF.some(f=>st[f.id].enabled)){toast('Aucune retouche cochée');return}
  busy(true,NAME+'…',0);let j=null;
  try{let skin;if(st.skin.enabled&&st.skin.params.area==='mask'){const m=await aiSkin(d,L);if(m)skin=PSX.mask(m,orig.width,orig.height)}
    j=PSX.track(PSX.run('restore',{img:PSX.img(orig),params:toParams(st),scale:1,skin},{onProgress:f=>busy(true,NAME+'…',f)}));const r=await j.promise;
    if(!PSX.alive(d,L)||L.canvas!==orig){toast('Le calque a changé pendant le calcul : rien n’a été modifié');return}
    let c=PSX.canvas(r.image);
    if(st.newLayer){if(d.sel){const t=mk(c.width,c.height),g=cx(t);g.drawImage(c,0,0);g.globalCompositeOperation='destination-in';g.drawImage(d.sel,0,0);c=t}
      const i=d.layers.indexOf(L);d.active=i;insertLayer(newPixel(NAME,c),NAME)}
    else applyMasked(L,c,NAME)}
  catch(e){if(!PSX.cancelled(e)){console.error(e);toast(NAME+' impossible : '+(e.message||e),4000)}markComp()}
  finally{PSX.untrack(j);busy(false)}}
PSX.restoreDialog=restoreDialog;PSX.restoreApply=apply;PSX.restoreDefaults=defaults;
PSX.addToMenu('filter',null,()=>[MI(NAME+'…',{icon:'filter',dis:S.doc?false:NODOC,fn:restoreDialog})],/^Correction de l’objectif/);
