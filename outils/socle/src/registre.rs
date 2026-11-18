//! Le registre d'empreintes `.prism-empreintes.json` d'une photothèque : pour chaque fichier, sa
//! taille, sa date de modification et son empreinte XXH3. prism-copie le remplit à la copie,
//! prism-scan s'en sert pour repérer les fichiers altérés sans avoir été modifiés.

use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::collections::BTreeMap;
use std::io;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

pub const NOM: &str = ".prism-empreintes.json";

#[derive(Serialize, Deserialize, Default)]
pub struct Registre {
    pub version: u32,
    pub fichiers: BTreeMap<String, Entree>,
}

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Debug)]
pub struct Entree {
    pub taille: u64,
    /// Date de modification, en nanosecondes depuis 1970.
    pub modif: u64,
    /// Empreinte XXH3-128, en hexadécimal (un nombre de 128 bits ne passe pas partout en JSON).
    #[serde(serialize_with = "en_hex", deserialize_with = "de_hex")]
    pub xxh3: u128,
}

fn en_hex<S: Serializer>(v: &u128, s: S) -> Result<S::Ok, S::Error> {
    s.serialize_str(&crate::empreinte::hex(*v))
}

fn de_hex<'de, D: Deserializer<'de>>(d: D) -> Result<u128, D::Error> {
    let t = String::deserialize(d)?;
    crate::empreinte::depuis_hex(&t).ok_or_else(|| serde::de::Error::custom("empreinte invalide"))
}

pub fn nanos(t: SystemTime) -> u64 {
    t.duration_since(UNIX_EPOCH).map(|d| d.as_nanos() as u64).unwrap_or(0)
}

/// Le chemin relatif tel qu'il est rangé dans le registre (séparateur « / » partout).
pub fn cle(racine: &Path, p: &Path) -> String {
    p.strip_prefix(racine).unwrap_or(p).to_string_lossy().replace('\\', "/")
}

impl Registre {
    pub fn lire(racine: &Path) -> Registre {
        std::fs::read(racine.join(NOM)).ok().and_then(|o| serde_json::from_slice(&o).ok()).unwrap_or_default()
    }

    /// Écrit le registre en passant par un fichier temporaire : une coupure ne le corrompt pas.
    pub fn ecrire(&self, racine: &Path) -> io::Result<()> {
        let tmp = racine.join(format!("{NOM}.tmp"));
        std::fs::write(&tmp, serde_json::to_vec(&Registre { version: 1, fichiers: self.fichiers.clone() })?)?;
        std::fs::rename(tmp, racine.join(NOM))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn aller_retour() {
        let mut r = Registre::default();
        r.fichiers.insert("a/b.NEF".into(), Entree { taille: 3, modif: 9, xxh3: u128::MAX - 5 });
        let j = serde_json::to_string(&r).unwrap();
        assert!(j.contains("\"xxh3\":\"fffffffffffffffffffffffffffffffa\""));
        let r2: Registre = serde_json::from_str(&j).unwrap();
        assert_eq!(r2.fichiers["a/b.NEF"], r.fichiers["a/b.NEF"]);
    }
}
