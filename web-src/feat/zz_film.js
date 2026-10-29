/* ===== Rendu film : simulation de pellicule, tirage d'un négatif scanné, contraste local ===== */
/* Simulation spectrale portée du module « filmsim » de vkdt (copyright 2019 johannes hanika, licence BSD 2 clauses,
   texte dans web/film/LICENSE.txt), lui-même tiré de spektrafilm d'Andrea Volpato. Les profils de pellicules et de papiers
   (web/film/filmsim.bin) viennent de spektrafilm, sous licence CC BY-SA 4.0 (crédit et avis dans web/film/LICENSE.txt).
   Ici, tout ce qui ne dépend que de la couleur d'un pixel est précalculé dans deux tables 3D (couleur -> exposition du négatif,
   densités -> couleur du tirage) ; les effets spatiaux (coupleurs, halo, grain) sont calculés entre les deux. */
const FM={data:null,P:null};
const LOG2_10=3.32192809489,LOG10_2=0.30102999566398114,LUMA=[0.2627,0.6780,0.0593];
const FILMS=['Kodak Gold 200','Kodak UltraMax 400','Kodak Ektar 100','Kodak Portra 160','Kodak Portra 400','Kodak Portra 800','Kodak Portra 800 poussée +1','Kodak Portra 800 poussée +2','Fujifilm C200','Fujifilm Superia X-TRA 400','Fujifilm Pro 400H','Kodak Vision3 50D (cinéma)','Kodak Vision3 250D (cinéma)','Kodak Vision3 200T (cinéma)','Kodak Vision3 500T (cinéma)','Kodak Verita 200D','Kodak Kodachrome 64 (diapositive)','Kodak Ektachrome 100 (diapositive)','Fujifilm Provia 100F (diapositive)','Fujifilm Velvia 100 (diapositive)','Kodak Double-X (noir et blanc)','Kodak Tri-X (noir et blanc, inversible)'];
const PAPERS=['Kodak Endura Premier','Kodak Supra Endura','Kodak Ultra Endura','Kodak Portra Endura','Kodak Ektacolor Edge','Fujifilm Crystal Archive Type II','Kodak 2383 (copie cinéma)','Kodak 2393 (copie cinéma)','Kodak 2302 (noir et blanc)'];
const PAPER0=22,NX=81;
const KG3=[0.8627,0.8588,0.8451,0.8300,0.8207,0.8192,0.8239,0.8263,0.8251,0.8270,0.8335,0.8399,0.8446,0.8435,0.8381,0.8358,0.8367,0.8447,0.8480,0.8440,0.8362,0.8246,0.8087,0.7892,0.7663,0.7387,0.7095,0.6744,0.6402,0.5988,0.5576,0.5161,0.4710,0.4268,0.3821,0.3404,0.2895,0.2547,0.2214,0.1871,0.1584];
const S0=[63.4,65.8,94.8,104.8,105.9,96.8,113.9,125.6,125.5,121.3,121.3,113.5,113.1,110.8,106.5,108.8,105.3,104.4,100.0,96.0,95.1,89.1,90.5,90.3,88.4,84.0,85.1,81.9,82.6,84.9,81.3,71.9,74.3,76.4,63.3,71.7,77.0,65.2,47.7,68.6,65.0];
const S1=[38.5,35.0,43.4,46.3,43.9,37.1,36.7,35.9,32.6,27.9,24.3,20.1,16.2,13.2,8.6,6.1,4.2,1.9,0.0,-1.6,-3.5,-3.5,-5.8,-7.2,-8.6,-9.5,-10.9,-10.7,-12.0,-14.0,-13.6,-12.0,-13.3,-12.9,-10.6,-11.6,-12.2,-10.2,-7.8,-11.2,-10.4];
const S2=[3.0,1.2,-1.1,-0.5,-0.7,-1.2,-2.6,-2.9,-2.8,-2.6,-2.6,-1.8,-1.5,-1.3,-1.2,-1.0,-0.5,-0.3,0.0,0.2,0.5,2.1,3.2,4.1,4.7,5.1,6.7,7.3,8.6,9.8,10.2,8.3,9.6,8.5,7.0,7.6,8.0,6.7,5.2,7.4,6.8];
const M709_2020=[0.6274040,0.3292820,0.0433136,0.0690970,0.9195400,0.0113612,0.0163916,0.0880132,0.8955950];
const M2020_709=[1.6604910,-0.5876411,-0.0728499,-0.1245505,1.1328999,-0.0083494,-0.0181508,-0.1005789,1.1187297];
const M2020_XYZ=[0.636958048301291,0.144616903586208,0.168880975164172,0.262700212011267,0.677998071518871,0.0593017164698619,0,0.0280726930490874,1.06098505771079];
const MXYZ_2020=[1.71665119,-0.35567078,-0.25336628,-0.66668435,1.61648124,0.01576855,0.01763986,-0.04277061,0.94210312];
const CAT=[0.401288,0.650173,-0.051461,-0.250268,1.204414,0.045854,-0.002079,0.048952,0.953127],CATI=[1.86206786,-1.01125463,0.14918677,0.38752654,0.62144744,-0.00897398,-0.01584150,-0.03412294,1.04996444];
const D65=[0.950430,1.0,1.088801];
const mv=(m,v)=>[m[0]*v[0]+m[1]*v[1]+m[2]*v[2],m[3]*v[0]+m[4]*v[1]+m[5]*v[2],m[6]*v[0]+m[7]*v[1]+m[8]*v[2]];
const mm=(a,b)=>{const o=new Array(9);for(let i=0;i<3;i++)for(let j=0;j<3;j++)o[i*3+j]=a[i*3]*b[j]+a[i*3+1]*b[3+j]+a[i*3+2]*b[6+j];return o};
const xF=w=>{const t1=(w-442.0)*(w<442.0?0.0624:0.0374),t2=(w-599.8)*(w<599.8?0.0264:0.0323),t3=(w-501.1)*(w<501.1?0.0490:0.0382);return 0.362*Math.exp(-0.5*t1*t1)+1.056*Math.exp(-0.5*t2*t2)-0.065*Math.exp(-0.5*t3*t3)};
const yF=w=>{const t1=(w-568.8)*(w<568.8?0.0213:0.0247),t2=(w-530.9)*(w<530.9?0.0613:0.0322);return 0.821*Math.exp(-0.5*t1*t1)+0.286*Math.exp(-0.5*t2*t2)};
const zF=w=>{const t1=(w-437.0)*(w<437.0?0.0845:0.0278),t2=(w-459.0)*(w<459.0?0.0385:0.0725);return 1.217*Math.exp(-0.5*t1*t1)+0.681*Math.exp(-0.5*t2*t2)};
function blackbody(l,T){const h2=6.62606957e+11,h=6.62606957e-34,c=299792458.0,k=1.3807e-23,lm=l*1e-9,l5=l*l*l*l*l;return 1e-14*(2*h2*c*c/l5)/(Math.exp(h*c/(lm*T*k))-1)}
function dayW(T){T=clamp(T,4000,25000);const i=1/T,i2=i*i,i3=i2*i,x=T<=7000?-4.6070e9*i3+2.9678e6*i2+99.11*i+0.244063:-2.0064e9*i3+1.9018e6*i2+247.48*i+0.237040,y=-3*x*x+2.870*x-0.275;
  const d=0.2562*x-0.7341*y+0.0241,id=1/(Math.abs(d)<1e-9?1e-9:d);return[(-1.7703*x+5.9114*y-1.3515)*id,(-31.4424*x+30.0717*y+0.0300)*id]}
