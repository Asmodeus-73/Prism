//! prism-poussieres : repère les poussières du capteur en comparant toutes les photos d'une séance.
//!
//! Une poussière est une petite tache sombre et floue qui reste au même endroit du capteur d'une
//! photo à l'autre, alors que la scène change. Sur une seule photo, elle se confond avec un détail
//! du sujet ; sur cinquante, elle seule reste en place. Pour chaque photo on mesure, là où l'image
//! est lisse (ciel, mur, fond de studio), l'assombrissement de chaque point par rapport à son
//! voisinage ; on fait la moyenne sur toute la séance, et ce qui reste sombre est une poussière.
//! Les pixels gardent le sens du capteur (pas de redressement EXIF) : la poussière ne tourne pas
//! avec l'appareil.

use clap::Parser;
use rayon::prelude::*;
use serde::Serialize;
use socle::apercu::{self, Image};
use socle::{parcours, Nature};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Instant;

#[derive(Parser)]
#[command(name = "prism-poussieres", version, about = "Repère les poussières du capteur sur toute une séance")]
struct Args {
    /// Dossier de la séance (même appareil ; un même objectif aide).
    dossier: PathBuf,
    /// Résolution de travail (grand côté, en pixels).
    #[arg(long, default_value_t = 1500)]
    resolution: usize,
    /// Assombrissement minimal d'une poussière, en pour cent.
    #[arg(long, default_value_t = 1.5)]
    seuil: f32,
    /// Où écrire le rapport JSON et la carte PNG (par défaut : dans le dossier de la séance).
    #[arg(long)]
    sortie: Option<PathBuf>,
}

/// Mesures d'une photo, à la résolution de travail.
struct Mesure {
    chemin: PathBuf,
    /// Assombrissement local (0 = rien, 0.1 = 10 % plus sombre que le voisinage), NaN si la zone
    /// n'est pas assez lisse pour juger.
    creux: Vec<f32>,
}

#[derive(Serialize, Clone)]
struct Poussiere {
    /// Centre, en fraction de la largeur et de la hauteur du capteur (0 à 1).
    x: f32,
    y: f32,
    /// Rayon, en fraction de la largeur.
    rayon: f32,
    /// Assombrissement moyen au centre, en pour cent.
    force: f32,
    /// Photos où la poussière se voit (zone lisse à cet endroit).
    photos: Vec<String>,
}

fn main() {
    let a = Args::parse();
    let fichiers = parcours::fichiers(&a.dossier, Nature::photo);
    if fichiers.len() < 3 {
        eprintln!("Il faut au moins 3 photos de la même séance (idéalement 20 ou plus).");
        std::process::exit(2);
    }
    let debut = Instant::now();
    // Toutes les photos à la même taille de travail, celle de la première.
    let mesures: Vec<(Option<Mesure>, (usize, usize))> = fichiers
        .par_iter()
        .map(|p| match charger(p, a.resolution) {
            Ok(img) => {
                let t = (img.l, img.h);
                (Some(Mesure { chemin: p.clone(), creux: creux(&img) }), t)
            }
            Err(e) => {
                eprintln!("{} ignorée : {e}", p.display());
                (None, (0, 0))
            }
        })
        .collect();
    let taille = mesures.iter().filter(|m| m.0.is_some()).map(|m| m.1).fold(std::collections::HashMap::new(), |mut h, t| {
        *h.entry(t).or_insert(0) += 1;
        h
    });
    let Some((&(l, h), _)) = taille.iter().max_by_key(|e| e.1) else {
        eprintln!("Aucune photo lisible.");
        std::process::exit(2);
    };
    // Une photo d'une autre taille (recadrée, autre appareil) ne se superpose pas : écartée.
    let mesures: Vec<Mesure> = mesures.into_iter().filter(|m| m.1 == (l, h)).filter_map(|m| m.0).collect();
    let n = mesures.len();

    let (moyenne, vues) = accumuler(&mesures, l * h);
    let min_vues = (n as f32 * 0.25).ceil().max(3.0) as u32;
    let carte: Vec<f32> = moyenne.iter().zip(&vues).map(|(&m, &v)| if v >= min_vues { m } else { 0.0 }).collect();
    let mut taches = taches(&carte, l, h, a.seuil / 100.0);
    for t in &mut taches {
        t.photos = mesures
            .iter()
            .filter(|m| visible(m, t, l, h))
            .map(|m| m.chemin.strip_prefix(&a.dossier).unwrap_or(&m.chemin).to_string_lossy().to_string())
            .collect();
    }
    taches.retain(|t| !t.photos.is_empty());
    taches.sort_by(|a, b| b.force.total_cmp(&a.force));

    let sortie = a.sortie.clone().unwrap_or_else(|| a.dossier.clone());
    std::fs::create_dir_all(&sortie).ok();
    let json = serde_json::json!({
        "photos": n,
        "largeur_travail": l,
        "hauteur_travail": h,
        "poussieres": taches,
    });
    std::fs::write(sortie.join("poussieres.json"), serde_json::to_vec_pretty(&json).unwrap()).ok();
    ecrire_carte(&sortie.join("poussieres.png"), &carte, l, h, &taches, a.seuil / 100.0).ok();

    let s = debut.elapsed().as_secs_f64();
    println!("{n} photos comparées en {s:.1} s.");
    if taches.is_empty() {
        println!("Aucune poussière visible sur cette séance.");
    } else {
        println!("{} poussière(s) trouvée(s) :", taches.len());
        for (i, t) in taches.iter().enumerate() {
            println!(
                "  {:>2}. à {:>4.1} % de la largeur, {:>4.1} % de la hauteur, Ø {:.1} % ; {:.1} % plus sombre ; visible sur {} photo(s)",
                i + 1,
                t.x * 100.0,
                t.y * 100.0,
                t.rayon * 200.0,
                t.force,
                t.photos.len()
            );
        }
        println!("Détail par photo : {}", sortie.join("poussieres.json").display());
        println!("Carte : {}", sortie.join("poussieres.png").display());
    }
    if n < 10 {
        println!("Avec seulement {n} photos, un détail fixe de la scène peut passer pour une poussière : plus la séance est longue, plus le résultat est sûr.");
    }
}

