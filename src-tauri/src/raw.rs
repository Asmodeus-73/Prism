//! Native camera RAW decoding for the desktop app (pure Rust, `rawler`).
//!
//! The page sends the file's bytes as the raw body of `raw_decode`, with header `x-wb`
//! ("camera" or "auto"). The answer is the developed photo, linear ProPhoto RGB, 16 bits:
//!
//! ```text
//! offset  size     content (little-endian)
//! 0       4        magic "PRW1"
//! 4       4        width  (u32)
//! 8       4        height (u32)
//! 12      4        n = length of the JSON metadata (u32)
//! 16      n        JSON {make, model, iso, shutter (s), aperture (f-number), focal (mm), lens}
//! 16+n    pad      zeros up to the next multiple of 8 (the page views the pixels without a copy)
//! start   w*h*3*2  pixels, u16 R G B interleaved, row by row, already turned upright
//! ```
//!
//! Same look as the LibRaw path of the page (web/raw), so a photo looks the same whichever path
//! developed it: camera or automatic white balance, the camera's colour matrix, ProPhoto primaries,
//! no automatic brightening, no DNG default crop, white balance scaled so the strongest multiplier
//! is 1 (LibRaw with highlight 2), and LibRaw's default BT.709 tone curve (power 0.45, toe slope
//! 4.5): the bundled LibRaw ignores the `gamm` option the page passes, so its "linear" output
//! always carries that curve, and 0440's development was tuned on it.
//! Highlights are clipped after white balance (LibRaw blends them).
//! Anything rawler cannot read returns an error and the page falls back to LibRaw.

use rawler::decoders::{RawDecodeParams, RawMetadata};
use rawler::imgop::chromatic_adaption::adapt_bradford;
use rawler::imgop::develop::{Intermediate, ProcessingStep, RawDevelop};
use rawler::imgop::matrix::{multiply, normalize, pseudo_inverse, transform_1d};
use rawler::imgop::xyz::{Illuminant, SRGB_TO_XYZ_D65};
use rawler::rawsource::RawSource;
use rawler::RawImage;
use serde::Serialize;
use std::sync::Arc;
use tauri::ipc::{InvokeBody, Request, Response};

pub const MAGIC: &[u8; 4] = b"PRW1";

/// Linear sRGB (D65) to linear ProPhoto RGB (D50), the matrix LibRaw uses for outputColor 4.
const PRO_FROM_SRGB: [[f32; 3]; 3] = [
    [0.529317, 0.330092, 0.140588],
    [0.098368, 0.873465, 0.028169],
    [0.016879, 0.117663, 0.865457],
];

#[derive(Serialize, Default, Debug, Clone, PartialEq)]
pub struct Meta {
    pub make: String,
    pub model: String,
    pub iso: f64,
    pub shutter: f64,
    pub aperture: f64,
    pub focal: f64,
    pub lens: String,
}

#[tauri::command]
pub async fn raw_decode(request: Request<'_>) -> Result<Response, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("données RAW manquantes".into());
    };
    let auto_wb = request.headers().get("x-wb").and_then(|v| v.to_str().ok()) == Some("auto");
    let bytes = Arc::new(bytes.clone());
    tauri::async_runtime::spawn_blocking(move || develop(bytes, auto_wb).map(Response::new))
        .await
        .map_err(|e| e.to_string())?
}

/// Decodes and packs; a panic inside rawler (it still has todo!() paths for exotic or damaged
/// files) becomes an ordinary error, so the page falls back to LibRaw.
pub fn develop(bytes: Arc<Vec<u8>>, auto_wb: bool) -> Result<Vec<u8>, String> {
    std::panic::catch_unwind(|| decode(bytes, auto_wb)).unwrap_or_else(|_| Err("format RAW non pris en charge".into()))
}

