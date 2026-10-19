/* ================= v15: what sets Prism apart: assisted culling, "Mon style" learned from favourites, export preflight ================= */
(()=>{
const fmt1=n=>(Math.round(n*10)/10).toString().replace('.',',');
// ---------- analysis of one photo from its thumbnail ----------
async function analyse(it){const l=it.lib||{};if(l.q&&l.q.at>=it.updatedAt)return l.q;const b=await thumbBlob(it);if(!b)return null;
 let bm;try{bm=await createImageBitmap(b)}catch(e){return null}
 const W=256,H=Math.max(8,Math.round(256*bm.height/bm.width)),c=mk(W,H),g=cx(c);g.drawImage(bm,0,0,W,H);bm.close&&bm.close();
 const a=rx(c).getImageData(0,0,W,H).data,Y=new Float32Array(W*H);let sum=0,lo=0,hi=0;
 for(let i=0;i<W*H;i++){const v=.2126*a[i*4]+.7152*a[i*4+1]+.0722*a[i*4+2];Y[i]=v;sum+=v;if(v<6)lo++;if(v>249)hi++}
 let s1=0,s2=0,n=0;for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x,v=4*Y[i]-Y[i-1]-Y[i+1]-Y[i-W]-Y[i+W];s1+=v;s2+=v*v;n++}
 const q={s:Math.sqrt(Math.max(0,s2/n-(s1/n)**2)),m:sum/(W*H),lo:lo/(W*H),hi:hi/(W*H),at:Date.now()};return q}
const expoBad=q=>q.hi>.22||q.lo>.4||q.m<28||q.m>232;
const median=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[s.length>>1]:0};
async function triage(ids){const items=ids.map(id=>LIB.items.find(i=>i.id===id)).filter(Boolean);if(items.length<2){toast('Sélectionnez ou affichez au moins deux photos.');return}
 busy(true,'Analyse de la netteté et de l’exposition…');let done=0;const qs=new Map(),todo=[];
 try{for(const it of items){const q=await analyse(it);if(q){qs.set(it.id,q);if(!it.lib.q||it.lib.q.at!==q.at)todo.push([it.id,q])}if(++done%8===0)await new Promise(r=>setTimeout(r,0))}}finally{busy(false)}
 if(!qs.size){toast('Aucune vignette à analyser.');return}
 for(const [id,q] of todo){const it=LIB.items.find(i=>i.id===id);if(it)it.lib={...it.lib,q}}
 const med=median([...qs.values()].map(q=>q.s)),rej=new Map(),pick=new Set();
 for(const it of items){const q=qs.get(it.id);if(!q)continue;if(q.s<med*.45&&q.s<14)rej.set(it.id,'floue');else if(expoBad(q))rej.set(it.id,q.m<128?'trop sombre':'trop claire')}
 // bursts: shots less than 4 s apart
 const sorted=items.filter(i=>qs.has(i.id)).sort((a,b)=>takenOf(a)-takenOf(b)),bursts=[];let cur=[];
 for(const it of sorted){if(cur.length&&takenOf(it)-takenOf(cur[cur.length-1])>4000){if(cur.length>1)bursts.push(cur);cur=[]}cur.push(it)}if(cur.length>1)bursts.push(cur);
 const score=it=>{const q=qs.get(it.id);return q.s*(expoBad(q)?.5:1)};let burstRej=0;
 for(const b of bursts){const best=b.reduce((x,y)=>score(y)>score(x)?y:x);pick.add(best.id);rej.delete(best.id);for(const it of b)if(it!==best&&score(it)<score(best)*.8&&!rej.has(it.id)){rej.set(it.id,'rafale');burstRej++}}
 const kept=id=>!(LIB.items.find(i=>i.id===id).lib.flag);
 const nRej=[...rej.keys()].filter(kept).length,nPick=[...pick].filter(kept).length;
 const cnt=r=>[...rej.values()].filter(v=>v===r).length;
 dialog({title:'Tri express',body:`<p><b>${qs.size}</b> photos analysées sur leur vignette.</p><ul class="muted" style="margin:0;padding-left:18px;line-height:1.7"><li>${cnt('floue')} floue(s) (netteté très inférieure au reste)</li><li>${cnt('trop sombre')+cnt('trop claire')} mal exposée(s) (ombres ou hautes lumières écrasées)</li><li>${bursts.length} rafale(s) de photos prises à moins de 4 s : la meilleure est retenue, ${burstRej} doublon(s) nettement moins bon(s) écarté(s)</li></ul><p class="muted">Seules les photos sans drapeau reçoivent une suggestion : ${nPick} à retenir ⚑, ${nRej} à écarter. Rien n’est supprimé, vous pouvez tout annuler avec le drapeau.</p>`,
  buttons:[{label:'Ne rien changer'},{label:'Appliquer les drapeaux',primary:true,onClick:async()=>{const R=[...rej.keys()].filter(kept),P=[...pick].filter(kept);if(R.length)await libPatch(R,l=>{l.flag='reject'});if(P.length)await libPatch(P,l=>{l.flag='pick'});toast(`${P.length} retenue(s), ${R.length} écartée(s). Filtre « Écartées » dans la colonne de gauche.`)}}]})}
