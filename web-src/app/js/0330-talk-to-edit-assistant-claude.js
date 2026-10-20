/* ================= talk-to-edit assistant (Claude via the sample capability) ================= */
const ASSIST_KEYS=(()=>{const o=[];SECTIONS.forEach(s=>(s.rows||[]).forEach(r=>{if(r&&r[0]!=='#')o.push({k:r[0],label:r[1],min:r[2],max:r[3]})}));return o})();
let sampleNS=null;const sampleReady=(async()=>{try{return window.claude&&window.claude.use?await window.claude.use('sample'):null}catch(e){return null}})().then(v=>{sampleNS=v;$('#composer')&&($('#composer').hidden=!v||PREF.get('composerHidden',false));renderAI&&$('#pane-ai')&&!$('#pane-ai').hidden&&renderAI();return v});
const ASSIST={busy:false,log:[],ctl:null};
function nonDefaultDev(dv){const z=DEV0(),o={};for(const k in dv){if(k==='curve')continue;if(Array.isArray(dv[k])){if(dv[k].some((v,i)=>v!==z[k][i]))o[k]=dv[k]}else if(dv[k]!==z[k])o[k]=dv[k]}return o}
function ellipseMask(cxn,cyn,rxn,ryn,feather,invert){const d=S.doc,m=mk(d.w,d.h),g=cx(m);const X=cxn*d.w,Y=cyn*d.h,RX=Math.max(2,rxn*d.w),RY=Math.max(2,ryn*d.h);
  const gr=g.createRadialGradient(0,0,0,0,0,1);const f=clamp(feather??0.5,0,1);gr.addColorStop(0,'#fff');gr.addColorStop(clamp(1-f,0,0.999),'#fff');gr.addColorStop(1,'rgba(255,255,255,0)');
  g.save();g.translate(X,Y);g.scale(RX,RY);g.fillStyle=gr;g.beginPath();g.arc(0,0,1,0,7);g.fill();g.restore();if(invert){const o=fullMask(),og=cx(o);og.globalCompositeOperation='destination-out';og.drawImage(m,0,0);return o}return m}
function cleanParams(p){const out={};if(!p||typeof p!=='object')return out;for(const {k,min,max} of ASSIST_KEYS)if(typeof p[k]==='number'&&isFinite(p[k]))out[k]=clamp(p[k],min,max);
  for(const k of ['hslH','hslS','hslL'])if(Array.isArray(p[k])&&p[k].length===8)out[k]=p[k].map(v=>clamp(+v||0,-100,100));return out}
async function areaMask(a){const d=S.doc;a=a||{};const t=a.type||'global';
  if(t==='global')return null;
  if(t==='subject'||t==='background'){const m=await AI.subjectMask();if(!m)throw new Error('détourage indisponible');if(t==='subject')return cloneC(m);const o=fullMask(),g=cx(o);g.globalCompositeOperation='destination-out';g.drawImage(m,0,0);return o}
  if(t==='linear'){const dr={shape:'linear',x0:(a.x0??0.5)*d.w,y0:(a.y0??0)*d.h,x1:(a.x1??0.5)*d.w,y1:(a.y1??0.5)*d.h};return gradientCanvas(dr)}
  if(t==='radial')return ellipseMask(a.cx??0.5,a.cy??0.5,a.rx??0.2,a.ry??a.rx??0.2,a.feather,!!a.invert);
  throw new Error('zone inconnue : '+t)}
