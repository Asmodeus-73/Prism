/* ================= 1.0 : chasse aux doublons =================
   Ctrl+K : une commande apparaissait deux fois quand elle existe à la fois dans un menu et ailleurs (Niveaux,
   Mélangeur de couches, Historique, Transformation libre) : on garde la première, celle du menu.
   Calques : le « + » de l'en-tête doublait le bouton Nouveau calque du bas ; il ne sert plus que quand le panneau
   est replié (le bas est alors caché). */
{const _ci=cmdItems;cmdItems=function(){const seen=new Set();return _ci.apply(this,arguments).filter(x=>{const k=x&&(x.label||x.name);if(!k)return true;if(seen.has(k))return false;seen.add(k);return true})}}
(()=>{const st=document.createElement('style');st.textContent='#layersPanel:not(.folded):not(.pf-float) #lyAdd{display:none}';document.head.appendChild(st)})();
