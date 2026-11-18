//! Socle commun des outils photo de Prism : reconnaître un fichier, le hacher, vérifier qu'il se
//! décode en entier, lire sa date de prise de vue et parcourir un dossier.

pub mod apercu;
pub mod date;
pub mod empreinte;
pub mod integre;
pub mod nature;
pub mod parcours;
pub mod registre;
pub mod tiff;
pub mod verif;

pub use nature::Nature;
