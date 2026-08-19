use crate::state::AppState;
use crate::sync::SyncManager;
use std::path::PathBuf;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn sync_modpack_cmd(
    app: AppHandle,
    api_url: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let custom_dir = {
        let s = state.settings.lock().map_err(|e| e.to_string())?;
        s.custom_game_dir.clone()
    };

    let game_dir = custom_dir
        .map(PathBuf::from)
        .unwrap_or_else(AppState::get_default_game_dir);

    let sync_manager = SyncManager::new(app, api_url, game_dir);
    sync_manager
        .sync_modpack()
        .await
        .map_err(|e| format!("Modpack synchronization failed: {}", e))?;

    Ok("Sync completed successfully".to_string())
}
