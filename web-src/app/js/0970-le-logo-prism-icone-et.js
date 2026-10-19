/* ===== wave50: le logo Prism (icône et nom) ramène à la photothèque ===== */
(()=>{
const m=document.querySelector('header.bar .mark');if(!m)return;
m.setAttribute('role','button');m.tabIndex=0;m.title='Photothèque (toutes vos photos)';m.setAttribute('aria-label','Prism : ouvrir la photothèque');m.style.cursor='pointer';
const st=document.createElement('style');st.textContent='header.bar .mark:focus{outline:none}header.bar .mark:focus-visible{outline:2px solid var(--accent);outline-offset:1px;border-radius:8px}';document.head.appendChild(st);
const go=()=>{if(typeof LIB!=='undefined'&&LIB.open)return;try{openLibrary()}catch(e){console.warn(e)}};
m.addEventListener('click',go);
m.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}});
})();

