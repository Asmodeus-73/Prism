/* ================= Courbe des tonalités : outils =================
   - « Sur la photo » : cliquer-glisser verticalement sur la photo monte ou descend le ton qui est sous le pointeur, dans l'onglet ouvert
     (RVB, Luma, R, V, B : un point de la courbe ; Zones : la zone de ce ton). Au survol, un trait sur la courbe montre où tombe ce ton.
   - Pipettes noir, gris, blanc (onglets RVB, R, V, B) : comme dans Photoshop, elles règlent les courbes Rouge, Vert et Bleu
     pour que la zone cliquée devienne noire, grise neutre ou blanche.
   - Préréglages : courbes toutes faites pour l'onglet ouvert, plus les courbes enregistrées (toutes les courbes d'un coup, dans PREF 'curvePresets').
   - Remettre à zéro l'onglet ouvert seulement ; saisie chiffrée du point sélectionné (entrée, sortie de 0 à 255).
   - Écrêtage : pendant qu'on déplace un point (Alt enfoncé, ou toujours avec l'option), les zones qui deviennent blanc pur sont en rouge,
     noir pur en bleu, sur la photo.
   La valeur lue sous le pointeur est celle qui entre dans la courbe : les calques du dessous, puis les curseurs de base de ce réglage
   (getLUTs().pre) ; les effets de voisinage (clarté, texture) sont laissés de côté. ===== */
