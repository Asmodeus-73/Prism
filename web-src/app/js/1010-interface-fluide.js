/* ================= 1.0: interface fluide (bureau) =================
   - les options de l'outil flottent dans une capsule au-dessus de la photo, avec les outils de la même famille côte à côte ;
     la capsule s'estompe pendant qu'on peint ;
   - la barre d'état disparaît : zoom et taille de l'image dans une pastille en bas de la photo, aide de l'outil dans une bulle
     qui s'efface seule ;
   - mode Focus : Tab (quand rien n'a le focus clavier) cache les outils et les panneaux.
   Sur téléphone (body.compact), rien ne bouge : la barre d'options et la mise en page d'origine restent. */
(()=>{const st=document.createElement('style');st.textContent=`
html body:not(.compact) #app{grid-template-rows:44px minmax(0,1fr)!important}
body:not(.compact) .work{transition:grid-template-columns .22s cubic-bezier(.2,.7,.2,1)}
body:not(.compact) #stage>.optbar{position:absolute;z-index:6;top:12px;left:0;right:0;margin:0 auto;width:max-content;max-width:calc(100% - 24px);height:40px;padding:0 6px;gap:8px;
  background:var(--raise,var(--chrome));border:1px solid var(--line);border-radius:12px;box-shadow:0 8px 24px rgba(20,20,40,.14),0 0 0 1px rgba(20,20,40,.04);transition:opacity .18s}
body:not(.compact) #stage>.optbar #pill{flex:0 1 auto}
body:not(.compact) #stage>.optbar:empty,body:not(.compact) #stage>.optbar.cap-none{display:none}
body.cap-dim:not(.compact) #stage>.optbar{opacity:.22;pointer-events:none}
.cap-fam{display:flex;gap:2px;padding:2px;border-radius:9px;background:var(--chrome-2);flex:none}
.cap-fam button{display:flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:0;border-radius:7px;background:none;color:var(--fg-2);font:500 12.5px var(--ui);cursor:pointer;white-space:nowrap}
.cap-fam button:hover{color:var(--fg);background:var(--hover)}
.cap-fam button[aria-pressed="true"]{background:var(--raise,#fff);color:var(--fg);box-shadow:var(--shadow-s,0 1px 3px rgba(0,0,0,.12))}
.cap-fam button:not([aria-pressed="true"]) span{display:none}
.cap-fam button:not([aria-pressed="true"]){padding:0 7px}
.cap-fam svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
body:not(.compact) #stage>.optbar.has-fam #optTool{display:none}
body:not(.compact) #stage>.statusbar{position:absolute;z-index:6;left:0;right:0;bottom:12px;height:0;padding:0;border:0;background:none;overflow:visible;pointer-events:none}
body:not(.compact) #stage>.statusbar>*{pointer-events:auto}
body:not(.compact) #stage>.statusbar .st-ver,body:not(.compact) #stage>.statusbar #status{display:none}
.cap-zoom{position:absolute;left:50%;bottom:0;transform:translateX(-50%);display:flex;align-items:center;gap:6px;height:34px;padding:0 6px;border-radius:10px;
  background:var(--raise,var(--chrome));border:1px solid var(--line);box-shadow:0 6px 18px rgba(20,20,40,.12);font:11.5px var(--num);color:var(--fg-2);white-space:nowrap}
.cap-zoom .zoom{display:flex;align-items:center;gap:2px}
.cap-zoom #stDoc{padding:0 6px 0 8px;border-left:1px solid var(--line);cursor:pointer}
.cap-zoom #stDoc span:not(:first-child){display:none}
body:not(.compact) #stage>.statusbar #w47hint{position:absolute;left:12px;bottom:0;max-width:min(420px,40%);padding:7px 11px;border-radius:9px;background:rgba(24,24,30,.86);color:#fff;
  font:12.5px var(--ui);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:opacity .4s;opacity:1}
body:not(.compact) #stage>.statusbar #w47hint.gone,body:not(.compact) #stage>.statusbar #w47hint:empty{opacity:0;pointer-events:none}
body:has(#toast:not([hidden])):not(.compact) #stage>.statusbar #w47hint{opacity:0}
body.focus:not(.compact) .work{grid-template-columns:0 minmax(0,1fr) 0!important}
body.focus:not(.compact) .work>.tools,body.focus:not(.compact) .work>.side{overflow:hidden;visibility:hidden}
body.focus:not(.compact) #stage>.optbar{display:none}
.focus-tip{position:absolute;z-index:7;left:50%;top:12px;transform:translateX(-50%);padding:7px 12px;border-radius:9px;background:rgba(24,24,30,.86);color:#fff;font:12.5px var(--ui);pointer-events:none;transition:opacity .5s}
.focus-tip.gone{opacity:0}
@media (prefers-reduced-motion:reduce){body:not(.compact) .work,body:not(.compact) #stage>.optbar,#w47hint,.focus-tip{transition:none!important}}
`;document.head.appendChild(st)})();
const UI10={};
/* ---- capsule et pastille : placées dans la zone photo sur ordinateur, remises en place sur téléphone ---- */
(()=>{const app=$('#app'),stage=$('#stage'),ob=$('#optbar'),sb=$('.statusbar'),work=$('.work');
  const zp=document.createElement('div');zp.className='cap-zoom';
  const place=()=>{const z=sb.querySelector('.zoom')||zp.querySelector('.zoom'),d=$('#stDoc');
    if(COMPACT.matches){if(ob.parentNode!==app)work.before(ob);if(sb.parentNode!==app)app.appendChild(sb);if(z&&z.parentNode!==sb){sb.appendChild(d);sb.appendChild(z)}zp.remove()}
    else{if(ob.parentNode!==stage)stage.appendChild(ob);if(sb.parentNode!==stage)stage.appendChild(sb);if(z&&z.parentNode!==zp){zp.appendChild(z);zp.appendChild(d)}if(zp.parentNode!==sb)sb.appendChild(zp)}
    requestAnimationFrame(()=>{try{resizeView();markContent()}catch(e){}})};
  COMPACT.addEventListener('change',place);const _al=applyLayout;applyLayout=function(){_al.apply(this,arguments);place()};place();
  /* la bulle d'aide s'efface après quelques secondes, et revient quand l'aide change */
  const hint=()=>$('#w47hint');let tm=0,last='';
  const show=()=>{const h=hint();if(!h)return;const t=h.textContent;if(t===last)return;last=t;h.classList.remove('gone');clearTimeout(tm);tm=setTimeout(()=>h.classList.add('gone'),4500)};
  let hq=0;new MutationObserver(()=>{if(!hq)hq=requestAnimationFrame(()=>{hq=0;show()})}).observe(sb,{subtree:true,childList:true,characterData:true});show();
  /* la capsule s'estompe pendant un tracé sur la photo */
  const v=$('#view');v.addEventListener('pointerdown',e=>{if(e.button===0&&!COMPACT.matches)document.body.classList.add('cap-dim')});
  const up=()=>document.body.classList.remove('cap-dim');['pointerup','pointercancel'].forEach(t=>window.addEventListener(t,up))})();
