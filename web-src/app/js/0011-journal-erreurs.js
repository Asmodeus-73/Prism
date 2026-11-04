/* ===== journal des erreurs : les 40 dernières, gardées en mémoire pour « Signaler un problème » (rien n'est envoyé) =====
   Les adresses des scripts sont raccourcies au nom du fichier : le rapport ne montre pas de chemin local. */
const ERRLOG=[];
{const clean=m=>{let s;try{s=m&&m.stack?String(m.stack):m&&m.message?String(m.message):typeof m==='object'?JSON.stringify(m):String(m)}catch(e){s=String(m)}
   return s.replace(/(?:https?|wss?|tauri|file|asset|blob):\/\/[^\s)'"]*\/([^\s)'"/?#]*)(?:[?#][^\s)'"]*)?/g,'$1').replace(/(token|password|pw|key|secret)=[^\s&'"]+/gi,'$1=…').replace(/Bearer\s+[A-Za-z0-9._-]+/g,'Bearer …').replace(/data:[^\s)'"]{40,}/g,'data:…').slice(0,700)};
 const add=(k,parts)=>{try{const m=parts.map(clean).join(' '),last=ERRLOG[ERRLOG.length-1];if(last&&last.k===k&&last.m===m){last.n++;last.t=Date.now();return}
   ERRLOG.push({t:Date.now(),k,m,n:1});if(ERRLOG.length>40)ERRLOG.shift()}catch(e){}};
 window.addEventListener('error',e=>{if(e.error||e.message)add('erreur',[e.error||e.message])});
 window.addEventListener('unhandledrejection',e=>add('promesse',[e.reason]));
 for(const [k,n] of [['error','console'],['warn','alerte']]){const o=console[k];console[k]=function(...a){add(n,a);return o.apply(this,a)}}}
