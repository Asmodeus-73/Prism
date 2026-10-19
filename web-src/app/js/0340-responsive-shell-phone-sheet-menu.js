/* ================= responsive shell: phone sheet + menu sheet ================= */
const SHEET={state:'peek'};
function setSheet(st){SHEET.state=st;document.body.dataset.sheet=st;const ins=$('.insp');if(ins)ins.dataset.sheet=st;S.contentDirty=true;requestRender()}
function openMenuSheet(btn){closeMenu();const p=document.createElement('div');p.className='pop sheetmenu';p.id='pop';p.setAttribute('role','menu');
  const names={file:'Fichier',edit:'Édition',image:'Image',layer:'Calque',select:'Sélection',filter:'Filtre',view:'Affichage'};
  for(const [k,label] of Object.entries(names)){const h=document.createElement('div');h.className='pop-h';h.textContent=label;p.appendChild(h);
    MENUS[k]().forEach(it=>{if(!it)return;const b=document.createElement('button');b.setAttribute('role','menuitem');b.innerHTML=`<span>${esc(it[0])}</span><kbd>${esc(it[1])}</kbd>`;if(it[3])b.disabled=true;b.onclick=()=>{closeMenu();it[2]()};p.appendChild(b)})}
  document.body.appendChild(p);const r=btn.getBoundingClientRect();p.style.left='8px';p.style.right='8px';p.style.top=(r.bottom+4)+'px';btn.classList.add('open')}