/// The answer with its header written and room for the pixels; returns it and where they start.
pub fn packed(w: usize, h: usize, meta: &Meta) -> (Vec<u8>, usize) {
    let json = serde_json::to_vec(meta).unwrap_or_else(|_| b"{}".to_vec());
    let start = (16 + json.len()).div_ceil(8) * 8;
    let mut out = Vec::with_capacity(start + w * h * 6);
    out.extend_from_slice(MAGIC);
    out.extend_from_slice(&(w as u32).to_le_bytes());
    out.extend_from_slice(&(h as u32).to_le_bytes());
    out.extend_from_slice(&(json.len() as u32).to_le_bytes());
    out.extend_from_slice(&json);
    out.resize(start + w * h * 6, 0);
    (out, start)
}

fn decode(bytes: Arc<Vec<u8>>, auto_wb: bool) -> Result<Vec<u8>, String> {
    let src = RawSource::new_from_shared_vec(bytes);
    let decoder = rawler::get_decoder(&src).map_err(|e| e.to_string())?;
    let params = RawDecodeParams::default();
    let raw = decoder.raw_image(&src, &params, false).map_err(|e| e.to_string())?;
    let md = decoder.raw_metadata(&src, &params).ok();
    let mut meta = meta(&raw, md.as_ref());
    if meta.make.is_empty() && meta.model.is_empty() {
        // CinemaDNG and some converted DNGs only name the camera in UniqueCameraModel
        meta.model = unique_camera_model(src.buf()).unwrap_or_default();
    }

    // black/white levels, demosaic, crop to the active area; white balance and colour are done below
    let steps = [ProcessingStep::Rescale, ProcessingStep::Demosaic, ProcessingStep::FujiRotate, ProcessingStep::CropActiveArea];
    let flips = raw.orientation.to_flips();
    Ok(match RawDevelop::new_with(&steps).develop_intermediate(&raw).map_err(|e| e.to_string())? {
        Intermediate::Monochrome(p) => {
            let px: Vec<[f32; 1]> = p.data.into_iter().map(|v| [v]).collect();
            let curve = Bt709::new();
            write(&px, p.width, p.height, flips, &meta, |c| [curve.apply(c[0]); 3])
        }
        Intermediate::ThreeColor(p) => {
            let f = colour::<3>(&raw, &p.data, auto_wb);
            write(&p.data, p.width, p.height, flips, &meta, f)
        }
        Intermediate::FourColor(p) => {
            let f = colour::<4>(&raw, &p.data, auto_wb);
            write(&p.data, p.width, p.height, flips, &meta, f)
        }
    })
}

/// Packs the photo: each pixel through `f` (camera values to linear ProPhoto), turned upright by
/// `flips` (rawler's `to_flips`: flips first, then the transpose), on every core.
pub fn write<const N: usize>(
    px: &[[f32; N]],
    w: usize,
    h: usize,
    (transpose, hflip, vflip): (bool, bool, bool),
    meta: &Meta,
    f: impl Fn(&[f32; N]) -> [f32; 3] + Sync,
) -> Vec<u8> {
    let (ow, oh) = if transpose { (h, w) } else { (w, h) };
    let (mut out, start) = packed(ow, oh, meta);
    let threads = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4).min(16);
    let rows = oh.div_ceil(threads).max(1);
    let f = &f;
    std::thread::scope(|s| {
        for (i, band) in out[start..].chunks_mut(rows * ow * 6).enumerate() {
            s.spawn(move || {
                for (r, line) in band.chunks_exact_mut(ow * 6).enumerate() {
                    let dy = i * rows + r;
                    for (dx, o) in line.as_chunks_mut::<6>().0.iter_mut().enumerate() {
                        let (fx, fy) = if transpose { (dy, dx) } else { (dx, dy) };
                        let x = if hflip { w - 1 - fx } else { fx };
                        let y = if vflip { h - 1 - fy } else { fy };
                        let c = f(&px[y * w + x]);
                        for j in 0..3 {
                            o[j * 2..j * 2 + 2].copy_from_slice(&to16(c[j]).to_le_bytes());
                        }
                    }
                }
            });
        }
    });
    out
}

fn to16(v: f32) -> u16 {
    (v.clamp(0.0, 1.0) * 65535.0 + 0.5) as u16
}