(()=>{
const pane=$('#pane-develop');if(!pane)return;
const LW=[0.2126,0.7152,0.0722],dot=c=>LW[0]*c[0]+LW[1]*c[1]+LW[2]*c[2],ID=[[0,0],[1,1]];
const BUILTIN=[['Linéaire',[[0,0],[1,1]]],['Contraste léger',[[0,0],[0.25,0.22],[0.75,0.78],[1,1]]],['Contraste moyen',[[0,0],[0.25,0.19],[0.75,0.81],[1,1]]],
  ['Contraste fort',[[0,0],[0.25,0.14],[0.5,0.5],[0.75,0.86],[1,1]]],['Noirs mats',[[0,0.1],[0.3,0.3],[1,0.97]]],['Éclaircir les tons moyens',[[0,0],[0.5,0.6],[1,1]]],
  ['Assombrir les tons moyens',[[0,0],[0.5,0.4],[1,1]]],['Négatif',[[0,1],[1,0]]]];
const userPresets=()=>{const a=PREF.get('curvePresets',[]);return Array.isArray(a)?a:[]};
const clone=v=>JSON.parse(JSON.stringify(v));
const dev=()=>ADJ()&&ADJ().dev;
const ptsOf=d=>curveCh==='l'?d.lcurve:d.curve[curveCh];
function curveDone(label){drawCurve();markContent();markSecs();pushHistory(label||'Courbe des tonalités');scheduleThumbs()}

/* ---- la barre d'outils au-dessus de la courbe, et la saisie chiffrée en dessous ---- */
window.curveToolsUI=()=>{const t=$('#cvTools'),n=$('#cvNum');if(!t)return;const pk=curveCh!=='p'&&curveCh!=='l',P=S.curvePick;
  const opts=(curveCh==='p'?[]:BUILTIN.map((b,i)=>`<option value="b${i}">${esc(b[0])}</option>`)).join('');const us=userPresets().map((u,i)=>`<option value="u${i}">${esc(u.name)}</option>`).join('');
  t.innerHTML=`<div class="cv-row cv-two"><button class="btn sm ${S.curveTAT?'on':''}" id="cvTAT" title="Cliquez sur la photo et glissez vers le haut ou le bas pour régler ce ton">Sur la photo</button><button class="btn sm ${PREF.get('curveClip',false)?'on':''}" id="cvClip" title="Montrer l’écrêtage sur la photo pendant qu’on déplace un point (Alt le montre aussi)">Écrêtage</button></div>`+
    (pk?`<div class="cv-row cv-pk" role="group" aria-label="Pipettes"><span class="cv-lbl">Pipettes</span><button class="btn sm ${P==='b'?'on':''}" data-pk="b" title="Pipette noir : la zone cliquée devient noire">Noir</button><button class="btn sm ${P==='g'?'on':''}" data-pk="g" title="Pipette gris : la zone cliquée devient grise neutre (retire une dominante)">Gris</button><button class="btn sm ${P==='w'?'on':''}" data-pk="w" title="Pipette blanc : la zone cliquée devient blanche">Blanc</button></div>`:'')+
    `<div class="cv-row"><select id="cvPreset" aria-label="Courbes toutes faites"><option value="">Courbes…</option>${opts}${us?`<optgroup label="Mes courbes">${us}</optgroup>`:''}</select><button class="btn sm" id="cvSave" title="Enregistrer toutes les courbes de ce réglage sous un nom">Enregistrer…</button><button class="btn sm cv-rs" id="cvReset" title="Remettre à zéro l’onglet ouvert seulement" aria-label="Remettre à zéro l’onglet ouvert">↺</button></div>`;
  if(n&&!n.firstChild)n.innerHTML=`<label>Entrée <input type="number" id="cvIn" min="0" max="255" step="1" inputmode="numeric"></label><label>Sortie <input type="number" id="cvOut" min="0" max="255" step="1" inputmode="numeric"></label>`;numUI()};
function numUI(){const i=$('#cvIn'),o=$('#cvOut');if(!i||!o)return;const sel=window.curveSel&&curveSel(),ok=!!(ADJ()&&sel&&curveCh!=='p'&&curvePts().indexOf(sel)>=0);
  i.disabled=o.disabled=!ok;if(!ok){i.value='';o.value='';i.placeholder=o.placeholder='—';return}
  if(document.activeElement!==i)i.value=Math.round(sel[0]*255);if(document.activeElement!==o)o.value=Math.round(sel[1]*255)}
const _dc=drawCurve;drawCurve=function(){const r=_dc.apply(this,arguments);try{numUI();drawHover()}catch(e){}return r};
const numSet=(el,live)=>{const sel=curveSel(),pts=curvePts(),i=pts.indexOf(sel);if(i<0)return;const v=parseFloat(String(el.value).replace(',','.'));if(!isFinite(v))return;
  if(el.id==='cvIn'){const lo=i>0?pts[i-1][0]+0.01:0,hi=i<pts.length-1?pts[i+1][0]-0.01:1;sel[0]=clamp(v/255,lo,hi)}else sel[1]=clamp(v/255,0,1);
  if(live){drawCurve();markContent();markSecs()}else{const b=el.dataset.before;el.dataset.before='';if(b!==JSON.stringify(sel))curveDone()}};
pane.addEventListener('focusin',e=>{if(e.target.id==='cvIn'||e.target.id==='cvOut'){const s=curveSel();e.target.dataset.before=s?JSON.stringify([s[0],s[1]]):''}});
pane.addEventListener('input',e=>{if((e.target.id==='cvIn'||e.target.id==='cvOut')&&ADJ())numSet(e.target,true)});
pane.addEventListener('change',e=>{const t=e.target;if((t.id==='cvIn'||t.id==='cvOut')&&ADJ()){const s=curveSel();if(!s)return;const b=t.dataset.before;t.dataset.before='';if(b!==JSON.stringify([s[0],s[1]]))curveDone();numUI();return}
  if(t.id==='cvPreset'){const v=t.value;t.value='';if(!v||!ADJ())return;const d=dev();
    if(v[0]==='b'){const[nm,p]=BUILTIN[+v.slice(1)];if(curveCh==='l')d.lcurve=clone(p);else d.curve[curveCh]=clone(p);window.curveSelSet&&curveSelSet(null);curveDone('Courbe : '+nm.toLowerCase());return}
    const u=userPresets()[+v.slice(1)];if(!u)return;Object.assign(d.curve,clone(u.curve||{}));d.lcurve=clone(u.lcurve||ID);d.pcurve=clone(u.pcurve||PC0);window.curveSelSet&&curveSelSet(null);syncDev();curveDone('Courbe : '+u.name)}});
pane.addEventListener('keydown',e=>{if((e.target.id==='cvIn'||e.target.id==='cvOut')){e.stopPropagation();if(e.key==='Enter'){e.preventDefault();e.target.blur()}}});
pane.addEventListener('click',e=>{const t=e.target.closest('button');if(!t||!t.closest('#cvTools'))return;e.preventDefault();
  if(t.id==='cvTAT'){if(!ADJ())return;S.curveTAT=!S.curveTAT;S.curvePick=null;if(S.curveTAT)toast('Cliquez sur la photo et glissez vers le haut ou le bas');armUI();return}
  if(t.dataset.pk){if(!ADJ())return;S.curvePick=S.curvePick===t.dataset.pk?null:t.dataset.pk;S.curveTAT=false;if(S.curvePick)toast({b:'Cliquez sur ce qui doit être noir',g:'Cliquez sur ce qui doit être gris neutre',w:'Cliquez sur ce qui doit être blanc'}[S.curvePick]);armUI();return}
  if(t.id==='cvClip'){PREF.set('curveClip',!PREF.get('curveClip',false));curveToolsUI();return}
  if(t.id==='cvReset'){const d=dev();if(!d)return;const before=JSON.stringify([d.curve,d.lcurve,d.pcurve]);if(curveCh==='p'){d.pcurve=PC0.slice();syncDev()}else if(curveCh==='l')d.lcurve=clone(ID);else d.curve[curveCh]=clone(ID);
    window.curveSelSet&&curveSelSet(null);if(JSON.stringify([d.curve,d.lcurve,d.pcurve])!==before)curveDone('Réinitialiser la courbe '+({rgb:'RVB',l:'Luma',r:'rouge',g:'verte',b:'bleue',p:'par zones'})[curveCh]);return}
  if(t.id==='cvSave')saveDialog()});
function saveDialog(){const d=dev();if(!d)return;const list=()=>userPresets().map((u,i)=>`<div class="cv-ul"><span>${esc(u.name)}</span><button class="btn sm" data-del="${i}">Supprimer</button></div>`).join('')||'<p class="muted" style="margin:0;font-size:12px">Aucune courbe enregistrée.</p>';
  dialog({title:'Enregistrer la courbe',light:true,body:`<p class="muted" style="margin:0 0 8px;font-size:12px">Garde les courbes RVB, Luma, Rouge, Vert, Bleu et par zones de ce réglage, pour les réappliquer d’un clic sur une autre photo.</p><input id="cvSN" placeholder="Nom de la courbe" aria-label="Nom de la courbe" value="Ma courbe ${userPresets().length+1}" style="width:100%"><div id="cvSL" style="margin-top:10px;display:grid;gap:6px">${list()}</div>`,
    buttons:[{label:'Annuler'},{label:'Enregistrer',primary:true,onClick:dl=>{const nm=($('#cvSN',dl).value||'').trim();if(!nm){toast('Donnez un nom à la courbe');return false}const a=userPresets().filter(u=>u.name!==nm);a.push({name:nm,curve:clone(d.curve),lcurve:clone(d.lcurve||ID),pcurve:clone(d.pcurve||PC0)});PREF.set('curvePresets',a);curveToolsUI();toast('Courbe « '+nm+' » enregistrée')}}],
    onOpen:dl=>{const i=$('#cvSN',dl);i.focus();i.select();i.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();$('.foot .primary',dl).click()}});
      $('#cvSL',dl).addEventListener('click',e=>{const b=e.target.closest('[data-del]');if(!b)return;const a=userPresets();a.splice(+b.dataset.del,1);PREF.set('curvePresets',a);$('#cvSL',dl).innerHTML=list();curveToolsUI()})}})}

