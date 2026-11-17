//! Réduction du bruit v2 (Filtre > Réduction du bruit), portage de `dnTile` de
//! `web-src/feat/denoise.js` : luminance par moyennes non locales, couleur par filtre
//! guidé à demi-résolution, réinjection des détails, protection des contours.
//!
//! Le calcul suit le JavaScript opération par opération : les tableaux sont en `f32`
//! (les `Float32Array` du JS), les calculs intermédiaires en `f64` (les nombres du JS),
//! dans le même ordre. Le résultat est donc le même au pixel près, ce que vérifie
//! `tests/pixels.mjs` en comparant les deux versions sur de vraies tailles de photo.

pub const NPARAMS: usize = 21;

const KB: f64 = 0.5389;
const KR: f64 = 0.6350;

/// Paramètres d'une tuile, dans l'ordre où la page les écrit.
#[derive(Debug, Clone)]
pub struct Params {
    pub w: usize,
    pub h: usize,
    pub ov: usize,
    pub cx: usize,
    pub cy: usize,
    pub cw: usize,
    pub ch: usize,
    pub rx: usize,
    pub ry: usize,
    pub rw: usize,
    pub rh: usize,
    pub s_y: f64,
    pub s: usize,
    pub lum: f64,
    pub col: f64,
    pub det: f64,
    pub prot: f64,
    pub h_base: f64,
    pub r_c: usize,
    pub eps: f64,
    pub c_blend: f64,
}

fn uint(v: f64, max: f64) -> Option<usize> {
    (v.is_finite() && v >= 0.0 && v <= max && v.fract() == 0.0).then_some(v as usize)
}

fn num(v: f64) -> Option<f64> {
    v.is_finite().then_some(v)
}

impl Params {
    /// Lit et contrôle les 21 nombres ; `None` si l'un est hors des bornes que la page produit.
    pub fn from_slice(p: &[f64]) -> Option<Params> {
        if p.len() < NPARAMS {
            return None;
        }
        const BIG: f64 = 1e6;
        let q = Params {
            w: uint(p[0], BIG)?,
            h: uint(p[1], BIG)?,
            ov: uint(p[2], 256.0)?,
            cx: uint(p[3], BIG)?,
            cy: uint(p[4], BIG)?,
            cw: uint(p[5], 4096.0)?,
            ch: uint(p[6], 4096.0)?,
            rx: uint(p[7], BIG)?,
            ry: uint(p[8], BIG)?,
            rw: uint(p[9], 8192.0)?,
            rh: uint(p[10], 8192.0)?,
            s_y: num(p[11])?,
            s: uint(p[12], 16.0)?,
            lum: num(p[13])?,
            col: num(p[14])?,
            det: num(p[15])?,
            prot: num(p[16])?,
            h_base: num(p[17])?,
            r_c: uint(p[18], 64.0)?,
            eps: num(p[19])?,
            c_blend: num(p[20])?,
        };
        // la tuile est dans l'image, la zone lue couvre la tuile et son recouvrement (bornés à l'image)
        let ok = q.w > 0
            && q.h > 0
            && q.cw > 0
            && q.ch > 0
            && q.cx + q.cw <= q.w
            && q.cy + q.ch <= q.h
            && q.rx <= q.cx.saturating_sub(q.ov)
            && q.ry <= q.cy.saturating_sub(q.ov)
            && q.rx + q.rw >= (q.cx + q.cw + q.ov).min(q.w)
            && q.ry + q.rh >= (q.cy + q.ch + q.ov).min(q.h)
            && q.rx + q.rw <= q.w
            && q.ry + q.rh <= q.h;
        ok.then_some(q)
    }
}

/// Écriture dans un `Uint8ClampedArray` : bornée à 0..255, arrondie au pair le plus proche, NaN donne 0.
#[inline]
fn u8c(v: f64) -> u8 {
    if v.is_nan() || v <= 0.0 {
        0
    } else if v >= 255.0 {
        255
    } else {
        v.round_ties_even() as u8
    }
}

