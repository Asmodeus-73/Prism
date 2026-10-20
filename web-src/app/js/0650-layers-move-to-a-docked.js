/* ================= v10: layers move to a docked drawer on the left of the photo ================= */
(()=>{const st=document.createElement('style');st.textContent=`
.lyr-dock{display:flex;flex-direction:column;min-height:0;min-width:0;background:var(--chrome);border-right:1px solid var(--line);position:relative;overflow:hidden}
body:not(.compact) .work{grid-template-columns:var(--toolw) var(--lyw,244px) minmax(0,1fr) var(--side)}
body:not(.compact) .work.ly-off{--lyw:34px}
body.compact .lyr-dock{display:none}
.lyr-dock .layers-panel{height:100%;border-top:0;display:flex;flex-direction:column;min-height:0}
.lyr-dock .layers-panel .pane{flex:1;min-height:0}
.lyr-dock .lyr-top{display:flex;align-items:center;justify-content:space-between;padding:8px 10px 6px 12px;font-size:12px;font-weight:600;color:var(--fg-2)}
.lyr-dock .lyr-top button{border:0;background:none;color:inherit;cursor:pointer;width:26px;height:26px;border-radius:6px}.lyr-dock .lyr-top button:hover{background:var(--hover)}
.lyr-dock .layers-panel>.ph{display:none}
.lyr-rail{display:none;flex-direction:column;align-items:center;gap:10px;padding:10px 0}
.work.ly-off .lyr-rail{display:flex}.work.ly-off .lyr-dock>:not(.lyr-rail){display:none}
.lyr-rail button{border:0;background:none;color:var(--fg-2);cursor:pointer;width:28px;height:28px;border-radius:6px}.lyr-rail button:hover{background:var(--hover);color:var(--fg)}
.lyr-rail span{writing-mode:vertical-rl;font-size:11.5px;font-weight:600;color:var(--fg-3);letter-spacing:.02em}
.lyr-grip{position:absolute;top:0;right:-3px;width:7px;height:100%;cursor:col-resize;z-index:5;touch-action:none}.lyr-grip:hover,.lyr-grip.on{background:var(--accent-line,#5b6cf055)}
.work.ly-off .lyr-grip{display:none}
.lyr-dock .lyrs li.lyr .th{width:56px}
`;document.head.appendChild(st)})();
const LYR={w:PREF.get('lyW',innerWidth<1500?216:244),off:PREF.get('lyOff',false)};
(()=>{const work=$('.work'),dock=document.createElement('aside');dock.id='lyrDock';dock.className='lyr-dock';dock.setAttribute('aria-label','Calques');
  dock.innerHTML=`<div class="lyr-top"><span>Calques</span><button id="lyHide" title="Replier le panneau Calques (F7)" aria-label="Replier le panneau Calques"><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5l-5 5 5 5"/></svg></button></div>
   <div class="lyr-rail"><button id="lyShow" title="Déplier le panneau Calques (F7)" aria-label="Déplier le panneau Calques"><svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3 17 6.8 10 10.6 3 6.8z"/><path d="M3 10.2l7 3.8 7-3.8M3 13.6l7 3.8 7-3.8"/></svg></button><span>Calques</span></div><div class="lyr-grip" id="lyrGrip" role="separator" aria-orientation="vertical" aria-label="Largeur du panneau Calques" tabindex="0"></div>`;
  $('#dock').after(dock);
  const apply=()=>{work.classList.toggle('ly-off',LYR.off);work.style.setProperty('--lyw',LYR.off?'34px':LYR.w+'px');requestAnimationFrame(()=>{try{resizeView();markContent()}catch(e){}})};
  const place=()=>{const lp=$('#layersPanel'),aside=$('.side');if(COMPACT.matches){if(lp.parentNode!==aside)aside.appendChild(lp);$('#lySplit').style.display=''}else{if(lp.parentNode!==dock)dock.insertBefore(lp,$('#lyrGrip'));$('#lySplit').style.display='none';lp.style.height=''}apply()};
  const _al=applyLayout;applyLayout=function(){_al.apply(this,arguments);place()};COMPACT.addEventListener('change',place);
  $('#lyHide').onclick=()=>{LYR.off=true;PREF.set('lyOff',true);apply()};$('#lyShow').onclick=()=>{LYR.off=false;PREF.set('lyOff',false);apply()};
  const g=$('#lyrGrip');let drag=null;g.addEventListener('pointerdown',e=>{drag={x:e.clientX,w:LYR.w};g.setPointerCapture(e.pointerId);g.classList.add('on')});
  g.addEventListener('pointermove',e=>{if(!drag)return;LYR.w=clamp(drag.w+e.clientX-drag.x,200,440);apply()});const gEnd=()=>{if(drag){drag=null;g.classList.remove('on');PREF.set('lyW',LYR.w)}};['pointerup','pointercancel','lostpointercapture'].forEach(t=>g.addEventListener(t,gEnd));
  g.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();LYR.w=clamp(LYR.w+(e.key==='ArrowRight'?16:-16),200,440);PREF.set('lyW',LYR.w);apply()}});
  document.addEventListener('keydown',e=>{if(e.key==='F7'){e.preventDefault();LYR.off=!LYR.off;PREF.set('lyOff',LYR.off);apply()}});
  place()})();
/* View menu entry */
(()=>{const mi=MENU2.view.items;MENU2.view.items=()=>{const a=mi();const i=a.findIndex(x=>x&&x.label&&/masque/i.test(x.label));a.splice(i<0?a.length:i+1,0,MI('Panneau Calques',{kbd:'F7',check:!LYR.off,fn:()=>$(LYR.off?'#lyShow':'#lyHide').click()}));return a}})();