function illum(cct,l,b){if(cct<1)return 1;if(cct<4000)return blackbody(l,cct);const m=dayW(cct);return S0[b]+m[0]*S1[b]+m[1]*S2[b]}
const ncdf=z=>1/(1+Math.pow(2,-z*(0.10294312*z*z+2.30220556)));
function dichroic(w,n){const low=w<=550,e=low?[607,500,516]:[607,610,516],iw=[0.176776695,0.176776695,0.11785113],c=[0,1,2].map(i=>ncdf((w-e[i])*iw[i]));
  const f=[1-c[0],low?1-c[1]:c[1],c[2]];return(1+(f[0]-1)*n[0])*(1+(f[1]-1)*n[1])*(1+(f[2]-1)*n[2])}
const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const srgbDec=v=>v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4),srgbEnc=v=>v<=0.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-0.055;

async function loadData(){if(FM.data)return FM.data;if(FM.P)return FM.P;
  return FM.P=(async()=>{const get=async(f,t)=>{const r=await fetch(asset('film/'+f));if(!r.ok)throw new Error('données film '+r.status);return t==='json'?r.json():r.arrayBuffer()};
    const [lut,spec,wb]=await Promise.all([get('filmsim.bin'),get('spectra.bin'),get('wb.json','json')]);FM.data={lut:new Float32Array(lut),spec:new Float32Array(spec),wb};return FM.data})().finally(()=>{FM.P=null})}

