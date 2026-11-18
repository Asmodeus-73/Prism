//! Une version réduite d'une photo, vite : le JPEG est décodé puis réduit par moyenne de blocs, le
//! RAW donne son aperçu JPEG intégré (le capteur n'est pas développé). Les pixels restent dans le
//! sens du capteur ; l'orientation EXIF est rendue à part.

use crate::Nature;
use rawler::decoders::RawDecodeParams;
use rawler::rawsource::RawSource;
use std::sync::Arc;

#[derive(Clone)]
pub struct Image {
    pub l: usize,
    pub h: usize,
    /// RGB 8 bits, ligne par ligne.
    pub px: Vec<u8>,
}

pub struct Apercu {
    pub image: Image,
    /// Orientation EXIF (1 à 8) à appliquer pour afficher la photo à l'endroit.
    pub orientation: u16,
}

pub fn charger(nature: Nature, octets: &Arc<Vec<u8>>, cote_max: usize) -> Result<Apercu, String> {
    let (img, o) = match nature {
        Nature::Jpeg => {
            let opts = zune_core::options::DecoderOptions::default()
                .jpeg_set_out_colorspace(zune_core::colorspace::ColorSpace::RGB)
                .set_max_width(1 << 16)
                .set_max_height(1 << 16);
            let mut d = zune_jpeg::JpegDecoder::new_with_options(&octets[..], opts);
            let px = d.decode().map_err(|e| e.to_string())?;
            let i = d.info().ok_or("JPEG illisible")?;
            (Image { l: i.width as usize, h: i.height as usize, px }, orientation_jpeg(octets).unwrap_or(1))
        }
        Nature::Raw => {
            let o = octets.clone();
            std::panic::catch_unwind(move || apercu_raw(o)).unwrap_or_else(|_| Err("RAW non pris en charge".into()))?
        }
        _ => return Err("format non pris en charge".into()),
    };
    Ok(Apercu { image: reduire_blocs(img, cote_max), orientation: o })
}

fn apercu_raw(o: Arc<Vec<u8>>) -> Result<(Image, u16), String> {
    let src = RawSource::new_from_shared_vec(o);
    let dec = rawler::get_decoder(&src).map_err(|e| e.to_string())?;
    let params = RawDecodeParams::default();
    let orientation = dec.raw_metadata(&src, &params).ok().and_then(|m| m.exif.orientation).unwrap_or(1);
    let im = match dec.preview_image(&src, &params) {
        Ok(Some(i)) => i,
        _ => match dec.full_image(&src, &params) {
            Ok(Some(i)) => i,
            _ => return Err("pas d'aperçu intégré".into()),
        },
    };
    let rgb = im.to_rgb8();
    let (l, h) = (rgb.width() as usize, rgb.height() as usize);
    Ok((Image { l, h, px: rgb.into_raw() }, orientation))
}

pub fn orientation_jpeg(o: &[u8]) -> Option<u16> {
    let e = exif::Reader::new().read_from_container(&mut std::io::Cursor::new(o)).ok()?;
    e.get_field(exif::Tag::Orientation, exif::In::PRIMARY)?.value.get_uint(0).map(|v| v as u16)
}

/// Réduit par un facteur entier (moyenne de blocs n × n) jusqu'à ce que le grand côté tienne dans
/// `cote_max` (ou juste au-dessus) : rapide et sans crénelage.
pub fn reduire_blocs(img: Image, cote_max: usize) -> Image {
    let grand = img.l.max(img.h);
    if cote_max == 0 || grand <= cote_max {
        return img;
    }
    let n = (grand / cote_max).max(1);
    if n == 1 {
        return img;
    }
    let (nl, nh) = (img.l / n, img.h / n);
    let mut px = vec![0u8; nl * nh * 3];
    let aire = (n * n) as u32;
    let mut somme = vec![0u32; nl * 3];
    for y in 0..nh {
        somme.iter_mut().for_each(|s| *s = 0);
        for dy in 0..n {
            let ligne = &img.px[(y * n + dy) * img.l * 3..];
            for x in 0..nl {
                for dx in 0..n {
                    let s = ((x * n + dx) * 3) as usize;
                    somme[x * 3] += ligne[s] as u32;
                    somme[x * 3 + 1] += ligne[s + 1] as u32;
                    somme[x * 3 + 2] += ligne[s + 2] as u32;
                }
            }
        }
        for (d, s) in px[y * nl * 3..(y + 1) * nl * 3].iter_mut().zip(&somme) {
            *d = ((s + aire / 2) / aire) as u8;
        }
    }
    Image { l: nl, h: nh, px }
}

/// Applique l'orientation EXIF (1 à 8) aux pixels.
pub fn redresser(img: Image, o: u16) -> Image {
    if !(2..=8).contains(&o) {
        return img;
    }
    let (l, h) = (img.l, img.h);
    let (nl, nh) = if o >= 5 { (h, l) } else { (l, h) };
    let mut px = vec![0u8; l * h * 3];
    for y in 0..nh {
        for x in 0..nl {
            let (sx, sy) = match o {
                2 => (l - 1 - x, y),
                3 => (l - 1 - x, h - 1 - y),
                4 => (x, h - 1 - y),
                5 => (y, x),
                6 => (y, h - 1 - x),
                7 => (l - 1 - y, h - 1 - x),
                8 => (l - 1 - y, x),
                _ => (x, y),
            };
            let s = (sy * l + sx) * 3;
            let d = (y * nl + x) * 3;
            px[d..d + 3].copy_from_slice(&img.px[s..s + 3]);
        }
    }
    Image { l: nl, h: nh, px }
}

/// Luminance 0..1 (Rec. 709, sur les valeurs gamma : suffisant pour comparer des voisins).
pub fn luminance(img: &Image) -> Vec<f32> {
    img.px.chunks_exact(3).map(|p| (0.2126 * p[0] as f32 + 0.7152 * p[1] as f32 + 0.0722 * p[2] as f32) / 255.0).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reduction_par_blocs() {
        let img = Image { l: 4, h: 2, px: vec![0, 0, 0, 10, 10, 10, 20, 20, 20, 30, 30, 30, 0, 0, 0, 10, 10, 10, 20, 20, 20, 30, 30, 30] };
        let r = reduire_blocs(img, 2);
        assert_eq!((r.l, r.h), (2, 1));
        assert_eq!(r.px, vec![5, 5, 5, 25, 25, 25]);
    }
    #[test]
    fn redressement() {
        let img = || Image { l: 2, h: 1, px: vec![255, 0, 0, 0, 255, 0] };
        let r6 = redresser(img(), 6);
        assert_eq!((r6.l, r6.h), (1, 2));
        assert_eq!(&r6.px[..3], &[255, 0, 0]);
        assert_eq!(&redresser(img(), 8).px[..3], &[0, 255, 0]);
    }
}
