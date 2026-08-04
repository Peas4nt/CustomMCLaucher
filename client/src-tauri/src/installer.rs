use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tauri::Emitter;

/// Target Minecraft version to install NeoForge for.
pub const MC_VERSION: &str = "1.21.1";
/// NeoForge version prefix for MC 1.21.1
pub const NEOFORGE_PREFIX: &str = "21.1.";
/// Mojang asset download base URL
const MOJANG_RESOURCES_URL: &str = "https://resources.download.minecraft.net";

pub fn emit_progress<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
    step: &str,
    percent: u32,
    detail: &str,
) {
    eprintln!("[installer progress] {:>3}% | {} | {}", percent, step, detail);
    let payload = serde_json::json!({
        "step": step,
        "percent": percent,
        "detail": detail,
    });
    let _ = app_handle.emit("install:progress", &payload);
}

fn clean_path(path: &Path) -> String {
    let s = path.to_string_lossy().to_string();
    if let Some(stripped) = s.strip_prefix(r"\\?\") {
        stripped.to_string()
    } else {
        s
    }
}

/// Convert maven coordinate like "org.lwjgl:lwjgl:3.3.3" or "org.lwjgl:lwjgl:3.3.3:natives-windows"
/// to standard relative path like "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3[-natives-windows].jar"
pub fn maven_coordinate_to_path(name: &str) -> Option<String> {
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() >= 3 {
        let group = parts[0].replace('.', "/");
        let artifact = parts[1];
        let version = parts[2];
        let classifier = if parts.len() >= 4 {
            format!("-{}", parts[3])
        } else {
            String::new()
        };
        Some(format!(
            "{}/{}/{}/{}-{}{}.jar",
            group, artifact, version, artifact, version, classifier
        ))
    } else {
        None
    }
}

/// Check if a Mojang library rule allows the current OS.
pub fn is_rule_allowed_for_os(rules: Option<&Vec<serde_json::Value>>) -> bool {
    let current_os = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "osx"
    } else {
        "linux"
    };

    match rules {
        None => true,
        Some(list) => {
            let mut allowed = false;
            for r in list {
                let action = r["action"].as_str().unwrap_or("");
                let os_name = r["os"]["name"].as_str();

                if action == "allow" {
                    if os_name.is_none() || os_name == Some(current_os) {
                        allowed = true;
                    }
                } else if action == "disallow" {
                    if os_name.is_none() || os_name == Some(current_os) {
                        allowed = false;
                    }
                }
            }
            allowed
        }
    }
}

/// Creates all standard Minecraft folders (mods, saves, resourcepacks, config, etc.)
pub fn ensure_game_directories(game_dir: &Path) {
    let standard_dirs = [
        "mods",
        "resourcepacks",
        "saves",
        "shaderpacks",
        "config",
        "logs",
        "screenshots",
        "natives",
    ];
    for dir in &standard_dirs {
        let _ = fs::create_dir_all(game_dir.join(dir));
    }
}

/// Check if NeoForge / Forge is installed AND assets and libraries are present.
pub fn is_installed(game_dir: &str) -> bool {
    let base = PathBuf::from(game_dir);

    // Make sure directories exist
    ensure_game_directories(&base);

    // Check for NeoForge / Forge version directory with valid JSON
    let versions_dir = base.join("versions");
    if !versions_dir.exists() {
        return false;
    }

    let has_modded = if let Ok(entries) = fs::read_dir(&versions_dir) {
        entries.flatten().any(|e| {
            let name = e.file_name().to_string_lossy().to_string().to_lowercase();
            (name.contains("neoforge") || name.contains("forge"))
                && (name.contains("21.1") || name.contains("1.21.1"))
                && e.path().join(format!("{}.json", e.file_name().to_string_lossy())).exists()
        })
    } else {
        false
    };
    if !has_modded {
        return false;
    }

    // Check that assets index exists (minimal asset check)
    let assets_indexes = base.join("assets").join("indexes");
    if !assets_indexes.exists() {
        return false;
    }
    if let Ok(mut entries) = fs::read_dir(&assets_indexes) {
        if entries.next().is_none() {
            return false;
        }
    } else {
        return false;
    }

    // Check that LWJGL native or libraries exist
    let libraries_dir = base.join("libraries");
    if !libraries_dir.exists() {
        return false;
    }

    true
}

