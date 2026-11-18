//! La nature d'un fichier, d'après son extension.

use serde::Serialize;
use std::path::Path;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Nature {
    Jpeg,
    Raw,
    Png,
    Tiff,
    Heif,
    Video,
    Autre,
}

/// Extensions des RAW d'appareil (DNG compris).
pub const RAW: &[&str] = &[
    "3fr", "ari", "arw", "bay", "cr2", "cr3", "crw", "dcr", "dng", "erf", "fff", "iiq", "kdc", "mef", "mos",
    "mrw", "nef", "nrw", "orf", "ori", "pef", "raf", "raw", "rw2", "rwl", "sr2", "srf", "srw", "x3f",
];
const VIDEO: &[&str] = &["mp4", "mov", "mts", "m2ts", "avi", "mxf", "braw", "r3d", "crm"];

impl Nature {
    pub fn de(chemin: &Path) -> Nature {
        let ext = chemin.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
        match ext.as_str() {
            "jpg" | "jpeg" | "jpe" => Nature::Jpeg,
            "png" => Nature::Png,
            "tif" | "tiff" => Nature::Tiff,
            "heic" | "heif" | "hif" => Nature::Heif,
            e if RAW.contains(&e) => Nature::Raw,
            e if VIDEO.contains(&e) => Nature::Video,
            _ => Nature::Autre,
        }
    }

    /// Une photo que ces outils savent lire (JPEG ou RAW).
    pub fn photo(self) -> bool {
        matches!(self, Nature::Jpeg | Nature::Raw)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn extensions() {
        assert_eq!(Nature::de(Path::new("a/B.NEF")), Nature::Raw);
        assert_eq!(Nature::de(Path::new("x.JPeG")), Nature::Jpeg);
        assert_eq!(Nature::de(Path::new("x.dng")), Nature::Raw);
        assert_eq!(Nature::de(Path::new("x.mov")), Nature::Video);
        assert_eq!(Nature::de(Path::new("sans")), Nature::Autre);
    }
}
