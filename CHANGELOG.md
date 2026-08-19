# Changelog

All notable changes to the CustomMCLauncher project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-20

### 🚀 Initial Production Release

#### 🎮 Native Client & Launcher (Tauri v2 + React 18 + Rust)
- **High-Performance Rust Core Engine**:
  - Full automated Vanilla, Fabric, and NeoForge (21.1+) loader installation pipelines.
  - Headless installer execution, dynamic library precedence injection, and automated OpenJDK 21 LTS runtime management.
  - Native libraries extractor unpacking OS-specific `.dll`, `.so`, and `.dylib` into `.minecraft/natives`.
  - Differential SHA-256 Modpack Synchronizer preserving player custom client configs/shaders while strictly syncing server mods.
  - Direct game process spawning with memory allocation (RAM), garbage collector tuning, and auto-connect flags.
- **Brutalist Modern Dark UI & Hytale Aesthetics**:
  - Warm sunset terracotta gradient accents (`#df9168` -> `#c86a43`) with subtle glassmorphism and isometric wireframe styling.
  - Top Navigation Bar with persistent User Profile, Auth Modal, and Server Selector.
  - Central View Transitions between **OVERVIEW**, **NEWS**, **OPTIONS**, and **LOGS** without disrupting gameplay state.
  - Big Dynamic Launch Bar with real-time transfer speeds (MB/s), file progress counts, and launch triggers.
- **Rich News & Announcement Feed**:
  - Main menu 3-card preview widget with instant article reading view.
  - Multi-image swipeable carousel with ambient background blur for portrait and landscape aspect ratios.
  - Interactive Fullscreen Image Lightbox Inspector with zoom and ESC keyboard controls.
  - Markdown text rendering with callouts, quotes, bullet points, and inline images.
- **Live Diagnostics & Options**:
  - Real-time game log streamer with log level filters (`ALL`, `INFO`, `WARN`, `ERROR`), search query bar, auto-scroll, and instant copy/clear.
  - RAM allocation slider (2 GB – 32 GB), custom Java executable selector, resolution options, and fast-access folder buttons (`mods/`, `logs/`, `screenshots/`).

#### 🛠️ Backend API & Remote Administration Panel (`server` & `admin-web`)
- **Express & SQLite / Prisma ORM Server**:
  - Fast, lightweight REST API serving health checks, remote manifests, user authentication, and game server registries.
  - Token-based JWT authentication and Bcrypt password hashing.
  - File upload engine with automatic SHA-256 hash indexing and category classification (`mods`, `config`, `shaderpacks`, `resourcepacks`).
  - Real-time News publishing API with optional summaries, tags, view counters, and server-side image uploads (`/uploads/news/`).
- **Complete Single-Page Admin Dashboard (`/admin`)**:
  - Server Management with one-click Primary Server switching and IP/port configuration.
  - News Management with drag-and-drop / local computer image uploads, markdown editor with image insertion, and tag selectors.
  - Global Version Controller managing target Minecraft and Fabric/NeoForge loader versions.
  - User and permission management with role elevation (`ADMIN` / `USER`).
- **Docker Ready**:
  - Production `Dockerfile` utilizing Git Sparse Checkout to clone only the `server` directory.
  - `docker-compose.yml` with host-persisted volumes for the SQLite database, news uploads, and modpack storage.
