#!/usr/bin/env python3
"""A sample of real drifter tracks for the globe's "real drifters" overlay: 240 NOAA GDP drifters (see build_currents.py
for the citation), one year of each (from its deployment), every 2 days, spread over the oceans (one per 10 deg box at
most, longest-lived first). tracks.bin = gzip( JSON header line + for each track: uint16 n, then n x (int16 lat*100, int16 lon*100) ).
usage: build_tracks.py GDP_DIR"""
import sys, os, json, gzip, numpy as np
GDP = sys.argv[1]; DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
ld = lambda v: np.load(os.path.join(GDP, v + '.npy'), mmap_mode='r')
rs = np.asarray(ld('rowsize')); lat = ld('lat'); lon = ld('lon'); t = ld('time'); ids = np.asarray(ld('id'))
off = np.concatenate([[0], np.cumsum(rs)])
order = np.argsort(-rs); used = set(); out = []; rng = np.random.default_rng(7)
for k in order[rng.permutation(len(order[:6000]))]:          # long-lived drifters, in random order
    a, b = off[k], off[k + 1]; n = min(b - a, 4 * 365)
    if n < 4 * 300: continue
    la = np.asarray(lat[a:a + n:8]); lo = np.asarray(lon[a:a + n:8])
    if not (np.isfinite(la).all() and np.isfinite(lo).all()): continue
    box = (int((la[0] + 90) // 10), int((lo[0] + 180) // 10))
    if box in used: continue
    used.add(box); out.append((la, lo))
    if len(out) >= 240: break
parts = []
for la, lo in out: parts.append(np.uint16(len(la)).tobytes() + np.stack([np.round(la * 100), np.round(lo * 100)], 1).astype('<i2').tobytes())
hdr = {'fmt': 'floatees-tracks-1', 'n': len(out), 'step_days': 2, 'src': 'NOAA GDP 6-hourly drifters, one year of each, every 2 days'}
open(os.path.join(DATA, 'tracks.bin'), 'wb').write(gzip.compress((json.dumps(hdr) + '\n').encode() + b''.join(parts), 9, mtime=0))
print('tracks', len(out), os.path.getsize(os.path.join(DATA, 'tracks.bin')))