/* ---------- préparation : tout ce qui dépend des réglages, pas de l'image ---------- */
function setup(D,o){const T=D.lut,at=(stock,row,x)=>{const i=((stock*3+row)*NX+x)*4;return[T[i],T[i+1],T[i+2],T[i+3]]};
  const sens=(s,b)=>at(s,0,b*2).slice(0,3).map(v=>isNaN(v)?0:Math.pow(10,v)),dye=(s,b)=>{const v=at(s,1,b*2),miss=isNaN(v[0])||isNaN(v[1])||isNaN(v[2]);return{d:v.map((x,i)=>isNaN(x)?0:i<3?x*LOG2_10:x),miss}};
  const model=(stock,gam)=>{const pos=at(stock,2,12)[3]>0.5,sg=pos?-1:1,sc=[],bi=[],am=[];
    for(let l=0;l<3;l++){const c=at(stock,2,l*4),a=at(stock,2,l*4+1),is=at(stock,2,l*4+2),g=Math.max(gam[l],1e-3);sc.push([0,1,2].map(k=>sg*g*is[k]));bi.push([0,1,2].map(k=>-sg*c[k]*is[k]));am.push(a.slice(0,3))}
    return{pos,sc,bi,am,dmax:at(stock,2,12).slice(0,3)}};
  const evalD=(M,y,k)=>{let d=0;for(let l=0;l<3;l++){const z=clamp(y*M.sc[l][k]+M.bi[l][k],-10,10);d+=M.am[l][k]*ncdf(z)}return isNaN(d)?0:d};
  const S={o,film:o.film,proc:o.proc};const film=o.film,paper=PAPER0+o.paper;
  // white balance fitted for this pair (vkdt's tables): print exposure and enlarger filters, or for a slide the scan filters
  const posStock=at(film,2,12)[3]>0.5;let ev_paper=o.evPaper||0,flt=[0,0,0];
  if(o.proc===1){const w=D.wb.pos[film];S.evFilm=(o.evFilm||0)+w[0];flt=[w[1],w[2],w[3]]}else{const w=D.wb.wb[film][o.paper];ev_paper+=w[0];flt=[w[1],w[2],w[3]];S.evFilm=o.evFilm||0}
  const neutral=[clamp(flt[0],0,1),clamp(clamp(flt[1],0,1)+0.1*(o.tuneM||0),0,1),clamp(clamp(flt[2],0,1)+0.1*(o.tuneY||0),0,1)];
  S.gFilm=o.gFilm||1;
  // film: spectral exposure factors (36 bands, under the stock's own reference light)
  const fM=model(film,[1,1,1]);S.fM=fM;const ref=at(film,2,22),refCct=ref[3],norm=ref.slice(0,3).map(v=>Math.max(v,1e-6));
  S.ef=[];let ae=0;for(let b=0;b<36;b++){const l=380+b*10,env=1000*sstep(380,400,l)*(1-sstep(700,730,l)),s=sens(film,b),il=illum(refCct,l,b),f=s.map((v,k)=>v*env*il/norm[k]);S.ef.push(f);ae+=f[0]*LUMA[0]+f[1]*LUMA[1]+f[2]*LUMA[2]}
  S.eNorm=Math.max(1e-6,0.18*ae);
  // per-channel development curves tabulated on the log-exposure axis [-4, 4]
  const G=512,lx=i=>(i+0.5)*0.015625-4;S.fD=[0,1,2].map(k=>{const t=new Float32Array(G);for(let i=0;i<G;i++)t[i]=evalD(fM,lx(i),k);return t});
  S.fDmax=S.fD.map(t=>t[G-1]);
  // DIR couplers: inhibition matrix and the inverse warp that keeps a grey ramp on its curve
  S.cp=o.couplers>0&&o.proc!==2;if(S.cp){const c0=at(film,2,13),c1=at(film,2,14),c2=at(film,2,15),Mr=[c0[0],c1[0],c2[0],c0[1],c1[1],c2[1],c0[2],c1[2],c2[2]],dm=fM.dmax;
    const cref=mv(Mr,dm.map(v=>0.5*v)),lk=[1,1,1];S.M=Mr.map(v=>v*o.couplers);S.cref=cref;S.Kr=cref.map((v,k)=>lk[k]*2*v);S.kd=dm.map((v,k)=>lk[k]*v);S.nd=dm.map((v,k)=>(lk[k]+0.5)*v);S.pos=fM.pos;S.dmax=dm;
    const W=[[],[],[]];for(let i=0;i<G;i++){const x=lx(i),d=[0,1,2].map(k=>S.fD[k][i]),c=post(S,pre(S,d));for(let k=0;k<3;k++)W[k].push(x-c[k])}
    // fold-flattened (running maximum), then inverted by search
    S.cw=W.map(w=>{let m=-1e9;const f=w.map(v=>m=Math.max(m,v)),t=new Float32Array(G);let lo=0;for(let i=0;i<G;i++){const x=lx(i);while(lo<G-2&&f[lo+1]<=x)lo++;const a=f[lo],b=f[lo+1],u=b>a?clamp((x-a)/(b-a),0,1):0;t[i]=lx(lo+u)}return t})}
  // halation strength of this stock (mostly red: light reflected back by the film base)
  S.hal=o.halation>0&&o.proc!==2?at(film,2,20).slice(0,3).map(v=>(isNaN(v)?0:v)*o.halation):null;
  // grain (vkdt's three sub-layers per dye layer, finer in the slow layers)
  if(o.grain>0&&o.proc!==2){const dmx=fM.dmax.map(v=>Math.max(v,0.1)),dmin=at(film,2,21).slice(0,3),a0=fM.am[0],a1=fM.am[1],a2=dmx.map((v,k)=>Math.max(v-a0[k]-a1[k],0));
    const dabs=dmx.map((v,k)=>v+dmin[k]),ab=(a,k)=>a[k]+dmin[k]*a[k]/dmx[k],ir=dabs.map(v=>1/v),lf0=[0,1,2].map(k=>ab(a0,k)*ir[k]),lf01=[0,1,2].map(k=>lf0[k]+ab(a1,k)*ir[k]);
    const lum=35000/Math.max(o.fullW,o.fullH),ipa=1/Math.max(lum*lum,1e-6),fr=x=>at(film,2,x).slice(0,3).map(v=>Math.min((isNaN(v)?0:v)*ipa,1));
    const ff=fr(16),fmid=fr(17),fs=fr(18),un=at(film,2,19).slice(0,3);
    S.gr={dmin,ir,lf0,lf01,ilf0:lf0.map(v=>1/Math.max(v,1e-3)),ilf1:lf0.map((v,k)=>1/Math.max(lf01[k]-v,1e-3)),ilf2:lf01.map(v=>1/Math.max(1-v,1e-3)),
      wf:[0,1,2].map(k=>3*dabs[k]*ff[k]*ab(a0,k)),wm:[0,1,2].map(k=>3*dabs[k]*fmid[k]*ab(a1,k)),ws:[0,1,2].map(k=>3*dabs[k]*fs[k]*ab(a2,k)),un:un.map(v=>clamp((isNaN(v)?0.97:v),0,1))};
    // the dye clouds are about 2 µm across: the noise is blurred to that size (at least a little), then scaled by o.grain
    const sq=4/(lum*lum)+0.89*0.89;S.gr.sigma=Math.sqrt(Math.max(sq,0.16))*o.grain;S.gr.amt=1}
  // enlarger (negative onto paper) or scanner, both spectral
  const gp=o.gPaper||1,pM=model(paper,[gp,gp,gp]);S.pM=pM;
  S.pD=[0,1,2].map(k=>{const t=new Float32Array(G);for(let i=0;i<G;i++)t[i]=evalD(pM,lx(i),k);return t});
  if(o.proc!==1){S.en=[];S.enD=[];let ae2=0;const fs2=o.proc===2?-1:film;
    for(let b=0;b<41;b++){const l=380+b*10,s=sens(paper,b);let dd=[0,0,0,0],miss=false,base=1;if(fs2>=0){const r=dye(fs2,b);dd=r.d.map(v=>clamp(v,0,1e5));miss=r.miss;base=Math.pow(2,-dd[3]*(o.fBase??1)*LOG2_10)}
      const il=blackbody(l,3400)*KG3[b],com=il*base*Math.pow(2,ev_paper),lm=dichroic(l,neutral)*com,f=miss?[0,0,0]:s.map(v=>v*lm);
      S.en.push(f);S.enD.push(dd.slice(0,3));ae2+=(f[0]*LUMA[0]+f[1]*LUMA[1]+f[2]*LUMA[2])*Math.pow(2,-ev_paper)}
    S.enNorm=Math.max(1e-6,0.18*ae2)}
  {const dyeStock=o.proc===1?film:paper,m=dayW(5000);S.sc=[];S.scD=[];let ae3=0;const wp=[0,0,0],isPos=o.proc===1&&posStock;
    for(let b=0;b<41;b++){const l=380+b*10,r=dye(dyeStock,b),dd=r.d.map((v,i)=>i<3?Math.min(v,300):v),si=S0[b]+m[0]*S1[b]+m[1]*S2[b],cmf=[xF(l),yF(l),zF(l)];
      const fl=dichroic(l,isPos?neutral:[0,0,0]),bs=o.proc===1?(o.fBase??1):1,base=Math.pow(2,-dd[3]*bs*LOG2_10),f=r.miss?[0,0,0]:cmf.map(v=>si*fl*v*base);
      S.sc.push(f);S.scD.push(dd.slice(0,3));ae3+=o.proc===1?f[1]:si*cmf[1];if(!r.miss)for(let k=0;k<3;k++)wp[k]+=si*cmf[k]}
    S.scNorm=Math.max(ae3,1e-5);const w=wp.map(v=>v/Math.max(wp[1],1e-6)),a=mv(CAT,w),d=mv(CAT,D65),sc=d.map((v,k)=>v/Math.max(a[k],1e-6));
    S.adapt=mm(MXYZ_2020,mm(mm(CATI,[sc[0],0,0,0,sc[1],0,0,0,sc[2]]),CAT))}
  return S}
