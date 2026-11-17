//! prism-scan : décode chaque photo d'un dossier pour trouver les fichiers abîmés, et garde une
//! empreinte de chaque fichier pour repérer, au passage suivant, ceux qui ont changé sans que
//! personne ne les modifie (dégradation du disque, « bit rot »).

use clap::Parser;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use socle::verif::{self, Verdict};
use socle::{empreinte, parcours, Nature};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant, UNIX_EPOCH};

const REGISTRE: &str = ".prism-empreintes.json";

#[derive(Parser)]
#[command(name = "prism-scan", version, about = "Trouve les photos abîmées et surveille leur dégradation")]
struct Args {
    /// Le dossier à vérifier (sous-dossiers compris).
    dossier: PathBuf,
    /// Ne pas lire ni mettre à jour le registre d'empreintes (.prism-empreintes.json).
    #[arg(long)]
    sans_empreintes: bool,
    /// Hacher seulement, sans décoder les photos (bien plus rapide, ne voit que les altérations).
    #[arg(long)]
    rapide: bool,
    /// Écrire le rapport complet en JSON sur la sortie standard.
    #[arg(long)]
    json: bool,
    /// Nombre de fils de calcul (par défaut : un par cœur).
    #[arg(long)]
    fils: Option<usize>,
}

#[derive(Serialize, Deserialize, Default)]
struct Registre {
    version: u32,
    fichiers: BTreeMap<String, Entree>,
}

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq)]
struct Entree {
    taille: u64,
    /// Date de modification, en nanosecondes depuis 1970.
    modif: u128,
    xxh3: u128,
}

#[derive(Serialize, Clone, PartialEq, Debug)]
#[serde(rename_all = "lowercase")]
enum Probleme {
    /// Le décodage échoue ou montre des données perdues.
    Abime(String),
    /// Même taille, même date, contenu différent : rien ne l'a modifié, le support l'a altéré.
    Altere,
    /// Présent au dernier passage, absent maintenant.
    Disparu,
    /// Illisible (droits, erreur d'entrée-sortie).
    Illisible(String),
}

#[derive(Serialize)]
struct Ligne {
    chemin: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    probleme: Option<Probleme>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    remarques: Vec<String>,
    #[serde(skip)]
    entree: Option<Entree>,
    #[serde(skip)]
    inconnu: bool,
    #[serde(skip)]
    modifie: bool,
}

