use crate::config::{load_server_config, AppConfig};
use crate::installer::{
    ensure_game_directories, extract_natives, is_rule_allowed_for_os, maven_coordinate_to_path,
};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use uuid::Uuid;

static ACTIVE_PID: Mutex<Option<u32>> = Mutex::new(None);

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct GameLogLine {
    pub id: usize,
    pub level: String,
    pub msg: String,
}

pub fn classify_log_level(msg: &str) -> &'static str {
    if msg.contains("/ERROR]")
        || msg.contains("/FATAL]")
        || msg.contains("Exception")
        || msg.contains("Error:")
        || msg.contains("SEVERE")
    {
        "error"
    } else if msg.contains("/WARN]")
        || msg.contains("[WARN]")
        || msg.contains("WARNING")
        || msg.contains("WARN ")
    {
        "warn"
    } else {
        "info"
    }
}

pub fn is_game_running() -> bool {
    let pid_opt = {
        let guard = ACTIVE_PID.lock().unwrap();
        *guard
    };
    match pid_opt {
        Some(pid) => {
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                let mut cmd = Command::new("tasklist");
                cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
                cmd.args(["/FI", &format!("PID eq {}", pid), "/NH"]);
                if let Ok(out) = cmd.output() {
                    let s = String::from_utf8_lossy(&out.stdout);
                    if s.contains(&pid.to_string()) {
                        return true;
                    }
                }
                let mut guard = ACTIVE_PID.lock().unwrap();
                *guard = None;
                false
            }
            #[cfg(not(target_os = "windows"))]
            {
                let res = Command::new("kill")
                    .args(["-0", &pid.to_string()])
                    .output();
                if let Ok(out) = res {
                    if out.status.success() {
                        return true;
                    }
                }
                let mut guard = ACTIVE_PID.lock().unwrap();
                *guard = None;
                false
            }
        }
        None => false,
    }
}

pub fn kill_game() -> Result<(), String> {
    let pid_opt = {
        let mut guard = ACTIVE_PID.lock().unwrap();
        guard.take()
    };

    if let Some(pid) = pid_opt {
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            let mut cmd = Command::new("taskkill");
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
            cmd.args(["/F", "/T", "/PID", &pid.to_string()]);
            let _ = cmd.output();
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = Command::new("kill")
                .args(["-9", &pid.to_string()])
                .output();
        }
    }
    Ok(())
}

pub fn get_game_logs(game_dir: &str) -> Vec<GameLogLine> {
    let log_path = PathBuf::from(game_dir).join("logs").join("latest.log");
    if !log_path.exists() {
        return Vec::new();
    }

    if let Ok(content) = fs::read_to_string(&log_path) {
        content
            .lines()
            .enumerate()
            .map(|(idx, line)| {
                let trimmed = line.trim().to_string();
                let level = classify_log_level(&trimmed).to_string();
                GameLogLine {
                    id: idx + 1,
                    level,
                    msg: trimmed,
                }
            })
            .collect()
    } else {
        Vec::new()
    }
}

pub fn generate_offline_uuid(username: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(format!("OfflinePlayer:{}", username).as_bytes());
    let hash = hasher.finalize();
    let uuid = Uuid::from_slice(&hash[..16]).unwrap_or_else(|_| Uuid::new_v4());
    uuid.to_string()
}

/// Resolved version metadata collected from version JSON chain.
#[derive(Debug, Default)]
struct VersionChainInfo {
    main_class: String,
    asset_index: String,
    jvm_args: Vec<String>,
    game_args: Vec<String>,
    base_mc_version: String,
    libraries: Vec<String>,
    is_modded: bool,
}

