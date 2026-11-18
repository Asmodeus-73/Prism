//! prism-export : exporte un dossier de photos (JPEG, RAW) en JPEG, AVIF ou PNG redimensionnés.
//!
//! Chaque photo passe par un seul fil (décodage, redressement, redimensionnement SIMD, encodage) et
//! les photos sont traitées en parallèle sur tous les cœurs : pas d'image intermédiaire sur disque,
//! pas de conversion 16 bits inutile pour une sortie 8 bits.

use clap::{Parser, ValueEnum};
use fast_image_resize as fr;
use rawler::decoders::RawDecodeParams;
use rawler::imgop::develop::RawDevelop;
use rawler::rawsource::RawSource;
use rayon::prelude::*;
use socle::{parcours, Nature};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Instant;

#[derive(Clone, Copy, ValueEnum, PartialEq)]
enum Format {
    Jpeg,
    Avif,
    Png,
}

#[derive(Parser)]
#[command(name = "prism-export", version, about = "Exporte des photos en JPEG, AVIF ou PNG redimensionnés, sur tous les cœurs")]
struct Args {
    /// Dossier (ou fichier) de photos à exporter.
    source: PathBuf,
    /// Dossier où écrire les exports.
    destination: PathBuf,
    #[arg(long, value_enum, default_value = "jpeg")]
    format: Format,
    /// Plus grand côté, en pixels (0 : taille d'origine).
    #[arg(long, default_value_t = 2048)]
    taille: u32,
    /// Qualité, de 1 à 100.
    #[arg(long, default_value_t = 85)]
    qualite: u8,
    /// RAW : exporter l'aperçu JPEG intégré au lieu de développer le capteur (bien plus rapide,
    /// rendu de l'appareil ; suffisant pour une galerie web ou une épreuve).
    #[arg(long)]
    apercu: bool,
    /// Ne pas recopier les métadonnées EXIF (JPEG vers JPEG).
    #[arg(long)]
    sans_exif: bool,
    /// Texte ajouté au nom de chaque fichier exporté.
    #[arg(long, default_value = "")]
    suffixe: String,
    /// Remplacer les exports déjà présents.
    #[arg(long)]
    ecraser: bool,
}

struct Image {
    l: usize,
    h: usize,
    px: Vec<u8>, // RGB 8 bits
}

fn main() {
    let a = Args::parse();
    let fichiers = if a.source.is_file() {
        vec![a.source.clone()]
    } else {
        parcours::fichiers(&a.source, Nature::photo)
    };
    if fichiers.is_empty() {
        println!("Aucune photo à exporter.");
        return;
    }
    std::fs::create_dir_all(&a.destination).expect("dossier de destination");
    let debut = Instant::now();
    let (faits, octets, sautes) = (AtomicUsize::new(0), AtomicU64::new(0), AtomicUsize::new(0));
    let erreurs: Vec<String> = fichiers
        .par_iter()
        .filter_map(|p| {
            let r = exporter(&a, p);
            faits.fetch_add(1, Ordering::Relaxed);
            match r {
                Ok(Some(n)) => {
                    octets.fetch_add(n, Ordering::Relaxed);
                    None
                }
                Ok(None) => {
                    sautes.fetch_add(1, Ordering::Relaxed);
                    None
                }
                Err(e) => Some(format!("{} : {e}", p.display())),
            }
        })
        .collect();
    let s = debut.elapsed().as_secs_f64().max(1e-3);
    let n = fichiers.len() - erreurs.len() - sautes.load(Ordering::Relaxed);
    println!(
        "{n} photo(s) exportée(s) en {s:.1} s ({:.1} photos/s), {:.1} Mo écrits.",
        n as f64 / s,
        octets.load(Ordering::Relaxed) as f64 / 1e6
    );
    let k = sautes.load(Ordering::Relaxed);
    if k > 0 {
        println!("{k} déjà exportée(s), laissée(s) telle(s) quelle(s) (--ecraser pour refaire).");
    }
    if !erreurs.is_empty() {
        println!("\nÉchecs ({}) :", erreurs.len());
        for e in &erreurs {
            println!("  {e}");
        }
        std::process::exit(1);
    }
}

