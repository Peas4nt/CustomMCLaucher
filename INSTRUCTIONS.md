# CustomMCLauncher (CMCL) — Complete Setup, Run & Build Guide

This document contains full instructions for setting up, running, testing, and building the **CustomMCLauncher** client (Tauri v2 + React) and the **Remote Administration Backend** (Node.js + Prisma + SQLite).

---

## 📋 Table of Contents
1. [System Requirements & Prerequisites](#1-system-requirements--prerequisites)
2. [Project Architecture Overview](#2-project-architecture-overview)
3. [Backend Setup & Remote Admin Web Panel](#3-backend-setup--remote-admin-web-panel)
4. [Shared Modpack Directory & File Indexer](#4-shared-modpack-directory--file-indexer)
5. [Client Setup & Sequential 4-Step UX Flow](#5-client-setup--sequential-4-step-ux-flow)
6. [Cross-Platform OS Paths & Natives Engine](#6-cross-platform-os-paths--natives-engine)
7. [Production Build for All Platforms](#7-production-build-for-all-platforms)
   - [Windows (.exe / .msi)](#windows-exe--msi)
   - [macOS (.dmg / .app)](#macos-dmg--app)
   - [Linux (.AppImage / .deb)](#linux-appimage--deb)
8. [Client-Server Differential Sync Architecture](#8-client-server-differential-sync-architecture)
9. [API Endpoints Reference](#9-api-endpoints-reference)
10. [Troubleshooting & FAQ](#10-troubleshooting--faq)

---

## 1. System Requirements & Prerequisites

### 🛠️ Common Tools (All Platforms)
- **Node.js**: `v18.0.0` or higher (`v20+` recommended) — [Download Node.js](https://nodejs.org/)
- **Rust & Cargo**: Stable toolchain (`1.75+`) — [Install Rustup](https://rustup.rs/)
- **Java Development Kit (JDK)**: Adoptium Temurin 17 or 21 — [Download JDK](https://adoptium.net/)
- **Git**: Version 2.30+ — [Download Git](https://git-scm.com/)

---

### 🪟 Windows Setup
1. Install **Visual Studio 2022 Community** or **Visual Studio C++ Build Tools**.
   - Make sure to check **"Desktop development with C++"** and the **Windows 10/11 SDK**.
2. Install **WebView2 Runtime** (pre-installed on Windows 10/11).
3. Ensure Rust target is installed:
   ```powershell
   rustup default stable-x86_64-pc-windows-msvc
   ```

---

### 🍏 macOS Setup
1. Install **Xcode Command Line Tools**:
   ```bash
   xcode-select --install
   ```
2. For cross-compiling (Intel & Apple Silicon):
   ```bash
   rustup target add x86_64-apple-darwin
   rustup target add aarch64-apple-darwin
   ```

---

### 🐧 Linux Setup (Ubuntu / Debian / Fedora / Arch)
Install required Tauri v2 webkit & system libraries:

**Ubuntu / Debian:**
```bash
sudo apt update
sudo apt install -y build-essential curl wget libssl-dev libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libfuse2
```

**Fedora:**
```bash
sudo dnf check-update
sudo dnf install -y gcc gcc-c++ openssl-devel gtk3-devel webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel
```

**Arch Linux:**
```bash
sudo pacman -Syu --needed base-devel curl wget openssl gtk3 webkit2gtk-4.1 libappindicator-gtk3 librsvg fuse2
```

---

## 2. Project Architecture Overview

```text
custom-mc-launcher/
├── client/                     # Tauri v2 + React Frontend
│   ├── src-tauri/              # Rust Native Engine (Sync, Mojang Downloader, Process Launcher)
│   │   ├── Cargo.toml          # Rust dependencies (tauri, reqwest, sha2, tokio, serde, zip)
│   │   ├── tauri.conf.json     # Tauri v2 App configuration & bundle settings
│   │   └── src/                # Rust core modules (downloader, launcher, sync, state, commands)
│   ├── src/                    # React 19 + TypeScript + Tailwind CSS UI
│   │   ├── components/         # 4-Step UX Screens & Hytale Dashboard
│   │   │   ├── Step1ServerConnect.tsx  # Remote backend entry & health validation
│   │   │   ├── Step2Auth.tsx           # Email/Password authentication
│   │   │   ├── Step3Nickname.tsx       # Unique in-game nickname validation
│   │   │   └── Dashboard.tsx           # Hytale dashboard with live sync progress
│   │   ├── services/           # REST API & Rust IPC bridges
│   │   └── types/              # TypeScript strict interfaces
│   └── package.json
│
└── server/                     # Node.js + Prisma + SQLite Backend & Web Admin
    ├── prisma/
    │   └── schema.prisma       # SQLite Database Schema
    ├── public/
    │   └── admin/              # Embedded Remote Administration Panel SPA
    ├── data/
    │   └── shared_modpack/     # Shared mods/, config/, shaderpacks/, resourcepacks/
    ├── src/
    │   ├── modules/
    │   │   ├── auth/           # JWT Auth, Nickname verification & User Management
    │   │   ├── servers/        # Game Server Registry (with is_primary flag)
    │   │   ├── config/         # Global Minecraft & Mod Loader versions
    │   │   ├── indexer/        # Streaming SHA-256 File System Indexer & Manifest Cache
    │   │   └── files/          # File upload, download & deletion endpoints
    │   └── index.ts            # Express server entry point & Admin SPA static server
    └── package.json
```

---

## 3. Backend Setup & Remote Admin Web Panel

The backend manages user authentication, multiple Minecraft game servers (with a default primary server), global version configurations, and automatically computes SHA-256 manifests for all server files.

### Step 1: Install Dependencies
```bash
cd server
npm install
```

### Step 2: Environment Configuration
Copy the example environment file and configure variables:
```bash
cp .env.example .env
```
Edit `server/.env`:
```env
PORT=4000
DATABASE_URL="file:./dev.db"
JWT_SECRET="super-secret-production-key-change-me"
JWT_EXPIRES_IN="30d"
MODPACK_DIR="./data/shared_modpack"
CORS_ORIGIN="*"
```

### Step 3: Run SQLite Database Migration & Seeding
Initialize the SQLite database:
```bash
# Push schema to SQLite
npx prisma db push

# Generate Prisma Client
npx prisma generate
```

### Step 4: Start Backend in Development Mode
```bash
npm run dev
```
The server will start at `http://localhost:4000`.

### 🛡️ Admin Web Panel Access
Visit `http://localhost:4000/admin` in any web browser to access the dedicated administration portal:
- **Global Config**: Select Minecraft version from Mojang's manifest, choose Fabric/Forge/NeoForge/Vanilla, set JVM flags and Java version.
- **Persistent Warning Banner**: Displays alert if Minecraft version or Mod Loader is unconfigured.
- **Server Registry**: Add, modify, or remove servers and toggle the `PRIMARY` default server.
- **File System Manager**: View all indexed files, upload new mods/configs with drag-and-drop, delete files, and trigger manual SHA-256 rescans.
- **Player Accounts**: View registered player profiles, promote/demote administrator roles, and manage users.

---

## 4. Shared Modpack Directory & File Indexer

The backend includes a **Streaming SHA-256 File Indexer Service**. You can populate the shared modpack directory in two ways:
1. **Admin Web Panel**: Upload files directly via `http://localhost:4000/admin`.
2. **Direct File System / SFTP**: Place files directly into `server/data/shared_modpack/`.

### Directory Layout:
```text
server/data/shared_modpack/
├── mods/              # Fabric/Forge mod .jar files
├── config/            # Mod configuration files (.json, .toml, .cfg)
├── shaderpacks/       # Shaderpack .zip archives
└── resourcepacks/     # Resourcepack .zip archives
```

### Triggering a Re-Index:
Whenever files are placed or modified directly on disk, the indexer updates automatically on server startup or when calling the rescan endpoint:
```bash
curl -X POST http://localhost:4000/api/indexer/rescan -H "Authorization: Bearer <ADMIN_TOKEN>"
```

---

## 5. Client Setup & Sequential 4-Step UX Flow

The client is built using **Tauri v2** with **React 19**, **TypeScript**, and **Tailwind CSS**.

### Sequential Launch Flow:
1. **Step 1: Server Connect Screen** — Enter Remote Backend IP / URL. Validates health check (`GET /api/v1/health` or `/api/health`). Blocks progression if offline.
2. **Step 2: Authentication Screen** — Sign In with Email/Nickname + Password or begin Account Registration.
3. **Step 3: Unique Nickname Setup** — Live availability check against the backend database for unique in-game username.
4. **Step 4: Hytale Main Dashboard** — Full game launcher with server selector, real-time download and sync progress metrics, and one-click play.

### Step 1: Install Frontend Dependencies
```bash
cd client
npm install
```

### Step 2: Run Launcher in Development Mode
```bash
npm run tauri dev
```

---

## 6. Cross-Platform OS Paths & Natives Engine

### Standardized Operating System Directories:
- **Windows**: `%APPDATA%\CustomMCLauncher\.minecraft\`
- **Linux**: `$XDG_DATA_HOME/CustomMCLauncher/.minecraft/` or `~/.local/share/CustomMCLauncher/.minecraft/`
- **macOS**: `~/Library/Application Support/CustomMCLauncher/.minecraft/`

### Native Libraries & Assets Pipeline:
- **Vanilla Assets**: Downloaded into `assets/indexes/<version>.json` and objects into `assets/objects/<prefix>/<hash>`.
- **Native Libraries**: Extracted automatically from OS-specific JARs into `<gameDir>/natives/`.
- **Process Launch**: Passes `-Djava.library.path=<gameDir>/natives`, JVM optimization flags, player auth tokens, and auto-connect server parameters.

---

## 7. Production Build for All Platforms

### Windows (.exe / .msi)
```bash
cd client
npm run tauri build
```
**Artifacts:**
- Setup Installer: `client/src-tauri/target/release/bundle/nsis/CustomMCLauncher_<version>_x64-setup.exe`
- MSI Package: `client/src-tauri/target/release/bundle/msi/CustomMCLauncher_<version>_x64_en-US.msi`

---

### macOS (.dmg / .app)
```bash
cd client
npm run tauri build -- --target universal-apple-darwin
```
**Artifacts:**
- DMG Disk Image: `client/src-tauri/target/release/bundle/dmg/CustomMCLauncher_<version>.dmg`
- App Bundle: `client/src-tauri/target/release/bundle/macos/CustomMCLauncher.app`

---

### Linux (.AppImage / .deb)
```bash
cd client
npm run tauri build
```
**Artifacts:**
- AppImage: `client/src-tauri/target/release/bundle/appimage/custom-mc-launcher_<version>_amd64.AppImage`
- Debian Package: `client/src-tauri/target/release/bundle/deb/custom-mc-launcher_<version>_amd64.deb`

---

## 8. Client-Server Differential Sync Architecture

```
[Launcher Client]                                [Backend Server]
       │                                                │
       │ 1. GET /api/manifest                           │
       ├───────────────────────────────────────────────>│ (Queries SQLite & SHA-256 cache)
       │<───────────────────────────────────────────────┤ (Returns JSON manifest)
       │                                                │
       │ 2. Compute local SHA-256 for existing files    │
       │    Compare local vs remote manifest            │
       │                                                │
       │ 3. Download missing/changed files              │
       │    GET /api/files/:category/*path              │
       │    (Emits live `download-progress` events)     │
       ├───────────────────────────────────────────────>│
       │<───────────────────────────────────────────────┤ (Streams file content)
       │                                                │
       │ 4. Prune local files removed from server       │
       │    *CRITICAL*: ONLY delete if file exists in   │
       │    local `synced_files.json`.                  │
       │    (Custom user mods are strictly preserved!)  │
       │                                                │
       │ 5. Update local `synced_files.json`            │
       ▼                                                ▼
```

---

## 9. API Endpoints Reference

| Method | Route | Description | Auth Required |
|---|---|---|---|
| `GET`  | `/api/v1/health` or `/api/health` | Server health, version, and modpack stats | No |
| `GET`  | `/api/auth/check-nickname?username=X` | Check if in-game username is available | No |
| `POST` | `/api/auth/register` | Register new user account | No |
| `POST` | `/api/auth/login` | Authenticate user and receive JWT | No |
| `GET`  | `/api/auth/me` | Fetch authenticated user profile | Bearer JWT |
| `GET`  | `/api/users` | List all registered user profiles | Admin JWT |
| `PUT`  | `/api/users/:id` | Update user profile or role | Admin JWT |
| `DELETE` | `/api/users/:id` | Delete user account | Admin JWT |
| `GET`  | `/api/servers` | List all game servers | No |
| `POST` | `/api/servers` | Add a new game server entry | Admin JWT |
| `PATCH`| `/api/servers/:id/set-primary` | Mark server as primary default | Admin JWT |
| `DELETE` | `/api/servers/:id` | Delete server from registry | Admin JWT |
| `GET`  | `/api/config` | Retrieve global Minecraft & Loader config | No |
| `PUT`  | `/api/config` | Update global Minecraft & Loader config | Admin JWT |
| `GET`  | `/api/manifest` | Retrieve complete SHA-256 file manifest | No |
| `POST` | `/api/indexer/rescan` | Trigger recursive SHA-256 rescan | Admin JWT |
| `GET`  | `/api/files/:category/*path` | Stream file content | No |
| `POST` | `/api/files/:category/upload` | Upload modpack file | Admin JWT |
| `DELETE` | `/api/files/:category/*path` | Delete modpack file | Admin JWT |

---

## 10. Troubleshooting & FAQ

### Q: Minecraft crashes on launch with `UnsatisfiedLinkError` or missing GLFW?
**Fix**: CustomMCLauncher now automatically downloads official native JARs and extracts `.dll`, `.so`, or `.dylib` files into `<gameDir>/natives/`, injecting `-Djava.library.path=<gameDir>/natives` into the process arguments.

### Q: Will personal shaderpacks or client mods added by the player be deleted?
**Fix**: No! The sync engine checks `synced_files.json`. It only deletes files that were previously distributed by the remote server and later removed. Custom player additions are never deleted.