function pre(S,d){let L;if(S.pos)L=[0,1,2].map(k=>Math.max(S.dmax[k]-d[k],0));else L=[0,1,2].map(k=>d[k]*S.nd[k]/Math.max(S.kd[k]+d[k],1e-6));return mv(S.M,L)}
function post(S,c){if(!S.pos)return c;return c.map((v,k)=>v*(S.Kr[k]+S.cref[k])/Math.max(S.Kr[k]+v,1e-6))}
const tab=(t,y)=>{const f=clamp((y+4)*64-0.5,0,511),i=f|0,j=Math.min(511,i+1),u=f-i;return t[i]*(1-u)+t[j]*u};

/* spectral upsampling (Jakob & Hanika 2019, emission table made with vkdt's mkspectra at 256 × 256) */
function coeff(D,xyz){const b=xyz[0]+xyz[1]+xyz[2];let x=xyz[0]/b,y=xyz[1]/b;y=y/(1-x);x=(1-x)*(1-x);const N=256,i=clamp(Math.floor(x*N+0.5),0,N-1),j=clamp(Math.floor(y*N+0.5),0,N-1),o=(j*N+i)*4,s=D.spec;
  return[s[o],s[o+1],s[o+2],b/s[o+3]]}
const sig=(c,l)=>{const x=(c[0]*l+c[1])*l+c[2];return(0.5*x/Math.sqrt(x*x+1)+0.5)*c[3]};
/* scene colour (linear rec2020) -> log exposure of the film */
function expose(D,S,rgb){const c=coeff(D,mv(M2020_XYZ,rgb.map(v=>Math.max(5e-4,v))));let r=0,g=0,b=0;for(let i=0;i<36;i++){const v=sig(c,380+i*10),f=S.ef[i];r+=v*f[0];g+=v*f[1];b+=v*f[2]}
  return[r,g,b].map(v=>clamp(S.gFilm*(S.evFilm+Math.log2(v/S.eNorm+1e-10))*LOG10_2,-4,4))}
function dyeLight(dens,dd,fac){let r=0,g=0,b=0;for(let i=0;i<41;i++){const d=dd[i],l=Math.pow(2,-(dens[0]*d[0]+dens[1]*d[1]+dens[2]*d[2])),f=fac[i];r+=l*f[0];g+=l*f[1];b+=l*f[2]}return[r,g,b]}
/* film (or paper) density -> displayed colour, through the enlarger and the paper for a print */
function finish(S,dens){let d=dens;if(S.o.proc===0){const raw=dyeLight(d,S.enD,S.en);const y=raw.map(v=>Math.log2(v/S.enNorm+1e-10)*LOG10_2);d=[0,1,2].map(k=>tab(S.pD[k],y[k]))}
  const xyz=dyeLight(d,S.scD,S.sc).map(v=>Math.max(0,v/S.scNorm));return mv(M2020_709,mv(S.adapt,xyz))}
/* scanned negative (linear rec2020) printed on paper */
function printScan(D,S,rgb){const c=coeff(D,mv(M2020_XYZ,rgb.map(v=>Math.max(5e-4,v))));let r=0,g=0,b=0;for(let i=0;i<41;i++){const v=sig(c,380+i*10),f=S.en[i];r+=v*f[0];g+=v*f[1];b+=v*f[2]}
  const y=[r,g,b].map(v=>Math.log2(v/S.enNorm+1e-10)*LOG10_2),d=[0,1,2].map(k=>tab(S.pD[k],y[k]));const xyz=dyeLight(d,S.scD,S.sc).map(v=>Math.max(0,v/S.scNorm));return mv(M2020_709,mv(S.adapt,xyz))}

/* 3D tables, trilinear */
function lut3(N,f){const t=new Float32Array(N*N*N*3);let o=0;for(let b=0;b<N;b++)for(let g=0;g<N;g++)for(let r=0;r<N;r++){const v=f(r/(N-1),g/(N-1),b/(N-1));t[o++]=v[0];t[o++]=v[1];t[o++]=v[2]}return t}
function look(t,N,x,y,z,out){x=clamp(x,0,1)*(N-1);y=clamp(y,0,1)*(N-1);z=clamp(z,0,1)*(N-1);const x0=Math.min(N-2,x|0),y0=Math.min(N-2,y|0),z0=Math.min(N-2,z|0),u=x-x0,v=y-y0,w=z-z0;
  const i=((z0*N+y0)*N+x0)*3,dx=3,dy=N*3,dz=N*N*3;
  for(let k=0;k<3;k++){const a=t[i+k]+(t[i+dx+k]-t[i+k])*u,b=t[i+dy+k]+(t[i+dy+dx+k]-t[i+dy+k])*u,c=t[i+dz+k]+(t[i+dz+dx+k]-t[i+dz+k])*u,e=t[i+dz+dy+k]+(t[i+dz+dy+dx+k]-t[i+dz+dy+k])*u;
    const p=a+(b-a)*v,q=c+(e-c)*v;out[k]=p+(q-p)*w}return out}
