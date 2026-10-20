/* ================= v9: editable text, shapes, layer styles, groups, linked layers ================= */
const MEDIT=l=>!!(l&&(l.txt||l.shp));
const clone=o=>o==null?o:JSON.parse(JSON.stringify(o));
(()=>{const st=document.createElement('style');st.textContent=`
.lyrs li.grp{display:flex;align-items:center;gap:6px;padding:4px 8px;font-size:12px;font-weight:600;color:var(--text-2,#888);cursor:pointer;user-select:none}
.lyrs li.grp .gtw{width:20px;height:20px;padding:0;background:none;border:0;color:inherit;font-size:11px;cursor:pointer}
.lyrs li.grp .gc{margin-left:auto;font-weight:400;opacity:.7}
.lyrs li.ingrp{margin-left:14px;border-left:2px solid var(--line,#8884)}
.lyrs li.ms{box-shadow:inset 0 0 0 2px var(--accent,#5b6cf0)}
.ltag{font-style:normal;font-size:10px;font-weight:700;border:1px solid currentColor;border-radius:4px;padding:0 4px;margin-right:6px;opacity:.7}
.dlg-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;align-items:center}
.dlg-grid label{display:flex;flex-direction:column;gap:3px;font-size:12px}
.dlg-grid input[type=number],.dlg-grid select{width:100%}
.seg-mini{display:inline-flex;border:1px solid var(--line,#8886);border-radius:8px;overflow:hidden}
.seg-mini button{border:0;background:none;padding:6px 10px;cursor:pointer;color:inherit}
.seg-mini button.on{background:var(--accent,#5b6cf0);color:#fff}
`;document.head.appendChild(st)})();

/* ---------- persistence ---------- */
const XKEYS=['txt','shp','fx','grp','link'];
const xtra=L=>{const e={};XKEYS.forEach(k=>{if(L[k]!=null)e[k]=clone(L[k])});return e};

/* ---------- text ---------- */
const FONTS=['Geist','Newsreader','Playfair Display','Bebas Neue','Caveat','Geist Mono','Georgia','Arial','Verdana','Trebuchet MS','Times New Roman','Courier New','Impact'];
const fontOf=t=>`${t.italic?'italic ':''}${t.bold?'700':'400'} ${t.size}px "${t.font}", sans-serif`;
const tMeas=(g,s,t)=>{if(!t.track)return g.measureText(s).width;let w=0;for(const ch of s)w+=g.measureText(ch).width+t.track;return Math.max(0,w-t.track)};
function textLines(g,t){const raw=t.text.split('\n');if(!t.boxW)return raw;const out=[];for(const ln of raw){let cur='';for(const w of ln.split(' ')){const test=cur?cur+' '+w:w;if(cur&&tMeas(g,test,t)>t.boxW){out.push(cur);cur=w}else cur=test}out.push(cur)}return out}
function drawTextTo(c,t){const g=cx(c);g.clearRect(0,0,c.width,c.height);g.font=fontOf(t);g.textBaseline='top';g.lineJoin='round';g.miterLimit=2;const lines=textLines(g,t),lh=t.size*t.lh,ws=lines.map(l=>tMeas(g,l,t)),bw=t.boxW||Math.max(1,...ws);
  lines.forEach((ln,i)=>{const off=t.align==='center'?(bw-ws[i])/2:t.align==='right'?bw-ws[i]:0,x=t.x+off,y=t.y+i*lh;
    const run=fn=>{if(!t.track)fn(ln,x,y);else{let p=x;for(const ch of ln){fn(ch,p,y);p+=g.measureText(ch).width+t.track}}};
    if(t.sw>0){g.lineWidth=t.sw*2;g.strokeStyle=t.sc;run((s,a,b)=>g.strokeText(s,a,b))}g.fillStyle=t.color;run((s,a,b)=>g.fillText(s,a,b))});
  return[t.x-t.sw,t.y-t.sw,bw+t.sw*2,lines.length*lh+t.sw*2]}
