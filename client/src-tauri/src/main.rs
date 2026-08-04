// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod config;
mod installer;
mod launcher;
mod mod_sync;
mod ping;

use commands::*;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            ping_server,
            check_installation,
            install_game,
            check_mod_server,
            sync_server_mods,
            launch_game,
            is_game_running,
            kill_game,
            get_game_logs,
            open_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