function tables(D,S){const N=33;
  if(S.o.proc===2){S.A=lut3(N,(r,g,b)=>printScan(D,S,mv(M709_2020,[srgbDec(r),srgbDec(g),srgbDec(b)])).map(v=>srgbEnc(clamp(v,0,1))));return S}
  S.A=lut3(N,(r,g,b)=>expose(D,S,mv(M709_2020,[srgbDec(r),srgbDec(g),srgbDec(b)])));
  // densities: from a little below zero (grain) to a little above the film's maximum
  S.dlo=-0.15;S.dhi=Math.max(...S.fD.map(t=>Math.max(t[0],t[511])))+0.25;const NC=40,sp=S.dhi-S.dlo;S.NC=NC;
  S.C=lut3(NC,(a,b,c)=>finish(S,[S.dlo+a*sp,S.dlo+b*sp,S.dlo+c*sp]).map(v=>srgbEnc(clamp(v,0,1))));return S}

/* small helpers on Float32 planes */
function blurPlane(src,w,h,sig){if(sig<0.35)return src;const r=Math.max(1,Math.ceil(sig*2.5)),k=new Float32Array(2*r+1);let s=0;for(let i=-r;i<=r;i++){k[i+r]=Math.exp(-i*i/(2*sig*sig));s+=k[i+r]}for(let i=0;i<k.length;i++)k[i]/=s;
  const tmp=new Float32Array(w*h),out=new Float32Array(w*h);
  for(let y=0;y<h;y++){const o=y*w;for(let x=0;x<w;x++){let a=0;for(let i=-r;i<=r;i++)a+=src[o+clamp(x+i,0,w-1)]*k[i+r];tmp[o+x]=a}}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let a=0;for(let i=-r;i<=r;i++)a+=tmp[clamp(y+i,0,h-1)*w+x]*k[i+r];out[y*w+x]=a}return out}
const hash=(x,y,c)=>{let h=(x*374761393+y*668265263+c*2147483647)|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return(h>>>0)/4294967296};
/* approximately normal, from three uniforms */
const gnoise=(x,y,c)=>{let h=(x*374761393+y*668265263+c*2147483647)|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return((h&1023)+((h>>>10)&1023)+((h>>>20)&1023)-1534.5)*0.0039100684};
function grainStd(G,d,k){const np=clamp((d+G.dmin[k])*G.ir[k],0,1),p0=clamp(np*G.ilf0[k],0,1),p1=clamp((np-G.lf0[k])*G.ilf1[k],0,1),p2=clamp((np-G.lf01[k])*G.ilf2[k],0,1),u=G.un[k];
  const v=G.wf[k]*p0*Math.max(1-p0*u,0)+G.wm[k]*p1*Math.max(1-p1*u,0)+G.ws[k]*p2*Math.max(1-p2*u,0);return Math.sqrt(Math.max(v,0))}

