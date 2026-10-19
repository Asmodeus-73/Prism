/* ================= Imprimer : la photo seule, au format de papier choisi ================= */
/* The page lays out one sheet (#printSheet) and hides everything else for printing; the desktop app opens the system
   print dialog itself (print_page), the browser through window.print(). */
const PAPERS=[['a4','A4',210,297],['a3','A3',297,420],['a5','A5',148,210],['letter','Lettre US',215.9,279.4],['10x15','10 × 15 cm',100,150],['13x18','13 × 18 cm',130,180],['20x30','20 × 30 cm',200,300]];
const PR={el:null,url:null};
function sheetSize(o,d){const P=PAPERS.find(x=>x[0]===o.paper)||PAPERS[0];let w=P[2],h=P[3];if((d.w>d.h)!==(w>h))[w,h]=[h,w];return{w,h}}
/* size of the photo on the page (mm) and the resolution it prints at */
function layout(o,d){const pg=sheetSize(o,d),aw=pg.w-2*o.margin,ah=pg.h-2*o.margin,k=o.fit==='fill'?Math.max(aw/d.w,ah/d.h):Math.min(aw/d.w,ah/d.h);
  return{pg,iw:d.w*k,ih:d.h*k,aw,ah,dpi:Math.round(25.4/k)}}
function cleanup(){if(PR.el){PR.el.remove();PR.el=null}if(PR.url){URL.revokeObjectURL(PR.url);PR.url=null}}
async function doPrint(o){const d=S.doc;if(!d)return;busy(true,'Préparation de l’impression…',null);await tick();
  try{cleanup();const c=await renderDoc(1),w=mk(c.width,c.height),g=cx(w);g.fillStyle='#fff';g.fillRect(0,0,w.width,w.height);g.drawImage(c,0,0);
    const blob=await new Promise(r=>w.toBlob(r,'image/jpeg',0.95));PR.url=URL.createObjectURL(blob);
    const L=layout(o,d),el=document.createElement('div');el.id='printSheet';
    el.innerHTML=`<style>@page{size:${L.pg.w}mm ${L.pg.h}mm;margin:0}@media print{html,body{background:#fff!important;margin:0!important}body>*:not(#printSheet){display:none!important}#printSheet{display:block!important}}
      #printSheet{display:none;width:${L.pg.w}mm;height:${L.pg.h}mm;overflow:hidden;position:relative;break-after:avoid}
      #printSheet .pa{position:absolute;left:${o.margin}mm;top:${o.margin}mm;width:${L.aw}mm;height:${L.ah}mm;overflow:hidden;display:flex;align-items:center;justify-content:center}
      #printSheet img{width:${L.iw}mm;height:${L.ih}mm;flex:none;max-width:none}</style><div class="pa"><img alt=""></div>`;
    const img=el.querySelector('img');await new Promise((res,rej)=>{img.onload=res;img.onerror=()=>rej(new Error('image'));img.src=PR.url});
    document.body.appendChild(el);PR.el=el;busy(false);
    addEventListener('afterprint',cleanup,{once:true});
    const D=window.PRISM_DESKTOP;if(D&&D.invoke)await D.invoke('print_page');else window.print();
    setTimeout(()=>{if(PR.el===el&&!matchMedia('print').matches)cleanup()},60000)}
  catch(e){busy(false);cleanup();console.error(e);toast('Impression impossible : '+(e.message||e),5000)}}
function printDialog(){const d=S.doc;if(!d)return;const o={paper:PREF.get('prPaper','a4'),margin:+PREF.get('prMargin',10),fit:PREF.get('prFit','fit')};
  const sel=(id,opts,v)=>`<select id="${id}">${opts.map(([k,t])=>`<option value="${k}"${String(k)===String(v)?' selected':''}>${t}</option>`).join('')}</select>`;
  dialog({title:'Imprimer',light:true,body:`<label class="field">Papier${sel('prP',PAPERS.map(p=>[p[0],p[1]]),o.paper)}</label>
    <label class="field">Marges${sel('prM',[[0,'Aucune'],[5,'5 mm'],[10,'10 mm'],[15,'15 mm'],[20,'20 mm']],o.margin)}</label>
    <label class="field">Photo${sel('prF',[['fit','Entière dans la page'],['fill','Remplir la page (bords coupés)']],o.fit)}</label>
    <p class="muted" id="prInfo" style="margin:8px 0 0;font-size:12px"></p>`,
    buttons:[{label:'Annuler'},{label:'Imprimer…',primary:true,onClick:el=>{const v={paper:$('#prP',el).value,margin:+$('#prM',el).value,fit:$('#prF',el).value};PREF.set('prPaper',v.paper);PREF.set('prMargin',v.margin);PREF.set('prFit',v.fit);setTimeout(()=>doPrint(v),30)}}],
    onOpen:el=>{const upd=()=>{const L=layout({paper:$('#prP',el).value,margin:+$('#prM',el).value,fit:$('#prF',el).value},d);
        $('#prInfo',el).textContent=`Photo imprimée à ${(L.iw/10).toFixed(1).replace('.',',')} × ${(L.ih/10).toFixed(1).replace('.',',')} cm, ${L.dpi} pixels par pouce${L.dpi<150?' : un peu juste, l’agrandissement IA aidera':''}.`};
      el.querySelectorAll('select').forEach(s=>s.onchange=upd);upd()}})}
const _fim=MENU2.file.items;
MENU2.file.items=function(){const a=_fim.apply(this,arguments),it=MI('Imprimer…',{icon:'export',kbd:MOD+'P',fn:printDialog,dis:S.doc?false:NODOC});
  const k=a.findIndex(x=>x&&x.label==='Exporter…');a.splice(k<0?a.length:k+1,0,it);return a};
addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&!e.shiftKey&&!e.altKey&&e.key.toLowerCase()==='p'&&S.doc&&!e.target.closest('input,textarea,[contenteditable]')){e.preventDefault();printDialog()}},true);
window.PrismPrint={dialog:printDialog,layout};
