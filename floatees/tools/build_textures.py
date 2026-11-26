#!/usr/bin/env python3
"""Globe textures.
  * colour: NASA Blue Marble Next Generation with topography and bathymetry, July 2004 (Stöckli et al. 2005;
    NASA Earth Observatory, public domain), 5400x2700 -> 4096x2048 (desktop) and 2048x1024 (phones, and the first
    picture everyone sees while the big one loads). Land pixels keep their colour; open ocean is graded a touch
    darker and bluer so current streaks read against it.
  * relief: ETOPO1 ice-surface elevation (Amante & Eakins 2009, NOAA NCEI, public domain) at 5', as an 8-bit height
    map for the renderer's bump mapping (land only; the sea's own shading is already in the Blue Marble image).
usage: build_textures.py IMG_DIR CACHE_DIR   (IMG_DIR holds bm_topobathy_jul.jpg and etopo5m.nc)"""
import sys, os, numpy as np, netCDF4
from PIL import Image, ImageFilter
IMG, CACHE = sys.argv[1], sys.argv[2]; DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
Image.MAX_IMAGE_PIXELS = None
bm = Image.open(os.path.join(IMG, 'bm_topobathy_jul.jpg')).convert('RGB')
lf = np.load(os.path.join(CACHE, 'landfrac_4096.npy'))           # 2048 x 4096, 1 = land (Natural Earth 10m)
lk = np.load(os.path.join(CACHE, 'lakes_4096.npy'))
for W, q in [(4096, 84), (2048, 84)]:
    im = np.asarray(bm.resize((W, W // 2), Image.LANCZOS), np.float32)
    L = np.asarray(Image.fromarray((lf * 255).astype(np.uint8)).resize((W, W // 2), Image.BILINEAR), np.float32) / 255
    L = np.asarray(Image.fromarray((L * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(W / 4096 * 1.2)), np.float32) / 255
    sea = (1 - L)[..., None]
    graded = im * np.array([.80, .88, 1.0]) ** 1.0 * .9                # deeper navy at sea
    out = im * (1 - sea) + graded * sea
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(os.path.join(DATA, f'earth-{W // 1024}k.jpg'), quality=q, optimize=True, progressive=True)
    print('earth', W, os.path.getsize(os.path.join(DATA, f'earth-{W // 1024}k.jpg')))
ds = netCDF4.Dataset(os.path.join(IMG, 'etopo5m.nc')); z = np.asarray(ds['altitude'][:], np.float32)[::-1]  # north up
h = np.clip(z, 0, 6000) / 6000
h = np.sqrt(h)                                                      # lift the lowlands' relief
hm = Image.fromarray((h * 255).astype(np.uint8)).resize((2048, 1024), Image.LANCZOS)
hm.save(os.path.join(DATA, 'relief-2k.jpg'), quality=80, optimize=True)
print('relief', os.path.getsize(os.path.join(DATA, 'relief-2k.jpg')))
