import React, { useState, useEffect } from 'react';
import { LauncherSettings } from '../types';
import { TauriService } from '../services/tauri';
import { X, Sliders, HardDrive, Cpu, Monitor, Check, FolderOpen } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<LauncherSettings>({
    min_ram_mb: 2048,
    max_ram_mb: 4096,
    java_path: null,
    custom_game_dir: null,
    window_width: 1280,
    window_height: 720,
    close_after_launch: false,
  });
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      TauriService.getSettings().then(setSettings);
      setIsSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    await TauriService.saveSettings(settings);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 600);
  };

  const ramPresets = [2048, 4096, 6144, 8192, 12288, 16384];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-3xl bg-[#141720] p-7 shadow-2xl border border-white/10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#d97757]/20 text-[#df9168] border border-[#d97757]/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white uppercase tracking-wider font-mono">
                Launcher Settings
              </h2>
              <p className="text-xs text-slate-400 font-sans">
                Configure RAM allocation, Java runtime, and screen resolution
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
          {/* RAM Allocation */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#df9168]" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                  Memory Allocation (RAM)
                </span>
              </div>
              <span className="px-3 py-1 rounded-xl bg-black/40 border border-white/10 text-sm font-bold text-[#df9168] font-mono">
                {(settings.max_ram_mb / 1024).toFixed(1)} GB
              </span>
            </div>
            <input
              type="range"
              min="2048"
              max="16384"
              step="1024"
              value={settings.max_ram_mb}
              onChange={(e) => setSettings({ ...settings, max_ram_mb: parseInt(e.target.value, 10) })}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#d97757]"
            />
            {/* Presets */}
            <div className="flex flex-wrap gap-2 pt-1">
              {ramPresets.map((mb) => (
                <button
                  key={mb}
                  type="button"
                  onClick={() => setSettings({ ...settings, max_ram_mb: mb })}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    settings.max_ram_mb === mb
                      ? 'bg-[#d97757] text-white shadow-md'
                      : 'bg-white/5 hover:bg-white/10 text-slate-400 border border-white/5'
                  }`}
                >
                  {mb / 1024} GB
                </button>
              ))}
            </div>
          </div>

          {/* Java Path */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-white/5 space-y-2">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-cyan-400" />
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                Custom Java Runtime (Optional)
              </label>
            </div>
            <input
              type="text"
              placeholder="Leave empty to use automatic system OpenJDK 17/21"
              value={settings.java_path || ''}
              onChange={(e) => setSettings({ ...settings, java_path: e.target.value || null })}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#d97757] font-mono"
            />
          </div>

          {/* Window Resolution */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-white/5 space-y-3">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                Client Resolution
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-400 font-mono">Width (px)</span>
                <input
                  type="number"
                  value={settings.window_width}
                  onChange={(e) => setSettings({ ...settings, window_width: parseInt(e.target.value, 10) || 1280 })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white focus:outline-none focus:border-[#d97757] font-mono"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 font-mono">Height (px)</span>
                <input
                  type="number"
                  value={settings.window_height}
                  onChange={(e) => setSettings({ ...settings, window_height: parseInt(e.target.value, 10) || 720 })}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs text-white focus:outline-none focus:border-[#d97757] font-mono"
                />
              </div>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-white/5 flex justify-between items-center">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
              Game Folders
            </div>
            <button
              onClick={() => TauriService.openFolder('mods')}
              className="px-4 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono font-bold text-[#df9168] transition-colors border border-white/5 flex items-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Open Mods Folder</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-400"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl terracotta-gradient hover:brightness-110 text-white font-bold text-xs uppercase font-mono transition-all shadow-lg"
          >
            {isSaved ? <Check className="w-4 h-4" /> : null}
            <span>{isSaved ? 'Saved!' : 'Save Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
