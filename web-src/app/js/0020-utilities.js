/* ================= utilities ================= */
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const IS_MAC=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent);
const MOD=IS_MAC?'⌘':'Ctrl+',ALT=IS_MAC?'Option':'Alt';
function mk(w,h){const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));if(CS!=='srgb')c._cs=CS;return c}
function ctx2(c,o){const g=c.getContext('2d',c._cs?{...o,colorSpace:c._cs}:o);if(!g)throw new Error('mémoire graphique saturée : fermez d’autres onglets ou réduisez la photo');return g}
const cx=c=>ctx2(c,{}),rx=c=>ctx2(c,{willReadFrequently:true});
function cloneC(s){const c=mk(s.width,s.height);cx(c).drawImage(s,0,0);return c}
function esc(s){return String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
let toastT;function toast(msg,ms){let t=$('#toast');if(!t){t=document.createElement('div');t.id='toast';t.className='toast';t.setAttribute('role','status');document.body.appendChild(t)}t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,ms||2800)}
function busy(on,msg,p){let b=$('#busy');if(on){if(!b){b=document.createElement('div');b.id='busy';b.className='busy';b.innerHTML='<div><span></span><div class="prog"><i></i></div></div>';document.body.appendChild(b)}b.querySelector('span').textContent=msg||'Traitement…';const pr=b.querySelector('.prog');pr.hidden=false;pr.classList.toggle('ind',p==null);if(p!=null)pr.firstChild.style.width=Math.max(0,Math.min(100,p*100)).toFixed(1)+'%';b.hidden=false}else if(b)b.hidden=true}
const tick=()=>new Promise(r=>setTimeout(r,16));
let _FO;const filterOK=()=>_FO===undefined?(_FO=(()=>{try{const t=mk(9,1),c=cx(t);c.filter='blur(2px)';c.fillRect(4,0,1,1);return c.getImageData(2,0,1,1).data[3]>0}catch(e){return false}})()):_FO;
const IS_IOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
let MAX_PX=IS_IOS?16777216:(navigator.deviceMemory||8)>=8?120e6:60e6;
const HIST_BUDGET=IS_IOS?2.5e8:(navigator.deviceMemory||8)>=8?2e9:1.2e9;
// the desktop app maps its AI model files to the copies it fetches on first use (desktop/desktop.js)
const asset=p=>(window.PRISM_ASSET&&PRISM_ASSET(p))||new URL(p,location.href).href;

