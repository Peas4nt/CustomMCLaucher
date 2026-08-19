use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Cursor;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};
use tokio::fs::{self, File};
use tokio::io::AsyncWriteExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionManifestV2 {
    pub latest: LatestVersions,
    pub versions: Vec<VersionSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatestVersions {
    pub release: String,
    pub snapshot: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionSummary {
    pub id: String,
    #[serde(rename = "type")]
    pub version_type: String,
    pub url: String,
    pub time: String,
    #[serde(rename = "releaseTime")]
    pub release_time: String,
    pub sha1: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionPackage {
    pub id: String,
    #[serde(rename = "mainClass")]
    pub main_class: String,
    #[serde(rename = "minecraftArguments")]
    pub minecraft_arguments: Option<String>,
    pub arguments: Option<VersionArguments>,
    #[serde(rename = "assetIndex")]
    pub asset_index: AssetIndexRef,
    pub downloads: DownloadsSection,
    pub libraries: Vec<LibraryEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetIndexRef {
    pub id: String,
    pub sha1: String,
    pub size: u64,
    #[serde(rename = "totalSize")]
    pub total_size: u64,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetIndexPackage {
    pub objects: HashMap<String, AssetObject>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetObject {
    pub hash: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadsSection {
    pub client: DownloadFile,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadFile {
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionArguments {
    pub game: Option<Vec<serde_json::Value>>,
    pub jvm: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryEntry {
    pub name: String,
    pub downloads: Option<LibraryDownloads>,
    pub natives: Option<HashMap<String, String>>,
    pub rules: Option<Vec<RuleEntry>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryDownloads {
    pub artifact: Option<DownloadFileArtifact>,
    pub classifiers: Option<HashMap<String, DownloadFileArtifact>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadFileArtifact {
    pub path: String,
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleEntry {
    pub action: String,
    pub os: Option<OsRule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OsRule {
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetailedProgressEvent {
    pub stage: String,
    pub current_file: String,
    pub files_completed: usize,
    pub total_files: usize,
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    pub progress_percent: f64,
    pub speed_mbps: f64,
    pub status_text: String,
}

pub struct MojangDownloader {
    game_dir: PathBuf,
    app_handle: Option<AppHandle>,
}

impl MojangDownloader {
    pub fn new(game_dir: PathBuf, app_handle: Option<AppHandle>) -> Self {
        Self {
            game_dir,
            app_handle,
        }
    }

    fn emit_progress(&self, event: DetailedProgressEvent) {
        if let Some(handle) = &self.app_handle {
            let _ = handle.emit("download-progress", event);
        }
    }

    /// Fetches official Mojang version manifest v2
    pub async fn fetch_version_manifest() -> Result<VersionManifestV2, Box<dyn std::error::Error + Send + Sync>> {
        let url = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
        let res = reqwest::get(url).await?.error_for_status()?;
        let manifest = res.json::<VersionManifestV2>().await?;
        Ok(manifest)
    }

    /// Resolves and fetches specific version package JSON
    pub async fn fetch_version_package(&self, version_id: &str) -> Result<VersionPackage, Box<dyn std::error::Error + Send + Sync>> {
        let manifest = Self::fetch_version_manifest().await?;
        let version_info = manifest
            .versions
            .iter()
            .find(|v| v.id == version_id)
            .ok_or_else(|| format!("Minecraft version '{}' not found in Mojang manifest", version_id))?;

        let res = reqwest::get(&version_info.url).await?.error_for_status()?;
        let package = res.json::<VersionPackage>().await?;

        // Cache version package locally
        let version_dir = self.game_dir.join("versions").join(version_id);
        fs::create_dir_all(&version_dir).await?;
        let local_json = version_dir.join(format!("{}.json", version_id));
        let content = serde_json::to_string_pretty(&package)?;
        fs::write(local_json, content).await?;

        Ok(package)
    }

    /// Downloads client.jar
    pub async fn download_client_jar(&self, version_package: &VersionPackage) -> Result<PathBuf, Box<dyn std::error::Error + Send + Sync>> {
        let version_dir = self.game_dir.join("versions").join(&version_package.id);
        fs::create_dir_all(&version_dir).await?;
        let client_jar = version_dir.join(format!("{}.jar", version_package.id));

        if !client_jar.exists() {
            self.emit_progress(DetailedProgressEvent {
                stage: "CLIENT_JAR".to_string(),
                current_file: format!("{}.jar", version_package.id),
                files_completed: 0,
                total_files: 1,
                bytes_downloaded: 0,
                total_bytes: version_package.downloads.client.size,
                progress_percent: 10.0,
                speed_mbps: 0.0,
                status_text: format!("Downloading Minecraft {} Client JAR...", version_package.id),
            });

            let client = reqwest::Client::new();
            let res = client.get(&version_package.downloads.client.url).send().await?.error_for_status()?;
            let bytes = res.bytes().await?;
            let mut file = File::create(&client_jar).await?;
            file.write_all(&bytes).await?;
            log::info!("Downloaded Vanilla client JAR to {:?}", client_jar);
        }

        Ok(client_jar)
    }

    /// Downloads vanilla libraries and extracts natives for current OS
    pub async fn download_libraries_and_extract_natives(
        &self,
        version_package: &VersionPackage,
    ) -> Result<Vec<PathBuf>, Box<dyn std::error::Error + Send + Sync>> {
        let libraries_dir = self.game_dir.join("libraries");
        let natives_dir = self.game_dir.join("natives");
        fs::create_dir_all(&libraries_dir).await?;
        fs::create_dir_all(&natives_dir).await?;

        let mut classpath_entries: Vec<PathBuf> = Vec::new();
        let client = reqwest::Client::new();

        let current_os = if cfg!(target_os = "windows") {
            "windows"
        } else if cfg!(target_os = "macos") {
            "osx"
        } else {
            "linux"
        };

        let total_libs = version_package.libraries.len();
        let mut completed_libs = 0;

        for lib in &version_package.libraries {
            completed_libs += 1;

            if !Self::is_library_allowed(lib) {
                continue;
            }

            // 1. Regular artifact download
            if let Some(downloads) = &lib.downloads {
                if let Some(artifact) = &downloads.artifact {
                    let dest = libraries_dir.join(&artifact.path);
                    if let Some(parent) = dest.parent() {
                        fs::create_dir_all(parent).await?;
                    }

                    if !dest.exists() {
                        self.emit_progress(DetailedProgressEvent {
                            stage: "LIBRARIES".to_string(),
                            current_file: lib.name.clone(),
                            files_completed: completed_libs,
                            total_files: total_libs,
                            bytes_downloaded: 0,
                            total_bytes: 0,
                            progress_percent: (completed_libs as f64 / total_libs as f64) * 100.0,
                            speed_mbps: 0.0,
                            status_text: format!("Downloading Libraries ({}/{})", completed_libs, total_libs),
                        });

                        if let Ok(res) = client.get(&artifact.url).send().await {
                            if let Ok(bytes) = res.bytes().await {
                                if let Ok(mut f) = File::create(&dest).await {
                                    let _ = f.write_all(&bytes).await;
                                }
                            }
                        }
                    }
                    // If this artifact is a native library for the current OS (e.g. lwjgl-*-natives-windows.jar), extract DLLs
                    if lib.name.contains(":natives-") {
                        let is_target_native = match current_os {
                            "windows" => lib.name.ends_with(":natives-windows"),
                            "osx" => lib.name.ends_with(":natives-macos") || lib.name.ends_with(":natives-macos-arm64"),
                            _ => lib.name.ends_with(":natives-linux"),
                        };
                        if is_target_native {
                            if let Ok(bytes) = tokio::fs::read(&dest).await {
                                let _ = self.extract_natives_from_jar(&bytes, &natives_dir);
                            }
                        }
                    }
                    classpath_entries.push(dest);
                }

                // 2. Classifiers / Natives Download & Extraction
                if let Some(classifiers) = &downloads.classifiers {
                    let native_key = match current_os {
                        "windows" => "natives-windows",
                        "osx" => "natives-macos",
                        _ => "natives-linux",
                    };

                    if let Some(native_artifact) = classifiers.get(native_key).or_else(|| {
                        classifiers.iter().find(|(k, _)| k.contains(current_os)).map(|(_, v)| v)
                    }) {
                        let dest = libraries_dir.join(&native_artifact.path);
                        if let Some(parent) = dest.parent() {
                            fs::create_dir_all(parent).await?;
                        }

                        let native_bytes: Option<Vec<u8>> = if !dest.exists() {
                            if let Ok(res) = client.get(&native_artifact.url).send().await {
                                if let Ok(b) = res.bytes().await {
                                    if let Ok(mut f) = File::create(&dest).await {
                                        let _ = f.write_all(&b).await;
                                    }
                                    Some(b.to_vec())
                                } else {
                                    None
                                }
                            } else {
                                None
                            }
                        } else {
                            tokio::fs::read(&dest).await.ok()
                        };

                        // Extract native DLL / SO / Dylib into <gameDir>/natives
                        if let Some(bytes) = &native_bytes {
                            self.extract_natives_from_jar(bytes, &natives_dir)?;
                        }
                    }
                }
            }
        }

        Ok(classpath_entries)
    }

    fn extract_natives_from_jar(
        &self,
        jar_bytes: &[u8],
        natives_dir: &std::path::Path,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let cursor = Cursor::new(jar_bytes);
        if let Ok(mut archive) = zip::ZipArchive::new(cursor) {
            for i in 0..archive.len() {
                if let Ok(mut file) = archive.by_index(i) {
                    let name = file.name().to_string();
                    if name.starts_with("META-INF") || file.is_dir() {
                        continue;
                    }

                    let ext = std::path::Path::new(&name)
                        .extension()
                        .and_then(|e| e.to_str())
                        .unwrap_or("")
                        .to_lowercase();

                    if ["dll", "so", "dylib", "jnilib"].contains(&ext.as_str()) {
                        let file_name = std::path::Path::new(&name)
                            .file_name()
                            .unwrap_or_default();
                        let target_path = natives_dir.join(file_name);

                        let mut out_file = std::fs::File::create(&target_path)?;
                        std::io::copy(&mut file, &mut out_file)?;
                        log::info!("Extracted native library: {:?}", target_path);
                    }
                }
            }
        }
        Ok(())
    }

    /// Downloads vanilla asset index and object blobs into assets/objects/<prefix>/<hash>
    pub async fn download_assets(
        &self,
        version_package: &VersionPackage,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let assets_dir = self.game_dir.join("assets");
        let indexes_dir = assets_dir.join("indexes");
        let objects_dir = assets_dir.join("objects");

        fs::create_dir_all(&indexes_dir).await?;
        fs::create_dir_all(&objects_dir).await?;

        // 1. Download asset index JSON
        let index_file = indexes_dir.join(format!("{}.json", version_package.asset_index.id));
        let client = reqwest::Client::new();

        let index_content = if !index_file.exists() {
            let res = client.get(&version_package.asset_index.url).send().await?.error_for_status()?;
            let text = res.text().await?;
            fs::write(&index_file, &text).await?;
            text
        } else {
            fs::read_to_string(&index_file).await?
        };

        let asset_index_pkg: AssetIndexPackage = serde_json::from_str(&index_content)?;
        let total_objects = asset_index_pkg.objects.len();
        let mut completed_objects = 0;

        for (_key, obj) in asset_index_pkg.objects {
            completed_objects += 1;

            if obj.hash.len() < 2 {
                continue;
            }

            let prefix = &obj.hash[0..2];
            let obj_dest_dir = objects_dir.join(prefix);
            let obj_dest_file = obj_dest_dir.join(&obj.hash);

            if !obj_dest_file.exists() {
                fs::create_dir_all(&obj_dest_dir).await?;
                let obj_url = format!("https://resources.download.minecraft.net/{}/{}", prefix, obj.hash);

                if completed_objects % 50 == 0 || completed_objects == total_objects {
                    self.emit_progress(DetailedProgressEvent {
                        stage: "ASSETS".to_string(),
                        current_file: format!("{}/{}", prefix, obj.hash),
                        files_completed: completed_objects,
                        total_files: total_objects,
                        bytes_downloaded: 0,
                        total_bytes: version_package.asset_index.total_size,
                        progress_percent: (completed_objects as f64 / total_objects as f64) * 100.0,
                        speed_mbps: 0.0,
                        status_text: format!("Downloading Vanilla Assets: {:.0}% ({}/{})", (completed_objects as f64 / total_objects as f64) * 100.0, completed_objects, total_objects),
                    });
                }

                if let Ok(res) = client.get(&obj_url).send().await {
                    if let Ok(bytes) = res.bytes().await {
                        if let Ok(mut f) = File::create(&obj_dest_file).await {
                            let _ = f.write_all(&bytes).await;
                        }
                    }
                }
            }
        }

        Ok(())
    }

    fn is_library_allowed(lib: &LibraryEntry) -> bool {
        if let Some(rules) = &lib.rules {
            let current_os = if cfg!(target_os = "windows") {
                "windows"
            } else if cfg!(target_os = "macos") {
                "osx"
            } else {
                "linux"
            };

            let mut allowed = false;
            for rule in rules {
                if rule.action == "allow" {
                    if let Some(os) = &rule.os {
                        if let Some(name) = &os.name {
                            if name == current_os {
                                allowed = true;
                            }
                        }
                    } else {
                        allowed = true;
                    }
                } else if rule.action == "disallow" {
                    if let Some(os) = &rule.os {
                        if let Some(name) = &os.name {
                            if name == current_os {
                                allowed = false;
                            }
                        }
                    }
                }
            }
            allowed
        } else {
            true
        }
    }
}