/// Parse all <version> tags from Maven metadata XML, return latest stable matching prefix.
fn pick_latest_version(xml: &str, prefix: &str) -> Option<String> {
    let versions: Vec<String> = xml
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            if trimmed.starts_with("<version>") && trimmed.ends_with("</version>") {
                let inner = &trimmed[9..trimmed.len() - 10];
                if inner.starts_with(prefix) {
                    Some(inner.to_string())
                } else {
                    None
                }
            } else {
                None
            }
        })
        .collect();

    if versions.is_empty() {
        return None;
    }

    let stable: Vec<_> = versions
        .iter()
        .filter(|v| !v.contains("beta") && !v.contains("alpha") && !v.contains("rc"))
        .cloned()
        .collect();

    if !stable.is_empty() {
        stable.last().cloned()
    } else {
        versions.last().cloned()
    }
}

/// Extract all native libraries (.dll, .so, .dylib) from libraries/ into natives/
pub fn extract_natives(game_dir: &Path) -> Result<(), String> {
    let natives_dir = game_dir.join("natives");
    fs::create_dir_all(&natives_dir)
        .map_err(|e| format!("Failed to create natives directory: {}", e))?;

    let libraries_dir = game_dir.join("libraries");
    if !libraries_dir.exists() {
        return Ok(());
    }

    let native_suffix = if cfg!(target_os = "windows") {
        ".dll"
    } else if cfg!(target_os = "macos") {
        ".dylib"
    } else {
        ".so"
    };

    let target_filter = if cfg!(target_os = "windows") {
        "natives-windows"
    } else if cfg!(target_os = "macos") {
        "natives-macos"
    } else {
        "natives-linux"
    };

    for entry in walkdir::WalkDir::new(&libraries_dir)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.extension().map_or(false, |ext| ext == "jar") {
            let file_name = path.file_name().unwrap_or_default().to_string_lossy();
            if file_name.contains("natives") && (file_name.contains(target_filter) || !file_name.contains("natives-")) {
                if let Ok(file) = fs::File::open(path) {
                    let reader = BufReader::new(file);
                    if let Ok(mut archive) = zip::ZipArchive::new(reader) {
                        for i in 0..archive.len() {
                            if let Ok(mut zip_file) = archive.by_index(i) {
                                let entry_name = zip_file.name().to_string();
                                if entry_name.ends_with(native_suffix) && !entry_name.contains('/') && !entry_name.contains('\\') {
                                    let dest_path = natives_dir.join(&entry_name);
                                    if !dest_path.exists() {
                                        if let Ok(mut out_file) = fs::File::create(&dest_path) {
                                            let _ = std::io::copy(&mut zip_file, &mut out_file);
                                            eprintln!("[installer] Extracted native: {:?}", dest_path);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

/// Download all missing vanilla Minecraft libraries defined in version JSON.
async fn download_vanilla_libraries<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
    client: &reqwest::Client,
    game_dir: &Path,
    vanilla_json_parsed: &serde_json::Value,
) -> Result<(), String> {
    let libraries = match vanilla_json_parsed["libraries"].as_array() {
        Some(libs) => libs,
        None => return Ok(()),
    };

    let libraries_dir = game_dir.join("libraries");
    fs::create_dir_all(&libraries_dir)
        .map_err(|e| format!("Failed to create libraries directory: {}", e))?;

    struct DownloadItem {
        url: String,
        dest: PathBuf,
        name: String,
    }

    let mut download_queue: Vec<DownloadItem> = Vec::new();

    for lib in libraries {
        let rules = lib["rules"].as_array();
        if !is_rule_allowed_for_os(rules) {
            continue;
        }

        // Check main artifact
        if let Some(artifact) = lib.get("downloads").and_then(|d| d.get("artifact")) {
            if let (Some(url), Some(path_str)) = (artifact["url"].as_str(), artifact["path"].as_str()) {
                let dest = libraries_dir.join(path_str.replace('/', std::path::MAIN_SEPARATOR_STR));
                if !dest.exists() {
                    download_queue.push(DownloadItem {
                        url: url.to_string(),
                        dest,
                        name: path_str.to_string(),
                    });
                }
            }
        }

        // Check classifier natives for current OS
        if let Some(classifiers) = lib.get("downloads").and_then(|d| d.get("classifiers")) {
            let classifier_key = if cfg!(target_os = "windows") {
                "natives-windows"
            } else if cfg!(target_os = "macos") {
                "natives-macos"
            } else {
                "natives-linux"
            };

            if let Some(native_artifact) = classifiers.get(classifier_key) {
                if let (Some(url), Some(path_str)) = (native_artifact["url"].as_str(), native_artifact["path"].as_str()) {
                    let dest = libraries_dir.join(path_str.replace('/', std::path::MAIN_SEPARATOR_STR));
                    if !dest.exists() {
                        download_queue.push(DownloadItem {
                            url: url.to_string(),
                            dest,
                            name: path_str.to_string(),
                        });
                    }
                }
            }
        }
    }

    let total = download_queue.len();
    if total == 0 {
        eprintln!("[installer] All vanilla libraries already present.");
        return Ok(());
    }

    eprintln!("[installer] Downloading {} missing vanilla libraries...", total);

    let semaphore = Arc::new(tokio::sync::Semaphore::new(16));
    let completed = Arc::new(AtomicUsize::new(0));
    let mut set = tokio::task::JoinSet::new();

    for item in download_queue {
        let sem = semaphore.clone();
        let cli = client.clone();
        let dl = completed.clone();
        let handle = app_handle.clone();

        set.spawn(async move {
            let _permit = match sem.acquire().await {
                Ok(p) => p,
                Err(_) => return,
            };

            if let Some(parent) = item.dest.parent() {
                let _ = tokio::fs::create_dir_all(parent).await;
            }

            if let Ok(resp) = cli.get(&item.url).send().await {
                if let Ok(bytes) = resp.bytes().await {
                    let _ = tokio::fs::write(&item.dest, &bytes).await;
                }
            }

            let cur = dl.fetch_add(1, Ordering::Relaxed) + 1;
            let pct = 70 + ((cur * 15) / total.max(1)) as u32;
            emit_progress(
                &handle,
                &format!("Downloading libraries ({}/{})", cur, total),
                pct.min(85),
                &format!("Library: {}", item.name),
            );
        });
    }

    while set.join_next().await.is_some() {}

    eprintln!("[installer] Vanilla libraries download finished.");
    Ok(())
}

/// Fast concurrent download of Minecraft assets from Mojang CDN with live progress.
async fn download_assets<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
    client: &reqwest::Client,
    game_dir: &Path,
    asset_index_url: &str,
    asset_index_id: &str,
) -> Result<(), String> {
    emit_progress(
        app_handle,
        &format!("Downloading asset index ({})", asset_index_id),
        85,
        "Fetching asset manifest from Mojang CDN...",
    );

    // Download and save the asset index JSON
    let index_json = client
        .get(asset_index_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download asset index: {}", e))?
        .text()
        .await
        .map_err(|e| format!("Failed to read asset index: {}", e))?;

    let indexes_dir = game_dir.join("assets").join("indexes");
    fs::create_dir_all(&indexes_dir)
        .map_err(|e| format!("Failed to create assets/indexes dir: {}", e))?;

    let index_path = indexes_dir.join(format!("{}.json", asset_index_id));
    fs::write(&index_path, &index_json)
        .map_err(|e| format!("Failed to save asset index: {}", e))?;

    let parsed: serde_json::Value = serde_json::from_str(&index_json)
        .map_err(|e| format!("Failed to parse asset index JSON: {}", e))?;

    let objects = parsed["objects"]
        .as_object()
        .ok_or("Asset index missing 'objects' field")?;

    let objects_dir = game_dir.join("assets").join("objects");
    fs::create_dir_all(&objects_dir)
        .map_err(|e| format!("Failed to create assets/objects dir: {}", e))?;

    let total = objects.len();
    let semaphore = Arc::new(tokio::sync::Semaphore::new(28));
    let downloaded = Arc::new(AtomicUsize::new(0));
    let skipped = Arc::new(AtomicUsize::new(0));

    let mut set = tokio::task::JoinSet::new();

    for (name, obj) in objects {
        let hash = match obj["hash"].as_str() {
            Some(h) => h.to_string(),
            None => continue,
        };
        let file_name = name.clone();
        let prefix = hash[..2].to_string();

        let dest_dir = objects_dir.join(&prefix);
        let _ = fs::create_dir_all(&dest_dir);
        let dest_file = dest_dir.join(&hash);

        if dest_file.exists() {
            skipped.fetch_add(1, Ordering::Relaxed);
            let current = downloaded.fetch_add(1, Ordering::Relaxed) + 1;
            if current % 10 == 0 || current == total {
                let pct = 85 + (current * 14 / total.max(1)) as u32;
                emit_progress(
                    app_handle,
                    &format!("Verifying game assets ({}/{})", current, total),
                    pct.min(99),
                    &format!("Asset: {}", file_name),
                );
            }
            continue;
        }

        let sem = semaphore.clone();
        let cli = client.clone();
        let dl = downloaded.clone();
        let handle = app_handle.clone();
        let url = format!("{}/{}/{}", MOJANG_RESOURCES_URL, prefix, hash);

        set.spawn(async move {
            let _permit = match sem.acquire().await {
                Ok(p) => p,
                Err(_) => return,
            };

            if let Ok(resp) = cli.get(&url).send().await {
                if let Ok(bytes) = resp.bytes().await {
                    let _ = tokio::fs::write(&dest_file, &bytes).await;
                }
            }

            let current = dl.fetch_add(1, Ordering::Relaxed) + 1;
            if current % 5 == 0 || current == total {
                let pct = 85 + (current * 14 / total.max(1)) as u32;
                emit_progress(
                    &handle,
                    &format!("Downloading assets ({}/{})", current, total),
                    pct.min(99),
                    &format!("Downloaded: {}", file_name),
                );
            }
        });
    }

    while set.join_next().await.is_some() {}

    let final_skipped = skipped.load(Ordering::Relaxed);
    let final_total = downloaded.load(Ordering::Relaxed);
    eprintln!(
        "[installer] Assets complete: {} total, {} already cached",
        final_total, final_skipped
    );

    Ok(())
}

pub async fn install_neoforge<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
    game_dir: &str,
) -> Result<String, String> {
    let target_dir = PathBuf::from(game_dir);
    fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create game directory: {}", e))?;

    // Create standard Minecraft folders right away
    ensure_game_directories(&target_dir);

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) mc-launcher/1.0")
        .timeout(std::time::Duration::from_secs(45))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    // ── Step 1: Find latest NeoForge version ──────────────────────────────────
    emit_progress(
        app_handle,
        &format!("Searching Forge/NeoForge for MC {}...", MC_VERSION),
        5,
        "Fetching version list from maven.neoforged.net...",
    );

    let maven_meta_url =
        "https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml";
    let meta_resp = client
        .get(maven_meta_url)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to NeoForge Maven: {}", e))?
        .text()
        .await
        .map_err(|e| format!("Failed to read metadata response: {}", e))?;

    let neoforge_version = pick_latest_version(&meta_resp, NEOFORGE_PREFIX).ok_or_else(|| {
        format!(
            "No NeoForge version found for MC {} (prefix: {})",
            MC_VERSION, NEOFORGE_PREFIX
        )
    })?;

    eprintln!("[installer] Selected NeoForge version: {}", neoforge_version);

    // ── Step 2: Check if NeoForge libraries already installed ─────────────────
    let neoforge_json = target_dir
        .join("versions")
        .join(format!("neoforge-{}", neoforge_version))
        .join(format!("neoforge-{}.json", neoforge_version));
    let neoforge_already_installed = neoforge_json.exists();

    if !neoforge_already_installed {
        // ── Step 3: Download NeoForge installer with byte stream progress ──────
        let installer_url = format!(
            "https://maven.neoforged.net/releases/net/neoforged/neoforge/{}/neoforge-{}-installer.jar",
            neoforge_version, neoforge_version
        );

        emit_progress(
            app_handle,
            &format!("Downloading Forge {}...", neoforge_version),
            10,
            &format!("Connecting to {}", installer_url),
        );

        eprintln!("[installer] Downloading installer from: {}", installer_url);

        let mut resp = client
            .get(&installer_url)
            .send()
            .await
            .map_err(|e| format!("Failed to download NeoForge installer: {}", e))?;

        let total_size = resp.content_length().unwrap_or(18 * 1024 * 1024);
        let mut downloaded_bytes = 0u64;
        let mut jar_bytes = Vec::with_capacity(total_size as usize);

        while let Some(chunk) = resp
            .chunk()
            .await
            .map_err(|e| format!("Error downloading installer chunk: {}", e))?
        {
            downloaded_bytes += chunk.len() as u64;
            jar_bytes.extend_from_slice(&chunk);

            let pct = 10 + ((downloaded_bytes * 15) / total_size.max(1)) as u32;
            let mb_done = downloaded_bytes as f64 / 1_048_576.0;
            let mb_total = total_size as f64 / 1_048_576.0;

            emit_progress(
                app_handle,
                &format!("Downloading Forge {} installer", neoforge_version),
                pct.min(25),
                &format!("{:.1} MB / {:.1} MB ({:.0}%)", mb_done, mb_total, (downloaded_bytes as f64 / total_size as f64) * 100.0),
            );
        }

        let installer_path =
            target_dir.join(format!("neoforge-{}-installer.jar", neoforge_version));
        fs::write(&installer_path, &jar_bytes)
            .map_err(|e| format!("Failed to save installer JAR: {}", e))?;

        // ── Step 4: Run NeoForge installer with line-by-line progress ──────────
        emit_progress(
            app_handle,
            "Running Forge Installer...",
            25,
            "Starting Java client patcher...",
        );

        let profiles_path = target_dir.join("launcher_profiles.json");
        if !profiles_path.exists() {
            let stub = r#"{"profiles":{},"settings":{},"version":3}"#;
            let _ = fs::write(&profiles_path, stub);
        }

        let game_dir_clean = clean_path(&target_dir);
        let java_bin = {
            let cfg = crate::config::load_config();
            if cfg.java_path.trim().is_empty() {
                "java".to_string()
            } else {
                cfg.java_path.trim().to_string()
            }
        };

        eprintln!(
            "[installer] Running: {} -jar {:?} --installClient {}",
            java_bin, installer_path, game_dir_clean
        );

        let mut child = Command::new(&java_bin)
            .arg("-jar")
            .arg(&installer_path)
            .arg("--installClient")
            .arg(&game_dir_clean)
            .current_dir(&target_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|e| {
                format!(
                    "Failed to spawn Java installer ({}): {}\nPlease check that Java 21 is installed and in your PATH.",
                    java_bin, e
                )
            })?;

        // Stream output from installer and update UI
        if let Some(stdout) = child.stdout.take() {
            let app_out = app_handle.clone();
            let nfv = neoforge_version.clone();
            std::thread::spawn(move || {
                let reader = BufReader::new(stdout);
                let mut line_num = 0u32;
                const ESTIMATED_LINES: u32 = 350;
                for line in reader.lines().flatten() {
                    line_num += 1;
                    let pct = 25 + (line_num * 45 / ESTIMATED_LINES).min(44);
                    let clean_line = line.trim();
                    let short_detail = if clean_line.starts_with("Processor:") {
                        clean_line.to_string()
                    } else if clean_line.starts_with("Downloading:") || clean_line.starts_with("Applying:") {
                        clean_line.to_string()
                    } else if clean_line.len() > 65 {
                        format!("...{}", &clean_line[clean_line.len() - 60..])
                    } else {
                        clean_line.to_string()
                    };

                    emit_progress(
                        &app_out,
                        &format!("Installing Forge libraries ({})", nfv),
                        pct.min(69),
                        &short_detail,
                    );
                    eprintln!("[installer:stdout] {}", line);
                }
            });
        }

        let status = child
            .wait()
            .map_err(|e| format!("Failed to wait for Java installer: {}", e))?;

        let _ = fs::remove_file(&installer_path);

        if !status.success() {
            return Err(format!(
                "NeoForge installer failed with exit code {:?}.\nCheck console for details.",
                status.code()
            ));
        }

        emit_progress(
            app_handle,
            "Forge libraries installed!",
            70,
            "Verifying and downloading vanilla client libraries...",
        );
    }

    // ── Step 5: Read Vanilla version JSON for libraries and assets ────────────
    let vanilla_json_path = target_dir
        .join("versions")
        .join(MC_VERSION)
        .join(format!("{}.json", MC_VERSION));

    let vanilla_json = fs::read_to_string(&vanilla_json_path).map_err(|e| {
        format!(
            "Cannot read {}.json: {}. NeoForge installation may have been incomplete.",
            MC_VERSION, e
        )
    })?;

    let vanilla_parsed: serde_json::Value = serde_json::from_str(&vanilla_json)
        .map_err(|e| format!("Cannot parse vanilla version JSON: {}", e))?;

    // ── Step 6: Download Vanilla libraries (LWJGL, etc.) ──────────────────────
    download_vanilla_libraries(app_handle, &client, &target_dir, &vanilla_parsed).await?;

    // ── Step 7: Extract native DLLs / binaries into natives/ ──────────────────
    emit_progress(
        app_handle,
        "Extracting native libraries...",
        85,
        "Preparing LWJGL & OpenGL drivers...",
    );
    extract_natives(&target_dir)?;

    // ── Step 8: Download Minecraft sound & texture assets (Mojang CDN) ─────────
    let asset_index_id = vanilla_parsed["assetIndex"]["id"]
        .as_str()
        .unwrap_or("17")
        .to_string();
    let asset_index_url = vanilla_parsed["assetIndex"]["url"]
        .as_str()
        .ok_or("No assetIndex.url in vanilla version JSON")?
        .to_string();

    download_assets(
        app_handle,
        &client,
        &target_dir,
        &asset_index_url,
        &asset_index_id,
    )
    .await?;

    // Ensure standard directories are ready
    ensure_game_directories(&target_dir);

    // ── Done ──────────────────────────────────────────────────────────────────
    emit_progress(
        app_handle,
        "Installation complete!",
        100,
        &format!(
            "Forge {} for MC {} is ready to play!",
            neoforge_version, MC_VERSION
        ),
    );

    Ok(format!(
        "Forge {} for MC {} installed successfully!",
        neoforge_version, MC_VERSION
    ))
}
