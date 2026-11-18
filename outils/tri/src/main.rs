//! prism-tri : trier une carte de photos sans attendre.
//!
//! Le serveur local ne développe aucun RAW : il repère l'aperçu JPEG que l'appareil a rangé dans
//! chaque fichier et l'envoie tel quel au navigateur, qui le décode sur la carte graphique. Les
//! photos suivantes sont demandées d'avance, si bien que passer d'une photo à l'autre ne coûte
//! que l'affichage. Les notes et étiquettes vont dans un XMP à côté de chaque photo, où Lightroom,
//! Capture One, Bridge et darktable les retrouvent. En tâche de fond, chaque photo reçoit une
//! vignette, une mesure de netteté et une signature qui sert à regrouper les rafales.

mod analyse;
mod xmp;

use clap::Parser;
use memmap2::Mmap;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use socle::integre::{self, Flux};
use socle::{apercu, date::Date, parcours, Nature};
use std::collections::{HashMap, VecDeque};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, OnceLock, RwLock};
use tiny_http::{Header, Method, Request, Response, Server};

#[derive(Parser)]
#[command(name = "prism-tri", version, about = "Trier des photos sans attendre (notes, rejets, rafales)")]
struct Args {
    /// Le dossier de photos (une carte, une séance).
    dossier: PathBuf,
    /// Port local (0 : un port libre).
    #[arg(long, default_value_t = 0)]
    port: u16,
    /// Ne pas ouvrir le navigateur.
    #[arg(long)]
    sans_navigateur: bool,
}

/// Grand côté maximal de l'image affichée en grand (les écrans 4K et 5K y trouvent leur compte).
const GRAND: u16 = 4096;
/// Pour un JPEG plus grand, on en fabrique une version réduite (et redressée).
const GRAND_REDUIT: usize = 2560;

struct Photo {
    chemin: PathBuf,
    nom: String,
    nature: Nature,
    date: Option<Date>,
    /// Secondes (avec les fractions), pour ordonner et mesurer les écarts entre déclenchements.
    temps: Option<f64>,
    orientation: u16,
    /// L'aperçu servi tel quel (RAW), ou `None` s'il faut fabriquer une version réduite.
    grand: Option<Flux>,
    /// Celui qu'on analyse (le plus petit aperçu d'au moins 1000 px).
    a_analyser: Option<Flux>,
    note: Mutex<(i8, Option<String>)>,
    analyse: OnceLock<Option<analyse::Analyse>>,
}

#[derive(Serialize, Clone)]
struct Rafale {
    photos: Vec<usize>,
    meilleure: usize,
}

struct Etat {
    racine: PathBuf,
    photos: Vec<Photo>,
    analysees: AtomicUsize,
    rafales: RwLock<Option<Vec<Rafale>>>,
    grands: Mutex<Cache>,
    analyse_finie: AtomicBool,
}

/// Les dernières versions réduites fabriquées (les JPEG plus grands que l'écran).
struct Cache {
    ordre: VecDeque<usize>,
    donnees: HashMap<usize, Arc<Vec<u8>>>,
}

