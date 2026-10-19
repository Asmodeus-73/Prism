//! Native AI: the page's models (segmentation, denoising, object removal, upscaling) run here with
//! ONNX Runtime on the graphics card (DirectML on Windows, Core ML on Mac), or on every processor
//! core when the card can't run a model. The page sends the model bytes once, then tensors.
//!
//! The ONNX Runtime library is shipped next to the app (bundle resource `onnxruntime/`) and loaded
//! at the first use; without it the page keeps its own in-browser engine.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};

use ort::environment::Environment;
use ort::session::{builder::GraphOptimizationLevel, Session};
use ort::value::{DynValue, Tensor, TensorElementType, ValueType};
use serde::{Deserialize, Serialize};
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Manager, Runtime, State};

#[derive(Serialize, Clone)]
pub struct Status {
    ok: bool,
    gpu: Option<String>,
    version: Option<String>,
    error: Option<String>,
}

struct Model {
    session: Mutex<Session>,
    ep: String,
}

#[derive(Default)]
pub struct AiState {
    models: Mutex<HashMap<String, Arc<Model>>>,
}

static ENV: OnceLock<Result<(Environment, Option<String>), String>> = OnceLock::new();

fn lib_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "onnxruntime.dll"
    } else if cfg!(target_os = "macos") {
        "libonnxruntime.dylib"
    } else {
        "libonnxruntime.so"
    }
}

fn lib_path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    let mut places = vec![];
    if let Ok(dir) = app.path().resource_dir() {
        places.push(dir.join("onnxruntime").join(lib_name()));
    }
    // development: src-tauri/onnxruntime/
    places.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("onnxruntime").join(lib_name()));
    places.into_iter().find(|p| p.is_file())
}

fn env<R: Runtime>(app: &AppHandle<R>) -> Result<&'static Environment, String> {
    let r = ENV.get_or_init(|| {
        let path = lib_path(app).ok_or_else(|| "moteur IA natif absent".to_string())?;
        // On Windows, DirectML.dll sits next to onnxruntime.dll and must be found first.
        #[cfg(target_os = "windows")]
        if let Some(dir) = path.parent() {
            let dml = dir.join("DirectML.dll");
            if dml.is_file() {
                unsafe {
                    let _ = libloading::Library::new(&dml).map(std::mem::forget);
                }
            }
        }
        let env = ort::init_from(&path)
            .map_err(|e| e.to_string())?
            .with_name("prism")
            .build()
            .map_err(|e| e.to_string())?;
        Ok((env, gpu_name()))
    });
    match r {
        Ok((env, _)) => Ok(env),
        Err(e) => Err(e.clone()),
    }
}

fn gpu_name() -> Option<String> {
    if cfg!(target_os = "windows") {
        Some("DirectML".into())
    } else if cfg!(target_os = "macos") {
        Some("CoreML".into())
    } else {
        None
    }
}

#[tauri::command]
pub fn ai_status(app: AppHandle) -> Status {
    match env(&app) {
        Ok(_) => Status {
            ok: true,
            gpu: ENV.get().and_then(|r| r.as_ref().ok()).and_then(|(_, g)| g.clone()),
            version: Some(ort::info().to_string()),
            error: None,
        },
        Err(e) => Status { ok: false, gpu: None, version: None, error: Some(e) },
    }
}

