# Builds plate/index.html from page.html + sim.js + levels.js. Run: python3 plate/src/build.py
import os
d=os.path.dirname(os.path.abspath(__file__))+'/'
s=open(d+'page.html').read()
s=s.replace('/*SIM*/', open(d+'sim.js').read()).replace('/*LEVELS*/', open(d+'levels.js').read())
open(d+'../index.html','w').write(s)
print('built', len(s))
