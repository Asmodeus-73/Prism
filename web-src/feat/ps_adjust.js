/* ===== Réglages de Photo Studio (MIT) : niveaux, mélangeur de couches, correction sélective, filtre photo, carte de dégradé, remplacement de couleur.
   Ce sont des filtres Prism : modifiables ensuite (Filtre > Effets du calque…) et enregistrables dans les actions. ===== */
const PSX=window.PSX;
const adj=(img,kind,params)=>['adjust',{img,adj:{kind,params}}];
const lv=(b=0,w=255,g=1,ob=0,ow=255)=>({inBlack:b,inWhite:w,gamma:g,outBlack:ob,outWhite:ow});
const hex2=h=>{const v=parseInt(String(h||'#000000').slice(1),16);return[(v>>16)&255,(v>>8)&255,v&255]};

/* Niveaux : un canal à la fois ; les réglages des autres canaux sont gardés */
const LV_CH=['rgb','r','g','b'];
PSX.filter('levels',{name:'Niveaux',
  params:[['ch','Canal',0,3,1,0,''],['inBlack','Noir (entrée)',0,253,1,0,''],['gamma','Tons moyens',0.1,9.99,0.01,1,''],['inWhite','Blanc (entrée)',2,255,1,255,''],['outBlack','Noir (sortie)',0,255,1,0,''],['outWhite','Blanc (sortie)',0,255,1,255,'']],
  choices:{ch:['RVB','Rouge','Vert','Bleu']},
  onInput:(k,p,el)=>{p.lv=p.lv||{};const ch=LV_CH[p.ch|0],keys=['inBlack','gamma','inWhite','outBlack','outWhite'];
    if(k==='ch'){const v=p.lv[ch]||lv();keys.forEach(x=>{p[x]=v[x];const i=$('#ps-'+x,el);if(i){i.value=v[x];const o=$('#ps-'+x+'-o',el);if(o)o.textContent=fmtN(v[x],+i.step)}})}
    else{const v={...(p.lv[ch]||lv())};keys.forEach(x=>v[x]=p[x]);if(v.inWhite<=v.inBlack+2)v.inWhite=v.inBlack+2;p.lv={...p.lv,[ch]:v}}},
  /* les curseurs affichés valent pour le canal choisi (aussi quand l'effet est modifié plus tard, où seuls les curseurs changent) */
  job:(img,p)=>{const L={rgb:lv(),r:lv(),g:lv(),b:lv(),...(p.lv||{})};L[LV_CH[p.ch|0]]=lv(p.inBlack,Math.max(p.inBlack+2,p.inWhite),p.gamma,p.outBlack,p.outWhite);return adj(img,'levels',L)}});

/* Mélangeur de couches : chaque couche de sortie est un mélange des trois couches d'entrée */
const MX=[['r','Rouge'],['g','Vert'],['b','Bleu']],MXK={r:'red',g:'green',b:'blue'};
PSX.filter('chmix',{name:'Mélangeur de couches',
  params:[['mono','Monochrome (la sortie rouge donne le gris)',0,1,1,0,'']].concat(...MX.map(([o,ol])=>[[o+'r',ol+' ← rouge',-200,200,1,o==='r'?100:0,' %'],[o+'g',ol+' ← vert',-200,200,1,o==='g'?100:0,' %'],[o+'b',ol+' ← bleu',-200,200,1,o==='b'?100:0,' %'],[o+'c',ol+' : constante',-200,200,1,0,' %']])),
  checks:['mono'],
  job:(img,p)=>{const row=o=>({r:p[o+'r'],g:p[o+'g'],b:p[o+'b'],constant:p[o+'c']});return adj(img,'channel-mixer',{red:row('r'),green:row('g'),blue:row('b'),gray:row('r'),monochrome:!!p.mono})}});

/* Correction sélective : cyan, magenta, jaune, noir ajoutés ou retirés dans une famille de couleurs */
const SC=['reds','yellows','greens','cyans','blues','magentas','whites','neutrals','blacks'];
const SCL=['Rouges','Jaunes','Verts','Cyans','Bleus','Magentas','Blancs','Neutres','Noirs'];
const cmyk=()=>({cyan:0,magenta:0,yellow:0,black:0});
PSX.filter('selcolor',{name:'Correction sélective',
  params:[['range','Couleurs',0,8,1,0,''],['cyan','Cyan',-100,100,1,0,' %'],['magenta','Magenta',-100,100,1,0,' %'],['yellow','Jaune',-100,100,1,0,' %'],['black','Noir',-100,100,1,0,' %'],['method','Méthode',0,1,1,0,'']],
  choices:{range:SCL,method:['Relative','Absolue']},
  onInput:(k,p,el)=>{p.sc=p.sc||{};const r=SC[p.range|0],keys=['cyan','magenta','yellow','black'];
    if(k==='range'){const v=p.sc[r]||cmyk();keys.forEach(x=>{p[x]=v[x];const i=$('#ps-'+x,el);if(i){i.value=v[x];const o=$('#ps-'+x+'-o',el);if(o)o.textContent=v[x]+' %'}})}
    else if(keys.includes(k)){const v={};keys.forEach(x=>v[x]=p[x]);p.sc={...p.sc,[r]:v}}},
  job:(img,p)=>{const ranges={};SC.forEach(n=>ranges[n]={...cmyk(),...((p.sc||{})[n]||{})});ranges[SC[p.range|0]]={cyan:p.cyan,magenta:p.magenta,yellow:p.yellow,black:p.black};
    return adj(img,'selective-color',{ranges,method:p.method?'absolute':'relative'})}});

