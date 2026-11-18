//! prism-copie : décharge une carte vers un ou plusieurs disques en une seule lecture de la carte.
//!
//! Un fil lit la carte dans l'ordre (c'est ce qu'un lecteur de cartes fait le plus vite) et calcule
//! l'empreinte XXH3 au passage ; chaque destination a son fil d'écriture et son fil de vérification,
//! qui relit le fichier écrit hors du cache du système et compare l'empreinte. La carte n'est donc
//! lue qu'une fois, quel que soit le nombre de copies, et les disques travaillent en parallèle.

use clap::Parser;
use socle::date::{self, Date};
use socle::registre::{self, Entree, Registre};
use socle::{empreinte, parcours, Nature};
use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, SyncSender};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use xxhash_rust::xxh3::Xxh3;

const MORCEAU: usize = 8 << 20;
/// Un fichier jusqu'à cette taille est lu d'un bloc, pour lire sa date avant de choisir où l'écrire.
const ENTETE: usize = 128 << 20;

#[derive(Parser)]
#[command(name = "prism-copie", version, about = "Décharge une carte mémoire vers un ou plusieurs disques, avec vérification")]
struct Args {
    /// La carte (ou le dossier) à décharger.
    source: PathBuf,
    /// Une ou plusieurs destinations, copiées en même temps.
    #[arg(required = true)]
    destinations: Vec<PathBuf>,
    /// Rangement par date de prise de vue. Jetons : {AAAA} {MM} {JJ} {hh} {mm} {ss}.
    #[arg(long, default_value = "{AAAA}/{AAAA}-{MM}-{JJ}")]
    modele: String,
    /// Garder l'arborescence de la carte au lieu de ranger par date.
    #[arg(long)]
    arborescence: bool,
    /// Ne copier que les photos et vidéos (pas les fichiers techniques de l'appareil).
    #[arg(long)]
    medias: bool,
    /// Ne pas relire les copies (plus rapide, mais rien ne prouve qu'elles sont bonnes).
    #[arg(long)]
    sans_relecture: bool,
}

/// Ce que le lecteur envoie à chaque destination.
enum Msg {
    Debut { origine: PathBuf, rel: PathBuf, modif: SystemTime },
    Morceau(Arc<Vec<u8>>),
    Fin { xxh3: u128, taille: u64 },
    /// La lecture de la source a échoué en cours de route : abandonner ce fichier.
    Abandon,
}

#[derive(Debug, Clone)]
enum Issue {
    Verifie(PathBuf),
    DejaPresent(PathBuf),
    Echec(String),
}

struct Resultat {
    dest: usize,
    source: PathBuf,
    issue: Issue,
    taille: u64,
    xxh3: u128,
    modif: SystemTime,
}

fn main() {
    let a = Args::parse();
    if !a.source.is_dir() {
        eprintln!("« {} » n'est pas un dossier.", a.source.display());
        std::process::exit(2);
    }
    for d in &a.destinations {
        if let Err(e) = fs::create_dir_all(d) {
            eprintln!("Impossible de créer « {} » : {e}", d.display());
            std::process::exit(2);
        }
    }
    let fichiers = parcours::fichiers(&a.source, |n| !a.medias || n.photo() || matches!(n, Nature::Video | Nature::Heif | Nature::Tiff | Nature::Png));
    if fichiers.is_empty() {
        println!("Rien à copier.");
        return;
    }
    let total_octets: u64 = fichiers.iter().filter_map(|p| fs::metadata(p).ok()).map(|m| m.len()).sum();
    println!(
        "{} fichiers, {:.2} Go à copier vers {} destination(s).",
        fichiers.len(),
        total_octets as f64 / 1e9,
        a.destinations.len()
    );

    let debut = Instant::now();
    let (tx_res, rx_res) = mpsc::channel::<Resultat>();
    let mut entrees = vec![];
    let mut fils = vec![];
    for (i, d) in a.destinations.iter().enumerate() {
        // 8 morceaux de 8 Mo d'avance par destination : un disque lent ne bloque pas la lecture
        // tant que ce tampon n'est pas plein.
        let (tx, rx) = mpsc::sync_channel::<Msg>(8);
        entrees.push(tx);
        let (dest, res, relire) = (d.clone(), tx_res.clone(), !a.sans_relecture);
        fils.push(thread::spawn(move || ecrivain(i, dest, rx, res, relire)));
    }
    drop(tx_res);

    let lus = lecteur(&a, &fichiers, &entrees);
    drop(entrees);
    for f in fils {
        f.join().ok();
    }
    let duree = debut.elapsed();
    let resultats: Vec<Resultat> = rx_res.into_iter().collect();
    bilan(&a, &fichiers, &resultats, lus, duree);
}

