use crate::config::load_server_config;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::Emitter;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModItem {
    pub filename: String,
    pub hash: String,
    pub size: u64,
    #[serde(rename = "downloadUrl")]
    pub download_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct FullManifest {
    #[serde(default)]
    pub mods: Vec<ModItem>,
    #[serde(default)]
    pub resourcepacks: Vec<ModItem>,
    #[serde(default)]
    pub shaderpacks: Vec<ModItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SyncSummary {
    pub server_url: String,
    pub total_server_mods: usize,
    pub total_resourcepacks: usize,
    pub total_shaderpacks: usize,
    pub downloaded: usize,
    pub removed: usize,
    pub up_to_date: usize,
    pub message: String,
}

pub fn calculate_file_sha256(path: &Path) -> std::io::Result<String> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 262144]; // 256 KB buffer for high-speed disk reads
    loop {
        let count = file.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn emit_sync_progress<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
    step: &str,
    percent: u32,
    detail: &str,
) {
    eprintln!("[mod_sync progress] {:>3}% | {} | {}", percent, step, detail);
    let payload = serde_json::json!({
        "step": step,
        "percent": percent,
        "detail": detail,
    });
    let _ = app_handle.emit("install:progress", &payload);
    let _ = app_handle.emit("mod:progress", &payload);
}

/// Checks whether the mod server is reachable via /api/health with a quick timeout.
pub async fn check_mod_server_health() -> Result<String, String> {
    let server_cfg = load_server_config();
    let mods_url = server_cfg.mods_server_url();
    let health_url = format!("{}/api/health", mods_url);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(3500))
        .build()
        .map_err(|_| {
            "Mod server is currently offline or unreachable. Please wait or ask the server administrator to start the server.".to_string()
        })?;

    let resp = client
        .get(&health_url)
        .send()
        .await
        .map_err(|_| {
            "Mod server is currently offline or unreachable. Please wait or ask the server administrator to start the server.".to_string()
        })?;

    if !resp.status().is_success() {
        return Err("Mod server is currently offline or unreachable. Please wait or ask the server administrator to start the server.".to_string());
    }

    Ok(mods_url)
}

