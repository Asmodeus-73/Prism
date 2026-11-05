/* ===== Aide > Signaler un problème : un rapport avec la version, le système et le journal des erreurs (0011).
   L'utilisateur le copie ou l'ouvre dans un nouveau ticket GitHub. Aucune photo, aucun nom de fichier, rien vers un serveur Prism. ===== */
(()=>{
const NEW='https://github.com/Asmodeus-73/Prism/issues/new?';
const kind=()=>window.__TAURI__?(/Mac/i.test(navigator.platform||navigator.userAgent)?'app Mac':/Win/i.test(navigator.platform||navigator.userAgent)?'app Windows':'app de bureau'):'web';
let gpu=null;
const gpuName=()=>{if(gpu!=null)return gpu;try{const c=document.createElement('canvas'),g=c.getContext('webgl2')||c.getContext('webgl'),x=g&&g.getExtension('WEBGL_debug_renderer_info');gpu=g?String(x?g.getParameter(x.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)):'WebGL indisponible';const l=g&&g.getExtension('WEBGL_lose_context');l&&l.loseContext()}catch(e){gpu='inconnue'}return gpu};
const hm=t=>new Date(t).toTimeString().slice(0,8);
function report(what,withLog,max){const d=S.doc,v=window.PRISM_VERSION||'?',lines=[];
  lines.push('### Ce qui s’est passé','',(what||'').trim()||'(non décrit)','');
  lines.push('### Prism','- Version : '+v+' ('+kind()+')','- Système : '+(navigator.userAgentData&&navigator.userAgentData.platform||navigator.platform||'?'),'- Navigateur : '+navigator.userAgent,
    '- Écran : '+screen.width+'×'+screen.height+' @'+(devicePixelRatio||1)+'x, fenêtre '+innerWidth+'×'+innerHeight,
    '- Langue : '+((PREF.get&&PREF.get('lang',''))||'fr')+' / '+navigator.language,
    '- Mémoire : '+(navigator.deviceMemory?navigator.deviceMemory+' Go':'?')+', '+(navigator.hardwareConcurrency||'?')+' cœurs',
    '- Carte graphique : '+gpuName(),
    '- Photo ouverte : '+(d?d.w+'×'+d.h+' px, '+d.layers.length+' calque'+(d.layers.length>1?'s':''):'aucune'),'');
  if(withLog){const L=ERRLOG.slice(-(max||40));lines.push('### Journal ('+L.length+' entrée'+(L.length>1?'s':'')+')','```');
    L.forEach(e=>lines.push(hm(e.t)+' '+e.k+(e.n>1?' ×'+e.n:'')+' : '+e.m));if(!L.length)lines.push('aucune erreur');lines.push('```')}
  return lines.join('\n')}
function issueUrl(what,withLog){const t=(what||'').trim().split('\n')[0].slice(0,70)||'Problème dans Prism '+(window.PRISM_VERSION||'');
  let n=40,u;do{u=NEW+'title='+encodeURIComponent(t)+'&body='+encodeURIComponent(report(what,withLog,n));n=n>8?n-8:n-1}while(u.length>7500&&n>=0);return u}
async function copy(text,el){try{await navigator.clipboard.writeText(text);return true}catch(e){try{const o=$('#rpOut',el);o.closest('details').open=true;o.value=text;o.select();return document.execCommand('copy')}catch(e2){return false}}}
function reportDialog(){
  dialog({title:'Signaler un problème',light:true,body:`<p class="muted" style="margin:0 0 10px">Le rapport contient la version de Prism, votre système et les dernières erreurs. Aucune photo ni nom de fichier.</p>
    <label class="field">Ce qui s’est passé<textarea id="rpTxt" rows="4" placeholder="Ce que vous faisiez, ce que vous attendiez, ce que vous avez vu"></textarea></label>
    <label class="rp-c"><input type="checkbox" id="rpLog" checked> Joindre le journal d’erreurs (${ERRLOG.length})</label>
    <details class="rp-d"><summary>Voir le rapport</summary><textarea id="rpOut" readonly rows="9" spellcheck="false"></textarea></details>
    <p class="muted" style="margin:8px 0 0">Un ticket GitHub est public.</p>
    <style>.rp-c{display:flex;align-items:center;gap:8px;margin:10px 0 6px;font-size:13px}.rp-d summary{cursor:pointer;font-size:12.5px;color:var(--fg-3)}.rp-d textarea{width:100%;margin-top:6px;font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;resize:vertical;box-sizing:border-box}#rpTxt{width:100%;box-sizing:border-box;resize:vertical}</style>`,
    onOpen:el=>{const t=$('#rpTxt',el),c=$('#rpLog',el),o=$('#rpOut',el),up=()=>{o.value=report(t.value,c.checked)};
      t.addEventListener('keydown',e=>e.stopPropagation());t.oninput=up;c.onchange=up;$('.rp-d',el).ontoggle=up;up();setTimeout(()=>t.focus(),30)},
    buttons:[{label:'Fermer'},
      {label:'Copier',onClick:()=>{const el=$('#scrim');copy(report($('#rpTxt').value,$('#rpLog').checked),el).then(ok=>toast(ok?'Rapport copié':'Copie impossible : sélectionnez le texte du rapport'));return false}},
      {label:'Ouvrir sur GitHub',primary:true,onClick:()=>{const u=issueUrl($('#rpTxt').value,$('#rpLog').checked),D=window.PRISM_DESKTOP;
        if(D&&D.invoke)D.invoke('report_issue',{url:u}).catch(e=>{console.warn(e);toast('Ouverture impossible : utilisez Copier',4000)});
        else{const a=document.createElement('a');a.href=u;a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove()}}}]})}
{const H=MENU2.help,_h=H.items;H.items=function(){const a=_h.apply(this,arguments);const i=a.findIndex(x=>x&&x.label==='À propos de Prism');const it=MI('Signaler un problème…',{icon:'help',fn:reportDialog});
  if(i>=0)a.splice(i,0,it);else a.push(it);return a}}
window.PrismReport={dialog:reportDialog,report,issueUrl,gpu:gpuName};
})();
