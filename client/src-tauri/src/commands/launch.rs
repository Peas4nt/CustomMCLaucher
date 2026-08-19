use crate::downloader::{JavaResolver, ModLoaderDownloader, MojangDownloader};
use crate::launcher::{LaunchOptions, MinecraftLauncher, NbtServerWriter, ServerEntry};
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, State};
use reqwest::Client;

#[derive(Clone, serde::Serialize)]
pub struct GameExitedPayload {
    pub status: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct LaunchPayload {
    pub player_name: String,
    pub player_uuid: String,
    pub auth_token: String,
    pub minecraft_version: String,
    pub loader_type: String,
    pub loader_version: String,
    pub server_ip: Option<String>,
    pub server_port: Option<u16>,
    pub base_api_url: String, // Pass from frontend to fetch managed servers
}

#[derive(Debug, Serialize)]
pub struct LaunchResponse {
    pub success: bool,
    pub pid: u32,
    pub message: String,
}

#[tauri::command]
pub async fn launch_game_cmd(
    app: AppHandle,
    payload: LaunchPayload,
    state: State<'_, AppState>,
) -> Result<LaunchResponse, String> {
    {
        let process_lock = state.active_process.lock().map_err(|e| e.to_string())?;
        if process_lock.is_some() {
            return Err("A Minecraft instance is already running. Please close it first.".to_string());
        }
    }

    let settings = {
        let s = state.settings.lock().map_err(|e| e.to_string())?;
        s.clone()
    };

    let game_dir = settings
        .custom_game_dir
        .clone()
        .map(PathBuf::from)
        .unwrap_or_else(AppState::get_default_game_dir);

    // Fetch Backend Servers & Write NBT servers.dat
    let client = Client::new();
    let servers_res = client
        .get(format!("{}/api/servers", payload.base_api_url))
        .send()
        .await;
    
    if let Ok(resp) = servers_res {
        if let Ok(json_servers) = resp.json::<Vec<serde_json::Value>>().await {
            let mut nbt_entries = Vec::new();
            for srv in json_servers {
                if let (Some(name), Some(ip)) = (srv["name"].as_str(), srv["ipAddress"].as_str()) {
                    let port = srv["port"].as_u64().unwrap_or(25565);
                    let full_ip = if port == 25565 { ip.to_string() } else { format!("{}:{}", ip, port) };
                    nbt_entries.push(ServerEntry {
                        name: name.to_string(),
                        ip: full_ip,
                        accept_textures: Some(1), // Auto-accept resource packs
                    });
                }
            }
            if !nbt_entries.is_empty() {
                if let Err(e) = NbtServerWriter::write_servers_dat(&game_dir, &nbt_entries) {
                    log::warn!("Failed to write servers.dat NBT: {}", e);
                }
            }
        }
    }

    // 1. Resolve Java Binary
    let java_binary = JavaResolver::find_system_java(settings.java_path.as_deref())
        .ok_or_else(|| "No valid Java Runtime (JRE 17/21) found. Please configure Java in Settings.".to_string())?;

    // 2. Fetch Mojang version package & client JAR
    let mojang_downloader = MojangDownloader::new(game_dir.clone(), Some(app.clone()));
    let version_package = mojang_downloader
        .fetch_version_package(&payload.minecraft_version)
        .await
        .map_err(|e| format!("Failed to fetch Mojang version package: {}", e))?;

    let client_jar = mojang_downloader
        .download_client_jar(&version_package)
        .await
        .map_err(|e| format!("Failed to download client.jar: {}", e))?;

    // 3. Download Libraries and Extract Native DLLs/SOs
    let classpath_entries = mojang_downloader
        .download_libraries_and_extract_natives(&version_package)
        .await
        .map_err(|e| format!("Failed to download Vanilla libraries / extract natives: {}", e))?;

    // 4. Download Vanilla Assets Index & Objects
    mojang_downloader
        .download_assets(&version_package)
        .await
        .map_err(|e| format!("Failed to download Vanilla assets: {}", e))?;

    // 5. Resolve Mod Loader (Fabric, NeoForge, Forge, Vanilla)
    let loader_downloader = ModLoaderDownloader::new(game_dir.clone());
    let resolution = match payload.loader_type.to_uppercase().as_str() {
        "FABRIC" => loader_downloader
            .resolve_fabric(&payload.minecraft_version, &payload.loader_version)
            .await
            .map_err(|e| format!("Failed to resolve Fabric loader: {}", e))?,
        "NEOFORGE" => loader_downloader
            .resolve_neoforge(&payload.minecraft_version, &payload.loader_version)
            .await
            .map_err(|e| format!("Failed to resolve NeoForge loader: {}", e))?,
        "FORGE" => loader_downloader
            .resolve_forge(&payload.minecraft_version, &payload.loader_version)
            .await
            .map_err(|e| format!("Failed to resolve Forge loader: {}", e))?,
        _ => crate::downloader::ModLoaderResolution {
            main_class: version_package.main_class,
            classpath_entries: vec![],
            jvm_args: vec![],
            game_args: vec![],
        },
    };

    let mut combined_cp = resolution.classpath_entries;
    combined_cp.extend(classpath_entries);
    let classpath_entries = combined_cp;

    let mut jvm_args = vec![
        "-XX:+UseG1GC".to_string(),
        "-XX:+UnlockExperimentalVMOptions".to_string(),
        "-XX:G1NewSizePercent=20".to_string(),
        "-XX:G1ReservePercent=20".to_string(),
        "-XX:MaxGCPauseMillis=50".to_string(),
        "-XX:G1HeapRegionSize=32M".to_string(),
    ];
    jvm_args.extend(resolution.jvm_args);

    // 6. Construct launch options and launch process
    let options = LaunchOptions {
        java_binary,
        game_dir,
        minecraft_version: payload.minecraft_version,
        main_class: resolution.main_class,
        classpath_entries,
        client_jar,
        min_ram_mb: settings.min_ram_mb,
        max_ram_mb: settings.max_ram_mb,
        jvm_args,
        player_name: payload.player_name,
        player_uuid: payload.player_uuid,
        auth_token: payload.auth_token,
        server_ip: payload.server_ip,
        server_port: payload.server_port,
        window_width: settings.window_width,
        window_height: settings.window_height,
        extra_game_args: resolution.game_args,
    };

    let child = MinecraftLauncher::launch(app.clone(), options).map_err(|e| format!("Failed to launch Minecraft: {}", e))?;
    let pid = child.id();

    {
        let mut lock = state.active_process.lock().map_err(|e| e.to_string())?;
        *lock = Some(child);
    }

    // Spawn a background monitor thread to check when process exits
    let app_handle_clone = app.clone();
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_millis(1000));
            let app_state = app_handle_clone.state::<AppState>();
            let mut lock = match app_state.active_process.lock() {
                Ok(l) => l,
                Err(_) => break,
            };
            if let Some(ref mut child) = *lock {
                match child.try_wait() {
                    Ok(Some(status)) => {
                        log::info!("Minecraft process exited with status: {:?}", status);
                        *lock = None;
                        let _ = app_handle_clone.emit("game-exited", GameExitedPayload { status: status.code() });
                        break;
                    }
                    Ok(None) => {
                        // Still running
                    }
                    Err(e) => {
                        log::warn!("Error checking Minecraft process status: {}", e);
                        *lock = None;
                        let _ = app_handle_clone.emit("game-exited", GameExitedPayload { status: None });
                        break;
                    }
                }
            } else {
                // Process was terminated via kill_game_cmd
                let _ = app_handle_clone.emit("game-exited", GameExitedPayload { status: None });
                break;
            }
        }
    });

    Ok(LaunchResponse {
        success: true,
        pid,
        message: format!("Minecraft successfully launched with PID {}", pid),
    })
}