/* ---- ce qui entre dans la courbe, sous un point de la photo ---- */
const BELOW={key:'',c:null};
function below(){const d=S.doc,lo=d.layers.slice(0,d.active),key=[S.docVer,d.active,d.w,d.h,lo.map(L=>(L.visible?1:0)+(L.kind==='adjust'?JSON.stringify(L.dev):'')+L.opacity+L.blend).join('|')].join('#');
  if(BELOW.key===key&&BELOW.data)return BELOW;const s=Math.min(1,1024/Math.max(d.w,d.h)),w=Math.max(1,Math.round(d.w*s)),h=Math.max(1,Math.round(d.h*s)),c=mk(w,h),g=cx(c);
  renderStack(g,w,h,[s,0,0,s,0,0],{scale:s,ox:0,oy:0,upto:d.active});Object.assign(BELOW,{key,s,w,h,data:g.getImageData(0,0,w,h).data});return BELOW}
function sampleAt(p){const A=ADJ();if(!A||!S.doc)return null;const B=below(),x=clamp(Math.floor(p.x*B.s),0,B.w-1),y=clamp(Math.floor(p.y*B.s),0,B.h-1);let r=0,g=0,b=0,m=0;
  for(let j=Math.max(0,y-1);j<=Math.min(B.h-1,y+1);j++)for(let i=Math.max(0,x-1);i<=Math.min(B.w-1,x+1);i++){const k=(j*B.w+i)*4;if(B.data[k+3]<10)continue;r+=B.data[k];g+=B.data[k+1];b+=B.data[k+2];m++}
  if(!m||p.x<0||p.y<0||p.x>S.doc.w||p.y>S.doc.h)return null;const dv=A.dev,LT=getLUTs(dv),x0=[r,g,b].map((v,c)=>lerpL(LT.pre[c],v/m/255)),pf=pcurveFn(dv.pcurve),x1=pf?x0.map(pf):x0.slice(),
  mf=isIdCurve(dv.curve.rgb)?null:curveFn(dv.curve.rgb),x2=mf?x1.map(mf):x1.slice(),x3=['r','g','b'].map((ch,c)=>isIdCurve(dv.curve[ch])?x2[c]:curveFn(dv.curve[ch])(x2[c]));
  return{x0,x1,x2,x3,tab:{p:dot(x0),rgb:dot(x1),l:dot(x3),r:x2[0],g:x2[1],b:x2[2]}}}

