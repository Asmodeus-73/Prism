import factory from './avif_enc.js';
let mod=null;
self.onmessage=async e=>{try{mod=mod||await factory({noInitialRun:true});const{data,w,h,opts}=e.data;const out=mod.encode(data,w,h,opts);if(!out)throw new Error('encodage AVIF impossible');const u=new Uint8Array(out);self.postMessage({ok:true,out:u},[u.buffer])}catch(err){self.postMessage({ok:false,err:String(err&&err.message||err)})}};
