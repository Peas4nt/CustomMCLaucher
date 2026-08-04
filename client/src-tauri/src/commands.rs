use crate::config::{load_config, save_config as persist_config, AppConfig};
use crate::installer::{install_neoforge, is_installed};
use crate::launcher::{
    get_game_logs as fetch_game_logs, is_game_running as check_game_running,
    kill_game as terminate_game, launch_minecraft, GameLogLine,
};
use crate::mod_sync::{check_mod_server_health, sync_mods, SyncSummary};
use crate::ping::{ping_server_sync, ServerStatus};

#[tauri::command]
pub async fn check_mod_server() -> Result<String, String> {
    check_mod_server_health().await
}

#[tauri::command]
pub async fn sync_server_mods<R: tauri::Runtime>(
    app_handle: tauri::AppHandle<R>,
    game_dir: String,
) -> Result<SyncSummary, String> {
    sync_mods(&app_handle, &game_dir).await
}

#[tauri::command]
pub fn get_config() -> AppConfig {
    load_config()
}

#[tauri::command]
pub fn save_config(config: AppConfig) -> Result<(), String> {
    persist_config(&config)
}

#[tauri::command]
pub fn ping_server() -> ServerStatus {
    ping_server_sync()
}

#[tauri::command]
pub fn check_installation(game_dir: String) -> bool {
    is_installed(&game_dir)
}

#[tauri::command]
pub async fn install_game<R: tauri::Runtime>(
    app_handle: tauri::AppHandle<R>,
    game_dir: String,
) -> Result<String, String> {
    install_neoforge(&app_handle, &game_dir).await
}

#[tauri::command]
pub fn launch_game<R: tauri::Runtime + 'static>(
    app_handle: tauri::AppHandle<R>,
    config: AppConfig,
) -> Result<String, String> {
    launch_minecraft(app_handle, &config)
}

#[tauri::command]
pub fn is_game_running() -> bool {
    check_game_running()
}

#[tauri::command]
pub fn kill_game() -> Result<(), String> {
    terminate_game()
}

#[tauri::command]
pub fn get_game_logs(game_dir: String) -> Vec<GameLogLine> {
    fetch_game_logs(&game_dir)
}

#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    Ok(())
}
