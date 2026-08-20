use serde::{Deserialize, Serialize};
use std::io::Read;
use std::path::{Path, PathBuf};
use tokio::fs::{self, File};
use tokio::io::AsyncWriteExt;

#[derive(Debug, Clone)]
pub struct ModLoaderResolution {
    pub main_class: String,
    pub classpath_entries: Vec<PathBuf>,
    pub jvm_args: Vec<String>,
    pub game_args: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FabricProfile {
    pub id: String,
    #[serde(rename = "inheritsFrom")]
    pub inherits_from: String,
    #[serde(rename = "mainClass")]
    pub main_class: String,
    pub libraries: Vec<FabricLibraryEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FabricLibraryEntry {
    pub name: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoaderVersionManifest {
    pub id: Option<String>,
    #[serde(rename = "mainClass")]
    pub main_class: Option<String>,
    pub libraries: Option<Vec<LoaderLibraryEntry>>,
    pub arguments: Option<LoaderArguments>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoaderArguments {
    pub jvm: Option<Vec<serde_json::Value>>,
    pub game: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoaderLibraryEntry {
    pub name: String,
    pub downloads: Option<LoaderDownloads>,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoaderDownloads {
    pub artifact: Option<LoaderArtifact>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoaderArtifact {
    pub path: Option<String>,
    pub url: Option<String>,
    pub sha1: Option<String>,
    pub size: Option<u64>,
}

pub struct ModLoaderDownloader {
    game_dir: PathBuf,
}

impl ModLoaderDownloader {
    pub fn new(game_dir: PathBuf) -> Self {
        Self { game_dir }
    }

    /// Replaces templated variables in JVM / game arguments
    fn substitute_arg_vars(arg: &str, game_dir: &Path, mc_version: &str, loader_version: &str) -> String {
        let lib_dir = game_dir.join("libraries").to_string_lossy().to_string();
        let nat_dir = game_dir.join("natives").to_string_lossy().to_string();
        let cp_sep = if cfg!(target_os = "windows") { ";" } else { ":" };

        let mut replaced = arg
            .replace("${library_directory}", &lib_dir)
            .replace("${natives_directory}", &nat_dir)
            .replace("${classpath_separator}", cp_sep)
            .replace("${version_name}", mc_version)
            .replace("${launcher_name}", "CustomMCLauncher")
            .replace("${launcher_version}", "1.1.0");

        if replaced.starts_with("-DignoreList=") {
            replaced.push_str(&format!(
                ",{},{}.jar,neoforge-{}-client.jar,neoforge-{}.jar,neoforge-{},client-extra,client-extra.jar,client-{}-extra.jar",
                mc_version, mc_version, loader_version, loader_version, loader_version, mc_version
            ));
        }

        if replaced.contains("bootstraplauncher") && replaced.contains("securejarhandler") {
            let mergetool_dir = game_dir.join("libraries").join("net").join("neoforged").join("mergetool");
            if mergetool_dir.exists() {
                if let Ok(entries) = std::fs::read_dir(&mergetool_dir) {
                    for entry in entries.flatten() {
                        let sub = entry.path();
                        if sub.is_dir() {
                            if let Ok(sub_entries) = std::fs::read_dir(&sub) {
                                for sub_entry in sub_entries.flatten() {
                                    let p = sub_entry.path();
                                    if p.extension().map_or(false, |ext| ext == "jar") && p.to_string_lossy().contains("-api") {
                                        let p_str = p.to_string_lossy().to_string();
                                        if !replaced.contains(&p_str) {
                                            replaced.push_str(cp_sep);
                                            replaced.push_str(&p_str);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        replaced
    }

    /// Converts a Maven coordinate (e.g. "net.neoforged:neoforge:21.1.127" or with classifier) to relative path
    fn maven_coord_to_path(coord: &str) -> Option<String> {
        let parts: Vec<&str> = coord.split(':').collect();
        if parts.len() < 3 {
            return None;
        }
        let group_path = parts[0].replace('.', "/");
        let artifact = parts[1];
        let version = parts[2];
        let classifier = if parts.len() >= 4 {
            format!("-{}", parts[3])
        } else {
            String::new()
        };
        let file_name = format!("{}{}-{}.jar", artifact, classifier, version);
        Some(format!("{}/{}/{}/{}", group_path, artifact, version, file_name))
    }

    /// Fetches Fabric profile JSON and downloads Fabric loader libraries
    pub async fn resolve_fabric(
        &self,
        mc_version: &str,
        loader_version: &str,
    ) -> Result<ModLoaderResolution, Box<dyn std::error::Error + Send + Sync>> {
        let url = format!(
            "https://meta.fabricmc.net/v2/versions/loader/{}/{}/profile/json",
            mc_version, loader_version
        );
        let client = reqwest::Client::new();
        let res = client.get(&url).send().await?.error_for_status()?;
        let profile: FabricProfile = res.json().await?;

        let libraries_dir = self.game_dir.join("libraries");
        fs::create_dir_all(&libraries_dir).await?;

        let mut classpath_entries = Vec::new();

        for lib in profile.libraries {
            if let Some(rel_path) = Self::maven_coord_to_path(&lib.name) {
                let dest = libraries_dir.join(&rel_path);
                if let Some(parent) = dest.parent() {
                    fs::create_dir_all(parent).await?;
                }

                if !dest.exists() {
                    let base_url = lib.url.trim_end_matches('/');
                    let lib_url = format!("{}/{}", base_url, rel_path);

                    log::info!("Downloading Fabric library: {}", lib.name);
                    if let Ok(resp) = client.get(&lib_url).send().await {
                        if resp.status().is_success() {
                            if let Ok(bytes) = resp.bytes().await {
                                if let Ok(mut f) = File::create(&dest).await {
                                    let _ = f.write_all(&bytes).await;
                                }
                            }
                        }
                    }
                }
                classpath_entries.push(dest);
            }
        }

        Ok(ModLoaderResolution {
            main_class: profile.main_class,
            classpath_entries,
            jvm_args: Vec::new(),
            game_args: Vec::new(),
        })
    }

    /// Downloads and resolves NeoForge loader installer and libraries
    pub async fn resolve_neoforge(
        &self,
        mc_version: &str,
        loader_version: &str,
    ) -> Result<ModLoaderResolution, Box<dyn std::error::Error + Send + Sync>> {
        log::info!("Resolving NeoForge for MC {} loader version {}", mc_version, loader_version);

        let libraries_dir = self.game_dir.join("libraries");
        fs::create_dir_all(&libraries_dir).await?;

        let neo_rel_path = format!("net/neoforged/neoforge/{0}/neoforge-{0}-installer.jar", loader_version);
        let installer_path = libraries_dir.join(&neo_rel_path);

        if let Some(parent) = installer_path.parent() {
            fs::create_dir_all(parent).await?;
        }

        let client = reqwest::Client::new();

        // 1. Download installer JAR if not cached
        if !installer_path.exists() {
            let installer_url = format!(
                "https://maven.neoforged.net/releases/net/neoforged/neoforge/{0}/neoforge-{0}-installer.jar",
                loader_version
            );
            log::info!("Downloading NeoForge installer from {}", installer_url);

            let res = client.get(&installer_url).send().await?.error_for_status()?;
            let bytes = res.bytes().await?;
            let mut file = File::create(&installer_path).await?;
            file.write_all(&bytes).await?;
        }

        // 1.1 Download universal JAR (contains the NeoForge mod engine / NeoForgeLoadingOverlay)
        let neo_universal_rel = format!("net/neoforged/neoforge/{0}/neoforge-{0}-universal.jar", loader_version);
        let universal_path = libraries_dir.join(&neo_universal_rel);

        if !universal_path.exists() {
            let universal_url = format!(
                "https://maven.neoforged.net/releases/net/neoforged/neoforge/{0}/neoforge-{0}-universal.jar",
                loader_version
            );
            log::info!("Downloading NeoForge universal JAR from {}", universal_url);
            if let Ok(res) = client.get(&universal_url).send().await {
                if res.status().is_success() {
                    if let Ok(bytes) = res.bytes().await {
                        if let Some(parent) = universal_path.parent() {
                            let _ = fs::create_dir_all(parent).await;
                        }
                        if let Ok(mut f) = File::create(&universal_path).await {
                            let _ = f.write_all(&bytes).await;
                        }
                    }
                }
            }
        }

        // 1.2 Check if client jar is already patched by the installer
        let neo_client_rel = format!("net/neoforged/neoforge/{0}/neoforge-{0}-client.jar", loader_version);
        let client_patched_path = libraries_dir.join(&neo_client_rel);

        if !client_patched_path.exists() {
            log::info!("Running NeoForge installer to patch client jars...");
            let profiles_path = self.game_dir.join("launcher_profiles.json");
            if !profiles_path.exists() {
                let _ = fs::write(&profiles_path, b"{\"profiles\":{}}").await;
            }

            let java_bin = crate::downloader::JavaResolver::find_system_java(None)
                .unwrap_or_else(|| std::path::PathBuf::from("java"));
            let mut cmd = std::process::Command::new(&java_bin);
            cmd.arg("-jar")
                .arg(&installer_path)
                .arg("--installClient")
                .arg(&self.game_dir);

                #[cfg(target_os = "windows")]
                {
                    use std::os::windows::process::CommandExt;
                    const CREATE_NO_WINDOW: u32 = 0x08000000;
                    cmd.creation_flags(CREATE_NO_WINDOW);
                }

                if let Ok(status) = cmd.status() {
                    log::info!("NeoForge installer completed with status: {:?}", status);
                }
        }

        // 2. Read version json (prefer generated version profile in versions/neoforge-{version}/)
        let generated_version_json = self.game_dir
            .join("versions")
            .join(format!("neoforge-{}", loader_version))
            .join(format!("neoforge-{}.json", loader_version));

        let mut manifest_opt: Option<LoaderVersionManifest> = None;
        if generated_version_json.exists() {
            if let Ok(content) = fs::read_to_string(&generated_version_json).await {
                manifest_opt = serde_json::from_str::<LoaderVersionManifest>(&content).ok();
            }
        }

        if manifest_opt.is_none() {
            let installer_bytes = std::fs::read(&installer_path)?;
            let mut archive = zip::ZipArchive::new(std::io::Cursor::new(installer_bytes))?;

            for i in 0..archive.len() {
                let mut file = archive.by_index(i)?;
                if file.name() == "version.json" {
                    let mut content = String::new();
                    file.read_to_string(&mut content)?;
                    if let Ok(manifest) = serde_json::from_str::<LoaderVersionManifest>(&content) {
                        manifest_opt = Some(manifest);
                    }
                    break;
                }
            }
        }

        let mut classpath_entries = Vec::new();
        let mut jvm_args = Vec::new();
        let mut game_args = Vec::new();

        let main_class = if let Some(manifest) = manifest_opt {
            // Process JVM arguments from version.json (e.g. -p module-path, --add-modules, etc.)
            if let Some(ref args) = manifest.arguments {
                if let Some(ref jvms) = args.jvm {
                    for v in jvms {
                        if let Some(s) = v.as_str() {
                            jvm_args.push(Self::substitute_arg_vars(s, &self.game_dir, mc_version, loader_version));
                        }
                    }
                }
                if let Some(ref gms) = args.game {
                    for v in gms {
                        if let Some(s) = v.as_str() {
                            game_args.push(Self::substitute_arg_vars(s, &self.game_dir, mc_version, loader_version));
                        }
                    }
                }
            }

            if let Some(libs) = manifest.libraries {
                for lib in libs {
                    let rel_path = if let Some(ref dl) = lib.downloads {
                        dl.artifact.as_ref().and_then(|a| a.path.clone())
                    } else {
                        None
                    }.or_else(|| Self::maven_coord_to_path(&lib.name));

                    if let Some(rel) = rel_path {
                        let dest = libraries_dir.join(&rel);
                        if let Some(parent) = dest.parent() {
                            fs::create_dir_all(parent).await?;
                        }

                        if !dest.exists() {
                            let urls_to_try = vec![
                                lib.downloads.as_ref().and_then(|d| d.artifact.as_ref().and_then(|a| a.url.clone())),
                                lib.url.as_ref().map(|u| format!("{}/{}", u.trim_end_matches('/'), rel)),
                                Some(format!("https://maven.neoforged.net/releases/{}", rel)),
                                Some(format!("https://libraries.minecraft.net/{}", rel)),
                                Some(format!("https://repo.spongepowered.org/repository/maven-public/{}", rel)),
                                Some(format!("https://maven.minecraftforge.net/{}", rel)),
                                Some(format!("https://repo1.maven.org/maven2/{}", rel)),
                            ];

                            for try_url in urls_to_try.into_iter().flatten() {
                                if try_url.is_empty() { continue; }
                                if let Ok(resp) = client.get(&try_url).send().await {
                                    if resp.status().is_success() {
                                        if let Ok(b) = resp.bytes().await {
                                            if let Ok(mut f) = File::create(&dest).await {
                                                let _ = f.write_all(&b).await;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        classpath_entries.push(dest);
                    }
                }
            }
            manifest.main_class.unwrap_or_else(|| "cpw.mods.bootstraplauncher.BootstrapLauncher".to_string())
        } else {
            "cpw.mods.bootstraplauncher.BootstrapLauncher".to_string()
        };

        if universal_path.exists() {
            classpath_entries.push(universal_path);
        }

        Ok(ModLoaderResolution {
            main_class,
            classpath_entries,
            jvm_args,
            game_args,
        })
    }

    /// Downloads and resolves Minecraft Forge loader installer and libraries
    pub async fn resolve_forge(
        &self,
        mc_version: &str,
        loader_version: &str,
    ) -> Result<ModLoaderResolution, Box<dyn std::error::Error + Send + Sync>> {
        log::info!("Resolving Forge for MC {} loader version {}", mc_version, loader_version);

        let libraries_dir = self.game_dir.join("libraries");
        fs::create_dir_all(&libraries_dir).await?;

        let clean_mc = mc_version.trim();
        let clean_loader = loader_version.trim();
        let forge_coord = if clean_loader.starts_with(clean_mc) {
            clean_loader.to_string()
        } else {
            format!("{}-{}", clean_mc, clean_loader)
        };
        let forge_rel_path = format!("net/minecraftforge/forge/{0}/forge-{0}-installer.jar", forge_coord);
        let installer_path = libraries_dir.join(&forge_rel_path);

        if let Some(parent) = installer_path.parent() {
            fs::create_dir_all(parent).await?;
        }

        let client = reqwest::Client::new();

        if !installer_path.exists() {
            let candidate_urls = vec![
                format!("https://maven.minecraftforge.net/net/minecraftforge/forge/{0}/forge-{0}-installer.jar", forge_coord),
                format!("https://files.minecraftforge.net/maven/net/minecraftforge/forge/{0}/forge-{0}-installer.jar", forge_coord),
                format!("https://bmclapi2.bangbang93.com/forge/download?mcversion={}&version={}&category=installer", clean_mc, clean_loader),
            ];

            let mut downloaded = false;
            let mut last_err = String::new();

            for url in candidate_urls {
                log::info!("Trying Forge installer download from {}", url);
                match client.get(&url).send().await {
                    Ok(res) if res.status().is_success() => {
                        if let Ok(bytes) = res.bytes().await {
                            if bytes.len() > 1024 {
                                if let Ok(mut file) = File::create(&installer_path).await {
                                    if file.write_all(&bytes).await.is_ok() {
                                        downloaded = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    Ok(res) => {
                        last_err = format!("HTTP {} from {}", res.status(), url);
                    }
                    Err(e) => {
                        last_err = format!("Error: {}", e);
                    }
                }
            }

            if !downloaded {
                return Err(format!("Failed to download Forge installer for {} ({}). Please verify that Minecraft version '{}' and Forge version '{}' are compatible in the Admin Config. Last error: {}", mc_version, loader_version, mc_version, loader_version, last_err).into());
            }
        }

        // 1.2 Check if client jar is already patched by the installer
        let forge_client_rel = format!("net/minecraftforge/forge/{0}/forge-{0}-client.jar", forge_coord);
        let client_patched_path = libraries_dir.join(&forge_client_rel);

        let forge_universal_rel = format!("net/minecraftforge/forge/{0}/forge-{0}-universal.jar", forge_coord);
        let universal_path = libraries_dir.join(&forge_universal_rel);

        if !client_patched_path.exists() && !universal_path.exists() {
            log::info!("Running Forge installer to patch client jars...");
            let profiles_path = self.game_dir.join("launcher_profiles.json");
            if !profiles_path.exists() {
                let _ = fs::write(&profiles_path, b"{\"profiles\":{}}").await;
            }

            let java_bin = crate::downloader::JavaResolver::find_system_java(None)
                .unwrap_or_else(|| std::path::PathBuf::from("java"));
            let mut cmd = std::process::Command::new(&java_bin);
            cmd.arg("-jar")
                .arg(&installer_path)
                .arg("--installClient")
                .arg(&self.game_dir);

            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                const CREATE_NO_WINDOW: u32 = 0x08000000;
                cmd.creation_flags(CREATE_NO_WINDOW);
            }

            if let Ok(status) = cmd.status() {
                log::info!("Forge installer completed with status: {:?}", status);
            }
        }

        // 2. Read version json (check generated version profile in versions/ or installer)
        let candidate_version_jsons = vec![
            self.game_dir.join("versions").join(&forge_coord).join(format!("{}.json", forge_coord)),
            self.game_dir.join("versions").join(format!("{}-forge-{}", mc_version, loader_version)).join(format!("{}-forge-{}.json", mc_version, loader_version)),
            self.game_dir.join("versions").join(format!("1.21.1-forge-{}", loader_version)).join(format!("1.21.1-forge-{}.json", loader_version)),
        ];

        let mut manifest_opt: Option<LoaderVersionManifest> = None;
        for c_path in candidate_version_jsons {
            if c_path.exists() {
                if let Ok(content) = fs::read_to_string(&c_path).await {
                    if let Ok(m) = serde_json::from_str::<LoaderVersionManifest>(&content) {
                        manifest_opt = Some(m);
                        break;
                    }
                }
            }
        }

        if manifest_opt.is_none() {
            let installer_bytes = std::fs::read(&installer_path)?;
            let mut archive = zip::ZipArchive::new(std::io::Cursor::new(installer_bytes))?;

            for i in 0..archive.len() {
                let mut file = archive.by_index(i)?;
                if file.name() == "version.json" {
                    let mut content = String::new();
                    file.read_to_string(&mut content)?;
                    if let Ok(manifest) = serde_json::from_str::<LoaderVersionManifest>(&content) {
                        manifest_opt = Some(manifest);
                    }
                    break;
                }
            }
        }

        let mut classpath_entries = Vec::new();
        let mut jvm_args = Vec::new();
        let mut game_args = Vec::new();

        let main_class = if let Some(manifest) = manifest_opt {
            if let Some(ref args) = manifest.arguments {
                if let Some(ref jvms) = args.jvm {
                    for v in jvms {
                        if let Some(s) = v.as_str() {
                            jvm_args.push(Self::substitute_arg_vars(s, &self.game_dir, mc_version, loader_version));
                        }
                    }
                }
                if let Some(ref gms) = args.game {
                    for v in gms {
                        if let Some(s) = v.as_str() {
                            game_args.push(Self::substitute_arg_vars(s, &self.game_dir, mc_version, loader_version));
                        }
                    }
                }
            }

            if let Some(libs) = manifest.libraries {
                for lib in libs {
                    let rel_path = if let Some(ref dl) = lib.downloads {
                        dl.artifact.as_ref().and_then(|a| a.path.clone())
                    } else {
                        None
                    }.or_else(|| Self::maven_coord_to_path(&lib.name));

                    if let Some(rel) = rel_path {
                        let dest = libraries_dir.join(&rel);
                        if let Some(parent) = dest.parent() {
                            fs::create_dir_all(parent).await?;
                        }

                        if !dest.exists() {
                            let urls_to_try = vec![
                                lib.downloads.as_ref().and_then(|d| d.artifact.as_ref().and_then(|a| a.url.clone())),
                                lib.url.as_ref().map(|u| format!("{}/{}", u.trim_end_matches('/'), rel)),
                                Some(format!("https://maven.minecraftforge.net/{}", rel)),
                                Some(format!("https://libraries.minecraft.net/{}", rel)),
                                Some(format!("https://repo.spongepowered.org/repository/maven-public/{}", rel)),
                                Some(format!("https://repo1.maven.org/maven2/{}", rel)),
                            ];

                            for try_url in urls_to_try.into_iter().flatten() {
                                if try_url.is_empty() { continue; }
                                if let Ok(resp) = client.get(&try_url).send().await {
                                    if resp.status().is_success() {
                                        if let Ok(b) = resp.bytes().await {
                                            if let Ok(mut f) = File::create(&dest).await {
                                                let _ = f.write_all(&b).await;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        classpath_entries.push(dest);
                    }
                }
            }
            manifest.main_class.unwrap_or_else(|| "cpw.mods.bootstraplauncher.BootstrapLauncher".to_string())
        } else {
            "cpw.mods.bootstraplauncher.BootstrapLauncher".to_string()
        };

        if universal_path.exists() {
            classpath_entries.push(universal_path);
        } else if client_patched_path.exists() {
            classpath_entries.push(client_patched_path);
        } else {
            classpath_entries.push(installer_path);
        }

        Ok(ModLoaderResolution {
            main_class,
            classpath_entries,
            jvm_args,
            game_args,
        })
    }
}
