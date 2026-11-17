//! Ce qu'on calcule une fois par photo, en tâche de fond : la vignette de la grille, la netteté,
//! et une petite signature de l'image pour reconnaître les rafales.

use socle::apercu::{self, Image};

pub struct Analyse {
    /// Vignette JPEG, déjà redressée.
    pub vignette: Vec<u8>,
    /// Netteté du sujet : variance du laplacien dans les zones les plus détaillées.
    pub nettete: f32,
    /// Luminance 16 × 16, pour comparer deux photos.
    pub signature: [u8; 256],
}

pub const COTE_VIGNETTE: usize = 360;

/// `jpeg` : l'aperçu (ou la photo) à analyser, encore compressé.
pub fn analyser(jpeg: &[u8], orientation: u16) -> Result<Analyse, String> {
    let opts = zune_core::options::DecoderOptions::default()
        .jpeg_set_out_colorspace(zune_core::colorspace::ColorSpace::RGB)
        .set_max_width(1 << 16)
        .set_max_height(1 << 16);
    let mut d = zune_jpeg::JpegDecoder::new_with_options(jpeg, opts);
    let px = d.decode().map_err(|e| e.to_string())?;
    let i = d.info().ok_or("JPEG illisible")?;
    let img = Image { l: i.width as usize, h: i.height as usize, px };
    // La netteté se mesure à ~1000 px : assez pour voir un flou de bougé, assez peu pour aller vite.
    let moyen = apercu::reduire_blocs(img, 1024);
    let nettete = nettete(&moyen);
    let petit = apercu::redresser(apercu::reduire_blocs(moyen, COTE_VIGNETTE), orientation);
    let signature = signature(&petit);
    let vignette = encoder(&petit, 80)?;
    Ok(Analyse { vignette, nettete, signature })
}

pub fn encoder(img: &Image, q: u8) -> Result<Vec<u8>, String> {
    let mut out = Vec::with_capacity(img.l * img.h / 3);
    let e = jpeg_encoder::Encoder::new(&mut out, q);
    e.encode(&img.px, img.l as u16, img.h as u16, jpeg_encoder::ColorType::Rgb).map_err(|e| e.to_string())?;
    Ok(out)
}

fn nettete(img: &Image) -> f32 {
    let (l, h) = (img.l, img.h);
    if l < 16 || h < 16 {
        return 0.0;
    }
    let y = apercu::luminance(img);
    // Grille 4 × 4 : variance du laplacien par case, puis moyenne des 3 meilleures cases (le sujet
    // net), pour qu'un fond flou voulu (portrait) ne fasse pas baisser la note.
    let (cl, ch) = (l / 4, h / 4);
    let mut cases = vec![];
    for gy in 0..4 {
        for gx in 0..4 {
            let (mut s, mut s2, mut n) = (0f64, 0f64, 0f64);
            for yy in (gy * ch).max(1)..((gy + 1) * ch).min(h - 1) {
                for xx in (gx * cl).max(1)..((gx + 1) * cl).min(l - 1) {
                    let c = y[yy * l + xx];
                    let lap = (4.0 * c - y[yy * l + xx - 1] - y[yy * l + xx + 1] - y[(yy - 1) * l + xx] - y[(yy + 1) * l + xx]) as f64;
                    s += lap;
                    s2 += lap * lap;
                    n += 1.0;
                }
            }
            if n > 0.0 {
                cases.push((s2 / n - (s / n).powi(2)) as f32);
            }
        }
    }
    cases.sort_by(|a, b| b.total_cmp(a));
    let k = cases.len().min(3).max(1);
    cases[..k].iter().sum::<f32>() / k as f32 * 1e4
}

fn signature(img: &Image) -> [u8; 256] {
    let y = apercu::luminance(img);
    let mut s = [0u8; 256];
    for gy in 0..16 {
        for gx in 0..16 {
            let (x0, x1) = (gx * img.l / 16, ((gx + 1) * img.l / 16).max(gx * img.l / 16 + 1));
            let (y0, y1) = (gy * img.h / 16, ((gy + 1) * img.h / 16).max(gy * img.h / 16 + 1));
            let (mut t, mut n) = (0f32, 0f32);
            for yy in y0..y1.min(img.h) {
                for xx in x0..x1.min(img.l) {
                    t += y[yy * img.l + xx];
                    n += 1.0;
                }
            }
            s[gy * 16 + gx] = (t / n.max(1.0) * 255.0) as u8;
        }
    }
    s
}

/// Écart moyen entre deux signatures (0 = identiques, 1 = opposées). La luminosité globale est
/// retirée : une rafale où l'exposition bouge un peu reste une rafale.
pub fn ecart(a: &[u8; 256], b: &[u8; 256]) -> f32 {
    let ma = a.iter().map(|&v| v as f32).sum::<f32>() / 256.0;
    let mb = b.iter().map(|&v| v as f32).sum::<f32>() / 256.0;
    a.iter().zip(b).map(|(&x, &y)| ((x as f32 - ma) - (y as f32 - mb)).abs()).sum::<f32>() / 256.0 / 255.0
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn nettete_baisse_avec_le_flou() {
        let (l, h) = (256, 256);
        let net: Vec<u8> = (0..l * h).flat_map(|i| {
            let v = if ((i % l) / 4 + (i / l) / 4) % 2 == 0 { 230 } else { 20 };
            [v, v, v]
        }).collect();
        let mut flou = net.clone();
        for y in 0..h {
            for x in 2..l - 2 {
                for c in 0..3 {
                    let s: u32 = (0..5).map(|k| net[(y * l + x + k - 2) * 3 + c] as u32).sum();
                    flou[(y * l + x) * 3 + c] = (s / 5) as u8;
                }
            }
        }
        let a = nettete(&Image { l, h, px: net });
        let b = nettete(&Image { l, h, px: flou });
        assert!(a > b * 2.0, "{a} {b}");
    }
}