async function loadFont(t){try{await document.fonts.load(fontOf(t),t.text||'A')}catch(e){}}
const PV=new Map();const pvCanvas=(L)=>{const d=S.doc;let c=PV.get(L.id);if(!c||c.width!==d.w||c.height!==d.h){c=mk(d.w,d.h);PV.set(L.id,c)}return c};
function livePreview(L){const d=S.doc;if(L.txt){const bb=drawTextTo(pvCanvas(L),L.txt);L.txt=Object.assign({},L.txt,{bbox:bb})}else if(L.shp){drawShapeTo(pvCanvas(L),L.shp)}L.preview=pvCanvas(L);markComp()}
function finalizeMeta(L){const d=S.doc,c=mk(d.w,d.h);if(L.txt){const bb=drawTextTo(c,L.txt);L.txt=Object.assign({},L.txt,{bbox:bb})}else if(L.shp)drawShapeTo(c,L.shp);L.canvas=c;delete L.preview;PV.delete(L.id)}
const inBox=(b,p)=>b&&p.x>=b[0]-6&&p.x<=b[0]+b[2]+6&&p.y>=b[1]-6&&p.y<=b[1]+b[3]+6;
const nameOfText=t=>'Texte : '+((t.text.split('\n')[0]||'').slice(0,18)||'…');
function rRow(id,label,min,max,step,val,unit){return rangeRow(id,label,min,max,step,val,unit)}
async function textEdit(L,isNew){const d=S.doc,o=S.opts.text,orig={txt:L.txt,canvas:L.canvas,name:L.name,fx:L.fx};let t={...L.txt};let fin=false,cancel=null;
  const ctl=el=>{const g=id=>$('#'+id,el);t={...t,text:g('tTxt').value,font:g('tFont').value,color:g('tCol').value,bold:g('tB').classList.contains('on'),italic:g('tI').classList.contains('on'),align:el.querySelector('[data-al].on').dataset.al,size:+g('tSize').value,lh:+g('tLh').value/100,track:+g('tTr').value,boxW:+g('tBox').value,sw:+g('tSw').value,sc:g('tSc').value};
    g('tSize-o').textContent=t.size+' px';g('tLh-o').textContent=t.lh.toFixed(2);g('tTr-o').textContent=t.track+' px';g('tBox-o').textContent=t.boxW?t.boxW+' px':'auto';g('tSw-o').textContent=t.sw+' px'};
  const upd=async el=>{ctl(el);L.txt=t;L.name=keepName(L,nameOfText(t),/^Texte( :|$)/);await loadFont(t);if(fin)return;livePreview(L)};
  const maxW=Math.max(200,d.w);
  dialog({title:isNew?'Nouveau texte':'Modifier le texte',light:true,body:`<label class="field">Texte<textarea id="tTxt" rows="3">${esc(t.text)}</textarea></label>
    <div class="inline" style="gap:8px;flex-wrap:wrap"><select id="tFont" aria-label="Police">${FONTS.map(f=>`<option ${f===t.font?'selected':''}>${f}</option>`).join('')}</select><input type="color" class="swatch" id="tCol" value="${esc(t.color)}" aria-label="Couleur du texte">
    <span class="seg-mini"><button type="button" id="tB" class="${t.bold?'on':''}" aria-label="Gras"><b>G</b></button><button type="button" id="tI" class="${t.italic?'on':''}" aria-label="Italique"><i>I</i></button></span>
    <span class="seg-mini" role="group" aria-label="Alignement">${[['left','Gauche'],['center','Centré'],['right','Droite']].map(([v,l])=>`<button type="button" data-al="${v}" class="${t.align===v?'on':''}">${l}</button>`).join('')}</span></div>
    ${rRow('tSize','Taille',8,Math.max(300,Math.round(d.h/2)),1,t.size,' px')}${rRow('tLh','Interligne',60,250,1,Math.round(t.lh*100),'')}${rRow('tTr','Espacement des lettres',-10,60,1,t.track,' px')}${rRow('tBox','Largeur du bloc (0 = libre)',0,maxW,10,t.boxW,' px')}
    <div class="dlg-grid"><label>Contour : épaisseur${rRow('tSw','',0,40,1,t.sw,' px')}</label><label>Couleur du contour<input type="color" class="swatch" id="tSc" value="${esc(t.sc)}"></label></div>
    <p class="muted">Ombre, lueur et contour extérieur : Calque > Styles de calque. Déplacez le texte avec l’outil Déplacement (V). Pour le modifier plus tard, cliquez dessus avec l’outil Texte (T).</p>`,
    onOpen:el=>{const go=()=>upd(el);el.addEventListener('input',go);el.addEventListener('change',go);
      ['tB','tI'].forEach(id=>$('#'+id,el).addEventListener('click',e=>{e.currentTarget.classList.toggle('on');go()}));
      el.querySelectorAll('[data-al]').forEach(b=>b.addEventListener('click',()=>{el.querySelectorAll('[data-al]').forEach(x=>x.classList.toggle('on',x===b));go()}));
      go();setTimeout(()=>{const a=$('#tTxt',el);a.focus();if(isNew)a.select()},30)},
    buttons:[{label:'Annuler',onClick:cancel=()=>{fin=true;if(isNew){const i=d.layers.indexOf(L);if(i>=0){d.layers.splice(i,1);d.active=Math.max(0,Math.min(d.active-1,d.layers.length-1))}}else{L.txt=orig.txt;L.name=orig.name}delete L.preview;PV.delete(L.id);markComp();syncAll()}},
      {label:isNew?'Ajouter le texte':'Appliquer',primary:true,onClick:async()=>{if(!d.layers.includes(L)||S.doc!==d){cancel();return}fin=true;ctl(document);await loadFont(t);L.txt=t;L.name=keepName(L,nameOfText(t),/^Texte( :|$)/);finalizeMeta(L);Object.assign(o,{font:t.font,size:t.size,bold:t.bold,italic:t.italic});markComp();pushHistory(isNew?'Texte':'Modifier le texte');syncAll()}}]})}
textAt=async function(p){const prev=$('#scrim');if(prev&&prev._cancel)prev._cancel();const d=S.doc,o=S.opts.text;
  const hit=[...d.layers].reverse().find(l=>l.txt&&l.visible!==false&&inBox(l.txt.bbox,p));if(hit){d.active=d.layers.indexOf(hit);syncAll();return textEdit(hit,false)}
  const L=newPixel('Texte',mk(d.w,d.h));L.txt={text:'Votre texte',font:o.font,size:o.size,bold:o.bold,italic:o.italic,color:S.color,align:'left',lh:1.15,track:0,boxW:0,sw:0,sc:'#000000',x:Math.round(p.x),y:Math.round(p.y)};
  if(o.shadow)L.fx={shadow:{on:true,color:'#000000',op:.45,blur:Math.round(o.size*.12),dx:0,dy:Math.round(o.size*.04)}};
  d.layers.splice(d.active+1,0,L);d.active++;return textEdit(L,true)};

