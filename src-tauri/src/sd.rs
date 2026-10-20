//! Generative fill: Stable Diffusion 1.5 inpainting (ONNX, fp16) running here with ONNX Runtime, on the
//! graphics card (DirectML on Windows, Core ML on Mac) or on every processor core.
//!
//! The page cuts a window out of the photo (about 512 px), sends it with its mask and the prompt, and
//! gets the generated window back. Everything heavy stays in this file: the CLIP tokenizer, the four
//! networks (text encoder, VAE encoder, UNet, VAE decoder) and a DDIM sampler with classifier-free guidance.
//! The model files (1.9 GB, mostly the UNet) are fetched once by `models::ensure`, streamed to disk, and
//! ONNX Runtime reads them from there: they never pass through the page.

use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

use half::f16;
use ort::environment::Environment;
use ort::session::Session;
use ort::value::{DynValue, Tensor};
use serde::{Deserialize, Serialize};
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::ai::{self, Src};
use crate::models;

const BOS: i32 = 49406;
const EOS: i32 = 49407;
const CTX: usize = 77;
/// Scale between the VAE's latent space and the UNet's.
const LATENT_SCALE: f32 = 0.18215;
/// The loaded networks are released after this long without use (they hold gigabytes on the processor).
const KEEP: Duration = Duration::from_secs(600);

// ------------------------------------------------------------------ files

#[derive(Deserialize)]
struct Extra {
    models: BTreeMap<String, String>,
    sizes: BTreeMap<String, u64>,
}

/// The files of the model: the same list the build merges into the page's PRISM_MODELS.
fn extra() -> &'static Extra {
    static E: OnceLock<Extra> = OnceLock::new();
    E.get_or_init(|| serde_json::from_str(include_str!("../../desktop/models-extra.json")).expect("models-extra.json"))
}

const TEXT: &str = "sd-inpaint/text_encoder.onnx";
const UNET: &str = "sd-inpaint/unet.onnx";
const ENC: &str = "sd-inpaint/vae_encoder.onnx";
const DEC: &str = "sd-inpaint/vae_decoder.onnx";
const VOCAB: &str = "sd-inpaint/vocab.json";
const MERGES: &str = "sd-inpaint/merges.txt";
const SCHED: &str = "sd-inpaint/scheduler_config.json";
/// Small files first, so a damaged download of the UNet is the last thing to find out.
const FILES: [&str; 7] = [SCHED, VOCAB, MERGES, ENC, DEC, TEXT, UNET];

// ------------------------------------------------------------------ tokenizer (CLIP byte-pair encoding)

pub struct Tokenizer {
    vocab: HashMap<String, i32>,
    ranks: HashMap<(String, String), usize>,
    bytes: Vec<char>,
}

/// The byte -> printable character table of GPT-2 / CLIP.
fn byte_table() -> Vec<char> {
    let mut keep: Vec<u32> = (33..=126).chain(161..=172).chain(174..=255).collect();
    let mut out = vec!['\0'; 256];
    for &b in &keep {
        out[b as usize] = char::from_u32(b).unwrap();
    }
    let mut n = 0;
    for b in 0..256u32 {
        if !keep.contains(&b) {
            out[b as usize] = char::from_u32(256 + n).unwrap();
            keep.push(b);
            n += 1;
        }
    }
    out
}

impl Tokenizer {
    pub fn new(vocab_json: &str, merges: &str) -> Result<Tokenizer, String> {
        let vocab: HashMap<String, i32> = serde_json::from_str(vocab_json).map_err(|e| format!("vocabulaire : {e}"))?;
        // the file starts with a version line; CLIP uses the first 48894 merges
        let ranks = merges
            .lines()
            .skip(1)
            .take(48894)
            .enumerate()
            .filter_map(|(i, l)| l.split_once(' ').map(|(a, b)| ((a.to_string(), b.to_string()), i)))
            .collect();
        Ok(Tokenizer { vocab, ranks, bytes: byte_table() })
    }

