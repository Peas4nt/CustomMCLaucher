#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod downloader;
mod launcher;
mod state;
mod sync;

use state::AppState;

fn main() {
    #[cfg(target_os = "linux")]
    {
        if std::env::var("GDK_BACKEND").is_err() {
            std::env::set_var("GDK_BACKEND", "x11,wayland");
        }
        if std::env::var("QT_QPA_PLATFORM").is_err() {
            std::env::set_var("QT_QPA_PLATFORM", "xcb;wayland");
        }
    }

    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::sync::sync_modpack_cmd,
            commands::launch::launch_game_cmd,
            commands::launch::kill_game_cmd,
            commands::launch::is_game_running_cmd,
            commands::launch::get_game_logs_cmd,
            commands::launch::clear_game_logs_cmd,
            commands::launch::check_game_downloaded_cmd,
            commands::launch::download_game_files_cmd,
            commands::launch::ping_server_cmd,
            commands::settings::get_settings_cmd,
            commands::settings::save_settings_cmd,
            commands::settings::open_folder_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running CustomMCLauncher application");
}