/* ---------- shapes ---------- */
S.opts.shape={type:'rect',useFill:true,fill:'#e8574a',useStroke:false,stroke:'#ffffff',sw:8,r:40,n:5};
const SHAPES=[['rect','Rectangle'],['round','Rect. arrondi'],['ellipse','Ellipse'],['line','Ligne'],['arrow','Flèche'],['poly','Polygone'],['star','Étoile']];
function shapePath(g,s){const x0=Math.min(s.x,s.x+s.w),y0=Math.min(s.y,s.y+s.h),w=Math.abs(s.w),h=Math.abs(s.h),cxm=x0+w/2,cym=y0+h/2;g.beginPath();
  if(s.type==='rect')g.rect(x0,y0,w,h);
  else if(s.type==='round'){const r=Math.min(s.r,w/2,h/2);g.roundRect?g.roundRect(x0,y0,w,h,r):g.rect(x0,y0,w,h)}
  else if(s.type==='ellipse')g.ellipse(cxm,cym,Math.max(w/2,.01),Math.max(h/2,.01),0,0,7);
  else if(s.type==='line'||s.type==='arrow'){g.moveTo(s.x,s.y);g.lineTo(s.x+s.w,s.y+s.h)}
  else{const n=Math.max(3,s.n|0),pts=s.type==='star'?n*2:n;for(let i=0;i<pts;i++){const a=-Math.PI/2+i*2*Math.PI/pts,k=s.type==='star'&&i%2?0.45:1,px=cxm+Math.cos(a)*w/2*k,py=cym+Math.sin(a)*h/2*k;i?g.lineTo(px,py):g.moveTo(px,py)}g.closePath()}}
function drawShapeTo(c,s){const g=cx(c);g.clearRect(0,0,c.width,c.height);g.lineJoin='round';g.lineCap='round';const line=s.type==='line'||s.type==='arrow';
  if(s.type==='arrow'){const a=Math.atan2(s.h,s.w),hl=Math.max(14,s.sw*4),ex=s.x+s.w,ey=s.y+s.h;g.strokeStyle=s.stroke||s.fill;g.lineWidth=Math.max(1,s.sw);g.beginPath();g.moveTo(s.x,s.y);g.lineTo(ex-Math.cos(a)*hl*.6,ey-Math.sin(a)*hl*.6);g.stroke();g.fillStyle=s.stroke||s.fill;g.beginPath();g.moveTo(ex,ey);g.lineTo(ex-Math.cos(a-.45)*hl,ey-Math.sin(a-.45)*hl);g.lineTo(ex-Math.cos(a+.45)*hl,ey-Math.sin(a+.45)*hl);g.closePath();g.fill();return}
  shapePath(g,s);if(!line&&s.fill){g.fillStyle=s.fill;g.fill()}if((s.stroke&&s.sw>0)||line){g.strokeStyle=s.stroke||s.fill||'#fff';g.lineWidth=Math.max(1,s.sw);g.stroke()}}
const shapeName=s=>'Forme : '+(SHAPES.find(x=>x[0]===s.type)||[0,'forme'])[1];
function shapeFromOpts(x0,y0,x1,y1,shift){const o=S.opts.shape;let w=x1-x0,h=y1-y0;if(shift&&o.type!=='line'&&o.type!=='arrow'){const m=Math.max(Math.abs(w),Math.abs(h));w=Math.sign(w||1)*m;h=Math.sign(h||1)*m}else if(shift){const a=Math.round(Math.atan2(h,w)/(Math.PI/4))*Math.PI/4,l=Math.hypot(w,h);w=Math.cos(a)*l;h=Math.sin(a)*l}
  const line=o.type==='line'||o.type==='arrow';return{type:o.type,x:Math.round(x0),y:Math.round(y0),w:Math.round(w),h:Math.round(h),fill:line?null:(o.useFill?o.fill:null),stroke:line?o.fill:(o.useStroke?o.stroke:null),sw:o.sw,r:o.r,n:o.n}}
const _onDown13=onDown;onDown=function(e,p){if(S.tool==='shape'&&e.button!==1&&!S.spaceDown&&!S.wbPick){S.drag={type:'shape',x0:p.x,y0:p.y,L:null,shift:e.shiftKey};return}
  if(S.tool==='move'&&e.button!==1&&!S.spaceDown){_onDown13(e,p);const dr=S.drag;if(dr&&dr.type==='move'&&dr.L&&dr.L.link){const d=S.doc;dr.mates=d.layers.filter(l=>l!==dr.L&&l.link===dr.L.link&&l.kind==='pixel'&&l.visible!==false)}return}_onDown13(e,p)};
const _onMove13=onMove;onMove=function(e,p){const dr=S.drag;if(dr&&dr.type==='shape'){const d=S.doc;if(!dr.L){if(Math.hypot(p.x-dr.x0,p.y-dr.y0)*S.zoom<4)return;const L=newPixel('Forme',mk(d.w,d.h));dr.L=L;d.layers.splice(d.active+1,0,L);d.active++;syncAll()}
    const s=shapeFromOpts(dr.x0,dr.y0,p.x,p.y,e.shiftKey);dr.L.shp=s;dr.L.name=shapeName(s);livePreview(dr.L);return}
  _onMove13(e,p);if(dr&&dr.type==='move'&&dr.mates)dr.mates.forEach(m=>{m.dx=dr.L.dx;m.dy=dr.L.dy})};
function bakeMove(L,dx,dy){const d=S.doc;L.dx=0;L.dy=0;if(!(dx||dy))return;
  if(L.txt){L.txt={...L.txt,x:L.txt.x+dx,y:L.txt.y+dy};finalizeMeta(L);return}
  if(L.shp){L.shp={...L.shp,x:L.shp.x+dx,y:L.shp.y+dy};finalizeMeta(L);return}
  const c=mk(d.w,d.h);cx(c).drawImage(L.canvas,dx,dy);const e=effHi(L);L.canvas=c;if(L.hi)hiXform(L,e,d.w,d.h,d.w,d.h,new DOMMatrix().translate(dx,dy));if(L.mask){const m=mk(d.w,d.h);cx(m).drawImage(L.mask,dx,dy);L.mask=m}}