/// XYZ (D65) to camera matrix, 3 or 4 rows (the same choice rawler makes when it develops).
fn xyz_to_cam(raw: &RawImage) -> [[f32; 3]; 4] {
    use Illuminant::*;
    let found = raw.color_matrix_find_first([D65, A, B, C, D50, D55, D75, Daylight, Flash]);
    let flat: Vec<f32> = match found {
        Some((D65, m)) => m,
        Some((illu, m)) if m.len() == 9 => match transform_1d::<3, 3>(&m) {
            Some(m3) => adapt_bradford(&illu, &D65, &m3).as_flattened().to_vec(),
            None => vec![],
        },
        _ => vec![],
    };
    let mut out = [[0.0; 3]; 4];
    if flat.len() < 9 || !flat.len().is_multiple_of(3) {
        // no usable matrix: treat the camera as sRGB
        out[..3].copy_from_slice(&pseudo_inverse(SRGB_TO_XYZ_D65));
        return out;
    }
    for (i, row) in flat.as_chunks::<3>().0.iter().take(4).enumerate() {
        out[i] = [row[0], row[1], row[2]];
    }
    out
}

/// White balance + camera matrix + ProPhoto, for camera pixels of N channels (0..1).
fn colour<const N: usize>(raw: &RawImage, px: &[[f32; N]], auto_wb: bool) -> impl Fn(&[f32; N]) -> [f32; 3] + Sync + use<N> {
    let xyz2cam = xyz_to_cam(raw);
    let cam_rgb = multiply(&xyz2cam, &SRGB_TO_XYZ_D65);
    let cam2srgb = pseudo_inverse(normalize(cam_rgb));
    let m = multiply(&PRO_FROM_SRGB, &cam2srgb);

    let ok = |v: &[f32]| v.iter().all(|v| v.is_finite() && *v > 0.0);
    let mut wb: [f32; N] = std::array::from_fn(|c| raw.wb_coeffs[c]);
    if auto_wb {
        wb = gray_world(px);
    } else if !ok(&wb) {
        // no as-shot white balance in the file: daylight, from the matrix (as dcraw does)
        wb = std::array::from_fn(|c| 1.0 / cam_rgb[c].iter().sum::<f32>());
    }
    if !ok(&wb) {
        wb = [1.0; N];
    }
    // like LibRaw with highlight 2: the strongest multiplier is 1, nothing exceeds sensor white
    let hi = wb.iter().copied().fold(0.0, f32::max);
    let k = wb.map(|v| v / hi);
    // saturated sensor values land at the weakest multiplier: clipped there they stay neutral
    let clip = k.iter().copied().fold(f32::MAX, f32::min);
    let curve = Bt709::new();
    move |p| {
        let c: [f32; N] = std::array::from_fn(|i| (p[i] * k[i]).min(clip));
        m.map(|row| curve.apply((0..N).map(|i| row[i] * c[i]).sum()))
    }
}

/// LibRaw's default output curve (dcraw `gamma_curve(0.45, 4.5, 2, 0x10000)`), as a 16-bit table.
struct Bt709(Vec<f32>);

impl Bt709 {
    fn new() -> Self {
        let (pwr, ts) = (0.45f64, 4.5f64);
        // dcraw's search for where the linear toe meets the power segment
        let mut bnd = [0.0f64, 1.0];
        let mut g2 = 0.0;
        for _ in 0..48 {
            g2 = (bnd[0] + bnd[1]) / 2.0;
            let i = usize::from(((g2 / ts).powf(-pwr) - 1.0) / pwr - 1.0 / g2 > -1.0);
            bnd[i] = g2;
        }
        let (g3, g4) = (g2 / ts, g2 * (1.0 / pwr - 1.0));
        Self(
            (0..=65535)
                .map(|i| {
                    let r = i as f64 / 65536.0;
                    (if r < g3 { r * ts } else { r.powf(pwr) * (1.0 + g4) - g4 }).min(1.0) as f32
                })
                .collect(),
        )
    }

