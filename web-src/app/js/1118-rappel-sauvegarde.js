/* ===== Rappel de sauvegarde de la photothèque (Fichier > Sauvegarder la photothèque…, 0820).
   Les projets vivent dans la base du navigateur (ou de l'app) : un nettoyage ou une base abîmée efface tout.
   Après 30 jours sans sauvegarde, un rappel au lancement, au plus une fois par semaine. ===== */
(()=>{
const DAY=864e5;
const B=window.PrismBackup;if(!B||!B.backup)return;
if(!PREF.get('firstUse',0))PREF.set('firstUse',Date.now());
function due(now=Date.now()){const last=PREF.get('backupAt',0)||PREF.get('firstUse',now),nag=PREF.get('backupNag',0);return now-last>30*DAY&&now-nag>7*DAY}
async function maybe(){if(!due())return;let n=0;try{n=(await IDB.keys('projects')).length}catch(e){return}if(!n)return;
  if(document.querySelector('#scrim:not([hidden])'))return;
  PREF.set('backupNag',Date.now());
  const last=PREF.get('backupAt',0);
  toastAction(last?'Dernière sauvegarde de la photothèque il y a '+Math.floor((Date.now()-last)/DAY)+' jours.':'La photothèque n’a jamais été sauvegardée.','Sauvegarder',()=>B.backup())}
setTimeout(()=>{maybe().catch(()=>{})},20000);
window.PrismBackupReminder={due,maybe};
})();