const _onUp13=onUp;onUp=function(e){const dr=S.drag;
  if(dr&&dr.type==='shape'){S.drag=null;const L=dr.L;if(L){finalizeMeta(L);markComp();pushHistory('Forme');syncAll()}return}
  if(dr&&dr.type==='move'&&(MEDIT(dr.L)||(dr.mates&&dr.mates.length))){S.drag=null;const L=dr.L,dx=L.dx||0,dy=L.dy||0;[L,...(dr.mates||[])].forEach(l=>bakeMove(l,dx,dy));markComp();if(dx||dy)pushHistory('Déplacement');return}
  _onUp13(e)};
{const d=TOOLS.findIndex(t=>t&&t[0]==='text');TOOLS.splice(d+1,0,['shape','Formes','U']);IC.shape='<rect x="3.5" y="9" width="8" height="7.5" rx="1"/><circle cx="13" cy="7" r="4"/>';KEYTOOLS.u='shape';
  const tb=$('#dock [data-tool="text"]'),b=document.createElement('button');b.className=tb.className;b.dataset.tool='shape';b.title='Formes (U)';b.setAttribute('aria-label','Formes');b.innerHTML=`<svg viewBox="0 0 20 20">${IC.shape}</svg>`;tb.after(b);TOOL_HELP.shape='Dessine un rectangle, une ellipse, une ligne, une flèche, un polygone ou une étoile. Maj garde les proportions.'}
const _renderPill13=renderPill;renderPill=function(){_renderPill13();if(S.tool!=='shape')return;const o=S.opts.shape,ob=$('#pill'),A=AL(),line=o.type==='line'||o.type==='arrow';
  ob.insertAdjacentHTML('beforeend',`<label>Forme<select id="shT">${SHAPES.map(([v,l])=>`<option value="${v}" ${o.type===v?'selected':''}>${l}</option>`).join('')}</select></label>
   ${line?'':`<label><input type="checkbox" id="shUF" ${o.useFill?'checked':''}> Remplissage</label>`}<input type="color" class="swatch" id="shF" value="${esc(o.fill)}" aria-label="${line?'Couleur du trait':'Couleur de remplissage'}">
   ${line?'':`<label><input type="checkbox" id="shUS" ${o.useStroke?'checked':''}> Contour</label><input type="color" class="swatch" id="shS" value="${esc(o.stroke)}" aria-label="Couleur du contour">`}
   <label>Épaisseur<input type="range" id="shW" min="1" max="80" value="${o.sw}"><span class="val">${o.sw}</span></label>
   ${o.type==='round'?`<label>Arrondi<input type="range" id="shR" min="0" max="300" value="${o.r}"><span class="val">${o.r}</span></label>`:''}${o.type==='poly'||o.type==='star'?`<label>Branches<input type="range" id="shN" min="3" max="12" value="${o.n}"><span class="val">${o.n}</span></label>`:''}
   ${MEDIT(A)&&A.shp?'<button class="btn sm" id="shEdit">Modifier la forme sélectionnée…</button>':'<span class="hint">Glissez sur la photo pour dessiner.</span>'}`);
  const apply=(k,v,reflow)=>{o[k]=v;const L=AL();if(L&&L.shp){const s={...L.shp};if(k==='useFill')s.fill=v?o.fill:null;else if(k==='fill'){if(L.shp.type==='line'||L.shp.type==='arrow')s.stroke=v;else if(L.shp.fill)s.fill=v}else if(k==='useStroke')s.stroke=v?o.stroke:null;else if(k==='stroke'){if(L.shp.stroke)s.stroke=v}else if(k==='type')s.type=v;else s[k]=v;L.shp=s;L.name=keepName(L,shapeName(s),/^Forme( :|$)/);finalizeMeta(L);markComp();pushHistory('Style de la forme');syncLayers()}if(reflow)renderPill()};
  const on=(id,fn,ev='change')=>{const e=$('#'+id);e&&e.addEventListener(ev,()=>fn(e))};
  on('shT',e=>apply('type',e.value,true));on('shUF',e=>apply('useFill',e.checked));on('shF',e=>apply('fill',e.value));on('shUS',e=>apply('useStroke',e.checked));on('shS',e=>apply('stroke',e.value));on('shW',e=>apply('sw',+e.value));on('shR',e=>apply('r',+e.value));on('shN',e=>apply('n',+e.value));
  ['shW','shR','shN'].forEach(id=>on(id,e=>{e.nextElementSibling.textContent=e.value},'input'));on('shEdit',()=>shapeEdit(AL()),'click')};
function shapeEdit(L){if(!L||!L.shp)return;const d=S.doc,orig=L.shp;let s={...L.shp},fin=false;const line=s.type==='line'||s.type==='arrow';
  const rd=el=>{const g=id=>$('#'+id,el);s={...s,type:g('seT').value,x:+g('seX').value,y:+g('seY').value,w:+g('seW').value,h:+g('seH').value,fill:g('seUF').checked?g('seF').value:null,stroke:g('seUS').checked?g('seS').value:null,sw:+g('seSw').value,r:+g('seR').value,n:+g('seN').value};if(s.type==='line'||s.type==='arrow'){s.fill=null;s.stroke=g('seS').value}};
  dialog({title:'Modifier la forme',light:true,body:`<div class="dlg-grid"><label>Forme<select id="seT">${SHAPES.map(([v,l])=>`<option value="${v}" ${s.type===v?'selected':''}>${l}</option>`).join('')}</select></label><span></span>
   <label>X<input type="number" id="seX" value="${s.x}"></label><label>Y<input type="number" id="seY" value="${s.y}"></label><label>Largeur<input type="number" id="seW" value="${s.w}"></label><label>Hauteur<input type="number" id="seH" value="${s.h}"></label>
   <label><span><input type="checkbox" id="seUF" ${s.fill?'checked':''}> Remplissage</span><input type="color" class="swatch" id="seF" value="${esc(s.fill||S.opts.shape.fill)}"></label><label><span><input type="checkbox" id="seUS" ${s.stroke?'checked':''}> Contour ou trait</span><input type="color" class="swatch" id="seS" value="${esc(s.stroke||'#ffffff')}"></label>
   <label>Épaisseur<input type="number" id="seSw" min="0" value="${s.sw}"></label><label>Arrondi<input type="number" id="seR" min="0" value="${s.r}"></label><label>Branches<input type="number" id="seN" min="3" max="24" value="${s.n}"></label></div>`,
   onOpen:el=>{const go=()=>{rd(el);L.shp=s;L.name=keepName(L,shapeName(s),/^Forme( :|$)/);if(!fin)livePreview(L)};el.addEventListener('input',go);el.addEventListener('change',go)},
   buttons:[{label:'Annuler',onClick:()=>{fin=true;L.shp=orig;L.name=shapeName(orig);delete L.preview;PV.delete(L.id);markComp();syncAll()}},{label:'Appliquer',primary:true,onClick:()=>{fin=true;if(S.doc!==d||!d.layers.includes(L))return;rd(document);L.shp=s;L.name=keepName(L,shapeName(s),/^Forme( :|$)/);finalizeMeta(L);markComp();pushHistory('Modifier la forme');syncAll()}}]})}