/// Lit chaque fichier une fois et le distribue aux destinations. Renvoie les octets lus.
fn lecteur(a: &Args, fichiers: &[PathBuf], sorties: &[SyncSender<Msg>]) -> u64 {
    let mut lus = 0u64;
    let total = fichiers.len();
    let debut = Instant::now();
    let mut dernier = Instant::now();
    let terminal = std::io::IsTerminal::is_terminal(&std::io::stderr());
    for (n, p) in fichiers.iter().enumerate() {
        let envoyer = |m: &dyn Fn() -> Msg| {
            for s in sorties {
                s.send(m()).ok();
            }
        };
        let echec = |e: io::Error| {
            eprintln!("\nLecture impossible : {} ({e})", p.display());
        };
        let mut f = match File::open(p) {
            Ok(f) => f,
            Err(e) => {
                echec(e);
                continue;
            }
        };
        let meta = f.metadata().ok();
        let taille = meta.as_ref().map(|m| m.len()).unwrap_or(0);
        let modif = meta.and_then(|m| m.modified().ok()).unwrap_or(UNIX_EPOCH);
        let mut h = Xxh3::new();
        let premier = (taille as usize).min(ENTETE);
        let mut tete = vec![0u8; premier];
        if let Err(e) = f.read_exact(&mut tete) {
            echec(e);
            continue;
        }
        h.update(&tete);
        let tete = Arc::new(tete);
        let rel = destination_relative(a, p, &tete, modif);
        envoyer(&|| Msg::Debut { origine: p.clone(), rel: rel.clone(), modif });
        envoyer(&|| Msg::Morceau(tete.clone()));
        let mut lu = premier as u64;
        let mut ok = true;
        while lu < taille {
            let mut m = vec![0u8; MORCEAU.min((taille - lu) as usize)];
            if let Err(e) = f.read_exact(&mut m) {
                echec(e);
                ok = false;
                break;
            }
            h.update(&m);
            lu += m.len() as u64;
            let m = Arc::new(m);
            envoyer(&|| Msg::Morceau(m.clone()));
        }
        lus += lu;
        if ok {
            let xxh3 = h.digest128();
            envoyer(&|| Msg::Fin { xxh3, taille });
        } else {
            envoyer(&|| Msg::Abandon);
        }
        if terminal && dernier.elapsed() > Duration::from_millis(250) {
            dernier = Instant::now();
            eprint!(
                "\r{} / {} fichiers  {:.0} Mo/s   ",
                n + 1,
                total,
                lus as f64 / 1e6 / debut.elapsed().as_secs_f64().max(1e-3)
            );
        }
    }
    if terminal {
        eprint!("\r{:60}\r", "");
    }
    lus
}

fn destination_relative(a: &Args, p: &Path, tete: &Arc<Vec<u8>>, modif: SystemTime) -> PathBuf {
    let nom = p.file_name().map(PathBuf::from).unwrap_or_default();
    if a.arborescence {
        return p.strip_prefix(&a.source).map(Path::to_path_buf).unwrap_or(nom);
    }
    let nature = Nature::de(p);
    let d = if nature.photo() { date::prise_de_vue(nature, tete) } else { None }.unwrap_or_else(|| date_systeme(modif));
    PathBuf::from(d.modele(&a.modele)).join(nom)
}

/// Date de modification du fichier (heure UTC), quand la photo n'a pas de date EXIF.
fn date_systeme(t: SystemTime) -> Date {
    let s = t.duration_since(UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0);
    let (jours, reste) = (s.div_euclid(86_400), s.rem_euclid(86_400));
    // Algorithme de Howard Hinnant (civil_from_days).
    let z = jours + 719_468;
    let ere = z.div_euclid(146_097);
    let doe = z - ere * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let jour = (doy - (153 * mp + 2) / 5 + 1) as u8;
    let mois = if mp < 10 { mp + 3 } else { mp - 9 } as u8;
    let annee = (yoe + ere * 400 + if mois <= 2 { 1 } else { 0 }) as u16;
    Date { annee, mois, jour, heure: (reste / 3600) as u8, minute: (reste / 60 % 60) as u8, seconde: (reste % 60) as u8 }
}

