/* RAW natif (application de bureau) : le fichier est développé en Rust (src-tauri/src/raw.rs, rawler),
   bien plus vite que LibRaw en WebAssembly (web/raw). LibRaw reste le recours pour tout ce que la
   version native refuse (boîtier non pris en charge, fichier abîmé…) et la voie de la version web.
   rawDecode16 garde exactement la même forme de résultat : {data, w, h, meta, white, info}.
   Réponse de raw_decode : "PRW1", largeur, hauteur, longueur du JSON (u32 LE), le JSON
   {make, model, iso, shutter, aperture, focal, lens}, des zéros jusqu'à un multiple de 8, puis
   les pixels u16 R V B, ProPhoto avec la courbe BT.709 que LibRaw applique toujours (même rendu
   que la voie LibRaw), déjà redressés. */
const T=window.__TAURI__;
if(T&&T.core&&typeof rawDecode16==='function'){
  const call=(...a)=>(window.PRISM_DESKTOP&&window.PRISM_DESKTOP.invoke||T.core.invoke)(...a);
  const MSG='Développement du fichier RAW (16 bits)…';
  const parse=out=>{const b=out instanceof ArrayBuffer?out:new Uint8Array(out).buffer,dv=new DataView(b);
    if(b.byteLength<16||new TextDecoder().decode(new Uint8Array(b,0,4))!=='PRW1')throw new Error('réponse RAW native illisible');
    const w=dv.getUint32(4,true),h=dv.getUint32(8,true),n=dv.getUint32(12,true),meta=JSON.parse(new TextDecoder().decode(new Uint8Array(b,16,n))),at=Math.ceil((16+n)/8)*8;
    if(!w||!h||b.byteLength<at+w*h*6)throw new Error('réponse RAW native incomplète');
    return{w,h,meta,data:new Uint16Array(b,at,w*h*3)}};
  const native=async(file,wb)=>{const buf=new Uint8Array(await file.arrayBuffer());
    const{w:W,h:H,meta:m,data}=parse(await call('raw_decode',buf,{headers:{'x-wb':wb==='auto'?'auto':'camera'}}));
    /* point blanc, texte et infos d'objectif : mêmes calculs que la voie LibRaw (0440) */
    const hist=[new Uint32Array(1024),new Uint32Array(1024),new Uint32Array(1024)];const step=Math.max(1,Math.floor(W*H/400000));let cnt=0;for(let i=0;i<W*H;i+=step){hist[0][data[i*3]>>6]++;hist[1][data[i*3+1]>>6]++;hist[2][data[i*3+2]>>6]++;cnt++}
    let white=0;for(let c=0;c<3;c++){let tot=0,v=1023;for(;v>0;v--){tot+=hist[c][v];if(tot>cnt*0.01)break}white=Math.max(white,(v+1)/1024)}
    const bits=[];const mk_=m.make||'',md_=m.model||'';if(mk_||md_)bits.push([mk_,md_].filter(Boolean).join(' ').trim());if(m.iso)bits.push('ISO '+Math.round(m.iso));if(m.shutter)bits.push(m.shutter>=1?m.shutter+' s':'1/'+Math.round(1/m.shutter)+' s');if(m.aperture)bits.push('f/'+(+m.aperture).toFixed(1));if(m.focal)bits.push(Math.round(m.focal)+' mm');
    const info={make:mk_,model:md_,focal:+m.focal||0,fn:+m.aperture||0,lens:''};try{const t=tiffRead(buf),s=t&&exifSummary(t);if(s){info.lens=s.lens||'';if(!info.focal&&s.focal)info.focal=s.focal}}catch(e){}if(!info.lens)info.lens=m.lens||'';
    return{data,w:W,h:H,meta:bits.join(' · '),white:clamp(white,1/16,1),info}};
  const viaLibRaw=rawDecode16;
  rawDecode16=async function(file,wb){if(PREF.get('rawNative',true)!==false){busy(true,MSG,null);
      try{return await native(file,wb)}catch(e){console.info('RAW natif indisponible, LibRaw prend le relais :',e&&e.message||e)}finally{busy(false)}}
    return viaLibRaw(file,wb)};
  /* le premier développement charge la base des boîtiers de rawler : on la prépare à l'avance, au calme */
  setTimeout(()=>{call('raw_decode',new Uint8Array(4),{headers:{'x-wb':'camera'}}).catch(()=>{})},4000);
}
