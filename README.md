# ⚔️ CustomMCLauncher (CML) v1.1

> **Next-Generation Custom Minecraft Launcher & Modpack Distribution Platform**  
> Built with **Tauri v2 (Rust)**, **React 18 + TypeScript**, **Express.js**, **Prisma ORM**, and **SQLite**.

---

## ✨ Features

- ⚡ **Ultra-Fast Rust Core**: Native asset download pipelines, automatic library extraction, and headless Forge, NeoForge (21.1+) & Fabric installation.
- 🎨 **Modern Dark UI**: Hytale-inspired aesthetic with terracotta gradients, glassmorphism, and seamless view transitions.
- 🔄 **Differential Modpack Sync**: SHA-256 file indexer syncs server mods while preserving players' custom client shaders and settings.
- 🚀 **Instant Server Auto-Join**: Automatically connects to the primary game server on launch via `--quickPlayMultiplayer`.
- 📰 **Integrated News Feed**: Community announcements, swipeable multi-image carousels, full-size image lightbox inspectors, and rich markdown text.
- 🛠️ **Built-in Admin Panel (`/admin`)**: Web management dashboard for game servers, modpack file uploads, global version config, and news articles.
- 🐳 **Docker-Ready**: One-command backend deployment using a pre-built image from GitHub Container Registry — no build step required.

---

## 🎮 Instructions for Players (Client Setup)

### 📥 1. Download & Install
1. Go to the [Releases](https://github.com/Peas4nt/CustomMCLaucher/releases) section of this repository.
2. Download the installer for your operating system:
   - **Windows**: `CustomMCLauncher_1.1.0_x64_en-US.msi` (or `.exe` setup)
   - **Linux**: `CustomMCLauncher_1.1.0_amd64.AppImage` (or `.deb`)
   - **macOS**: `CustomMCLauncher_1.1.0_aarch64.dmg`
3. Run the installer and launch **CustomMCLauncher**.

### 🚀 2. Connect & Play
1. **Server Setup**: When opening for the first time, enter the Backend Server URL (e.g. `http://play.yourserver.com:4000`).
2. **Account**: Sign in or create an account with your email, username, and password.
3. **Launch**: Select your realm from the top bar and click **PLAY**. The launcher automatically downloads Minecraft, the required mod loader (Forge/NeoForge/Fabric), all server mods, and instantly connects you to the server.

---

## 🐳 Instructions for Server Hosting (Docker Deployment)

You can deploy the entire backend (API, Database, File Storage, and Web Admin Panel) on your VDS/VPS in two commands using Docker.

The server image is automatically built and published to **GitHub Container Registry** on every release — no local compilation required.

### 📋 Prerequisites
- A server with **Docker** and **Docker Compose** installed.

### 🚀 Quick Start (1 File Setup)

1. Create a new directory on your server and navigate into it:
   ```bash
   mkdir cml-server && cd cml-server
   ```

2. Download `docker-compose.yml` from this repository:
   ```bash
   curl -O https://raw.githubusercontent.com/Peas4nt/CustomMCLaucher/master/docker-compose.yml
   ```

3. Start the server (pulls the pre-built image automatically):
   ```bash
   docker compose up -d
   ```

4. **Access your server**:
   - 🌐 **Web Admin Panel**: `http://<YOUR_SERVER_IP>:4000/admin`
   - 🔌 **API Health Endpoint**: `http://<YOUR_SERVER_IP>:4000/api/health`

> 💾 **Data Persistence**: Your database, uploaded news photos, and modpack files are automatically saved in the `./data/` folder on your host machine.

### 🔄 Updating to a New Version

When a new version is released, updating is a single command:
```bash
docker compose pull && docker compose up -d
```

---

## 👨‍💻 Instructions for Developers & Building from Source

If you want to contribute, modify the code, or compile the client and server locally:

📖 **Read the full developer guide: [INSTRUCTIONS.md](INSTRUCTIONS.md)**

### ⚡ Quick Developer Commands
```bash
# 1. Start Backend API & Admin Web
cd server && npm run dev

# 2. Start Admin Web Frontend (standalone)
cd admin-web && npm run dev

# 3. Start Tauri Client (Desktop App)
cd client && npm run tauri dev

# 4. Build Production Client Installer (MSI / AppImage / DMG)
cd client && npm run tauri build

# 5. Bump project version everywhere in one command
npm run bump 1.2.0
```

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