/// Moyenne sur des cellules 2x2 alignées sur les coordonnées paires.
fn down(src: &[f32], ww: usize, wh: usize, hw: usize, hh: usize) -> Vec<f32> {
    let mut o = vec![0f32; hw * hh];
    for y in 0..hh {
        let y1 = (wh - 1).min(2 * y + 1);
        for x in 0..hw {
            let x1 = (ww - 1).min(2 * x + 1);
            o[y * hw + x] = ((src[2 * y * ww + 2 * x] as f64
                + src[2 * y * ww + x1] as f64
                + src[y1 * ww + 2 * x] as f64
                + src[y1 * ww + x1] as f64)
                * 0.25) as f32;
        }
    }
    o
}

/// Moyenne sur une boîte de rayon `rad` (bornée aux bords), en deux passes.
fn bx(src: &[f32], hw: usize, hh: usize, rad: usize) -> Vec<f32> {
    let m = hw * hh;
    let mut t = vec![0f64; m];
    for y in 0..hh {
        let b = y * hw;
        let mut s = 0f64;
        let lim = rad.min(hw - 1);
        for x in 0..=lim {
            s += src[b + x] as f64;
        }
        for x in 0..hw {
            if x > 0 {
                let hi = x + rad;
                if hi < hw {
                    s += src[b + hi] as f64;
                }
                if x > rad {
                    s -= src[b + x - rad - 1] as f64;
                }
            }
            t[b + x] = s;
        }
    }
    // passe verticale ligne par ligne (une somme courante par colonne) : mêmes additions, dans le même ordre
    // pour chaque colonne que le JS, qui parcourt colonne par colonne, mais en lisant la mémoire dans l'ordre
    let mut o = vec![0f32; m];
    let cx2: Vec<f64> = (0..hw).map(|x| ((hw - 1).min(x + rad) - x.saturating_sub(rad) + 1) as f64).collect();
    let mut s = vec![0f64; hw];
    for y in 0..=rad.min(hh - 1) {
        for (a, &v) in s.iter_mut().zip(&t[y * hw..y * hw + hw]) {
            *a += v;
        }
    }
    for y in 0..hh {
        if y > 0 {
            let hi = y + rad;
            if hi < hh {
                for (a, &v) in s.iter_mut().zip(&t[hi * hw..hi * hw + hw]) {
                    *a += v;
                }
            }
            if y > rad {
                let lo = y - rad - 1;
                for (a, &v) in s.iter_mut().zip(&t[lo * hw..lo * hw + hw]) {
                    *a -= v;
                }
            }
        }
        let cy2 = ((hh - 1).min(y + rad) - y.saturating_sub(rad) + 1) as f64;
        for ((d, &a), &c) in o[y * hw..y * hw + hw].iter_mut().zip(&s).zip(&cx2) {
            *d = (a / (cy2 * c)) as f32;
        }
    }
    o
}

/// Rééchantillonnage bilinéaire de la demi-résolution (centres des cellules en 2x+0.5).
fn up(src: &[f32], ww: usize, wh: usize, hw: usize, hh: usize) -> Vec<f32> {
    let mut dst = vec![0f32; ww * wh];
    // les coefficients horizontaux ne dépendent que de x
    let xs: Vec<(usize, usize, f64)> = (0..ww)
        .map(|x| {
            let fx = ((x as f64 - 0.5) / 2.0).max(0.0);
            let x0 = (fx.floor() as usize).min(hw - 1);
            let x1 = (hw - 1).min(x0 + 1);
            (x0, x1, fx - x0 as f64)
        })
        .collect();
    for y in 0..wh {
        let fy = ((y as f64 - 0.5) / 2.0).max(0.0);
        let y0 = (fy.floor() as usize).min(hh - 1);
        let y1 = (hh - 1).min(y0 + 1);
        let ty = fy - y0 as f64;
        let (r0, r1) = (&src[y0 * hw..y0 * hw + hw], &src[y1 * hw..y1 * hw + hw]);
        let d = &mut dst[y * ww..y * ww + ww];
        for (x, &(x0, x1, tx)) in xs.iter().enumerate() {
            d[x] = ((r0[x0] as f64 * (1.0 - tx) + r0[x1] as f64 * tx) * (1.0 - ty)
                + (r1[x0] as f64 * (1.0 - tx) + r1[x1] as f64 * tx) * ty) as f32;
        }
    }
    dst
}

