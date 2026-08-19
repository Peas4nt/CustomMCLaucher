import React, { useState, useEffect } from 'react';
import { LauncherSettings } from '../types';
import { TauriService } from '../services/tauri';
import { Sliders, HardDrive, Cpu, Monitor, Check, FolderOpen } from 'lucide-react';

const getInitialSettings = (): LauncherSettings => {
  try {
    const cached = localStorage.getItem('cml_settings_cache');
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {}
  return {
    min_ram_mb: 2048,
    max_ram_mb: 4096,
    java_path: null,
    custom_game_dir: null,
    window_width: 1280,
    window_height: 720,
    close_after_launch: false,
  };
};

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<LauncherSettings>(getInitialSettings);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    TauriService.getSettings().then((s) => {
      if (s) {
        setSettings(s);
        try {
          localStorage.setItem('cml_settings_cache', JSON.stringify(s));
        } catch {}
      }
    });
  }, []);

  const handleSave = async () => {
    try {
      localStorage.setItem('cml_settings_cache', JSON.stringify(settings));
    } catch {}
    await TauriService.saveSettings(settings);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
    }, 1500);
  };

  const ramPresets = [2048, 4096, 6144, 8192, 12288, 16384];

  return (
    <div className="w-full h-full flex flex-col p-6 sm:p-10 overflow-y-auto custom-scrollbar animate-in fade-in duration-150">
      <div className="max-w-4xl mx-auto w-full space-y-8 pb-24">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#d97757] mb-1">
              <Sliders className="w-4 h-4" />
              <span>Configuration</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Launcher & Game Settings
            </h1>
          </div>

          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#d97757] to-[#e89d75] hover:brightness-110 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(217,119,87,0.35)] w-fit"
          >
            {isSaved ? <Check className="w-4 h-4 stroke-[3]" /> : null}
            <span>{isSaved ? 'Settings Saved' : 'Save Changes'}</span>
          </button>
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-1 gap-6">
          {/* RAM Allocation */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 space-y-5 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#d97757]/20 text-[#df9168] border border-[#d97757]/30">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Memory Allocation (RAM)</h3>
                  <p className="text-xs text-slate-400">Maximum heap size allocated to Minecraft process</p>
                </div>
              </div>
              <div className="px-4 py-1.5 rounded-xl bg-slate-800 border border-white/10 font-mono font-bold text-sm text-[#df9168]">
                {(settings.max_ram_mb / 1024).toFixed(1)} GB
              </div>
            </div>

            {/* Slider */}
            <div className="space-y-3 pt-2">
              <input
                type="range"
                min="2048"
                max="16384"
                step="1024"
                value={settings.max_ram_mb}
                onChange={(e) => setSettings({ ...settings, max_ram_mb: parseInt(e.target.value, 10) })}
                className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#d97757]"
              />
              
              {/* Presets */}
              <div className="flex flex-wrap gap-2 pt-1">
                {ramPresets.map((mb) => (
                  <button
                    key={mb}
                    onClick={() => setSettings({ ...settings, max_ram_mb: mb })}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                      settings.max_ram_mb === mb
                        ? 'bg-[#d97757] text-white shadow-md'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                    }`}
                  >
                    {mb / 1024} GB
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Java Runtime */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 space-y-4 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Java Executable Path</h3>
                <p className="text-xs text-slate-400">Path to custom OpenJDK / Hotspot runtime binary (Optional)</p>
              </div>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                placeholder="Leave empty to use automatic system OpenJDK 17/21 runtime"
                value={settings.java_path || ''}
                onChange={(e) => setSettings({ ...settings, java_path: e.target.value || null })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#d97757] font-mono"
              />
              <p className="text-[11px] text-slate-500">
                By default, launcher detects and uses Microsoft OpenJDK 21 LTS or bundled system Java.
              </p>
            </div>
          </div>

          {/* Window Dimensions */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 space-y-4 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                <Monitor className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Client Resolution</h3>
                <p className="text-xs text-slate-400">Default game viewport resolution on launch</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-slate-400 font-mono">Width (pixels)</span>
                <input
                  type="number"
                  value={settings.window_width}
                  onChange={(e) => setSettings({ ...settings, window_width: parseInt(e.target.value, 10) || 1280 })}
                  className="w-full mt-1.5 px-4 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-sm text-slate-200 focus:outline-none focus:border-[#d97757] font-mono"
                />
              </div>
              <div>
                <span className="text-xs text-slate-400 font-mono">Height (pixels)</span>
                <input
                  type="number"
                  value={settings.window_height}
                  onChange={(e) => setSettings({ ...settings, window_height: parseInt(e.target.value, 10) || 720 })}
                  className="w-full mt-1.5 px-4 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-sm text-slate-200 focus:outline-none focus:border-[#d97757] font-mono"
                />
              </div>
            </div>
          </div>

          {/* Folder Shortcuts */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 space-y-4 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Game Directory Shortcuts</h3>
                <p className="text-xs text-slate-400">Open active launcher directories directly in system file explorer</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              {([
                { name: 'Root (.minecraft)', folder: 'root' as const },
                { name: 'Mods Folder', folder: 'mods' as const },
                { name: 'Configs', folder: 'config' as const },
                { name: 'Screenshots', folder: 'screenshots' as const },
              ]).map((item) => (
                <button
                  key={item.folder}
                  onClick={() => TauriService.openFolder(item.folder)}
                  className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all text-xs font-semibold border border-white/5 text-center flex items-center justify-center gap-2"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-[#df9168]" />
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
