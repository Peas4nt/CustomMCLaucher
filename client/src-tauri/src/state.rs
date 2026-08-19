use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Child;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherSettings {
    pub min_ram_mb: u32,
    pub max_ram_mb: u32,
    pub java_path: Option<String>,
    pub custom_game_dir: Option<String>,
    pub window_width: u32,
    pub window_height: u32,
    pub close_after_launch: bool,
    pub remote_server_url: Option<String>,
}

impl Default for LauncherSettings {
    fn default() -> Self {
        Self {
            min_ram_mb: 2048,
            max_ram_mb: 4096,
            java_path: None,
            custom_game_dir: None,
            window_width: 1280,
            window_height: 720,
            close_after_launch: false,
            remote_server_url: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameLogEntry {
    pub text: String,
    pub stream: String, // "stdout" | "stderr" | "game"
    pub timestamp: String,
}

pub struct AppState {
    pub settings: Mutex<LauncherSettings>,
    pub active_process: Mutex<Option<Child>>,
    pub logs: Mutex<Vec<GameLogEntry>>,
}

impl AppState {
    pub fn new() -> Self {
        let base_dir = Self::get_base_dir();
        let game_dir = Self::get_default_game_dir();
        let _ = std::fs::create_dir_all(&base_dir);
        let _ = std::fs::create_dir_all(&game_dir);

        let initial_settings = Self::load_settings_from_disk();

        Self {
            settings: Mutex::new(initial_settings),
            active_process: Mutex::new(None),
            logs: Mutex::new(Vec::with_capacity(1000)),
        }
    }

    pub fn get_settings_path() -> PathBuf {
        Self::get_base_dir().join("settings.json")
    }

    pub fn load_settings_from_disk() -> LauncherSettings {
        let path = Self::get_settings_path();
        if path.exists() {
            if let Ok(content) = std::fs::read_to_string(&path) {
                if let Ok(settings) = serde_json::from_str::<LauncherSettings>(&content) {
                    return settings;
                }
            }
        }
        LauncherSettings::default()
    }

    pub fn save_settings_to_disk(settings: &LauncherSettings) -> Result<(), std::io::Error> {
        let path = Self::get_settings_path();
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let json = serde_json::to_string_pretty(settings)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        std::fs::write(path, json)?;
        Ok(())
    }

    pub fn add_log(&self, entry: GameLogEntry) {
        if let Ok(mut logs) = self.logs.lock() {
            if logs.len() >= 2000 {
                logs.remove(0);
            }
            logs.push(entry);
        }
    }

    pub fn get_logs(&self) -> Vec<GameLogEntry> {
        self.logs.lock().map(|l| l.clone()).unwrap_or_default()
    }

    pub fn clear_logs(&self) {
        if let Ok(mut logs) = self.logs.lock() {
            logs.clear();
        }
    }

    /// Base launcher configuration directory
    /// Windows: %APPDATA%\CustomMCLauncher
    /// Linux: ~/.local/share/CustomMCLauncher
    /// macOS: ~/Library/Application Support/CustomMCLauncher
    pub fn get_base_dir() -> PathBuf {
        #[cfg(target_os = "windows")]
        {
            if let Some(app_data) = std::env::var_os("APPDATA") {
                return PathBuf::from(app_data).join("CustomMCLauncher");
            }
        }

        #[cfg(target_os = "macos")]
        {
            if let Some(home) = dirs::home_dir() {
                return home.join("Library").join("Application Support").join("CustomMCLauncher");
            }
        }

        #[cfg(target_os = "linux")]
        {
            if let Some(xdg) = std::env::var_os("XDG_DATA_HOME") {
                return PathBuf::from(xdg).join("CustomMCLauncher");
            }
            if let Some(home) = dirs::home_dir() {
                return home.join(".local").join("share").join("CustomMCLauncher");
            }
        }

        dirs::data_dir()
            .map(|p| p.join("CustomMCLauncher"))
            .unwrap_or_else(|| PathBuf::from(".custom_mc_launcher"))
    }

    /// Game instances, assets, mods, and libraries directory
    /// Windows: %APPDATA%\CustomMCLauncher\.minecraft
    pub fn get_default_game_dir() -> PathBuf {
        Self::get_base_dir().join(".minecraft")
    }
}