    /// Linear 0..1 to the curve, through the same 16-bit steps as LibRaw.
    fn apply(&self, v: f32) -> f32 {
        self.0[(v.clamp(0.0, 1.0) * 65535.0 + 0.5) as usize]
    }
}

/// Automatic white balance: grey world over the pixels that are not near clipping.
fn gray_world<const N: usize>(px: &[[f32; N]]) -> [f32; N] {
    let step = (px.len() / 2_000_000).max(1);
    let mut sum = [0f64; N];
    for p in px.iter().step_by(step).filter(|p| p.iter().all(|v| *v < 0.95)) {
        for (s, v) in sum.iter_mut().zip(p) {
            *s += v.max(0.0) as f64;
        }
    }
    sum.map(|s| if s > 0.0 { (1.0 / s) as f32 } else { 1.0 })
}

fn meta(raw: &RawImage, md: Option<&RawMetadata>) -> Meta {
    let pick = |a: &str, b: &str| if a.trim().is_empty() { b.trim().to_string() } else { a.trim().to_string() };
    let mut m = Meta { make: pick(&raw.clean_make, &raw.make), model: pick(&raw.clean_model, &raw.model), ..Default::default() };
    let Some(md) = md else { return m };
    let e = &md.exif;
    let rat = |r: Option<rawler::formats::tiff::Rational>| r.filter(|r| r.d != 0).map(|r| r.n as f64 / r.d as f64).unwrap_or(0.0);
    m.iso = e
        .iso_speed_ratings
        .map(|v| v as u32)
        .filter(|v| *v > 0)
        .or(e.iso_speed.filter(|v| *v > 0))
        .or(e.recommended_exposure_index)
        .unwrap_or(0) as f64;
    m.shutter = rat(e.exposure_time);
    m.aperture = rat(e.fnumber);
    m.focal = rat(e.focal_length);
    m.lens = match (&md.lens, &e.lens_model) {
        (Some(l), _) if !l.lens_model.is_empty() => [l.lens_make.as_str(), l.lens_model.as_str()].join(" ").trim().to_string(),
        (_, Some(name)) => name.trim().to_string(),
        _ => String::new(),
    };
    m
}

