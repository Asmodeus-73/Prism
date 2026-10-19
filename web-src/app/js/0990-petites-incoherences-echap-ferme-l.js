/* ===== wave52: petites incohérences (Échap ferme l'écran des avis partagés ; menus assez larges pour les libellés longs) ===== */
(()=>{
const st=document.createElement('style');st.textContent='.menu{max-width:min(420px,calc(100vw - 16px))}';document.head.appendChild(st);
document.addEventListener('keydown',e=>{if(e.key!=='Escape'||!$('#review')||document.querySelector('#scrim,.menu'))return;e.preventDefault();e.stopPropagation();closeReview()},true);
})();