#[tauri::command]
pub async fn kill_game_cmd(state: State<'_, AppState>) -> Result<(), String> {
    let mut process_lock = state.active_process.lock().map_err(|e| e.to_string())?;
    
    if let Some(mut child) = process_lock.take() {
        if let Err(e) = child.kill() {
            log::error!("Failed to kill game process: {}", e);
            return Err(format!("Failed to kill process: {}", e));
        }
        let _ = child.wait();
        Ok(())
    } else {
        Err("No active game process found.".to_string())
    }
}

#[tauri::command]
pub async fn get_game_logs_cmd(state: State<'_, AppState>) -> Result<Vec<crate::state::GameLogEntry>, String> {
    Ok(state.get_logs())
}

#[tauri::command]
pub async fn clear_game_logs_cmd(state: State<'_, AppState>) -> Result<(), String> {
    state.clear_logs();
    Ok(())
}

#[tauri::command]
pub async fn is_game_running_cmd(state: State<'_, AppState>) -> Result<bool, String> {
    let mut lock = state.active_process.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut child) = *lock {
        match child.try_wait() {
            Ok(Some(_status)) => {
                *lock = None;
                Ok(false)
            }
            Ok(None) => Ok(true),
            Err(_) => {
                *lock = None;
                Ok(false)
            }
        }
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn check_game_downloaded_cmd(
    state: State<'_, AppState>,
    minecraft_version: Option<String>,
) -> Result<bool, String> {
    let custom_dir = {
        let s = state.settings.lock().map_err(|e| e.to_string())?;
        s.custom_game_dir.clone()
    };
    let game_dir = custom_dir
        .map(PathBuf::from)
        .unwrap_or_else(AppState::get_default_game_dir);

    // 1. Check if specific version jar exists (e.g. versions/1.21.1/1.21.1.jar or versions/client.jar)
    if let Some(ref ver) = minecraft_version {
        let ver_jar = game_dir.join("versions").join(ver).join(format!("{}.jar", ver));
        if ver_jar.exists() {
            return Ok(true);
        }
    }

    let client_jar = game_dir.join("versions").join("client.jar");
    if client_jar.exists() {
        return Ok(true);
    }

    // 2. Check if versions directory has any version jar
    let versions_dir = game_dir.join("versions");
    if versions_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&versions_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    let dir_name = p.file_name().and_then(|s| s.to_str()).unwrap_or("");
                    let jar_path = p.join(format!("{}.jar", dir_name));
                    if jar_path.exists() {
                        return Ok(true);
                    }
                } else if p.extension().and_then(|s| s.to_str()) == Some("jar") {
                    return Ok(true);
                }
            }
        }
    }

    Ok(false)
}

