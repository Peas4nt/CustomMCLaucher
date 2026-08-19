import React from 'react';
import { Folder, Sparkles, Image, FileText, Layers } from 'lucide-react';
import { TauriService } from '../services/tauri';

export const FolderShortcuts: React.FC = () => {
  const handleOpen = (folder: 'mods' | 'config' | 'shaderpacks' | 'resourcepacks' | 'screenshots' | 'logs') => {
    TauriService.openFolder(folder);
  };

  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      <button
        onClick={() => handleOpen('mods')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-button text-xs font-medium text-slate-300 hover:text-emerald-300"
        title="Open Mods directory"
      >
        <Folder className="w-3.5 h-3.5 text-emerald-400" />
        <span>Mods</span>
      </button>

      <button
        onClick={() => handleOpen('shaderpacks')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-button text-xs font-medium text-slate-300 hover:text-cyan-300"
        title="Open Shaders directory"
      >
        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
        <span>Shaders</span>
      </button>

      <button
        onClick={() => handleOpen('resourcepacks')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-button text-xs font-medium text-slate-300 hover:text-amber-300"
        title="Open Resource Packs directory"
      >
        <Layers className="w-3.5 h-3.5 text-amber-400" />
        <span>Resource Packs</span>
      </button>

      <button
        onClick={() => handleOpen('screenshots')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-button text-xs font-medium text-slate-300 hover:text-purple-300"
        title="Open Screenshots directory"
      >
        <Image className="w-3.5 h-3.5 text-purple-400" />
        <span>Screenshots</span>
      </button>

      <button
        onClick={() => handleOpen('logs')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-button text-xs font-medium text-slate-300 hover:text-rose-300"
        title="Open Crash Logs directory"
      >
        <FileText className="w-3.5 h-3.5 text-rose-400" />
        <span>Logs</span>
      </button>
    </div>
  );
};
