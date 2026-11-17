//! Date de prise de vue (EXIF DateTimeOriginal), pour les JPEG comme pour les RAW.

use crate::Nature;
use rawler::decoders::RawDecodeParams;
use rawler::rawsource::RawSource;
use serde::Serialize;
use std::io::Cursor;
use std::sync::Arc;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize)]
pub struct Date {
    pub annee: u16,
    pub mois: u8,
    pub jour: u8,
    pub heure: u8,
    pub minute: u8,
    pub seconde: u8,
}

impl Date {
    /// Lit « AAAA:MM:JJ HH:MM:SS » (le format EXIF ; « - » est accepté aussi).
    pub fn exif(s: &str) -> Option<Date> {
        let n: Vec<u32> = s
            .split(|c: char| !c.is_ascii_digit())
            .filter(|p| !p.is_empty())
            .take(6)
            .map(|p| p.parse().ok())
            .collect::<Option<_>>()?;
        if n.len() < 3 || n[0] < 1900 || !(1..=12).contains(&n[1]) || !(1..=31).contains(&n[2]) {
            return None;
        }
        let g = |i: usize| n.get(i).copied().unwrap_or(0) as u8;
        Some(Date { annee: n[0] as u16, mois: n[1] as u8, jour: n[2] as u8, heure: g(3), minute: g(4), seconde: g(5) })
    }

    /// Secondes depuis l'an 0 (pour comparer des écarts, pas pour l'heure exacte).
    pub fn secondes(&self) -> i64 {
        let jours = jours_civils(self.annee as i64, self.mois as i64, self.jour as i64);
        jours * 86_400 + self.heure as i64 * 3600 + self.minute as i64 * 60 + self.seconde as i64
    }

    /// Remplace les jetons {AAAA} {MM} {JJ} {hh} {mm} {ss} d'un modèle.
    pub fn modele(&self, m: &str) -> String {
        m.replace("{AAAA}", &format!("{:04}", self.annee))
            .replace("{MM}", &format!("{:02}", self.mois))
            .replace("{JJ}", &format!("{:02}", self.jour))
            .replace("{hh}", &format!("{:02}", self.heure))
            .replace("{mm}", &format!("{:02}", self.minute))
            .replace("{ss}", &format!("{:02}", self.seconde))
    }
}

fn jours_civils(a: i64, m: i64, j: i64) -> i64 {
    let a = if m <= 2 { a - 1 } else { a };
    let ere = a.div_euclid(400);
    let ae = a - ere * 400;
    let mp = (m + 9) % 12;
    let ja = (153 * mp + 2) / 5 + j - 1;
    let je = ae * 365 + ae / 4 - ae / 100 + ja;
    ere * 146_097 + je
}

/// La date de prise de vue lue dans les octets du fichier, s'il en a une.
pub fn prise_de_vue(nature: Nature, octets: &Arc<Vec<u8>>) -> Option<Date> {
    match nature {
        Nature::Raw => std::panic::catch_unwind(|| {
            let src = RawSource::new_from_shared_vec(octets.clone());
            let dec = rawler::get_decoder(&src).ok()?;
            let meta = dec.raw_metadata(&src, &RawDecodeParams::default()).ok()?;
            meta.exif.date_time_original.or(meta.exif.create_date).as_deref().and_then(Date::exif)
        })
        .ok()
        .flatten(),
        _ => {
            let exif = exif::Reader::new().read_from_container(&mut Cursor::new(&octets[..])).ok()?;
            [exif::Tag::DateTimeOriginal, exif::Tag::DateTimeDigitized, exif::Tag::DateTime].iter().find_map(|t| {
                let f = exif.get_field(*t, exif::In::PRIMARY)?;
                match &f.value {
                    exif::Value::Ascii(v) => v.first().and_then(|s| Date::exif(&String::from_utf8_lossy(s))),
                    _ => None,
                }
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn lecture_et_modele() {
        let d = Date::exif("2026:10:10 15:47:24").unwrap();
        assert_eq!(d.modele("{AAAA}/{AAAA}-{MM}-{JJ}/{hh}{mm}{ss}"), "2026/2026-10-10/154724");
        assert!(Date::exif("0000:00:00 00:00:00").is_none());
        let e = Date::exif("2026:10:11 15:47:24").unwrap();
        assert_eq!(e.secondes() - d.secondes(), 86_400);
        let f = Date::exif("2024:03:01 00:00:00").unwrap();
        let g = Date::exif("2024:02:28 00:00:00").unwrap();
        assert_eq!(f.secondes() - g.secondes(), 2 * 86_400);
    }
}