fn unique_camera_model(buf: &[u8]) -> Option<String> {
    use rawler::formats::tiff::{reader::TiffReader, GenericTiffReader};
    let tiff = GenericTiffReader::new_with_buffer(buf, 0, 0, Some(1)).ok()?;
    let name = tiff.root_ifd().get_entry(rawler::tags::DngTag::UniqueCameraModel)?.as_string()?.trim().to_string();
    (!name.is_empty()).then_some(name)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Reads an answer back: (width, height, metadata JSON, pixels).
    fn unpack(b: &[u8]) -> (usize, usize, serde_json::Value, Vec<u16>) {
        assert_eq!(&b[0..4], MAGIC);
        let u = |i: usize| u32::from_le_bytes(b[i..i + 4].try_into().unwrap()) as usize;
        let (w, h, n) = (u(4), u(8), u(12));
        let start = (16 + n).div_ceil(8) * 8;
        assert!(b[16 + n..start].iter().all(|&z| z == 0));
        assert_eq!(b.len(), start + w * h * 6);
        let px = b[start..].chunks_exact(2).map(|c| u16::from_le_bytes([c[0], c[1]])).collect();
        (w, h, serde_json::from_slice(&b[16..16 + n]).unwrap(), px)
    }

    #[test]
    fn layout() {
        let meta = Meta { make: "Canon".into(), model: "EOS R5".into(), iso: 100.0, shutter: 0.004, aperture: 2.8, focal: 50.0, lens: "RF50mm F1.2 L USM".into() };
        let px = [[0.0, 0.5, 1.0], [2.0, -1.0, 0.25]];
        let b = write(&px, 2, 1, (false, false, false), &meta, |c| *c);
        assert_eq!(packed(2, 1, &meta).1 % 8, 0);
        let (w, h, json, rgb) = unpack(&b);
        assert_eq!((w, h), (2, 1));
        assert_eq!(json["model"], "EOS R5");
        assert_eq!(json["shutter"], 0.004);
        assert_eq!(json["lens"], "RF50mm F1.2 L USM");
        assert_eq!(rgb, vec![0, 32768, 65535, 65535, 0, 16384]);
    }

    #[test]
    fn upright() {
        // 3x2 image, value = index, each orientation against where the pixels must land
        let px: Vec<[f32; 1]> = (0..6).map(|i| [i as f32 / 65535.0]).collect();
        let turn = |o: rawler::Orientation| {
            let (w, h, _, rgb) = unpack(&write(&px, 3, 2, o.to_flips(), &Meta::default(), |c| [c[0]; 3]));
            (w, h, rgb.iter().step_by(3).copied().collect::<Vec<u16>>())
        };
        // rows [0 1 2] / [3 4 5]
        assert_eq!(turn(rawler::Orientation::Normal), (3, 2, vec![0, 1, 2, 3, 4, 5]));
        assert_eq!(turn(rawler::Orientation::Rotate90), (2, 3, vec![3, 0, 4, 1, 5, 2])); // clockwise
        assert_eq!(turn(rawler::Orientation::Rotate270), (2, 3, vec![2, 5, 1, 4, 0, 3])); // anticlockwise
        assert_eq!(turn(rawler::Orientation::Rotate180), (3, 2, vec![5, 4, 3, 2, 1, 0]));
        assert_eq!(turn(rawler::Orientation::HorizontalFlip), (3, 2, vec![2, 1, 0, 5, 4, 3]));
    }

    #[test]
    fn tone_curve() {
        // BT.709: 4.5x in the toe, 1.099 x^0.45 - 0.099 above
        let c = Bt709::new();
        assert_eq!(c.apply(0.0), 0.0);
        assert!((c.apply(0.01) - 0.045).abs() < 1e-3);
        assert!((c.apply(0.18) - (1.099 * 0.18f32.powf(0.45) - 0.099)).abs() < 2e-3);
        assert!((c.apply(1.0) - 1.0).abs() < 1e-3);
    }

    #[test]
    fn rejects_non_raw() {
        assert!(develop(Arc::new(b"not a raw file at all".to_vec()), false).is_err());
        // what the page sends to load rawler's camera list ahead of the first photo
        assert!(develop(Arc::new(vec![0; 4]), false).is_err());
    }

    /// Damaged files (PRISM_RAW_BAD, a list separated by ':') must give an error, never a crash.
    #[test]
    fn damaged() {
        let Ok(list) = std::env::var("PRISM_RAW_BAD") else { return };
        for path in list.split(':') {
            let r = develop(Arc::new(std::fs::read(path).unwrap()), false);
            println!("{path}: {}", r.as_ref().map(|b| format!("{} bytes", b.len())).unwrap_or_else(|e| e.clone()));
        }
    }

    /// Decodes a real file when PRISM_RAW_SAMPLE points at one (not in the repository);
    /// PRISM_RAW_OUT=<prefix> also saves the answers.
    #[test]
    fn sample() {
        let Ok(path) = std::env::var("PRISM_RAW_SAMPLE") else { return };
        let bytes = Arc::new(std::fs::read(&path).unwrap());
        for auto in [false, true, false] {
            let t = std::time::Instant::now();
            let b = develop(bytes.clone(), auto).unwrap();
            let ms = t.elapsed().as_millis();
            let (w, h, json, rgb) = unpack(&b);
            let mean: Vec<f64> = (0..3).map(|c| rgb.iter().skip(c).step_by(3).map(|&v| v as f64).sum::<f64>() / (w * h) as f64).collect();
            println!("{path} auto_wb={auto}: {w}x{h} in {ms} ms, mean ProPhoto {mean:.0?}, {json}");
            if let Ok(out) = std::env::var("PRISM_RAW_OUT") {
                std::fs::write(format!("{out}.{}.prw", if auto { "auto" } else { "camera" }), &b).unwrap();
            }
        }
    }
}
