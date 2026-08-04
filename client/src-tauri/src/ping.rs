use crate::config::load_server_config;
use serde::Serialize;
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

#[derive(Debug, Serialize, Clone)]
pub struct PlayerSample {
    pub name: String,
    pub id: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct ServerStatus {
    pub online: bool,
    pub players_online: u32,
    pub players_max: u32,
    pub players_sample: Vec<PlayerSample>,
    pub motd: String,
    pub version: String,
}

pub fn ping_server_sync() -> ServerStatus {
    let server_cfg = load_server_config();
    let server_ip = &server_cfg.server_ip;
    let server_port = server_cfg.server_port;

    let addr = format!("{}:{}", server_ip, server_port);
    let socket_addrs: Vec<_> = match addr.to_socket_addrs() {
        Ok(iter) => iter.collect(),
        Err(_) => {
            return ServerStatus {
                online: false,
                players_online: 0,
                players_max: 0,
                players_sample: Vec::new(),
                motd: String::new(),
                version: String::new(),
            };
        }
    };

    let mut stream = match socket_addrs.first() {
        Some(socket_addr) => {
            match TcpStream::connect_timeout(socket_addr, Duration::from_secs(3)) {
                Ok(s) => s,
                Err(_) => {
                    return ServerStatus {
                        online: false,
                        players_online: 0,
                        players_max: 0,
                        players_sample: Vec::new(),
                        motd: String::new(),
                        version: String::new(),
                    }
                }
            }
        }
        None => {
            return ServerStatus {
                online: false,
                players_online: 0,
                players_max: 0,
                players_sample: Vec::new(),
                motd: String::new(),
                version: String::new(),
            }
        }
    };

    let _ = stream.set_read_timeout(Some(Duration::from_secs(4)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(4)));

    match craftping::sync::ping(&mut stream, server_ip, server_port) {
        Ok(res) => {
            let motd = match res.description {
                Some(serde_json::Value::String(s)) => s,
                Some(serde_json::Value::Object(obj)) => {
                    if let Some(serde_json::Value::String(text)) = obj.get("text") {
                        text.clone()
                    } else {
                        String::new()
                    }
                }
                _ => String::new(),
            };

            let players_sample = if let Some(sample) = res.sample {
                sample
                    .into_iter()
                    .map(|p| PlayerSample {
                        name: p.name,
                        id: p.id,
                    })
                    .collect()
            } else {
                Vec::new()
            };

            ServerStatus {
                online: true,
                players_online: res.online_players as u32,
                players_max: res.max_players as u32,
                players_sample,
                motd,
                version: res.version,
            }
        }
        Err(_) => ServerStatus {
            online: false,
            players_online: 0,
            players_max: 0,
            players_sample: Vec::new(),
            motd: String::new(),
            version: String::new(),
        },
    }
}