#[tauri::command]
pub async fn download_game_files_cmd(
    app: AppHandle,
    minecraft_version: String,
    loader_type: String,
    loader_version: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let custom_dir = {
        let s = state.settings.lock().map_err(|e| e.to_string())?;
        s.custom_game_dir.clone()
    };
    let game_dir = custom_dir
        .map(PathBuf::from)
        .unwrap_or_else(AppState::get_default_game_dir);

    let mojang_downloader = MojangDownloader::new(game_dir.clone(), Some(app.clone()));
    let version_package = mojang_downloader
        .fetch_version_package(&minecraft_version)
        .await
        .map_err(|e| format!("Failed to fetch Mojang version package: {}", e))?;

    let _client_jar = mojang_downloader
        .download_client_jar(&version_package)
        .await
        .map_err(|e| format!("Failed to download client.jar: {}", e))?;

    let _libraries = mojang_downloader
        .download_libraries_and_extract_natives(&version_package)
        .await
        .map_err(|e| format!("Failed to download libraries / extract natives: {}", e))?;

    mojang_downloader
        .download_assets(&version_package)
        .await
        .map_err(|e| format!("Failed to download assets: {}", e))?;

    let loader_downloader = ModLoaderDownloader::new(game_dir.clone());
    match loader_type.to_uppercase().as_str() {
        "FABRIC" => {
            let _ = loader_downloader
                .resolve_fabric(&minecraft_version, &loader_version)
                .await
                .map_err(|e| format!("Failed to resolve Fabric loader: {}", e))?;
        }
        "NEOFORGE" => {
            let _ = loader_downloader
                .resolve_neoforge(&minecraft_version, &loader_version)
                .await
                .map_err(|e| format!("Failed to resolve NeoForge loader: {}", e))?;
        }
        "FORGE" => {
            let _ = loader_downloader
                .resolve_forge(&minecraft_version, &loader_version)
                .await
                .map_err(|e| format!("Failed to resolve Forge loader: {}", e))?;
        }
        _ => {}
    }

    Ok("Download complete".to_string())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PlayerSample {
    pub name: String,
    pub id: Option<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ServerPingResponse {
    pub online: bool,
    pub online_players: i32,
    pub max_players: i32,
    pub motd: Option<String>,
    pub version: Option<String>,
    pub sample_players: Option<Vec<PlayerSample>>,
}

impl ServerPingResponse {
    pub fn offline() -> Self {
        Self {
            online: false,
            online_players: 0,
            max_players: 0,
            motd: None,
            version: None,
            sample_players: None,
        }
    }
}

fn write_varint(buf: &mut Vec<u8>, mut value: i32) {
    loop {
        if (value & !0x7F) == 0 {
            buf.push(value as u8);
            return;
        }
        buf.push(((value & 0x7F) | 0x80) as u8);
        value = (value as u32 >> 7) as i32;
    }
}

fn read_varint<R: std::io::Read>(reader: &mut R) -> std::io::Result<i32> {
    let mut num_read = 0;
    let mut result = 0;
    let mut byte = [0u8; 1];
    loop {
        reader.read_exact(&mut byte)?;
        let value = (byte[0] & 0x7F) as i32;
        result |= value << (7 * num_read);
        num_read += 1;
        if num_read > 5 {
            return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "VarInt too long"));
        }
        if (byte[0] & 0x80) == 0 {
            break;
        }
    }
    Ok(result)
}

