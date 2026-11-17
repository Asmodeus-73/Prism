//! Lecture minimale des répertoires d'un fichier TIFF (la plupart des RAW : CR2, NEF, ARW, DNG,
//! ORF, PEF, RW2…), sans rien décoder : où sont les données d'image, où sont les aperçus JPEG,
//! quelle est la date de prise de vue. Seules les pages du fichier qui contiennent les répertoires
//! sont lues, ce qui compte quand le fichier est sur une carte ou un disque dur.

use std::collections::HashMap;

const COMPRESSION: u16 = 259;
const ORIENTATION: u16 = 274;
const STRIP_OFFSETS: u16 = 273;
const STRIP_COUNTS: u16 = 279;
const TILE_OFFSETS: u16 = 324;
const TILE_COUNTS: u16 = 325;
const SUB_IFDS: u16 = 330;
const JPEG_OFFSET: u16 = 513;
const JPEG_LENGTH: u16 = 514;
const EXIF_IFD: u16 = 34665;
const DATE_ORIGINALE: u16 = 36867;
const SOUS_SECONDES: u16 = 37521;

struct Ifd {
    entiers: HashMap<u16, Vec<u64>>,
    textes: HashMap<u16, String>,
}

struct Lecteur<'a> {
    o: &'a [u8],
    le: bool,
}

fn ifds(o: &[u8]) -> Option<Vec<Ifd>> {
    let le = match o.get(0..4)? {
        [b'I', b'I', _, _] => true,
        [b'M', b'M', _, _] => false,
        _ => return None,
    };
    let t = Lecteur { o, le };
    // 42 = TIFF ; 0x4F52 / 0x5352 = ORF ; 0x55 = RW2
    if !matches!(t.u16(2)?, 42 | 0x4F52 | 0x5352 | 0x55) {
        return None;
    }
    let mut a_voir = vec![t.u32(4)? as u64];
    let mut vus = std::collections::HashSet::new();
    let mut res = vec![];
    while let Some(ifd) = a_voir.pop() {
        if ifd == 0 || !vus.insert(ifd) || vus.len() > 64 {
            continue;
        }
        let Some(n) = t.u16(ifd as usize) else { continue };
        let mut x = Ifd { entiers: HashMap::new(), textes: HashMap::new() };
        for i in 0..n as usize {
            let e = ifd as usize + 2 + i * 12;
            let (Some(tag), Some(typ), Some(cnt)) = (t.u16(e), t.u16(e + 2), t.u32(e + 4)) else { break };
            match tag {
                COMPRESSION | ORIENTATION | STRIP_OFFSETS | STRIP_COUNTS | TILE_OFFSETS | TILE_COUNTS | SUB_IFDS | JPEG_OFFSET | JPEG_LENGTH | EXIF_IFD => {
                    x.entiers.insert(tag, t.valeurs(e, typ, cnt));
                }
                DATE_ORIGINALE | SOUS_SECONDES if typ == 2 => {
                    if let Some(s) = t.texte(e, cnt) {
                        x.textes.insert(tag, s);
                    }
                }
                _ => {}
            }
        }
        for t2 in [SUB_IFDS, EXIF_IFD] {
            if let Some(v) = x.entiers.get(&t2) {
                a_voir.extend(v.iter().copied());
            }
        }
        if let Some(s) = t.u32(ifd as usize + 2 + n as usize * 12) {
            a_voir.push(s as u64);
        }
        res.push(x);
    }
    Some(res)
}

/// `None` si ce n'est pas un TIFF, sinon la fin la plus lointaine annoncée par ses répertoires.
pub fn fin_annoncee(o: &[u8]) -> Option<u64> {
    let mut fin = 0u64;
    for x in ifds(o)? {
        for paire in [(STRIP_OFFSETS, STRIP_COUNTS), (TILE_OFFSETS, TILE_COUNTS), (JPEG_OFFSET, JPEG_LENGTH)] {
            if let (Some(off), Some(len)) = (x.entiers.get(&paire.0), x.entiers.get(&paire.1)) {
                for (a, b) in off.iter().zip(len) {
                    fin = fin.max(a + b);
                }
            }
        }
    }
    Some(fin)
}

/// Les positions des JPEG que les répertoires annoncent (aperçus, vignettes).
pub fn jpegs_annonces(o: &[u8]) -> Vec<usize> {
    let mut v = vec![];
    for x in ifds(o).unwrap_or_default() {
        if let Some(off) = x.entiers.get(&JPEG_OFFSET) {
            v.extend(off.iter().map(|&a| a as usize));
        }
        let jpeg = x.entiers.get(&COMPRESSION).and_then(|c| c.first()).is_some_and(|&c| c == 6 || c == 7);
        if let (true, Some(off)) = (jpeg, x.entiers.get(&STRIP_OFFSETS)) {
            if off.len() == 1 {
                v.push(off[0] as usize);
            }
        }
    }
    v
}

/// L'orientation EXIF du premier répertoire (1 à 8).
pub fn orientation(o: &[u8]) -> Option<u16> {
    let v = ifds(o)?.into_iter().next()?.entiers.get(&ORIENTATION)?.first().copied()?;
    (1..=8).contains(&v).then_some(v as u16)
}

/// DateTimeOriginal et SubSecTimeOriginal, s'ils y sont.
pub fn date(o: &[u8]) -> Option<(String, Option<String>)> {
    let l = ifds(o)?;
    let d = l.iter().find_map(|x| x.textes.get(&DATE_ORIGINALE).cloned())?;
    let s = l.iter().find_map(|x| x.textes.get(&SOUS_SECONDES).cloned());
    Some((d, s))
}

impl Lecteur<'_> {
    fn u16(&self, i: usize) -> Option<u16> {
        let b: [u8; 2] = self.o.get(i..i + 2)?.try_into().ok()?;
        Some(if self.le { u16::from_le_bytes(b) } else { u16::from_be_bytes(b) })
    }
    fn u32(&self, i: usize) -> Option<u32> {
        let b: [u8; 4] = self.o.get(i..i + 4)?.try_into().ok()?;
        Some(if self.le { u32::from_le_bytes(b) } else { u32::from_be_bytes(b) })
    }
    fn texte(&self, e: usize, cnt: u32) -> Option<String> {
        let n = cnt as usize;
        let base = if n <= 4 { e + 8 } else { self.u32(e + 8)? as usize };
        let b = self.o.get(base..base + n)?;
        let s = String::from_utf8_lossy(b).trim_end_matches('\0').trim().to_string();
        (!s.is_empty()).then_some(s)
    }
    /// Les valeurs entières (SHORT, LONG, IFD) d'une entrée, en ligne ou à l'adresse indiquée.
    fn valeurs(&self, e: usize, typ: u16, cnt: u32) -> Vec<u64> {
        let taille = match typ {
            3 => 2,
            4 | 13 => 4,
            _ => return vec![],
        };
        let cnt = cnt.min(1 << 16) as usize;
        let base = if taille * cnt <= 4 { e + 8 } else { self.u32(e + 8).unwrap_or(u32::MAX) as usize };
        (0..cnt)
            .map_while(|i| {
                let p = base.checked_add(i * taille)?;
                if taille == 2 {
                    self.u16(p).map(|v| v as u64)
                } else {
                    self.u32(p).map(|v| v as u64)
                }
            })
            .collect()
    }
}
