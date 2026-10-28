/* ================= export ================= */
let dlNS=null;const dlReady=(async()=>{try{return window.claude&&window.claude.use?await window.claude.use('downloads'):null}catch(e){return null}})().then(v=>dlNS=v);
var exportDialog; /* défini dans 0510-export-dialog-every-format.js */
var doExport; /* défini dans 0510-export-dialog-every-format.js */

