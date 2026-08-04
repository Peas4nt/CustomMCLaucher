<div align="center">

# ⛏️ CustomMCLauncher

**A sleek, custom Minecraft launcher built with Tauri v2, React, and Node.js**

![Beta](https://img.shields.io/badge/status-beta-orange?style=for-the-badge)
![Tauri](https://img.shields.io/badge/Tauri-v2-24C8DB?style=for-the-badge&logo=tauri)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js)
![Rust](https://img.shields.io/badge/Rust-Powered-CE422B?style=for-the-badge&logo=rust)

</div>

---

## 📖 Overview

CustomMCLauncher is a lightweight, self-hosted Minecraft launcher with a built-in **mod auto-sync system**. Players always have the latest mods, resource packs, and shader packs without manually downloading anything.

### ✨ Key Features

| Feature | Description |
|---|---|
| 🎮 **One-Click Launch** | Launches Minecraft with configured server directly |
| 🔄 **Differential Sync** | Downloads only changed/new files — blazing fast |
| 📦 **Mods, RP & Shaders** | Syncs `.minecraft/mods`, `resourcepacks`, and `shaderpacks` |
| 🛡️ **Player Pack Preservation** | Never deletes player-added custom content |
| ⚡ **In-Memory Cache** | Server answers manifest requests in <1ms |
| 🌑 **Dark Glassmorphism UI** | Sleek emerald-accented dark interface |
| 📊 **Live Progress Bar** | Real-time MB/s sync progress in-place on Play button |
| 📁 **Quick Folder Access** | One-click shortcuts to Mods / RP / Shader folders |

---

## 🖥️ Tech Stack

```
mc-launcher/
├── client/          # Tauri v2 + React + TypeScript + Vite + Tailwind CSS v3
│   └── src-tauri/   # Rust backend (file I/O, hashing, Minecraft launch)
└── server/          # Node.js + Express (mod distribution API)
```

---

## ⚙️ Prerequisites

Before you begin, make sure you have the following installed:

- **[Node.js](https://nodejs.org/)** v18 or later
- **[Rust](https://rustup.rs/)** (stable toolchain)
- **[Java](https://adoptium.net/)** 17+ (required to run Minecraft)
- **[Git](https://git-scm.com/)**

> [!TIP]
> On Windows, also install the **[Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)** — required by Tauri.

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Peas4nt/CustomMCLaucher.git
cd CustomMCLaucher
```

### 2. Configure environment

```bash
cp .env.example .env
# Open .env and fill in your server IP, port, and mod server address
```

### 3. Install Client dependencies

```bash
cd client
npm install
```

### 4. Install Server dependencies

```bash
cd ../server
npm install
```

---

## 🧑‍💻 Running in Development

Open **two separate terminals**:

**Terminal 1 — Start the Mod API Server:**
```bash
cd server
npm start
```

**Terminal 2 — Start the Launcher (Tauri dev):**
```bash
cd client
npm run tauri dev
```

> [!NOTE]
> First launch compiles the Rust backend — this may take 2–5 minutes. Subsequent launches are instant.

---

## 🏗️ Building for Production

```bash
cd client
npm run tauri build
```

Output installer/executable will be in:
```
client/src-tauri/target/release/bundle/
```

---

## 🔧 Server — Mod Distribution API

The `server/` folder is a standalone Express.js server that serves your mods, resource packs, and shader packs.

### Directory structure for your content:

```
server/public/
├── mods/            # .jar mod files
├── resourcepacks/   # .zip resource packs
└── shaderpacks/     # .zip shader packs
```

### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Server health + file counts |
| `GET` | `/api/manifest` | Full manifest (all categories) |
| `GET` | `/api/manifest/mods` | Mods manifest only |
| `GET` | `/api/manifest/resourcepacks` | Resource packs manifest |
| `GET` | `/api/manifest/shaderpacks` | Shader packs manifest |

---

## ⚠️ Beta Notice

This project is currently in **beta**. Things may break, change, or be incomplete. Contributions, bug reports, and suggestions are welcome!

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.
