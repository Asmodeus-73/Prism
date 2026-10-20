/* ================= v9: plain-language messages, memory guard ================= */
const FRIENDLY=[
  [/image trop grande/i,m=>m+'. Réduisez-la d’abord, ou ouvrez-la sur un ordinateur.'],
  [/tuile (16 bits )?manquante/i,()=>'un morceau du projet est introuvable sur cet appareil. Si la synchronisation était active, rouvrez le projet depuis votre compte.'],
  [/worker( timeout)?$/i,()=>'le calcul a été interrompu. Réessayez, ou fermez d’autres onglets pour libérer de la mémoire.'],
  [/^fichier (\d{3})$/i,(m,c)=>`le téléchargement a échoué (code ${c}). Vérifiez votre connexion puis réessayez.`],
  [/format non pris en charge par ce navigateur/i,()=>'ce navigateur ne sait pas écrire ce format. Choisissez JPEG, PNG ou AVIF.'],
  [/^format( non pris en charge)?$/i,()=>'format non reconnu. Prism lit JPEG, PNG, WebP, AVIF, HEIC, TIFF, PSD, RAW, PDF et SVG.'],
  [/HEIC illisible/i,()=>'ce fichier HEIC n’a pas pu être lu. Réexportez-le en JPEG depuis l’app Photos, puis réessayez.'],
  [/drawing buffer|mémoire graphique/i,()=>'la mémoire graphique est saturée. Fermez d’autres onglets ou réduisez la photo.'],
  [/quota|QuotaExceeded/i,()=>'l’espace de stockage de ce navigateur est plein. Supprimez d’anciens projets dans la photothèque.'],
  [/Failed to fetch|NetworkError|Load failed|network/i,()=>'connexion impossible. Vérifiez votre réseau puis réessayez.'],
  [/archive zip illisible/i,()=>'cette archive est abîmée, ou ce n’est pas un .zip Prism.'],
  [/aucun calque lisible/i,()=>'ce PSD ne contient aucun calque que Prism sache lire. Ouvrez-le aplati ou enregistrez-le en TIFF.'],
  [/TIFF (invalide|vide)|compression TIFF|espace couleur TIFF/i,m=>m+'. Enregistrez-le en TIFF non compressé (RVB) ou en PNG.'],
  [/^(modèle \d+|script .*)$/i,()=>'le modèle d’IA n’a pas pu être téléchargé. Vérifiez votre connexion puis réessayez.'],
  [/profil ICC illisible/i,()=>'le profil couleur de la photo est illisible. Elle est lue en sRGB.'],
  [/transformation impossible avec ce profil/i,()=>'ce profil couleur ne permet pas la conversion. Choisissez sRGB.'],
  [/encodage AVIF impossible/i,()=>'l’encodage AVIF a échoué. Essayez JPEG ou une taille plus petite.'],
  [/trop de fichiers pour une archive/i,()=>'trop de fichiers pour une seule archive. Exportez-les en plusieurs fois.'],
  [/projet non enregistré/i,()=>'enregistrez d’abord le projet.'],
  [/fichier PSD invalide/i,()=>'ce fichier n’est pas un PSD valide, ou il est abîmé.'],
  [/PSB 16 bits/i,()=>'les fichiers PSB en 16 bits ne sont pas lus. Enregistrez-le en PSD ou en TIFF.'],
  [/seul le RGB 16 bits/i,()=>'seul le RVB 16 bits est lu ici. Convertissez-le en RVB dans Photoshop.'],
  [/^introuvable$/i,()=>'élément introuvable.']];
const _toast16=toast;toast=function(msg,ms){if(typeof msg==='string'){const m=/^(.+? : )(.+)$/.exec(msg);if(m&&/impossible|n’a pas pu|interrompu|interrompue/.test(m[1])){let d=m[2];for(const[re,fn]of FRIENDLY){const x=re.exec(d);if(x){d=fn(d,...x.slice(1));break}}
        d=d.charAt(0).toLowerCase()+d.slice(1);msg=m[1]+d;if(!ms||ms<5000)ms=6000}}return _toast16(msg,ms)};
/* the sync status line says what to do */
const _ssState16=setSaveState;setSaveState=function(st){_ssState16(st);if(st==='syncerr'&&SAVE.err&&/réseau|connexion|fetch/i.test(SAVE.err))SAVE.err='connexion perdue, nouvel essai automatique'};
/* memory guard for very large photos with many layers */
function memEstimate(){const d=S.doc;if(!d)return 0;const px=d.w*d.h;let b=0;for(const L of d.layers){const c=lcv(L);if(c)b+=c.__sp?c.width*c.height*4:px*4;if(L.mask)b+=px*4;if(L.hi)b+=px*8}if(d.sel)b+=px*4;return b}
const memBudget=()=>IS_IOS?5e8:Math.min(3e9,(navigator.deviceMemory||4)*4e8);
const _pushHistory16=pushHistory;pushHistory=function(){const r=_pushHistory16.apply(this,arguments);try{const d=S.doc;if(d&&!d._memWarned){const e=memEstimate(),bud=memBudget();if(e>bud*0.8){d._memWarned=true;toast(`Cette photo de ${(d.w*d.h/1e6).toFixed(0)} Mpx avec ${d.layers.length} calques occupe environ ${(e/1e9).toFixed(1).replace('.',',')} Go de mémoire. Fusionnez quelques calques (${MOD}E) pour garder de la fluidité.`,8000)}}}catch(e){}return r};


/* an error nothing caught: it is said once in plain words (at most every 30 s) instead of failing silently */
{let last=0;const IGN=/ResizeObserver|annulé|AbortError|Script error\.?$/i;
 const say=e=>{const m=String(e&&(e.message||e.reason&&e.reason.message||e.reason)||e||'');if(!m||IGN.test(m))return;console.error('Prism :',e.error||e.reason||e);const t=Date.now();if(t-last<30000)return;last=t;
   try{toast('Un problème inattendu est survenu ('+m.slice(0,120)+'). Votre travail reste enregistré ; si cela se répète, rechargez Prism.',6000)}catch(_){}};
 addEventListener('error',e=>{if(e.target&&e.target!==window)return;say(e)});addEventListener('unhandledrejection',e=>say(e))}
