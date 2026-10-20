/* ================= soft proofing (LittleCMS) ================= */
function iccP3(){/* minimal ICC v4 Display P3 matrix/TRC profile */
  const tags=[],u8=[],push=(sig,bytes)=>tags.push({sig,bytes});const be=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255],s15=v=>be(Math.round(v*65536)|0),sig=s=>[...s].map(c=>c.charCodeAt(0));
  const xyz=(x,y,z)=>[...sig('XYZ '),0,0,0,0,...s15(x),...s15(y),...s15(z)];
  const mluc=t=>{const str=[];for(const ch of t){const c=ch.charCodeAt(0);str.push(c>>8,c&255)}return[...sig('mluc'),0,0,0,0,...be(1),...be(12),...sig('enUS'),...be(str.length),...be(28),...str]};
  const para=[...sig('para'),0,0,0,0,0,3,0,0,...s15(2.4),...s15(1/1.055),...s15(0.055/1.055),...s15(1/12.92),...s15(0.04045)];
  const chad=[...sig('sf32'),0,0,0,0,...[1.0478112,0.0228866,-0.0501270,0.0295424,0.9904844,-0.0170491,-0.0092345,0.0150436,0.7521316].flatMap(s15)];
  push('desc',mluc('Display P3'));push('cprt',mluc('No copyright, use freely'));push('wtpt',xyz(0.9642,1,0.8249));push('chad',chad);
  push('rXYZ',xyz(0.515102,0.241182,-0.00104941));push('gXYZ',xyz(0.291965,0.692236,0.0418818));push('bXYZ',xyz(0.157153,0.0665819,0.784378));push('rTRC',para);push('gTRC',para);push('bTRC',para);
  const head=128+4+tags.length*12;let off=head;const table=[],data=[];const shared=new Map();
  for(const t of tags){let o=shared.get(t.bytes);if(o==null){o=off;shared.set(t.bytes,o);data.push(...t.bytes);off+=t.bytes.length;while(off%4){data.push(0);off++}}table.push(...sig(t.sig),...be(o),...be(t.bytes.length))}
  const size=off,h=new Array(128).fill(0);const put=(at,arr)=>arr.forEach((v,i)=>h[at+i]=v);
  put(0,be(size));put(8,[4,0x30,0,0]);put(12,sig('mntr'));put(16,sig('RGB '));put(20,sig('XYZ '));put(24,[0x07,0xea,0,10,0,11,0,0,0,0,0,0]);put(36,sig('acsp'));put(68,[...s15(0.9642),...s15(1),...s15(0.8249)]);
  return new Uint8Array([...h,...be(tags.length),...table,...data])}
const PROOF={on:false,gamut:false,intent:1,bpc:true,paper:false,name:'',bytes:null,h:null,xf:null,xfG:null,key:'',busy:false};
const CMS={m:null,ns:null,async load(){if(this.m)return this.m;const ns=await import(asset('cms/lcms.js'));const m=await ns.instantiate();this.ns=ns;this.m=m;this.srgb=m.cmsCreate_sRGBProfile();const p=iccP3();this.p3=this.open(p);return m},
  open(u8){const m=this.m,ptr=m._malloc(u8.length);m.HEAPU8.set(u8,ptr);const h=m._cmsOpenProfileFromMem(ptr,u8.length);m._free(ptr);return h}};
async function proofLoadSaved(){if(PROOF.bytes)return true;const k=PREF.get('iccKey',null);if(!k)return false;try{const b=await IDB.get('blobs',k);if(!b)return false;PROOF.bytes=new Uint8Array(await b.arrayBuffer());PROOF.name=PREF.get('iccName','profil');return true}catch(e){return false}}
async function proofPrepare(){const key=[PROOF.name,PROOF.intent,PROOF.bpc,PROOF.paper,CS].join('|');if(PROOF.xf&&PROOF.key===key)return true;const m=await CMS.load();
  if(!PROOF.h){PROOF.h=CMS.open(PROOF.bytes);if(!PROOF.h)throw new Error('profil ICC illisible')}
  const T=CMS.ns.TYPE_RGBA_8,io=CS==='display-p3'?CMS.p3:CMS.srgb,fl=0x4000|0x04000000|(PROOF.bpc?0x2000:0),pi=PROOF.paper?3:1;
  if(PROOF.xf)m.cmsDeleteTransform(PROOF.xf);if(PROOF.xfG)m.cmsDeleteTransform(PROOF.xfG);
  PROOF.xf=m.cmsCreateProofingTransform(io,T,io,T,PROOF.h,PROOF.intent,pi,fl);PROOF.xfG=m.cmsCreateProofingTransform(io,T,io,T,PROOF.h,PROOF.intent,pi,fl|0x1000);
  if(!PROOF.xf)throw new Error('transformation impossible avec ce profil');PROOF.key=key;return true}
