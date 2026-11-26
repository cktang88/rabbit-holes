#!/usr/bin/env python3
"""Pack the CCMP V3.1 monthly wind climatology (fetch_winds.py) for the game.
winds.bin = gzip( JSON header line + payload ):  1 deg grid, row 0 centred at 89.5N, col 0 at 179.5W
  u[12][180*360] int8, v[12][180*360] int8   (m/s = q * 0.15)
  sd[180*360] uint8   synoptic standard deviation of one wind component about its monthly mean, all months (m/s = q * 0.05)
usage: build_winds.py CACHE_DIR"""
import sys, os, json, gzip, numpy as np
C = sys.argv[1]; DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
z = np.load(os.path.join(C, 'wind', 'ccmp_monthly.npz'))
n = np.maximum(z['n'], 1); u = z['su'] / n; v = z['sv'] / n
var = .5 * ((z['suu'] / n - u ** 2) + (z['svv'] / n - v ** 2))
lat, lon = z['lat'], z['lon']                 # ascending lat (-89.625..), lon 0.375.. (0-360)
def regrid(F):
    """bilinear from the CCMP sample points onto 1 deg cell centres (row 0 = 89.5N, col 0 = 179.5W)"""
    tl = 89.5 - np.arange(180); tn = -179.5 + np.arange(360)
    y = np.interp(tl, lat, np.arange(len(lat))); x = ((tn % 360) - lon[0]) / (lon[1] - lon[0])
    y0 = np.clip(np.floor(y).astype(int), 0, len(lat) - 2); fy = (y - y0)[:, None]
    x0 = np.floor(x).astype(int) % len(lon); x1 = (x0 + 1) % len(lon); fx = (x - np.floor(x))[None, :]
    a = F[..., y0, :]; b = F[..., y0 + 1, :]
    r0 = a[..., x0] * (1 - fx) + a[..., x1] * fx; r1 = b[..., x0] * (1 - fx) + b[..., x1] * fx
    return r0 * (1 - fy) + r1 * fy
U, V = regrid(u), regrid(v); SD = np.sqrt(np.clip(regrid(var).mean(0), 0, None))
np.savez(os.path.join(C, 'winds_1deg.npz'), u=U, v=V, sd=SD)
q = lambda F, s: np.clip(np.round(F / s), -127, 127).astype(np.int8)
hdr = {'fmt': 'floatees-winds-1', 'w': 360, 'h': 180, 'scale': .15, 'sdscale': .05,
       'src': 'RSS CCMP V3.1 10 m wind, 1993-2023, every 14th 6-hourly field (~3,200), monthly means'}
raw = (json.dumps(hdr) + '\n').encode() + q(U, .15).tobytes() + q(V, .15).tobytes() + np.clip(np.round(SD / .05), 0, 255).astype(np.uint8).tobytes()
open(os.path.join(DATA, 'winds.bin'), 'wb').write(gzip.compress(raw, 9, mtime=0))
print('winds.bin', len(raw), '->', os.path.getsize(os.path.join(DATA, 'winds.bin')))
sp = np.hypot(U, V); print('monthly mean wind speed max', sp.max().round(1), 'median', np.median(sp).round(1), 'synoptic sd median', np.median(SD).round(2))