    /// The words of a text, cut like CLIP's pattern: contractions, runs of letters, single digits,
    /// runs of anything else that is not a space.
    fn words(text: &str) -> Vec<String> {
        let t: Vec<char> = text.chars().collect();
        let mut out = vec![];
        let mut i = 0;
        let starts = |i: usize, s: &str| s.chars().enumerate().all(|(k, c)| t.get(i + k) == Some(&c));
        while i < t.len() {
            let c = t[i];
            if c.is_whitespace() {
                i += 1;
                continue;
            }
            if let Some(s) = ["<|startoftext|>", "<|endoftext|>", "'s", "'t", "'re", "'ve", "'m", "'ll", "'d"].iter().find(|s| starts(i, s)) {
                out.push(s.to_string());
                i += s.chars().count();
                continue;
            }
            let mut j = i + 1;
            if c.is_alphabetic() {
                while j < t.len() && t[j].is_alphabetic() {
                    j += 1;
                }
            } else if !c.is_numeric() {
                while j < t.len() && !t[j].is_whitespace() && !t[j].is_alphabetic() && !t[j].is_numeric() {
                    j += 1;
                }
            }
            out.push(t[i..j].iter().collect());
            i = j;
        }
        out
    }

    fn bpe(&self, word: &str) -> Vec<String> {
        let mut parts: Vec<String> = word.chars().map(|c| c.to_string()).collect();
        if let Some(last) = parts.last_mut() {
            last.push_str("</w>");
        }
        while parts.len() > 1 {
            let best = (0..parts.len() - 1)
                .filter_map(|i| self.ranks.get(&(parts[i].clone(), parts[i + 1].clone())).map(|&r| (r, i)))
                .min();
            let Some((_, at)) = best else { break };
            let (a, b) = (parts[at].clone(), parts[at + 1].clone());
            let mut merged = Vec::with_capacity(parts.len());
            let mut i = 0;
            while i < parts.len() {
                if i + 1 < parts.len() && parts[i] == a && parts[i + 1] == b {
                    merged.push(format!("{a}{b}"));
                    i += 2;
                } else {
                    merged.push(parts[i].clone());
                    i += 1;
                }
            }
            parts = merged;
        }
        parts
    }

    /// Token ids of a prompt: BOS, the tokens (cut at 75), EOS, then EOS up to 77 as the model expects.
    pub fn encode(&self, text: &str) -> Vec<i32> {
        let clean = text.split_whitespace().collect::<Vec<_>>().join(" ").to_lowercase();
        let mut ids = vec![BOS];
        'words: for w in Self::words(&clean) {
            if w == "<|startoftext|>" || w == "<|endoftext|>" {
                ids.push(if w.starts_with("<|s") { BOS } else { EOS });
                continue;
            }
            let mapped: String = w.bytes().map(|b| self.bytes[b as usize]).collect();
            for p in self.bpe(&mapped) {
                if ids.len() >= CTX - 1 {
                    break 'words;
                }
                if let Some(&id) = self.vocab.get(&p) {
                    ids.push(id);
                }
            }
        }
        ids.push(EOS);
        ids.resize(CTX, EOS);
        ids
    }
}

// ------------------------------------------------------------------ DDIM scheduler

#[derive(Deserialize)]
struct SchedFile {
    #[serde(default = "d_bs")]
    beta_start: f64,
    #[serde(default = "d_be")]
    beta_end: f64,
    #[serde(default = "d_nt")]
    num_train_timesteps: usize,
    #[serde(default = "d_so")]
    steps_offset: usize,
}
fn d_bs() -> f64 {
    0.00085
}
fn d_be() -> f64 {
    0.012
}
fn d_nt() -> usize {
    1000
}
fn d_so() -> usize {
    1
}

pub struct Ddim {
    /// cumulative product of (1 - beta), one per training step
    acp: Vec<f64>,
    train: usize,
    offset: usize,
}

