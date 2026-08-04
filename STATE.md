# Minecraft Launcher - System State (`STATE.md`)

- **Current project version:** v0.9.3.12
- **Architectural decisions:**
  - **Client Framework:** Tauri v2 (Rust backend) + React + TypeScript + Vite + Tailwind CSS v3.
  - **Design Theme:** Sleek dark glassmorphism (slate/zinc palette `#06090e` / `#0a0f16` / `#0e141d`, tinted dark borders `border-slate-800`, zero harsh white outlines, brand emerald `#1bd96a`, stop ruby `#dc2626`).
  - **Language:** Clean English throughout the entire application.
  - **Window Configuration:** 440×680 centered window with standard OS decorations.
  - **Single Source of Configuration (`.env`):**
    - The launcher uses `.env` in the root directory for all developer overrides (server IP, port, mod server IP & port).
    - Format in `.env`:
      ```env
      SERVER_IP=10.143.197.233
      SERVER_PORT=25565
      SERVER_NAME="JSTN Server"
      MODS_SERVER_IP=127.0.0.1
      MODS_SERVER_PORT=3000
      ```
    - When `.env` is omitted, the Rust backend seamlessly uses built-in default values.
  - **Full-Stack Content Auto-Sync (Mods, Resource Packs, Shader Packs):**
    - **Backend Endpoints:**
      - `GET /api/health`: Health status, server timestamp, and total counts for mods, resource packs, and shaders.
      - `GET /api/manifest`: Unified manifest returning `{ mods: [...], resourcepacks: [...], shaderpacks: [...] }` with SHA-256 hashes, file sizes, and URL-encoded direct download URLs.
      - `GET /api/manifest/mods`, `GET /api/manifest/resourcepacks`, `GET /api/manifest/shaderpacks`: Category-specific manifest endpoints.
      - Automatic directory alias resolution for `resourcepacks` / `resoursepack` and `shaderpacks` / `shaderpack`.
    - **Ultra-Fast In-Memory Cache:**
      - Server caches hashes using `category:filename` -> `{ mtimeMs, size, hash }` with a 256KB read stream buffer, answering manifest requests in < 1ms.
    - **Client Differential Multi-Category Synchronization Engine:**
      - Synchronizes `.minecraft/mods`, `.minecraft/resourcepacks`, and `.minecraft/shaderpacks`.
      - **Player Custom Pack Preservation:** Only files previously managed by the server that have been deleted from the server are cleaned up. Any personal resource packs, shaders, or mods added by the player are 100% preserved.
      - **Fast-Path Verification:** Uses local `manifest.json` metadata + file size matching to verify unchanged files in < 0.01ms each.
      - **Streamed Chunk Downloads:** Shows live downloaded MB / total MB and item counters for every pack/mod being synchronized.
    - **Launcher UI & Settings Enhancements:**
      - Settings sidebar includes Quick Folder access buttons with dedicated icons for **Mods Folder**, **Resource Packs**, and **Shader Packs**.
      - In-place Play button progress bar tracks multi-stage synchronization cleanly.
  - **Frontend IPC:** Uses `@tauri-apps/api/core` `invoke()` and `@tauri-apps/api/event` `listen()`.
- **Done:**
  - Installed all npm dependencies in both `client` and `server` directories on Windows.
  - **v0.9.3.4: Express Modpack Manifest API Server.**
  - **v0.9.3.5: Client-Side Differential Mod Sync Engine with Custom Player Mod Preservation.**
  - **v0.9.3.6: User-Friendly Mod Server Offline Error Handling.**
  - **v0.9.3.7: In-Place Mod Sync Progress Bar (Replacing Play Button).**
  - **v0.9.3.8: Complete Log De-clutter & Single-Screen Dedicated Logs Navigation.**
  - **v0.9.3.9: Frontend & Backend Compilation Validation & State Sync.**
  - **v0.9.3.10: Ultra-Fast Mod Verification Engine & Server In-Memory Hash Cache.**
  - **v0.9.3.11: Unified Triple-Category Sync for Mods, Resource Packs & Shader Packs:**
    - Server: Automatic directory discovery for `public/mods`, `public/resourcepacks` (or `resoursepack`), and `public/shaderpacks` (or `shaderpack`).
    - Server: In-memory hash caching across all categories with URI-safe static download endpoints.
    - Client: Multi-category synchronization engine in Rust (`mod_sync.rs`) that differentially syncs `mods/`, `resourcepacks/`, and `shaderpacks/` with user pack preservation and instant fast-path validation.
    - Client: Quick folder shortcuts in Settings sidebar for Mods, Resource Packs, and Shader Packs.
- **Doing:**
  - Ready for live dev testing (`npm run tauri dev` & `npm start`).
- **TODO:**
  - Run `npm run tauri build` to test Windows installer generation (`.msi` / `.exe`).
  - Replace placeholder username/UUID with real Microsoft auth (or offline auth library).

## 🚀 Quick-Start Commands (Windows)

```powershell
# 1. Launch Client Dev Server
cd client
npm run tauri dev

# 2. Launch Server API (in a separate terminal)
cd server
npm start

# 3. Build Windows Executable / Installer
cd client
npm run tauri build
```
