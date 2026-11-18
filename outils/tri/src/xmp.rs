//! Notes et étiquettes dans un fichier XMP à côté de la photo (« IMG_0001.xmp »), la convention
//! que lisent Lightroom, Capture One, Bridge et darktable (qui lit aussi celle-ci).

use std::path::{Path, PathBuf};

pub fn chemin(photo: &Path) -> PathBuf {
    photo.with_extension("xmp")
}

/// Note (-1 = rejetée, 0 à 5 étoiles) et étiquette de couleur, lues dans le XMP s'il existe.
pub fn lire(photo: &Path) -> (i8, Option<String>) {
    let Ok(t) = std::fs::read_to_string(chemin(photo)) else { return (0, None) };
    let note = attribut(&t, "xmp:Rating").and_then(|v| v.parse::<i8>().ok()).unwrap_or(0).clamp(-1, 5);
    let etiquette = attribut(&t, "xmp:Label").filter(|s| !s.is_empty());
    (note, etiquette)
}

fn attribut(t: &str, nom: &str) -> Option<String> {
    // Forme attribut : xmp:Rating="3"
    if let Some(i) = t.find(&format!("{nom}=\"")) {
        let r = &t[i + nom.len() + 2..];
        return r.find('"').map(|f| r[..f].to_string());
    }
    // Forme élément : <xmp:Rating>3</xmp:Rating>
    let o = format!("<{nom}>");
    let i = t.find(&o)?;
    let r = &t[i + o.len()..];
    r.find('<').map(|f| r[..f].trim().to_string())
}

pub fn ecrire(photo: &Path, note: i8, etiquette: Option<&str>) -> std::io::Result<()> {
    let p = chemin(photo);
    let mut t = std::fs::read_to_string(&p).unwrap_or_default();
    if t.is_empty() || !t.contains("rdf:Description") {
        t = String::from(concat!(
            "<x:xmpmeta xmlns:x=\"adobe:ns:meta/\" x:xmptk=\"prism-tri\">\n",
            " <rdf:RDF xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\">\n",
            "  <rdf:Description rdf:about=\"\"\n",
            "    xmlns:xmp=\"http://ns.adobe.com/xap/1.0/\">\n",
            "  </rdf:Description>\n",
            " </rdf:RDF>\n",
            "</x:xmpmeta>\n"
        ));
    }
    t = poser(&t, "xmp:Rating", Some(&note.to_string()));
    t = poser(&t, "xmp:Label", etiquette);
    if !t.contains("xmlns:xmp=") {
        t = t.replacen("<rdf:Description", "<rdf:Description xmlns:xmp=\"http://ns.adobe.com/xap/1.0/\"", 1);
    }
    let tmp = p.with_extension("xmp.tmp");
    std::fs::write(&tmp, t)?;
    std::fs::rename(tmp, p)
}

/// Remplace (ou ajoute, ou retire si `None`) un attribut ou un élément simple.
fn poser(t: &str, nom: &str, valeur: Option<&str>) -> String {
    let attr = format!("{nom}=\"");
    if let Some(i) = t.find(&attr) {
        let fin = i + attr.len() + t[i + attr.len()..].find('"').unwrap_or(0) + 1;
        return match valeur {
            Some(v) => format!("{}{nom}=\"{}\"{}", &t[..i], echapper(v), &t[fin..]),
            None => format!("{}{}", t[..i].trim_end_matches([' ', '\n', '\t']), &t[fin..]).replacen("  >", ">", 1),
        };
    }
    let (o, f) = (format!("<{nom}>"), format!("</{nom}>"));
    if let (Some(i), Some(j)) = (t.find(&o), t.find(&f)) {
        return match valeur {
            Some(v) => format!("{}{o}{}{}", &t[..i], echapper(v), &t[j..]),
            None => format!("{}{}", &t[..i], &t[j + f.len()..]),
        };
    }
    match valeur {
        None => t.to_string(),
        Some(v) => {
            // Ajout comme attribut de la première rdf:Description.
            let Some(i) = t.find("<rdf:Description") else { return t.to_string() };
            let Some(k) = t[i..].find('>') else { return t.to_string() };
            let mut fin = i + k;
            if t[..fin].ends_with('/') {
                fin -= 1;
            }
            format!("{}\n    {nom}=\"{}\"{}", &t[..fin], echapper(v), &t[fin..])
        }
    }
}

fn echapper(v: &str) -> String {
    v.replace('&', "&amp;").replace('"', "&quot;").replace('<', "&lt;")
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn aller_retour() {
        let d = std::env::temp_dir().join(format!("tri-xmp-{}", std::process::id()));
        std::fs::create_dir_all(&d).unwrap();
        let p = d.join("IMG_1.CR2");
        assert_eq!(lire(&p), (0, None));
        ecrire(&p, 4, Some("Red")).unwrap();
        assert_eq!(lire(&p), (4, Some("Red".into())));
        ecrire(&p, -1, None).unwrap();
        assert_eq!(lire(&p), (-1, None));
        // XMP existant d'un autre logiciel, en forme élément : modifié sans perdre le reste.
        std::fs::write(chemin(&p), "<x:xmpmeta><rdf:RDF><rdf:Description rdf:about=\"\" xmlns:xmp=\"http://ns.adobe.com/xap/1.0/\" xmlns:crs=\"c\" crs:Exposure2012=\"+0.50\"><xmp:Rating>2</xmp:Rating></rdf:Description></rdf:RDF></x:xmpmeta>").unwrap();
        assert_eq!(lire(&p).0, 2);
        ecrire(&p, 5, Some("Green")).unwrap();
        let t = std::fs::read_to_string(chemin(&p)).unwrap();
        assert!(t.contains("crs:Exposure2012=\"+0.50\""));
        assert_eq!(lire(&p), (5, Some("Green".into())));
        std::fs::remove_dir_all(d).ok();
    }
}
