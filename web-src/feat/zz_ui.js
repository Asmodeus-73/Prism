/* ===== 0.4: version shown at the bottom, the library logo goes to the home screen, home screen with a photo still open ===== */

// ---------- version, in the status bar and on the home screen ----------
const VER={v:window.PRISM_VERSION||'',where:window.__TAURI__?'app':'web'};
const verText=()=>VER.v?`Prism ${VER.v}${VER.where==='web'?' · web':''}`:'Prism';
{const st=document.createElement('style');st.textContent=`
.st-ver{font:500 11px/1 var(--mono,ui-monospace,monospace);color:var(--fg-3,var(--fg-2));opacity:.75;padding:0 10px;white-space:nowrap;user-select:text;flex:none}
body.no-doc .empty{background:var(--stage)}
.w-ver{margin-top:22px;font:500 11.5px/1 var(--mono,ui-monospace,monospace);color:var(--fg-3,var(--fg-2));opacity:.75;text-align:center;width:100%}
.w-back{display:flex;align-items:center;gap:10px;width:100%;margin-top:22px;padding:12px 16px;border:1px solid var(--accent-line,var(--line));background:var(--chrome);border-radius:var(--r);color:inherit;font:inherit;cursor:pointer;text-align:left}
.w-back:hover{background:var(--chrome-2)}.w-back b{font-weight:600}.w-back span{color:var(--fg-2);font-size:12px;margin-left:auto}
.w-back svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}`;document.body.appendChild(st)}
function placeVersion(){
  const bar=document.querySelector('footer.statusbar');
  if(bar&&!bar.querySelector('.st-ver')){const e=document.createElement('div');e.className='st-ver';e.id='stVer';bar.appendChild(e)}
  const wl=document.querySelector('#empty .welcome');
  if(wl&&!wl.querySelector('.w-ver')){const e=document.createElement('div');e.className='w-ver';wl.appendChild(e)}
  document.querySelectorAll('.st-ver,.w-ver').forEach(e=>{e.textContent=verText();e.title=VER.where==='app'?'Version de l’application installée':'Version de Prism en ligne'})}
placeVersion();
if(VER.where==='app')try{window.__TAURI__.app.getVersion().then(v=>{if(v){VER.v=v;placeVersion()}}).catch(()=>{})}catch(e){}
new MutationObserver(()=>{if(!document.querySelector('#empty .w-ver'))placeVersion()}).observe(document.getElementById('empty'),{childList:true,subtree:true});

// ---------- home screen while a photo is open: a way back to it ----------
const home=document.getElementById('empty');
function homeBack(){
  const wl=home.querySelector('.welcome');if(!wl)return;let b=wl.querySelector('.w-back');
  if(!S.doc||home.hidden){if(b)b.remove();return}
  if(!b){b=document.createElement('button');b.className='w-back';b.type='button';b.onclick=leaveHome;const t=wl.querySelector('.w-tiles');wl.insertBefore(b,t||null)}
  b.innerHTML=`<svg viewBox="0 0 20 20"><path d="M12 5l-5 5 5 5"/></svg><b>Revenir à « ${esc(S.doc.name||'photo')} »</b><span>Échap</span>`}
function leaveHome(){if(!S.doc)return;home.hidden=true;try{updateDocName()}catch(e){}requestRender()}
window.showHome=function(){if(typeof LIB!=='undefined'&&LIB.open)closeLibrary();home.hidden=false;homeBack();try{updateDocName()}catch(e){}};
new MutationObserver(homeBack).observe(home,{attributes:true,attributeFilter:['hidden']});
// with a photo hidden behind the home screen, editing shortcuts must not reach it
addEventListener('keydown',e=>{
  if(home.hidden||!S.doc||(typeof LIB!=='undefined'&&LIB.open))return;
  if(e.target&&e.target.closest&&e.target.closest('input,textarea,select,[contenteditable],dialog,.dlg,.modal,#cmdk'))return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();leaveHome();return}
  const k=e.key.toLowerCase(),mod=e.metaKey||e.ctrlKey;
  if(mod&&['o','n','k'].includes(k))return;
  if(e.key.length===1||['Delete','Backspace','Enter'].includes(e.key)||mod){e.stopImmediatePropagation()}},true);

// ---------- library logo: back to the home screen (the editor logo still opens the library) ----------
if(typeof openLibrary==='function'){const _ol=openLibrary;openLibrary=async function(...a){const r=await _ol.apply(this,a);
  const m=document.querySelector('#library .lb-top .lb-mark');
  if(m&&!m.dataset.home){const n=m.cloneNode(true);n.dataset.home='1';const t='Revenir à l’accueil';n.title=t;n.setAttribute('aria-label',t);
    const go=e=>{e.stopPropagation();e.preventDefault();window.showHome()};n.addEventListener('click',go);n.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')go(e)});m.replaceWith(n)}
  return r}}
