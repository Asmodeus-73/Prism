/* ================= v8.3: sliders ================= */
/* 1. double-click on the slider itself resets it, 2. click the value to type one, 3. eye button = see the photo without a group of adjustments */
(()=>{const pane=$('#pane-develop');
  pane.addEventListener('dblclick',e=>{const i=e.target.closest('input[type=range][data-k]');if(!i||!ADJ())return;e.stopImmediatePropagation();e.preventDefault();const k=i.dataset.k;clearMutes();setK(k,defK(k));syncDev();markContent();pushHistory('Réinitialiser '+labelFor(k).toLowerCase())},true);
  const edit=o=>{const row=o.closest('.row[data-k]');if(!row||o.querySelector('input'))return;const rg=row.querySelector('input[type=range]'),old=o.textContent;
    const t=document.createElement('input');t.type='text';t.inputMode='decimal';t.className='val-edit';t.value=String(+(+rg.value).toFixed(2));t.setAttribute('aria-label',`Valeur de ${row.querySelector('label').textContent}`);o.textContent='';o.appendChild(t);t.focus();t.select();let done=false;
    const fin=ok=>{if(done)return;done=true;if(ok){const v=parseFloat(t.value.replace(',','.').replace(/[^\d.+-]/g,''));if(isFinite(v)){clearMutes();rg.value=clamp(v,+rg.min,+rg.max);rg.dispatchEvent(new Event('input',{bubbles:true}));rg.dispatchEvent(new Event('change',{bubbles:true}))}else toast('Entrez un nombre')}o.textContent=old;outDev(row.dataset.k)};
    t.onkeydown=ev=>{ev.stopPropagation();if(ev.key==='Enter'){ev.preventDefault();fin(true)}else if(ev.key==='Escape'){ev.preventDefault();fin(false)}else if(ev.key==='ArrowUp'||ev.key==='ArrowDown'){ev.preventDefault();const st=+rg.step||1,cur=parseFloat(t.value.replace(',','.'))||0,m=ev.shiftKey?10:1;t.value=String(+(clamp(cur+(ev.key==='ArrowUp'?st:-st)*m,+rg.min,+rg.max)).toFixed(2))}};t.onblur=()=>fin(true)};
  pane.addEventListener('click',e=>{const o=e.target.closest('.row[data-k] output');if(o)edit(o)});
  pane.addEventListener('keydown',e=>{const o=e.target.closest&&e.target.closest('.row[data-k] output');if(o&&(e.key==='Enter'||e.key===' ')){e.preventDefault();edit(o)}});
  const mkOut=()=>$$('.row[data-k] output',pane).forEach(o=>{o.tabIndex=0;o.setAttribute('role','button');o.title='Cliquez pour saisir une valeur';});mkOut();
  /* mute a group */
  window.MUTE={};
  window.unmute=id=>{const m=MUTE[id];if(!m)return;delete MUTE[id];if(m.layer&&m.layer.dev)SEC_KEYS[id].forEach(k=>m.layer.dev[k]=m.vals[k]);setMuteUI(id,false)};
  window.clearMutes=()=>{const ids=Object.keys(MUTE);if(!ids.length)return false;ids.forEach(unmute);try{syncDev();markContent()}catch(e){}return true};
  const setMuteUI=(id,on)=>{const b=pane.querySelector(`[data-mute="${id}"]`);if(b){b.setAttribute('aria-pressed',on);b.classList.toggle('on',on);b.title=on?'Remettre ce groupe de réglages':'Voir la photo sans ce groupe de réglages'}const d=pane.querySelector(`[data-sec="${id}"]`);d&&d.classList.toggle('muted',on)};
  SECTIONS.forEach(s=>{if(!SEC_KEYS[s.id])return;const sm=pane.querySelector(`[data-sec="${s.id}"]>summary`);if(!sm)return;const b=document.createElement('button');b.type='button';b.className='eyeb';b.dataset.mute=s.id;b.setAttribute('aria-pressed','false');b.setAttribute('aria-label',`Voir la photo sans « ${s.title} »`);b.title='Voir la photo sans ce groupe de réglages';
    b.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10z"/><circle cx="10" cy="10" r="2.5"/></svg>';sm.insertBefore(b,sm.querySelector('.rs'))});
  pane.addEventListener('click',e=>{const b=e.target.closest('[data-mute]');if(!b){/* any other change puts the muted values back first */if(e.target.closest('[data-reset],[data-p],#btnAuto,#btnResetAll'))clearMutes();return}
    e.preventDefault();e.stopPropagation();const A=ADJ();if(!A)return;const id=b.dataset.mute;if(MUTE[id]){unmute(id);syncDev();markContent();return}
    const z=DEV0(),vals={};SEC_KEYS[id].forEach(k=>{vals[k]=JSON.parse(JSON.stringify(A.dev[k]));A.dev[k]=JSON.parse(JSON.stringify(z[k]))});MUTE[id]={layer:A,vals};setMuteUI(id,true);syncDev();markContent()},true);
  pane.addEventListener('input',e=>{const i=e.target;if(i.dataset&&i.dataset.k){const sec=Object.keys(SEC_KEYS).find(s=>SEC_KEYS[s].includes(i.dataset.k.split('.')[0]));if(sec&&MUTE[sec]){unmute(sec)}}},true);
  /* never let a muted group leak into history, a saved project or an export */
})();
const _ph11=pushHistory;pushHistory=function(l){clearMutes();return _ph11(l)};
const _rs11=restore;restore=function(i){clearMutes();return _rs11(i)};
const _rd11=renderDoc;renderDoc=function(...a){clearMutes();return _rd11(...a)};
const _rd16=renderDoc16;renderDoc16=function(...a){clearMutes();return _rd16(...a)};
const _sn11=saveNow;saveNow=function(...a){if(Object.keys(MUTE).length){setTimeout(()=>saveNow(...a),1500);return Promise.resolve()}return _sn11(...a)};
const _sd11=syncDev;syncDev=function(){/* a muted group belongs to one layer */for(const id of Object.keys(MUTE)){if(MUTE[id].layer!==(S.doc&&AL()))unmute(id)}_sd11()};