fn build(env: &Environment, bytes: &[u8], gpu: bool, cache: Option<PathBuf>) -> Result<Session, String> {
    let threads = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4);
    let mut b = Session::builder(env)
        .map_err(|e| e.to_string())?
        .with_optimization_level(GraphOptimizationLevel::Level3)
        .map_err(|e| e.to_string())?
        .with_intra_threads(threads)
        .map_err(|e| e.to_string())?;
    if gpu {
        #[cfg(target_os = "windows")]
        {
            // DirectML needs these two off
            b = b
                .with_memory_pattern(false)
                .map_err(|e| e.to_string())?
                .with_parallel_execution(false)
                .map_err(|e| e.to_string())?
                .with_execution_providers([ort::ep::DirectML::default().build().error_on_failure()])
                .map_err(|e| e.to_string())?;
        }
        #[cfg(target_os = "macos")]
        {
            let mut ep = ort::ep::CoreML::default()
                .with_model_format(ort::ep::coreml::ModelFormat::MLProgram)
                .with_compute_units(ort::ep::coreml::ComputeUnits::All);
            if let Some(dir) = cache {
                let _ = std::fs::create_dir_all(&dir);
                ep = ep.with_model_cache_dir(dir.to_string_lossy());
            }
            b = b
                .with_execution_providers([ep.build().error_on_failure()])
                .map_err(|e| e.to_string())?;
        }
        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            let _ = cache;
            return Err("pas de carte graphique prise en charge".into());
        }
    }
    let _ = &cache;
    b.commit_from_memory(bytes).map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct Loaded {
    ep: String,
    inputs: Vec<String>,
    outputs: Vec<String>,
}

/// Loads a model sent as the request body. `x-key` names it for later runs; `x-cpu: 1` skips the graphics card.
#[tauri::command]
pub async fn ai_load(app: AppHandle, state: State<'_, AiState>, request: Request<'_>) -> Result<Loaded, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("modèle manquant".into());
    };
    let key = header(&request, "x-key")?;
    let cpu = header(&request, "x-cpu").map(|v| v == "1").unwrap_or(false);
    let env = env(&app)?;
    let cache = app.path().app_cache_dir().ok().map(|d| d.join("coreml").join(safe_key(&key)));
    let bytes = bytes.clone();
    let (session, ep) = tauri::async_runtime::spawn_blocking(move || {
        if !cpu && gpu_name().is_some() {
            match build(env, &bytes, true, cache) {
                Ok(s) => return Ok((s, gpu_name().unwrap())),
                Err(e) => eprintln!("IA : carte graphique indisponible pour ce modèle ({e}), processeur"),
            }
        }
        build(env, &bytes, false, None).map(|s| (s, "CPU".to_string()))
    })
    .await
    .map_err(|e| e.to_string())??;
    let loaded = Loaded {
        ep: ep.clone(),
        inputs: session.inputs().iter().map(|o| o.name().to_string()).collect(),
        outputs: session.outputs().iter().map(|o| o.name().to_string()).collect(),
    };
    state.models.lock().unwrap().insert(key, Arc::new(Model { session: Mutex::new(session), ep }));
    Ok(loaded)
}

#[tauri::command]
pub fn ai_unload(state: State<'_, AiState>, key: String) {
    state.models.lock().unwrap().remove(&key);
}

#[derive(Deserialize)]
struct InSpec {
    name: String,
    dtype: String,
    dims: Vec<i64>,
}

#[derive(Serialize)]
struct OutSpec {
    name: String,
    dtype: &'static str,
    dims: Vec<i64>,
    bytes: usize,
}

/// Runs a loaded model. Header `x-inputs`: JSON list of {name, dtype, dims}; body: their data one after
/// the other. Answer: 4 bytes (length of a JSON list of {name, dtype, dims, bytes}), the JSON, the data.
#[tauri::command]
pub async fn ai_run(state: State<'_, AiState>, request: Request<'_>) -> Result<Response, String> {
    let InvokeBody::Raw(body) = request.body() else {
        return Err("données manquantes".into());
    };
    let key = header(&request, "x-key")?;
    let specs: Vec<InSpec> = serde_json::from_str(&header(&request, "x-inputs")?).map_err(|e| e.to_string())?;
    let model = state.models.lock().unwrap().get(&key).cloned().ok_or("modèle non chargé")?;
    let body = body.clone();
    tauri::async_runtime::spawn_blocking(move || run(&model, &specs, &body))
        .await
        .map_err(|e| e.to_string())?
        .map(Response::new)
}

