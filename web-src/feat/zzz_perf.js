/* ===== 0.5: fluidity. Every dab marks the area it touched, so the live stroke only recomposes that area (see st.liveCanvas).
   Loaded last: it wraps the final dab, whatever the brushes above added to it. ===== */
const _dabP=dab;dab=function(st,p){const r=(S.opts[st.tool]&&S.opts[st.tool].size||0)*0.75+4,D=st.dirty||(st.dirty={x0:Infinity,y0:Infinity,x1:-Infinity,y1:-Infinity});
  if(p.x-r<D.x0)D.x0=p.x-r;if(p.y-r<D.y0)D.y0=p.y-r;if(p.x+r>D.x1)D.x1=p.x+r;if(p.y+r>D.y1)D.y1=p.y+r;
  // clone stamps read elsewhere: the whole stroke box stays dirty
  if(st.tool==='clone'&&st.bounds){const b=st.bounds;D.x0=Math.min(D.x0,b.x0-r);D.y0=Math.min(D.y0,b.y0-r);D.x1=Math.max(D.x1,b.x1+r);D.y1=Math.max(D.y1,b.y1+r)}
  return _dabP.apply(this,arguments)};
