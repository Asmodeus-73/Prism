//! Vérifie qu'une photo se décode en entier.
//!
//! Un fichier abîmé (carte défectueuse, copie interrompue, secteur illisible) a souvent l'air normal
//! dans un explorateur : sa vignette est intacte, sa taille plausible. Seul un décodage complet
//! montre le problème : JPEG sans marqueur de fin, données entropiques invalides, bas de l'image
//! uni (les logiciels y affichent une bande grise), RAW dont le capteur ne se lit pas jusqu'au bout.

use crate::Nature;
use rawler::decoders::RawDecodeParams;
use rawler::rawsource::RawSource;
use rawler::RawImageData;
use serde::Serialize;
use std::sync::Arc;
use zune_core::options::DecoderOptions;
use zune_jpeg::JpegDecoder;

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(tag = "etat", content = "detail", rename_all = "lowercase")]
pub enum Verdict {
    Sain,
    /// Le fichier est endommagé ; la raison est lisible par une personne.
    Abime(String),
    /// Format que ces outils ne savent pas vérifier (appareil inconnu, HEIF…).
    Inconnu(String),
}

#[derive(Clone, Debug, Serialize)]
pub struct Rapport {
    pub verdict: Verdict,
    pub largeur: usize,
    pub hauteur: usize,
    /// Défauts mineurs : l'image principale est lisible mais quelque chose cloche.
    pub remarques: Vec<String>,
}

impl Rapport {
    fn abime(r: impl Into<String>) -> Rapport {
        Rapport { verdict: Verdict::Abime(r.into()), largeur: 0, hauteur: 0, remarques: vec![] }
    }
    fn inconnu(r: impl Into<String>) -> Rapport {
        Rapport { verdict: Verdict::Inconnu(r.into()), largeur: 0, hauteur: 0, remarques: vec![] }
    }
}

pub fn verifier(nature: Nature, octets: &Arc<Vec<u8>>) -> Rapport {
    if octets.is_empty() {
        return Rapport::abime("fichier vide");
    }
    if octets.iter().take(64 * 1024).all(|&b| b == 0) && octets.iter().all(|&b| b == 0) {
        return Rapport::abime("fichier rempli de zéros");
    }
    match nature {
        Nature::Jpeg => jpeg(octets),
        Nature::Raw => raw(octets),
        _ => Rapport::inconnu("format non vérifié"),
    }
}

/// Le fichier se termine par le marqueur FFD9, à un remplissage final près (zéros, ou quelques
/// octets ajoutés par certains appareils après l'image).
fn termine_par_eoi(o: &[u8]) -> bool {
    let mut n = o.len();
    while n > 0 && o[n - 1] == 0 {
        n -= 1;
    }
    let queue = &o[n.saturating_sub(1024)..n];
    queue.windows(2).any(|w| w == [0xFF, 0xD9])
}

fn jpeg(o: &[u8]) -> Rapport {
    if o.len() < 4 || o[0] != 0xFF || o[1] != 0xD8 {
        return Rapport::abime("ce n'est pas un JPEG (en-tête absent)");
    }
    let termine = termine_par_eoi(o);
    let opts = DecoderOptions::default().set_strict_mode(true).set_max_width(1 << 16).set_max_height(1 << 16);
    let mut d = JpegDecoder::new_with_options(o, opts);
    let pixels = match d.decode() {
        Ok(p) => p,
        Err(e) => {
            return Rapport::abime(if termine {
                format!("données d'image invalides ({e})")
            } else {
                "fichier tronqué : la fin de l'image manque".to_string()
            })
        }
    };
    let info = d.info().unwrap();
    let (w, h) = (info.width as usize, info.height as usize);
    let canaux = if h * w > 0 { pixels.len() / (w * h) } else { 0 };
    let mut r = Rapport { verdict: Verdict::Sain, largeur: w, hauteur: h, remarques: vec![] };
    if !termine {
        r.verdict = Verdict::Abime("fichier tronqué : le marqueur de fin manque".into());
        return r;
    }
    if canaux > 0 {
        if let Some(b) = bande_unie_8(&pixels, w, canaux, h) {
            r.verdict = Verdict::Abime(b.texte("de l'image"));
        }
    }
    r
}