/* ---- les outils d'une même famille côte à côte dans la capsule ---- */
(()=>{const ob=$('#optbar');let fam=null;
  const paint=()=>{const W=typeof W47!=='undefined'?W47:null;if(!W||!W.STACKS)return;const id=S.tool;let head=null;
    for(const h in W.STACKS)if(h===id||W.STACKS[h].includes(id)){head=h;break}
    if(!head){if(fam){fam.remove();fam=null}ob.classList.remove('has-fam');return}
    const ids=[head,...W.STACKS[head]];
    if(!fam||fam.dataset.head!==head){if(fam)fam.remove();fam=document.createElement('div');fam.className='cap-fam';fam.dataset.head=head;fam.setAttribute('role','group');fam.setAttribute('aria-label','Outils de la même famille');
      fam.innerHTML=ids.map(t=>{const b=document.querySelector(`#dock [data-tool="${t}"]`),ic=b&&b.querySelector('svg');const nm=esc((W.NAMES&&W.NAMES[t])||t);return`<button type="button" data-ft="${t}" title="${nm}" aria-label="${nm}">${ic?ic.outerHTML:''}<span>${nm}</span></button>`}).join('');
      fam.addEventListener('click',e=>{const b=e.target.closest('[data-ft]');if(b)setTool(b.dataset.ft)});
      ob.insertBefore(fam,ob.firstChild)}
    fam.querySelectorAll('[data-ft]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.ft===id));ob.classList.add('has-fam')};
  const _st=setTool;setTool=function(t){const r=_st.apply(this,arguments);try{paint()}catch(e){console.warn('ui10 fam',e)}return r};
  UI10.paintFam=paint;requestAnimationFrame(paint)})();
/* ---- mode Focus ---- */
(()=>{let tip=null;
  const set=on=>{document.body.classList.toggle('focus',on);if(tip){tip.remove();tip=null}
    if(on){tip=document.createElement('div');tip.className='focus-tip';tip.textContent='Tab pour revenir aux panneaux';$('#stage').appendChild(tip);const t=tip;setTimeout(()=>t.classList.add('gone'),2200)}
    setTimeout(()=>{try{resizeView();markContent()}catch(e){}},240)};
  UI10.focus=()=>set(!document.body.classList.contains('focus'));
  window.addEventListener('keydown',e=>{if(e.key!=='Tab'||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||COMPACT.matches||!S.doc)return;
    const a=document.activeElement;if(a&&a!==document.body&&a.id!=='view')return;
    if($('#scrim:not(.light)')||$('#cmdk')||$('#library')||$('#msheet'))return;
    e.preventDefault();UI10.focus()});
  const mi=MENU2.view.items;MENU2.view.items=()=>{const a=mi();a.push(SEP,MI('Mode Focus',{kbd:'Tab',check:document.body.classList.contains('focus'),fn:UI10.focus}));return a}})();