function assistPrompt(text){const d=S.doc;const layers=d.layers.map((L,i)=>L.kind==='adjust'?{index:i,name:L.name,kind:'adjust',masked:!!L.mask,visible:L.visible!==false,params:nonDefaultDev(L.dev)}:{index:i,name:L.name,kind:'pixel'});
  return `Tu es l'assistant de retouche de Prism, une application photo. L'utilisateur décrit une retouche en langage naturel ; tu la traduis en calques de réglage non destructifs. L'image jointe est l'état actuel de la photo (${d.w} × ${d.h} px).

Paramètres disponibles (nom: libellé [min, max], 0 = neutre) :
${ASSIST_KEYS.map(k=>`${k.k}: ${k.label} [${k.min}, ${k.max}]`).join('\n')}
hslH, hslS, hslL : tableaux de 8 nombres [-100, 100] pour Rouges, Oranges, Jaunes, Verts, Turquoises, Bleus, Violets, Magentas (teinte, saturation, luminance).
Repères : exposure est en IL (0.3 = léger, 1 = fort). Les autres curseurs : 10-25 = subtil, 30-50 = net, 60+ = fort. shH/midH/hiH sont des teintes en degrés, utiles seulement si shS/midS/hiS > 0.

Zones possibles pour un nouveau calque ("area"), coordonnées normalisées 0-1 depuis le coin haut gauche de l'image :
- {"type":"global"} : toute l'image.
- {"type":"subject"} ou {"type":"background"} : détourage automatique du sujet principal (personne, animal, objet) ou de tout le reste.
- {"type":"linear","x0":..,"y0":..,"x1":..,"y1":..} : effet à 100 % au point 0, qui s'estompe jusqu'à 0 au point 1. Pour un ciel : x0=0.5, y0=0, x1=0.5, y1 = juste sous la ligne d'horizon.
- {"type":"radial","cx":..,"cy":..,"rx":..,"ry":..,"feather":0-1,"invert":false} : ellipse (rx, ry en fraction de la largeur et de la hauteur). invert=true touche tout sauf l'ellipse (vignette ciblée). Pour un visage, place l'ellipse précisément sur le visage que tu vois.

Calques actuels (de bas en haut) :
${JSON.stringify(layers)}
${ASSIST.log.length?`\nDemandes précédentes de cette session (pour comprendre « encore », « un peu moins », « annule ça ») :\n${ASSIST.log.slice(-6).map(l=>'- '+l).join('\n')}\n`:''}
Demande de l'utilisateur : « ${text} »

Réponds uniquement avec un objet JSON :
{"message":"une phrase courte en français qui dit ce que tu as fait","ops":[...]}
Opérations possibles :
- {"op":"add","name":"nom court du calque","area":{...},"params":{...}}
- {"op":"edit","index":N,"params":{...}} : remplace ces paramètres d'un calque de réglage existant (les autres restent).
- {"op":"remove","index":N} : supprime un calque de réglage.
- {"op":"visible","index":N,"visible":true|false}
Préfère modifier un calque existant quand la demande prolonge une retouche précédente. Garde un rendu naturel et crédible sauf demande contraire. Si la demande est impossible avec ces outils (ex. ajouter un objet), renvoie "ops":[] et explique-le dans "message".`}
async function assist(text){text=(text||'').trim();if(!text||ASSIST.busy)return;const d=S.doc;if(!d){toast('Ouvrez d’abord une photo');return}
  const smp=sampleNS||await sampleReady;if(!smp){toast('La retouche en parlant n’est pas disponible dans cette vue');return}
  ASSIST.busy=true;composerState('Claude regarde la photo…');ASSIST.ctl=new AbortController();const h0=S.history[S.hi];/* layer indexes refer to this state */
  try{const s=Math.min(1,1024/Math.max(d.w,d.h)),c=await renderDoc(s),o=mk(c.width,c.height),g=cx(o);g.fillStyle='#808080';g.fillRect(0,0,o.width,o.height);g.drawImage(c,0,0);const img=await toBlob(o,'image/jpeg',0.85);
    const res=await smp.json(assistPrompt(text),{images:[img],signal:ASSIST.ctl.signal,cache:false,onText:()=>composerState('Claude prépare la retouche…')});
    if(S.doc!==d||S.history[S.hi]!==h0){composerState(null);toast('La photo a changé : retouche annulée');return}
    composerState('Application…');const ops=Array.isArray(res&&res.ops)?res.ops:[];let n=0;const touched=[];const n0=d.layers.length;
    const removes=[...new Set(ops.filter(o=>o&&o.op==='remove').map(o=>o.index|0))].filter(i=>i>=0&&i<n0).sort((a,b)=>b-a);
    const masks=new Map();for(const op of ops)if(op&&op.op==='add'){const m=await areaMask(op.area);if(op.area&&op.area.type&&op.area.type!=='global'&&!m)throw new Error('zone introuvable');masks.set(op,m)}if(S.doc!==d||S.history[S.hi]!==h0){composerState(null);toast('La photo a changé : retouche annulée');return}
    for(const op of ops){if(!op||typeof op!=='object')continue;
      if(op.op==='add'){const mask=masks.get(op)||null;const L=newAdjust(String(op.name||'Retouche').slice(0,40),mask);Object.assign(L.dev,cleanParams(op.params));d.layers.push(L);d.active=d.layers.length-1;touched.push(L.name);n++}
      else if(op.op==='edit'){const L=(op.index|0)<n0?d.layers[op.index|0]:null;if(L&&L.kind==='adjust'){Object.assign(L.dev,cleanParams(op.params));d.active=op.index|0;touched.push(L.name);n++}}
      else if(op.op==='visible'){const L=(op.index|0)>=0&&(op.index|0)<n0?d.layers[op.index|0]:null;if(L){L.visible=!!op.visible;n++}}}
    for(const i of removes){const L=d.layers[i];if(L&&L.kind==='adjust'){d.layers.splice(i,1);n++}}d.active=clamp(d.active,0,d.layers.length-1);
    const msg=String((res&&res.message)||'').slice(0,300);ASSIST.log.push(`« ${text} » → ${touched.length?'calques : '+touched.join(', '):'aucun changement'}`);
    if(n){markComp();pushHistory('Assistant : '+text.slice(0,40));syncAll();switchTab('develop')}
    composerState(null);$('#cmpIn').value='';toast(msg||(n?'Retouche appliquée : chaque réglage reste modifiable dans Calques.':'Aucun changement'),6000)}
  catch(e){composerState(null);if(e&&e.code==='cancelled')return;console.error(e);
    toast(e&&e.code==='not_granted'?'Autorisez Prism à utiliser Claude pour retoucher en parlant.':e&&e.code==='rate_limited'?'Trop de demandes d’un coup : patientez un instant.':e&&e.code==='invalid_json'?'Réponse illisible, reformulez la demande.':'Retouche impossible : '+((e&&(e.message||e.code))||e),6000)}
  finally{ASSIST.busy=false;ASSIST.ctl=null}}
function composerState(msg){const c=$('#composer');if(!c)return;c.classList.toggle('busy',!!msg);$('#cmpSt').textContent=msg||'';$('#cmpGo').hidden=!!msg;$('#cmpStop').hidden=!msg}

