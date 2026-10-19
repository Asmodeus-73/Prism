/* ================= v9: crop grids & remembered formats, quick mask, hair cut-out ================= */
const CROP_GRIDS=[['thirds','Tiers'],['grid','Grille'],['golden','Nombre d’or'],['spiral','Spirale d’or'],['diag','Diagonales'],['tri','Triangles'],['none','Aucune']];
function cropGridSel(){const g=PREF.get('cropGrid','thirds');S.opts.crop.grid=g;return`<label>Grille<select data-sel="crop.grid">${CROP_GRIDS.map(([v,l])=>`<option value="${v}" ${g===v?'selected':''}>${l}</option>`).join('')}</select></label>`}
function cropGrid(c,a,b,w,h){const g=PREF.get('cropGrid','thirds');if(g==='none')return;c.save();c.strokeStyle='rgba(255,255,255,.4)';c.lineWidth=1;c.beginPath();
  const V=f=>{c.moveTo(a+w*f,b);c.lineTo(a+w*f,b+h)},H=f=>{c.moveTo(a,b+h*f);c.lineTo(a+w,b+h*f)};
  if(g==='thirds'){V(1/3);V(2/3);H(1/3);H(2/3)}
  else if(g==='grid'){for(let k=1;k<6;k++){V(k/6);H(k/6)}}
  else if(g==='golden'){V(.382);V(.618);H(.382);H(.618)}
  else if(g==='diag'){c.moveTo(a,b);c.lineTo(a+w,b+h);c.moveTo(a+w,b);c.lineTo(a,b+h)}
  else if(g==='tri'){c.moveTo(a,b+h);c.lineTo(a+w,b);const k=h*h+w*w,t=(w*w)/k,px=a+t*w,py=b+h-t*h; /* foot of the perpendicular from the two other corners */
    const f1=((a-a)*w+(b-(b+h))*(-h))/k; c.moveTo(a,b);const u=((0)*w+(-h)*(-h))/k;c.lineTo(a+u*w,b+h-u*h);c.moveTo(a+w,b+h);const v=((w)*w+(0)*(-h))/k;c.lineTo(a+v*w,b+h-v*h)}
  else if(g==='spiral'){c.stroke();c.beginPath();c.strokeStyle='rgba(255,255,255,.75)';c.lineWidth=1.3;c.save();let W=w,Hh=h,port=h>w;if(port){c.transform(0,1,1,0,a,b);W=h;Hh=w}else c.translate(a,b);c.scale(W/1.618,Hh);
    let x=0,y=0,rw=1.618,rh=1;for(let i=0;i<10&&rw>.012&&rh>.012;i++){const o=i%4,PI=Math.PI;
      if(o===0){const s=rh;c.arc(x+s,y+rh,s,PI,PI*1.5);x+=s;rw-=s}
      else if(o===1){const s=rw;c.arc(x,y+s,s,PI*1.5,PI*2);y+=s;rh-=s}
      else if(o===2){const s=rh;c.arc(x+rw-s,y,s,0,PI*.5);rw-=s}
      else{const s=rw;c.arc(x+rw,y+rh-s,s,PI*.5,PI);rh-=s}}
    c.restore();c.stroke();c.restore();return}
  c.stroke();c.restore()}
const CROP_STD=[['free','Libre'],['orig','Original'],['1:1','1:1'],['4:5','4:5'],['3:2','3:2'],['2:3','2:3'],['4:3','4:3'],['16:9','16:9'],['9:16','9:16']];
function cropRatios(){const std=CROP_STD.map(x=>x[0]),mine=PREF.get('cropCustom',[]).filter(r=>!std.includes(r));return[...CROP_STD,...mine.map(r=>[r,r.replace(':',' : ')+' (à moi)']),['custom','Autre format…']]}
function cropRemember(v){PREF.set('cropRatio',v)}
function cropCustomDialog(){const sel=document.querySelector('[data-sel="crop.ratio"]');const back=()=>{if(sel)sel.value=S.opts.crop.ratio};
  dialog({title:'Format personnalisé',body:`<p class="muted">Indiquez le rapport largeur / hauteur voulu, par exemple 5 et 7 pour un tirage 13 × 18. Le format est mémorisé pour la prochaine fois.</p><div class="row"><label for="ccW">Largeur</label><input id="ccW" type="number" min="1" max="100" step="any" value="5" inputmode="decimal"></div><div class="row"><label for="ccH">Hauteur</label><input id="ccH" type="number" min="1" max="100" step="any" value="7" inputmode="decimal"></div>`,
    onOpen:el=>{const s=$('#scrim');const oc=s._cancel;s._cancel=()=>{back();oc&&oc()};setTimeout(()=>$('#ccW',el)&&$('#ccW',el).select(),30)},
    buttons:[{label:'Annuler',onClick:back},{label:'Utiliser',primary:true,onClick:()=>{const w=+$('#ccW').value,h=+$('#ccH').value;if(!(w>0&&h>0)||w/h>50||h/w>50){toast('Entrez deux nombres positifs, par exemple 5 et 7');back();return}
      const r=`${+w.toFixed(3)}:${+h.toFixed(3)}`,l=PREF.get('cropCustom',[]).filter(x=>x!==r);l.unshift(r);PREF.set('cropCustom',l.slice(0,6));S.opts.crop.ratio=r;cropRemember(r);applyRatio();renderPill()}}]})}