// ---------- library hooks ----------
const _rl=renderLibrary;renderLibrary=function(){const r=_rl.apply(this,arguments);try{const f=$('#lbFil'),t=f&&f.querySelector('.lb-tools');if(t&&!t.querySelector('[data-triage]'))t.insertAdjacentHTML('beforeend','<button class="btn sm" data-triage title="Détecte les photos floues, mal exposées et choisit la meilleure de chaque rafale">Tri express</button>');
 const so=$('#lbSort');if(so&&!so.querySelector('[value=sharp]'))so.insertAdjacentHTML('beforeend','<option value="sharp">Netteté (après Tri express)</option>');if(so&&so.value!==LIB.sort&&so.querySelector(`[value=${LIB.sort}]`))so.value=LIB.sort}catch(e){}return r};
const _lf=libFiltered;libFiltered=function(){const a=_lf.apply(this,arguments);if(LIB.sort==='sharp')a.sort((x,y)=>((y.lib.q&&y.lib.q.s)||-1)-((x.lib.q&&x.lib.q.s)||-1));return a};
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-triage]');if(!t)return;e.stopPropagation();const ids=LIB.sel.size>1?[...LIB.sel]:libFiltered().map(i=>i.id);triage(ids)},true);
// ---------- Mon style ----------
const NUM=Object.keys(DEV0()).filter(k=>typeof DEV0()[k]==='number'),ARR=['hslH','hslS','hslL'];
const NEUTRAL=new Set(['shH','midH','hiH','sharpRadius','vigMid','vigFeather','grainSize']);
function styleModel(){const devs=[];for(const it of LIB.items){const fav=it.lib&&(it.lib.rating>=4||it.lib.flag==='pick');if(!fav||!it.local||!it.local.layers)continue;
  const g=it.local.layers.filter(L=>L.kind==='adjust'&&!L.mask&&L.dev&&!devIsId(L.dev));if(!g.length)continue;devs.push(g.map(L=>L.dev))}
 const flat=devs.map(gs=>{const m=DEV0();for(const d of gs){for(const k of NUM)if(!NEUTRAL.has(k)&&typeof d[k]==='number')m[k]+=d[k]-(DEV0()[k]);for(const k of ARR)if(d[k])m[k]=m[k].map((v,i)=>v+(d[k][i]||0))}return m});
 if(flat.length<3)return{n:flat.length};const avg=DEV0();for(const k of NUM)if(!NEUTRAL.has(k))avg[k]=flat.reduce((s,m)=>s+m[k],0)/flat.length;for(const k of ARR)avg[k]=avg[k].map((_,i)=>flat.reduce((s,m)=>s+m[k][i],0)/flat.length);
 // keep only tendencies shared by most photos: a parameter that flips sign between photos is noise
 for(const k of NUM){if(NEUTRAL.has(k))continue;const pos=flat.filter(m=>m[k]>0.01).length,neg=flat.filter(m=>m[k]<-0.01).length;if(Math.max(pos,neg)<flat.length*.6)avg[k]=DEV0()[k]}
 return{n:flat.length,avg}}