fn main() {
    let a = Args::parse();
    if !a.dossier.is_dir() {
        eprintln!("« {} » n'est pas un dossier.", a.dossier.display());
        std::process::exit(2);
    }
    let debut = std::time::Instant::now();
    let fichiers = parcours::fichiers(&a.dossier, Nature::photo);
    let mut photos: Vec<Photo> = fichiers.par_iter().filter_map(|p| indexer(&a.dossier, p)).collect();
    // Ordre de prise de vue (les photos sans date à la fin, par nom).
    photos.sort_by(|x, y| match (x.temps, y.temps) {
        (Some(a), Some(b)) => a.total_cmp(&b).then_with(|| x.nom.cmp(&y.nom)),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => x.nom.cmp(&y.nom),
    });
    println!("{} photos indexées en {:.0} ms.", photos.len(), debut.elapsed().as_secs_f64() * 1000.0);
    let etat = Arc::new(Etat {
        racine: a.dossier.clone(),
        photos,
        analysees: AtomicUsize::new(0),
        rafales: RwLock::new(None),
        grands: Mutex::new(Cache { ordre: VecDeque::new(), donnees: HashMap::new() }),
        analyse_finie: AtomicBool::new(false),
    });

    // Analyse en tâche de fond, dans l'ordre : la grille se remplit du haut vers le bas.
    let e = etat.clone();
    std::thread::spawn(move || {
        let t = std::time::Instant::now();
        (0..e.photos.len()).into_par_iter().for_each(|i| {
            analyser(&e, i);
        });
        *e.rafales.write().unwrap() = Some(rafales(&e));
        e.analyse_finie.store(true, Ordering::Release);
        println!("Analyse terminée en {:.1} s (vignettes, netteté, rafales).", t.elapsed().as_secs_f64());
    });

    let serveur = Arc::new(Server::http(("127.0.0.1", a.port)).expect("serveur local"));
    let adresse = format!("http://{}/", serveur.server_addr());
    println!("Tri ouvert sur {adresse}  (Ctrl+C pour quitter)");
    if !a.sans_navigateur {
        ouvrir(&adresse);
    }
    let fils: Vec<_> = (0..8)
        .map(|_| {
            let (s, e) = (serveur.clone(), etat.clone());
            std::thread::spawn(move || {
                for r in s.incoming_requests() {
                    repondre(&e, r);
                }
            })
        })
        .collect();
    for f in fils {
        f.join().ok();
    }
}

fn indexer(racine: &std::path::Path, p: &std::path::Path) -> Option<Photo> {
    let f = std::fs::File::open(p).ok()?;
    let o = unsafe { Mmap::map(&f) }.ok()?;
    let nature = Nature::de(p);
    let nom = p.strip_prefix(racine).unwrap_or(p).to_string_lossy().replace('\\', "/");
    let (date_txt, orientation, grand, a_analyser) = match nature {
        Nature::Raw => {
            let jpegs = integre::tous(&o, 16 << 20);
            let grand = integre::meilleur(&jpegs, GRAND);
            let petit = jpegs.iter().filter(|f| f.l.max(f.h) >= 1000).min_by_key(|f| f.l as u32 * f.h as u32).copied().or(grand);
            let date = socle::tiff::date(&o);
            let orientation = socle::tiff::orientation(&o);
            // Hors TIFF (CR3, RAF…) : rawler lit les métadonnées.
            let (date, orientation) = if date.is_none() || orientation.is_none() {
                let tout = Arc::new(o.to_vec());
                let d = socle::date::prise_de_vue(nature, &tout).map(|d| (d, None));
                (date.or(d.map(|(d, s)| (format!("{:04}:{:02}:{:02} {:02}:{:02}:{:02}", d.annee, d.mois, d.jour, d.heure, d.minute, d.seconde), s))), orientation)
            } else {
                (date, orientation)
            };
            (date, orientation.unwrap_or(1), grand, petit)
        }
        _ => {
            let (d, s) = date_jpeg(&o);
            (d.map(|d| (d, s)), apercu::orientation_jpeg(&o[..o.len().min(256 << 10)]).unwrap_or(1), None, None)
        }
    };
    let date = date_txt.as_ref().and_then(|(d, _)| Date::exif(d));
    let temps = date.map(|d| {
        let frac = date_txt.as_ref().and_then(|(_, s)| s.as_ref()).and_then(|s| format!("0.{}", s.trim()).parse::<f64>().ok()).unwrap_or(0.0);
        d.secondes() as f64 + frac
    });
    let note = xmp::lire(p);
    Some(Photo { chemin: p.to_path_buf(), nom, nature, date, temps, orientation, grand, a_analyser, note: Mutex::new(note), analyse: OnceLock::new() })
}

fn date_jpeg(o: &[u8]) -> (Option<String>, Option<String>) {
    let tete = &o[..o.len().min(256 << 10)];
    let Ok(e) = exif::Reader::new().read_from_container(&mut std::io::Cursor::new(tete)) else { return (None, None) };
    let texte = |t| {
        e.get_field(t, exif::In::PRIMARY).and_then(|f| match &f.value {
            exif::Value::Ascii(v) => v.first().map(|s| String::from_utf8_lossy(s).trim().to_string()),
            _ => None,
        })
    };
    (texte(exif::Tag::DateTimeOriginal).or_else(|| texte(exif::Tag::DateTime)), texte(exif::Tag::SubSecTimeOriginal))
}