/* ---- trait de survol sur la courbe ---- */
let HOV=null,hovT=0;
function drawHover(){if(HOV==null||!(S.curveTAT||S.curvePick)||!ADJ())return;const c=$('#curve');if(!c)return;const g=cx(c),W=c.width,H=c.height,x=HOV*W,f=curveCh==='p'?(pcurveFn(dev().pcurve)||(v=>v)):curveFn(curvePts()),y=H-f(HOV)*H;
  g.save();g.strokeStyle=rootStyle().getPropertyValue('--accent')||'#6b8cff';g.lineWidth=2;g.setLineDash([6,6]);g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke();g.setLineDash([]);g.fillStyle=g.strokeStyle;g.beginPath();g.arc(x,y,7,0,7);g.fill();g.restore()}

/* ---- pipettes ---- */
function pickAt(p){const A=ADJ(),k=S.curvePick,s=sampleAt(p);if(!A||!s){toast('Choisissez un point de la photo');return}const d=A.dev,v=s.x2;
  if(k==='g'){const out=s.x3,t=dot(out);if(Math.max(...out)-Math.min(...out)<0.004){toast('Cette zone est déjà neutre');return}
    ['r','g','b'].forEach((ch,c)=>{const pts=d.curve[ch];const x=clamp(v[c],0.02,0.98);let i=pts.findIndex(q=>Math.abs(q[0]-x)<0.03&&q!==pts[0]&&q!==pts[pts.length-1]);
      if(i>=0)pts.splice(i,1);pts.push([x,clamp(t,0,1)]);pts.sort((a,b)=>a[0]-b[0]);for(let j=1;j<pts.length;j++)if(pts[j][0]-pts[j-1][0]<0.01&&j<pts.length-1)pts[j][0]=pts[j-1][0]+0.01})}
  else{if(k==='w'&&Math.min(...v)<0.2){toast('Zone trop sombre pour un blanc');return}if(k==='b'&&Math.max(...v)>0.8){toast('Zone trop claire pour un noir');return}
    ['r','g','b'].forEach((ch,c)=>{const pts=d.curve[ch];if(k==='b'){const hi=pts.length>2?pts[1][0]-0.01:0.95;pts[0]=[clamp(v[c],0,hi),0]}else{const n=pts.length-1,lo=n>1?pts[n-1][0]+0.01:0.05;pts[n]=[clamp(v[c],lo,1),1]}})}
  window.curveSelSet&&curveSelSet(null);curveDone({b:'Pipette noir',g:'Pipette gris',w:'Pipette blanc'}[k])}