/* ---------- layer styles (shadow, outer stroke, glow) ---------- */
const FXD=()=>({shadow:{on:false,color:'#000000',op:.5,blur:18,dx:6,dy:8},stroke:{on:false,color:'#ffffff',w:6},glow:{on:false,color:'#ffd27a',op:.8,blur:24}});
const fxOn=f=>!!(f&&((f.shadow&&f.shadow.on)||(f.stroke&&f.stroke.on)||(f.glow&&f.glow.on)));
const FXC=new WeakMap();
/* tools that paint in place (dodge, smudge, liquify) keep the same canvas: a content version invalidates its styled cache */
const _mcFx=markComp;markComp=function(){const st=S.stroke,dr=S.drag,c=(st&&st.ctx&&st.ctx.canvas)||(dr&&dr.ctx&&dr.ctx.canvas);if(c)c._v=(c._v|0)+1;return _mcFx.apply(this,arguments)};
function fxBake(L){const d=S.doc,base=L.canvas,key=JSON.stringify(L.fx)+'|'+(base._v|0),ca=FXC.get(base);if(ca&&ca.key===key&&ca.w===d.w&&ca.h===d.h)return ca.c;
  const f=L.fx,out=mk(d.w,d.h),g=cx(out);let region=null;const bb=L.txt&&L.txt.bbox||(L.shp&&shpBox(L.shp));if(bb){const pad=Math.ceil(((f.shadow&&f.shadow.on?f.shadow.blur*2+Math.abs(f.shadow.dx)+Math.abs(f.shadow.dy):0)+(f.glow&&f.glow.on?f.glow.blur*2:0)+(f.stroke&&f.stroke.on?f.stroke.w:0))+8);region=[Math.max(0,Math.floor(bb[0]-pad)),Math.max(0,Math.floor(bb[1]-pad)),0,0];region[2]=Math.min(d.w,Math.ceil(bb[0]+bb[2]+pad))-region[0];region[3]=Math.min(d.h,Math.ceil(bb[1]+bb[3]+pad))-region[1];if(region[2]<=0||region[3]<=0)region=null}
  const [rx0,ry0,rw,rh]=region||[0,0,d.w,d.h];const W=rw,H=rh,wk=mk(W,H),w=cx(wk);w.drawImage(base,rx0,ry0,rw,rh,0,0,W,H);
  const tint=col=>{const t=mk(W,H),q=cx(t);q.drawImage(wk,0,0);q.globalCompositeOperation='source-in';q.fillStyle=col;q.fillRect(0,0,W,H);return t};
  const hexA=(h,a)=>{const n=parseInt(h.slice(1),16);return`rgba(${n>>16&255},${n>>8&255},${n&255},${a})`};
  const res=mk(W,H),r=cx(res);
  if(f.glow&&f.glow.on){const s=tint(f.glow.color);r.save();r.shadowColor=hexA(f.glow.color,f.glow.op);r.shadowBlur=f.glow.blur;for(let k=0;k<2;k++)r.drawImage(s,0,0);r.restore();r.globalCompositeOperation='destination-out';r.drawImage(wk,0,0);r.globalCompositeOperation='source-over'}
  if(f.shadow&&f.shadow.on){const sh=mk(W,H),q=cx(sh);q.shadowColor=hexA(f.shadow.color,f.shadow.op);q.shadowBlur=f.shadow.blur;q.shadowOffsetX=f.shadow.dx+W*4;q.shadowOffsetY=f.shadow.dy;q.drawImage(wk,-W*4,0);r.drawImage(sh,0,0)}
  if(f.stroke&&f.stroke.on){const s=tint(f.stroke.color),n=Math.max(12,Math.ceil(f.stroke.w*3));for(let ring=1;ring<=Math.ceil(f.stroke.w);ring+=Math.max(1,Math.floor(f.stroke.w/3)))for(let i=0;i<n;i++){const a=i*2*Math.PI/n;r.drawImage(s,Math.cos(a)*ring,Math.sin(a)*ring)}for(let i=0;i<n;i++){const a=i*2*Math.PI/n;r.drawImage(s,Math.cos(a)*f.stroke.w,Math.sin(a)*f.stroke.w)}}
  r.drawImage(wk,0,0);g.drawImage(res,rx0,ry0);out.__fx=true;FXC.set(base,{key,w:d.w,h:d.h,c:out});return out}