fn octets(p: &Photo) -> Option<Mmap> {
    let f = std::fs::File::open(&p.chemin).ok()?;
    unsafe { Mmap::map(&f) }.ok()
}

fn analyser(e: &Etat, i: usize) -> &Option<analyse::Analyse> {
    let p = &e.photos[i];
    p.analyse.get_or_init(|| {
        let o = octets(p)?;
        let r = match (p.nature, p.a_analyser) {
            (Nature::Raw, Some(f)) => analyse::analyser(&o[f.debut..f.fin], p.orientation),
            (Nature::Raw, None) => Err("pas d'aperçu".into()),
            _ => analyse::analyser(&o, p.orientation),
        };
        e.analysees.fetch_add(1, Ordering::Relaxed);
        r.ok()
    })
}

/// Les rafales : déclenchements à moins d'1,5 s d'écart, d'images semblables. La plus nette de
/// chaque rafale est proposée.
fn rafales(e: &Etat) -> Vec<Rafale> {
    let mut res = vec![];
    let mut courante: Vec<usize> = vec![];
    let fermer = |c: &mut Vec<usize>, res: &mut Vec<Rafale>| {
        if c.len() >= 2 {
            let meilleure = *c
                .iter()
                .max_by(|&&a, &&b| {
                    let n = |i: usize| e.photos[i].analyse.get().and_then(|a| a.as_ref()).map(|a| a.nettete).unwrap_or(0.0);
                    n(a).total_cmp(&n(b))
                })
                .unwrap();
            res.push(Rafale { photos: c.clone(), meilleure });
        }
        c.clear();
    };
    for i in 0..e.photos.len() {
        let suite = courante.last().is_some_and(|&j| {
            let (a, b) = (&e.photos[j], &e.photos[i]);
            let proche = matches!((a.temps, b.temps), (Some(x), Some(y)) if (y - x).abs() <= 1.5);
            let sa = a.analyse.get().and_then(|x| x.as_ref()).map(|x| &x.signature);
            let sb = b.analyse.get().and_then(|x| x.as_ref()).map(|x| &x.signature);
            let semblable = matches!((sa, sb), (Some(x), Some(y)) if analyse::ecart(x, y) < 0.06);
            proche && semblable
        });
        if !suite {
            fermer(&mut courante, &mut res);
        }
        courante.push(i);
    }
    fermer(&mut courante, &mut res);
    res
}

/// L'image en grand : l'aperçu intégré tel quel, ou une version réduite fabriquée (et gardée).
fn grand(e: &Etat, i: usize) -> Option<Arc<Vec<u8>>> {
    let p = &e.photos[i];
    if let Some(f) = p.grand {
        let o = octets(p)?;
        return Some(Arc::new(o[f.debut..f.fin].to_vec()));
    }
    if let Some(d) = e.grands.lock().unwrap().donnees.get(&i) {
        return Some(d.clone());
    }
    let o = octets(p)?;
    let tout = Arc::new(o.to_vec());
    let ap = apercu::charger(p.nature, &tout, GRAND_REDUIT).ok()?;
    let img = apercu::redresser(ap.image, ap.orientation);
    let d = Arc::new(analyse::encoder(&img, 88).ok()?);
    let mut c = e.grands.lock().unwrap();
    c.donnees.insert(i, d.clone());
    c.ordre.push_back(i);
    while c.ordre.len() > 48 {
        if let Some(v) = c.ordre.pop_front() {
            c.donnees.remove(&v);
        }
    }
    Some(d)
}

#[derive(Serialize)]
struct Fiche<'a> {
    nom: &'a str,
    date: Option<String>,
    note: i8,
    etiquette: Option<String>,
    /// Orientation à appliquer à l'image en grand (1 si elle est déjà redressée).
    rotation: u16,
    raw: bool,
}

#[derive(Deserialize)]
struct Notation {
    i: usize,
    note: Option<i8>,
    /// "" pour retirer l'étiquette.
    etiquette: Option<String>,
}

