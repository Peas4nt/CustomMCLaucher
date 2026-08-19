use std::path::{Path, PathBuf};
use std::process::Command;

pub struct JavaResolver;

impl JavaResolver {
    /// Attempts to find a valid Java executable from custom path, JAVA_HOME, or PATH
    pub fn find_system_java(custom_path: Option<&str>) -> Option<PathBuf> {
        // 1. Check custom path if provided
        if let Some(path_str) = custom_path {
            let p = PathBuf::from(path_str);
            if p.exists() && Self::validate_java_binary(&p) {
                return Some(p);
            }
        }

        // 2. Check JAVA_HOME
        if let Ok(java_home) = std::env::var("JAVA_HOME") {
            let bin = if cfg!(target_os = "windows") {
                PathBuf::from(java_home).join("bin").join("java.exe")
            } else {
                PathBuf::from(java_home).join("bin").join("java")
            };
            if bin.exists() && Self::validate_java_binary(&bin) {
                return Some(bin);
            }
        }

        // 3. Check system PATH
        let default_cmd = if cfg!(target_os = "windows") { "java" } else { "java" };
        if let Ok(output) = Command::new(default_cmd).arg("-version").output() {
            if output.status.success() || !output.stderr.is_empty() {
                return Some(PathBuf::from(default_cmd));
            }
        }

        None
    }

    fn validate_java_binary(path: &Path) -> bool {
        match Command::new(path).arg("-version").output() {
            Ok(out) => out.status.success() || !out.stderr.is_empty(),
            Err(_) => false,
        }
    }
}