const shpBox=s=>{if(s.type==='compound'||s.type==='arrow')return shpBoxTS(s);const x0=Math.min(s.x,s.x+s.w),y0=Math.min(s.y,s.y+s.h);return[x0-s.sw,y0-s.sw,Math.abs(s.w)+s.sw*2,Math.abs(s.h)+s.sw*2]};
const _layerSrc13=layerSrc;layerSrc=function(L){const s=_layerSrc13(L);if(L.kind==='pixel'&&fxOn(L.fx)&&s===L.canvas)return fxBake(L);return s};
function fxDialog(L){if(!L||L.kind!=='pixel'){toast('Choisissez un calque de pixels, de texte ou de forme');return}const d=S.doc,orig=L.fx;let f=Object.assign(FXD(),clone(L.fx||{}));f.shadow=Object.assign(FXD().shadow,f.shadow);f.stroke=Object.assign(FXD().stroke,f.stroke);f.glow=Object.assign(FXD().glow,f.glow);
  const rd=el=>{const g=id=>$('#'+id,el);f={shadow:{on:g('fsO').checked,color:g('fsC').value,op:+g('fsA').value/100,blur:+g('fsB').value,dx:+g('fsX').value,dy:+g('fsY').value},stroke:{on:g('fkO').checked,color:g('fkC').value,w:+g('fkW').value},glow:{on:g('fgO').checked,color:g('fgC').value,op:+g('fgA').value/100,blur:+g('fgB').value}};[['fsA','%'],['fsB',' px'],['fsX',' px'],['fsY',' px'],['fkW',' px'],['fgA','%'],['fgB',' px']].forEach(([id,u])=>{const o=$('#'+id+'-o',el);if(o)o.textContent=g(id).value+u})};
  const sec=(p,title,on,col,rows)=>`<fieldset style="border:1px solid var(--line,#8884);border-radius:10px;padding:8px 12px;margin:8px 0"><legend><label><input type="checkbox" id="${p}O" ${on?'checked':''}> ${title}</label></legend><div class="inline"><input type="color" class="swatch" id="${p}C" value="${esc(col)}" aria-label="Couleur"></div>${rows}</fieldset>`;
  dialog({title:'Styles de calque',light:true,body:`<p class="muted">Effets modifiables à tout moment, appliqués au calque « ${esc(L.name)} ».</p>
   ${sec('fs','Ombre portée',f.shadow.on,f.shadow.color,rRow('fsA','Opacité',0,100,1,Math.round(f.shadow.op*100),'%')+rRow('fsB','Flou',0,120,1,f.shadow.blur,' px')+rRow('fsX','Décalage horizontal',-100,100,1,f.shadow.dx,' px')+rRow('fsY','Décalage vertical',-100,100,1,f.shadow.dy,' px'))}
   ${sec('fk','Contour extérieur',f.stroke.on,f.stroke.color,rRow('fkW','Épaisseur',1,40,1,f.stroke.w,' px'))}
   ${sec('fg','Lueur',f.glow.on,f.glow.color,rRow('fgA','Intensité',0,100,1,Math.round(f.glow.op*100),'%')+rRow('fgB','Taille',1,120,1,f.glow.blur,' px'))}`,
   onOpen:el=>{let t=null;const go=()=>{rd(el);L.fx=fxOn(f)?f:null;markComp()};el.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(go,60)});el.addEventListener('change',go);
     const s=$('#scrim');const oc=s._cancel;s._cancel=()=>{L.fx=orig;markComp();oc&&oc()}},
   buttons:[{label:'Annuler',onClick:()=>{L.fx=orig;markComp()}},{label:'Retirer les styles',onClick:()=>{L.fx=null;markComp();pushHistory('Retirer les styles de calque');syncAll()}},{label:'Appliquer',primary:true,onClick:()=>{rd(document);L.fx=fxOn(f)?f:null;markComp();pushHistory('Styles de calque');syncAll()}}]})}
/* styles survive merging, and are baked into PSD layers */
const _mergeDown13=mergeDown;mergeDown=function(){const d=S.doc,L=d&&AL();if(L&&L.kind==='pixel'&&fxOn(L.fx)){L.canvas=fxBake(L);L.fx=null;delete L.txt;delete L.shp}const b=d&&d.layers[d.active-1];if(b&&b.kind==='pixel'&&(fxOn(b.fx))){b.canvas=fxBake(b);b.fx=null}if(b){delete b.txt;delete b.shp}_mergeDown13()};
const _exportPSD13=exportPSD;exportPSD=async function(...a){const sw=[];for(const L of S.doc.layers)if(L.kind==='pixel'&&fxOn(L.fx)&&!L.hi){sw.push([L,L.canvas]);L.canvas=fxBake(L)}try{return await _exportPSD13.apply(this,a)}finally{sw.forEach(([L,c])=>{L.canvas=c})}};

/* ---------- duplicating, painting and geometry keep text and shapes coherent ---------- */
const _dupLayer13=dupLayer;dupLayer=function(){const d=S.doc,L=AL();const src=L;_dupLayer13();const N=AL();if(src&&N&&N!==src&&!d.sel){XKEYS.forEach(k=>{if(src[k]!=null&&k!=='link')N[k]=clone(src[k])});if(N.grp)N.grp={...N.grp}}};
const _beginStroke13=beginStroke;beginStroke=function(p,e){const L=AL();if(L&&MEDIT(L)&&!L.editMask&&S.tool!=='heal'){delete L.txt;delete L.shp;toast('Ce calque devient un calque de pixels : le texte ou la forme ne sera plus modifiable',4000)}return _beginStroke13(p,e)};
const _transformDoc13=transformDoc;transformDoc=function(...a){S.doc.layers.forEach(l=>{delete l.txt;delete l.shp});return _transformDoc13(...a)};
const _resizeDoc13=resizeDoc;resizeDoc=function(...a){S.doc.layers.forEach(l=>{delete l.txt;delete l.shp});return _resizeDoc13(...a)};

