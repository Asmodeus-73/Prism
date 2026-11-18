//! Les JPEG contenus dans un fichier : l'aperçu pleine taille d'un RAW, la vignette EXIF, l'aperçu
//! MPF d'un JPEG Sony ou Canon… Ils sont repérés sans être décodés (on lit seulement leurs
//! marqueurs), et leurs octets peuvent être servis tels quels à un navigateur, qui les décode sur
//! sa carte graphique. C'est ce qui rend un tri instantané : pas de développement du capteur.

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Flux {
    pub debut: usize,
    pub fin: usize,
    pub l: u16,
    pub h: u16,
}

/// Lit un JPEG qui commence à `debut` ; renvoie ses dimensions et sa fin s'il est complet et
/// n'est pas un JPEG sans perte (les données brutes d'un CR2 ou d'un DNG en sont).
pub fn lire(o: &[u8], debut: usize) -> Option<Flux> {
    if o.get(debut..debut + 3)? != [0xFF, 0xD8, 0xFF] {
        return None;
    }
    let mut p = debut + 2;
    let (mut l, mut h) = (0u16, 0u16);
    loop {
        // Octets de remplissage 0xFF avant un marqueur.
        while *o.get(p)? == 0xFF && *o.get(p + 1)? == 0xFF {
            p += 1;
        }
        if *o.get(p)? != 0xFF {
            return None;
        }
        let m = *o.get(p + 1)?;
        match m {
            0xD9 => {
                return (l > 0 && h > 0).then_some(Flux { debut, fin: p + 2, l, h });
            }
            0xD0..=0xD7 | 0x01 => {
                p += 2;
                continue;
            }
            _ => {}
        }
        let n = u16::from_be_bytes([*o.get(p + 2)?, *o.get(p + 3)?]) as usize;
        if n < 2 {
            return None;
        }
        match m {
            0xC3 | 0xC7 | 0xCB | 0xCF => return None, // sans perte : données du capteur
            0xC0..=0xCF if m != 0xC4 && m != 0xC8 && m != 0xCC => {
                h = u16::from_be_bytes([*o.get(p + 5)?, *o.get(p + 6)?]);
                l = u16::from_be_bytes([*o.get(p + 7)?, *o.get(p + 8)?]);
            }
            _ => {}
        }
        p += 2 + n;
        if m == 0xDA {
            // Données entropiques : jusqu'au prochain marqueur qui n'est ni un octet échappé (FF00)
            // ni un marqueur de redémarrage.
            loop {
                let i = o.get(p..)?.iter().position(|&b| b == 0xFF)?;
                p += i;
                let s = *o.get(p + 1)?;
                if s == 0x00 || (0xD0..=0xD7).contains(&s) || s == 0xFF {
                    p += if s == 0xFF { 1 } else { 2 };
                } else {
                    break;
                }
            }
        }
    }
}

/// Tous les JPEG du fichier : ceux annoncés par les répertoires TIFF d'abord, sinon une recherche
/// dans les `fenetre` premiers octets (CR3, RAF, JPEG avec MPF).
pub fn tous(o: &[u8], fenetre: usize) -> Vec<Flux> {
    let mut v: Vec<Flux> = crate::tiff::jpegs_annonces(o).into_iter().filter_map(|d| lire(o, d)).collect();
    if v.is_empty() {
        let zone = &o[..o.len().min(fenetre)];
        let mut i = 0;
        while let Some(k) = zone[i..].windows(3).position(|w| w == [0xFF, 0xD8, 0xFF]) {
            let d = i + k;
            match lire(o, d) {
                // Un JPEG trouvé : on cherche le suivant après lui, sauf s'il en contient (MPF).
                Some(f) => {
                    v.push(f);
                    i = d + 3;
                }
                None => i = d + 3,
            }
        }
    }
    v.sort_by_key(|f| std::cmp::Reverse(f.l as u32 * f.h as u32));
    v.dedup_by_key(|f| f.debut);
    v
}

/// L'aperçu à afficher en grand : le plus grand qui ne dépasse pas `max` de côté ; s'il n'y en a
/// pas d'au moins 1000 px sous cette limite, le plus petit au-dessus ; à défaut, le plus grand.
pub fn meilleur(v: &[Flux], max: u16) -> Option<Flux> {
    let cote = |f: &&Flux| f.l.max(f.h);
    let aire = |f: &&Flux| f.l as u32 * f.h as u32;
    v.iter()
        .filter(|f| (1000..=max).contains(&cote(f)))
        .max_by_key(aire)
        .or_else(|| v.iter().filter(|f| cote(f) > max).min_by_key(aire))
        .or_else(|| v.iter().max_by_key(aire))
        .copied()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn jpeg_minimal() {
        // SOI, SOF0 (8 × 16), SOS, une donnée échappée, EOI
        let mut o = vec![0u8; 5];
        let d = o.len();
        o.extend([0xFF, 0xD8, 0xFF, 0xC0, 0, 11, 8, 0, 16, 0, 8, 1, 1, 0x11, 0]);
        o.extend([0xFF, 0xDA, 0, 8, 1, 1, 0, 0, 63, 0, 0x12, 0xFF, 0x00, 0x34, 0xFF, 0xD9]);
        let f = lire(&o, d).unwrap();
        assert_eq!((f.l, f.h, f.fin), (8, 16, o.len()));
        assert_eq!(tous(&o, 1 << 20), vec![f]);
        let x = |l, h| Flux { debut: 0, fin: 0, l, h };
        assert_eq!(meilleur(&[x(5616, 3744), x(160, 120)], 4096), Some(x(5616, 3744)));
        assert_eq!(meilleur(&[x(6000, 4000), x(1616, 1080), x(160, 120)], 4096), Some(x(1616, 1080)));
        assert_eq!(meilleur(&[x(160, 120)], 4096), Some(x(160, 120)));
    }
}
