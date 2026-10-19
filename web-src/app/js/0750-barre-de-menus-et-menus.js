/* ===== wave29: barre de menus et menus déroulants plus soignés ===== */
(()=>{
const st=document.createElement('style');st.textContent=`
.bar{background:linear-gradient(180deg,var(--chrome-2),var(--chrome));border-bottom:1px solid var(--line);gap:16px}
.mark{gap:9px;padding:0 14px 0 4px;font:650 15.5px/1 var(--ui)}
.mark .logo{width:26px;height:26px;filter:drop-shadow(0 0 6px rgba(120,150,255,.28))}
.menubar{gap:2px}
.menubar>button{height:30px;padding:0 11px;border-radius:8px;font-size:13px;font-weight:500;color:var(--fg-2);transition:background .12s,color .12s}
.menubar>button:hover{background:var(--hover);color:var(--fg)}
.menubar>button.open,.menubar>button[aria-expanded="true"]{background:var(--accent-soft);color:var(--accent-fg)}
.docname{min-width:0;height:30px;border-radius:99px;padding:0 16px;background:var(--chrome);border-color:var(--line-2)}
body.no-doc .docname{font-weight:500}
#bCmd.cmd-pill{display:inline-flex!important;align-items:center;width:auto;width:156px;min-width:156px;height:30px;padding:0 8px 0 12px;gap:8px;border-radius:99px;border:1px solid var(--line-2);background:var(--chrome);color:var(--fg-3);justify-content:flex-start;font-size:12.5px}
#bCmd.cmd-pill:hover{border-color:var(--accent-line);color:var(--fg-2)}
#bCmd.cmd-pill svg{width:15px;height:15px;flex:none}
#bCmd.cmd-pill span{flex:1;text-align:left}
#bCmd.cmd-pill kbd{font:11px var(--num);padding:2px 6px;border-radius:5px;border:1px solid var(--line-2);color:var(--fg-3);background:var(--chrome-2)}
#bExport{border-radius:99px;padding:0 16px;font-weight:600;background:linear-gradient(180deg,#6a75ff,var(--accent));box-shadow:0 1px 0 rgba(255,255,255,.18) inset,0 4px 14px -4px rgba(91,103,240,.7)}
.menu{border-radius:12px;padding:6px;min-width:260px;background:color-mix(in srgb,var(--menu) 92%,transparent);backdrop-filter:blur(14px) saturate(1.2);-webkit-backdrop-filter:blur(14px) saturate(1.2);border-color:var(--line-2);box-shadow:0 18px 50px -12px rgba(0,0,0,.65),0 2px 8px rgba(0,0,0,.3)}
.mi{min-height:32px;border-radius:8px;padding:4px 10px 4px 8px;gap:11px}
.mi:hover,.mi:focus,.mi.sub-open{background:var(--accent-soft);color:var(--fg)}
.mi:hover .mi-i,.mi:focus .mi-i,.mi.sub-open .mi-i{color:var(--accent-fg);stroke:currentColor}
.mi:hover kbd,.mi:focus kbd{color:var(--fg-2)}
.mi:hover .mi-sub,.mi:focus .mi-sub,.mi.sub-open .mi-sub{stroke:var(--fg)}
.mi-i{width:20px;height:20px;border-radius:6px}
.mi kbd{margin-left:28px;font-size:11px;padding:1px 6px;border-radius:5px;background:var(--chrome-2);color:var(--fg-3)}
.msep{margin:5px 4px;background:var(--line)}
.mhead{letter-spacing:.06em;text-transform:uppercase;font-size:10.5px;color:var(--fg-3)}
.mi.danger:hover,.mi.danger:focus{background:rgba(255,80,80,.16);color:var(--danger)}
.mi.danger:hover .mi-i,.mi.danger:focus .mi-i{color:var(--danger)}
@media (max-width:1500px){.docname .dim,.docname .tag{display:none}}
`;document.head.appendChild(st);
const b=$('#bCmd');
if(b){b.classList.add('cmd-pill');b.insertAdjacentHTML('beforeend',`<span>Rechercher</span><kbd>${(typeof MOD!=='undefined'?MOD:'Ctrl ')}K</kbd>`)}
})();