fn exporter(a: &Args, p: &Path) -> Result<Option<u64>, String> {
    let ext = match a.format {
        Format::Jpeg => "jpg",
        Format::Avif => "avif",
        Format::Png => "png",
    };
    let stem = p.file_stem().unwrap_or_default().to_string_lossy();
    // Deux sources de même nom (IMG_1.CR2 et IMG_1.JPG) ne doivent pas s'écraser : le RAW garde son
    // extension dans le nom quand un JPEG du même nom existe à côté.
    let jumeau = Nature::de(p) == Nature::Raw && ["jpg", "JPG", "jpeg", "JPEG"].iter().any(|e| p.with_extension(e).exists());
    let nom = if jumeau {
        format!("{stem}_{}{}.{ext}", p.extension().unwrap_or_default().to_string_lossy(), a.suffixe)
    } else {
        format!("{stem}{}.{ext}", a.suffixe)
    };
    let sortie = a.destination.join(nom);
    if sortie.exists() && !a.ecraser {
        return Ok(None);
    }
    let octets = Arc::new(std::fs::read(p).map_err(|e| e.to_string())?);
    let nature = Nature::de(p);
    let (img, orientation, exif) = match nature {
        Nature::Jpeg => {
            let (img, o) = jpeg(&octets)?;
            let exif = if a.sans_exif { None } else { app1_exif(&octets) };
            (img, o, exif)
        }
        Nature::Raw => {
            let (img, o) = std::panic::catch_unwind(|| raw(&octets, a.apercu))
                .unwrap_or_else(|_| Err("RAW non pris en charge".into()))?;
            (img, o, None)
        }
        _ => return Err("format non pris en charge".into()),
    };
    let img = redresser(img, orientation);
    let img = if a.taille > 0 { reduire(img, a.taille as usize)? } else { img };
    let donnees = match a.format {
        Format::Jpeg => encoder_jpeg(&img, a.qualite, exif.as_deref())?,
        Format::Avif => encoder_avif(&img, a.qualite)?,
        Format::Png => encoder_png(&img)?,
    };
    let tmp = sortie.with_extension(format!("{ext}.part"));
    std::fs::write(&tmp, &donnees).and_then(|_| std::fs::rename(&tmp, &sortie)).map_err(|e| e.to_string())?;
    Ok(Some(donnees.len() as u64))
}

fn jpeg(o: &[u8]) -> Result<(Image, u16), String> {
    let opts = zune_core::options::DecoderOptions::default()
        .jpeg_set_out_colorspace(zune_core::colorspace::ColorSpace::RGB)
        .set_max_width(1 << 16)
        .set_max_height(1 << 16);
    let mut d = zune_jpeg::JpegDecoder::new_with_options(o, opts);
    let px = d.decode().map_err(|e| e.to_string())?;
    let i = d.info().ok_or("JPEG illisible")?;
    Ok((Image { l: i.width as usize, h: i.height as usize, px }, socle::apercu::orientation_jpeg(o).unwrap_or(1)))
}


fn raw(o: &Arc<Vec<u8>>, apercu: bool) -> Result<(Image, u16), String> {
    let src = RawSource::new_from_shared_vec(o.clone());
    let dec = rawler::get_decoder(&src).map_err(|e| e.to_string())?;
    let params = RawDecodeParams::default();
    let md = dec.raw_metadata(&src, &params).ok();
    let exif_o = md.as_ref().and_then(|m| m.exif.orientation);
    if apercu {
        if let Ok(Some(im)) = dec.preview_image(&src, &params) {
            let rgb = im.to_rgb8();
            let (l, h) = (rgb.width() as usize, rgb.height() as usize);
            return Ok((Image { l, h, px: rgb.into_raw() }, exif_o.unwrap_or(1)));
        }
    }
    let r = dec.raw_image(&src, &params, false).map_err(|e| e.to_string())?;
    // rawler ne lit l'orientation que des DNG : l'EXIF du fichier comble ce manque (comme Prism).
    let o_dec = r.orientation.to_u16();
    let orientation = if o_dec <= 1 { exif_o.unwrap_or(1) } else { o_dec };
    let im = RawDevelop::default()
        .develop_intermediate(&r)
        .map_err(|e| e.to_string())?
        .to_dynamic_image()
        .ok_or("développement impossible")?;
    let rgb = im.to_rgb8();
    let (l, h) = (rgb.width() as usize, rgb.height() as usize);
    Ok((Image { l, h, px: rgb.into_raw() }, orientation))
}

fn redresser(img: Image, o: u16) -> Image {
    let r = socle::apercu::redresser(socle::apercu::Image { l: img.l, h: img.h, px: img.px }, o);
    Image { l: r.l, h: r.h, px: r.px }
}

