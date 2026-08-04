import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./index.css";

// ── Types ────────────────────────────────────────────────────────────────────

interface LogLine {
  id: number;
  level: "info" | "warn" | "error";
  msg: string;
}

interface AppConfig {
  username: string;
  game_dir: string;
  java_path: string;
  max_ram_mb: number;
}

interface PlayerSample {
  name: string;
  id: string;
}

interface ServerStatus {
  online: boolean;
  players_online: number;
  players_max: number;
  players_sample: PlayerSample[];
  motd: string;
  version: string;
}

interface InstallProgress {
  step: string;
  percent: number;
  detail: string;
}

interface SyncSummary {
  server_url: string;
  total_server_mods: number;
  total_resourcepacks: number;
  total_shaderpacks: number;
  downloaded: number;
  removed: number;
  up_to_date: number;
  message: string;
}

function parseGameLogMilestone(
  msg: string,
  currentPercent: number
): { percent: number; step: string } {
  const lower = msg.toLowerCase();

  if (
    lower.includes("minecraft process started") ||
    lower.includes("pid:") ||
    lower.includes("hotspot")
  ) {
    return {
      percent: Math.max(currentPercent, 12),
      step: "Initializing Java 21 Runtime",
    };
  }
  if (
    lower.includes("modlauncher") ||
    lower.includes("cpw.mods") ||
    lower.includes("transforming")
  ) {
    return {
      percent: Math.max(currentPercent, 28),
      step: "Loading ModLauncher & Mixins",
    };
  }
  if (
    lower.includes("immediatewindow") ||
    lower.includes("earlywindow") ||
    lower.includes("fmlearlydisplay")
  ) {
    return {
      percent: Math.max(currentPercent, 45),
      step: "Initializing Display Window",
    };
  }
  if (
    lower.includes("modlist") ||
    lower.includes("moddiscoverer") ||
    lower.includes("found ") ||
    lower.includes("mods")
  ) {
    return {
      percent: Math.max(currentPercent, 60),
      step: "Scanning & Loading Mods",
    };
  }
  if (
    lower.includes("lwjgl") ||
    lower.includes("glfw") ||
    lower.includes("backend library")
  ) {
    return {
      percent: Math.max(currentPercent, 75),
      step: "Initializing Graphics Engine (LWJGL)",
    };
  }
  if (
    lower.includes("openal") ||
    lower.includes("sound engine") ||
    lower.includes("soundengine") ||
    lower.includes("audio")
  ) {
    return {
      percent: Math.max(currentPercent, 88),
      step: "Starting OpenAL Audio System",
    };
  }
  if (
    lower.includes("titlescreen") ||
    lower.includes("textures") ||
    lower.includes("resourcepack") ||
    lower.includes("atlas")
  ) {
    return {
      percent: Math.max(currentPercent, 96),
      step: "Finalizing Textures & Game Ready",
    };
  }
  if (
    lower.includes("connecting to") ||
    lower.includes("joined") ||
    lower.includes("logged in")
  ) {
    return { percent: 100, step: "Connected to Server!" };
  }

  // Smoothly increment by +1% for every incoming log line during boot
  const nextPct = Math.min(94, currentPercent + 1);
  return { percent: nextPct, step: "Loading Minecraft NeoForge 1.21.1…" };
}

type Screen = "loading" | "setup" | "main";
type LaunchState = "idle" | "launching" | "running" | "stopping" | "error";
type InstallState =
  | "unknown"
  | "checking"
  | "not_installed"
  | "installing"
  | "installed"
  | "error";

const POLL_INTERVAL = 15_000;
const MAX_LOG_LINES = 3000;
let logIdCounter = 0;

function cleanMotd(motd: string | undefined): string {
  if (!motd) return "";
  return motd.replace(/§[0-9a-fk-or]/gi, "").trim();
}