/// Cherche une bande de lignes unies (chaque ligne d'une seule couleur, toutes pareilles) qui
/// trahit des données perdues : en bas d'un fichier tronqué, au milieu quand un morceau du fichier
/// a été remplacé. Une image entièrement unie (photo noire, bouchon) n'est pas abîmée, et le haut de
/// l'image est ignoré (bandes noires d'un scan ou d'un recadrage).
fn bande_unie_8(p: &[u8], w: usize, canaux: usize, h: usize) -> Option<Bande> {
    let ligne = w * canaux;
    // Le décodage ajoute un léger tramage (sous-échantillonnage des couleurs) : une ligne est
    // « unie » si tous ses pixels restent à ±3 du premier.
    bande_unie(h, 3, |y| {
        let l = &p[y * ligne..(y + 1) * ligne];
        let motif = &l[..canaux];
        let proche = |c: &[u8]| c.iter().zip(motif).all(|(&a, &b)| (a as i32 - b as i32).abs() <= 3);
        l.chunks_exact(canaux).all(proche).then(|| {
            let mut v = [0i64; 4];
            for (i, &b) in motif.iter().take(4).enumerate() {
                v[i] = b as i64;
            }
            v
        })
    })
}

#[derive(Debug, PartialEq)]
struct Bande {
    part: f32,
    en_bas: bool,
}

impl Bande {
    fn texte(&self, quoi: &str) -> String {
        if self.en_bas {
            format!("bas {quoi} uni sur {:.0} % de la hauteur (données perdues)", self.part * 100.0)
        } else {
            format!("bande unie au milieu {quoi} sur {:.1} % de la hauteur (données perdues)", self.part * 100.0)
        }
    }
}

fn bande_unie(h: usize, tolerance: i64, unie: impl Fn(usize) -> Option<[i64; 4]>) -> Option<Bande> {
    let pareil = |a: [i64; 4], b: [i64; 4]| a.iter().zip(&b).all(|(x, y)| (x - y).abs() <= tolerance);
    if h < 64 {
        return None;
    }
    // Une bande abîmée peut contenir quelques lignes isolées non unies (bord de bloc du
    // décodeur) : jusqu'à 3 de suite sont tolérées dans la bande.
    let (mut meilleure, mut debut_meilleure) = (0usize, 0usize);
    let (mut debut, mut valeur, mut trous, mut dernier_uni) = (0usize, None::<[i64; 4]>, 0usize, 0usize);
    let mut toutes = true;
    for y in 0..h {
        match unie(y) {
            Some(v) if valeur.is_some_and(|w| pareil(v, w)) => {
                trous = 0;
                dernier_uni = y;
            }
            Some(v) => {
                valeur = Some(v);
                debut = y;
                dernier_uni = y;
                trous = 0;
            }
            None => {
                toutes = false;
                trous += 1;
                if trous > 3 {
                    valeur = None;
                }
            }
        }
        if valeur.is_some() {
            let n = dernier_uni + 1 - debut;
            if n > meilleure {
                meilleure = n;
                debut_meilleure = debut;
            }
        }
    }
    if toutes || debut_meilleure == 0 {
        return None;
    }
    let en_bas = debut_meilleure + meilleure == h;
    let part = meilleure as f32 / h as f32;
    let seuil = if en_bas { (h / 100).max(8) } else { (h / 500).max(8) };
    (meilleure >= seuil).then_some(Bande { part, en_bas })
}

fn raw(o: &Arc<Vec<u8>>) -> Rapport {
    let o = o.clone();
    match std::panic::catch_unwind(move || raw_sans_panique(o)) {
        Ok(r) => r,
        Err(_) => Rapport::abime("le décodeur RAW a échoué (fichier probablement endommagé)"),
    }
}