impl Ddim {
    fn new(cfg: &SchedFile) -> Ddim {
        // "scaled_linear": linear in the square root of beta
        let (a, b) = (cfg.beta_start.sqrt(), cfg.beta_end.sqrt());
        let n = cfg.num_train_timesteps;
        let mut acp = Vec::with_capacity(n);
        let mut p = 1.0f64;
        for i in 0..n {
            let s = a + (b - a) * i as f64 / (n - 1) as f64;
            p *= 1.0 - s * s;
            acp.push(p);
        }
        Ddim { acp, train: n, offset: cfg.steps_offset }
    }

    /// "leading" spacing: every (train / steps)-th training step, from the noisiest, plus the offset.
    pub fn timesteps(&self, steps: usize) -> Vec<usize> {
        let ratio = self.train / steps;
        (0..steps).rev().map(|i| i * ratio + self.offset).collect()
    }

    /// One deterministic step (eta = 0) from timestep `t` to the previous one of a `steps`-long schedule.
    pub fn step(&self, eps: &[f32], t: usize, steps: usize, x: &mut [f32]) {
        let ratio = (self.train / steps) as i64;
        let prev = t as i64 - ratio;
        let a_t = self.acp[t.min(self.train - 1)];
        // the last step lands on the clean image: set_alpha_to_one is false, so alpha at step 0 is used
        let a_p = if prev >= 0 { self.acp[prev as usize] } else { self.acp[0] };
        let (sa, sb) = (a_t.sqrt(), (1.0 - a_t).sqrt());
        let (pa, pb) = (a_p.sqrt(), (1.0 - a_p).sqrt());
        for (x, &e) in x.iter_mut().zip(eps) {
            let x0 = (*x as f64 - sb * e as f64) / sa;
            *x = (pa * x0 + pb * e as f64) as f32;
        }
    }
}

// ------------------------------------------------------------------ random numbers

/// SplitMix64 + Box-Muller: the same seed always draws the same noise, on every machine.
struct Rng(u64);
impl Rng {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }
    fn uniform(&mut self) -> f64 {
        ((self.next() >> 11) as f64 + 0.5) / (1u64 << 53) as f64
    }
    fn normal(&mut self, n: usize) -> Vec<f32> {
        let mut out = Vec::with_capacity(n + 1);
        while out.len() < n {
            let (u, v) = (self.uniform(), self.uniform());
            let r = (-2.0 * u.ln()).sqrt();
            out.push((r * (std::f64::consts::TAU * v).cos()) as f32);
            out.push((r * (std::f64::consts::TAU * v).sin()) as f32);
        }
        out.truncate(n);
        out
    }
}

// ------------------------------------------------------------------ the pipeline

struct Pipe {
    tok: Tokenizer,
    sched: Ddim,
    text: Mutex<Session>,
    unet: Mutex<Session>,
    enc: Mutex<Session>,
    dec: Mutex<Session>,
    /// execution provider of the UNet (the network that matters for speed)
    ep: String,
}

fn f16s(v: &[f32]) -> Vec<f16> {
    v.iter().map(|&x| f16::from_f32(x)).collect()
}

fn tensor(dims: [i64; 4], data: Vec<f16>) -> Result<DynValue, String> {
    Ok(Tensor::from_array((dims, data)).map_err(|e| e.to_string())?.into_dyn())
}

/// Runs a session and returns the first output as f32 with its shape.
fn run(s: &Mutex<Session>, inputs: Vec<(String, DynValue)>) -> Result<(Vec<i64>, Vec<f32>), String> {
    let mut s = s.lock().unwrap();
    let out = s.run(inputs).map_err(|e| e.to_string())?;
    let (shape, data) = out[0].try_extract_tensor::<f16>().map_err(|e| e.to_string())?;
    Ok((shape.to_vec(), data.iter().map(|x| x.to_f32()).collect()))
}