function cleanPlayerName(name: string | undefined): string {
  if (!name) return "Steve";
  const cleaned = name.replace(/§[0-9a-fk-or]/gi, "").trim();
  return cleaned || "Steve";
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({
  username,
  size = 32,
  className = "",
}: {
  username: string;
  size?: number;
  className?: string;
}) {
  const clean = cleanPlayerName(username);
  const src = `https://minotar.net/helm/${encodeURIComponent(clean)}/${Math.max(size * 2, 64)}`;

  return (
    <img
      src={src}
      alt={clean}
      width={size}
      height={size}
      onError={(e) => {
        const target = e.currentTarget;
        if (!target.src.includes("MHF_Steve")) {
          target.src = `https://minotar.net/helm/MHF_Steve/${Math.max(size * 2, 64)}`;
        }
      }}
      className={`rounded-xl object-cover bg-slate-900 border border-slate-800 flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        imageRendering: "pixelated",
      }}
    />
  );
}

// ── Loading screen ────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#080c10] gap-4">
      <div className="w-12 h-12 rounded-2xl bg-brand-green flex items-center justify-center shadow-lg shadow-brand-green/20 animate-pulse">
        <svg
          className="w-6 h-6 text-bg-base"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3z" />
        </svg>
      </div>
      <p className="text-slate-400 text-sm font-medium">Loading launcher…</p>
    </div>
  );
}

// ── Setup screen ─────────────────────────────────────────────────────────────
function SetupScreen({
  onComplete,
}: {
  onComplete: (username: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      setError("Please enter a username.");
      return;
    }
    if (trimmed.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }
    if (trimmed.length > 16) {
      setError("Username cannot exceed 16 characters.");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setError("Only alphanumeric characters and underscores are allowed.");
      return;
    }
    onComplete(trimmed);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#080c10] px-6 py-8 animate-fade-in select-none">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-brand-green/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-green flex items-center justify-center shadow-xl shadow-brand-green/25">
            <svg
              className="w-9 h-9 text-bg-base"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
              Welcome!
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Enter your Minecraft nickname to continue.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Your Nickname
            </label>
            <input
              ref={inputRef}
              id="username-input"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError("");
              }}
              placeholder="Player123"
              maxLength={16}
              className="w-full bg-[#0e141d] border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-base focus:outline-none focus:border-brand-green/60 focus:ring-2 focus:ring-brand-green/15 transition-all placeholder:text-slate-600"
              spellCheck={false}
              autoComplete="off"
            />
            {error && (
              <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                <span>⚠</span> {error}
              </p>
            )}
          </div>

          {username.trim().length >= 2 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-[#0e141d] rounded-xl border border-slate-800 animate-fade-in">
              <Avatar
                username={username.trim()}
                size={40}
                className="rounded-lg"
              />
              <div>
                <p className="text-slate-100 text-sm font-semibold">
                  {username.trim()}
                </p>
                <p className="text-slate-500 text-xs">Profile</p>
              </div>
            </div>
          )}

          <button
            id="setup-submit"
            type="submit"
            className="w-full bg-brand-green text-bg-base font-bold py-3.5 rounded-xl hover:bg-brand-green/90 active:scale-[0.98] transition-all text-base shadow-lg shadow-brand-green/20"
          >
            Enter & Play
          </button>
        </form>

        <p className="text-center text-xs text-slate-500">
          🔒 Direct server connection without Microsoft Account
        </p>
      </div>
    </div>
  );
}

// ── Settings Sidebar ─────────────────────────────────────────────────────────
function UserPanel({
  config,
  onSave,
  onChangeUsername,
  onClose,
}: {
  config: AppConfig;
  onSave: (updated: AppConfig) => void;
  onChangeUsername: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(config);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  const handleOpenModsFolder = () => {
    const target = `${draft.game_dir}\\mods`;
    invoke("open_folder", { path: target }).catch(console.error);
  };

  const handleOpenResourcepacksFolder = () => {
    const target = `${draft.game_dir}\\resourcepacks`;
    invoke("open_folder", { path: target }).catch(console.error);
  };

  const handleOpenShaderpacksFolder = () => {
    const target = `${draft.game_dir}\\shaderpacks`;
    invoke("open_folder", { path: target }).catch(console.error);
  };

  const ramGB = (draft.max_ram_mb / 1024).toFixed(1);
  const ramPresets = [2048, 4096, 6144, 8192, 12288];

  return (
    <div className="absolute inset-0 z-50 flex animate-fade-in" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity" onClick={onClose} />

      {/* Slideout Container */}
      <div
        ref={panelRef}
        className="relative z-10 w-[340px] h-full bg-[#0a0f16]/98 backdrop-blur-2xl border-r border-slate-800/80 flex flex-col shadow-2xl animate-slide-right overflow-hidden"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/70 bg-[#0d131c]/50">
          <div className="flex items-center gap-2">
            <span className="text-brand-green text-sm">⚙</span>
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-widest">
              Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {/* Profile Card */}
          <div className="glass-card rounded-2xl p-4 border border-slate-800 relative overflow-hidden group">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-brand-green/10 blur-xl pointer-events-none" />
            <div className="flex items-center gap-3.5">
              <Avatar
                username={config.username}
                size={48}
                className="rounded-xl shadow-lg border border-slate-700/60 flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                  Player Profile
                </p>
                <p className="text-slate-100 font-bold text-base truncate leading-tight mt-0.5">
                  {config.username}
                </p>
              </div>
            </div>

            <button
              onClick={onChangeUsername}
              className="mt-3.5 w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-slate-100 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 rounded-xl py-2 transition-all"
            >
              <span>✏️</span> Switch Nickname
            </button>
          </div>

          {/* Quick Access Card */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
              Quick Folders
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                onClick={handleOpenModsFolder}
                className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-brand-green/10 to-brand-teal/5 hover:from-brand-green/20 hover:to-brand-teal/15 text-slate-200 text-xs rounded-xl border border-brand-green/20 hover:border-brand-green/40 transition-all font-semibold shadow-sm group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base text-brand-green">🧩</span>
                  <span>Mods Folder</span>
                </div>
                <span className="text-slate-400 group-hover:text-brand-green group-hover:translate-x-0.5 transition-all text-sm font-bold">
                  →
                </span>
              </button>

              <button
                onClick={handleOpenResourcepacksFolder}
                className="w-full flex items-center justify-between p-3 bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 hover:text-slate-100 text-xs rounded-xl border border-slate-800/80 hover:border-slate-700 transition-all font-medium group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base text-blue-400">🎨</span>
                  <span>Resource Packs</span>
                </div>
                <span className="text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all text-sm">
                  →
                </span>
              </button>

              <button
                onClick={handleOpenShaderpacksFolder}
                className="w-full flex items-center justify-between p-3 bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 hover:text-slate-100 text-xs rounded-xl border border-slate-800/80 hover:border-slate-700 transition-all font-medium group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base text-amber-400">✨</span>
                  <span>Shader Packs</span>
                </div>
                <span className="text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all text-sm">
                  →
                </span>
              </button>
            </div>
          </div>

          {/* Memory (RAM) Allocation */}
          <div className="glass-card rounded-2xl p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                Memory Allocation (RAM)
              </label>
              <span className="text-xs font-mono font-bold text-brand-green bg-brand-green/10 border border-brand-green/20 px-2 py-0.5 rounded-md">
                {ramGB} GB
              </span>
            </div>

            {/* Range Slider */}
            <input
              type="range"
              min={1024}
              max={16384}
              step={512}
              value={draft.max_ram_mb}
              onChange={(e) =>
                setDraft({ ...draft, max_ram_mb: Number(e.target.value) })
              }
              className="w-full h-1.5 cursor-pointer accent-brand-green"
            />

            {/* RAM Presets Chips */}
            <div className="flex items-center justify-between gap-1 pt-1">
              {ramPresets.map((mb) => {
                const gb = mb / 1024;
                const isSelected = draft.max_ram_mb === mb;
                return (
                  <button
                    key={mb}
                    onClick={() => setDraft({ ...draft, max_ram_mb: mb })}
                    className={`flex-1 py-1 text-[11px] font-mono font-medium rounded-lg transition-all border ${
                      isSelected
                        ? "bg-brand-green text-bg-base border-brand-green font-bold shadow-sm"
                        : "bg-slate-800/60 hover:bg-slate-800 text-slate-400 border-slate-700/40 hover:text-slate-200"
                    }`}
                  >
                    {gb}G
                  </button>
                );
              })}
            </div>
          </div>

          {/* Java Executable */}
          <div className="glass-card rounded-2xl p-4 border border-slate-800 space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              Java Runtime Path
            </label>
            <input
              type="text"
              value={draft.java_path}
              onChange={(e) =>
                setDraft({ ...draft, java_path: e.target.value })
              }
              className="w-full bg-[#080c10] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/20 transition-all"
              placeholder="java"
              spellCheck={false}
            />
            <p className="text-[11px] text-slate-500">
              Use <code className="text-brand-green">java</code> for default system Java 21+
            </p>
          </div>
        </div>

        {/* Bottom Save Action */}
        <div className="p-4 border-t border-slate-800/70 bg-[#0d131c]/50">
          <button
            onClick={handleSave}
            className="w-full bg-brand-green text-bg-base font-bold py-3 rounded-xl hover:bg-brand-green/90 active:scale-[0.98] transition-all text-sm shadow-lg shadow-brand-green/20"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Game Logs Screen ─────────────────────────────────────────────────────────
function GameLogsPanel({
  logs,
  isRunning,
  onClose,
}: {
  logs: LogLine[];
  isRunning: boolean;
  onClose: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  const filteredLogs = logs.filter((line) => {
    if (searchTerm && !line.msg.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#06090e] animate-fade-in select-text">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-[#090e15]/95 backdrop-blur-xl">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-slate-200 hover:text-white text-xs font-semibold transition-all border border-slate-700/50 group shadow-sm"
          title="Back to Dashboard"
        >
          <span className="text-brand-green font-bold text-sm transition-transform group-hover:-translate-x-0.5">←</span>
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isRunning ? "bg-brand-green animate-pulse shadow-[0_0_8px_#1bd96a]" : "bg-slate-600"
            }`}
          />
          <span className="text-xs font-semibold text-slate-200 tracking-wide">
            Minecraft Logs
          </span>
        </div>

        <div className="w-16" />
      </div>

      {/* Modern Search Bar */}
      <div className="px-4 py-2 border-b border-slate-800/60 bg-[#080c12] flex items-center gap-2">
        <span className="text-slate-500 text-xs">🔍</span>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter logs..."
          className="flex-1 bg-transparent text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none font-mono"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="text-slate-500 hover:text-slate-300 text-xs px-1.5 py-0.5 rounded"
          >
            ✕
          </button>
        )}
      </div>

      {/* Logs Viewport */}
      <div className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[11px] space-y-1.5 leading-relaxed bg-[#05070a]">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
            <span className="text-2xl text-slate-600">📜</span>
            <p className="text-slate-500 text-xs">
              {logs.length === 0
                ? "No logs available. Launch the game to view output."
                : "No matching logs found for your query."}
            </p>
          </div>
        ) : (
          filteredLogs.map((line) => {
            const isErr = line.level === "error";
            const isWarn = line.level === "warn";
            const isHeader = line.msg.startsWith("---") || line.msg.startsWith("===");

            return (
              <div
                key={line.id}
                className={`flex items-start gap-2.5 px-2 py-1 rounded-lg transition-colors ${
                  isErr
                    ? "bg-red-950/30 border border-red-500/25 text-red-300"
                    : isWarn
                    ? "bg-amber-950/25 border border-amber-500/20 text-amber-200"
                    : isHeader
                    ? "bg-brand-green/10 border border-brand-green/20 text-brand-green font-bold"
                    : "hover:bg-slate-900/50 text-slate-300"
                }`}
              >
                {isErr ? (
                  <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 uppercase">
                    ERR
                  </span>
                ) : isWarn ? (
                  <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 uppercase">
                    WRN
                  </span>
                ) : (
                  <span className="text-slate-600 select-none text-[10px] flex-shrink-0 w-7 text-right">
                    #{line.id}
                  </span>
                )}

                <span className="break-all whitespace-pre-wrap flex-1">
                  {line.msg}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── Server Card ───────────────────────────────────────────────────────────────
function ServerCard({
  status,
  loading,
  onRefresh,
}: {
  status: ServerStatus | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const serverTitle = cleanMotd(status?.motd) || "JSTN Minecraft Server";

  return (
    <div className="glass rounded-2xl p-5 animate-slide-up space-y-3.5 shadow-xl">
      {/* Header with Server MOTD as Title */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-slate-100 truncate tracking-tight">
            {serverTitle}
          </h2>
          {status?.version && (
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              {status.version}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800">
            <span className="relative flex h-2 w-2">
              {status?.online && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-online opacity-70" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  status?.online ? "bg-status-online" : "bg-status-offline"
                }`}
              />
            </span>
            <span
              className={`text-xs font-semibold ${
                status?.online ? "text-status-online" : "text-status-offline"
              }`}
            >
              {status?.online ? "Online" : "Offline"}
            </span>
          </div>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
            title="Refresh status"
          >
            <svg
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Server Content / Online Players List */}
      {loading && !status ? (
        <div className="flex items-center gap-2 py-3">
          <div className="h-2 w-2 rounded-full bg-slate-500 animate-pulse" />
          <span className="text-slate-500 text-xs">Checking server status…</span>
        </div>
      ) : status?.online ? (
        <div className="space-y-2.5 pt-1">
          {/* Players count header */}
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium px-1">
            <span>Players Online</span>
            <span className="font-mono font-bold text-slate-200">
              <span className="text-brand-green">{status.players_online}</span>
              <span className="text-slate-500"> / {status.players_max}</span>
            </span>
          </div>

          {/* Players list with avatars & nicknames */}
          {status.players_sample && status.players_sample.length > 0 ? (
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {status.players_sample.map((player, idx) => {
                const displayName = cleanPlayerName(player.name);
                return (
                  <div
                    key={player.id || `${displayName}-${idx}`}
                    className="flex items-center gap-2.5 px-3 py-2 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 rounded-xl transition-colors"
                  >
                    <Avatar
                      username={displayName}
                      size={26}
                      className="rounded-md flex-shrink-0"
                    />
                    <span className="text-xs font-semibold text-slate-200 truncate">
                      {displayName}
                    </span>
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-green ml-auto flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          ) : status.players_online > 0 ? (
            <div className="bg-slate-900/60 rounded-xl px-3 py-2 border border-slate-800 text-center">
              <p className="text-xs text-slate-400">
                Online: <strong className="text-brand-green">{status.players_online}</strong> {status.players_online === 1 ? "player" : "players"}
              </p>
            </div>
          ) : (
            <div className="bg-slate-900/40 rounded-xl px-3 py-3 border border-slate-800/80 text-center">
              <p className="text-xs text-slate-500">
                No players online
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-3 text-center">
          <p className="text-red-400 text-xs">
            Server is currently unreachable or offline.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [config, setConfig] = useState<AppConfig>({
    username: "",
    game_dir: "",
    java_path: "java",
    max_ram_mb: 4096,
  });

  const [panelOpen, setPanelOpen] = useState(false);
  const [changingUsername, setChangingUsername] = useState(false);

  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const [installState, setInstallState] = useState<InstallState>("unknown");
  const [installProgress, setInstallProgress] =
    useState<InstallProgress | null>(null);
  const [installError, setInstallError] = useState("");

  const [launchState, setLaunchState] = useState<LaunchState>("idle");
  const [launchMsg, setLaunchMsg] = useState("");
  const [modSyncError, setModSyncError] = useState("");
  const [isSyncingMods, setIsSyncingMods] = useState(false);
  const [modSyncProgress, setModSyncProgress] = useState<InstallProgress | null>(null);
  const [isBootingGame, setIsBootingGame] = useState(false);
  const [launchProgress, setLaunchProgress] = useState<InstallProgress>({
    step: "Starting Minecraft NeoForge 1.21.1…",
    percent: 8,
    detail: "Spawning Java Virtual Machine...",
  });

  const [gameLogs, setGameLogs] = useState<LogLine[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // ── Sync active game status ───────────────────────────────────────────────
  const syncRunningState = useCallback(async () => {
    try {
      const running = await invoke<boolean>("is_game_running");
      if (running) {
        setLaunchState((prev) => (prev === "launching" ? "launching" : "running"));
      } else {
        setLaunchState((prev) => (prev === "running" || prev === "stopping" ? "idle" : prev));
      }
    } catch {
      // ignore
    }
  }, []);

  // ── Load logs directly from latest.log ────────────────────────────────────
  const refreshLogsFromDisk = useCallback(async (dir: string) => {
    if (!dir) return;
    try {
      const logs = await invoke<LogLine[]>("get_game_logs", { gameDir: dir });
      if (logs && logs.length > 0) {
        setGameLogs(logs);
      }
    } catch (err) {
      console.error("Failed to read game logs:", err);
    }
  }, []);

  // ── Startup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const saved = await invoke<AppConfig>("get_config");
      setConfig(saved);
      if (!saved.username) {
        setScreen("setup");
      } else {
        setScreen("main");
        checkInstall(saved.game_dir);
        pingServer();
        syncRunningState();
        refreshLogsFromDisk(saved.game_dir);
      }
    })();
  }, [syncRunningState, refreshLogsFromDisk]);

  useEffect(() => {
    if (screen !== "main") return;
    const id = setInterval(pingServer, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [screen]);

  // Periodic heartbeat while running to detect when Minecraft closes
  useEffect(() => {
    if (launchState !== "running") return;
    const interval = setInterval(syncRunningState, 1500);
    return () => clearInterval(interval);
  }, [launchState, syncRunningState]);

  // Live polling for real-time logs when logs screen is open or game is running
  useEffect(() => {
    if (!showLogs && launchState !== "running") return;
    const timer = setInterval(() => {
      refreshLogsFromDisk(config.game_dir);
    }, 500);
    return () => clearInterval(timer);
  }, [showLogs, launchState, config.game_dir, refreshLogsFromDisk]);

  // Listen for install and mod sync progress events
  useEffect(() => {
    let unlistenInstall: (() => void) | null = null;
    let unlistenMod: (() => void) | null = null;

    listen<InstallProgress>("install:progress", (e) => {
      if (e.payload) {
        setInstallProgress((prev) => ({
          step: e.payload.step || prev?.step || "Installing NeoForge 1.21.1…",
          percent: Math.max(prev?.percent ?? 0, e.payload.percent),
          detail: e.payload.detail || prev?.detail || "",
        }));
        setLaunchProgress(e.payload);
      }
    }).then((fn) => {
      unlistenInstall = fn;
    });

    listen<InstallProgress>("mod:progress", (e) => {
      if (e.payload) {
        setIsSyncingMods(true);
        setModSyncProgress(e.payload);
        setLaunchProgress(e.payload);
        setInstallProgress((prev) => ({
          step: e.payload.step || prev?.step || "Syncing server mods…",
          percent: Math.max(prev?.percent ?? 0, e.payload.percent),
          detail: e.payload.detail || prev?.detail || "",
        }));
      }
    }).then((fn) => {
      unlistenMod = fn;
    });

    return () => {
      if (unlistenInstall) unlistenInstall();
      if (unlistenMod) unlistenMod();
    };
  }, []);

  // Smooth progress interpolator for installer to ensure percentages are active and responsive
  useEffect(() => {
    if (installState !== "installing") return;

    const timer = setInterval(() => {
      setInstallProgress((prev) => {
        if (!prev) {
          return {
            step: "Searching Forge/NeoForge for MC 1.21.1…",
            percent: 6,
            detail: "Connecting to maven.neoforged.net...",
          };
        }
        if (prev.percent < 90) {
          const next = prev.percent + 1;
          let step = prev.step;
          let detail = prev.detail;
          if (next <= 12 && (!detail || detail.includes("Connecting"))) {
            detail = "Searching latest NeoForge 1.21.1 build...";
          } else if (next > 12 && next <= 25 && (!detail || detail.includes("Searching"))) {
            step = "Downloading Forge 1.21.1 installer…";
            detail = "Receiving installer packages from Maven CDN...";
          } else if (next > 25 && next <= 68 && (!detail || detail.includes("Receiving"))) {
            step = "Running Forge Java Installer…";
            detail = "Executing client patcher & unpacking libraries...";
          } else if (next > 68 && next <= 84 && (!detail || detail.includes("Executing"))) {
            step = "Downloading vanilla client libraries…";
            detail = "Fetching LWJGL, ASM & core dependencies...";
          } else if (next > 84 && (!detail || detail.includes("Fetching"))) {
            step = "Verifying game sound & texture assets…";
            detail = "Checking assets from Mojang CDN...";
          }
          return {
            step,
            percent: next,
            detail,
          };
        }
        return prev;
      });
    }, 450);

    return () => clearInterval(timer);
  }, [installState]);

  // Listen for game logs, started, and stopped events
  useEffect(() => {
    const unlistens: Array<() => void> = [];

    listen<{ level: "info" | "warn" | "error"; msg: string }>("game:log", (e) => {
      const rawMsg = e.payload.msg;

      setLaunchProgress((prev) => {
        const parsed = parseGameLogMilestone(rawMsg, prev.percent);
        if (parsed.percent >= 96) {
          setTimeout(() => setIsBootingGame(false), 1500);
        }
        return {
          step: parsed.step,
          percent: parsed.percent,
          detail: rawMsg,
        };
      });

      const line: LogLine = {
        id: ++logIdCounter,
        level: e.payload.level || "info",
        msg: rawMsg,
      };
      setGameLogs((prev) => {
        const next = [...prev, line];
        return next.length > MAX_LOG_LINES
          ? next.slice(next.length - MAX_LOG_LINES)
          : next;
      });
    }).then((fn) => unlistens.push(fn));

    listen<{ pid: number }>("game:started", (e) => {
      setLaunchState("running");
      setLaunchMsg(`Minecraft running (PID: ${e.payload.pid})`);
      setLaunchProgress((prev) => ({
        ...prev,
        percent: Math.max(prev.percent, 15),
        step: "Java 21 process active",
        detail: `Process ID: ${e.payload.pid}`,
      }));
    }).then((fn) => unlistens.push(fn));

    listen<{ exit_code: number }>("game:stopped", () => {
      setLaunchState("idle");
      setIsBootingGame(false);
      setLaunchMsg("");
      setLaunchProgress({
        step: "Starting Minecraft NeoForge 1.21.1…",
        percent: 8,
        detail: "",
      });
    }).then((fn) => unlistens.push(fn));

    return () => unlistens.forEach((fn) => fn());
  }, []);

  // When user opens logs, immediately reload from disk
  const handleOpenLogs = useCallback(() => {
    refreshLogsFromDisk(config.game_dir);
    setShowLogs(true);
  }, [config.game_dir, refreshLogsFromDisk]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const pingServer = useCallback(async () => {
    setStatusLoading(true);
    try {
      const s = await invoke<ServerStatus>("ping_server");
      setServerStatus(s);
    } catch {
      setServerStatus({
        online: false,
        players_online: 0,
        players_max: 0,
        players_sample: [],
        motd: "",
        version: "",
      });
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const checkInstall = useCallback(async (dir: string) => {
    setInstallState("checking");
    const installed = await invoke<boolean>("check_installation", {
      gameDir: dir,
    });
    setInstallState(installed ? "installed" : "not_installed");
  }, []);

  const handleSetupComplete = useCallback(
    async (username: string) => {
      const updated = { ...config, username };
      await invoke("save_config", { config: updated });
      setConfig(updated);
      setScreen("main");
      checkInstall(updated.game_dir);
      pingServer();
      refreshLogsFromDisk(updated.game_dir);
    },
    [config, checkInstall, pingServer, refreshLogsFromDisk]
  );

  const handleSaveSettings = useCallback(
    async (updated: AppConfig) => {
      await invoke("save_config", { config: updated });
      setConfig(updated);
      refreshLogsFromDisk(updated.game_dir);
    },
    [refreshLogsFromDisk]
  );

  const handleChangeUsername = useCallback(() => {
    setPanelOpen(false);
    setChangingUsername(true);
    setScreen("setup");
  }, []);

  const handleInstall = useCallback(async () => {
    setInstallState("installing");
    setInstallProgress({
      step: "Searching Forge/NeoForge for MC 1.21.1…",
      percent: 5,
      detail: "Connecting to maven.neoforged.net...",
    });
    setInstallError("");
    setModSyncError("");
    try {
      await invoke<string>("install_game", { gameDir: config.game_dir });

      // Pre-sync server mods right after installation
      setIsSyncingMods(true);
      setModSyncProgress({
        step: "Synchronizing server mods…",
        percent: 5,
        detail: "Connecting to mod server...",
      });
      try {
        await invoke<SyncSummary>("sync_server_mods", { gameDir: config.game_dir });
      } catch (modErr) {
        console.warn("Initial mod sync note:", modErr);
      } finally {
        setIsSyncingMods(false);
        setModSyncProgress(null);
      }

      setInstallProgress({
        step: "Installation complete!",
        percent: 100,
        detail: "NeoForge 1.21.1 and mods are ready to play!",
      });
      setTimeout(async () => {
        setInstallState("installed");
        await checkInstall(config.game_dir);
      }, 700);
    } catch (err) {
      setIsSyncingMods(false);
      setModSyncProgress(null);
      setInstallError(
        typeof err === "string" ? err : "Installation failed. Please verify Java 21+ is installed."
      );
      setInstallState("error");
    }
  }, [config.game_dir, checkInstall]);

  const handlePlay = useCallback(async () => {
    if (launchState === "launching" || launchState === "running" || isSyncingMods) return;
    setLaunchState("launching");
    setIsSyncingMods(true);
    setModSyncError("");
    setModSyncProgress({
      step: "Connecting to Mod Server…",
      percent: 5,
      detail: "Checking mods, resource packs & shaders...",
    });
    setLaunchProgress({
      step: "Connecting to Mod Server…",
      percent: 5,
      detail: "Checking mods, resource packs & shaders...",
    });
    setLaunchMsg("Checking & syncing server content…");

    // 1. Mandatory Modpack Sync with Server (blocks entry if mod server is unreachable)
    try {
      const syncResult = await invoke<SyncSummary>("sync_server_mods", {
        gameDir: config.game_dir,
      });
      setGameLogs((prev) => [
        ...prev,
        {
          id: ++logIdCounter,
          level: "info",
          msg: `[Content Sync] ${syncResult.message} (${syncResult.downloaded} downloaded, ${syncResult.removed} removed, ${syncResult.up_to_date} verified)`,
        },
      ]);
    } catch (syncErr) {
      const errMsg =
        typeof syncErr === "string"
          ? syncErr
          : "The mod server is currently offline or unreachable. Please wait a few moments or ask the server administrator to start the mod server.";
      setLaunchState("error");
      setIsSyncingMods(false);
      setModSyncProgress(null);
      setIsBootingGame(false);
      setModSyncError(errMsg);
      setLaunchMsg("");
      setGameLogs((prev) => [
        ...prev,
        { id: ++logIdCounter, level: "error", msg: "=== MOD SERVER OFFLINE ===" },
        { id: ++logIdCounter, level: "error", msg: errMsg },
      ]);
      setTimeout(() => {
        setLaunchState("idle");
      }, 10_000);
      return; // Stop here! Do not launch Minecraft if mod server is offline!
    } finally {
      setIsSyncingMods(false);
      setModSyncProgress(null);
    }

    // 2. Mod sync verified! Proceed to launch Java Minecraft process
    setIsBootingGame(true);
    setLaunchProgress({
      step: "Starting Java 21 Runtime…",
      percent: 12,
      detail: "Launching Minecraft NeoForge 1.21.1...",
    });
    setLaunchMsg("Launching Minecraft NeoForge 1.21.1…");

    // Auto-complete booting transition after 10s fallback if game window takes focus
    setTimeout(() => {
      setIsBootingGame(false);
    }, 10_000);

    try {
      const msg = await invoke<string>("launch_game", { config });
      setLaunchState("running");
      setLaunchMsg(msg);
    } catch (err) {
      const errMsg = typeof err === "string" ? err : "Launch failed.";
      setLaunchState("error");
      setIsBootingGame(false);
      setLaunchMsg(errMsg);
      setGameLogs((prev) => [
        ...prev,
        { id: ++logIdCounter, level: "error", msg: "=== LAUNCH ERROR ===" },
        { id: ++logIdCounter, level: "error", msg: errMsg },
      ]);
      setTimeout(() => {
        setLaunchState("idle");
        setLaunchMsg("");
      }, 10_000);
    }
  }, [launchState, isSyncingMods, config]);

  const handleStopGame = useCallback(async () => {
    if (launchState !== "running") return;
    setLaunchState("stopping");
    setLaunchMsg("Stopping Minecraft…");
    try {
      await invoke("kill_game");
      setLaunchState("idle");
      setLaunchMsg("");
    } catch (err) {
      console.error("Failed to kill game:", err);
      setLaunchState("idle");
    }
  }, [launchState]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (screen === "loading") return <LoadingScreen />;

  if (screen === "setup") {
    return (
      <SetupScreen
        onComplete={async (uname) => {
          if (changingUsername) {
            const updated = { ...config, username: uname };
            await invoke("save_config", { config: updated });
            setConfig(updated);
            setChangingUsername(false);
            setScreen("main");
          } else {
            handleSetupComplete(uname);
          }
        }}
      />
    );
  }

  const isInstalled = installState === "installed";
  const isInstalling = installState === "installing";
  const isRunning = launchState === "running";
  const showProgressBar =
    isInstalling || isSyncingMods || launchState === "launching" || (isRunning && isBootingGame);

  const activeProgress: InstallProgress = isSyncingMods
    ? (modSyncProgress || {
        step: "Syncing mods, resource packs & shaders…",
        percent: 5,
        detail: "Connecting to mod server...",
      })
    : isInstalling
    ? (installProgress || {
        step: "Downloading & Installing NeoForge 1.21.1…",
        percent: 0,
        detail: "Downloading files...",
      })
    : launchProgress;

  return (
    <div className="relative flex flex-col h-screen bg-[#080c10] text-slate-100 overflow-hidden animate-fade-in select-none">
      {/* Background glows */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-brand-green/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-brand-teal/4 blur-3xl" />
      </div>

      {/* Game Logs overlay */}
      {showLogs && (
        <GameLogsPanel
          logs={gameLogs}
          isRunning={isRunning}
          onClose={() => setShowLogs(false)}
        />
      )}

      {/* User settings panel */}
      {panelOpen && (
        <UserPanel
          config={config}
          onSave={handleSaveSettings}
          onChangeUsername={handleChangeUsername}
          onClose={() => setPanelOpen(false)}
        />
      )}

      {/* Minimal Header */}
      <header className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-[#0c1219]/40 backdrop-blur-md">
        <button
          id="user-menu-btn"
          onClick={() => setPanelOpen(true)}
          className="flex items-center gap-2.5 hover:bg-slate-800/60 rounded-xl px-2.5 py-1.5 transition-all group"
          title="Account & Settings"
        >
          <Avatar
            username={config.username}
            size={32}
            className="group-hover:border-brand-green/50 transition-all shadow-sm"
          />
          <span className="text-sm font-semibold text-slate-200 max-w-[140px] truncate">
            {config.username}
          </span>
        </button>

        {/* Top Logs button */}
        <button
          onClick={handleOpenLogs}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-all border ${
            isRunning
              ? "bg-brand-green/10 border-brand-green/30 text-brand-green font-medium"
              : "text-slate-400 hover:text-slate-200 border-slate-800 bg-slate-900/60 hover:bg-slate-800/80"
          }`}
          title="Open Minecraft Logs"
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              isRunning ? "bg-brand-green animate-pulse" : "bg-slate-500"
            }`}
          />
          <span>Logs</span>
        </button>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col px-4 py-4 gap-3 overflow-hidden justify-between">
        {/* Server status card */}
        <ServerCard
          status={serverStatus}
          loading={statusLoading}
          onRefresh={pingServer}
        />

        {/* BOTTOM ACTION AREA: Status info + Primary Action / Inline Installer */}
        <div className="space-y-2 select-none">
          {/* Active status strip (Clean info without log spam) */}
          {(launchMsg || isRunning) && !modSyncError && !showProgressBar && (
            <div
              className={`rounded-xl p-2.5 border text-xs flex items-center justify-between transition-all shadow-md ${
                launchState === "error"
                  ? "border-red-500/30 bg-red-950/30 text-red-300"
                  : isRunning
                  ? "border-brand-green/30 bg-[#0a1410] text-slate-200"
                  : "border-slate-800 bg-[#0b1018] text-slate-300"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    launchState === "error"
                      ? "bg-red-400"
                      : isRunning
                      ? "bg-brand-green animate-pulse shadow-[0_0_8px_#1bd96a]"
                      : "bg-amber-400 animate-pulse"
                  }`}
                />
                <span className="truncate font-medium text-slate-200">
                  {launchMsg || (isRunning ? "Minecraft NeoForge 1.21.1 is running" : "")}
                </span>
              </div>

              {isRunning && (
                <button
                  onClick={handleOpenLogs}
                  className="text-[11px] text-brand-green hover:underline flex-shrink-0 pl-2 font-mono"
                >
                  Logs ↗
                </button>
              )}
            </div>
          )}

          {/* If there's an install error or mod sync error */}
          {(installState === "error" || modSyncError) && (
            <div className="rounded-xl p-3 border border-red-500/30 bg-red-950/35 text-xs space-y-1.5 animate-fade-in shadow-lg shadow-red-950/20">
              <div className="flex items-center justify-between">
                <p className="text-red-300 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                  {modSyncError ? "Mod Server Offline" : "Installation Failed"}
                </p>
                {modSyncError && (
                  <button
                    onClick={() => setModSyncError("")}
                    className="text-[11px] text-red-400/80 hover:text-red-200 transition-colors px-1.5 py-0.5 rounded hover:bg-red-900/30"
                  >
                    Dismiss ✕
                  </button>
                )}
              </div>
              <p className="text-red-300/90 text-xs leading-relaxed">
                {modSyncError || installError || "Unknown error during operation."}
              </p>
            </div>
          )}

          {/* MAIN BUTTON / INLINE INSTALLER & LAUNCH PROGRESS */}
          {showProgressBar ? (
            /* Inline Progress Bar during Installation OR Mod Sync OR Minecraft Loading/Booting */
            <div className="glass-card rounded-2xl p-3.5 border border-brand-green/30 space-y-2 shadow-lg shadow-brand-green/10 animate-fade-in bg-[#0c121a]/95">
              <div className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2 truncate">
                  <svg
                    className="w-3.5 h-3.5 animate-spin text-brand-green flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <span className="text-slate-200 truncate font-medium">
                    {activeProgress.step}
                  </span>
                </div>
                <span className="font-mono text-brand-green font-bold pl-2 text-xs">
                  {Math.min(100, Math.max(0, activeProgress.percent))}%
                </span>
              </div>

              {/* Progress Track */}
              <div className="h-2 bg-[#06090e] rounded-full overflow-hidden p-0.5 border border-slate-800/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-teal to-brand-green transition-all duration-300 shadow-sm"
                  style={{
                    width: `${Math.min(100, Math.max(0, activeProgress.percent))}%`,
                  }}
                />
              </div>

              {/* Live detail ticker (mod download filename & MB or install step) */}
              {activeProgress.detail && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/50 border border-slate-800/80 overflow-hidden text-[10px] font-mono text-slate-300">
                  <span className="text-brand-green font-bold flex-shrink-0">›</span>
                  <span className="truncate">
                    {activeProgress.detail}
                  </span>
                </div>
              )}
            </div>
          ) : !isInstalled ? (
            /* Install Client Button */
            <button
              id="install-btn"
              onClick={handleInstall}
              disabled={installState === "checking"}
              className="w-full py-4 rounded-2xl font-bold text-base bg-gradient-to-r from-emerald-600 to-brand-green hover:from-emerald-500 hover:to-brand-green/90 text-bg-base shadow-xl shadow-brand-green/20 hover:shadow-brand-green/35 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              {installState === "checking" ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Checking client…
                </span>
              ) : (
                <>
                  <svg
                    className="w-5 h-5 fill-current"
                    viewBox="0 0 24 24"
                  >
                    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z" />
                  </svg>
                  <span>Install NeoForge 1.21.1</span>
                </>
              )}
            </button>
          ) : isRunning ? (
            /* Stop Minecraft Button */
            <button
              id="stop-btn"
              onClick={handleStopGame}
              className="w-full py-4 rounded-2xl font-bold text-base transition-all duration-200 bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-red-600/30 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M6 6h12v12H6z" />
              </svg>
              Stop Minecraft
            </button>
          ) : launchState === "stopping" ? (
            /* Stopping Spinner Button */
            <button
              disabled
              className="w-full py-4 rounded-2xl font-bold text-base bg-slate-900 text-slate-500 cursor-not-allowed border border-slate-800 flex items-center justify-center gap-2"
            >
              <svg
                className="w-5 h-5 animate-spin"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Stopping Minecraft…
            </button>
          ) : (
            /* Play Game Button */
            <button
              id="play-btn"
              onClick={handlePlay}
              className="w-full py-4 rounded-2xl font-bold text-base bg-gradient-to-r from-emerald-600 to-brand-green hover:from-emerald-500 hover:to-brand-green/90 text-bg-base shadow-xl shadow-brand-green/20 hover:shadow-brand-green/35 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Play
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