#[tauri::command]
pub async fn ping_server_cmd(host: String, port: u16) -> Result<ServerPingResponse, String> {
    tokio::task::spawn_blocking(move || {
        use std::net::{TcpStream, ToSocketAddrs};
        use std::time::Duration;
        use std::io::{Read, Write};

        let addr = format!("{}:{}", host, port);
        let socket_addrs = match addr.to_socket_addrs() {
            Ok(addrs) => addrs,
            Err(_) => {
                return Ok(ServerPingResponse::offline());
            }
        };

        let mut stream = None;
        for s_addr in socket_addrs {
            if let Ok(s) = TcpStream::connect_timeout(&s_addr, Duration::from_secs(2)) {
                stream = Some(s);
                break;
            }
        }

        let mut stream = match stream {
            Some(s) => s,
            None => {
                return Ok(ServerPingResponse::offline());
            }
        };

        let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
        let _ = stream.set_write_timeout(Some(Duration::from_secs(2)));

        // Construct Handshake Packet (ID 0x00)
        let mut data = Vec::new();
        write_varint(&mut data, 0x00); // Handshake ID
        write_varint(&mut data, -1);   // Protocol Version (-1 is standard for status)
        let host_bytes = host.as_bytes();
        write_varint(&mut data, host_bytes.len() as i32);
        data.extend_from_slice(host_bytes);
        data.extend_from_slice(&port.to_be_bytes());
        write_varint(&mut data, 1);    // Next State: 1 (status)

        let mut packet = Vec::new();
        write_varint(&mut packet, data.len() as i32);
        packet.extend_from_slice(&data);

        // Status Request Packet (Length 1, ID 0x00)
        let mut request = Vec::new();
        write_varint(&mut request, 1);
        write_varint(&mut request, 0);

        if stream.write_all(&packet).is_err() || stream.write_all(&request).is_err() {
            return Ok(ServerPingResponse::offline());
        }

        // Read Response Packet Length
        let _packet_len = match read_varint(&mut stream) {
            Ok(l) => l,
            Err(_) => return Ok(ServerPingResponse::offline()),
        };
        // Read Response Packet ID
        let _packet_id = match read_varint(&mut stream) {
            Ok(id) => id,
            Err(_) => return Ok(ServerPingResponse::offline()),
        };
        // Read JSON String Length
        let str_len = match read_varint(&mut stream) {
            Ok(l) => l as usize,
            Err(_) => return Ok(ServerPingResponse::offline()),
        };

        if str_len == 0 || str_len > 1_000_000 {
            return Ok(ServerPingResponse::offline());
        }

        let mut str_bytes = vec![0u8; str_len];
        if stream.read_exact(&mut str_bytes).is_err() {
            return Ok(ServerPingResponse::offline());
        }

        let json_str = String::from_utf8_lossy(&str_bytes);
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&json_str) {
            let online_players = v.get("players").and_then(|p| p.get("online")).and_then(|n| n.as_i64()).unwrap_or(0) as i32;
            let max_players = v.get("players").and_then(|p| p.get("max")).and_then(|n| n.as_i64()).unwrap_or(20) as i32;
            let version = v.get("version").and_then(|ver| ver.get("name")).and_then(|n| n.as_str()).map(String::from);
            let sample_players = v.get("players")
                .and_then(|p| p.get("sample"))
                .and_then(|s| s.as_array())
                .map(|arr| {
                    arr.iter().filter_map(|p| {
                        let name = p.get("name").and_then(|n| n.as_str())?.to_string();
                        let id = p.get("id").and_then(|i| i.as_str()).map(String::from);
                        Some(PlayerSample { name, id })
                    }).collect()
                });

            return Ok(ServerPingResponse {
                online: true,
                online_players,
                max_players,
                motd: None,
                version,
                sample_players,
            });
        }

        Ok(ServerPingResponse {
            online: true,
            online_players: 0,
            max_players: 20,
            motd: None,
            version: None,
            sample_players: None,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