fn load_one(env: &Environment, path: &Path, key: &str, cache: &Path, cpu_only: bool) -> Result<(Session, String), String> {
    if !cpu_only && ai::gpu_name().is_some() {
        match ai::build(env, Src::File(path), true, Some(cache.join(ai::safe_key(key)))) {
            Ok(s) => return Ok((s, ai::gpu_name().unwrap())),
            Err(e) => eprintln!("Génération : carte graphique indisponible pour {key} ({e}), processeur"),
        }
    }
    ai::build(env, Src::File(path), false, None).map(|s| (s, "CPU".to_string()))
}

impl Pipe {
    fn load(env: &Environment, paths: &HashMap<&'static str, PathBuf>, cache: &Path, cpu_only: bool) -> Result<Pipe, String> {
        let rd = |k: &str| std::fs::read_to_string(&paths[k]).map_err(|e| format!("{k} : {e}"));
        let tok = Tokenizer::new(&rd(VOCAB)?, &rd(MERGES)?)?;
        let cfg: SchedFile = serde_json::from_str(&rd(SCHED)?).map_err(|e| format!("planificateur : {e}"))?;
        let mut ep = String::new();
        let mut one = |k: &'static str| -> Result<Mutex<Session>, String> {
            let (s, e) = load_one(env, &paths[k], k, cache, cpu_only)?;
            if k == UNET {
                ep = e;
            }
            Ok(Mutex::new(s))
        };
        let (text, enc, dec, unet) = (one(TEXT)?, one(ENC)?, one(DEC)?, one(UNET)?);
        Ok(Pipe { tok, sched: Ddim::new(&cfg), text, unet, enc, dec, ep })
    }

    fn embed(&self, prompt: &str) -> Result<Vec<f32>, String> {
        let ids = self.tok.encode(prompt);
        let t = Tensor::from_array(([1i64, CTX as i64], ids)).map_err(|e| e.to_string())?.into_dyn();
        Ok(run(&self.text, vec![("input_ids".into(), t)])?.1)
    }

    /// Generates the content of the masked area. `img` is RGB 8-bit, `mask` 8-bit (> 127 = fill), `w` and `h`
    /// multiples of 8. Returns RGB 8-bit.
    fn generate(&self, p: &Params, img: &[u8], mask: &[u8], mut report: impl FnMut(&'static str, usize, usize) -> Result<(), String>) -> Result<Vec<u8>, String> {
        let (w, h) = (p.w, p.h);
        let (lw, lh) = (w / 8, h / 8);
        let n = w * h;
        let ln = lw * lh;

        // the photo in [-1, 1], planar; the hole blanked out
        report("encode", 0, 1)?;
        let hole: Vec<bool> = mask.iter().map(|&m| m > 127).collect();
        let mut masked = vec![0f32; 3 * n];
        for i in 0..n {
            for c in 0..3 {
                masked[c * n + i] = if hole[i] { 0.0 } else { img[i * 3 + c] as f32 / 127.5 - 1.0 };
            }
        }
        let (_, mut mlat) = run(&self.enc, vec![("sample".into(), tensor([1, 3, h as i64, w as i64], f16s(&masked))?)])?;
        if mlat.len() != 4 * ln {
            return Err(format!("sortie du codeur inattendue : {} valeurs", mlat.len()));
        }
        mlat.iter_mut().for_each(|v| *v *= LATENT_SCALE);
        // mask at latent size: a latent cell is part of the hole when any of its 8 x 8 pixels is
        let mut mask8 = vec![0f32; ln];
        for y in 0..h {
            for x in 0..w {
                if hole[y * w + x] {
                    mask8[(y / 8) * lw + x / 8] = 1.0;
                }
            }
        }

        // prompts: the empty/negative one first, then the wanted one (classifier-free guidance)
        let neg = self.embed(&p.negative)?;
        let pos = self.embed(&p.prompt)?;
        let mut emb = neg;
        emb.extend_from_slice(&pos);

        let mut x = Rng(p.seed).normal(4 * ln);
        let steps = p.steps.clamp(1, 100);
        let ts = self.sched.timesteps(steps);
        for (i, &t) in ts.iter().enumerate() {
            report("denoise", i, steps)?;
            // both halves of the batch see the same latents, mask and masked photo
            let mut input = Vec::with_capacity(2 * 9 * ln);
            for _ in 0..2 {
                input.extend_from_slice(&x);
                input.extend_from_slice(&mask8);
                input.extend_from_slice(&mlat);
            }
            let inputs = vec![
                ("sample".to_string(), tensor([2, 9, lh as i64, lw as i64], f16s(&input))?),
                ("timestep".to_string(), Tensor::from_array(([2i64], vec![f16::from_f32(t as f32); 2])).map_err(|e| e.to_string())?.into_dyn()),
                ("encoder_hidden_states".to_string(), Tensor::from_array(([2i64, CTX as i64, 768], f16s(&emb))).map_err(|e| e.to_string())?.into_dyn()),
            ];
            let (_, eps) = run(&self.unet, inputs)?;
            if eps.len() != 2 * 4 * ln {
                return Err(format!("sortie du réseau inattendue : {} valeurs", eps.len()));
            }
            let (u, c) = eps.split_at(4 * ln);
            let g: Vec<f32> = u.iter().zip(c).map(|(&u, &c)| u + p.guidance * (c - u)).collect();
            self.sched.step(&g, t, steps, &mut x);
        }
        report("denoise", steps, steps)?;

        report("decode", 0, 1)?;
        let z: Vec<f32> = x.iter().map(|v| v / LATENT_SCALE).collect();
        let (_, px) = run(&self.dec, vec![("latent_sample".into(), tensor([1, 4, lh as i64, lw as i64], f16s(&z))?)])?;
        if px.len() != 3 * n {
            return Err(format!("sortie du décodeur inattendue : {} valeurs", px.len()));
        }
        let mut out = vec![0u8; 3 * n];
        for i in 0..n {
            for c in 0..3 {
                out[i * 3 + c] = ((px[c * n + i] / 2.0 + 0.5).clamp(0.0, 1.0) * 255.0 + 0.5) as u8;
            }
        }
        Ok(out)
    }
}