fn charger(p: &Path, resolution: usize) -> Result<Image, String> {
    let o = Arc::new(std::fs::read(p).map_err(|e| e.to_string())?);
    Ok(apercu::charger(Nature::de(p), &o, resolution)?.image)
}

/// Flou par boîte séparable, répété 3 fois (proche d'un flou gaussien), rayon r.
fn flou(v: &[f32], l: usize, h: usize, r: usize) -> Vec<f32> {
    let mut a = v.to_vec();
    let mut b = vec![0f32; v.len()];
    for _ in 0..3 {
        boite_h(&a, &mut b, l, h, r);
        boite_v(&b, &mut a, l, h, r);
    }
    a
}

fn boite_h(src: &[f32], dst: &mut [f32], l: usize, h: usize, r: usize) {
    let r = r.min(l / 2).max(1);
    for y in 0..h {
        let s = &src[y * l..(y + 1) * l];
        let d = &mut dst[y * l..(y + 1) * l];
        let mut acc = 0f32;
        let at = |i: isize| s[i.clamp(0, l as isize - 1) as usize];
        for i in -(r as isize)..=(r as isize) {
            acc += at(i);
        }
        let k = 1.0 / (2 * r + 1) as f32;
        for x in 0..l {
            d[x] = acc * k;
            acc += at(x as isize + r as isize + 1) - at(x as isize - r as isize);
        }
    }
}

fn boite_v(src: &[f32], dst: &mut [f32], l: usize, h: usize, r: usize) {
    let r = r.min(h / 2).max(1);
    let k = 1.0 / (2 * r + 1) as f32;
    let mut acc = vec![0f32; l];
    let at = |y: isize| (y.clamp(0, h as isize - 1) as usize) * l;
    for i in -(r as isize)..=(r as isize) {
        let o = at(i);
        for x in 0..l {
            acc[x] += src[o + x];
        }
    }
    for y in 0..h {
        let (plus, moins) = (at(y as isize + r as isize + 1), at(y as isize - r as isize));
        for x in 0..l {
            dst[y * l + x] = acc[x] * k;
            acc[x] += src[plus + x] - src[moins + x];
        }
    }
}

/// Assombrissement local de chaque point, NaN là où la zone est trop texturée, trop sombre ou
/// brûlée pour qu'une tache de quelques pour cent s'y mesure.
fn creux(img: &Image) -> Vec<f32> {
    let (l, h) = (img.l, img.h);
    let lum = apercu::luminance(img);
    // Le voisinage : assez large pour qu'une poussière (quelques pixels de travail) y pèse peu.
    let r = (l.max(h) / 120).max(4);
    let fond = flou(&lum, l, h, r);
    // Une version à peine lissée, pour ignorer le bruit et le grain.
    let fin = flou(&lum, l, h, 1);
    // Texture : écart-type local du détail fin autour du fond.
    let ecart2: Vec<f32> = fin.iter().zip(&fond).map(|(a, b)| (a - b) * (a - b)).collect();
    let texture = flou(&ecart2, l, h, r);
    fin.iter()
        .zip(&fond)
        .zip(&texture)
        .map(|((&f, &b), &t)| {
            if !(0.12..=0.95).contains(&b) || t.sqrt() / b > 0.06 {
                f32::NAN
            } else {
                (1.0 - f / b).clamp(-0.3, 0.3)
            }
        })
        .collect()
}

