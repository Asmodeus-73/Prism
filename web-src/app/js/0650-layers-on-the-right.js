/* ================= 1.0: layers sit on the right, under the adjustments =================
   One side to look at: the splitter between Réglages and Calques is dragged to share the height,
   double-clicked (or F7) to fold the layers down to their header. */
(()=>{const st=document.createElement('style');st.textContent=`
body:not(.compact) .layers-panel{display:flex;flex-direction:column;min-height:0;flex:none}
body:not(.compact) .layers-panel .pane{flex:1;min-height:0}
body:not(.compact) .side .splitter#lySplit{display:block;height:7px;margin:-3px 0;position:relative;z-index:2;cursor:row-resize;touch-action:none}
body:not(.compact) .side .splitter#lySplit::after{content:"";position:absolute;left:50%;top:2px;width:28px;height:3px;margin-left:-14px;border-radius:2px;background:var(--line-2)}
body:not(.compact) .side .splitter#lySplit:hover::after,body:not(.compact) .side .splitter#lySplit.on::after{background:var(--accent)}
.layers-panel>.ph.static{display:flex;align-items:center;gap:4px;padding:6px 6px 4px 12px;font-size:12px;font-weight:600;color:var(--fg-2)}
.layers-panel>.ph.static>span{flex:1}
.layers-panel>.ph.static button{border:0;background:none;color:var(--fg-2);cursor:pointer;width:26px;height:26px;border-radius:6px;display:grid;place-items:center}
.layers-panel>.ph.static button:hover{background:var(--hover);color:var(--fg)}
.layers-panel>.ph.static svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.layers-panel.folded{height:auto!important}.layers-panel.folded>.pane{display:none}
.layers-panel.folded #lyFold svg{transform:rotate(180deg)}
body.compact .layers-panel>.ph.static{display:none}
`;document.head.appendChild(st)})();
const LYR={off:PREF.get('lyOff',false)};
(()=>{const lp=$('#layersPanel'),head=$('#lyHead');
  head.insertAdjacentHTML('beforeend',`<button id="lyAdd" title="Nouveau calque" aria-label="Nouveau calque"><svg viewBox="0 0 20 20"><path d="M10 4v12M4 10h12"/></svg></button><button id="lyFold" title="Replier le panneau Calques (F7)" aria-label="Replier le panneau Calques"><svg viewBox="0 0 20 20"><path d="M6 8l4 4 4-4"/></svg></button>`);
  const apply=()=>{lp.classList.toggle('folded',LYR.off);$('#lyFold').setAttribute('aria-label',LYR.off?'Déplier le panneau Calques':'Replier le panneau Calques');requestAnimationFrame(()=>{try{resizeView();markContent()}catch(e){}})};
  const toggle=()=>{LYR.off=!LYR.off;PREF.set('lyOff',LYR.off);apply()};
  $('#lyFold').onclick=toggle;$('#lyAdd').onclick=()=>{if(S.doc){addLayer();syncLayers()}};
  $('#lySplit').addEventListener('dblclick',toggle);
  document.addEventListener('keydown',e=>{if(e.key==='F7'){e.preventDefault();toggle()}});
  window.toggleLayersPanel=toggle;apply()})();
/* View menu entry */
(()=>{const mi=MENU2.view.items;MENU2.view.items=()=>{const a=mi();const i=a.findIndex(x=>x&&x.label&&/masque/i.test(x.label));a.splice(i<0?a.length:i+1,0,MI('Panneau Calques',{kbd:'F7',check:!LYR.off,fn:()=>window.toggleLayersPanel()}));return a}})();
