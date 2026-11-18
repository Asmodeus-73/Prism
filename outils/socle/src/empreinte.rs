//! Empreinte XXH3-128 d'un fichier : plusieurs Go/s sur un cœur, bien au-delà d'un disque ou d'un
//! lecteur de cartes, donc le hachage ne ralentit jamais la lecture.

use std::fs::File;
use std::io::{self, Read};
use std::path::Path;
use xxhash_rust::xxh3::{xxh3_128, Xxh3};

pub const BLOC: usize = 4 << 20;

pub fn octets(donnees: &[u8]) -> u128 {
    xxh3_128(donnees)
}

pub fn fichier(chemin: &Path) -> io::Result<u128> {
    let mut f = File::open(chemin)?;
    let mut h = Xxh3::new();
    let mut tampon = vec![0u8; BLOC];
    loop {
        let n = f.read(&mut tampon)?;
        if n == 0 {
            break;
        }
        h.update(&tampon[..n]);
    }
    Ok(h.digest128())
}

pub fn hex(e: u128) -> String {
    format!("{e:032x}")
}

pub fn depuis_hex(s: &str) -> Option<u128> {
    u128::from_str_radix(s, 16).ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn fichier_egal_octets() {
        let dir = std::env::temp_dir().join(format!("socle-emp-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let p = dir.join("a.bin");
        let data: Vec<u8> = (0..(BLOC * 2 + 17)).map(|i| (i * 31 % 251) as u8).collect();
        std::fs::write(&p, &data).unwrap();
        assert_eq!(fichier(&p).unwrap(), octets(&data));
        assert_eq!(depuis_hex(&hex(octets(&data))), Some(octets(&data)));
        std::fs::remove_dir_all(dir).ok();
    }
}