/* the whole film, on an image: im (ImageData) -> new ImageData. sc = this image's scale against the full photo (preview) */
async function render(D,S,im,sc,onP){const w=im.width,h=im.height,a=im.data,n=w*h,out=new ImageData(w,h),o=out.data,t=[0,0,0];
  if(S.o.proc===2){for(let i=0;i<n;i++){const j=i*4;look(S.A,33,a[j]/255,a[j+1]/255,a[j+2]/255,t);o[j]=t[0]*255+0.5;o[j+1]=t[1]*255+0.5;o[j+2]=t[2]*255+0.5;o[j+3]=a[j+3];if(onP&&i%(w*64)===0){onP(i/n);await tick()}}return out}
  // 1. exposure of the negative
  const E=new Float32Array(n*3);for(let i=0;i<n;i++){const j=i*4;look(S.A,33,a[j]/255,a[j+1]/255,a[j+2]/255,t);E[i*3]=t[0];E[i*3+1]=t[1];E[i*3+2]=t[2]}
  onP&&onP(0.2);await tick();
  // spatial passes on a smaller copy (at most 900 px), read back bilinearly
  const k=Math.min(1,900/Math.max(w,h)),sw=Math.max(1,Math.round(w*k)),sh=Math.max(1,Math.round(h*k)),pxUm=Math.max(w,h)*k/35000;
  const small=(f)=>{const P=[new Float32Array(sw*sh),new Float32Array(sw*sh),new Float32Array(sw*sh)];for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const sx=Math.min(w-1,Math.floor((x+0.5)/k)),sy=Math.min(h-1,Math.floor((y+0.5)/k)),v=f(sy*w+sx);for(let c=0;c<3;c++)P[c][y*sw+x]=v[c]}return P};
  const samp=(P,x,y,c)=>{const fx=clamp((x+0.5)*k-0.5,0,sw-1),fy=clamp((y+0.5)*k-0.5,0,sh-1),x0=fx|0,y0=fy|0,x1=Math.min(sw-1,x0+1),y1=Math.min(sh-1,y0+1),u=fx-x0,v=fy-y0,p=P[c];
    return(p[y0*sw+x0]*(1-u)+p[y0*sw+x1]*u)*(1-v)+(p[y1*sw+x0]*(1-u)+p[y1*sw+x1]*u)*v};
  // 2. halation: light scattered back by the film base, blurred around bright areas
  if(S.hal){const P=small(i=>[0,1,2].map(c=>Math.pow(10,E[i*3+c]))),sg=Math.max(0.35,65*pxUm),B=P.map(p=>blurPlane(p,sw,sh,sg)),hs=S.hal;
    const LN10=2.302585092994046,ih=hs.map(v=>1/(1+v)),B0=B[0],B1=B[1],B2=B[2];
    for(let y=0;y<h;y++){const fy=clamp((y+0.5)*k-0.5,0,sh-1),y0=fy|0,y1=Math.min(sh-1,y0+1),v=fy-y0;
      for(let x=0;x<w;x++){const fx=clamp((x+0.5)*k-0.5,0,sw-1),x0=fx|0,x1=Math.min(sw-1,x0+1),u=fx-x0,a00=y0*sw+x0,a01=y0*sw+x1,a10=y1*sw+x0,a11=y1*sw+x1,w00=(1-u)*(1-v),w01=u*(1-v),w10=(1-u)*v,w11=u*v,i=(y*w+x)*3;
        const hl0=B0[a00]*w00+B0[a01]*w01+B0[a10]*w10+B0[a11]*w11,hl1=B1[a00]*w00+B1[a01]*w01+B1[a10]*w10+B1[a11]*w11,hl2=B2[a00]*w00+B2[a01]*w01+B2[a10]*w10+B2[a11]*w11;
        E[i]=Math.log(Math.max((Math.exp(E[i]*LN10)+hs[0]*Math.max(0,hl0))*ih[0],1e-10))/LN10;E[i+1]=Math.log(Math.max((Math.exp(E[i+1]*LN10)+hs[1]*Math.max(0,hl1))*ih[1],1e-10))/LN10;E[i+2]=Math.log(Math.max((Math.exp(E[i+2]*LN10)+hs[2]*Math.max(0,hl2))*ih[2],1e-10))/LN10}}}
  onP&&onP(0.35);await tick();
  // 3. DIR couplers: what develops in one place holds back development nearby (more colour, more local contrast)
  let C=null;if(S.cp){const P=small(i=>pre(S,[0,1,2].map(c=>tab(S.fD[c],E[i*3+c])))),sg=20*pxUm;C=P.map(p=>blurPlane(p,sw,sh,Math.max(sg,0.35)))}
  onP&&onP(0.45);await tick();
  // 4. development, grain, print: in bands so that the grain noise can be blurred
  const G=S.gr,gs=G?G.sigma*sc:0,gr=G?Math.max(1,Math.ceil(gs*2.5)):0,kk=G?(()=>{const kv=[];let s=0,s2=0;for(let i=-gr;i<=gr;i++){const v=Math.exp(-i*i/(2*Math.max(gs,0.3)**2));kv.push(v);s+=v}const nk=kv.map(v=>v/s);for(const v of nk)s2+=v*v;return{nk,norm:1/s2}})():null;
  // averaging several pixels of a reduced preview lowers the grain like the eye would see it at that size
  const gAmp=G?Math.min(1,sc)*G.amt:0,band=64,cv=[0,0,0],d=[0,0,0],sp=S.dhi-S.dlo,gsK=255/sp;
  // grain strength by density, tabulated
  const GS=G?[0,1,2].map(c=>{const t=new Float32Array(256);for(let q=0;q<256;q++)t[q]=grainStd(G,S.dlo+(q+0.5)/gsK,c);return t}):null;
  for(let y0=0;y0<h;y0+=band){const y1=Math.min(h,y0+band);let N=null;
    if(G){const py0=y0-gr,ph=y1-y0+2*gr,W2=w+2*gr;N=[0,1,2].map(c=>{const raw=new Float32Array(W2*ph);for(let yy=0;yy<ph;yy++)for(let xx=0;xx<W2;xx++)raw[yy*W2+xx]=gnoise(Math.round((xx-gr)/sc),Math.round((py0+yy)/sc),c*31+1);
        const tmp=new Float32Array(W2*ph),o2=new Float32Array(w*(y1-y0));for(let yy=0;yy<ph;yy++)for(let xx=gr;xx<w+gr;xx++){let s=0;for(let i=-gr;i<=gr;i++)s+=raw[yy*W2+xx+i]*kk.nk[i+gr];tmp[yy*W2+xx]=s}
        for(let yy=gr;yy<ph-gr;yy++)for(let xx=gr;xx<w+gr;xx++){let s=0;for(let i=-gr;i<=gr;i++)s+=tmp[(yy+i)*W2+xx]*kk.nk[i+gr];o2[(yy-gr)*w+xx-gr]=s*kk.norm}return o2})}
    for(let y=y0;y<y1;y++)for(let x=0;x<w;x++){const i=y*w+x,j=i*4;
      if(C){cv[0]=samp(C,x,y,0);cv[1]=samp(C,x,y,1);cv[2]=samp(C,x,y,2);if(S.pos)for(let c=0;c<3;c++)cv[c]=cv[c]*(S.Kr[c]+S.cref[c])/Math.max(S.Kr[c]+cv[c],1e-6)}
      for(let c=0;c<3;c++){let lr=E[i*3+c];if(C)lr=tab(S.cw[c],clamp(lr-cv[c],-4,4));
        let dd=tab(S.fD[c],lr);if(G){const q=clamp((dd-S.dlo)*gsK,0,255)|0;dd=Math.max(dd+N[c][(y-y0)*w+x]*GS[c][q]*gAmp,-G.dmin[c])}d[c]=dd}
      look(S.C,S.NC,(d[0]-S.dlo)/sp,(d[1]-S.dlo)/sp,(d[2]-S.dlo)/sp,t);o[j]=t[0]*255+0.5;o[j+1]=t[1]*255+0.5;o[j+2]=t[2]*255+0.5;o[j+3]=a[j+3]}
    if(onP){onP(0.45+0.55*y1/h);await tick()}}
  return out}

/* ---------- contraste local : pyramides laplaciennes locales (Paris, Hasinoff et Kautz 2011, version rapide d'Aubry et al. 2014) ---------- */
/* réécrit d'après la publication et le module « llap » de vkdt (même courbe de remappage) ; sur la luminance, couleurs reconstituées en proportion */
function llCurve(x,g,s,sh,hi,cl){const c=x-g,ss=c>0?s:-s,k=c>0?sh:hi;let v;if(Math.abs(c)>2*s)v=g+ss+k*(c-ss);else{const t=clamp(c/(2*ss),0,1);v=g+ss*2*(1-t)*t+t*t*(ss+ss*k)}return v+cl*c*Math.exp(-c*c/(2*s*s/3))}
function down(a,w,h){const W=Math.max(1,(w+1)>>1),H=Math.max(1,(h+1)>>1),t=new Float32Array(W*h),o=new Float32Array(W*H),K=[1,4,6,4,1];
  for(let y=0;y<h;y++)for(let x=0;x<W;x++){let s=0;for(let i=-2;i<=2;i++)s+=a[y*w+clamp(2*x+i,0,w-1)]*K[i+2];t[y*W+x]=s/16}
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){let s=0;for(let i=-2;i<=2;i++)s+=t[clamp(2*y+i,0,h-1)*W+x]*K[i+2];o[y*W+x]=s/16}return{a:o,w:W,h:H}}
function up(a,W,H,w,h){const o=new Float32Array(w*h);for(let y=0;y<h;y++){const fy=clamp((y+0.5)/2-0.5,0,H-1),y0=fy|0,y1=Math.min(H-1,y0+1),v=fy-y0;
    for(let x=0;x<w;x++){const fx=clamp((x+0.5)/2-0.5,0,W-1),x0=fx|0,x1=Math.min(W-1,x0+1),u=fx-x0;o[y*w+x]=(a[y0*W+x0]*(1-u)+a[y0*W+x1]*u)*(1-v)+(a[y1*W+x0]*(1-u)+a[y1*W+x1]*u)*v}}return o}
