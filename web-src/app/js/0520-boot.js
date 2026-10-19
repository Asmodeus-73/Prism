/* ================= boot ================= */
buildDock();buildDevelop();setTool('heal');syncLayers();renderHistory();updateUndo();renderTarget();setSaveState('idle');setSheet('peek');
requestAnimationFrame(async()=>{let opened=false;try{const last=PREF.get('last',null);if(last&&await IDB.get('projects',last))opened=await openLocalProject(last)}catch(e){console.warn(e)}
  if(!opened){$('#empty').hidden=false;try{updateDocName()}catch(e){}}else toast('Projet rouvert là où vous l’aviez laissé');
  Cloud.init().then(()=>Review.init())});

