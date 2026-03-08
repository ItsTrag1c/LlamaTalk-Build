use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use tauri::{AppHandle, Emitter, Manager};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

// --- Sidecar process management ---

struct Sidecar {
    child: Child,
    next_id: u64,
}

struct AppState {
    sidecar: Mutex<Option<Sidecar>>,
}

// --- Protocol types ---

#[derive(Serialize)]
struct RpcCall {
    #[serde(rename = "type")]
    msg_type: &'static str,
    id: u64,
    method: String,
    params: serde_json::Value,
}

#[derive(Serialize)]
struct RpcResolve {
    #[serde(rename = "type")]
    msg_type: &'static str,
    id: String,
    data: serde_json::Value,
}

#[derive(Deserialize, Debug)]
struct SidecarMessage {
    #[serde(rename = "type")]
    msg_type: String,
    #[serde(default)]
    id: serde_json::Value,
    #[serde(default)]
    event: String,
    #[serde(default)]
    data: serde_json::Value,
    #[serde(default)]
    message: String,
}

// --- Sidecar lifecycle ---

fn get_sidecar_name() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "llamabuild-sidecar.exe"
    }
    #[cfg(target_os = "macos")]
    {
        "llamabuild-sidecar"
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        "llamabuild-sidecar"
    }
}

fn spawn_sidecar(app: &AppHandle) -> Result<Sidecar, String> {
    // In dev: run `node sidecar/main.js` directly
    // In prod: run the compiled standalone sidecar EXE (no Node.js needed)
    let mut cmd = if cfg!(debug_assertions) {
        let manifest_dir = env!("CARGO_MANIFEST_DIR");
        let project_root = std::path::Path::new(manifest_dir)
            .parent()
            .ok_or("Failed to find project root")?;
        let script = project_root.join("sidecar").join("main.js");
        if !script.exists() {
            return Err(format!("Sidecar script not found: {}", script.display()));
        }
        let mut c = Command::new("node");
        c.arg(script.to_string_lossy().as_ref());
        c
    } else {
        // Production: the sidecar is a standalone binary bundled via externalBin.
        // Tauri places it next to the main binary with the target triple stripped.
        let sidecar_name = get_sidecar_name();
        let exe_dir = app
            .path()
            .resource_dir()
            .map_err(|e| format!("Failed to get resource dir: {}", e))?;
        let sidecar_exe = exe_dir.join(sidecar_name);

        // Fallback: try next to the main executable
        let sidecar_path = if sidecar_exe.exists() {
            sidecar_exe
        } else if let Ok(current_exe) = std::env::current_exe() {
            let beside = current_exe
                .parent()
                .unwrap_or(std::path::Path::new("."))
                .join(sidecar_name);
            if beside.exists() {
                beside
            } else {
                sidecar_exe
            }
        } else {
            sidecar_exe
        };

        Command::new(sidecar_path)
    };

    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(windows)]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    Ok(Sidecar { child, next_id: 1 })
}

fn send_to_sidecar(
    sidecar: &mut Sidecar,
    method: &str,
    params: serde_json::Value,
) -> Result<u64, String> {
    let id = sidecar.next_id;
    sidecar.next_id += 1;

    let call = RpcCall {
        msg_type: "call",
        id,
        method: method.to_string(),
        params,
    };

    let stdin = sidecar
        .child
        .stdin
        .as_mut()
        .ok_or("Sidecar stdin unavailable")?;

    let json = serde_json::to_string(&call).map_err(|e| e.to_string())?;
    writeln!(stdin, "{}", json).map_err(|e| format!("Failed to write to sidecar: {}", e))?;
    stdin
        .flush()
        .map_err(|e| format!("Failed to flush sidecar stdin: {}", e))?;

    Ok(id)
}