fn accumuler(m: &[Mesure], n: usize) -> (Vec<f32>, Vec<u32>) {
    let (somme, vues) = m
        .par_iter()
        .fold(
            || (vec![0f32; n], vec![0u32; n]),
            |(mut s, mut v), x| {
                for i in 0..n {
                    let c = x.creux[i];
                    if c.is_finite() {
                        s[i] += c;
                        v[i] += 1;
                    }
                }
                (s, v)
            },
        )
        .reduce(
            || (vec![0f32; n], vec![0u32; n]),
            |(mut s, mut v), (s2, v2)| {
                for i in 0..n {
                    s[i] += s2[i];
                    v[i] += v2[i];
                }
                (s, v)
            },
        );
    let moyenne = somme.iter().zip(&vues).map(|(&s, &v)| if v > 0 { s / v as f32 } else { 0.0 }).collect();
    (moyenne, vues)
}

/// Les taches : groupes de points dont l'assombrissement moyen dépasse le seuil.
fn taches(carte: &[f32], l: usize, h: usize, seuil: f32) -> Vec<Poussiere> {
    let mut vu = vec![false; l * h];
    let mut res = vec![];
    let max_aire = (l * h) / 400; // plus grand qu'un 1/20 de côté : pas une poussière (vignetage…)
    for depart in 0..l * h {
        if vu[depart] || carte[depart] < seuil {
            continue;
        }
        let mut pile = vec![depart];
        vu[depart] = true;
        let (mut aire, mut sx, mut sy, mut sp, mut fmax) = (0usize, 0f64, 0f64, 0f64, 0f32);
        while let Some(i) = pile.pop() {
            let (x, y) = (i % l, i / l);
            let p = carte[i] as f64;
            aire += 1;
            sx += x as f64 * p;
            sy += y as f64 * p;
            sp += p;
            fmax = fmax.max(carte[i]);
            for (dx, dy) in [(-1i32, 0i32), (1, 0), (0, -1), (0, 1)] {
                let (nx, ny) = (x as i32 + dx, y as i32 + dy);
                if nx < 0 || ny < 0 || nx >= l as i32 || ny >= h as i32 {
                    continue;
                }
                let j = ny as usize * l + nx as usize;
                // La tache s'étend tant qu'on reste au-dessus de la moitié du seuil.
                if !vu[j] && carte[j] >= seuil * 0.5 {
                    vu[j] = true;
                    pile.push(j);
                }
            }
        }
        if aire < 3 || aire > max_aire || sp <= 0.0 {
            continue;
        }
        res.push(Poussiere {
            x: ((sx / sp) as f32 + 0.5) / l as f32,
            y: ((sy / sp) as f32 + 0.5) / h as f32,
            rayon: ((aire as f32 / std::f32::consts::PI).sqrt()) / l as f32,
            force: fmax * 100.0,
            photos: vec![],
        });
    }
    res
}

/// La poussière se voit sur cette photo : zone lisse à cet endroit, et assombrie.
fn visible(m: &Mesure, t: &Poussiere, l: usize, h: usize) -> bool {
    let (cx, cy) = ((t.x * l as f32) as usize, (t.y * h as f32) as usize);
    let c = m.creux[cy.min(h - 1) * l + cx.min(l - 1)];
    c.is_finite() && c * 100.0 >= t.force * 0.4
}

/// La carte des assombrissements moyens (plus c'est sombre, plus c'est marqué), avec un cercle
/// rouge autour de chaque poussière.
fn ecrire_carte(p: &Path, carte: &[f32], l: usize, h: usize, taches: &[Poussiere], seuil: f32) -> std::io::Result<()> {
    let mut px = vec![0u8; l * h * 3];
    for (i, &c) in carte.iter().enumerate() {
        let v = (255.0 * (1.0 - (c / (seuil * 3.0)).clamp(0.0, 1.0))) as u8;
        px[i * 3..i * 3 + 3].copy_from_slice(&[v, v, v]);
    }
    for t in taches {
        let (cx, cy) = (t.x * l as f32, t.y * h as f32);
        let r = (t.rayon * l as f32 * 2.5).max(8.0);
        for k in 0..720 {
            let a = k as f32 / 720.0 * std::f32::consts::TAU;
            for dr in [0.0, 1.0] {
                let (x, y) = ((cx + (r + dr) * a.cos()) as i64, (cy + (r + dr) * a.sin()) as i64);
                if x >= 0 && y >= 0 && (x as usize) < l && (y as usize) < h {
                    let i = (y as usize * l + x as usize) * 3;
                    px[i..i + 3].copy_from_slice(&[230, 30, 30]);
                }
            }
        }
    }
    let f = std::io::BufWriter::new(std::fs::File::create(p)?);
    let mut e = png::Encoder::new(f, l as u32, h as u32);
    e.set_color(png::ColorType::Rgb);
    e.set_depth(png::BitDepth::Eight);
    let mut w = e.write_header()?;
    w.write_image_data(&px)?;
    Ok(())
}
