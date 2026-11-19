/* ===== Aide > Mesurer la vitesse… : une mesure faite sur l'appareil, pour fixer les objectifs de la 2.0.
   Une photo de test (24 ou 45 Mpx) et 10 calques (4 calques de pixels, dont 3 avec fusion et un masque, 6 de réglages)
   sont créés dans un onglet à part, jamais enregistré. On mesure le temps de rendu pendant qu'on glisse un
   réglage (aperçu), après le relâchement (pleine qualité), et à 100 %. Rien n'est envoyé : le tableau se copie. ===== */
(()=>{
const frames=n=>new Promise(r=>{const f=()=>--n<=0?r():requestAnimationFrame(f);requestAnimationFrame(f)});
const idle=async()=>{for(let i=0;i<200&&(S.contentDirty||rq);i++)await frames(1);await frames(2)};
const stat=a=>{const s=[...a].sort((x,y)=>x-y),q=p=>s[Math.min(s.length-1,Math.floor(p*s.length))];return{med:q(.5),p90:q(.9),n:s.length}};
function photo(w,h){const c=mk(w,h),g=cx(c);const gr=g.createLinearGradient(0,0,w,h);gr.addColorStop(0,'#2b4a6a');gr.addColorStop(.5,'#c89a62');gr.addColorStop(1,'#e9e1d0');g.fillStyle=gr;g.fillRect(0,0,w,h);
  const t=mk(512,512),tg=cx(t),id=tg.createImageData(512,512);let s=12345;for(let i=0;i<id.data.length;i+=4){s=(s*1103515245+12345)>>>0;const v=s>>>24;id.data[i]=id.data[i+1]=id.data[i+2]=v;id.data[i+3]=28}tg.putImageData(id,0,0);
  g.fillStyle=g.createPattern(t,'repeat');g.fillRect(0,0,w,h);return c}
async function run(mpx,onStep){const [w,h]=mpx>=45?[8256,5504]:[6000,4000];const out={size:w+'×'+h,mpx:Math.round(w*h/1e5)/10};const before=S.doc;
  onStep('Photo de test…');let t0=performance.now();setDoc(photo(w,h),'Mesure de vitesse');const d=S.doc;d.nosave=true;await idle();out.open=Math.round(performance.now()-t0);
  onStep('Calques…');const base=d.layers[0].canvas;
  for(const [blend,op,masked] of [['multiply',.6,false],['screen',.4,true],['overlay',.5,false]]){const c=mk(w,h);cx(c).drawImage(base,0,0);const L=newPixel('Calque '+blend,c);L.blend=blend;L.opacity=op;
    if(masked){const m=mk(w,h),mg=cx(m),gr=mg.createRadialGradient(w/2,h/2,0,w/2,h/2,Math.max(w,h)/2);gr.addColorStop(0,'#fff');gr.addColorStop(1,'#000');mg.fillStyle=gr;mg.fillRect(0,0,w,h);L.mask=m}
    d.layers.push(L)}
  const devs=[{highlights:-30,shadows:25},{vibrance:20},{clarity:15},{temp:8},{saturation:-10}]; // with the base and setDoc's own adjustment layer: 10 layers
  for(const v of devs){const A=newAdjust('Réglage');Object.assign(A.dev,v);d.layers.push(A)}
  d.active=d.layers.length-1;out.layers=d.layers.length;markComp();await idle();
  const top=d.layers[d.layers.length-1];
  const slide=async(sliding,n)=>{const ms=[],lat=[];S.sliding=sliding;try{for(let i=0;i<n;i++){top.dev.exposure=((i%10)-5)/10;const t=performance.now();markComp();await idle();lat.push(performance.now()-t);ms.push(S.contentMs||0)}}finally{S.sliding=false}return{ms:stat(ms),lat:stat(lat)}};
  onStep('Glisser un réglage (aperçu)…');out.slide=await slide(true,20);
  onStep('Relâcher (pleine qualité)…');out.full=await slide(false,6);
  onStep('Zoom à 100 %…');t0=performance.now();zoomAt(1);await idle();out.zoom100=Math.round(performance.now()-t0);
  const z=await slide(true,10);out.slide100=z;
  fit(true);await idle();
  // back to the photo that was open, without keeping the test one
  try{const T=window.PrismTabs,tab=T&&T.tabs.find(x=>x.doc===d);if(tab&&before)await T.activate(T.tabs.find(x=>x.doc===before));if(tab){const i=T.tabs.indexOf(tab);if(i>=0)T.tabs.splice(i,1);T.draw()}if(!before&&S.doc===d)closeDoc()}catch(e){console.warn(e)}
  return out}
function table(r){const R=window.PrismReport,v=window.PRISM_VERSION||'?',f=x=>Math.round(x)+' ms';
  const kind=window.__TAURI__?'app':'web';
  return['Prism '+v+' ('+kind+')','Système : '+(navigator.userAgentData&&navigator.userAgentData.platform||navigator.platform||'?')+' · '+(navigator.hardwareConcurrency||'?')+' cœurs'+(navigator.deviceMemory?' · '+navigator.deviceMemory+' Go':''),
    'Carte graphique : '+(R&&R.gpu?R.gpu():'?'),'Page isolée : '+(self.crossOriginIsolated?'oui':'non'),
    'Photo : '+r.size+' ('+r.mpx+' Mpx), '+r.layers+' calques','',
    'Ouverture : '+f(r.open),
    'Glisser un réglage, aperçu : médiane '+f(r.slide.ms.med)+', 90 % '+f(r.slide.ms.p90)+' (réaction '+f(r.slide.lat.med)+')',
    'Pleine qualité : médiane '+f(r.full.ms.med)+', 90 % '+f(r.full.ms.p90),
    'Zoom à 100 % : '+f(r.zoom100)+' ; glisser à 100 % : médiane '+f(r.slide100.ms.med)+', 90 % '+f(r.slide100.ms.p90)].join('\n')}
function speedDialog(){
  dialog({title:'Mesurer la vitesse',light:true,body:`<p class="muted" style="margin:0 0 10px">Prism crée une photo de test avec 10 calques dans un onglet à part, mesure le temps de rendu, puis le referme. Rien n’est enregistré ni envoyé. Environ une minute.</p>
    <label class="field">Taille de la photo<select id="spMpx"><option value="24">24 Mpx (6000 × 4000)</option><option value="45">45 Mpx (8256 × 5504)</option></select></label>
    <p id="spStep" class="muted" style="margin:10px 0 0;min-height:1.4em"></p>
    <textarea id="spOut" readonly rows="10" spellcheck="false" hidden style="width:100%;box-sizing:border-box;margin-top:8px;font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace"></textarea>`,
    buttons:[{label:'Fermer'},{label:'Copier',onClick:()=>{const o=$('#spOut');if(o&&o.value)navigator.clipboard.writeText(o.value).then(()=>toast('Mesure copiée'),()=>{o.select();toast('Sélectionnez le texte pour le copier')});return false}},
      {label:'Lancer',primary:true,onClick:()=>{const st=$('#spStep'),o=$('#spOut'),mpx=+$('#spMpx').value;st.textContent='Préparation…';
        run(mpx,s=>{st.textContent=s}).then(r=>{st.textContent='Mesure terminée.';o.hidden=false;o.value=table(r);window.PRISM_SPEED=r},e=>{console.error(e);st.textContent='Mesure impossible : '+(e.message||e)});return false}}]})}
{const H=MENU2.help,_h=H.items;H.items=function(){const a=_h.apply(this,arguments);const i=a.findIndex(x=>x&&x.label==='Signaler un problème…');a.splice(i>=0?i:a.length,0,MI('Mesurer la vitesse…',{icon:'help',fn:speedDialog}));return a}}
if(typeof LANG_EN2!=='undefined'){Object.assign(LANG_EN2,{'Mesurer la vitesse…':'Measure speed…','Mesurer la vitesse':'Measure speed','Taille de la photo':'Photo size','Lancer':'Run','Mesure terminée.':'Measurement done.','Mesure copiée':'Measurement copied','Préparation…':'Preparing…','Photo de test…':'Test photo…','Calques…':'Layers…','Glisser un réglage (aperçu)…':'Dragging an adjustment (preview)…','Relâcher (pleine qualité)…':'Releasing (full quality)…','Zoom à 100 %…':'Zoom to 100%…',
  'Prism crée une photo de test avec 10 calques dans un onglet à part, mesure le temps de rendu, puis le referme. Rien n’est enregistré ni envoyé. Environ une minute.':'Prism creates a test photo with 10 layers in a separate tab, measures rendering time, then closes it. Nothing is saved or sent. About one minute.'})}
window.PrismSpeed={run,table,dialog:speedDialog};
})();