fn ecrivain(i: usize, racine: PathBuf, rx: Receiver<Msg>, res: mpsc::Sender<Resultat>, relire: bool) {
    // La vérification relit sur le disque pendant que le fichier suivant s'écrit.
    let (tx_v, rx_v) = mpsc::channel::<(PathBuf, PathBuf, u128, Resultat)>();
    let res_v = res.clone();
    let verif = thread::spawn(move || {
        for (temp, final_, xxh3, mut r) in rx_v {
            r.issue = match finaliser(&temp, &final_, xxh3, relire) {
                Ok(i) => i,
                Err(e) => Issue::Echec(e),
            };
            res_v.send(r).ok();
        }
    });
    let mut courant: Option<(File, PathBuf, PathBuf, SystemTime)> = None;
    let mut erreur: Option<String> = None;
    let mut source = PathBuf::new();
    for m in rx {
        match m {
            Msg::Debut { origine, rel, modif } => {
                erreur = None;
                source = origine;
                let final_ = racine.join(&rel);
                let temp = final_.with_file_name(format!(
                    ".{}.prism-part",
                    final_.file_name().unwrap_or_default().to_string_lossy()
                ));
                courant = match final_.parent().map(fs::create_dir_all).unwrap_or(Ok(())).and_then(|_| File::create(&temp)) {
                    Ok(f) => Some((f, temp, final_, modif)),
                    Err(e) => {
                        erreur = Some(format!("création impossible : {e}"));
                        None
                    }
                };
            }
            Msg::Morceau(o) => {
                if let Some((f, ..)) = courant.as_mut() {
                    if let Err(e) = f.write_all(&o) {
                        erreur = Some(format!("écriture impossible : {e}"));
                        courant = None;
                    }
                }
            }
            Msg::Abandon => {
                if let Some((_, temp, ..)) = courant.take() {
                    fs::remove_file(temp).ok();
                }
            }
            Msg::Fin { xxh3, taille } => {
                let mut r = Resultat { dest: i, source: source.clone(), issue: Issue::Echec(String::new()), taille, xxh3, modif: UNIX_EPOCH };
                match courant.take() {
                    Some((f, temp, final_, modif)) => {
                        r.modif = modif;
                        let fin = f.sync_all().and_then(|_| f.set_modified(modif));
                        drop(f);
                        match fin {
                            Ok(()) => {
                                tx_v.send((temp, final_, xxh3, r)).ok();
                            }
                            Err(e) => {
                                fs::remove_file(&temp).ok();
                                r.issue = Issue::Echec(format!("écriture impossible : {e}"));
                                res.send(r).ok();
                            }
                        }
                    }
                    None => {
                        r.issue = Issue::Echec(erreur.take().unwrap_or_else(|| "écriture impossible".into()));
                        res.send(r).ok();
                    }
                }
            }
        }
    }
    drop(tx_v);
    verif.join().ok();
}

/// Relit la copie (hors cache), puis lui donne son nom définitif. Si un fichier identique est déjà
/// là, la copie est supprimée ; s'il est différent, la copie prend un nom libre (« -2 », « -3 »…).
fn finaliser(temp: &Path, final_: &Path, xxh3: u128, relire: bool) -> Result<Issue, String> {
    if relire {
        let relu = relire_sans_cache(temp).map_err(|e| format!("relecture impossible : {e}"))?;
        if relu != xxh3 {
            fs::remove_file(temp).ok();
            return Err("la copie relue diffère de la carte (disque ou câble défaillant ?)".into());
        }
    }
    if final_.exists() {
        if empreinte::fichier(final_).ok() == Some(xxh3) {
            fs::remove_file(temp).ok();
            return Ok(Issue::DejaPresent(final_.to_path_buf()));
        }
        let (base, ext) = (
            final_.file_stem().unwrap_or_default().to_string_lossy().to_string(),
            final_.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default(),
        );
        for n in 2.. {
            let autre = final_.with_file_name(format!("{base}-{n}{ext}"));
            if !autre.exists() {
                fs::rename(temp, &autre).map_err(|e| e.to_string())?;
                return Ok(Issue::Verifie(autre));
            }
            if empreinte::fichier(&autre).ok() == Some(xxh3) {
                fs::remove_file(temp).ok();
                return Ok(Issue::DejaPresent(autre));
            }
        }
    }
    fs::rename(temp, final_).map_err(|e| e.to_string())?;
    Ok(Issue::Verifie(final_.to_path_buf()))
}