const LBL={exposure:'Exposition',contrast:'Contraste',highlights:'Hautes lumières',shadows:'Ombres',whites:'Blancs',blacks:'Noirs',texture:'Texture',clarity:'Clarté',dehaze:'Correction du voile',vibrance:'Vibrance',saturation:'Saturation',temp:'Température',tint:'Teinte',sharpen:'Netteté',vignette:'Vignette',grain:'Grain',noise:'Réduction du bruit',balance:'Balance'};
const mixDev=(avg,k)=>{const d=DEV0();for(const key of NUM)if(!NEUTRAL.has(key))d[key]=avg[key]*k;for(const key of ARR)d[key]=avg[key].map(v=>v*k);for(const key of ['shS','midS','hiS'])d[key]=avg[key]*k;return d};
async function monStyle(){if(!S.doc){toast('Ouvrez une photo d’abord.');return}
 try{await libLoad()}catch(e){}
 const m=styleModel();if(!m.avg){dialog({title:'Mon style',body:`<p>Prism apprend vos goûts à partir des photos que vous aimez (4 ★ et plus, ou ⚑ retenues) et que vous avez retouchées.</p><p class="muted">Pour l’instant ${m.n} photo(s) retouchée(s) sont notées ainsi, il en faut au moins 3. Notez vos meilleures retouches dans la photothèque, puis revenez ici.</p>`});return}
 const rows=Object.keys(LBL).map(k=>[k,m.avg[k]]).filter(([k,v])=>Math.abs(v)>=.8||(Math.abs(v)>=.05&&Math.abs(DEV0()[k]+1)<2&&Math.abs(v)>=.08)).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,8);
 const list=rows.length?rows.map(([k,v])=>`<li>${LBL[k]} <b>${v>0?'+':''}${fmt1(Math.abs(v)<5&&k==='exposure'?v:v)}</b></li>`).join(''):'<li>Aucune tendance nette : vos retouches varient beaucoup d’une photo à l’autre.</li>';
 dialog({title:'Mon style',body:`<p>Appris sur <b>${m.n}</b> de vos retouches favorites. Tendances communes :</p><ul class="muted" style="margin:0;padding-left:18px;line-height:1.7">${list}</ul><label class="field" style="margin-top:12px">Intensité<input type="range" id="msK" min="0" max="120" value="70"><span class="val" id="msV">70 %</span></label><p class="muted">Crée un calque de réglage « Mon style » que vous pouvez ajuster ou supprimer.</p>`,
  onOpen:el=>{const r=$('#msK',el);r.oninput=()=>{$('#msV',el).textContent=r.value+' %'}},
  buttons:[{label:'Annuler'},{label:'Appliquer à cette photo',primary:true,onClick:dl=>{if(!rows.length)return;const k=+$('#msK',dl).value/100,L=newAdjust('Mon style');L.dev=mixDev(m.avg,k);insertLayer(L,'Mon style',true);toast('Calque « Mon style » ajouté.')}}]})}
window.monStyle=monStyle;window.triageLib=triage;
const _mi=MENU2.image.items;MENU2.image.items=()=>{const a=_mi();a.push(SEP);a.push(MI('Mon style (appris de vos favorites)…',{fn:monStyle,dis:!S.doc}));return a};
// ---------- export preflight ----------
async function preflight(el){const d=S.doc;if(!d||!el)return;const box=document.createElement('div');box.id='exPre';box.className='muted';box.style.cssText='border:1px solid var(--line-2);border-radius:var(--r);padding:8px 10px;font-size:12px;line-height:1.55';box.textContent='Contrôle avant export…';const body=el.querySelector('.body');if(!body)return;body.insertBefore(box,body.firstChild);
 try{const sc=Math.min(1,480/Math.max(d.w,d.h));let c=await renderDoc(sc);c=c.canvas||c;const w=c.width,h=c.height,a=rx(c).getImageData(0,0,w,h).data;let lo=0,hi=0,n=0,sat=0;for(let i=0;i<a.length;i+=4){if(a[i+3]<8)continue;n++;const mx=Math.max(a[i],a[i+1],a[i+2]),mn=Math.min(a[i],a[i+1],a[i+2]);if(mx>=253)hi++;if(mx<=2)lo++;if(mx>=253&&mn<mx-30)sat++}
  const w$=[],ok=[];const ph=hi/n*100,pl=lo/n*100;if(ph>1)w$.push(`${fmt1(ph)} % de la photo est brûlée (blanc pur, détails perdus)`);else ok.push('hautes lumières préservées');if(pl>3)w$.push(`${fmt1(pl)} % est noir bouché`);else ok.push('ombres préservées');
  if(Math.max(d.w,d.h)<1600)w$.push('petite image : elle sera floue à l’impression ou sur grand écran');
  if(d.space&&d.space!=='srgb')w$.push(`espace couleur ${d.space} : choisissez JPEG ou WebP seulement pour le web, certains navigateurs l’affichent mal`);
  box.innerHTML=(w$.length?w$.map(x=>`<div style="color:var(--warn)">⚠ ${esc(x)}</div>`).join(''):'')+(ok.length?`<div>✓ ${ok.join(', ')}</div>`:'')+(ph>1||pl>3?`<div style="margin-top:6px"><button class="btn sm" id="exFix">Corriger automatiquement</button></div>`:'');
  const fx=box.querySelector('#exFix');if(fx)fx.onclick=()=>{const L=newAdjust('Récupération export');const dv=DEV0();if(ph>1){dv.highlights=-Math.min(60,20+ph*4);dv.whites=-Math.min(40,10+ph*3)}if(pl>3){dv.shadows=Math.min(50,15+pl*2);dv.blacks=Math.min(30,8+pl*2)}L.dev=dv;closeDialog();insertLayer(L,'Récupération export',true);toast('Calque « Récupération export » ajouté. Relancez l’export pour vérifier.')}}catch(e){console.warn('preflight',e);box.remove()}}
const _ed=exportDialog;exportDialog=async function(){const r=await _ed.apply(this,arguments);try{preflight(document.querySelector('#scrim'))}catch(e){console.warn('pf0',e)}return r};
})();

