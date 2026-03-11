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
        "clankbuild-sidecar.exe"
    }
    #[cfg(target_os = "macos")]
    {
        "clankbuild-sidecar"
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        "clankbuild-sidecar"
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

#[tauri::command]
fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
async fn check_for_desktop_update(
    app: AppHandle,
) -> Result<serde_json::Value, String> {
    let current = app.package_info().version.to_string();

    let client = reqwest::Client::builder()
        .user_agent("Clank-Build-Desktop")
        .build()
        .map_err(|e| e.to_string())?;

    // Fetch releases and find the latest desktop release (tag: desktop-vX.Y.Z)
    let releases: Vec<serde_json::Value> = client
        .get("https://api.github.com/repos/ItsTrag1c/Clank-Build/releases")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    for release in &releases {
        let tag = release["tag_name"].as_str().unwrap_or("");
        if !tag.starts_with("desktop-v") {
            continue;
        }
        let remote_version = tag.trim_start_matches("desktop-v");

        // Simple semver comparison
        let is_newer = semver_newer(remote_version, &current);
        if !is_newer {
            break;
        }

        // Find the NSIS installer asset
        if let Some(assets) = release["assets"].as_array() {
            for asset in assets {
                let name = asset["name"].as_str().unwrap_or("");
                if name.contains("x64-setup") && name.ends_with(".exe") {
                    return Ok(serde_json::json!({
                        "available": true,
                        "version": remote_version,
                        "download_url": asset["browser_download_url"],
                        "asset_name": name,
                    }));
                }
            }
        }
        break;
    }

    Ok(serde_json::json!({
        "available": false,
        "version": current,
    }))
}

fn semver_newer(remote: &str, current: &str) -> bool {
    let parse = |s: &str| -> (u32, u32, u32) {
        let parts: Vec<u32> = s.split('.').filter_map(|p| p.parse().ok()).collect();
        (
            *parts.first().unwrap_or(&0),
            *parts.get(1).unwrap_or(&0),
            *parts.get(2).unwrap_or(&0),
        )
    };
    parse(remote) > parse(current)
}

#[tauri::command]
async fn download_and_install_update(
    app: AppHandle,
    download_url: String,
    asset_name: String,
) -> Result<(), String> {
    use futures_util::StreamExt;
    use tokio::io::AsyncWriteExt;

    // Security: Validate download URL is from our GitHub releases only
    if !download_url.starts_with("https://github.com/ItsTrag1c/Clank-Build/releases/download/") {
        return Err("Invalid download URL: must be from official GitHub releases".to_string());
    }

    // Security: Validate asset_name has no path traversal
    if asset_name.contains("..") || asset_name.contains('/') || asset_name.contains('\\') {
        return Err("Invalid asset name".to_string());
    }
    // Also ensure it's a plausible installer filename
    if !asset_name.ends_with(".exe") && !asset_name.ends_with(".msi") {
        return Err("Invalid asset type".to_string());
    }

    let client = reqwest::Client::builder()
        .user_agent("Clank-Build-Desktop")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let total = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;

    let temp_path = std::env::temp_dir().join(&asset_name);
    let mut file = tokio::fs::File::create(&temp_path)
        .await
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Failed to write: {}", e))?;
        downloaded += chunk.len() as u64;

        if total > 0 {
            let _ = app.emit(
                "update:download-progress",
                serde_json::json!({
                    "downloaded": downloaded,
                    "total": total,
                }),
            );
        }
    }

    file.flush().await.map_err(|e| e.to_string())?;
    drop(file);

    // Launch the NSIS installer
    let mut cmd = Command::new(&temp_path);
    #[cfg(windows)]
    cmd.creation_flags(0); // Allow the installer window to show
    cmd.spawn()
        .map_err(|e| format!("Failed to launch installer: {}", e))?;

    // Exit the app so the installer can replace files
    app.exit(0);
    Ok(())
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
            get_app_version,
            check_for_desktop_update,
            download_and_install_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