/// Synchronizes a specific category of files (mods, resourcepacks, shaderpacks).
/// Preserves custom user files by only deleting items previously tracked in the manifest.
async fn sync_category<R: tauri::Runtime>(
    category_name: &str,
    category_label: &str,
    server_items: &[ModItem],
    previous_items: &[ModItem],
    target_dir: &Path,
    client: &reqwest::Client,
    app_handle: &tauri::AppHandle<R>,
    start_pct: u32,
    end_pct: u32,
) -> Result<(usize, usize, usize), String> {
    fs::create_dir_all(target_dir)
        .map_err(|e| format!("Failed to create directory {:?}: {}", target_dir, e))?;

    // 1. Differential removal: only remove files that were previously in server manifest but no longer are
    let mut removed_count = 0;
    for old_item in previous_items {
        let still_on_server = server_items.iter().any(|m| m.filename == old_item.filename);
        if !still_on_server {
            let file_to_delete = target_dir.join(&old_item.filename);
            if file_to_delete.exists() {
                if let Err(e) = fs::remove_file(&file_to_delete) {
                    eprintln!(
                        "[mod_sync warning] Failed to remove outdated server {}: {:?} ({})",
                        category_name, file_to_delete, e
                    );
                } else {
                    eprintln!(
                        "[mod_sync] Removed outdated server {}: {}",
                        category_name, old_item.filename
                    );
                    removed_count += 1;
                }
            }
        }
    }

    // 2. Fast-Path Verification & Build Download Queue
    let prev_map: HashMap<&str, &ModItem> = previous_items
        .iter()
        .map(|m| (m.filename.as_str(), m))
        .collect();

    let mut download_queue: Vec<ModItem> = Vec::new();
    let mut up_to_date_count = 0;
    let total_items = server_items.len();

    if total_items > 0 {
        emit_sync_progress(
            app_handle,
            &format!("Checking {}…", category_label),
            start_pct,
            &format!("Verifying {} files...", total_items),
        );
    }

    for (i, item) in server_items.iter().enumerate() {
        let local_path = target_dir.join(&item.filename);
        let mut is_valid = false;

        if let Ok(meta) = fs::metadata(&local_path) {
            let file_size = meta.len();
            if file_size == item.size && item.size > 0 {
                // Fast Path: Match against previously recorded hash in local manifest
                if let Some(prev) = prev_map.get(item.filename.as_str()) {
                    if prev.hash.eq_ignore_ascii_case(&item.hash) && prev.size == item.size {
                        is_valid = true;
                    }
                }

                // If new or unrecorded, compute SHA-256 with fast buffer
                if !is_valid {
                    if let Ok(local_hash) = calculate_file_sha256(&local_path) {
                        if local_hash.eq_ignore_ascii_case(&item.hash) {
                            is_valid = true;
                        }
                    }
                }
            }
        }

        if is_valid {
            up_to_date_count += 1;
        } else {
            download_queue.push(item.clone());
        }

        if total_items > 0 && (i % 25 == 0 || i == total_items - 1) {
            let step_pct = start_pct + ((i as u32 * (end_pct - start_pct).min(10)) / total_items.max(1) as u32);
            emit_sync_progress(
                app_handle,
                &format!("Checking {}…", category_label),
                step_pct,
                &format!("Verified {}/{} {}", i + 1, total_items, category_name),
            );
        }
    }

    // 3. Download missing/updated items
    let total_to_download = download_queue.len();
    let mut downloaded_count = 0;

    if total_to_download > 0 {
        eprintln!(
            "[mod_sync] Downloading {} updated/new {}...",
            total_to_download, category_name
        );

        let dl_span = end_pct.saturating_sub(start_pct).max(1);

        for (idx, item) in download_queue.iter().enumerate() {
            let target_file = target_dir.join(&item.filename);
            let temp_file = target_dir.join(format!("{}.tmp_part", item.filename));

            let base_pct = start_pct + ((idx as u32 * dl_span) / total_to_download.max(1) as u32);
            emit_sync_progress(
                app_handle,
                &format!("Syncing {} ({}/{})", category_label, idx + 1, total_to_download),
                base_pct.min(98),
                &format!("Downloading: {}", item.filename),
            );

            let mut resp = client
                .get(&item.download_url)
                .send()
                .await
                .map_err(|e| {
                    format!(
                        "Failed to download {} '{}' from {}: {}",
                        category_name, item.filename, item.download_url, e
                    )
                })?;

            let expected_size = resp.content_length().unwrap_or(item.size);
            let mut file_bytes = Vec::with_capacity(expected_size as usize);

            while let Some(chunk) = resp
                .chunk()
                .await
                .map_err(|e| format!("Error while downloading {} {}: {}", category_name, item.filename, e))?
            {
                file_bytes.extend_from_slice(&chunk);
                let current_bytes = file_bytes.len() as u64;
                let done_mb = current_bytes as f64 / 1_048_576.0;
                let total_mb = expected_size as f64 / 1_048_576.0;

                let chunk_pct = base_pct
                    + (((current_bytes * dl_span as u64) / expected_size.max(1) / total_to_download.max(1) as u64) as u32);

                emit_sync_progress(
                    app_handle,
                    &format!("Syncing {} ({}/{})", category_label, idx + 1, total_to_download),
                    chunk_pct.min(98),
                    &format!("{}: {:.1} MB / {:.1} MB", item.filename, done_mb, total_mb),
                );
            }

            fs::write(&temp_file, &file_bytes)
                .map_err(|e| format!("Failed to write temp file {:?}: {}", temp_file, e))?;

            // Hash verification
            let downloaded_hash = calculate_file_sha256(&temp_file)
                .map_err(|e| format!("Failed to calculate hash for downloaded {}: {}", category_name, e))?;

            if !downloaded_hash.eq_ignore_ascii_case(&item.hash) {
                let _ = fs::remove_file(&temp_file);
                return Err(format!(
                    "Integrity check failed for {} '{}': expected hash {}, got {}",
                    category_name, item.filename, item.hash, downloaded_hash
                ));
            }

            if target_file.exists() {
                let _ = fs::remove_file(&target_file);
            }
            fs::rename(&temp_file, &target_file)
                .map_err(|e| format!("Failed to save {} file {:?}: {}", category_name, target_file, e))?;

            downloaded_count += 1;
        }
    }

    Ok((downloaded_count, removed_count, up_to_date_count))
}