fn resolve_prompt(
    sidecar: &mut Sidecar,
    prompt_id: &str,
    data: serde_json::Value,
) -> Result<(), String> {
    let msg = RpcResolve {
        msg_type: "resolve",
        id: prompt_id.to_string(),
        data,
    };

    let stdin = sidecar
        .child
        .stdin
        .as_mut()
        .ok_or("Sidecar stdin unavailable")?;

    let json = serde_json::to_string(&msg).map_err(|e| e.to_string())?;
    writeln!(stdin, "{}", json).map_err(|e| e.to_string())?;
    stdin.flush().map_err(|e| e.to_string())?;

    Ok(())
}

// --- Stdout reader thread ---

fn start_stdout_reader(app: AppHandle, child_stdout: std::process::ChildStdout) {
    thread::spawn(move || {
        let reader = BufReader::new(child_stdout);
        for line in reader.lines() {
            let line = match line {
                Ok(l) => l,
                Err(_) => break,
            };
            if line.is_empty() {
                continue;
            }

            let msg: SidecarMessage = match serde_json::from_str(&line) {
                Ok(m) => m,
                Err(_) => continue,
            };

            match msg.msg_type.as_str() {
                "event" => {
                    // Forward engine events to the frontend
                    let event_name = format!("engine:{}", msg.event);
                    let _ = app.emit(&event_name, msg.data);
                }
                "result" => {
                    // Forward RPC results
                    let _ = app.emit(
                        "engine:result",
                        serde_json::json!({
                            "id": msg.id,
                            "data": msg.data,
                        }),
                    );
                }
                "prompt" => {
                    // Forward prompts (confirmation, session lock, plan complete)
                    let _ = app.emit(
                        "engine:prompt",
                        serde_json::json!({
                            "id": msg.id,
                            "event": msg.event,
                            "data": msg.data,
                        }),
                    );
                }
                "error" => {
                    let _ = app.emit(
                        "engine:error",
                        serde_json::json!({
                            "id": msg.id,
                            "message": msg.message,
                        }),
                    );
                }
                _ => {}
            }
        }
    });
}

// --- Tauri commands ---

#[tauri::command]
fn engine_call(
    method: String,
    params: serde_json::Value,
    state: tauri::State<'_, AppState>,
) -> Result<u64, String> {
    let mut guard = state.sidecar.lock().map_err(|e| e.to_string())?;
    let sidecar = guard.as_mut().ok_or("Sidecar not running")?;
    send_to_sidecar(sidecar, &method, params)
}

#[tauri::command]
fn engine_resolve(
    prompt_id: String,
    data: serde_json::Value,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut guard = state.sidecar.lock().map_err(|e| e.to_string())?;
    let sidecar = guard.as_mut().ok_or("Sidecar not running")?;
    resolve_prompt(sidecar, &prompt_id, data)
}

#[tauri::command]
fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

// --- App entry ---

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }))
        .manage(AppState {
            sidecar: Mutex::new(None),
        })
        .setup(|app| {
            let handle = app.handle().clone();

            // Spawn sidecar
            eprintln!("[tauri] Starting sidecar...");
            match spawn_sidecar(&handle) {
                Ok(mut sidecar) => {
                    eprintln!("[tauri] Sidecar spawned successfully");
                    // Take stdout for the reader thread
                    if let Some(stdout) = sidecar.child.stdout.take() {
                        start_stdout_reader(handle.clone(), stdout);
                    }
                    // Log stderr from sidecar
                    if let Some(stderr) = sidecar.child.stderr.take() {
                        thread::spawn(move || {
                            let reader = BufReader::new(stderr);
                            for line in reader.lines().map_while(Result::ok) {
                                eprintln!("[sidecar] {}", line);
                            }
                        });
                    }
                    let state: tauri::State<AppState> = handle.state();
                    *state.sidecar.lock().unwrap() = Some(sidecar);
                }
                Err(e) => {
                    eprintln!("[tauri] Failed to start sidecar: {}", e);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            engine_call,
            engine_resolve,
            get_platform,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