/// Relit un fichier en évitant le cache du système, pour lire ce qui est vraiment sur le disque.
fn relire_sans_cache(p: &Path) -> io::Result<u128> {
    let f = File::open(p)?;
    #[cfg(target_os = "linux")]
    unsafe {
        use std::os::fd::AsRawFd;
        libc::posix_fadvise(f.as_raw_fd(), 0, 0, libc::POSIX_FADV_DONTNEED);
    }
    #[cfg(target_os = "macos")]
    unsafe {
        use std::os::fd::AsRawFd;
        libc::fcntl(f.as_raw_fd(), libc::F_NOCACHE, 1);
    }
    let mut f = f;
    let mut h = Xxh3::new();
    let mut t = vec![0u8; MORCEAU];
    loop {
        let n = f.read(&mut t)?;
        if n == 0 {
            break;
        }
        h.update(&t[..n]);
    }
    Ok(h.digest128())
}

fn bilan(a: &Args, fichiers: &[PathBuf], res: &[Resultat], lus: u64, duree: Duration) {
    let s = duree.as_secs_f64().max(1e-3);
    let nd = a.destinations.len();
    let mut ok = vec![0usize; nd];
    let mut deja = vec![0usize; nd];
    let mut echecs: Vec<String> = vec![];
    let mut registres: Vec<Registre> = a.destinations.iter().map(|d| Registre::lire(d)).collect();
    for r in res {
        match &r.issue {
            Issue::Verifie(p) | Issue::DejaPresent(p) => {
                if matches!(r.issue, Issue::Verifie(_)) {
                    ok[r.dest] += 1;
                } else {
                    deja[r.dest] += 1;
                }
                let racine = &a.destinations[r.dest];
                let modif = fs::metadata(p).and_then(|m| m.modified()).unwrap_or(r.modif);
                registres[r.dest]
                    .fichiers
                    .insert(registre::cle(racine, p), Entree { taille: r.taille, modif: registre::nanos(modif), xxh3: r.xxh3 });
            }
            Issue::Echec(m) => echecs.push(format!("{} → {} : {m}", r.source.display(), a.destinations[r.dest].display())),
        }
    }
    // Les empreintes rejoignent le registre de prism-scan : la photothèque est surveillée dès la copie.
    for (i, reg) in registres.iter().enumerate() {
        if let Err(e) = reg.ecrire(&a.destinations[i]) {
            eprintln!("Registre d'empreintes non écrit dans {} : {e}", a.destinations[i].display());
        }
    }
    println!(
        "Carte lue une fois : {:.2} Go en {:.1} s ({:.0} Mo/s){}.",
        lus as f64 / 1e9,
        s,
        lus as f64 / 1e6 / s,
        if a.sans_relecture { "" } else { ", copies relues et vérifiées" }
    );
    for (i, d) in a.destinations.iter().enumerate() {
        println!("  {} : {} copié(s), {} déjà présent(s)", d.display(), ok[i], deja[i]);
    }
    let attendus = fichiers.len() * nd;
    if !echecs.is_empty() {
        println!("\nÉchecs ({}) :", echecs.len());
        for e in &echecs {
            println!("  {e}");
        }
    }
    let complets = ok.iter().sum::<usize>() + deja.iter().sum::<usize>();
    if echecs.is_empty() && complets == attendus && !a.sans_relecture {
        println!("\nTout est copié et vérifié sur chaque destination : la carte peut être formatée.");
    } else {
        println!("\nNe formatez pas la carte : {} copie(s) sur {attendus} sont vérifiées.", if a.sans_relecture { 0 } else { complets });
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn date_depuis_horloge() {
        let t = UNIX_EPOCH + Duration::from_secs(1_779_000_000);
        let d = date_systeme(t);
        assert_eq!((d.annee, d.mois, d.jour), (2026, 5, 17));
    }
}