/// Performs differential synchronization of server mods, resourcepacks, and shaderpacks.
/// Preserves custom mods and resource/shader packs added by the player.
pub async fn sync_mods<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
    game_dir: &str,
) -> Result<SyncSummary, String> {
    let server_cfg = load_server_config();
    let mods_url = server_cfg.mods_server_url();
    let target_dir = PathBuf::from(game_dir);

    let mods_dir = target_dir.join("mods");
    let resourcepacks_dir = target_dir.join("resourcepacks");
    let shaderpacks_dir = target_dir.join("shaderpacks");

    emit_sync_progress(
        app_handle,
        "Connecting to Mod Server…",
        5,
        &format!("Connecting to {}", mods_url),
    );

    let client = reqwest::Client::builder()
        .user_agent("mc-launcher-sync/1.0")
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|_| {
            "Mod server is currently offline or unreachable. Please wait or ask the server administrator to start the server.".to_string()
        })?;

    // 1. Fetch unified server manifest
    let manifest_url = format!("{}/api/manifest", mods_url);
    let manifest_resp = client
        .get(&manifest_url)
        .timeout(std::time::Duration::from_millis(4500))
        .send()
        .await
        .map_err(|_| {
            "Mod server is currently offline or unreachable. Please wait or ask the server administrator to start the server.".to_string()
        })?;

    if !manifest_resp.status().is_success() {
        return Err("Mod server is currently offline or unreachable. Please wait or ask the server administrator to start the server.".to_string());
    }

    let manifest_text = manifest_resp.text().await.map_err(|_| {
        "Mod server is currently offline or unreachable. Please wait or ask the server administrator to start the server.".to_string()
    })?;

    // Robust parsing: support unified FullManifest object or legacy direct Array [ ... ]
    let server_manifest: FullManifest = if let Ok(full) = serde_json::from_str::<FullManifest>(&manifest_text) {
        full
    } else if let Ok(legacy_mods) = serde_json::from_str::<Vec<ModItem>>(&manifest_text) {
        FullManifest {
            mods: legacy_mods,
            resourcepacks: Vec::new(),
            shaderpacks: Vec::new(),
        }
    } else {
        return Err("Mod server is currently offline or returning an invalid response. Please wait or ask the server administrator to check the server.".to_string());
    };

    eprintln!(
        "[mod_sync] Manifest loaded: {} mods, {} resourcepacks, {} shaderpacks",
        server_manifest.mods.len(),
        server_manifest.resourcepacks.len(),
        server_manifest.shaderpacks.len()
    );

    // 2. Load previous local manifest
    let local_manifest_path = target_dir.join("manifest.json");
    let previous_manifest: FullManifest = if local_manifest_path.exists() {
        let content = fs::read_to_string(&local_manifest_path).unwrap_or_default();
        if let Ok(full) = serde_json::from_str::<FullManifest>(&content) {
            full
        } else if let Ok(legacy_mods) = serde_json::from_str::<Vec<ModItem>>(&content) {
            FullManifest {
                mods: legacy_mods,
                resourcepacks: Vec::new(),
                shaderpacks: Vec::new(),
            }
        } else {
            FullManifest::default()
        }
    } else {
        FullManifest::default()
    };

    // 3. Sync Category: Mods (10% → 45%)
    let (mods_dl, mods_rm, mods_ok) = sync_category(
        "mods",
        "Mods",
        &server_manifest.mods,
        &previous_manifest.mods,
        &mods_dir,
        &client,
        app_handle,
        10,
        45,
    )
    .await?;

    // 4. Sync Category: Resource Packs (45% → 70%)
    let (rp_dl, rp_rm, rp_ok) = sync_category(
        "resourcepacks",
        "Resource Packs",
        &server_manifest.resourcepacks,
        &previous_manifest.resourcepacks,
        &resourcepacks_dir,
        &client,
        app_handle,
        45,
        70,
    )
    .await?;

    // 5. Sync Category: Shader Packs (70% → 95%)
    let (sp_dl, sp_rm, sp_ok) = sync_category(
        "shaderpacks",
        "Shader Packs",
        &server_manifest.shaderpacks,
        &previous_manifest.shaderpacks,
        &shaderpacks_dir,
        &client,
        app_handle,
        70,
        95,
    )
    .await?;

    // 6. Save updated unified manifest to target_dir/manifest.json
    let new_manifest_json = serde_json::to_string_pretty(&server_manifest)
        .map_err(|e| format!("Failed to serialize manifest: {}", e))?;
    fs::write(&local_manifest_path, new_manifest_json)
        .map_err(|e| format!("Failed to save local manifest file {:?}: {}", local_manifest_path, e))?;

    let total_dl = mods_dl + rp_dl + sp_dl;
    let total_rm = mods_rm + rp_rm + sp_rm;
    let total_ok = mods_ok + rp_ok + sp_ok;

    emit_sync_progress(
        app_handle,
        "Mods & Packs Synced & Ready!",
        100,
        &format!(
            "Synced: {} mods, {} resource packs, {} shaders",
            server_manifest.mods.len(),
            server_manifest.resourcepacks.len(),
            server_manifest.shaderpacks.len()
        ),
    );

    let summary = SyncSummary {
        server_url: mods_url,
        total_server_mods: server_manifest.mods.len(),
        total_resourcepacks: server_manifest.resourcepacks.len(),
        total_shaderpacks: server_manifest.shaderpacks.len(),
        downloaded: total_dl,
        removed: total_rm,
        up_to_date: total_ok,
        message: format!(
            "Modpack synchronized: {} mods, {} resource packs, {} shaders active.",
            server_manifest.mods.len(),
            server_manifest.resourcepacks.len(),
            server_manifest.shaderpacks.len()
        ),
    };

    Ok(summary)
}
