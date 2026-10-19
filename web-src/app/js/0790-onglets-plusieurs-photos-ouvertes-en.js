/* ===== wave33: onglets, plusieurs photos ouvertes en même temps ===== */
(()=>{
const tabs=[];let _doc=S.doc,mute=0;
const KEEP=['history','hi','maxHist','meta','sample','zoom','panX','panY','fitted'];
const park=t=>{KEEP.forEach(k=>t[k]=S[k])};
const unpark=t=>{KEEP.forEach(k=>{if(k in t)S[k]=t[k]})};
Object.defineProperty(S,'doc',{configurable:true,enumerable:true,get(){return _doc},set(nd){
  const old=_doc;if(nd===old)return;
  if(mute>0){_doc=nd;return}
  if(!nd){const i=tabs.findIndex(t=>t.doc===old);if(i>=0)tabs.splice(i,1);_doc=null;draw();return}
  if(old&&!old.nosave&&(SAVE.timer||!old.saved)){try{saveNow()}catch(e){}}
  const same=old&&nd.pid&&old.pid===nd.pid;
  let ot=old?tabs.find(t=>t.doc===old):null;
  if(old&&!ot){ot={doc:old};tabs.push(ot)}
  if(ot){if(same){tabs.splice(tabs.indexOf(ot),1)}else park(ot)}
  for(let i=tabs.length-1;i>=0;i--)if(tabs[i].doc!==nd&&nd.pid&&tabs[i].doc.pid===nd.pid)tabs.splice(i,1);
  let nt=tabs.find(t=>t.doc===nd);
  _doc=nd;
  if(nt)unpark(nt);else tabs.push({doc:nd});
  draw()}});
tabs.push(..._doc?[{doc:_doc}]:[]);

async function activate(t){
  if(!t||t.doc===S.doc)return;
  if(S.drag)try{cancelDrag()}catch(e){}
  S.crop=null;S.compare=null;S.poly=null;S.snapLines=null;
  const d=t.doc;S.doc=d;
  try{setCS(d.space||'srgb')}catch(e){}
  AI.subjectCache=null;
  selChanged();markComp();syncAll();renderHistory();updateUndo();updateDocName();
  const em=$('#empty');if(em)em.hidden=true;
  if(S.fitted!==false&&!('zoom' in t))fit(true);else requestRender();
  if(S.tool==='crop')try{initCrop()}catch(e){}
  PREF.set('last',d.pid);try{setSaveState(d.saved?'saved':'pending')}catch(e){}
  try{updateStDoc()}catch(e){}
  draw()}
const curIdx=()=>tabs.findIndex(t=>t.doc===S.doc);
async function closeTab(t){
  if(!t)return;const i=tabs.indexOf(t);
  if(t.doc===S.doc){
    const nx=tabs[i+1]||tabs[i-1];
    if(nx){await flushSave().catch(()=>{});if(!await window.PrismFx.okToClose(t.doc))return;const nd=nx.doc;tabs.splice(i,1);mute++;try{S.doc=nd}finally{mute--}
      const t2=nx;unpark(t2);try{setCS(nd.space||'srgb')}catch(e){}AI.subjectCache=null;S.crop=null;S.compare=null;
      selChanged();markComp();syncAll();updateDocName();requestRender();PREF.set('last',nd.pid);draw();return}
    closeDoc();return}
  tabs.splice(i,1);draw()}
const _cd=closeDoc;
closeDoc=function(){const i=curIdx(),nx=tabs[i+1]||tabs[i-1];
  if(tabs.length>1&&i>=0&&nx){closeTab(tabs[i]);return}
  _cd()};
/* traitements par lot : documents temporaires hors onglets */
['runBatch','importToLibrary'].forEach(n=>{const f=window[n];if(typeof f!=='function'){console.warn('tabs:',n);return}window[n]=async function(...a){mute++;try{return await f.apply(this,a)}finally{mute--;draw()}}});

/* barre d'onglets */
const bar=document.createElement('div');bar.id='tabbar';bar.setAttribute('role','tablist');bar.setAttribute('aria-label','Photos ouvertes');
const hdr=document.querySelector('header.bar');if(hdr)hdr.after(bar);
const st=document.createElement('style');st.textContent=`
#tabbar{display:none;align-items:flex-end;gap:2px;padding:6px 10px 0;background:var(--chrome);border-bottom:1px solid var(--line);overflow-x:auto;scrollbar-width:none;min-width:0}
#tabbar::-webkit-scrollbar{display:none}
body.has-tabs #tabbar{display:flex}
body.has-tabs #app{grid-template-rows:44px 36px 44px minmax(0,1fr) 28px}
body.compact #tabbar,body.no-doc #tabbar{display:none!important}
.tab{display:flex;align-items:center;gap:8px;height:30px;min-width:110px;max-width:220px;padding:0 6px 0 12px;border:1px solid transparent;border-bottom:0;border-radius:9px 9px 0 0;background:transparent;color:var(--fg-2);font-size:12.5px;cursor:pointer;flex:none;position:relative}
.tab:hover{background:var(--hover);color:var(--fg)}
.tab.on{background:var(--bg);border-color:var(--line);color:var(--fg);font-weight:500;margin-bottom:-1px;height:31px}
.tab.on::before{content:'';position:absolute;left:10px;right:10px;top:0;height:2px;border-radius:0 0 2px 2px;background:var(--accent)}
.tab span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}
.tab i{width:6px;height:6px;border-radius:50%;background:var(--accent-fg);flex:none}
.tab button{width:20px;height:20px;border:0;border-radius:5px;background:none;color:inherit;display:grid;place-items:center;opacity:.6;padding:0;flex:none}
.tab button:hover{background:var(--raise);opacity:1}
.tab button svg{width:10px;height:10px;stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round}
.tab-add{width:28px;height:28px;margin:0 0 1px 4px;border:0;border-radius:8px;background:none;color:var(--fg-2);display:grid;place-items:center;flex:none}
.tab-add:hover{background:var(--hover);color:var(--fg)}
.tab-add svg{width:14px;height:14px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round}
`;document.head.appendChild(st);
const X='<svg viewBox="0 0 10 10"><path d="M2 2l6 6M8 2l-6 6"/></svg>';
function draw(){
  const show=tabs.length>=2&&!!S.doc;document.body.classList.toggle('has-tabs',show);
  if(!show){bar.innerHTML='';return}
  bar.innerHTML=tabs.map((t,i)=>`<div class="tab ${t.doc===S.doc?'on':''}" role="tab" aria-selected="${t.doc===S.doc}" data-i="${i}" title="${esc(t.doc.name)} · ${t.doc.w} × ${t.doc.h}"><span>${esc(t.doc.name)}</span>${t.doc.saved===false?'<i title="Enregistrement en cours"></i>':''}<button type="button" data-x="${i}" aria-label="Fermer l’onglet">${X}</button></div>`).join('')+`<button class="tab-add" type="button" aria-label="Ouvrir une photo dans un nouvel onglet" title="Ouvrir une photo dans un nouvel onglet"><svg viewBox="0 0 14 14"><path d="M7 2v10M2 7h10"/></svg></button>`;
  const on=bar.querySelector('.tab.on');if(on&&on.scrollIntoView)try{on.scrollIntoView({block:'nearest',inline:'nearest'})}catch(e){}}
bar.addEventListener('click',e=>{const x=e.target.closest('[data-x]');if(x){e.stopPropagation();closeTab(tabs[+x.dataset.x]);return}
  if(e.target.closest('.tab-add')){openFile();return}
  const t=e.target.closest('.tab');if(t)activate(tabs[+t.dataset.i])});
bar.addEventListener('auxclick',e=>{if(e.button!==1)return;const t=e.target.closest('.tab');if(t){e.preventDefault();closeTab(tabs[+t.dataset.i])}});
bar.addEventListener('mousedown',e=>{if(e.button===1)e.preventDefault()});
const _udn=updateDocName;updateDocName=function(){_udn();draw()};
const _ss=setSaveState;try{setSaveState=function(s,...a){const r=_ss(s,...a);if(s==='saved')draw();return r}}catch(e){}
document.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||!e.altKey||tabs.length<2||$('#scrim'))return;
  if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const i=curIdx(),n=tabs.length,j=(i+(e.key==='ArrowRight'?1:-1)+n)%n;activate(tabs[j])}},true);
/* menu Fichier */
const _fi=MENU2.file.items;
MENU2.file.items=()=>{const a=_fi();const k=a.findIndex(x=>x&&x.label==='Renommer le document…');const it=MI('Fermer la photo',{dis:S.doc?false:NODOC,fn:()=>{const t=tabs[curIdx()];if(tabs.length>1)closeTab(t);else closeDoc()}});if(k>=0)a.splice(k+1,0,it);else a.push(it);return a};
window.PrismTabs={tabs,activate,closeTab,draw};
draw();
})();