function proofApply(g,w,h){if(!PROOF.on||!PROOF.xf)return;if(PROOF.key.split('|')[4]!==CS){/* colour space changed: rebuild the transform for it */if(!PROOF.busy){PROOF.busy=true;proofPrepare().then(()=>markContent(),e=>{console.warn(e);PROOF.on=false;renderProofBadge()}).finally(()=>{PROOF.busy=false})}return}const m=CMS.m,id=g.getImageData(0,0,w,h),n=w*h;const out=m.cmsDoTransform(PROOF.xf,id.data,n);
  if(PROOF.gamut&&PROOF.xfG){const ga=m.cmsDoTransform(PROOF.xfG,id.data,n);for(let i=0;i<n;i++){const j=i*4;if(ga[j]===127&&ga[j+1]===127&&ga[j+2]===127&&!(out[j]===127&&out[j+1]===127&&out[j+2]===127)){out[j]=255;out[j+1]=40;out[j+2]=200}}}
  for(let i=3;i<out.length;i+=4)out[i]=id.data[i];id.data.set(out);g.putImageData(id,0,0)}
async function proofToggle(on){if(on==null)on=!PROOF.on;if(!on){PROOF.on=false;markContent();renderProofBadge();return}
  if(!await proofLoadSaved()){proofDialog();return}busy(true,'Préparation de l’épreuvage…',null);try{await proofPrepare();PROOF.on=true;markContent();renderProofBadge()}catch(e){console.error(e);toast('Épreuvage impossible : '+(e.message||e),5000)}finally{busy(false)}}
function renderProofBadge(){let b=$('#proofBadge');if(!b){b=document.createElement('button');b.id='proofBadge';b.className='proof-badge';b.onclick=()=>proofDialog();$('#stage').appendChild(b)}
  b.hidden=!PROOF.on;b.textContent='Épreuve : '+PROOF.name+(PROOF.gamut?' · alerte de gamut':'')}
function proofDialog(){const st={...PROOF};let bytes=PROOF.bytes,name=PROOF.name;
  dialog({title:'Épreuvage écran',light:true,body:`<p class="muted">Simulez à l’écran le rendu d’une impression : chargez le profil ICC de l’imprimante et du papier (fourni par le labo ou le fabricant, fichier .icc ou .icm). Le profil reste sur cet appareil.</p>
    <div class="inline"><button class="btn sm" id="pfPick">Choisir un profil ICC…</button><span id="pfName" class="muted">${name?esc(name):'Aucun profil'}</span></div>
    <label class="field">Rendu<select id="pfIntent"><option value="1" ${st.intent===1?'selected':''}>Colorimétrie relative</option><option value="0" ${st.intent===0?'selected':''}>Perceptif</option></select></label>
    <label class="inline"><input type="checkbox" id="pfBpc" ${st.bpc?'checked':''}>Compensation du point noir</label>
    <label class="inline"><input type="checkbox" id="pfPaper" ${st.paper?'checked':''}>Simuler la teinte du papier</label>
    <label class="inline"><input type="checkbox" id="pfGamut" ${st.gamut?'checked':''}>Alerte de gamut (couleurs non imprimables en rose)</label>`,
    onOpen:el=>{$('#pfPick',el).onclick=async()=>{const f=await pickFile('.icc,.icm,application/vnd.iccprofile');if(!f)return;const u8=new Uint8Array(await f.arrayBuffer());
        if(u8.length<132||String.fromCharCode(...u8.slice(36,40))!=='acsp'){toast('Ce fichier n’est pas un profil ICC');return}bytes=u8;name=f.name.replace(/\.(icc|icm)$/i,'');$('#pfName',el).textContent=name}},
    buttons:[{label:'Fermer'},{label:'Désactiver',onClick:()=>proofToggle(false)},{label:'Afficher l’épreuve',primary:true,onClick:el=>{if(!bytes){toast('Choisissez d’abord un profil ICC');return false}(async()=>{
      const changed=bytes!==PROOF.bytes;Object.assign(PROOF,{intent:+$('#pfIntent',el).value,bpc:$('#pfBpc',el).checked,paper:$('#pfPaper',el).checked,gamut:$('#pfGamut',el).checked});
      if(changed){if(PROOF.h&&CMS.m){try{CMS.m.cmsCloseProfile(PROOF.h)}catch(e){}}PROOF.h=null;PROOF.key='';PROOF.bytes=bytes;PROOF.name=name;
        try{const old=PREF.get('iccKey',null);const k='icc_'+uid8();await IDB.put('blobs',k,new Blob([bytes]));PREF.set('iccKey',k);PREF.set('iccName',name);if(old)IDB.del('blobs',old).catch(()=>{})}catch(e){}}
      PROOF.key='';await proofToggle(true)})()}}]})}

