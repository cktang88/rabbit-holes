#!/usr/bin/env python3
"""Monthly climatology of 10 m wind from RSS CCMP V3.1 (Mears et al. 2022), via NOAA CoastWatch ERDDAP.

CCMP V3.1 is a 0.25 deg, 6-hourly, gap-free blend of satellite winds (scatterometers + radiometers) over an
ERA5 background. Licence CC BY 4.0. Citation:
  Mears, C.; Lee, T.; Ricciardulli, L.; Wang, X.; Wentz, F. (2022). RSS Cross-Calibrated Multi-Platform (CCMP)
  6-hourly ocean vector wind analysis on 0.25 deg grid, Version 3.1. Remote Sensing Systems, Santa Rosa, CA.
  https://doi.org/10.56236/RSS-uv6h31  (ERDDAP id ccmp_31 on coastwatch.pfeg.noaa.gov)

A mean of a linear quantity needs no full sampling: we take every 14th 6-hourly field (3.5 days, so the analysis
hour alternates 00/12 UTC and the diurnal cycle averages out), 1993-2023, on a 1 deg grid (every 4th point),
which is ~3,200 fields, ~270 per calendar month. Output: CACHE/ccmp_monthly.npz with u,v sums and counts.
usage: fetch_winds.py CACHE_DIR
"""
import sys, os, io, urllib.request, concurrent.futures as cf, numpy as np, netCDF4

URL = ('https://coastwatch.pfeg.noaa.gov/erddap/griddap/ccmp_31.nc?'
       'uwnd%5B({y}-01-01T00:00:00Z):14:({y}-12-31T18:00:00Z)%5D%5B(-89.625):4:(89.875)%5D%5B(0.375):4:(359.875)%5D,'
       'vwnd%5B({y}-01-01T00:00:00Z):14:({y}-12-31T18:00:00Z)%5D%5B(-89.625):4:(89.875)%5D%5B(0.375):4:(359.875)%5D')

def year(y, out):
    f = os.path.join(out, f'ccmp_{y}.npz')
    if os.path.exists(f): return f
    for k in range(5):
        try:
            with urllib.request.urlopen(URL.format(y=y), timeout=900) as r: raw = r.read(); break
        except Exception as e: print('retry', y, e, flush=True)
    ds = netCDF4.Dataset('mem', memory=raw)
    t = ds['time'][:]; u = np.asarray(ds['uwnd'][:].filled(np.nan), np.float32); v = np.asarray(ds['vwnd'][:].filled(np.nan), np.float32)
    lat = ds['latitude'][:]; lon = ds['longitude'][:]
    mon = (np.array([np.datetime64(int(s), 's') for s in t]).astype('datetime64[M]').astype(int) % 12)
    su = np.zeros((12,) + u.shape[1:]); sv = np.zeros_like(su); n = np.zeros_like(su)
    for m in range(12):
        sel = mon == m; ok = np.isfinite(u[sel])
        su[m] = np.where(ok, u[sel], 0).sum(0); sv[m] = np.where(ok, v[sel], 0).sum(0); n[m] = ok.sum(0)
    np.savez(f, su=su, sv=sv, n=n, lat=lat, lon=lon); print(y, u.shape, flush=True); return f

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    with cf.ThreadPoolExecutor(3) as ex: fs = list(ex.map(lambda y: year(y, out), range(1993, 2024)))
    S = [np.load(f) for f in fs]
    np.savez(os.path.join(out, 'ccmp_monthly.npz'), su=sum(s['su'] for s in S), sv=sum(s['sv'] for s in S), n=sum(s['n'] for s in S), lat=S[0]['lat'], lon=S[0]['lon'])
    print('done')
