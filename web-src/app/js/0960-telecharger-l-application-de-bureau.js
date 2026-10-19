/* ===== wave49: télécharger l'application de bureau depuis l'accueil (version web sur ordinateur) ===== */
(()=>{
if(window.PRISM_DESKTOP||IS_IOS||/Android/.test(navigator.userAgent))return;
const URL_APP='https://asmodeus-73.github.io/Prism/#telecharger';
const st=document.createElement('style');st.textContent='.w49{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:14px;font-size:12.5px;color:var(--fg-2)}.w49 a{color:var(--accent);font-weight:600;text-decoration:none}.w49 a:hover{text-decoration:underline}.w49 svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}';document.head.appendChild(st);
const put=()=>{const t=$('#wTiles');if(!t||$('#w49'))return;t.insertAdjacentHTML('afterend',`<div class="w49" id="w49"><svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg><span>Prism existe aussi en application pour Mac et Windows, qui marche hors ligne.</span><a href="${URL_APP}" target="_blank" rel="noopener">Télécharger l’app</a></div>`)};
put();setTimeout(put,800);
/* le lien télécharge directement le bon fichier pour cet ordinateur (.dmg sur Mac, -setup.exe sur Windows) */
const mac=/Mac/.test(navigator.platform||navigator.userAgent),win=/Win/.test(navigator.platform||navigator.userAgent);
if(mac||win)fetch('https://api.github.com/repos/Asmodeus-73/Prism/releases/latest').then(r=>r.ok?r.json():null).then(j=>{
  const a=j&&(j.assets||[]).find(x=>mac?/\.dmg$/i.test(x.name):/-setup\.exe$/i.test(x.name));if(!a)return;
  const set=()=>{const l=$('#w49 a');if(!l)return false;l.href=a.browser_download_url;l.removeAttribute('target');l.textContent=mac?'Télécharger pour Mac':'Télécharger pour Windows';l.title='Prism '+(j.tag_name||'').replace(/^v/,'')+' : '+a.name;return true};
  if(!set())setTimeout(set,900)}).catch(()=>{});
})();