fn reduire(img: Image, cote: usize) -> Result<Image, String> {
    let grand = img.l.max(img.h);
    if grand <= cote {
        return Ok(img);
    }
    let k = cote as f64 / grand as f64;
    let (nl, nh) = (((img.l as f64 * k).round() as u32).max(1), ((img.h as f64 * k).round() as u32).max(1));
    let src = fr::images::Image::from_vec_u8(img.l as u32, img.h as u32, img.px, fr::PixelType::U8x3).map_err(|e| e.to_string())?;
    let mut dst = fr::images::Image::new(nl, nh, fr::PixelType::U8x3);
    let opts = fr::ResizeOptions::new().resize_alg(fr::ResizeAlg::Convolution(fr::FilterType::Lanczos3));
    fr::Resizer::new().resize(&src, &mut dst, &opts).map_err(|e| e.to_string())?;
    Ok(Image { l: nl as usize, h: nh as usize, px: dst.into_vec() })
}

fn encoder_jpeg(img: &Image, q: u8, exif: Option<&[u8]>) -> Result<Vec<u8>, String> {
    let mut out = Vec::with_capacity(img.l * img.h / 4);
    let mut e = jpeg_encoder::Encoder::new(&mut out, q.clamp(1, 100));
    e.set_optimized_huffman_tables(true);
    if let Some(x) = exif {
        e.add_app_segment(1, x).map_err(|e| e.to_string())?;
    }
    e.encode(&img.px, img.l as u16, img.h as u16, jpeg_encoder::ColorType::Rgb).map_err(|e| e.to_string())?;
    Ok(out)
}

fn encoder_avif(img: &Image, q: u8) -> Result<Vec<u8>, String> {
    let px: &[ravif::RGB8] = unsafe { std::slice::from_raw_parts(img.px.as_ptr() as *const ravif::RGB8, img.l * img.h) };
    let r = ravif::Encoder::new()
        .with_quality(q.clamp(1, 100) as f32)
        .with_speed(6)
        .with_num_threads(Some(1))
        .encode_rgb(ravif::Img::new(px, img.l, img.h))
        .map_err(|e| e.to_string())?;
    Ok(r.avif_file)
}

fn encoder_png(img: &Image) -> Result<Vec<u8>, String> {
    let mut out = vec![];
    {
        let mut e = png::Encoder::new(&mut out, img.l as u32, img.h as u32);
        e.set_color(png::ColorType::Rgb);
        e.set_depth(png::BitDepth::Eight);
        e.set_compression(png::Compression::Fast);
        let mut w = e.write_header().map_err(|e| e.to_string())?;
        w.write_image_data(&img.px).map_err(|e| e.to_string())?;
    }
    Ok(out)
}

/// Le segment APP1 « Exif » d'un JPEG, avec l'orientation remise à 1 (les pixels sont déjà
/// redressés) et sans la vignette intégrée, qui ne correspondrait plus.
fn app1_exif(o: &[u8]) -> Option<Vec<u8>> {
    let mut i = 2;
    while i + 4 <= o.len() && o[i] == 0xFF {
        let m = o[i + 1];
        if m == 0xDA || m == 0xD9 {
            break;
        }
        let n = u16::from_be_bytes([o[i + 2], o[i + 3]]) as usize;
        let seg = o.get(i + 4..i + 2 + n)?;
        if m == 0xE1 && seg.starts_with(b"Exif\0\0") {
            let mut s = seg.to_vec();
            exif_orientation_1(&mut s[6..]);
            return Some(s);
        }
        i += 2 + n;
    }
    None
}

fn exif_orientation_1(t: &mut [u8]) {
    if t.len() < 8 {
        return;
    }
    let le = &t[0..2] == b"II";
    let u16_ = |t: &[u8], i: usize| -> Option<u16> {
        let b = t.get(i..i + 2)?;
        Some(if le { u16::from_le_bytes([b[0], b[1]]) } else { u16::from_be_bytes([b[0], b[1]]) })
    };
    let u32_ = |t: &[u8], i: usize| -> Option<u32> {
        let b = t.get(i..i + 4)?;
        let b = [b[0], b[1], b[2], b[3]];
        Some(if le { u32::from_le_bytes(b) } else { u32::from_be_bytes(b) })
    };
    let Some(ifd) = u32_(t, 4).map(|v| v as usize) else { return };
    let Some(n) = u16_(t, ifd) else { return };
    for k in 0..n as usize {
        let e = ifd + 2 + k * 12;
        if u16_(t, e) == Some(0x0112) {
            let un = if le { [1, 0] } else { [0, 1] };
            if let Some(v) = t.get_mut(e + 8..e + 10) {
                v.copy_from_slice(&un);
            }
        }
    }
    // IFD1 (vignette) : on coupe le lien depuis IFD0.
    let lien = ifd + 2 + n as usize * 12;
    if let Some(v) = t.get_mut(lien..lien + 4) {
        v.copy_from_slice(&[0; 4]);
    }
}
