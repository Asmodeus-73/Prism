/* les raccourcis personnalisés (1080-raccourcis.js) passent avant tous les autres gestionnaires de touches :
   ce gestionnaire est le tout premier enregistré, et il appelle celui défini plus loin */
window.addEventListener('keydown',e=>{const h=window.__KEYHOOK;if(h)h(e)},true);
