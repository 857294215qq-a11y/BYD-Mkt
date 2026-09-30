#!/bin/sh
# Rebuild: python3 build_map.py (in a folder containing osm/ and the INE/Idescat inputs) then ./build.sh
#   ../index.html     – standalone page (d3 inlined, works offline)
#   artifact.html     – same page for claude.ai publishing (no html/head/body wrapper, d3 from cdnjs)
cd "$(dirname "$0")"
python3 - <<'PY'
import re
t=open('template.html').read()
t=t.replace('/*MAPDATA*/', open('mapdata.js').read()).replace('/*APP*/', open('app.js').read())
open('../index.html','w').write(t.replace('/*D3*/', open('d3.min.js').read()))
a=t.replace('<script>/*D3*/</script>','<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>')
head_end=a.index('</head>')
head=a[:head_end]
head=head[head.index('<title>'):]
body=a[a.index('<body>')+len('<body>'):a.rindex('</body>')]
open('artifact.html','w').write(head+body)
print('index.html', len(t), '| artifact.html', len(head+body))
PY
