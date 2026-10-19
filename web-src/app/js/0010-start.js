let CS='srgb';const P3_OK=(()=>{try{const c=document.createElement('canvas');c.width=c.height=1;const g=c.getContext('2d',{colorSpace:'display-p3'});return!!(g&&g.getContextAttributes&&g.getContextAttributes().colorSpace==='display-p3')}catch(e){return false}})();
'use strict';
