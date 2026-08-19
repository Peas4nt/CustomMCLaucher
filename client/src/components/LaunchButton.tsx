import React from 'react';
import { Download, Loader2, Sparkles, X } from 'lucide-react';
import { SyncProgressData } from '../types';

interface LaunchButtonProps {
  isInstalled: boolean;
  isSyncing: boolean;
  isLaunching: boolean;
  isGameRunning: boolean;
  progress: SyncProgressData | null;
  onAction: () => void;
  onKillGame: () => void;
  onShowLogs?: () => void;
}

export const LaunchButton: React.FC<LaunchButtonProps> = ({
  isInstalled,
  isSyncing,
  isLaunching,
  isGameRunning,
  progress,
  onAction,
  onKillGame,
}) => {
  const isBusy = isSyncing || isLaunching;
  const isDownloadingMods = isSyncing && progress && progress.totalFiles > 0;

  return (
    <div className="flex flex-col items-center gap-2 w-full max-w-sm">
      <div className="flex w-full gap-2 relative">
        <button
          onClick={isGameRunning ? onKillGame : onAction}
          disabled={isBusy && !isGameRunning}
          className={`relative flex-1 h-14 px-8 rounded-2xl font-black text-xs uppercase tracking-widest font-mono transition-all duration-300 transform active:scale-98 overflow-hidden group shadow-xl ${
            isGameRunning
              ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-[0_0_25px_rgba(225,29,72,0.4)] border border-rose-500/40'
              : isDownloadingMods
              ? 'bg-[#181b24] text-white border border-[#d97757]/40 shadow-[0_0_25px_rgba(217,119,87,0.25)]'
              : isBusy
              ? 'bg-slate-800 text-slate-400 border border-white/10 cursor-not-allowed'
              : 'terracotta-gradient text-[#1a0e08] hover:brightness-110 shadow-[0_0_30px_rgba(217,119,87,0.4)] border border-[#e89d75]/50'
          }`}
        >
          {/* Live Progress Bar Fill inside Button */}
          {isDownloadingMods ? (
            <div
              className="absolute inset-0 bg-gradient-to-r from-[#d97757] to-[#e89d75] transition-all duration-150 ease-out"
              style={{ width: `${Math.max(progress.progressPercent, 4)}%` }}
            />
          ) : (
            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          )}

          <div className="relative z-10 flex items-center justify-center gap-2.5 font-black">
            {isGameRunning ? (
              <>
                <X className="w-4 h-4 stroke-[3]" />
                <span>TERMINATE</span>
              </>
            ) : isDownloadingMods ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#1a0e08]" />
                <span className="text-[#1a0e08] font-black drop-shadow-sm">
                  MODS: {progress.filesCompleted} / {progress.totalFiles} ({progress.progressPercent.toFixed(0)}%)
                </span>
              </>
            ) : isSyncing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>SYNCING...</span>
              </>
            ) : isLaunching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>STARTING...</span>
              </>
            ) : isInstalled ? (
              <>
                <Sparkles className="w-4 h-4 stroke-[2.5]" />
                <span>PLAY</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>DOWNLOAD</span>
              </>
            )}
          </div>
        </button>
      </div>

      {/* Progress Details Subtitle */}
      {isDownloadingMods && (
        <div className="w-full flex items-center justify-between px-1 text-[11px] font-mono text-slate-400 animate-in fade-in">
          <span className="text-[#df9168] font-bold">
            {progress.filesCompleted} downloaded
          </span>
          <span className="text-slate-500 font-medium">
            {progress.totalFiles - progress.filesCompleted} remaining
          </span>
        </div>
      )}
    </div>
  );
};
