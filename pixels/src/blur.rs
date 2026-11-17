//! Flou gaussien en virgule flottante (`gaussF` de `web-src/app/js/0030-float-blur-cpu-fallback-tools.js`) :
//! trois passes de flou de boîte, chacune horizontale puis verticale. Sert au développement
//! (clarté, texture), aux masques et aux finitions. Même calcul que le JS, dans le même ordre :
//! les sommes courantes sont en `f64` (les nombres du JS), les tableaux en `f32`.

/// Largeurs des boîtes qui approchent un flou gaussien d'écart `s` en `n` passes.
fn boxes_for_gauss(s: f64, n: usize) -> Vec<i64> {
    let nf = n as f64;
    let w_i = (12.0 * s * s / nf + 1.0).sqrt();
    let mut wl = w_i.floor() as i64;
    if wl % 2 == 0 {
        wl -= 1;
    }
    let wu = wl + 2;
    let (wlf, nn) = (wl as f64, nf);
    // Math.round de JS : arrondi vers le haut à .5
    let m = ((12.0 * s * s - nn * wlf * wlf - 4.0 * nn * wlf - 3.0 * nn) / (-4.0 * wlf - 4.0) + 0.5).floor();
    (0..n).map(|i| if (i as f64) < m { wl } else { wu }).collect()
}

fn box_h(s: &[f32], d: &mut [f32], w: usize, h: usize, r: usize) {
    let inv = 1.0 / (2 * r + 1) as f64;
    for y in 0..h {
        let (si, di) = (&s[y * w..y * w + w], &mut d[y * w..y * w + w]);
        let mut a = 0f64;
        for k in -(r as isize)..=(r as isize) {
            a += si[k.clamp(0, w as isize - 1) as usize] as f64;
        }
        for (x, o) in di.iter_mut().enumerate() {
            *o = (a * inv) as f32;
            let p = (x + r + 1).min(w - 1);
            let q = x.saturating_sub(r);
            a += si[p] as f64 - si[q] as f64;
        }
    }
}

fn box_v(s: &[f32], d: &mut [f32], w: usize, h: usize, r: usize) {
    let inv = 1.0 / (2 * r + 1) as f64;
    // une somme courante par colonne, parcourue ligne par ligne (lecture de la mémoire dans l'ordre)
    let mut a = vec![0f64; w];
    for k in -(r as isize)..=(r as isize) {
        let row = k.clamp(0, h as isize - 1) as usize;
        for (acc, &v) in a.iter_mut().zip(&s[row * w..row * w + w]) {
            *acc += v as f64;
        }
    }
    for y in 0..h {
        for (o, &acc) in d[y * w..y * w + w].iter_mut().zip(&a) {
            *o = (acc * inv) as f32;
        }
        let p = (y + r + 1).min(h - 1);
        let q = y.saturating_sub(r);
        let (sp, sq) = (&s[p * w..p * w + w], &s[q * w..q * w + w]);
        for ((acc, &vp), &vq) in a.iter_mut().zip(sp).zip(sq) {
            *acc += vp as f64 - vq as f64;
        }
    }
}

/// Flou gaussien d'écart `s` sur place (`a` : `w*h` valeurs).
pub fn gauss(a: &mut [f32], w: usize, h: usize, s: f64) {
    if s < 0.35 || w == 0 || h == 0 {
        return;
    }
    let mut b = vec![0f32; a.len()];
    for bs in boxes_for_gauss(s, 3) {
        let r = ((bs - 1) >> 1) as usize;
        if bs < 3 {
            continue;
        }
        box_h(a, &mut b, w, h, r);
        box_v(&b, a, w, h, r);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valeur_unie_inchangee() {
        let mut a = vec![0.5f32; 20 * 10];
        gauss(&mut a, 20, 10, 3.0);
        assert!(a.iter().all(|&v| (v - 0.5).abs() < 1e-6));
    }

    #[test]
    fn conserve_la_somme_a_peu_pres() {
        let mut a = vec![0f32; 33 * 21];
        a[10 * 33 + 16] = 100.0;
        gauss(&mut a, 33, 21, 2.0);
        let t: f32 = a.iter().sum();
        assert!((t - 100.0).abs() < 0.1, "{t}");
    }
}
