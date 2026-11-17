//! Vérifie qu'un fichier TIFF (la plupart des RAW : CR2, NEF, ARW, DNG, ORF, PEF, RW2…) contient
//! bien toutes les données que ses répertoires annoncent. Un fichier tronqué annonce des bandes
//! d'image qui dépassent sa fin ; les décodeurs, eux, complètent souvent sans rien dire.

const STRIP_OFFSETS: u16 = 273;
const STRIP_COUNTS: u16 = 279;
const TILE_OFFSETS: u16 = 324;
const TILE_COUNTS: u16 = 325;
const SUB_IFDS: u16 = 330;
const JPEG_OFFSET: u16 = 513;
const JPEG_LENGTH: u16 = 514;
const EXIF_IFD: u16 = 34665;

/// `None` si ce n'est pas un TIFF, sinon la fin la plus lointaine annoncée par ses répertoires.
pub fn fin_annoncee(o: &[u8]) -> Option<u64> {
    let le = match o.get(0..4)? {
        [b'I', b'I', _, _] => true,
        [b'M', b'M', _, _] => false,
        _ => return None,
    };
    let t = Lecteur { o, le };
    let magie = t.u16(2)?;
    // 42 = TIFF ; 0x4F52 / 0x5352 = ORF ; 0x55 = RW2
    if !matches!(magie, 42 | 0x4F52 | 0x5352 | 0x55) {
        return None;
    }
    let mut a_voir = vec![t.u32(4)? as u64];
    let mut vus = std::collections::HashSet::new();
    let mut fin = 0u64;
    while let Some(ifd) = a_voir.pop() {
        if ifd == 0 || !vus.insert(ifd) || vus.len() > 64 {
            continue;
        }
        let Some(n) = t.u16(ifd as usize) else { continue };
        let mut champs: std::collections::HashMap<u16, Vec<u64>> = Default::default();
        for i in 0..n as usize {
            let e = ifd as usize + 2 + i * 12;
            let (Some(tag), Some(typ), Some(cnt)) = (t.u16(e), t.u16(e + 2), t.u32(e + 4)) else { break };
            if matches!(tag, STRIP_OFFSETS | STRIP_COUNTS | TILE_OFFSETS | TILE_COUNTS | SUB_IFDS | JPEG_OFFSET | JPEG_LENGTH | EXIF_IFD) {
                champs.insert(tag, t.valeurs(e, typ, cnt));
            }
        }
        for paire in [(STRIP_OFFSETS, STRIP_COUNTS), (TILE_OFFSETS, TILE_COUNTS), (JPEG_OFFSET, JPEG_LENGTH)] {
            if let (Some(off), Some(len)) = (champs.get(&paire.0), champs.get(&paire.1)) {
                for (a, b) in off.iter().zip(len) {
                    fin = fin.max(a + b);
                }
            }
        }
        for t2 in [SUB_IFDS, EXIF_IFD] {
            if let Some(v) = champs.get(&t2) {
                a_voir.extend(v.iter().copied());
            }
        }
        let suivant = ifd as usize + 2 + n as usize * 12;
        if let Some(s) = t.u32(suivant) {
            a_voir.push(s as u64);
        }
    }
    Some(fin)
}

struct Lecteur<'a> {
    o: &'a [u8],
    le: bool,
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
