"""Even-odd scanline rasterisation of shapefile polygons onto an equirectangular grid (row 0 at 90N, column 0 at 180W),
with pure numpy (no GDAL). Used by build_land.py and build_textures.py."""
import numpy as np, shapefile

def rings(path):
    """every ring of every polygon in a shapefile, as (n,2) lon/lat arrays"""
    out = []
    for shp in shapefile.Reader(path).shapes():
        pts = np.asarray(shp.points, np.float64); parts = list(shp.parts) + [len(pts)]
        for a, b in zip(parts[:-1], parts[1:]):
            if b - a >= 3: out.append(pts[a:b])
    return out

def raster(rs, W, H, sub=1):
    """boolean mask H*sub x W*sub sampled at cell centres: True inside (even-odd over all rings)"""
    W, H = W * sub, H * sub
    X, Y, = [], []
    for r in rs:
        x0, y0 = r[:, 0], r[:, 1]; x1, y1 = np.roll(x0, -1), np.roll(y0, -1)
        # rows are sampled at y = 90 - (j+.5)*180/H; an edge crosses row j if the sample lies in [min, max)
        fy0 = (90 - y0) / 180 * H - .5; fy1 = (90 - y1) / 180 * H - .5
        lo = np.ceil(np.minimum(fy0, fy1)).astype(np.int64); hi = np.ceil(np.maximum(fy0, fy1)).astype(np.int64)
        n = np.clip(hi, 0, H) - np.clip(lo, 0, H); keep = n > 0
        if not keep.any(): continue
        lo, n = np.clip(lo, 0, H)[keep], n[keep]; ex0, ey0, ex1, ey1 = x0[keep], fy0[keep], x1[keep], fy1[keep]
        idx = np.repeat(np.arange(len(n)), n); j = lo[idx] + (np.arange(n.sum()) - np.repeat(np.cumsum(n) - n, n))
        t = (j - ey0[idx]) / (ey1[idx] - ey0[idx]); x = ex0[idx] + t * (ex1[idx] - ex0[idx])
        X.append((x + 180) / 360 * W - .5); Y.append(j)
    X = np.concatenate(X); Y = np.concatenate(Y)
    o = np.lexsort((X, Y)); X, Y = X[o], Y[o]
    M = np.zeros((H, W), bool)
    # pair up crossings row by row (each row has an even number of crossings when rings are closed)
    starts = np.searchsorted(Y, np.arange(H)); ends = np.searchsorted(Y, np.arange(H), 'right')
    D = np.zeros((H, W + 1), np.int32)
    for j in range(H):
        xs = X[starts[j]:ends[j]]
        if len(xs) < 2: continue
        a = np.ceil(xs[0::2]).astype(np.int64); b = np.ceil(xs[1::2]).astype(np.int64)  # columns c with a <= c < b
        m = min(len(a), len(b)); a, b = np.clip(a[:m], 0, W), np.clip(b[:m], 0, W)
        np.add.at(D[j], a, 1); np.add.at(D[j], b, -1)
    M = np.cumsum(D[:, :W], 1) > 0
    return M

def down(M, sub):
    """fraction of sub x sub samples set, per output cell"""
    H, W = M.shape; return M.reshape(H // sub, sub, W // sub, sub).mean((1, 3))
