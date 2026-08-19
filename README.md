# ⚔️ CustomMCLauncher (CML) v1.0

> **Next-Generation Custom Minecraft Launcher & Modpack Distribution Platform**  
> Built with **Tauri v2 (Rust)**, **React 18 + TypeScript**, **Express.js**, **Prisma ORM**, and **SQLite**.

---

## ✨ Features

- ⚡ **Ultra-Fast Rust Core**: Native asset download pipelines, automatic library extraction, and headless NeoForge (21.1+) & Fabric installation.
- 🎨 **Modern Dark UI**: Hytale-inspired aesthetic with terracotta gradients, glassmorphism, and seamless view transitions.
- 🔄 **Differential Modpack Sync**: SHA-256 file indexer syncs server mods while preserving players' custom client shaders and settings.
- 📰 **Integrated News Feed**: Community announcements, swipeable multi-image carousels, full-size image lightbox inspectors, and rich markdown text.
- 🛠️ **Built-in Admin Panel (`/admin`)**: Web management dashboard for game servers, modpack file uploads, global version config, and news articles.
- 🐳 **Docker-Ready**: Instant backend deployment with Git Sparse Checkout and persistent volumes.

---

## 🎮 Instructions for Players (Client Setup)

### 📥 1. Download & Install
1. Go to the [Releases](https://github.com/Peas4nt/CustomMCLaucher/releases) section of this repository.
2. Download the installer for your operating system:
   - **Windows**: `CustomMCLauncher_1.0.0_x64_en-US.msi` (or `.exe` setup)
   - **Linux**: `CustomMCLauncher_1.0.0_amd64.AppImage` (or `.deb`)
   - **macOS**: `CustomMCLauncher_1.0.0_x64.dmg`
3. Run the installer and launch **CustomMCLauncher**.

### 🚀 2. Connect & Play
1. **Server Setup**: When opening for the first time, enter the Backend Server URL (e.g. `http://play.yourserver.com:4000`).
2. **Account**: Sign in or create an account with your email, username, and password.
3. **Launch**: Select your realm from the top bar and click **PLAY**. The launcher will automatically download Minecraft, the required mod loader (NeoForge/Fabric), and all server mods.

---

## 🐳 Instructions for Server Hosting (Docker Deployment)

You can deploy the entire backend (API, Database, File Storage, and Web Admin Panel) on your VDS/VPS in seconds using Docker.

### 📋 Prerequisites
- A server with **Docker** and **Docker Compose** installed.

### 🚀 Quick Start (2 Files Setup)

1. Create a new directory on your server and navigate into it:
   ```bash
   mkdir cml-server && cd cml-server
   ```

2. Download `docker-compose.yml` and `Dockerfile` from this repository:
   ```bash
   curl -O https://raw.githubusercontent.com/Peas4nt/CustomMCLaucher/main/docker-compose.yml
   curl -O https://raw.githubusercontent.com/Peas4nt/CustomMCLaucher/main/Dockerfile
   ```

3. Launch the container:
   ```bash
   docker compose up -d --build
   ```

4. **Access your server**:
   - 🌐 **Web Admin Panel**: `http://<YOUR_SERVER_IP>:4000/admin`
   - 🔌 **API Health Endpoint**: `http://<YOUR_SERVER_IP>:4000/api/health`

> 💾 **Data Persistence**: Your database, uploaded news photos, and modpack files are automatically saved in the `./data/` folder on your host machine.

---

## 👨‍💻 Instructions for Developers & Building from Source

If you want to contribute, modify the code, or compile the client and server locally:

📖 **Read the full developer guide: [INSTRUCTIONS.md](file:///d:/programming/mc-launcher/INSTRUCTIONS.md)**

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
```

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
