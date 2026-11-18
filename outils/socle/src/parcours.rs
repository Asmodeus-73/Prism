//! Parcours d'un dossier : les fichiers, triés, sans les fichiers et dossiers cachés.

use crate::Nature;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

pub fn fichiers(racine: &Path, garder: impl Fn(Nature) -> bool) -> Vec<PathBuf> {
    let mut v: Vec<PathBuf> = WalkDir::new(racine)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| e.depth() == 0 || !e.file_name().to_string_lossy().starts_with('.'))
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .map(|e| e.into_path())
        .filter(|p| garder(Nature::de(p)))
        .collect();
    v.sort();
    v
}