// ------------------------------------------------------------------ commands

#[derive(Default)]
pub struct SdState {
    pipe: Mutex<Option<Arc<Pipe>>>,
    cancel: Arc<AtomicBool>,
    busy: AtomicBool,
    used: Mutex<Option<Instant>>,
}

/// Only one download, load or generation at a time; released when dropped.
struct Busy<'a>(&'a AtomicBool);
impl<'a> Busy<'a> {
    fn take(f: &'a AtomicBool) -> Result<Busy<'a>, String> {
        if f.swap(true, Ordering::AcqRel) {
            return Err("Une génération est déjà en cours".into());
        }
        Ok(Busy(f))
    }
}
impl Drop for Busy<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

#[derive(Serialize)]
pub struct SdStatus {
    ok: bool,
    cached: bool,
    loaded: bool,
    error: Option<String>,
    /// size of the files to fetch, in bytes
    total: u64,
}

#[tauri::command]
pub fn sd_status(app: AppHandle, state: State<'_, SdState>) -> SdStatus {
    let e = extra();
    let (ok, error) = match ai::env(&app) {
        Ok(_) => (true, None),
        Err(e) => (false, Some(e)),
    };
    let cached = models::cache_dir(&app).map(|d| FILES.iter().all(|f| models::cached(&d, &e.models[*f]))).unwrap_or(false);
    SdStatus { ok, cached, loaded: state.pipe.lock().unwrap().is_some(), error, total: e.sizes.values().sum() }
}

#[derive(Serialize, Clone)]
struct Download {
    /// "download", "verify" or "load"
    phase: &'static str,
    done: u64,
    total: u64,
}

#[derive(Serialize)]
pub struct Prepared {
    ep: String,
    load_ms: u128,
}

fn touch(state: &SdState, app: &AppHandle) {
    let now = Instant::now();
    *state.used.lock().unwrap() = Some(now);
    // release the networks when nobody used them for a while
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(KEEP + Duration::from_secs(1));
        let state = app.state::<SdState>();
        let idle = state.used.lock().unwrap().is_some_and(|t| t.elapsed() >= KEEP);
        if idle && !state.busy.load(Ordering::Acquire) {
            *state.pipe.lock().unwrap() = None;
        }
    });
}

