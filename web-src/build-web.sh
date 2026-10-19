#!/bin/bash
# usage: build-web.sh [DIR] -> index.html = index.base.html + window.PRISM_VERSION (from ../package.json) + feat/*.js (sorted) spliced before the last </script>
D=${1:-$(cd "$(dirname "$0")" && pwd)}; cd "$D" || exit 1
python3 - <<'PY' || exit 1
import glob,re
s=open('index.base.html',encoding='utf-8').read()
i=s.rindex('</script>')
import json,os
ver=json.load(open(os.path.join(os.path.dirname(os.path.abspath('index.base.html')),'..','package.json')))['version']
add='\nwindow.PRISM_VERSION='+json.dumps(ver)+';\n'+''.join('\n/* ===== feat: %s ===== */\n{\n'%f+open(f,encoding='utf-8').read()+'\n}\n' for f in sorted(glob.glob('feat/*.js')))
open('index.html','w',encoding='utf-8').write(s[:i]+add+s[i:])
m=max(re.findall(r'<script(?![^>]*src)[^>]*>([\s\S]*?)</script>',open('index.html',encoding='utf-8').read()),key=len)
open('/tmp/_chk_%s.js'%__import__('os').getpid(),'w',encoding='utf-8').write(m)
print('built',len(s)+len(add),'bytes, feats:',len(glob.glob('feat/*.js')))
import subprocess,os
r=subprocess.run(['node','--check','/tmp/_chk_%d.js'%os.getpid()]);os.remove('/tmp/_chk_%d.js'%os.getpid());print('SYNTAX_OK' if r.returncode==0 else 'SYNTAX_FAIL')
PY
