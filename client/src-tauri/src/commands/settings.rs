use crate::state::{AppState, LauncherSettings};
use std::path::PathBuf;
use std::process::Command;
use tauri::State;

#[tauri::command]
pub fn get_settings_cmd(state: State<'_, AppState>) -> Result<LauncherSettings, String> {
    let settings = state.settings.lock().map_err(|e| e.to_string())?;
    Ok(settings.clone())
}

#[tauri::command]
pub fn save_settings_cmd(
    new_settings: LauncherSettings,
    state: State<'_, AppState>,
) -> Result<(), String> {
    AppState::save_settings_to_disk(&new_settings)
        .map_err(|e| format!("Failed to save settings to disk: {}", e))?;
    let mut settings = state.settings.lock().map_err(|e| e.to_string())?;
    *settings = new_settings;
    Ok(())
}

#[tauri::command]
pub fn open_folder_cmd(folder_name: String, state: State<'_, AppState>) -> Result<(), String> {
    let base_dir = {
        let s = state.settings.lock().map_err(|e| e.to_string())?;
        s.custom_game_dir
            .clone()
            .map(PathBuf::from)
            .unwrap_or_else(AppState::get_default_game_dir)
    };

    let target_dir = match folder_name.as_str() {
        "mods" => base_dir.join("mods"),
        "config" => base_dir.join("config"),
        "shaderpacks" => base_dir.join("shaderpacks"),
        "resourcepacks" => base_dir.join("resourcepacks"),
        "screenshots" => base_dir.join("screenshots"),
        "logs" => base_dir.join("logs"),
        _ => base_dir,
    };

    let _ = std::fs::create_dir_all(&target_dir);

    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("explorer").arg(target_dir).spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("open").arg(target_dir).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("xdg-open").arg(target_dir).spawn();
    }

    Ok(())
}
