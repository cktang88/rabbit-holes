#!/usr/bin/env python3
"""Monthly near-surface (15 m) current climatology and eddy diffusivity from NOAA Global Drifter Program drifters.

Input: the GDP 6-hourly interpolated dataset (fetch_gdp.py), 1979-2025, 48.8 M fixes from 28,706 drifters.
Method (after Lumpkin & Johnson 2013, JGR 118, 2992; Laurindo, Mariano & Lumpkin 2017, DSR I 124, 73):
  * only fixes with the 15 m holey-sock drogue attached (21.6 M), |u|,|v| < 3 m/s;
  * in each 0.5 deg bin, a least-squares fit  u(t) = a0 + a1 cos wt + b1 sin wt + a2 cos 2wt + b2 sin 2wt
    (annual + semi-annual cycle) so that uneven seasonal sampling does not bias the mean; the normal equations are
    Gaussian-smoothed with the narrowest of 0.35/0.7/1.4/2.8/5.6 deg that gives >= NMIN fixes, and a ridge term
    shrinks the seasonal harmonics where seasonal coverage is thin;
  * ocean cells with no estimate (under sea ice, a few coastal pockets) are filled by Laplacian interpolation.
Eddy diffusivity (Davis 1991, J. Mar. Res. 49, 711; as mapped from drifters by Zhurbas & Oh 2004, JGR 109, C05015):
  K(tau) = integral_0^tau  <u'(t) u'(t - s)> ds  of the residual velocity u' = u - fitted climatology, along each
  drifter's own track, averaged over tau = 3..5 days (the plateau), in 2 deg bins, both components averaged.
Output: ../data/currents.bin (see the format notes at the bottom), CACHE/currents_full.npz for validation.
usage: build_currents.py GDP_DIR CACHE_DIR
"""
import sys, os, json, gzip, numpy as np
GDP, CACHE = sys.argv[1], sys.argv[2]
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
W, H = 720, 360                      # 0.5 deg, row 0 at 90N, col 0 at 180W
YEAR = 365.2425 * 86400.0
NMIN = 400                           # fixes (6-hourly) needed under the smoothing kernel, ~100 drifter-days

ld = lambda v: np.load(os.path.join(GDP, v + '.npy'), mmap_mode='r')
lat = np.asarray(ld('lat')); lon = np.asarray(ld('lon')); t = np.asarray(ld('time'))
ve = np.asarray(ld('ve'), np.float64); vn = np.asarray(ld('vn'), np.float64); dr = np.asarray(ld('drogue_status'))
rowsize = np.asarray(ld('rowsize')); traj = np.repeat(np.arange(len(rowsize)), rowsize)
sel = (dr == 1) & np.isfinite(ve) & np.isfinite(vn) & np.isfinite(lat) & np.isfinite(lon) & (np.abs(ve) < 3) & (np.abs(vn) < 3)
print('drogued fixes', sel.sum(), 'of', len(sel), flush=True)
J = np.clip(((90 - lat) * 2).astype(np.int64), 0, H - 1); I = np.floor((lon + 180) * 2).astype(np.int64) % W
K = J * W + I
ph = 2 * np.pi * ((t / YEAR) % 1.0)   # phase of the year (0 = 1 Jan)

def basis(p): return np.stack([np.ones_like(p), np.cos(p), np.sin(p), np.cos(2 * p), np.sin(2 * p)])
B = basis(ph[sel]); ks = K[sel]; us, vs = ve[sel], vn[sel]
pairs = [(a, b) for a in range(5) for b in range(a, 5)]
NC = len(pairs) + 10 + 1
S = np.zeros((NC, H * W))
for c, (a, b) in enumerate(pairs): S[c] = np.bincount(ks, B[a] * B[b], H * W)
for a in range(5): S[15 + a] = np.bincount(ks, B[a] * us, H * W); S[20 + a] = np.bincount(ks, B[a] * vs, H * W)
S[25] = np.bincount(ks, None, H * W)
S = S.reshape(NC, H, W); del B
print('binned', flush=True)

