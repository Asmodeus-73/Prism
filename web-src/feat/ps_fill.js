/* ===== Remplissage d'après le contenu (PatchMatch multi-échelle + adaptation des couleurs par équation de Poisson, Photo Studio, MIT).
   - remplace l'ancien remplissage par patchs de la gomme magique quand le modèle LaMa n'est pas là ;
   - gomme magique : méthode « Rapide » sans IA au choix quand LaMa est disponible ;
   - Édition > Remplir d'après le contenu… pour la sélection. ===== */
const PSX=window.PSX;

/* l'ancien point d'entrée (0110) : rgb flottant n*3 + trou 0/1 -> rgb flottant */
{const _ri=runInpaint;
 runInpaint=function(w,h,rgb,hole,onProg){const n=w*h,data=new Uint8ClampedArray(n*4),m=new Uint8Array(n);
   for(let i=0;i<n;i++){data[i*4]=rgb[i*3];data[i*4+1]=rgb[i*3+1];data[i*4+2]=rgb[i*3+2];data[i*4+3]=255;m[i]=hole[i]?255:0}
   const keep=[rgb.slice(),hole.slice()];
   return PSX.run('contextFill',{img:{width:w,height:h,data},hole:{width:w,height:h,data:m},o:{colorAdaptation:'default'}},{onProgress:onProg}).promise
     .then(r=>{const o=new Float32Array(n*3),d=r.data;for(let i=0;i<n;i++){o[i*3]=d[i*4];o[i*3+1]=d[i*4+1];o[i*3+2]=d[i*4+2]}return o})
     .catch(e=>{console.warn('remplissage contextuel : repli sur l’ancienne méthode',e);return _ri.call(this,w,h,keep[0],keep[1],onProg)})}}

/* gomme magique : IA (LaMa) ou rapide (sans modèle) */
S.opts.remove.method=PREF.get('removeMethod','ai')==='fast'?'fast':'ai';
{const _pe=PILL_EXTRA;PILL_EXTRA=function(t,o){let h=_pe.apply(this,arguments)||'';
  if(t==='remove')h+=`<label title="IA : meilleur sur les grandes zones. Rapide : sans modèle, instantané sur les petites zones.">Méthode</label>`+seg('remove.method',[['ai','IA'],['fast','Rapide']]);return h}}
document.addEventListener('click',e=>{const b=e.target&&e.target.closest&&e.target.closest('[data-seg="remove.method"]');if(b)PREF.set('removeMethod',b.dataset.v)},true);
{const _ro=removeObject;
 removeObject=async function(){if(S.opts.remove.method!=='fast')return _ro.apply(this,arguments);
   const was=window.LAMA_DISABLE;window.LAMA_DISABLE=true;try{return await _ro.apply(this,arguments)}finally{window.LAMA_DISABLE=was}}}

/* Édition > Remplir d'après le contenu… */
const CF_COL=['none','default','high'],CF_ROT=['none','low','medium','high','full'];
function contentFillDialog(){const d=S.doc;if(!d)return;if(!d.sel){toast('Sélectionnez d’abord la zone à remplir');return}
  const L=PSX.target();if(!L)return;const b=maskBBox(d.sel);if(!b){toast('La sélection est vide');return}
  const p={col:1,rot:0,scale:1,mirror:0,...(contentFillDialog.last||{})};
  const sel=(k,l,opts)=>`<div class="row"><label for="cf-${k}">${l}</label><select id="cf-${k}">${opts.map((t,i)=>`<option value="${i}" ${p[k]===i?'selected':''}>${t}</option>`).join('')}</select><output></output></div>`;
  const chk=(k,l)=>`<div class="row"><label for="cf-${k}">${l}</label><input type="checkbox" id="cf-${k}" ${p[k]?'checked':''} style="justify-self:start"><output></output></div>`;
  dialog({title:'Remplir d’après le contenu',light:true,
    body:'<p class="muted" style="margin:0 0 8px">La sélection est remplacée par de la matière prise ailleurs dans la photo, sans IA. Pour un grand objet, la gomme magique (IA) fait souvent mieux.</p>'+
      sel('col','Adaptation des couleurs',['Aucune','Normale','Forte'])+sel('rot','Adaptation de l’angle',['Aucune','Faible','Moyenne','Forte','Complète'])+chk('scale','Essayer d’autres tailles')+chk('mirror','Essayer en miroir'),
    buttons:[{label:'Annuler'},{label:'Remplir',primary:true,onClick:el=>{p.col=+$('#cf-col',el).value;p.rot=+$('#cf-rot',el).value;p.scale=$('#cf-scale',el).checked?1:0;p.mirror=$('#cf-mirror',el).checked?1:0;contentFillDialog.last={...p};contentFill(d,L,b,p)}}]})}
async function contentFill(d,L,b,p){const W=d.w,H=d.h,hw=b.x1-b.x0,hh=b.y1-b.y0,m=Math.max(80,Math.round(Math.max(hw,hh)*1.2));
  const x0=Math.max(0,b.x0-m),y0=Math.max(0,b.y0-m),x1=Math.min(W,b.x1+m),y1=Math.min(H,b.y1+m),w=x1-x0,h=y1-y0;
  const orig=L.canvas,img=PSX.img(orig,x0,y0,w,h),hole=PSX.mask(d.sel,w,h,x0,y0);
  busy(true,'Remplissage d’après le contenu…',0);
  try{const r=await PSX.run('contextFill',{img,hole,o:{colorAdaptation:CF_COL[p.col],rotationAdaptation:CF_ROT[p.rot],scale:!!p.scale,mirror:!!p.mirror}},{onProgress:f=>busy(true,'Remplissage d’après le contenu…',f)}).promise;
    if(!PSX.alive(d,L)||L.canvas!==orig){toast('Le calque a changé pendant le calcul : rien n’a été modifié');return}
    const out=cloneC(orig);cx(out).drawImage(PSX.canvas(r),x0,y0);applyMasked(L,out,'Remplir d’après le contenu')}
  catch(e){if(!PSX.cancelled(e)){console.error(e);toast('Remplissage impossible : '+(e.message||e),4000)}}
  finally{busy(false)}}
PSX.contentFill=contentFill;
PSX.addToMenu('edit',null,()=>[MI('Remplir d’après le contenu…',{icon:'fill',dis:!S.doc?NODOC:!S.doc.sel?'Faites d’abord une sélection':false,fn:contentFillDialog})],/^Effacer le contenu/);