fn raw_sans_panique(o: Arc<Vec<u8>>) -> Rapport {
    if let Some(fin) = crate::tiff::fin_annoncee(&o) {
        if fin > o.len() as u64 {
            let manque = fin - o.len() as u64;
            return Rapport::abime(format!(
                "fichier tronqué : il manque {:.1} Mo de données d'image ({:.0} %)",
                manque as f64 / 1e6,
                100.0 * manque as f64 / fin as f64
            ));
        }
    }
    let src = RawSource::new_from_shared_vec(o);
    let params = RawDecodeParams::default();
    let dec = match rawler::get_decoder(&src) {
        Ok(d) => d,
        Err(e) => return Rapport::inconnu(format!("RAW non reconnu ({e})")),
    };
    let img = match dec.raw_image(&src, &params, false) {
        Ok(i) => i,
        Err(e) => {
            let m = e.to_string();
            if m.contains("nsupported") || m.contains("Couldn't find camera") {
                return Rapport::inconnu(format!("appareil non pris en charge ({m})"));
            }
            return Rapport::abime(format!("données du capteur illisibles ({m})"));
        }
    };
    let (w, h, cpp) = (img.width, img.height, img.cpp.max(1));
    let mut r = Rapport { verdict: Verdict::Sain, largeur: w, hauteur: h, remarques: vec![] };
    let ligne = w * cpp;
    let part = match &img.data {
        RawImageData::Integer(d) if d.len() >= ligne * h => bande_unie(h, 0, |y| {
            let l = &d[y * ligne..(y + 1) * ligne];
            // Sur un capteur de Bayer, deux photosites voisins diffèrent : seule une ligne
            // vraiment constante (souvent des zéros) trahit des données manquantes.
            l.iter().all(|&v| v == l[0]).then_some([l[0] as i64, 0, 0, 0])
        }),
        RawImageData::Integer(_) => {
            r.verdict = Verdict::Abime("données du capteur incomplètes".into());
            return r;
        }
        RawImageData::Float(_) => None,
    };
    if let Some(b) = part {
        r.verdict = Verdict::Abime(b.texte("du capteur"));
    }
    // L'aperçu intégré : c'est lui qu'affichent les visionneuses, mieux vaut savoir s'il est cassé.
    match dec.preview_image(&src, &params) {
        Ok(_) => {}
        Err(_) => r.remarques.push("aperçu intégré illisible".into()),
    }
    r
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bande_detectee_seulement_en_bas() {
        let (w, h) = (10usize, 100usize);
        let mut p = vec![0u8; w * h * 3];
        for (i, v) in p.iter_mut().enumerate().take(w * 3 * 80) {
            *v = (i * 7 % 200) as u8;
        }
        for v in p.iter_mut().skip(w * 3 * 80) {
            *v = 128;
        }
        let b = bande_unie_8(&p, w, 3, h).unwrap();
        assert!((b.part - 0.2).abs() < 1e-6 && b.en_bas);
        // bande au milieu
        let mut q = p.clone();
        for (i, v) in q.iter_mut().enumerate() {
            let y = i / (w * 3);
            *v = if (40..50).contains(&y) { 90 } else { (i * 13 % 211) as u8 };
        }
        let b = bande_unie_8(&q, w, 3, h).unwrap();
        assert!(!b.en_bas && (b.part - 0.1).abs() < 1e-6);
        // image toute grise : pas un défaut
        assert!(bande_unie_8(&vec![128u8; w * h * 3], w, 3, h).is_none());
    }

    #[test]
    fn jpeg_vide_ou_faux() {
        assert!(matches!(verifier(Nature::Jpeg, &Arc::new(vec![])).verdict, Verdict::Abime(_)));
        assert!(matches!(verifier(Nature::Jpeg, &Arc::new(b"bonjour".to_vec())).verdict, Verdict::Abime(_)));
    }
}