/* ---------- groups, links, multi-selection ---------- */
S.multi=new Set();S.gfold=new Set();
const multiLayers=()=>{const d=S.doc;if(!d)return[];const ids=new Set(S.multi);if(ids.size)ids.add(d.layers[d.active].id);return d.layers.filter(l=>ids.has(l.id))};
function groupLayers(){const d=S.doc;let sel=multiLayers();if(sel.length<2){const i=d.active;if(i<1){toast('Sélectionnez au moins deux calques (Ctrl ou Maj + clic dans la liste)');return}sel=[d.layers[i],d.layers[i-1]]}
  const idx=sel.map(l=>d.layers.indexOf(l)).sort((a,b)=>a-b),top=idx[idx.length-1],act=d.layers[d.active];const gid='g'+uid8();const n=new Set(d.layers.filter(l=>l.grp).map(l=>l.grp.id)).size+1,name='Groupe '+n;
  sel.forEach(l=>{l.grp={id:gid,name}});const rest=d.layers.filter(l=>!sel.includes(l)),pos=rest.filter(l=>d.layers.indexOf(l)<top).length;rest.splice(pos,0,...sel.sort((a,b)=>d.layers.indexOf(a)-d.layers.indexOf(b)));d.layers=rest;d.active=d.layers.indexOf(act);S.multi.clear();markComp();pushHistory('Grouper les calques');syncAll();toast(`${sel.length} calques dans « ${name} »`)}
function ungroup(gid){const d=S.doc;let n=0;d.layers.forEach((l,i)=>{if(l.grp&&l.grp.id===gid){d.layers[i]={...l};delete d.layers[i].grp;n++}});if(!n)return;const act=d.active;d.active=Math.min(act,d.layers.length-1);markComp();pushHistory('Dissoudre le groupe');syncAll()}
function removeFromGroup(){const d=S.doc,L=AL();if(!L||!L.grp)return;delete L.grp;markComp();pushHistory('Retirer du groupe');syncAll()}
function renameGroup(gid){const d=S.doc,cur=(d.layers.find(l=>l.grp&&l.grp.id===gid)||{}).grp;if(!cur)return;dialog({title:'Renommer le groupe',light:true,body:`<label class="field">Nom<input id="gnm" value="${esc(cur.name)}"></label>`,onOpen:el=>setTimeout(()=>{$('#gnm',el).focus();$('#gnm',el).select()},30),buttons:[{label:'Annuler'},{label:'Renommer',primary:true,onClick:()=>{const v=$('#gnm').value.trim();if(!v)return;d.layers.forEach((l,i)=>{if(l.grp&&l.grp.id===gid)l.grp={...l.grp,name:v}});pushHistory('Renommer le groupe');syncAll()}}]})}
function setGroupVisible(gid,v){const d=S.doc;d.layers.forEach(l=>{if(l.grp&&l.grp.id===gid)l.visible=v});markComp();pushHistory(v?'Afficher le groupe':'Masquer le groupe');syncAll()}
function linkLayers(){const d=S.doc;let sel=multiLayers().filter(l=>l.kind==='pixel');if(sel.length<2){const L=AL(),b=d.layers[d.active-1];if(!L||!b||L.kind!=='pixel'||b.kind!=='pixel'){toast('Sélectionnez deux calques de pixels (Ctrl ou Maj + clic dans la liste)');return}sel=[L,b]}
  const id='k'+uid8();sel.forEach(l=>{l.link=id});S.multi.clear();pushHistory('Lier les calques');syncAll();toast('Calques liés : ils se déplacent ensemble')}
function unlinkLayer(){const d=S.doc,L=AL();if(!L||!L.link)return;const id=L.link;delete L.link;const rest=d.layers.filter(l=>l.link===id);if(rest.length===1)delete rest[0].link;pushHistory('Délier le calque');syncAll()}
function linkGroup(gid){const d=S.doc,m=d.layers.filter(l=>l.grp&&l.grp.id===gid&&l.kind==='pixel');if(m.length<2){toast('Il faut au moins deux calques de pixels');return}const id='k'+uid8();m.forEach(l=>l.link=id);pushHistory('Lier le groupe');syncAll();toast('Calques du groupe liés')}
const _moveLayer13=moveLayer;moveLayer=function(dir){const d=S.doc,i=d.active,j=i+dir;if(j>=0&&j<d.layers.length){const L=d.layers[i],arr=d.layers.slice();[arr[i],arr[j]]=[arr[j],arr[i]];const gAt=k=>arr[k]&&arr[k].grp?arr[k].grp.id:null,a=gAt(j-1),b=gAt(j+1);
    if(a&&a===b&&(!L.grp||L.grp.id!==a)){L.grp=arr[j-1].grp}else if(L.grp&&L.grp.id!==a&&L.grp.id!==b&&d.layers.some(l=>l!==L&&l.grp&&l.grp.id===L.grp.id)){delete L.grp}}_moveLayer13(dir)};
function decorateLayers(){const ul=document.querySelector('#pane-layers ul.lyrs'),d=S.doc;if(!ul||!d)return;let prev=null;
  [...ul.querySelectorAll('li.lyr')].forEach(li=>{const i=+li.dataset.i,L=d.layers[i];if(!L)return;const nm=li.querySelector('.nm'),bl=li.querySelector('.bl');
    if(nm&&MEDIT(L)&&!nm.querySelector('.ltag'))nm.insertAdjacentHTML('afterbegin',`<i class="ltag" title="${L.txt?'Texte modifiable':'Forme modifiable'}">${L.txt?'T':'◇'}</i>`);
    if(bl){let x='';if(L.link)x+=' · lié';if(fxOn(L.fx))x+=' · styles';if(x)bl.insertAdjacentText('beforeend',x)}
    if(S.multi.has(L.id))li.classList.add('ms');const g=L.grp;
    if(g){li.classList.add('ingrp');li.dataset.g=g.id;if(prev!==g.id){const n=d.layers.filter(l=>l.grp&&l.grp.id===g.id),folded=S.gfold.has(g.id),allHid=n.every(l=>l.visible===false);
        li.insertAdjacentHTML('beforebegin',`<li class="grp" data-gid="${g.id}" tabindex="0"><button class="ib gtw" data-gfold="${g.id}" aria-label="${folded?'Déplier':'Replier'} le groupe">${folded?'▸':'▾'}</button><button class="ib" data-geye="${g.id}" aria-label="${allHid?'Afficher':'Masquer'} le groupe"><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" style="opacity:${allHid?.4:1}"><path d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10z"/><circle cx="10" cy="10" r="2.6"/></svg></button><span class="gn">${esc(g.name)}</span><span class="gc">${n.length}</span></li>`)}
      if(S.gfold.has(g.id))li.hidden=true}prev=g?g.id:null})}
