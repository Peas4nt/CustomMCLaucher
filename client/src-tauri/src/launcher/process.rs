use serde::Serialize;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::thread;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Clone)]
pub struct LaunchOptions {
    pub java_binary: PathBuf,
    pub game_dir: PathBuf,
    pub minecraft_version: String,
    pub main_class: String,
    pub classpath_entries: Vec<PathBuf>,
    pub client_jar: PathBuf,
    pub min_ram_mb: u32,
    pub max_ram_mb: u32,
    pub jvm_args: Vec<String>,
    pub player_name: String,
    pub player_uuid: String,
    pub auth_token: String,
    pub server_ip: Option<String>,
    pub server_port: Option<u16>,
    pub window_width: u32,
    pub window_height: u32,
    pub extra_game_args: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct GameLogPayload {
    pub text: String,
    pub stream: String, // "stdout" | "stderr"
    pub timestamp: String,
}

pub struct MinecraftLauncher;

impl MinecraftLauncher {
    /// Constructs arguments, spawns Minecraft, streams logs to frontend via IPC, and monitors exit
    pub fn launch(
        app_handle: AppHandle,
        options: LaunchOptions,
    ) -> Result<Child, Box<dyn std::error::Error + Send + Sync>> {
        let mut cmd = Command::new(&options.java_binary);

        // Memory arguments
        cmd.arg(format!("-Xms{}M", options.min_ram_mb));
        cmd.arg(format!("-Xmx{}M", options.max_ram_mb));

        // Mandatory module open arguments for Java 16/17/21+ (NeoForge, Forge & Java internals)
        let default_add_opens = [
            "--add-opens=java.base/java.lang=ALL-UNNAMED",
            "--add-opens=java.base/java.lang.invoke=ALL-UNNAMED",
            "--add-opens=java.base/java.lang.reflect=ALL-UNNAMED",
            "--add-opens=java.base/java.io=ALL-UNNAMED",
            "--add-opens=java.base/java.net=ALL-UNNAMED",
            "--add-opens=java.base/java.nio=ALL-UNNAMED",
            "--add-opens=java.base/java.util=ALL-UNNAMED",
            "--add-opens=java.base/java.util.concurrent=ALL-UNNAMED",
            "--add-opens=java.base/java.util.concurrent.atomic=ALL-UNNAMED",
            "--add-opens=java.base/sun.net.dns=ALL-UNNAMED",
            "--add-opens=java.base/sun.security.util=ALL-UNNAMED",
            "--add-opens=java.base/sun.nio.ch=ALL-UNNAMED",
            "--add-opens=java.base/jdk.internal.misc=ALL-UNNAMED",
            "--add-exports=java.base/sun.security.util=ALL-UNNAMED",
            "--add-exports=jdk.naming.dns/com.sun.jndi.dns=java.naming",
        ];

        for flag in default_add_opens {
            cmd.arg(flag);
        }

        // JVM optimization flags
        for arg in &options.jvm_args {
            if !arg.trim().is_empty() {
                cmd.arg(arg.trim());
            }
        }

        // Native library path
        let natives_dir = options.game_dir.join("natives");
        cmd.arg(format!("-Djava.library.path={}", natives_dir.to_string_lossy()));
        cmd.arg(format!("-Dorg.lwjgl.librarypath={}", natives_dir.to_string_lossy()));

        // Classpath compilation (separated by ';' on Windows, ':' on Unix)
        let mut all_cp = options.classpath_entries.clone();
        all_cp.push(options.client_jar);

        // Deduplicate classpath entries by library artifact family while preserving loader precedence
        let mut seen_keys = std::collections::HashSet::new();
        let mut unique_cp = Vec::new();
        for p in all_cp {
            let s = p.to_string_lossy().to_lowercase().replace('\\', "/");
            let family_key = if let Some(parent) = p.parent() {
                if let Some(grandparent) = parent.parent() {
                    grandparent.to_string_lossy().to_lowercase().replace('\\', "/")
                } else {
                    s.clone()
                }
            } else {
                s.clone()
            };

            if seen_keys.insert(family_key) {
                unique_cp.push(p);
            }
        }

        let separator = if cfg!(target_os = "windows") { ";" } else { ":" };
        let cp_string: String = unique_cp
            .iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect::<Vec<String>>()
            .join(separator);

        cmd.arg("-cp").arg(cp_string);

        // Main entry class
        cmd.arg(&options.main_class);

        // Minecraft standard game arguments
        cmd.arg("--username").arg(&options.player_name);
        cmd.arg("--version").arg(&options.minecraft_version);
        cmd.arg("--gameDir").arg(options.game_dir.to_string_lossy().to_string());
        cmd.arg("--assetsDir").arg(options.game_dir.join("assets").to_string_lossy().to_string());
        cmd.arg("--assetIndex").arg(&options.minecraft_version);
        cmd.arg("--uuid").arg(&options.player_uuid);
        cmd.arg("--accessToken").arg(&options.auth_token);
        cmd.arg("--userType").arg("mojang");
        cmd.arg("--versionType").arg("CustomMCLauncher");
        cmd.arg("--width").arg(options.window_width.to_string());
        cmd.arg("--height").arg(options.window_height.to_string());

        // Extra loader game arguments
        for arg in &options.extra_game_args {
            if !arg.trim().is_empty() {
                cmd.arg(arg.trim());
            }
        }

        // Auto-connect to selected server if specified
        if let Some(ip) = &options.server_ip {
            cmd.arg("--server").arg(ip);
            if let Some(port) = options.server_port {
                cmd.arg("--port").arg(port.to_string());
            }
        }

        cmd.current_dir(&options.game_dir);

        // Pipe stdout and stderr for live console log streaming
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        log::info!("Spawning Minecraft process with command: {:?}", cmd);

        let mut child = cmd.spawn()?;
        let pid = child.id();

        log::info!("Minecraft process launched successfully with PID: {}", pid);

        // Initial launch log entry
        let app_state = app_handle.state::<crate::state::AppState>();
        app_state.clear_logs();
        let init_entry = crate::state::GameLogEntry {
            text: format!("=== Minecraft process launched with PID {} ===", pid),
            stream: "stdout".to_string(),
            timestamp: chrono_lite_timestamp(),
        };
        app_state.add_log(init_entry.clone());
        let _ = app_handle.emit("game-log", &init_entry);

        // Stream stdout in background thread
        if let Some(stdout) = child.stdout.take() {
            let handle = app_handle.clone();
            thread::spawn(move || {
                let mut reader = BufReader::new(stdout);
                let mut buf = Vec::new();
                while let Ok(n) = reader.read_until(b'\n', &mut buf) {
                    if n == 0 { break; } // EOF
                    let line = String::from_utf8_lossy(&buf).trim_end().to_string();
                    if !line.is_empty() {
                        let entry = crate::state::GameLogEntry {
                            text: line,
                            stream: "stdout".to_string(),
                            timestamp: chrono_lite_timestamp(),
                        };
                        let state = handle.state::<crate::state::AppState>();
                        state.add_log(entry.clone());
                        let _ = handle.emit("game-log", &entry);
                    }
                    buf.clear();
                }
            });
        }

        // Stream stderr in background thread
        if let Some(stderr) = child.stderr.take() {
            let handle = app_handle.clone();
            thread::spawn(move || {
                let mut reader = BufReader::new(stderr);
                let mut buf = Vec::new();
                while let Ok(n) = reader.read_until(b'\n', &mut buf) {
                    if n == 0 { break; } // EOF
                    let line = String::from_utf8_lossy(&buf).trim_end().to_string();
                    if !line.is_empty() {
                        let entry = crate::state::GameLogEntry {
                            text: line,
                            stream: "stderr".to_string(),
                            timestamp: chrono_lite_timestamp(),
                        };
                        let state = handle.state::<crate::state::AppState>();
                        state.add_log(entry.clone());
                        let _ = handle.emit("game-log", &entry);
                    }
                    buf.clear();
                }
            });
        }

        // Background watcher for .minecraft/logs/latest.log
        let handle_latest = app_handle.clone();
        let latest_log_path = options.game_dir.join("logs").join("latest.log");
        thread::spawn(move || {
            use std::fs::File;
            // Wait up to 1.5 seconds for latest.log to be created/truncated
            thread::sleep(std::time::Duration::from_millis(1500));
            
            let file = match File::open(&latest_log_path) {
                Ok(f) => f,
                Err(_) => return,
            };
            
            let mut reader = BufReader::new(file);
            let mut buf = Vec::new();
            
            loop {
                // Check if active process is still alive
                let is_alive = handle_latest
                    .state::<crate::state::AppState>()
                    .active_process
                    .lock()
                    .map(|p| p.is_some())
                    .unwrap_or(false);

                while let Ok(n) = reader.read_until(b'\n', &mut buf) {
                    if n == 0 { break; }
                    let line = String::from_utf8_lossy(&buf).trim_end().to_string();
                    if !line.is_empty() {
                        let entry = crate::state::GameLogEntry {
                            text: line,
                            stream: "stdout".to_string(),
                            timestamp: chrono_lite_timestamp(),
                        };
                        let state = handle_latest.state::<crate::state::AppState>();
                        state.add_log(entry.clone());
                        let _ = handle_latest.emit("game-log", &entry);
                    }
                    buf.clear();
                }

                if !is_alive {
                    break;
                }
                thread::sleep(std::time::Duration::from_millis(300));
            }
        });

        Ok(child)
    }
}

pub fn chrono_lite_timestamp() -> String {
    use std::time::SystemTime;
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs() % 86400;
    let hours = secs / 3600;
    let mins = (secs % 3600) / 60;
    let seconds = secs % 60;
    format!("{:02}:{:02}:{:02}", hours, mins, seconds)
}