fn repondre(e: &Etat, mut r: Request) {
    let url = r.url().to_string();
    let chemin = url.split('?').next().unwrap_or("").to_string();
    let methode = r.method().clone();
    let reponse = match (methode, chemin.as_str()) {
        (Method::Get, "/") => Response::from_data(include_str!("tri.html").as_bytes().to_vec()).with_header(entete("Content-Type", "text/html; charset=utf-8")),
        (Method::Get, "/api/photos") => {
            let v: Vec<Fiche> = e
                .photos
                .iter()
                .map(|p| {
                    let (note, etiquette) = p.note.lock().unwrap().clone();
                    Fiche {
                        nom: &p.nom,
                        date: p.date.map(|d| d.modele("{JJ}/{MM}/{AAAA} {hh}:{mm}:{ss}")),
                        note,
                        etiquette,
                        rotation: if p.grand.is_some() { p.orientation } else { 1 },
                        raw: p.nature == Nature::Raw,
                    }
                })
                .collect();
            json(&serde_json::json!({ "dossier": e.racine.file_name().map(|n| n.to_string_lossy().to_string()), "photos": v }))
        }
        (Method::Get, "/api/etat") => {
            let rafales = e.rafales.read().unwrap().clone();
            let nettete: Vec<Option<f32>> =
                e.photos.iter().map(|p| p.analyse.get().and_then(|a| a.as_ref()).map(|a| (a.nettete * 10.0).round() / 10.0)).collect();
            json(&serde_json::json!({
                "analysees": e.analysees.load(Ordering::Relaxed),
                "total": e.photos.len(),
                "fini": e.analyse_finie.load(Ordering::Acquire),
                "rafales": rafales,
                "nettete": nettete,
            }))
        }
        (Method::Post, "/api/noter") => {
            let mut corps = String::new();
            r.as_reader().read_to_string(&mut corps).ok();
            match serde_json::from_str::<Notation>(&corps) {
                Ok(n) if n.i < e.photos.len() => {
                    let p = &e.photos[n.i];
                    let mut g = p.note.lock().unwrap();
                    if let Some(v) = n.note {
                        g.0 = v.clamp(-1, 5);
                    }
                    if let Some(t) = n.etiquette {
                        g.1 = (!t.is_empty()).then_some(t);
                    }
                    match xmp::ecrire(&p.chemin, g.0, g.1.as_deref()) {
                        Ok(()) => json(&serde_json::json!({"ok": true})),
                        Err(err) => json(&serde_json::json!({"ok": false, "erreur": err.to_string()})).with_status_code(500),
                    }
                }
                _ => Response::from_string("requête invalide").with_status_code(400),
            }
        }
        (Method::Get, c) if c.starts_with("/v/") || c.starts_with("/g/") => {
            let i: Option<usize> = c[3..].parse().ok().filter(|&i| i < e.photos.len());
            let d = i.and_then(|i| if c.starts_with("/v/") { analyser(e, i).as_ref().map(|a| Arc::new(a.vignette.clone())) } else { grand(e, i) });
            match d {
                Some(d) => Response::from_data(d.to_vec())
                    .with_header(entete("Content-Type", "image/jpeg"))
                    .with_header(entete("Cache-Control", "max-age=3600")),
                None => Response::from_string("introuvable").with_status_code(404),
            }
        }
        _ => Response::from_string("introuvable").with_status_code(404),
    };
    r.respond(reponse).ok();
}

fn entete(k: &str, v: &str) -> Header {
    Header::from_bytes(k.as_bytes(), v.as_bytes()).unwrap()
}

fn json(v: &serde_json::Value) -> Response<std::io::Cursor<Vec<u8>>> {
    Response::from_data(serde_json::to_vec(v).unwrap()).with_header(entete("Content-Type", "application/json"))
}

fn ouvrir(url: &str) {
    #[cfg(target_os = "macos")]
    let c = std::process::Command::new("open").arg(url).spawn();
    #[cfg(target_os = "windows")]
    let c = std::process::Command::new("cmd").args(["/C", "start", "", url]).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let c = std::process::Command::new("xdg-open").arg(url).spawn();
    if c.is_err() {
        println!("Ouvrez {url} dans votre navigateur.");
    }
}