const _syncLayers13=syncLayers;syncLayers=function(){_syncLayers13.apply(this,arguments);try{decorateLayers()}catch(e){console.warn(e)}};
(()=>{const pane=$('#pane-layers');
  pane.addEventListener('click',e=>{const d=S.doc;if(!d)return;const gf=e.target.closest('[data-gfold]'),ge=e.target.closest('[data-geye]');
    if(gf){e.stopPropagation();const g=gf.dataset.gfold;S.gfold.has(g)?S.gfold.delete(g):S.gfold.add(g);syncLayers();return}
    if(ge){e.stopPropagation();const g=ge.dataset.geye,all=d.layers.filter(l=>l.grp&&l.grp.id===g);setGroupVisible(g,all.every(l=>l.visible===false));return}
    const gh=e.target.closest('li.grp');if(gh){e.stopPropagation();const g=gh.dataset.gid;S.gfold.has(g)?S.gfold.delete(g):S.gfold.add(g);syncLayers();return}
    const li=e.target.closest('li.lyr');if(!li||e.target.closest('[data-eye]'))return;
    if(e.ctrlKey||e.metaKey||e.shiftKey){e.preventDefault();e.stopPropagation();const i=+li.dataset.i,L=d.layers[i],act=d.layers[d.active];
      if(e.shiftKey){const a=d.active,lo=Math.min(a,i),hi=Math.max(a,i);S.multi=new Set(d.layers.slice(lo,hi+1).map(l=>l.id))}else{if(!S.multi.size)S.multi.add(act.id);S.multi.has(L.id)?S.multi.delete(L.id):S.multi.add(L.id);if(S.multi.size===1&&S.multi.has(act.id))S.multi.clear()}syncLayers();return}
    if(S.multi.size){S.multi.clear()}},true);
  pane.addEventListener('dblclick',e=>{const gh=e.target.closest('li.grp');if(gh){e.stopPropagation();renameGroup(gh.dataset.gid);return}const th=e.target.closest('.lyr canvas.th:not(.mth)');if(th&&S.doc){const L=S.doc.layers[+th.closest('.lyr').dataset.i];if(L&&L.txt){e.stopPropagation();textEdit(L,false)}else if(L&&L.shp){e.stopPropagation();shapeEdit(L)}}},true)})();
/* menus */
const gCtx=gid=>{const d=S.doc,all=d.layers.filter(l=>l.grp&&l.grp.id===gid);return[MI('Renommer le groupe…',{icon:'rename',fn:()=>renameGroup(gid)}),MI(all.every(l=>l.visible===false)?'Afficher le groupe':'Masquer le groupe',{icon:'eye',fn:()=>setGroupVisible(gid,all.every(l=>l.visible===false))}),MI(S.gfold.has(gid)?'Déplier':'Replier',{fn:()=>{S.gfold.has(gid)?S.gfold.delete(gid):S.gfold.add(gid);syncLayers()}}),SEP,MI('Lier tous les calques du groupe',{fn:()=>linkGroup(gid)}),MI('Dissoudre le groupe',{danger:true,fn:()=>ungroup(gid)})]};
function layerExtras(i){const d=S.doc,L=d.layers[i],ms=multiLayers().length>1,out=[];
  if(L.txt)out.push(MI('Modifier le texte…',{icon:'text',fn:()=>textEdit(L,false)}));if(L.shp)out.push(MI('Modifier la forme…',{fn:()=>shapeEdit(L)}));
  out.push(MI('Styles de calque…',{icon:'sliders',fn:()=>fxDialog(L),dis:L.kind!=='pixel'?'Pour les calques de pixels, de texte et de forme':false}));
  if(L.fx)out.push(MI('Retirer les styles',{fn:()=>{L.fx=null;markComp();pushHistory('Retirer les styles de calque');syncAll()}}));out.push(SEP);
  out.push(MI(ms?`Grouper les ${multiLayers().length} calques`:'Grouper avec le calque du dessous',{icon:'layer',fn:groupLayers,dis:!ms&&i<1?'Aucun calque en dessous':false}));
  if(L.grp)out.push(MI('Retirer du groupe',{fn:removeFromGroup}));
  out.push(MI(ms?'Lier les calques sélectionnés':'Lier au calque du dessous',{fn:linkLayers,dis:L.kind!=='pixel'?'Seuls les calques de pixels se lient':false}));if(L.link)out.push(MI('Délier',{fn:unlinkLayer}));out.push(SEP);return out}
const _layerCtx13=layerCtx;layerCtx=function(i){const a=_layerCtx13(i),d=S.doc;if(!d)return a;const at=a.findIndex(x=>x===SEP);a.splice(at<0?a.length:at+1,0,...layerExtras(i));return a};
const _ctxFor13=ctxFor;ctxFor=function(t){const gh=t.closest&&t.closest('#pane-layers li.grp');if(gh&&S.doc)return()=>gCtx(gh.dataset.gid);return _ctxFor13(t)};
(()=>{const mi=MENU2.layer.items;MENU2.layer.items=()=>{const a=mi(),d=S.doc;if(!d)return a;const i=a.findIndex(x=>x&&x.label&&/^Masque$/.test(x.label));a.splice(i<0?a.length:i,0,...layerExtras(d.active));return a}})();
/* text tool: clicking existing text edits it; Enter on the menu entry too */
(()=>{const mi=MENU2.edit&&MENU2.edit.items;/* no-op placeholder: edit menu untouched */})();

