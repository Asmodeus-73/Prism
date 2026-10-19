/* ================= v9: large photos on iPhone and iPad ================= */
if(IS_IOS){(async()=>{try{let ok=0;for(const n of [20e6,26e6]){const w=Math.round(Math.sqrt(n*1.5)),h=Math.round(n/w),c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(w-3,h-3,3,3);const p=g.getImageData(w-2,h-2,1,1).data;if(p[0]===255&&p[3]===255)ok=n;else break;c.width=c.height=1}
  if(ok>MAX_PX){MAX_PX=ok;S.maxHistBoost=1}}catch(e){}})()}

