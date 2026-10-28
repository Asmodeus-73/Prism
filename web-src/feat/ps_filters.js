/* ===== Netteté des détails, débruitage rapide, ombres et hautes lumières (Photo Studio, MIT) ===== */
const PSX=window.PSX;

/* déconvolution de Richardson-Lucy régularisée : rend du piqué à un léger flou de bougé ou de mise au point sans gonfler le bruit */
PSX.filter('sharpdet',{name:'Netteté des détails',preview:'crop',
  note:'Pour une photo un peu floue (bougé léger, mise au point à côté). Le bruit mesuré dans la photo n’est pas renforcé.',
  params:[['amount','Quantité',0,300,1,100,' %'],['radius','Rayon du flou',0.3,8,0.1,1.2,' px'],['model','Type de flou',0,1,1,0,''],['iterations','Itérations',1,60,1,20,''],['noise','Protection du bruit',0,100,1,30,' %']],
  choices:{model:['Flou doux','Flou de mise au point']},
  job:(img,p,sc)=>['deconvolve',{img,o:{model:p.model?'lens':'gaussian',radius:Math.max(0.2,p.radius*sc),iterations:Math.round(p.iterations),noise:p.noise/100,amount:p.amount/100}}]});

/* moyennes non locales sur la luminance, bruit estimé tout seul ; couleur lissée par filtre guidé */
PSX.filter('nlmeans',{name:'Débruitage rapide',preview:'crop',
  note:'Sans IA : le niveau de bruit est mesuré dans la photo. Plus rapide que le débruitage IA, un peu moins fin.',
  params:[['strength','Luminance',0,100,1,50,' %'],['color','Couleur',0,100,1,60,' %'],['detail','Préserver les détails',0,100,1,35,' %'],['wide','Recherche étendue (plus lisse, plus lent)',0,1,1,0,'']],
  checks:['wide'],
  job:(img,p)=>['denoise',{img,o:{strength:p.strength/100,color:p.color/100,detail:p.detail/100,wide:!!p.wide}}]});

/* ombres et hautes lumières adaptatives (luminosité du voisinage), comme Image > Réglages > Tons foncés/Tons clairs */
PSX.filter('shhl',{name:'Ombres et hautes lumières',
  params:[['shadowsAmount','Ombres : quantité',0,100,1,35,' %'],['shadowsTone','Ombres : étendue',0,100,1,50,' %'],['shadowsRadius','Ombres : rayon',1,500,1,30,' px'],
    ['highlightsAmount','Hautes lumières : quantité',0,100,1,0,' %'],['highlightsTone','Hautes lumières : étendue',0,100,1,50,' %'],['highlightsRadius','Hautes lumières : rayon',1,500,1,30,' px'],
    ['colorCorrection','Saturation des zones corrigées',-100,100,1,20,''],['midtoneContrast','Contraste des tons moyens',-100,100,1,0,'']],
  job:(img,p,sc)=>['shadowsHighlights',{img,p:{...p},scale:sc}]});

PSX.addToMenu('filter','Netteté et bruit',()=>[MI('Netteté des détails…',{dis:S.doc?false:NODOC,fn:()=>filterDialog('sharpdet')}),MI('Débruitage rapide…',{dis:S.doc?false:NODOC,fn:()=>filterDialog('nlmeans')})]);