/// Débruite une tuile. `reg` : RGBA de la zone `rx,ry,rw,rh` ; `out` : RGBA de la tuile `cw x ch`.
pub fn tile(p: &Params, reg: &[u8], out: &mut [u8]) {
    let ov = p.ov as isize;
    let (wx0, wy0) = (p.cx as isize - ov, p.cy as isize - ov);
    let (ww, wh) = (p.cw + 2 * p.ov, p.ch + 2 * p.ov);
    let n = ww * wh;
    let (mut yv, mut cb, mut cr, mut av) = (vec![0f32; n], vec![0f32; n], vec![0f32; n], vec![0u8; n]);
    let (wi, hi) = (p.w as isize, p.h as isize);
    for j in 0..wh {
        let gy = (wy0 + j as isize).clamp(0, hi - 1) as usize;
        let ro = (gy - p.ry) * p.rw;
        for i in 0..ww {
            let gx = (wx0 + i as isize).clamp(0, wi - 1) as usize;
            let q = (ro + gx - p.rx) * 4;
            let (r, g, b) = (reg[q] as f64, reg[q + 1] as f64, reg[q + 2] as f64);
            let k = j * ww + i;
            let y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            yv[k] = y as f32;
            cb[k] = ((b - y) * KB) as f32;
            cr[k] = ((r - y) * KR) as f32;
            av[k] = reg[q + 3];
        }
    }
    let (s_y, s, lum, col, det, prot) = (p.s_y, p.s, p.lum, p.col, p.det, p.prot);

    // mesure de contour (dégradé du luma lissé 3x3), support 2 px
    let mut e = vec![0f32; n];
    if (lum > 0.0 || det > 0.0) && ww >= 3 && wh >= 3 {
        let mut ys = vec![0f32; n];
        for y in 1..wh - 1 {
            for x in 1..ww - 1 {
                let k = y * ww + x;
                ys[k] = ((yv[k - ww - 1] as f64
                    + yv[k - ww] as f64
                    + yv[k - ww + 1] as f64
                    + yv[k - 1] as f64
                    + yv[k] as f64
                    + yv[k + 1] as f64
                    + yv[k + ww - 1] as f64
                    + yv[k + ww] as f64
                    + yv[k + ww + 1] as f64)
                    / 9.0) as f32;
            }
        }
        let (t0, t1) = (0.8 * s_y, 6.0 * s_y);
        for y in 2..wh.saturating_sub(2) {
            for x in 2..ww.saturating_sub(2) {
                let k = y * ww + x;
                let gx = ys[k + 1] as f64 - ys[k - 1] as f64;
                let gy = ys[k + ww] as f64 - ys[k - ww] as f64;
                let g = (gx * gx + gy * gy).sqrt();
                let t = ((g - t0) / t1).clamp(0.0, 1.0);
                e[k] = (t * t * (3.0 - 2.0 * t)) as f32;
            }
        }
    }

    // luma : moyennes non locales (symétriques, fenêtre de recherche S, patch 5x5)
    let yd: Vec<f32> = if lum > 0.0 {
        nlm(&yv, &e, ww, wh, s, s_y, p.h_base, prot)
    } else {
        yv.clone()
    };

    // détails : on réinjecte la texture (résidu) là où la variance locale dépasse le bruit
    let yo: Vec<f32> = if det > 0.0 && lum > 0.0 {
        let (mut m1, mut m2, mut h1, mut h2) = (vec![0f32; n], vec![0f32; n], vec![0f32; n], vec![0f32; n]);
        let s2 = s_y * s_y;
        for y in 0..wh {
            for x in 2..ww.saturating_sub(2) {
                let k = y * ww + x;
                let (a, b, c, d, f) = (yv[k - 2] as f64, yv[k - 1] as f64, yv[k] as f64, yv[k + 1] as f64, yv[k + 2] as f64);
                h1[k] = (a + b + c + d + f) as f32;
                h2[k] = (a * a + b * b + c * c + d * d + f * f) as f32;
            }
        }
        for y in 2..wh.saturating_sub(2) {
            for x in 2..ww.saturating_sub(2) {
                let k = y * ww + x;
                m1[k] = ((h1[k - 2 * ww] as f64 + h1[k - ww] as f64 + h1[k] as f64 + h1[k + ww] as f64 + h1[k + 2 * ww] as f64) * 0.04) as f32;
                m2[k] = ((h2[k - 2 * ww] as f64 + h2[k - ww] as f64 + h2[k] as f64 + h2[k + ww] as f64 + h2[k + 2 * ww] as f64) * 0.04) as f32;
            }
        }
        let dk = det / 100.0;
        (0..n)
            .map(|k| {
                let m1k = m1[k] as f64;
                let v = m2[k] as f64 - m1k * m1k;
                let g = 0.08 + 0.92 * ((v / s2 - 1.2) / 1.0).clamp(0.0, 1.0);
                let ydk = yd[k] as f64;
                (ydk + dk * g * (yv[k] as f64 - ydk)) as f32
            })
            .collect()
    } else {
        yd.clone()
    };

    // couleur : filtre guidé (guide = luma débruité + un peu de chroma pour tenir les bords de couleur)
    let (cb2, cr2) = if col > 0.0 {
        guided_chroma(&yd, &cb, &cr, ww, wh, p)
    } else {
        (cb, cr)
    };

    for j in 0..p.ch {
        let sb = (j + p.ov) * ww + p.ov;
        for i in 0..p.cw {
            let k = sb + i;
            let y = yo[k] as f64;
            let cbv = cb2[k] as f64 / KB;
            let crv = cr2[k] as f64 / KR;
            let r = y + crv;
            let b = y + cbv;
            let g = (y - 0.2126 * r - 0.0722 * b) / 0.7152;
            let q = (j * p.cw + i) * 4;
            out[q] = u8c(r);
            out[q + 1] = u8c(g);
            out[q + 2] = u8c(b);
            out[q + 3] = av[k];
        }
    }
}