/// Downloads the model files when they are missing (events `sd-download`), then loads the networks.
#[tauri::command]
pub async fn sd_prepare(app: AppHandle, state: State<'_, SdState>) -> Result<Prepared, String> {
    if let Some(p) = state.pipe.lock().unwrap().clone() {
        touch(&state, &app);
        return Ok(Prepared { ep: p.ep.clone(), load_ms: 0 });
    }
    let _busy = Busy::take(&state.busy)?;
    state.cancel.store(false, Ordering::Relaxed);
    let env = ai::env(&app)?;
    let dir = models::cache_dir(&app)?;
    let e = extra();
    let total: u64 = e.sizes.values().sum();
    let mut paths: HashMap<&'static str, PathBuf> = HashMap::new();
    let mut before = 0u64;
    let last = Mutex::new(Instant::now() - Duration::from_secs(1));
    for rel in FILES {
        let base = before;
        let emit = |phase: &'static str, done: u64| {
            let _ = app.emit("sd-download", Download { phase, done, total });
        };
        let on = |done: u64, _file_total: u64| {
            let mut l = last.lock().unwrap();
            if l.elapsed() >= Duration::from_millis(120) {
                *l = Instant::now();
                emit("download", base + done);
            }
        };
        let path = models::ensure(&dir, &e.models[rel], rel, &state.cancel, &on, &|| emit("verify", base))
            .await
            .map_err(|err| if err == "annulé" { err } else { format!("Téléchargement impossible : {err}") })?;
        paths.insert(rel, path);
        before += e.sizes[rel];
        emit("download", before);
    }
    let _ = app.emit("sd-download", Download { phase: "load", done: total, total });
    let cache = app.path().app_cache_dir().map(|d| d.join("coreml")).unwrap_or_default();
    let cpu_only = std::env::var("PRISM_SD_CPU").is_ok();
    let t0 = Instant::now();
    let pipe = tauri::async_runtime::spawn_blocking(move || Pipe::load(env, &paths, &cache, cpu_only))
        .await
        .map_err(|e| e.to_string())??;
    let pipe = Arc::new(pipe);
    let ep = pipe.ep.clone();
    *state.pipe.lock().unwrap() = Some(pipe);
    touch(&state, &app);
    Ok(Prepared { ep, load_ms: t0.elapsed().as_millis() })
}

#[tauri::command]
pub fn sd_cancel(state: State<'_, SdState>) {
    state.cancel.store(true, Ordering::Relaxed);
}

#[tauri::command]
pub fn sd_unload(state: State<'_, SdState>) {
    if !state.busy.load(Ordering::Acquire) {
        *state.pipe.lock().unwrap() = None;
    }
}

#[derive(Deserialize)]
struct Params {
    w: usize,
    h: usize,
    prompt: String,
    #[serde(default)]
    negative: String,
    #[serde(default = "d_steps")]
    steps: usize,
    #[serde(default = "d_guidance")]
    guidance: f32,
    #[serde(default)]
    seed: u64,
}
fn d_steps() -> usize {
    20
}
fn d_guidance() -> f32 {
    7.5
}

#[derive(Serialize, Clone)]
struct Progress {
    /// "encode", "denoise" or "decode"
    phase: &'static str,
    step: usize,
    total: usize,
    ms: u128,
}

