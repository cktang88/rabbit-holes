#!/usr/bin/env python3
"""Download the NOAA Global Drifter Program 6-hourly interpolated dataset (the variables we need)
from the NOAA Open Data Dissemination bucket on AWS (no login needed), as raw Zarr chunks.

Source: Lumpkin, R.; Centurioni, L. (2019). NOAA Global Drifter Program quality-controlled 6-hour
interpolated data from ocean surface drifting buoys. NOAA NCEI. https://doi.org/10.25921/7ntx-z961
(version December 2024, s3://noaa-oar-hourly-gdp-pds/experimental/gdp6h_ragged_dec24.zarr)

usage: fetch_gdp.py CACHE_DIR      -> CACHE_DIR/<var>.npy for each variable
"""
import sys, os, json, urllib.request, concurrent.futures as cf
import numpy as np, numcodecs

BASE = 'https://noaa-oar-hourly-gdp-pds.s3.amazonaws.com/experimental/gdp6h_ragged_dec24.zarr/'
VARS = ['rowsize', 'id', 'drogue_lost_date', 'lat', 'lon', 'time', 've', 'vn', 'drogue_status']

def get(url, tries=6):
    for k in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=120) as r: return r.read()
        except Exception as e:
            if k == tries - 1: raise
            print('retry', url, e, flush=True)

def fetch(var, out):
    dst = os.path.join(out, var + '.npy')
    if os.path.exists(dst): return
    za = json.loads(get(BASE + var + '/.zarray'))
    n, c = za['shape'][0], za['chunks'][0]; dt = np.dtype(za['dtype'])
    codec = numcodecs.get_codec(za['compressor'])
    arr = np.empty(n, dt); nch = (n + c - 1) // c
    def one(i):
        raw = codec.decode(get(BASE + var + '/' + str(i)))
        a = np.frombuffer(raw, dt); m = min(c, n - i * c); arr[i * c:i * c + m] = a[:m]
    with cf.ThreadPoolExecutor(8) as ex: list(ex.map(one, range(nch)))
    fv = za.get('fill_value')
    np.save(dst, arr); print(var, n, dt, 'fill', fv, flush=True)

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    for v in VARS: fetch(v, out)