/* ---- « sur la photo » : un point de la courbe (ou une zone) suit le glissé vertical ---- */
function tatStart(e,p){const A=ADJ(),s=sampleAt(p);if(!A||!s){toast('Choisissez un point de la photo');return}const d=A.dev,v=s.tab[curveCh];
  if(curveCh==='p'){if(!Array.isArray(d.pcurve))d.pcurve=PC0.slice();const B=pcBounds(d.pcurve);let k=0;while(k<3&&v>B[k+1])k++;window.PC_HOT=k;S.drag={type:'curvetat',zone:k,v0:d.pcurve[k],cy:p.cy,before:d.pcurve[k]};drawCurve();return}
  const pts=ptsOf(d),before=JSON.stringify(pts);let pt=null,bd=0.03;pts.forEach(q=>{const dx=Math.abs(q[0]-v);if(dx<bd){bd=dx;pt=q}});
  if(!pt){pt=[clamp(v,0.005,0.995),curveFn(pts)(v)];pts.push(pt);pts.sort((a,b)=>a[0]-b[0]);const i=pts.indexOf(pt);if((i>0&&pt[0]-pts[i-1][0]<0.01)||(i<pts.length-1&&pts[i+1][0]-pt[0]<0.01)){pts.splice(i,1);pt=pts.reduce((a,q)=>Math.abs(q[0]-v)<Math.abs(a[0]-v)?q:a)}}
  S.drag={type:'curvetat',pt,y0:pt[1],cy:p.cy,before};window.curveSelSet&&curveSelSet(pt);S.curveClip=!!(e.altKey||PREF.get('curveClip',false));markContent()}
function tatMove(e,p){const dr=S.drag,d=dev();if(!d)return;const dy=dr.cy-p.cy;
  if(dr.zone!=null){d.pcurve[dr.zone]=clamp(Math.round(dr.v0+dy*0.8),-100,100);const i=document.getElementById('d-pcurve.'+dr.zone);if(i)i.value=d.pcurve[dr.zone];outDev('pcurve.'+dr.zone)}
  else{const pts=ptsOf(d);if(pts.indexOf(dr.pt)<0)return;dr.pt[1]=clamp(dr.y0+dy/300,0,1)}
  S.curveClip=!!(e.altKey||PREF.get('curveClip',false));drawCurve();markContent();markSecs()}
function tatEnd(dr){const d=dev();S.curveClip=false;window.PC_HOT=null;if(!d){requestRender();return}
  if(dr.zone!=null){if(d.pcurve[dr.zone]!==dr.before)curveDone(labelFor('pcurve.'+dr.zone));else drawCurve()}
  else if(JSON.stringify(ptsOf(d))!==dr.before)curveDone();else drawCurve();requestRender()}

