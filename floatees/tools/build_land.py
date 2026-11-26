#!/usr/bin/env python3
"""Land/sea mask for the drift physics, from Natural Earth 1:10m (public domain): land + minor islands + Antarctic
ice shelves + lakes (none of which a floating duck can cross), rasterised at 0.25 deg. A cell is land when at least half
of 8x8 samples inside it are land. Output (row 0 at 90N, col 0 at 180W, bit k = j*1440+i, LSB first):
  ../data/land-q.bin   1440x720 bits (129,600 bytes)
also caches the fine fraction (for the texture builder) in CACHE/landfrac_4096.npy and lakes in CACHE/lakes_4096.npy.
usage: build_land.py NE_DIR CACHE_DIR"""
import sys, os, numpy as np
sys.path.insert(0, os.path.dirname(__file__)); import rast
NE, CACHE = sys.argv[1], sys.argv[2]; DATA = os.path.join(os.path.dirname(__file__), '..', 'data')
shp = lambda n: os.path.join(NE, n, n + '.shp')
land = rast.rings(shp('ne_10m_land')) ; isl = rast.rings(shp('ne_10m_minor_islands')); ice = rast.rings(shp('ne_10m_antarctic_ice_shelves_polys')); lakes = rast.rings(shp('ne_10m_lakes'))
L = rast.raster(land, 1440, 720, 8) | rast.raster(isl, 1440, 720, 8) | rast.raster(ice, 1440, 720, 8)
K = rast.raster(lakes, 1440, 720, 8)
phys = rast.down(L | K, 8) >= .5
phys[-4:] = True  # south of 89S
bits = np.packbits(phys.ravel(), bitorder='little'); bits.tofile(os.path.join(DATA, 'land-q.bin'))
print('land-q.bin', bits.nbytes, 'land fraction', phys.mean().round(3))
# fine fraction for the globe texture (land incl. ice shelves; lakes kept separately so they can be painted as water)
F = rast.raster(land + isl + ice, 4096, 2048, 2); Kf = rast.raster(lakes, 4096, 2048, 2)
np.save(os.path.join(CACHE, 'landfrac_4096.npy'), rast.down(F, 2).astype(np.float32)); np.save(os.path.join(CACHE, 'lakes_4096.npy'), rast.down(Kf, 2).astype(np.float32))