def gsmooth(A, sig):
    """Gaussian smoothing over the last two axes (lat rows, periodic lon columns); sig in 0.5 deg cells"""
    r = int(np.ceil(3 * sig)); k = np.exp(-.5 * (np.arange(-r, r + 1) / sig) ** 2)
    out = np.zeros_like(A)
    for d, w in zip(range(-r, r + 1), k): out += w * np.roll(A, d, axis=-1)
    A, out = out, np.zeros_like(A)
    P = np.pad(A, [(0, 0)] * (A.ndim - 2) + [(r, r), (0, 0)])
    for d, w in zip(range(-r, r + 1), k): out += w * P[..., r + d:r + d + A.shape[-2], :]
    return out

coef = np.full((10, H, W), np.nan); scale = np.full((H, W), np.nan)
for sig in [.7, 1.4, 2.8, 5.6, 11.2]:
    Ss = gsmooth(S, sig) if sig else S
    need = np.isnan(scale) & (Ss[25] >= NMIN)
    jj, ii = np.nonzero(need)
    M = np.zeros((len(jj), 5, 5))
    for c, (a, b) in enumerate(pairs): M[:, a, b] = M[:, b, a] = Ss[c, jj, ii]
    n = Ss[25, jj, ii]
    for a in range(1, 5): M[:, a, a] += .05 * n + 20      # ridge: shrink harmonics where the season is poorly sampled
    Ru = np.stack([Ss[15 + a, jj, ii] for a in range(5)], 1); Rv = np.stack([Ss[20 + a, jj, ii] for a in range(5)], 1)
    cu = np.linalg.solve(M, Ru[..., None])[..., 0]; cv = np.linalg.solve(M, Rv[..., None])[..., 0]
    coef[:5, jj, ii] = cu.T; coef[5:, jj, ii] = cv.T; scale[jj, ii] = sig
    print('sigma', sig, 'cells', len(jj), flush=True)

# ocean cells of the 0.5 deg grid: any of its four 0.25 deg cells is sea in the physics land mask
land_q = np.unpackbits(np.fromfile(os.path.join(DATA, 'land-q.bin'), np.uint8), bitorder='little')[:1440 * 720].reshape(720, 1440).astype(bool)
ocean = (~land_q).reshape(H, 2, W, 2).any((1, 3))
have = ocean & np.isfinite(coef[0])
print('ocean cells', ocean.sum(), 'with drifter estimate', have.sum(), flush=True)

def lapfill(F, known, domain, it=2500):
    """fill domain cells not known by iterating the Laplace equation from the known values"""
    F = np.where(known, F, 0.0); m = domain & ~known
    for _ in range(it):
        cn = (np.roll(domain, 1, 1).astype(int) + np.roll(domain, -1, 1) + np.vstack([domain[:1], domain[:-1]]) + np.vstack([domain[1:], domain[-1:]]))
        nbm = np.roll(F * domain, 1, 1) + np.roll(F * domain, -1, 1) + np.vstack([(F * domain)[:1], (F * domain)[:-1]]) + np.vstack([(F * domain)[1:], (F * domain)[-1:]])
        F = np.where(m, np.where(cn > 0, nbm / np.maximum(cn, 1), 0), F)
    return F
for c in range(10): coef[c] = np.where(ocean, lapfill(coef[c], have, ocean), 0)
print('filled', flush=True)

