#!/usr/bin/env python3
"""How much faster than the 15 m current does the very top of the sea move, per unit wind?
Measured from the GDP itself: undrogued drifters (which ride in the top ~1 m with a small float) minus drogued ones
(15 m), calendar-month means in 2 deg bins, regressed against the CCMP monthly mean wind in the same bin and month as
a complex coefficient (slip fraction and deflection angle), separately for each hemisphere.
Published values for comparison: ~1% of wind speed downwind (Pazan & Niiler 2001, JTECH 18, 476), revised ~50%
higher by Lumpkin et al. (2013, JTECH 30, 2797). Output: printed coefficients and CACHE/slip.json.
usage: build_slip.py GDP_DIR CACHE_DIR"""
import sys, os, json, numpy as np
GDP, C = sys.argv[1], sys.argv[2]
ld = lambda v: np.asarray(np.load(os.path.join(GDP, v + '.npy'), mmap_mode='r'))
lat, lon, t, ve, vn, dr = ld('lat'), ld('lon'), ld('time'), ld('ve'), ld('vn'), ld('drogue_status')
ok = np.isfinite(ve) & np.isfinite(vn) & (np.abs(ve) < 3) & (np.abs(vn) < 3) & (np.abs(lat) < 70)
mon = (t.astype('datetime64[s]').astype('datetime64[M]').astype(np.int64)) % 12
G = np.clip(((90 - lat) // 2).astype(np.int64), 0, 89) * 180 + (np.floor((lon + 180) / 2).astype(np.int64) % 180)
key = mon * 16200 + G
def means(m):
    k = key[m]; n = np.bincount(k, None, 12 * 16200)
    return np.bincount(k, ve[m], 12 * 16200) / np.maximum(n, 1), np.bincount(k, vn[m], 12 * 16200) / np.maximum(n, 1), n
ud, vd, nd = means(ok & (dr == 1)); uu, vu, nu = means(ok & (dr == 0))
w = np.load(os.path.join(C, 'winds_1deg.npz')); U = w['u'].reshape(12, 90, 2, 180, 2).mean((2, 4)).reshape(12 * 16200); V = w['v'].reshape(12, 90, 2, 180, 2).mean((2, 4)).reshape(12 * 16200)
good = (nd >= 200) & (nu >= 200) & (np.hypot(U, V) > 2)
row = (np.arange(12 * 16200) % 16200) // 180; latc = 89 - 2 * row
out = {}
for name, hm in [('north', latc > 5), ('south', latc < -5)]:
    g = good & hm; D = (uu - ud + 1j * (vu - vd))[g]; Wc = (U + 1j * V)[g]; wt = np.minimum(nd[g], nu[g])
    a = (wt * D * np.conj(Wc)).sum() / (wt * np.abs(Wc) ** 2).sum()
    out[name] = {'slip': float(abs(a)), 'angle_deg': float(np.degrees(np.angle(a))), 'bins': int(g.sum())}
    print(name, 'slip %.4f of wind speed, at %.1f deg (positive = left of the wind), from %d bin-months' % (abs(a), np.degrees(np.angle(a)), g.sum()))
json.dump(out, open(os.path.join(C, 'slip.json'), 'w'), indent=1)