function gpyr(a,w,h,n){const P=[{a,w,h}];for(let l=1;l<n;l++)P.push(down(P[l-1].a,P[l-1].w,P[l-1].h));return P}
async function localContrast(im,p,onP){const w=im.width,h=im.height,n=w*h,d=im.data,Y=new Float32Array(n);
  for(let i=0;i<n;i++){const j=i*4;Y[i]=(0.2126*d[j]+0.7152*d[j+1]+0.0722*d[j+2])/255}
  const NL=Math.max(2,Math.min(9,Math.floor(Math.log2(Math.min(w,h)/6)))),G=gpyr(Y,w,h,NL),K=8,gam=i=>i/(K-1);
  const out=G.map((g,l)=>l<NL-1?new Float32Array(g.w*g.h):Float32Array.from(G[NL-1].a));
  for(let i=0;i<K;i++){const gi=gam(i),R=new Float32Array(n);for(let q=0;q<n;q++)R[q]=llCurve(Y[q],gi,p.sigma,p.shadows,p.highlights,p.clarity);
    const P=gpyr(R,w,h,NL);
    for(let l=0;l<NL-1;l++){const A=P[l],B=P[l+1],U=up(B.a,B.w,B.h,A.w,A.h),g=G[l].a,o=out[l];
      // this gamma's share at each pixel: hat function around gi in the photo's own (smoothed) tone
      for(let q=0;q<A.a.length;q++){const t=Math.abs(g[q]-gi)*(K-1);if(t<1)o[q]+=(A.a[q]-U[q])*(1-t)}}
    onP&&onP((i+1)/(K+1));await tick()}
  let r=out[NL-1];for(let l=NL-2;l>=0;l--){const g=G[l],U=up(r,G[l+1].w,G[l+1].h,g.w,g.h),o=out[l];for(let q=0;q<o.length;q++)o[q]+=U[q];r=o}
  const res=new ImageData(w,h),o=res.data;for(let i=0;i<n;i++){const j=i*4,y=Y[i],k=y>1e-4?clamp(r[i],0,1.5)/y:1;
    if(y>1e-4){o[j]=d[j]*k;o[j+1]=d[j+1]*k;o[j+2]=d[j+2]*k}else{const v=clamp(r[i],0,1)*255;o[j]=o[j+1]=o[j+2]=v}o[j+3]=d[j+3]}return res}

/* ---------- boîtes de dialogue ---------- */
const mixSel=(o,r,sel)=>{const out=cloneC(o),g=cx(out);g.globalCompositeOperation='destination-out';g.drawImage(sel,0,0);const t=cloneC(r),tg=cx(t);tg.globalCompositeOperation='destination-in';tg.drawImage(sel,0,0);g.globalCompositeOperation='lighter';g.drawImage(t,0,0);return out};
const imOf=c=>rx(c).getImageData(0,0,c.width,c.height);
const proxy=(c,max)=>{const k=Math.min(1,max/Math.max(c.width,c.height));if(k>=1)return{c,k:1};const t=mk(Math.max(1,Math.round(c.width*k)),Math.max(1,Math.round(c.height*k))),g=rx(t);g.imageSmoothingQuality='high';g.drawImage(c,0,0,t.width,t.height);return{c:t,k}};
const toCanvas=im=>{const c=mk(im.width,im.height);rx(c).putImageData(im,0,0);return c};
/* blend toward the original (Intensité) and back to the layer's size */
function finalC(L,res,amt){const c=mk(L.canvas.width,L.canvas.height),g=cx(c);g.drawImage(L.canvas,0,0);g.globalAlpha=amt;g.imageSmoothingQuality='high';g.drawImage(res,0,0,c.width,c.height);g.globalAlpha=1;
  // keep the layer's own transparency
  g.globalCompositeOperation='destination-in';g.drawImage(L.canvas,0,0);return c}
/* a dialog with a live preview on a reduced copy and the full computation on Appliquer */
function liveDialog(o){const d=S.doc;if(!d)return;const L=pixelTarget();if(!L){toast('Aucun calque de pixels');return}if(L.visible===false){toast('Ce calque est masqué : affichez-le d’abord');return}
  const p={...o.init};let tmr=null,job=0;const alive=()=>S.doc===d&&d.layers.includes(L),src=proxy(L.canvas,1100);
  const clear=()=>{clearTimeout(tmr);job++;delete L.preview};
  const prev=()=>{clearTimeout(tmr);tmr=setTimeout(async()=>{const my=++job;try{const r=await o.run(src.c,src.k,p,null,L);if(my!==job||!alive())return;let c=finalC(L,toCanvas(r),p.amount/100);if(d.sel)c=mixSel(L.canvas,c,d.sel);L.preview=c;markComp()}catch(e){console.error(e);toast('Aperçu impossible : '+(e.message||e),3000)}},180)};
  const row=q=>q[1]==='select'?`<div class="row"><label for="lm-${q[0]}">${q[2]}</label><select id="lm-${q[0]}">${q[3].map((t,i)=>`<option value="${i}"${i===p[q[0]]?' selected':''}>${t}</option>`).join('')}</select></div>`:rangeRow('lm-'+q[0],q[1],q[2],q[3],q[4],p[q[0]],q[6]);
  dialog({title:o.title,light:true,body:(o.note?`<p class="muted" style="margin:0 0 8px">${o.note}</p>`:'')+o.params.map(row).join('')+(d.sel?'<p class="muted">Appliqué uniquement à la sélection.</p>':''),
    onOpen:el=>{o.params.forEach(q=>{const i=$('#lm-'+q[0],el);if(q[1]==='select')i.onchange=()=>{p[q[0]]=+i.value;o.sync&&o.sync(el,p);prev()};else i.oninput=()=>{p[q[0]]=+i.value;$('#lm-'+q[0]+'-o',el).textContent=fmtN(+i.value,q[4])+q[6];prev()}});o.sync&&o.sync(el,p);prev()},
    buttons:[{label:'Annuler',onClick:()=>{clear();markComp()}},
      {label:'Appliquer',primary:true,onClick:()=>{clear();markComp();if(!alive()){toast('Le calque n’existe plus');return}
        (async()=>{busy(true,o.title+'…',0);try{const r=await o.run(L.canvas,1,p,v=>busy(true,o.title+'…',v),L);if(!alive())return;let c=finalC(L,toCanvas(r),p.amount/100);applyMasked(L,c,o.title);syncAll()}
          catch(e){console.error(e);toast(o.title+' impossible : '+(e.message||e),5000)}finally{busy(false)}})()}}]})}
