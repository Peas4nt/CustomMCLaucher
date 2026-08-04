use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub username: String,
    pub game_dir: String,
    pub java_path: String,
    pub max_ram_mb: u32,
}

impl Default for AppConfig {
    fn default() -> Self {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        let default_game_dir = home.join("JstnServer").to_string_lossy().to_string();

        Self {
            username: String::new(),
            game_dir: default_game_dir,
            java_path: "java".to_string(),
            max_ram_mb: 4096,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServerConfig {
    pub server_ip: String,
    pub server_port: u16,
    pub server_name: String,
    #[serde(default = "default_mods_server_ip")]
    pub mods_server_ip: String,
    #[serde(default = "default_mods_server_port")]
    pub mods_server_port: u16,
}

fn default_mods_server_ip() -> String {
    "10.143.197.233".to_string()
}

fn default_mods_server_port() -> u16 {
    3000
}

impl ServerConfig {
    pub fn mods_server_url(&self) -> String {
        let ip = if self.mods_server_ip.trim().is_empty() {
            &self.server_ip
        } else {
            &self.mods_server_ip
        };
        format!("http://{}:{}", ip.trim(), self.mods_server_port)
    }
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            server_ip: "10.143.197.233".to_string(),
            server_port: 25565,
            server_name: "JSTN Server".to_string(),
            mods_server_ip: "10.143.197.233".to_string(),
            mods_server_port: 3000,
        }
    }
}

pub fn get_config_path() -> PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("mc-launcher");
    let _ = fs::create_dir_all(&config_dir);
    config_dir.join("config.json")
}

pub fn load_config() -> AppConfig {
    let path = get_config_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(config) = serde_json::from_str::<AppConfig>(&content) {
                return config;
            }
        }
    }
    AppConfig::default()
}

pub fn save_config(config: &AppConfig) -> Result<(), String> {
    let path = get_config_path();
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write config file {:?}: {}", path, e))?;
    Ok(())
}

/// Load server configuration (reads developer .env file, falling back to default values)
pub fn load_server_config() -> ServerConfig {
    let mut cfg = ServerConfig::default();

    // Look for developer .env in candidate paths
    let env_paths = vec![
        PathBuf::from(".env"),
        PathBuf::from("../.env"),
        PathBuf::from("../../.env"),
    ];

    for path in env_paths {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                for line in content.lines() {
                    let line = line.trim();
                    if line.starts_with('#') || line.is_empty() {
                        continue;
                    }
                    if let Some((k, v)) = line.split_once('=') {
                        let k = k.trim();
                        let v = v.trim().trim_matches('"').trim_matches('\'');
                        match k {
                            "SERVER_IP" => {
                                if !v.is_empty() {
                                    cfg.server_ip = v.to_string();
                                }
                            }
                            "SERVER_PORT" => {
                                if let Ok(port) = v.parse::<u16>() {
                                    cfg.server_port = port;
                                }
                            }
                            "SERVER_NAME" => {
                                if !v.is_empty() {
                                    cfg.server_name = v.to_string();
                                }
                            }
                            "MODS_SERVER_IP" | "MOD_SERVER_IP" => {
                                if !v.is_empty() {
                                    cfg.mods_server_ip = v.to_string();
                                }
                            }
                            "MODS_SERVER_PORT" | "MOD_SERVER_PORT" => {
                                if let Ok(port) = v.parse::<u16>() {
                                    cfg.mods_server_port = port;
                                }
                            }
                            _ => {}
                        }
                    }
                }
                break;
            }
        }
    }

    cfg
}