function armUI(){if(!ADJ()){S.curveTAT=false;S.curvePick=null}curveToolsUI();setCursor();requestRender();if(!S.curveTAT&&!S.curvePick){HOV=null;drawCurve()}}
const armed=()=>(S.curveTAT||S.curvePick)&&ADJ()&&!S.wbPick;
/* écouteurs du canevas en capture : passent avant les outils (zoom, pinceau…) dont les enveloppes de onDown seraient servies d'abord */
view.addEventListener('pointerdown',e=>{if(!S.doc||!armed()||e.button!==0||S.spaceDown)return;e.stopImmediatePropagation();e.preventDefault();try{view.setPointerCapture(e.pointerId)}catch(_){}const p=evPos(e);
  if(S.curvePick){pickAt(p);S.curvePick=null;armUI();return}tatStart(e,p);requestRender()},true);
view.addEventListener('pointermove',e=>{const dr=S.drag;if(dr&&dr.type==='curvetat'){e.stopImmediatePropagation();const p=evPos(e);S.pointer={cx:p.cx,cy:p.cy,dx:p.x,dy:p.y,inside:true};tatMove(e,p);requestRender();return}
  if(!dr&&S.doc&&armed()){const now=performance.now();if(now-hovT>40){hovT=now;try{const s=sampleAt(evPos(e));HOV=s?s.tab[curveCh]:null;drawCurve()}catch(_){}}}},true);
const tatUp=e=>{const dr=S.drag;if(dr&&dr.type==='curvetat'){e.stopImmediatePropagation();S.drag=null;tatEnd(dr)}};
view.addEventListener('pointerup',tatUp,true);view.addEventListener('pointercancel',tatUp,true);
const _sc=setCursor;setCursor=function(){_sc.apply(this,arguments);if(armed())view.style.cursor=S.curvePick?'crosshair':'ns-resize'};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(S.curveTAT||S.curvePick)){S.curveTAT=false;S.curvePick=null;armUI()}},true);
/* changer de calque ou de document désarme les outils */
const _sa=syncDev;syncDev=function(){const r=_sa.apply(this,arguments);if((S.curveTAT||S.curvePick)&&!ADJ()){S.curveTAT=false;S.curvePick=null;setCursor()}return r};

/* ---- écrêtage sur la photo ---- */
const CLP=mk(1,1);
const _dov=drawOverlays;drawOverlays=function(c,pr){const pp=S.pointer;
  if(S.curveClip&&S.workPos&&work.width>1){try{const ws=S.workSize,lq=ws&&ws.k<1,wz=S.workZ||1,dw=(lq?ws.w:work.width)*wz,dh=(lq?ws.h:work.height)*wz,k=Math.min(1,1400/Math.max(work.width,work.height)),w=Math.max(1,Math.round(work.width*k)),h=Math.max(1,Math.round(work.height*k));
    if(CLP.width!==w||CLP.height!==h){CLP.width=w;CLP.height=h}const g=rx(CLP);g.clearRect(0,0,w,h);g.imageSmoothingEnabled=false;g.drawImage(work,0,0,w,h);const im=g.getImageData(0,0,w,h),a=im.data;
    for(let i=0;i<a.length;i+=4){const r=a[i],gg=a[i+1],b=a[i+2];if(a[i+3]<10){a[i+3]=0;continue}if(r>=254||gg>=254||b>=254){a[i]=255;a[i+1]=40;a[i+2]=40;a[i+3]=210}else if(r<=1&&gg<=1&&b<=1){a[i]=40;a[i+1]=110;a[i+2]=255;a[i+3]=210}else a[i+3]=0}
    g.putImageData(im,0,0);c.save();c.setTransform(1,0,0,1,0,0);c.imageSmoothingEnabled=false;c.drawImage(CLP,S.workPos.x,S.workPos.y,dw,dh);c.restore()}catch(e){}}
  if(armed()&&pp&&pp.inside){pp.inside=false;try{return _dov.apply(this,arguments)}finally{pp.inside=true}}return _dov.apply(this,arguments)};

curveToolsUI();curveTabUI();
})();