/// Generates the masked area of a photo window. Header `x-params`: JSON {w, h, prompt, negative, steps, guidance,
/// seed}; body: RGB 8-bit (w x h x 3) then the mask (w x h, > 127 = fill). Answer: RGB 8-bit, same size.
/// Events `sd-progress` follow the steps; `sd_cancel` stops after the current one.
#[tauri::command]
pub async fn sd_generate(app: AppHandle, state: State<'_, SdState>, request: Request<'_>) -> Result<Response, String> {
    let InvokeBody::Raw(body) = request.body() else {
        return Err("données manquantes".into());
    };
    let raw = request.headers().get("x-params").and_then(|v| v.to_str().ok()).ok_or("paramètres manquants")?;
    let raw = percent_encoding::percent_decode_str(raw).decode_utf8_lossy().into_owned();
    let p: Params = serde_json::from_str(&raw).map_err(|e| format!("paramètres : {e}"))?;
    if !p.w.is_multiple_of(8) || !p.h.is_multiple_of(8) || !(64..=1024).contains(&p.w) || !(64..=1024).contains(&p.h) {
        return Err("taille de fenêtre invalide".into());
    }
    let n = p.w * p.h;
    if body.len() != n * 4 {
        return Err("image ou masque de la mauvaise taille".into());
    }
    let pipe = state.pipe.lock().unwrap().clone().ok_or("modèle non chargé")?;
    let _busy = Busy::take(&state.busy)?;
    state.cancel.store(false, Ordering::Relaxed);
    let cancel = state.cancel.clone();
    let body = body.clone();
    let handle = app.clone();
    let out = tauri::async_runtime::spawn_blocking(move || {
        let t0 = Instant::now();
        let mut at = Instant::now();
        let report = |phase: &'static str, step: usize, total: usize| {
            if cancel.load(Ordering::Relaxed) {
                return Err("annulé".to_string());
            }
            let ms = t0.elapsed().as_millis();
            eprintln!("Génération : {phase} {step}/{total} à {ms} ms (dernier intervalle {} ms)", at.elapsed().as_millis());
            at = Instant::now();
            let _ = handle.emit("sd-progress", Progress { phase, step, total, ms });
            Ok(())
        };
        pipe.generate(&p, &body[..n * 3], &body[n * 3..], report)
    })
    .await
    .map_err(|e| e.to_string())??;
    touch(&state, &app);
    Ok(Response::new(out))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A tiny vocabulary: enough to check the cutting, the merges and the padding without the model files.
    fn toy() -> Tokenizer {
        let mut vocab = HashMap::new();
        for (i, t) in ["h", "i", "i</w>", "hi</w>", "a</w>", "!</w>", "1</w>", "2</w>"].iter().enumerate() {
            vocab.insert(t.to_string(), 100 + i as i32);
        }
        Tokenizer::new(&serde_json::to_string(&vocab).unwrap(), "#version: 0.2\nh i</w>\n").unwrap()
    }

    #[test]
    fn toy_tokens() {
        let t = toy();
        let ids = t.encode("  Hi  A!  12 ");
        assert_eq!(ids.len(), 77);
        assert_eq!(ids[0], 49406);
        // "hi" merges into one token, "a", "!", then the digits one by one
        assert_eq!(&ids[1..7], &[103, 104, 105, 106, 107, 49407]);
        assert!(ids[7..].iter().all(|&i| i == 49407));
        assert_eq!(t.encode("")[..2], [49406, 49407]);
    }

    #[test]
    fn word_cutting() {
        assert_eq!(Tokenizer::words("don't stop, 42!!"), ["don", "'t", "stop", ",", "4", "2", "!!"]);
        assert_eq!(Tokenizer::words("a  b\tc"), ["a", "b", "c"]);
    }

    #[test]
    fn long_prompt_is_cut() {
        let t = toy();
        let ids = t.encode(&"a ".repeat(200));
        assert_eq!(ids.len(), 77);
        assert_eq!(ids[76], 49407);
        assert_eq!(ids[75], 104);
    }

    /// The real tokenizer files, when this machine has them in the model cache (the CI has not).
    #[test]
    fn real_prompts() {
        let dir = std::env::var("HOME").map(|h| PathBuf::from(h).join(".cache/app.prism.photo/models")).unwrap_or_default();
        let e = extra();
        let (Ok(v), Ok(m)) = (std::fs::read_to_string(dir.join(&e.models[VOCAB])), std::fs::read_to_string(dir.join(&e.models[MERGES]))) else {
            eprintln!("tokenizer files not in the cache: skipped");
            return;
        };
        let t = Tokenizer::new(&v, &m).unwrap();
        let ids = t.encode("a photo of an astronaut riding a horse");
        assert_eq!(&ids[..11], &[49406, 320, 1125, 539, 550, 18376, 6765, 320, 4558, 49407, 49407]);
        assert_eq!(ids.len(), 77);
        // the empty prompt is BOS then EOS padding
        let e = t.encode("");
        assert_eq!((e[0], e[1], e[76]), (49406, 49407, 49407));
        // capital letters and punctuation
        let ids = t.encode("A Red Balloon, floating.");
        assert_eq!(ids[1], 320);
        assert_eq!(ids[2], t.encode("red")[1]);
        assert_eq!(ids[3], t.encode("balloon")[1]);
    }

    fn sched() -> Ddim {
        Ddim::new(&serde_json::from_str::<SchedFile>("{}").unwrap())
    }

    #[test]
    fn timesteps() {
        let s = sched();
        let t = s.timesteps(20);
        assert_eq!((t.len(), t[0], t[1], t[19]), (20, 951, 901, 1));
        assert_eq!(s.timesteps(10), [901, 801, 701, 601, 501, 401, 301, 201, 101, 1]);
    }

    #[test]
    fn alphas() {
        let s = sched();
        assert!((s.acp[0] - 0.99915).abs() < 1e-9);
        assert!(s.acp.windows(2).all(|w| w[1] < w[0]));
        // scaled_linear 0.00085..0.012 over 1000 steps ends near 0.0047
        assert!((s.acp[999] - 0.0047).abs() < 0.0003, "{}", s.acp[999]);
    }

    #[test]
    fn ddim_step_recovers_the_clean_image() {
        let s = sched();
        // x_t built from a known x0 and noise: one step must land on x_prev built from the same pair
        let (x0, eps) = (0.6f64, -0.4f64);
        let (t, steps) = (601usize, 10usize);
        let mk = |t: usize| s.acp[t].sqrt() * x0 + (1.0 - s.acp[t]).sqrt() * eps;
        let mut x = [mk(t) as f32];
        s.step(&[eps as f32], t, steps, &mut x);
        assert!((x[0] as f64 - mk(501)).abs() < 1e-5);
        // the last step (t = 1) goes to the clean image's level of noise at step 0
        let mut x = [mk(1) as f32];
        s.step(&[eps as f32], 1, steps, &mut x);
        assert!((x[0] as f64 - mk(0)).abs() < 1e-5);
    }

    #[test]
    fn noise_is_repeatable_and_normal() {
        let a = Rng(7).normal(20001);
        assert_eq!(a, Rng(7).normal(20001));
        assert_ne!(a, Rng(8).normal(20001));
        let mean = a.iter().sum::<f32>() / a.len() as f32;
        let var = a.iter().map(|v| (v - mean).powi(2)).sum::<f32>() / a.len() as f32;
        assert!(mean.abs() < 0.03 && (var - 1.0).abs() < 0.05, "{mean} {var}");
    }

    #[test]
    fn byte_table_is_printable_and_unique() {
        let t = byte_table();
        assert_eq!(t[b'a' as usize], 'a');
        assert_eq!(t[b' ' as usize], 'Ġ');
        let mut u = t.clone();
        u.sort();
        u.dedup();
        assert_eq!(u.len(), 256);
    }
}