fn run(model: &Model, specs: &[InSpec], body: &[u8]) -> Result<Vec<u8>, String> {
    let mut inputs: Vec<(String, DynValue)> = vec![];
    let mut at = 0usize;
    for s in specs {
        let n = s.dims.iter().try_fold(1usize, |a, &d| a.checked_mul(usize::try_from(d).ok()?)).ok_or("dimensions invalides")?;
        let size = match s.dtype.as_str() {
            "float32" | "int32" => 4,
            "uint8" => 1,
            "int64" => 8,
            other => return Err(format!("type d'entrée non pris en charge : {other}")),
        };
        let len = n.checked_mul(size).ok_or("entrée trop grande")?;
        let chunk = body.get(at..at.checked_add(len).ok_or("entrée trop grande")?).ok_or("entrée trop courte")?;
        at += len;
        let dims = s.dims.clone();
        let v: DynValue = match s.dtype.as_str() {
            "float32" => Tensor::from_array((dims, le::<f32, 4>(chunk, f32::from_le_bytes))).map_err(|e| e.to_string())?.into_dyn(),
            "int32" => Tensor::from_array((dims, le::<i32, 4>(chunk, i32::from_le_bytes))).map_err(|e| e.to_string())?.into_dyn(),
            "int64" => Tensor::from_array((dims, le::<i64, 8>(chunk, i64::from_le_bytes))).map_err(|e| e.to_string())?.into_dyn(),
            _ => Tensor::from_array((dims, chunk.to_vec())).map_err(|e| e.to_string())?.into_dyn(),
        };
        inputs.push((s.name.clone(), v));
    }
    let mut session = model.session.lock().unwrap();
    let outputs = session.run(inputs).map_err(|e| format!("{} : {e}", model.ep))?;
    let mut specs = vec![];
    let mut data: Vec<u8> = vec![];
    for (name, value) in outputs.iter() {
        let ty = value.dtype();
        let ValueType::Tensor { ty, .. } = ty else { continue };
        let (dims, bytes, dtype): (Vec<i64>, Vec<u8>, &'static str) = match ty {
            TensorElementType::Float32 => {
                let (sh, v) = value.try_extract_tensor::<f32>().map_err(|e| e.to_string())?;
                (sh.to_vec(), v.iter().flat_map(|x| x.to_le_bytes()).collect(), "float32")
            }
            TensorElementType::Uint8 => {
                let (sh, v) = value.try_extract_tensor::<u8>().map_err(|e| e.to_string())?;
                (sh.to_vec(), v.to_vec(), "uint8")
            }
            TensorElementType::Int64 => {
                let (sh, v) = value.try_extract_tensor::<i64>().map_err(|e| e.to_string())?;
                (sh.to_vec(), v.iter().flat_map(|x| x.to_le_bytes()).collect(), "int64")
            }
            TensorElementType::Int32 => {
                let (sh, v) = value.try_extract_tensor::<i32>().map_err(|e| e.to_string())?;
                (sh.to_vec(), v.iter().flat_map(|x| x.to_le_bytes()).collect(), "int32")
            }
            other => return Err(format!("type de sortie non pris en charge : {other:?}")),
        };
        specs.push(OutSpec { name: name.to_string(), dtype, dims, bytes: bytes.len() });
        data.extend_from_slice(&bytes);
    }
    let head = serde_json::to_vec(&specs).map_err(|e| e.to_string())?;
    let mut out = Vec::with_capacity(4 + head.len() + data.len());
    out.extend_from_slice(&(head.len() as u32).to_le_bytes());
    out.extend_from_slice(&head);
    out.extend_from_slice(&data);
    Ok(out)
}

fn le<T, const N: usize>(b: &[u8], f: fn([u8; N]) -> T) -> Vec<T> {
    b.as_chunks::<N>().0.iter().map(|c| f(*c)).collect()
}

fn header(request: &Request<'_>, name: &str) -> Result<String, String> {
    request
        .headers()
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(|v| percent_encoding::percent_decode_str(v).decode_utf8_lossy().into_owned())
        .ok_or_else(|| format!("en-tête {name} manquant"))
}

fn safe_key(k: &str) -> String {
    k.chars().map(|c| if c.is_ascii_alphanumeric() || c == '-' { c } else { '_' }).take(64).collect()
}
