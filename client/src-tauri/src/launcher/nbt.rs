use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
pub struct ServerEntry {
    pub name: String,
    pub ip: String,
    #[serde(rename = "acceptTextures")]
    pub accept_textures: Option<i8>,
}

#[derive(Debug, Serialize)]
pub struct ServerListFile {
    pub servers: Vec<ServerEntry>,
}

pub struct NbtServerWriter;

impl NbtServerWriter {
    /// Injects and overwrites the .minecraft/servers.dat file with managed backend servers
    pub fn write_servers_dat<P: AsRef<Path>>(
        game_dir: P,
        servers: &[ServerEntry],
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let servers_dat_path = game_dir.as_ref().join("servers.dat");
        
        let file_payload = ServerListFile {
            servers: servers.to_vec(),
        };

        let nbt_bytes = fastnbt::to_bytes(&file_payload)?;
        fs::write(&servers_dat_path, nbt_bytes)?;

        log::info!(
            "Successfully injected {} managed server entries into {:?}",
            servers.len(),
            servers_dat_path
        );

        Ok(())
    }
}