S.opts.crop.ratio=PREF.get('cropRatio','free');if(!cropRatios().some(x=>x[0]===S.opts.crop.ratio))S.opts.crop.ratio='free';
function cropSwapRatio(){const r=S.opts.crop.ratio;if(!/^[\d.]+:[\d.]+$/.test(r))return;const[a,b]=r.split(':');S.opts.crop.ratio=b+':'+a;cropRemember(S.opts.crop.ratio);applyRatio()}

/* ---------- quick mask (Q) ---------- */
function inQuickMask(){return!!(S.doc&&S.doc.layers.some(l=>l.qmask))}
function quickMask(){const d=S.doc;if(!d)return;const q=d.layers.findIndex(l=>l.qmask);
  if(q<0){const mask=d.sel?cloneC(d.sel):mk(d.w,d.h),L=newAdjust('Masque rapide',mask);L.qmask=true;d.layers.push(L);d.active=d.layers.length-1;S.showMask=true;setTool('brush');markComp();syncAll();toast('Masque rapide : peignez en blanc pour ajouter à la sélection, avec la gomme pour retirer. Q pour valider.',6000);return}
  const L=d.layers[q];d.sel=maskBBox(L.mask)?cloneC(L.mask):null;d.layers.splice(q,1);d.active=Math.min(d.active,d.layers.length-1);if(d.layers[d.active]&&d.layers[d.active].kind!=='pixel'){const p=d.layers.findLastIndex(l=>l.kind==='pixel');if(p>=0)d.active=p}
  S.showMask=false;selChanged();markComp();pushHistory(d.sel?'Masque rapide : sélection':'Masque rapide : désélection');syncAll();toast(d.sel?'Sélection mise à jour':'Rien n’est sélectionné')}
document.addEventListener('keydown',e=>{if(e.key!=='q'&&e.key!=='Q')return;if(e.metaKey||e.ctrlKey||e.altKey)return;const tg=e.target;if($('#library')||$('#scrim')||(tg.closest&&tg.closest('input,textarea,select,[contenteditable]')))return;if(!S.doc||S.stroke)return;e.preventDefault();quickMask()});
/* a quick mask layer must never survive saving or exporting */
/* the quick mask layer is left out of saved manifests (fx_files) */

/* ---------- subject cut-out, hair-aware ---------- */
AI.selectSubjectHair=async()=>{const d=S.doc;if(!d)return;const m=await AI.subjectMask();if(!m||S.doc!==d)return;busy(true,'Détourage fin du sujet…',0);
  try{await tick();const ps=Math.min(1,1600/Math.max(d.w,d.h)),r=await refineMask(m,{radius:clamp(Math.round(Math.max(d.w,d.h)/220),4,48),eps:0.0006,contrast:30,shift:0},ps,p=>busy(true,'Détourage fin du sujet…',p));
    if(S.doc!==d)return;combineSel(r,'new','Détourer le sujet');toast('Sujet détouré. Q pour retoucher le bord au pinceau.',5000)}
  catch(e){console.error(e);toast('Détourage impossible : '+(e.message||e)+'. Essayez « Sélectionner le sujet » puis « Affiner le contour ».',6000)}finally{busy(false)}};
(()=>{const mi=MENU2.select.items;MENU2.select.items=()=>{const a=mi();const i=a.findIndex(x=>x&&x.label&&/Sélectionner le sujet/.test(x.label));
  const add=[MI('Détourer le sujet (cheveux)',{icon:'subject',fn:()=>AI.selectSubjectHair(),dis:docDis()}),MI(inQuickMask()?'Quitter le masque rapide':'Masque rapide',{kbd:'Q',check:inQuickMask(),fn:quickMask,dis:docDis()})];a.splice(i<0?a.length:i+1,0,...add);return a}})();