/* Filtre photo : la teinte d'un filtre posé devant l'objectif */
const PF=[['Réchauffant',[238,150,40]],['Réchauffant fort',[230,112,20]],['Refroidissant',[40,120,240]],['Refroidissant fort',[10,80,235]],['Sépia',[170,120,60]],['Eau profonde',[0,170,160]],['Couleur choisie',null]];
PSX.filter('photofilter',{name:'Filtre photo',
  params:[['preset','Filtre',0,6,1,0,''],['density','Densité',0,100,1,25,' %'],['keep','Conserver la luminosité',0,1,1,1,'']],
  choices:{preset:PF.map(x=>x[0])},checks:['keep'],
  extraBody:p=>`<div class="row"><label for="ps-col">Couleur choisie</label><input type="color" id="ps-col" value="${esc(p.col||'#ec8a00')}"><output></output></div>`,
  onOpen:(el,p,refresh)=>{const c=$('#ps-col',el);p.col=c.value;c.oninput=()=>{p.col=c.value;p.preset=6;const s=$('#ps-preset',el);if(s)s.value=6;refresh()}},
  job:(img,p)=>{const c=PF[p.preset|0][1]||hex2(p.col||'#ec8a00');return adj(img,'photo-filter',{preset:'custom',color:c,density:p.density,preserveLuminosity:!!p.keep})}});

/* Carte de dégradé : la luminosité de chaque pixel choisit une couleur du dégradé */
const GM=[['Noir vers blanc',[[0,[0,0,0]],[1,[255,255,255]]]],['Bleu nuit vers crème',[[0,[18,24,58]],[0.55,[150,120,110]],[1,[250,236,210]]]],['Sépia',[[0,[30,18,8]],[0.5,[150,105,60]],[1,[250,235,205]]]],
  ['Bichromie bleu et orange',[[0,[10,40,90]],[0.5,[120,120,120]],[1,[255,170,60]]]],['Coucher de soleil',[[0,[40,10,60]],[0.4,[200,50,60]],[0.75,[250,150,50]],[1,[255,240,180]]]],['Vert forêt',[[0,[8,24,14]],[0.6,[90,140,80]],[1,[235,245,215]]]],['Infrarouge',[[0,[20,0,40]],[0.35,[180,20,90]],[0.7,[255,200,40]],[1,[255,255,255]]]]];
PSX.filter('gradmap',{name:'Carte de dégradé',
  params:[['preset','Dégradé',0,GM.length-1,1,0,''],['reverse','Inverser',0,1,1,0,''],['amount','Intensité',0,100,1,100,' %']],
  choices:{preset:GM.map(x=>x[0])},checks:['reverse'],
  job:(img,p)=>{const g={stops:GM[p.preset|0][1].map(([location,color])=>({location,color}))};
    const sel=p.amount<100?{width:img.width,height:img.height,data:new Uint8Array(img.width*img.height).fill(Math.round(p.amount*2.55))}:undefined;
    return['adjust',{img,adj:{kind:'gradient-map',params:{gradient:g,reverse:!!p.reverse,dither:true}},selection:sel}]}});

/* Remplacement de couleur : une couleur prélevée (et ses voisines) change de teinte, saturation, luminosité */
PSX.filter('replcolor',{name:'Remplacement de couleur',
  note:'Choisissez la couleur à changer (la pipette de la barre d’outils prélève dans la photo), puis décalez-la.',
  params:[['fuzz','Tolérance',0,200,1,40,''],['hue','Teinte',-180,180,1,0,'°'],['sat','Saturation',-100,100,1,0,''],['light','Luminosité',-100,100,1,0,'']],
  extraBody:p=>`<div class="row"><label for="ps-col">Couleur à changer</label><input type="color" id="ps-col" value="${esc(p.col||S.color||'#c03030')}"><output></output></div>`,
  onOpen:(el,p,refresh)=>{const c=$('#ps-col',el);p.col=c.value;c.oninput=()=>{p.col=c.value;refresh()}},
  job:(img,p)=>['replaceColor',{img,p:{color:hex2(p.col||'#c03030'),fuzziness:p.fuzz,hue:p.hue,saturation:p.sat,lightness:p.light}}]});

const items=()=>{const o=(id,l)=>MI(l,{dis:S.doc?false:NODOC,fn:()=>filterDialog(id)});
  return[o('levels','Niveaux…'),o('shhl','Ombres et hautes lumières…'),o('chmix','Mélangeur de couches…'),o('selcolor','Correction sélective…'),o('photofilter','Filtre photo…'),o('gradmap','Carte de dégradé…'),o('replcolor','Remplacement de couleur…')]};
PSX.addToMenu('image','Réglages avancés',items,/^Taille de l’image/);