fn main() {
    let a = Args::parse();
    if let Some(n) = a.fils {
        rayon::ThreadPoolBuilder::new().num_threads(n).build_global().ok();
    }
    if !a.dossier.is_dir() {
        eprintln!("« {} » n'est pas un dossier.", a.dossier.display());
        std::process::exit(2);
    }
    let chemin_registre = a.dossier.join(REGISTRE);
    let ancien: Registre = if a.sans_empreintes {
        Registre::default()
    } else {
        std::fs::read(&chemin_registre).ok().and_then(|o| serde_json::from_slice(&o).ok()).unwrap_or_default()
    };

    let fichiers = parcours::fichiers(&a.dossier, |_| true);
    let total = fichiers.len();
    let faits = Arc::new(AtomicUsize::new(0));
    let octets = Arc::new(AtomicU64::new(0));
    let debut = Instant::now();
    let suivi = progression(total, faits.clone(), octets.clone(), a.json);

    let lignes: Vec<Ligne> = fichiers
        .par_iter()
        .map(|p| {
            let l = examiner(&a.dossier, p, &ancien, a.rapide);
            faits.fetch_add(1, Ordering::Relaxed);
            octets.fetch_add(l.entree.map(|e| e.taille).unwrap_or(0), Ordering::Relaxed);
            l
        })
        .collect();
    drop(suivi);
    let duree = debut.elapsed();

    let mut nouveau = Registre { version: 1, fichiers: BTreeMap::new() };
    let mut sortie: Vec<Ligne> = Vec::new();
    for l in lignes {
        if let Some(e) = l.entree {
            // Un fichier altéré garde son empreinte d'origine : il restera signalé tant qu'on ne
            // l'aura pas remplacé par une bonne copie.
            let garder = if l.probleme == Some(Probleme::Altere) { ancien.fichiers[&l.chemin] } else { e };
            nouveau.fichiers.insert(l.chemin.clone(), garder);
        }
        sortie.push(l);
    }
    let presents: std::collections::HashSet<&str> = sortie.iter().map(|l| l.chemin.as_str()).collect();
    let disparus: Vec<Ligne> = ancien
        .fichiers
        .keys()
        .filter(|k| !presents.contains(k.as_str()))
        .map(|k| Ligne { chemin: k.clone(), probleme: Some(Probleme::Disparu), remarques: vec![], entree: None, inconnu: false, modifie: false })
        .collect();
    sortie.extend(disparus);

    if !a.sans_empreintes {
        if let Err(e) = std::fs::write(&chemin_registre, serde_json::to_vec(&nouveau).unwrap()) {
            eprintln!("Registre d'empreintes non enregistré : {e}");
        }
    }

    let total_octets = octets.load(Ordering::Relaxed);
    let problemes = sortie.iter().filter(|l| l.probleme.is_some()).count();
    if a.json {
        let r = serde_json::json!({
            "fichiers": total,
            "octets": total_octets,
            "secondes": duree.as_secs_f64(),
            "premier_passage": ancien.fichiers.is_empty(),
            "lignes": sortie.iter().filter(|l| l.probleme.is_some() || !l.remarques.is_empty()).collect::<Vec<_>>(),
        });
        println!("{}", serde_json::to_string_pretty(&r).unwrap());
    } else {
        resume(&sortie, total, total_octets, duree, ancien.fichiers.is_empty() && !a.sans_empreintes, a.rapide);
    }
    std::process::exit(if problemes > 0 { 1 } else { 0 });
}

fn examiner(racine: &Path, p: &Path, ancien: &Registre, rapide: bool) -> Ligne {
    let chemin = p.strip_prefix(racine).unwrap_or(p).to_string_lossy().replace('\\', "/");
    let mut l = Ligne { chemin, probleme: None, remarques: vec![], entree: None, inconnu: false, modifie: false };
    let meta = match std::fs::metadata(p) {
        Ok(m) => m,
        Err(e) => {
            l.probleme = Some(Probleme::Illisible(e.to_string()));
            return l;
        }
    };
    let modif = meta.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_nanos()).unwrap_or(0);
    let nature = Nature::de(p);
    let verifier = !rapide && nature.photo();
    // Lire le fichier une seule fois : la même mémoire sert au hachage et au décodage.
    let (xxh3, octets) = if verifier {
        match std::fs::read(p) {
            Ok(o) => (empreinte::octets(&o), Some(Arc::new(o))),
            Err(e) => {
                l.probleme = Some(Probleme::Illisible(e.to_string()));
                return l;
            }
        }
    } else {
        match empreinte::fichier(p) {
            Ok(h) => (h, None),
            Err(e) => {
                l.probleme = Some(Probleme::Illisible(e.to_string()));
                return l;
            }
        }
    };
    let e = Entree { taille: meta.len(), modif, xxh3 };
    l.entree = Some(e);
    if let Some(av) = ancien.fichiers.get(&l.chemin) {
        if av.taille == e.taille && av.modif == e.modif && av.xxh3 != e.xxh3 {
            l.probleme = Some(Probleme::Altere);
        } else if av.xxh3 != e.xxh3 {
            l.modifie = true;
        }
    }
    if let Some(o) = octets {
        let r = verif::verifier(nature, &o);
        l.remarques = r.remarques;
        match r.verdict {
            Verdict::Sain => {}
            Verdict::Inconnu(_) => l.inconnu = true,
            Verdict::Abime(m) => {
                if l.probleme.is_none() {
                    l.probleme = Some(Probleme::Abime(m));
                } else {
                    l.remarques.push(m);
                }
            }
        }
    }
    l
}