/// Moyennes non locales sur le luma : chaque paire de pixels (k, k+o) n'est pesée qu'une fois.
#[allow(clippy::too_many_arguments)]
fn nlm(yv: &[f32], e: &[f32], ww: usize, wh: usize, s: usize, s_y: f64, hb: f64, prot: f64) -> Vec<f32> {
    let n = ww * wh;
    let hl: Vec<f32> = e.iter().map(|&ek| (hb * (1.0 - 0.8 * prot * ek as f64)) as f32).collect();
    let (mut acc, mut ws, mut sd, mut hs) = (vec![0f32; n], vec![0f32; n], vec![0f32; n], vec![0f32; n]);
    const LS: f64 = 64.0;
    const XM: f64 = 6.0;
    let lut: Vec<f32> = (0..(XM * LS) as usize + 2).map(|i| (-(i as f64) / LS).exp() as f32).collect();
    let s2 = 2.0 * s_y * s_y;
    let (mut vrow, mut wrow) = (vec![0f64; ww], vec![0f64; ww]);
    let si = s as isize;
    let (wwi, whi) = (ww as isize, wh as isize);
    for dy in 0..=si {
        for dx in -si..=si {
            if dy == 0 && dx <= 0 {
                continue;
            }
            let o = dy * wwi + dx;
            let xl = 2 + if dx < 0 { -dx } else { 0 };
            let xh = wwi - 3 - if dx > 0 { dx } else { 0 };
            let (yl, yh) = (2isize, whi - 3 - dy);
            if xh < xl || yh < yl {
                continue;
            }
            let o = o as usize;
            let (xl, xh, yl, yh) = (xl as usize, xh as usize, yl as usize, yh as usize);
            // écarts au carré, puis sommes horizontales sur 5 px (chaque ligne se vectorise)
            for y in yl - 2..=yh + 2 {
                let b = y * ww;
                let (a, c) = (&yv[b + xl - 2..=b + xh + 2], &yv[b + xl - 2 + o..=b + xh + 2 + o]);
                for ((d, &a), &c) in sd[b + xl - 2..=b + xh + 2].iter_mut().zip(a).zip(c) {
                    let t = a as f64 - c as f64;
                    *d = (t * t) as f32;
                }
            }
            for y in yl - 2..=yh + 2 {
                let b = y * ww;
                let r = &sd[b + xl - 2..=b + xh + 2];
                for (i, h) in hs[b + xl..=b + xh].iter_mut().enumerate() {
                    *h = (r[i] as f64 + r[i + 1] as f64 + r[i + 2] as f64 + r[i + 3] as f64 + r[i + 4] as f64) as f32;
                }
            }
            let len = xh - xl + 1;
            for y in yl..=yh {
                let b = y * ww + xl;
                // poids de chaque paire (k, k+o) ; 0 pour une paire écartée (ajouter 0 ne change rien)
                {
                    let (h0, h1, h2, h3, h4) = (
                        &hs[b - 2 * ww..b - 2 * ww + len],
                        &hs[b - ww..b - ww + len],
                        &hs[b..b + len],
                        &hs[b + ww..b + ww + len],
                        &hs[b + 2 * ww..b + 2 * ww + len],
                    );
                    let (la, lb) = (&hl[b..b + len], &hl[b + o..b + o + len]);
                    let vr = &mut vrow[..len];
                    let (h1, h2, h3, h4, la, lb) = (&h1[..len], &h2[..len], &h3[..len], &h4[..len], &la[..len], &lb[..len]);
                    for i in 0..len {
                        let d2 = (h0[i] as f64 + h1[i] as f64 + h2[i] as f64 + h3[i] as f64 + h4[i] as f64) * 0.04;
                        let hq = 0.5 * (la[i] as f64 + lb[i] as f64);
                        vr[i] = (d2 - s2) / (hq * hq);
                    }
                }
                for (w, &v) in wrow[..len].iter_mut().zip(&vrow[..len]) {
                    let v = if v < 0.0 { 0.0 } else { v };
                    // NaN (h nul) donne l'indice 0, comme `(v*LS)|0` en JS
                    *w = if v >= XM { 0.0 } else { lut[(v * LS) as usize] as f64 };
                }
                // d'abord les ajouts en k+o, puis en k : pour chaque pixel, le même ordre d'addition que le JS
                // (sur une même ligne, le pixel j reçoit sa part « k+o » à l'itération j-dx, avant sa part « k »)
                let w = &wrow[..len];
                {
                    let (src, a, s) = (&yv[b..b + len], &mut acc[b + o..b + o + len], &mut ws[b + o..b + o + len]);
                    for ((a, s), (&w, &y)) in a.iter_mut().zip(s.iter_mut()).zip(w.iter().zip(src)) {
                        *a = (*a as f64 + w * y as f64) as f32;
                        *s = (*s as f64 + w) as f32;
                    }
                }
                {
                    let (src, a, s) = (&yv[b + o..b + o + len], &mut acc[b..b + len], &mut ws[b..b + len]);
                    for ((a, s), (&w, &y)) in a.iter_mut().zip(s.iter_mut()).zip(w.iter().zip(src)) {
                        *a = (*a as f64 + w * y as f64) as f32;
                        *s = (*s as f64 + w) as f32;
                    }
                }
            }
        }
    }
    (0..n).map(|k| ((yv[k] as f64 + acc[k] as f64) / (1.0 + ws[k] as f64)) as f32).collect()
}