/* film settings -> engine state, cached while only the grain or the strength change */
let stC=null;
async function filmState(p,proc,fullW,fullH){const D=await loadData(),o={film:p.film,paper:p.paper,proc,evFilm:p.ev,gFilm:p.contrast/100,couplers:p.couplers/100,halation:p.halation/100,grain:p.grain/100,tuneY:p.warm/100,tuneM:p.tint/100,evPaper:p.evPaper||0,fullW,fullH};
  const key=JSON.stringify(o);if(stC&&stC.key===key)return stC.S;const S=tables(D,setup(D,o));stC={key,S};return S}
const POS=new Set([16,17,18,19,21]);
function filmDialog(){const d=S.doc;if(!d)return;
  liveDialog({title:'Simulation de pellicule',note:'Rendu de vraies pellicules et papiers de tirage, simulés à partir de leurs courbes spectrales : couleurs, grain et halo. Les diapositives sont rendues comme scannées, sans tirage.',
    init:{film:4,paper:3,ev:0,contrast:100,couplers:50,halation:100,grain:100,warm:0,tint:0,amount:100},
    params:[['film','select','Pellicule',FILMS],['paper','select','Papier de tirage',PAPERS],['ev','Exposition',-2,2,0.1,0,' IL'],['contrast','Contraste',60,140,1,0,' %'],['couplers','Couleurs',0,100,1,0,' %'],
      ['halation','Halo',0,300,1,0,' %'],['grain','Grain',0,250,1,0,' %'],['warm','Chaleur',-100,100,1,0,''],['tint','Teinte',-100,100,1,0,''],['amount','Intensité',0,100,1,0,' %']],
    sync:(el,p)=>{$('#lm-paper',el).closest('.row').hidden=POS.has(p.film)},
    run:async(c,k,p,onP)=>{const S=await filmState(p,POS.has(p.film)?1:0,d.w,d.h);return render(FM.data,S,imOf(c),k,onP)}})}
function negDialog(){const d=S.doc;if(!d)return;
  liveDialog({title:'Tirer un négatif scanné',note:'Pour la photo ou le scan d’un négatif couleur : il est tiré sur un papier photo virtuel, ce qui retire le masque orange et donne des couleurs de vrai tirage. Choisissez la pellicule du négatif si vous la connaissez.',
    init:{film:4,paper:3,evPaper:0,warm:0,tint:0,amount:100},
    params:[['film','select','Pellicule du négatif',FILMS.slice(0,16)],['paper','select','Papier de tirage',PAPERS],['evPaper','Exposition du tirage',-3,3,0.1,0,' IL'],['warm','Chaleur',-100,100,1,0,''],['tint','Teinte',-100,100,1,0,''],['amount','Intensité',0,100,1,0,' %']],
    run:async(c,k,p,onP)=>{const D=await loadData(),o={film:p.film,paper:p.paper,proc:2,evPaper:-p.evPaper,tuneY:p.warm/100,tuneM:p.tint/100,fullW:d.w,fullH:d.h};
      const key='neg'+JSON.stringify(o);let S;if(stC&&stC.key===key)S=stC.S;else{S=tables(D,setup(D,o));stC={key,S}}return render(D,S,imOf(c),k,onP)}})}
function llapDialog(){liveDialog({title:'Contraste local',note:'Renforce ou adoucit le relief des détails sans halo, et règle ombres et hautes lumières localement.',
  init:{clarity:30,shadows:100,highlights:100,sigma:12,amount:100},
  params:[['clarity','Clarté',-100,200,1,0,' %'],['shadows','Ombres',30,170,1,0,' %'],['highlights','Hautes lumières',30,170,1,0,' %'],['sigma','Étendue des tons moyens',4,30,1,0,' %'],['amount','Intensité',0,100,1,0,' %']],
  run:(c,k,p,onP)=>localContrast(imOf(c),{clarity:p.clarity/100,shadows:p.shadows/100,highlights:p.highlights/100,sigma:p.sigma/100},onP)})}

/* ---------- menus ---------- */
const _fiF=MENU2.filter.items;
MENU2.filter.items=function(){const a=_fiF.apply(this,arguments),dis=S.doc?false:NODOC,it=MI('Rendu film',{icon:'filter',dis,sub:()=>[MI('Simulation de pellicule…',{fn:filmDialog,dis}),MI('Tirer un négatif scanné…',{fn:negDialog,dis})]});
  const k=a.findIndex(x=>x&&x.label==='Portrait et restauration…');a.splice(k<0?a.length:k+1,0,it);
  // local contrast sits with the other detail filters
  const ns=a.find(x=>x&&x.label==='Netteté et bruit'&&x.sub);if(ns){const sub=ns.sub;ns.sub=()=>{const s=typeof sub==='function'?sub():sub.slice();s.push(MI('Contraste local…',{fn:llapDialog,dis}));return s}}else a.push(MI('Contraste local…',{fn:llapDialog,dis}));return a};
window.PrismFilm={loadData,setup,tables,render,localContrast,film:filmDialog,neg:negDialog,llap:llapDialog,FILMS,PAPERS};