/// Resolve the full version chain (neoforge → base → ...) and return merged info.
fn resolve_version_chain(
    versions_dir: &Path,
    libraries_dir: &Path,
    start_version: &str,
) -> VersionChainInfo {
    let mut info = VersionChainInfo::default();
    let mut current = start_version.to_string();
    let mut depth = 0;

    loop {
        depth += 1;
        if depth > 10 {
            break;
        }

        let json_path = versions_dir
            .join(&current)
            .join(format!("{}.json", current));

        let content = match fs::read_to_string(&json_path) {
            Ok(c) => c,
            Err(e) => {
                eprintln!("[launcher] Cannot read {:?}: {}", json_path, e);
                break;
            }
        };

        let parsed: serde_json::Value = match serde_json::from_str(&content) {
            Ok(v) => v,
            Err(e) => {
                eprintln!("[launcher] Cannot parse {:?}: {}", json_path, e);
                break;
            }
        };

        if info.main_class.is_empty() {
            if let Some(mc) = parsed["mainClass"].as_str() {
                info.main_class = mc.to_string();
            }
        }

        if info.asset_index.is_empty() {
            if let Some(ai) = parsed["assetIndex"]["id"].as_str() {
                info.asset_index = ai.to_string();
            } else if let Some(a) = parsed["assets"].as_str() {
                if !a.is_empty() {
                    info.asset_index = a.to_string();
                }
            }
        }

        if let Some(args) = parsed["arguments"]["jvm"].as_array() {
            for arg in args {
                if let Some(s) = arg.as_str() {
                    info.jvm_args.push(s.to_string());
                } else if let Some(obj) = arg.as_object() {
                    let rules = obj.get("rules").and_then(|r| r.as_array());
                    if is_rule_allowed_for_os(rules) {
                        if let Some(vals) = obj.get("value") {
                            if let Some(s) = vals.as_str() {
                                info.jvm_args.push(s.to_string());
                            } else if let Some(arr) = vals.as_array() {
                                for v in arr {
                                    if let Some(s) = v.as_str() {
                                        info.jvm_args.push(s.to_string());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        if let Some(args) = parsed["arguments"]["game"].as_array() {
            for arg in args {
                if let Some(s) = arg.as_str() {
                    info.game_args.push(s.to_string());
                }
            }
        }

        if info.game_args.is_empty() {
            if let Some(old_args) = parsed["minecraftArguments"].as_str() {
                for token in old_args.split_whitespace() {
                    info.game_args.push(token.to_string());
                }
            }
        }

        if let Some(libs) = parsed["libraries"].as_array() {
            for lib in libs {
                let rules = lib["rules"].as_array();
                if !is_rule_allowed_for_os(rules) {
                    continue;
                }

                let mut rel_path: Option<String> = None;

                if let Some(artifact) = lib.get("downloads").and_then(|d| d.get("artifact")) {
                    if let Some(p) = artifact["path"].as_str() {
                        rel_path = Some(p.to_string());
                    }
                }

                if rel_path.is_none() {
                    if let Some(name) = lib["name"].as_str() {
                        rel_path = maven_coordinate_to_path(name);
                    }
                }

                if let Some(rel) = rel_path {
                    let full_path = libraries_dir.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR));
                    if full_path.exists() {
                        let full_str = full_path.to_string_lossy().to_string();
                        if !info.libraries.contains(&full_str) {
                            info.libraries.push(full_str);
                        }
                    }
                }
            }
        }

        match parsed["inheritsFrom"].as_str() {
            Some(parent) if !parent.is_empty() => {
                info.is_modded = true;
                current = parent.to_string();
            }
            _ => {
                if info.base_mc_version.is_empty() {
                    info.base_mc_version = current.clone();
                }
                break;
            }
        }
    }

    if info.main_class.is_empty() {
        info.main_class = "net.minecraft.client.main.Main".to_string();
    }
    if info.asset_index.is_empty() {
        info.asset_index = "17".to_string();
    }
    if info.base_mc_version.is_empty() {
        info.base_mc_version = "1.21.1".to_string();
    }

    info
}

pub fn ensure_servers_dat(game_dir: &Path) -> std::io::Result<()> {
    let server_cfg = load_server_config();
    let server_ip = server_cfg.server_ip;
    let server_port = server_cfg.server_port;
    let server_name = server_cfg.server_name;

    let servers_path = game_dir.join("servers.dat");
    if servers_path.exists() {
        if let Ok(bytes) = fs::read(&servers_path) {
            let ip_bytes = server_ip.as_bytes();
            if bytes.windows(ip_bytes.len()).any(|w| w == ip_bytes) {
                return Ok(());
            }
        }
    }

    let mut nbt: Vec<u8> = Vec::new();

    // 1. Root TAG_Compound (0x0A), name ""
    nbt.push(0x0A);
    nbt.extend_from_slice(&[0x00, 0x00]);

    // 2. TAG_List (0x09), name "servers"
    nbt.push(0x09);
    let list_name = b"servers";
    nbt.extend_from_slice(&(list_name.len() as u16).to_be_bytes());
    nbt.extend_from_slice(list_name);

    // List payload: Element type TAG_Compound (0x0A), count 1 (i32)
    nbt.push(0x0A);
    nbt.extend_from_slice(&1i32.to_be_bytes());

    // Inside Server Compound #1:
    // a. "name" TAG_String (0x08)
    nbt.push(0x08);
    let tag_name = b"name";
    nbt.extend_from_slice(&(tag_name.len() as u16).to_be_bytes());
    nbt.extend_from_slice(tag_name);
    let s_name_bytes = server_name.as_bytes();
    nbt.extend_from_slice(&(s_name_bytes.len() as u16).to_be_bytes());
    nbt.extend_from_slice(s_name_bytes);

    // b. "ip" TAG_String (0x08)
    nbt.push(0x08);
    let tag_ip = b"ip";
    nbt.extend_from_slice(&(tag_ip.len() as u16).to_be_bytes());
    nbt.extend_from_slice(tag_ip);
    let s_ip = format!("{}:{}", server_ip, server_port);
    let s_ip_bytes = s_ip.as_bytes();
    nbt.extend_from_slice(&(s_ip_bytes.len() as u16).to_be_bytes());
    nbt.extend_from_slice(s_ip_bytes);

    // c. "acceptTextures" TAG_Byte (0x01)
    nbt.push(0x01);
    let tag_at = b"acceptTextures";
    nbt.extend_from_slice(&(tag_at.len() as u16).to_be_bytes());
    nbt.extend_from_slice(tag_at);
    nbt.push(0x01);

    // d. "hidden" TAG_Byte (0x01)
    nbt.push(0x01);
    let tag_hid = b"hidden";
    nbt.extend_from_slice(&(tag_hid.len() as u16).to_be_bytes());
    nbt.extend_from_slice(tag_hid);
    nbt.push(0x00);

    // End of Server Compound
    nbt.push(0x00);

    // End of Root Compound
    nbt.push(0x00);

    fs::write(&servers_path, nbt)
}

pub fn launch_minecraft<R: tauri::Runtime + 'static>(
    app_handle: tauri::AppHandle<R>,
    config: &AppConfig,
) -> Result<String, String> {
    if is_game_running() {
        return Err("Minecraft is already running!".to_string());
    }

    let game_dir = PathBuf::from(&config.game_dir);
    if !game_dir.exists() {
        return Err(format!(
            "Game directory does not exist: {:?}\nPlease check the path in Settings.",
            game_dir
        ));
    }

    ensure_game_directories(&game_dir);
    let _ = extract_natives(&game_dir);
    let _ = ensure_servers_dat(&game_dir);

    let versions_dir = game_dir.join("versions");
    if !versions_dir.exists() {
        return Err(format!(
            "versions/ not found inside {:?}\nPlease install the game first.",
            game_dir
        ));
    }

    let mut modded_version_dir: Option<PathBuf> = None;
    if let Ok(entries) = fs::read_dir(&versions_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string().to_lowercase();
            if name.contains("forge") || name.contains("neoforge") {
                modded_version_dir = Some(entry.path());
                break;
            }
        }
    }

    let version_dir = modded_version_dir.ok_or_else(|| {
        "Forge/NeoForge version directory not found. Please install the game first.".to_string()
    })?;

    let version_name = version_dir
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();

    let libraries_dir = game_dir.join("libraries");
    if !libraries_dir.exists() {
        return Err(format!(
            "libraries/ directory not found inside {:?}\nPlease reinstall the game.",
            game_dir
        ));
    }

    eprintln!("[launcher] Found version: {}", version_name);

    let chain_info = resolve_version_chain(&versions_dir, &libraries_dir, &version_name);
    let mut classpath_items = chain_info.libraries;

    if !chain_info.is_modded {
        let vanilla_jar = versions_dir
            .join(&chain_info.base_mc_version)
            .join(format!("{}.jar", chain_info.base_mc_version));
        if vanilla_jar.exists() {
            classpath_items.push(vanilla_jar.to_string_lossy().to_string());
        }
    }

    if classpath_items.is_empty() {
        return Err("Classpath is empty — no libraries found. Please reinstall the game.".to_string());
    }

    let classpath_separator = if cfg!(windows) { ";" } else { ":" };
    let classpath = classpath_items.join(classpath_separator);

    let java_cmd = if config.java_path.trim().is_empty() {
        "java".to_string()
    } else {
        config.java_path.trim().to_string()
    };

    let uuid = generate_offline_uuid(&config.username);
    let max_ram = format!("-Xmx{}M", config.max_ram_mb);
    let min_ram = "-Xms512M".to_string();
    let libraries_dir_str = libraries_dir.to_string_lossy().to_string();
    let natives_dir = game_dir.join("natives");
    let natives_dir_str = natives_dir.to_string_lossy().to_string();
    let assets_dir = game_dir.join("assets");
    let game_dir_str = game_dir.to_string_lossy().to_string();

    let mut cmd = Command::new(&java_cmd);

    cmd.arg(&max_ram);
    cmd.arg(&min_ram);
    cmd.arg("-XX:+UnlockExperimentalVMOptions");
    cmd.arg("-XX:+UseG1GC");
    cmd.arg("-XX:G1NewSizePercent=20");
    cmd.arg("-XX:G1ReservePercent=20");
    cmd.arg("-XX:MaxGCPauseMillis=50");
    cmd.arg("-XX:G1HeapRegionSize=32M");
    cmd.arg("-Dfile.encoding=UTF-8");

    cmd.arg(format!("-Djava.library.path={}", natives_dir_str));
    cmd.arg(format!("-Dorg.lwjgl.librarypath={}", natives_dir_str));
    cmd.arg(format!("-Dorg.lwjgl.system.SharedLibraryExtractPath={}", natives_dir_str));
    cmd.arg(format!("-Dio.netty.native.workdir={}", natives_dir_str));

    let mut jvm_already_has_cp = false;

    for arg in &chain_info.jvm_args {
        let resolved = substitute_placeholders(
            arg,
            &libraries_dir_str,
            &natives_dir_str,
            &game_dir_str,
            &classpath,
            &version_name,
        );

        if resolved == "-cp" || resolved == "-classpath" {
            jvm_already_has_cp = true;
        }

        if resolved.contains("${") {
            continue;
        }
        if resolved.is_empty() {
            continue;
        }

        #[cfg(not(target_os = "macos"))]
        if resolved == "-XstartOnFirstThread" {
            continue;
        }

        cmd.arg(&resolved);
    }

    if !jvm_already_has_cp {
        cmd.arg("-cp").arg(&classpath);
    }

    cmd.arg(&chain_info.main_class);

    let has_template_args = !chain_info.game_args.is_empty();
    if has_template_args {
        for arg in &chain_info.game_args {
            let resolved = arg
                .replace("${auth_player_name}", &config.username)
                .replace("${version_name}", &version_name)
                .replace("${game_directory}", &game_dir_str)
                .replace("${assets_root}", &assets_dir.to_string_lossy())
                .replace("${assets_index_name}", &chain_info.asset_index)
                .replace("${auth_uuid}", &uuid)
                .replace("${auth_access_token}", "0")
                .replace("${user_type}", "legacy")
                .replace("${version_type}", "release")
                .replace("${user_properties}", "{}")
                .replace("${clientid}", "0")
                .replace("${auth_xuid}", "0")
                .replace("${auth_session}", "token:0");

            if !resolved.contains("${") && !resolved.is_empty() {
                cmd.arg(&resolved);
            }
        }
    } else {
        cmd.arg("--username").arg(&config.username);
        cmd.arg("--version").arg(&version_name);
        cmd.arg("--gameDir").arg(&game_dir_str);
        cmd.arg("--assetsDir").arg(assets_dir.to_string_lossy().as_ref());
        cmd.arg("--assetIndex").arg(&chain_info.asset_index);
        cmd.arg("--uuid").arg(&uuid);
        cmd.arg("--accessToken").arg("0");
        cmd.arg("--userType").arg("legacy");
        cmd.arg("--versionType").arg("release");
    }

    let server_cfg = load_server_config();
    cmd.arg("--server").arg(&server_cfg.server_ip);
    cmd.arg("--port").arg(server_cfg.server_port.to_string());
    cmd.current_dir(&game_dir);

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x00000200); // CREATE_NEW_PROCESS_GROUP
    }

    eprintln!("[launcher] Spawning Minecraft: {} {:?}", java_cmd, cmd);

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn Java process: {}\n\nMake sure Java 21 is installed and the path '{}' is correct.", e, java_cmd))?;

    let pid = child.id();
    {
        let mut guard = ACTIVE_PID.lock().unwrap();
        *guard = Some(pid);
    }

    let _ = app_handle.emit("game:started", serde_json::json!({ "pid": pid }));
    let _ = app_handle.emit("game:log", serde_json::json!({
        "level": "info",
        "msg": format!("=== Minecraft process started (PID: {}) ===", pid)
    }));

    let app_stopped = app_handle.clone();
    let is_running = Arc::new(AtomicBool::new(true));

    // 1. Stdout listener
    if let Some(stdout) = child.stdout.take() {
        let app_stdout = app_handle.clone();
        let running_stdout = is_running.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if !running_stdout.load(Ordering::Relaxed) {
                    break;
                }
                if let Ok(l) = line {
                    let trimmed = l.trim().to_string();
                    if !trimmed.is_empty() {
                        let level = classify_log_level(&trimmed);
                        let _ = app_stdout.emit("game:log", serde_json::json!({ "level": level, "msg": trimmed }));
                    }
                }
            }
        });
    }

    // 2. Stderr listener
    if let Some(stderr) = child.stderr.take() {
        let app_stderr = app_handle.clone();
        let running_stderr = is_running.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if !running_stderr.load(Ordering::Relaxed) {
                    break;
                }
                if let Ok(l) = line {
                    let trimmed = l.trim().to_string();
                    if !trimmed.is_empty() {
                        let level = classify_log_level(&trimmed);
                        let _ = app_stderr.emit("game:log", serde_json::json!({ "level": level, "msg": trimmed }));
                    }
                }
            }
        });
    }

    // 3. latest.log file tailer with continuous line reading
    let log_file_path = game_dir.join("logs").join("latest.log");
    let app_log_tail = app_handle.clone();
    let running_log = is_running.clone();
    std::thread::spawn(move || {
        let mut last_pos = 0u64;

        while running_log.load(Ordering::Relaxed) {
            if log_file_path.exists() {
                if let Ok(mut file) = fs::File::open(&log_file_path) {
                    let current_len = file.metadata().map(|m| m.len()).unwrap_or(0);
                    if current_len < last_pos {
                        last_pos = 0;
                    }
                    if current_len > last_pos {
                        if file.seek(SeekFrom::Start(last_pos)).is_ok() {
                            let mut reader = BufReader::new(&mut file);
                            let mut line_buf = String::new();
                            while let Ok(bytes) = reader.read_line(&mut line_buf) {
                                if bytes == 0 {
                                    break;
                                }
                                let trimmed = line_buf.trim().to_string();
                                if !trimmed.is_empty() {
                                    let level = classify_log_level(&trimmed);
                                    let _ = app_log_tail.emit(
                                        "game:log",
                                        serde_json::json!({ "level": level, "msg": trimmed }),
                                    );
                                }
                                line_buf.clear();
                            }
                            last_pos = file.stream_position().unwrap_or(current_len);
                        }
                    }
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(80));
        }
    });

    // 4. Process supervisor thread (detects process exit)
    std::thread::spawn(move || {
        let exit_status = child.wait();
        is_running.store(false, Ordering::Relaxed);
        {
            let mut guard = ACTIVE_PID.lock().unwrap();
            *guard = None;
        }
        let code = exit_status.ok().and_then(|s| s.code()).unwrap_or(0);
        eprintln!("[launcher] Minecraft process exited with code: {}", code);
        let _ = app_stopped.emit("game:log", serde_json::json!({
            "level": if code == 0 { "info" } else { "error" },
            "msg": format!("--- Minecraft process exited (code {}) ---", code)
        }));
        let _ = app_stopped.emit("game:stopped", serde_json::json!({ "exit_code": code }));
    });

    Ok(format!(
        "Launched {} as {} — PID: {}",
        version_name, config.username, pid
    ))
}

fn substitute_placeholders(
    arg: &str,
    libraries_dir: &str,
    natives_dir: &str,
    game_dir: &str,
    classpath: &str,
    version: &str,
) -> String {
    let cp_sep = if cfg!(windows) { ";" } else { ":" };
    arg.replace("${classpath_separator}", cp_sep)
        .replace("${library_directory}", libraries_dir)
        .replace("${libraries_directory}", libraries_dir)
        .replace("${natives_directory}", natives_dir)
        .replace("${launcher_name}", "mc-launcher")
        .replace("${launcher_version}", "0.6.0")
        .replace("${game_directory}", game_dir)
        .replace("${classpath}", classpath)
        .replace("${version_name}", version)
        .replace("${primary_jar}", &format!("{}.jar", version))
}