/// Filtre guidé de la chroma à demi-résolution (guide à trois canaux : luma débruité, Cb et Cr lissés).
fn guided_chroma(yd: &[f32], cb: &[f32], cr: &[f32], ww: usize, wh: usize, p: &Params) -> (Vec<f32>, Vec<f32>) {
    let n = ww * wh;
    let r2 = ((p.r_c as f64 / 2.0).round() as usize).max(1);
    let eps = p.eps;
    let (mut cbs, mut crs) = (vec![0f32; n], vec![0f32; n]);
    for y in 1..wh.saturating_sub(1) {
        for x in 1..ww.saturating_sub(1) {
            let k = y * ww + x;
            let (mut a, mut b) = (0f64, 0f64);
            for dy in [-1isize, 0, 1] {
                for dx in [-1isize, 0, 1] {
                    let q = (k as isize + dy * ww as isize + dx) as usize;
                    a += cb[q] as f64;
                    b += cr[q] as f64;
                }
            }
            cbs[k] = (a / 9.0) as f32;
            crs[k] = (b / 9.0) as f32;
        }
    }
    let (hw, hh) = (ww.div_ceil(2), wh.div_ceil(2));
    let m = hw * hh;
    let ih = [down(yd, ww, wh, hw, hh), down(&cbs, ww, wh, hw, hh), down(&crs, ww, wh, hw, hh)];
    let mi: Vec<Vec<f32>> = ih.iter().map(|v| bx(v, hw, hh, r2)).collect();
    let mut tmp = vec![0f32; m];
    let mut s6: Vec<Vec<f32>> = Vec::with_capacity(6);
    for a in 0..3 {
        for b in a..3 {
            for k in 0..m {
                tmp[k] = (ih[a][k] as f64 * ih[b][k] as f64) as f32;
            }
            let mut q = bx(&tmp, hw, hh, r2);
            for k in 0..m {
                q[k] = (q[k] as f64 - mi[a][k] as f64 * mi[b][k] as f64) as f32;
            }
            s6.push(q);
        }
    }
    let mut iv: [Vec<f32>; 6] = std::array::from_fn(|_| vec![0f32; m]);
    for k in 0..m {
        let a = s6[0][k] as f64 + eps;
        let b = s6[1][k] as f64;
        let c2 = s6[2][k] as f64;
        let d = s6[3][k] as f64 + eps;
        let e = s6[4][k] as f64;
        let f = s6[5][k] as f64 + eps;
        let c00 = d * f - e * e;
        let c01 = c2 * e - b * f;
        let c02 = b * e - c2 * d;
        let c11 = a * f - c2 * c2;
        let c12 = b * c2 - a * e;
        let c22 = a * d - b * b;
        let det = a * c00 + b * c01 + c2 * c02;
        let id = 1.0 / det;
        iv[0][k] = (c00 * id) as f32;
        iv[1][k] = (c01 * id) as f32;
        iv[2][k] = (c02 * id) as f32;
        iv[3][k] = (c11 * id) as f32;
        iv[4][k] = (c12 * id) as f32;
        iv[5][k] = (c22 * id) as f32;
    }
    let bl = p.c_blend;
    let mut gf = |pc: &[f32]| -> Vec<f32> {
        let ph = down(pc, ww, wh, hw, hh);
        let mp = bx(&ph, hw, hh, r2);
        let mut cv: Vec<Vec<f32>> = Vec::with_capacity(3);
        for a in 0..3 {
            for k in 0..m {
                tmp[k] = (ih[a][k] as f64 * ph[k] as f64) as f32;
            }
            let mut q = bx(&tmp, hw, hh, r2);
            for k in 0..m {
                q[k] = (q[k] as f64 - mi[a][k] as f64 * mp[k] as f64) as f32;
            }
            cv.push(q);
        }
        let (mut a0v, mut a1v, mut a2v, mut bv) = (vec![0f32; m], vec![0f32; m], vec![0f32; m], vec![0f32; m]);
        for k in 0..m {
            let (x, y, z) = (cv[0][k] as f64, cv[1][k] as f64, cv[2][k] as f64);
            let i = |j: usize| iv[j][k] as f64;
            let a0 = i(0) * x + i(1) * y + i(2) * z;
            let a1 = i(1) * x + i(3) * y + i(4) * z;
            let a2 = i(2) * x + i(4) * y + i(5) * z;
            a0v[k] = a0 as f32;
            a1v[k] = a1 as f32;
            a2v[k] = a2 as f32;
            bv[k] = (mp[k] as f64 - a0 * mi[0][k] as f64 - a1 * mi[1][k] as f64 - a2 * mi[2][k] as f64) as f32;
        }
        let f0 = up(&bx(&a0v, hw, hh, r2), ww, wh, hw, hh);
        let f1 = up(&bx(&a1v, hw, hh, r2), ww, wh, hw, hh);
        let f2 = up(&bx(&a2v, hw, hh, r2), ww, wh, hw, hh);
        let fb = up(&bx(&bv, hw, hh, r2), ww, wh, hw, hh);
        (0..n)
            .map(|k| {
                let f = f0[k] as f64 * yd[k] as f64 + f1[k] as f64 * cbs[k] as f64 + f2[k] as f64 * crs[k] as f64 + fb[k] as f64;
                let pck = pc[k] as f64;
                (pck + (f - pck) * bl) as f32
            })
            .collect()
    };
    let cb2 = gf(cb);
    let cr2 = gf(cr);
    (cb2, cr2)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn params(w: usize, h: usize) -> Vec<f64> {
        let ov = 40.0;
        vec![
            w as f64, h as f64, ov, 0.0, 0.0, w as f64, h as f64, 0.0, 0.0, w as f64, h as f64, 4.0, 4.0, 50.0, 70.0, 30.0, 0.6,
            2.0, 10.0, 400.0, 1.0,
        ]
    }

    #[test]
    fn refuse_une_zone_trop_petite() {
        let mut p = params(64, 48);
        assert!(Params::from_slice(&p).is_some());
        p[9] = 63.0;
        assert!(Params::from_slice(&p).is_none());
        p[9] = 64.0;
        p[12] = f64::NAN;
        assert!(Params::from_slice(&p).is_none());
    }

    #[test]
    fn une_image_unie_reste_unie() {
        let (w, h) = (64, 48);
        let p = Params::from_slice(&params(w, h)).unwrap();
        let reg: Vec<u8> = (0..w * h).flat_map(|_| [120u8, 80, 200, 255]).collect();
        let mut out = vec![0u8; w * h * 4];
        tile(&p, &reg, &mut out);
        for px in out.chunks(4) {
            assert!((px[0] as i32 - 120).abs() <= 1 && (px[1] as i32 - 80).abs() <= 1 && (px[2] as i32 - 200).abs() <= 1);
            assert_eq!(px[3], 255);
        }
    }

    #[test]
    fn toutes_petites_images() {
        for (w, h) in [(1, 1), (2, 3), (5, 1), (7, 7)] {
            let mut v = params(w, h);
            v[2] = 12.0;
            let p = Params::from_slice(&v).unwrap();
            let reg: Vec<u8> = (0..w * h * 4).map(|i| (i * 37 % 251) as u8).collect();
            let mut out = vec![0u8; w * h * 4];
            tile(&p, &reg, &mut out);
        }
    }
}
