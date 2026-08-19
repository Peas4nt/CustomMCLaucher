use super::hasher::compute_file_sha256;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use tokio::fs::{self, File};
use tokio::io::AsyncWriteExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestFileItem {
    pub path: String,
    pub category: String,
    pub sha256: String,
    #[serde(rename = "sizeBytes")]
    pub size_bytes: u64,
    #[serde(rename = "downloadUrl")]
    pub download_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteManifest {
    pub version: String,
    #[serde(rename = "minecraftVersion")]
    pub minecraft_version: String,
    #[serde(rename = "loaderType")]
    pub loader_type: String,
    #[serde(rename = "loaderVersion")]
    pub loader_version: String,
    #[serde(rename = "totalFiles")]
    pub total_files: usize,
    #[serde(rename = "totalSizeBytes")]
    pub total_size_bytes: u64,
    pub files: Vec<ManifestFileItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SyncedFilesState {
    /// Maps relative file path -> SHA256 recorded when launcher downloaded it from server
    pub files: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncProgressEvent {
    pub status: String,
    pub current_file: String,
    pub files_completed: usize,
    pub total_files: usize,
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    pub progress_percent: f64,
    pub speed_mbps: f64,
}

pub struct SyncManager {
    app_handle: AppHandle,
    api_base_url: String,
    game_dir: PathBuf,
}

impl SyncManager {
    pub fn new(app_handle: AppHandle, api_base_url: String, game_dir: PathBuf) -> Self {
        Self {
            app_handle,
            api_base_url,
            game_dir,
        }
    }

    fn get_synced_state_path(&self) -> PathBuf {
        self.game_dir.join(".synced_files.json")
    }

    async fn load_synced_state(&self) -> SyncedFilesState {
        let state_path = self.get_synced_state_path();
        if !state_path.exists() {
            let legacy_path = self.game_dir.join("synced_files.json");
            if legacy_path.exists() {
                if let Ok(content) = fs::read_to_string(&legacy_path).await {
                    if let Ok(state) = serde_json::from_str::<SyncedFilesState>(&content) {
                        return state;
                    }
                }
            }
            return SyncedFilesState::default();
        }

        match fs::read_to_string(&state_path).await {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => SyncedFilesState::default(),
        }
    }

    async fn save_synced_state(&self, state: &SyncedFilesState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let state_path = self.get_synced_state_path();
        let content = serde_json::to_string_pretty(state)?;
        fs::write(state_path, content).await?;
        Ok(())
    }

    /// Fetches remote manifest from server
    pub async fn fetch_remote_manifest(&self) -> Result<RemoteManifest, Box<dyn std::error::Error + Send + Sync>> {
        let client = reqwest::Client::new();
        let url = format!("{}/api/manifest", self.api_base_url.trim_end_matches('/'));
        let res = client.get(&url).send().await?.error_for_status()?;
        let manifest: RemoteManifest = res.json().await?;
        Ok(manifest)
    }

    /// Executes smart differential synchronization
    pub async fn sync_modpack(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Ensure standard Minecraft game subdirectories exist
        fs::create_dir_all(&self.game_dir).await?;
        fs::create_dir_all(self.game_dir.join("mods")).await?;
        fs::create_dir_all(self.game_dir.join("config")).await?;
        fs::create_dir_all(self.game_dir.join("shaderpacks")).await?;
        fs::create_dir_all(self.game_dir.join("resourcepacks")).await?;

        // 1. Inform client that checking phase has started
        let _ = self.app_handle.emit(
            "sync-progress",
            SyncProgressEvent {
                status: "CHECKING".to_string(),
                current_file: "Verifying files against remote manifest...".to_string(),
                files_completed: 0,
                total_files: 0,
                bytes_downloaded: 0,
                total_bytes: 0,
                progress_percent: 0.0,
                speed_mbps: 0.0,
            },
        );

        let manifest = self.fetch_remote_manifest().await?;
        let mut synced_state = self.load_synced_state().await;

        let mut files_to_download: Vec<ManifestFileItem> = Vec::new();
        let mut total_download_bytes: u64 = 0;

        // 2. Identify missing or changed files
        for item in &manifest.files {
            let local_path = self.game_dir.join(&item.path);
            let is_config = item.category == "config" || item.path.starts_with("config/");

            let need_download = if is_config {
                // CONFIG RULE: One-time initial download only!
                !local_path.exists()
            } else {
                // MODS / SHADERS / TEXTURES RULE:
                if !local_path.exists() {
                    true
                } else {
                    match compute_file_sha256(&local_path).await {
                        Ok(hash) => hash.to_lowercase() != item.sha256.to_lowercase(),
                        Err(_) => true,
                    }
                }
            };

            if need_download {
                files_to_download.push(item.clone());
                total_download_bytes += item.size_bytes;
            }
        }

        let total_download_files = files_to_download.len();
        let mut files_completed = 0;
        let mut bytes_downloaded_total: u64 = 0;
        let start_time = Instant::now();

        // 3. Immediately emit DOWNLOADING state as soon as missing files are detected
        if total_download_files > 0 {
            let _ = self.app_handle.emit(
                "sync-progress",
                SyncProgressEvent {
                    status: "DOWNLOADING".to_string(),
                    current_file: files_to_download[0].path.clone(),
                    files_completed: 0,
                    total_files: total_download_files,
                    bytes_downloaded: 0,
                    total_bytes: total_download_bytes,
                    progress_percent: 0.0,
                    speed_mbps: 0.0,
                },
            );
        }

        // 4. Download missing or updated files
        let client = reqwest::Client::new();
        for item in &files_to_download {
            let local_path = self.game_dir.join(&item.path);
            if let Some(parent) = local_path.parent() {
                fs::create_dir_all(parent).await?;
            }

            let download_url = if item.download_url.starts_with("http://") || item.download_url.starts_with("https://") {
                item.download_url.clone()
            } else {
                format!("{}{}", self.api_base_url.trim_end_matches('/'), item.download_url)
            };

            let response = client.get(&download_url).send().await?.error_for_status()?;
            let mut stream = response.bytes_stream();
            let mut file = File::create(&local_path).await?;

            while let Some(chunk_result) = stream.next().await {
                let chunk = chunk_result?;
                file.write_all(&chunk).await?;
                bytes_downloaded_total += chunk.len() as u64;

                let elapsed_secs = start_time.elapsed().as_secs_f64().max(0.001);
                let speed_mbps = (bytes_downloaded_total as f64 / (1024.0 * 1024.0)) / elapsed_secs;
                let percent = if total_download_bytes > 0 {
                    (bytes_downloaded_total as f64 / total_download_bytes as f64) * 100.0
                } else {
                    ((files_completed as f64) / (total_download_files as f64)) * 100.0
                };

                let _ = self.app_handle.emit(
                    "sync-progress",
                    SyncProgressEvent {
                        status: "DOWNLOADING".to_string(),
                        current_file: item.path.clone(),
                        files_completed,
                        total_files: total_download_files,
                        bytes_downloaded: bytes_downloaded_total,
                        total_bytes: total_download_bytes,
                        progress_percent: percent.min(100.0),
                        speed_mbps,
                    },
                );
            }

            file.flush().await?;

            // Record in synced_files state (excluding configs)
            let is_config = item.category == "config" || item.path.starts_with("config/");
            if !is_config {
                synced_state.files.insert(item.path.clone(), item.sha256.clone());
            }

            files_completed += 1;

            let elapsed_secs = start_time.elapsed().as_secs_f64().max(0.001);
            let speed_mbps = (bytes_downloaded_total as f64 / (1024.0 * 1024.0)) / elapsed_secs;
            let percent = if total_download_bytes > 0 {
                (bytes_downloaded_total as f64 / total_download_bytes as f64) * 100.0
            } else {
                ((files_completed as f64) / (total_download_files as f64)) * 100.0
            };

            let _ = self.app_handle.emit(
                "sync-progress",
                SyncProgressEvent {
                    status: "DOWNLOADING".to_string(),
                    current_file: item.path.clone(),
                    files_completed,
                    total_files: total_download_files,
                    bytes_downloaded: bytes_downloaded_total,
                    total_bytes: total_download_bytes,
                    progress_percent: percent.min(100.0),
                    speed_mbps,
                },
            );
        }

        // 5. Prune deleted server files — STRICT PRESERVATION CONTRACT
        let remote_manifest_paths: HashSet<String> = manifest.files.into_iter().map(|f| f.path).collect();
        let mut keys_to_remove: Vec<String> = Vec::new();

        for (recorded_path, _) in &synced_state.files {
            if !remote_manifest_paths.contains(recorded_path) {
                let local_path = self.game_dir.join(recorded_path);
                if local_path.exists() {
                    let _ = fs::remove_file(&local_path).await;
                    log::info!("Pruned removed server file: {}", recorded_path);
                }
                keys_to_remove.push(recorded_path.clone());
            }
        }

        for key in keys_to_remove {
            synced_state.files.remove(&key);
        }

        // 6. Save updated synced state
        self.save_synced_state(&synced_state).await?;

        // 7. Emit finished READY event
        let _ = self.app_handle.emit(
            "sync-progress",
            SyncProgressEvent {
                status: "READY".to_string(),
                current_file: "Completed".to_string(),
                files_completed: total_download_files,
                total_files: total_download_files,
                bytes_downloaded: total_download_bytes,
                total_bytes: total_download_bytes,
                progress_percent: 100.0,
                speed_mbps: 0.0,
            },
        );

        Ok(())
    }
}