struct Suivi(Option<std::thread::JoinHandle<()>>, Arc<AtomicUsize>);
impl Drop for Suivi {
    fn drop(&mut self) {
        self.1.store(usize::MAX, Ordering::Relaxed);
        if let Some(h) = self.0.take() {
            h.join().ok();
        }
    }
}

fn progression(total: usize, faits: Arc<AtomicUsize>, octets: Arc<AtomicU64>, muet: bool) -> Suivi {
    let stop = Arc::new(AtomicUsize::new(0));
    if muet || !std::io::IsTerminal::is_terminal(&std::io::stderr()) {
        return Suivi(None, stop);
    }
    let s = stop.clone();
    let debut = Instant::now();
    let h = std::thread::spawn(move || {
        while s.load(Ordering::Relaxed) != usize::MAX {
            std::thread::sleep(Duration::from_millis(200));
            let d = debut.elapsed().as_secs_f64().max(1e-3);
            eprint!(
                "\r{} / {} fichiers  {:.0} Mo/s   ",
                faits.load(Ordering::Relaxed),
                total,
                octets.load(Ordering::Relaxed) as f64 / 1e6 / d
            );
        }
        eprint!("\r{:60}\r", "");
    });
    Suivi(Some(h), stop)
}

fn resume(lignes: &[Ligne], total: usize, octets: u64, duree: Duration, premier: bool, rapide: bool) {
    let s = duree.as_secs_f64().max(1e-3);
    println!(
        "{} fichiers, {:.1} Go vérifiés en {:.1} s ({:.0} Mo/s, {:.0} fichiers/s).",
        total,
        octets as f64 / 1e9,
        s,
        octets as f64 / 1e6 / s,
        total as f64 / s
    );
    let mut abimes = vec![];
    let mut alteres = vec![];
    let mut disparus = vec![];
    let mut illisibles = vec![];
    for l in lignes {
        match &l.probleme {
            Some(Probleme::Abime(m)) => abimes.push(format!("{} : {m}", l.chemin)),
            Some(Probleme::Altere) => alteres.push(l.chemin.clone()),
            Some(Probleme::Disparu) => disparus.push(l.chemin.clone()),
            Some(Probleme::Illisible(m)) => illisibles.push(format!("{} : {m}", l.chemin)),
            None => {}
        }
    }
    let liste = |titre: &str, v: &[String]| {
        if !v.is_empty() {
            println!("\n{titre} ({}) :", v.len());
            for x in v {
                println!("  {x}");
            }
        }
    };
    liste("Photos abîmées", &abimes);
    liste("Fichiers altérés sans avoir été modifiés (support défaillant ? remplacez-les par une sauvegarde)", &alteres);
    liste("Fichiers disparus depuis le dernier passage", &disparus);
    liste("Fichiers illisibles", &illisibles);
    let remarques: Vec<String> =
        lignes.iter().flat_map(|l| l.remarques.iter().map(move |r| format!("{} : {r}", l.chemin))).collect();
    liste("Remarques", &remarques);
    let inconnus = lignes.iter().filter(|l| l.inconnu).count();
    let modifies = lignes.iter().filter(|l| l.modifie).count();
    if inconnus > 0 {
        println!("\n{inconnus} photo(s) dans un format que ce scanner ne sait pas décoder : seule leur empreinte est suivie.");
    }
    if modifies > 0 {
        println!("{modifies} fichier(s) modifié(s) normalement depuis le dernier passage (empreinte mise à jour).");
    }
    if abimes.is_empty() && alteres.is_empty() && disparus.is_empty() && illisibles.is_empty() {
        println!("\nAucun problème trouvé.");
    }
    if premier {
        println!("Premier passage : les empreintes sont enregistrées dans {REGISTRE}. Relancez plus tard pour détecter les altérations.");
    }
    if rapide {
        println!("Mode rapide : les photos n'ont pas été décodées.");
    }
}
