//! Prism : calculs sur les pixels écrits en Rust.
//!
//! Compilé en WebAssembly (`web/px/prism_px.wasm`), le même module sert la page web
//! et l'app de bureau (Mac, Windows, Linux). Le JavaScript garde toujours sa propre
//! version de chaque calcul : si le module manque ou échoue, Prism s'en sert à la place.
//!
//! Interface sans outil supplémentaire (pas de wasm-bindgen) : la page réserve de la
//! mémoire avec `px_alloc`, y copie les pixels, appelle le calcul, relit le résultat
//! et libère avec `px_free`.

pub mod denoise;

use std::alloc::{alloc, dealloc, Layout};

const ALIGN: usize = 8;

/// Réserve `n` octets (alignés sur 8) dans la mémoire du module ; 0 si impossible.
#[no_mangle]
pub extern "C" fn px_alloc(n: usize) -> *mut u8 {
    match Layout::from_size_align(n.max(1), ALIGN) {
        // SAFETY: la taille n'est jamais nulle
        Ok(l) => unsafe { alloc(l) },
        Err(_) => std::ptr::null_mut(),
    }
}

/// Libère ce que `px_alloc(n)` a réservé.
///
/// # Safety
/// `p` vient de `px_alloc(n)` avec le même `n`, et n'a pas déjà été libéré.
#[no_mangle]
pub unsafe extern "C" fn px_free(p: *mut u8, n: usize) {
    if p.is_null() {
        return;
    }
    if let Ok(l) = Layout::from_size_align(n.max(1), ALIGN) {
        dealloc(p, l)
    }
}

/// Version de l'interface : la page vérifie qu'elle parle au bon module.
#[no_mangle]
pub extern "C" fn px_version() -> u32 {
    1
}

/// Réduction du bruit d'une tuile (voir `denoise::tile`).
///
/// `params` : 21 nombres (voir `denoise::Params::from_slice`), `reg` : les pixels RGBA de la
/// zone lue (tuile + recouvrement), `out` : RGBA de la tuile seule. Renvoie 0 si tout va bien.
///
/// # Safety
/// `params` pointe sur 21 `f64`, `reg` sur `rw*rh*4` octets, `out` sur `cw*ch*4` octets.
#[no_mangle]
pub unsafe extern "C" fn dn_tile(params: *const f64, reg: *const u8, out: *mut u8) -> i32 {
    let p = std::slice::from_raw_parts(params, denoise::NPARAMS);
    let Some(p) = denoise::Params::from_slice(p) else {
        return 1;
    };
    let reg = std::slice::from_raw_parts(reg, p.rw * p.rh * 4);
    let out = std::slice::from_raw_parts_mut(out, p.cw * p.ch * 4);
    denoise::tile(&p, reg, out);
    0
}