# ---- eddy diffusivity from lagged residual covariances along each track ----
bsel = basis(ph[sel]); cs = coef[:, J[sel], I[sel]]
ru = np.full(len(t), np.nan); rv = np.full(len(t), np.nan)
ru[sel] = us - (cs[:5] * bsel).sum(0); rv[sel] = vs - (cs[5:] * bsel).sum(0); del bsel, cs
ok = np.isfinite(ru)
G = (J // 4) * (W // 4) + I // 4     # 2 deg bins
NG = (H // 4) * (W // 4)
C = np.zeros((21, NG)); N = np.zeros((21, NG))
for L in range(21):
    a = np.arange(len(t) - L); b = a + L
    m = ok[a] & ok[b] & (traj[a] == traj[b]) & (np.abs(t[b] - t[a] - L * 21600) < 60)
    a, b = a[m], b[m]
    prod = .5 * (ru[a] * ru[b] + rv[a] * rv[b])
    C[L] = np.bincount(G[a], prod, NG); N[L] = np.bincount(G[a], None, NG)
R = C / np.maximum(N, 1)                       # mean lagged covariance per component, m2/s2
dt = 21600.0
Kt = dt * (np.cumsum(R, 0) - .5 * R[0])        # trapezoid integral up to each lag
Kd = Kt[12:21].mean(0).reshape(H // 4, W // 4)   # tau = 3..5 days
var0 = R[0].reshape(H // 4, W // 4); nK = N[0].reshape(H // 4, W // 4)
oc2 = ocean.reshape(H // 4, 4, W // 4, 4).any((1, 3))
goodK = (nK >= 400) & np.isfinite(Kd) & (Kd > 0)
Kd = np.where(goodK, Kd, np.nan)
# light smoothing in log space, then fill the gaps
lk = np.log10(np.clip(np.nan_to_num(Kd, nan=1), 1, None))
wK = goodK.astype(float)
num = gsmooth(np.where(goodK, lk, 0)[None], 1.0)[0]; den = gsmooth(wK[None], 1.0)[0]
lks = np.where(den > .3, num / np.maximum(den, 1e-9), np.nan)
lks = lapfill(np.nan_to_num(lks), np.isfinite(lks), oc2 | np.isfinite(lks))
Kmap = np.clip(10 ** lks, 300, 3e4)
print('K m2/s percentiles (5,25,50,75,95):', np.percentile(Kmap[oc2 & goodK], [5, 25, 50, 75, 95]).round(0), flush=True)
print('T_L days median:', np.nanmedian((Kd / var0)[goodK] / 86400).round(2), flush=True)

np.savez(os.path.join(CACHE, 'currents_full.npz'), coef=coef, ocean=ocean, scale=scale, K=Kmap, Kraw=Kd, var0=var0, nfix=S[25])

# ---- pack ----
# currents.bin = gzip( JSON header line + '\n' + payload ):
#   ocean bitmask, 720x360 bits, LSB first, k = j*720+i
#   mean u, mean v      int16[nOcean] each, mm/s
#   a1,b1,a2,b2 for u, then for v: int8[nOcean] each, q -> sign(q)*(|q|/127)^2 * HMAX m/s
#   K: uint8[90*180], q -> 10^(2.5 + q/255*2.5) m2/s  (2 deg bins)
HMAX = 2.0
idx = np.nonzero(ocean.ravel())[0]
def q8(x): return np.round(np.sign(x) * np.sqrt(np.clip(np.abs(x) / HMAX, 0, 1)) * 127).astype(np.int8)
parts = [np.packbits(ocean.ravel(), bitorder='little').tobytes()]
for c in (0, 5): parts.append(np.clip(np.round(coef[c].ravel()[idx] * 1000), -32767, 32767).astype('<i2').tobytes())
for c in (1, 2, 3, 4, 6, 7, 8, 9): parts.append(q8(coef[c].ravel()[idx]).tobytes())
parts.append(np.clip(np.round((np.log10(Kmap) - 2.5) / 2.5 * 255), 0, 255).astype(np.uint8).tobytes())
hdr = {'fmt': 'floatees-currents-1', 'w': W, 'h': H, 'n': int(len(idx)), 'hmax': HMAX, 'kw': W // 4, 'kh': H // 4,
       'src': 'NOAA GDP 6-hourly drifters (drogued, 15 m), 1979-2025; annual+semiannual harmonic fit per 0.5 deg bin',
       'fixes': int(sel.sum())}
raw = (json.dumps(hdr) + '\n').encode() + b''.join(parts)
with open(os.path.join(DATA, 'currents.bin'), 'wb') as f: f.write(gzip.compress(raw, 9, mtime=0))
print('currents.bin', len(raw), '->', os.path.getsize(os.path.join(DATA, 'currents.bin')), flush=True)
