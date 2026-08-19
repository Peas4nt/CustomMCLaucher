import React, { useRef, useEffect, useState } from 'react';
import { Terminal, X, Trash2, Copy, Check } from 'lucide-react';
import { TauriService } from '../services/tauri';

interface GameLogEntry {
  text: string;
  stream: string;
  timestamp: string;
}

interface GameLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: GameLogEntry[];
  onClearLogs: () => void;
}

export const GameLogsModal: React.FC<GameLogsModalProps> = ({
  isOpen,
  onClose,
  logs: propLogs,
  onClearLogs,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [modalLogs, setModalLogs] = useState<GameLogEntry[]>(propLogs);

  // Sync prop logs
  useEffect(() => {
    if (propLogs.length > 0) {
      setModalLogs(propLogs);
    }
  }, [propLogs]);

  // Real-time polling while console modal is open
  useEffect(() => {
    if (!isOpen) return;

    // Fetch immediately
    TauriService.getGameLogs().then((backendLogs) => {
      if (backendLogs && backendLogs.length > 0) {
        setModalLogs(backendLogs);
      }
    });

    const interval = setInterval(async () => {
      const backendLogs = await TauriService.getGameLogs();
      if (backendLogs && backendLogs.length > 0) {
        setModalLogs(backendLogs);
      }
    }, 400);

    return () => clearInterval(interval);
  }, [isOpen]);

  const containerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollEnabled = useRef<boolean>(true);

  // Auto-scroll logic: only auto-scroll if user is near bottom and not currently selecting text
  useEffect(() => {
    if (!isOpen) return;

    const selection = window.getSelection()?.toString();
    if (selection && selection.length > 0) {
      // User is currently selecting text with mouse, do not interrupt!
      return;
    }

    if (containerRef.current && isAutoScrollEnabled.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [modalLogs.length, isOpen]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    // If user is within 60px of the bottom, keep auto-scroll on
    isAutoScrollEnabled.current = scrollHeight - scrollTop - clientHeight < 60;
  };

  if (!isOpen) return null;

  const handleClear = async () => {
    await TauriService.clearGameLogs();
    setModalLogs([]);
    onClearLogs();
  };

  const handleCopy = () => {
    const fullText = modalLogs.map((l) => `[${l.timestamp}] [${l.stream.toUpperCase()}] ${l.text}`).join('\n');
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-4xl h-[80vh] flex flex-col glass-panel-elevated rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900/90 border-b border-white/5 select-none">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center border border-white/5">
              <Terminal className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Minecraft Process Console</h2>
              <p className="text-[11px] text-slate-400 font-mono">Live stdout / stderr stream (Select text to copy)</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors border border-white/5"
              title="Copy all logs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied All' : 'Copy All'}</span>
            </button>

            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors border border-white/5"
              title="Clear console"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors border border-white/5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Terminal output */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 p-4 overflow-y-auto font-mono text-xs bg-[#070a0f] select-text cursor-text selection:bg-emerald-500 selection:text-white space-y-1"
        >
          {modalLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-600 select-none">
              No logs emitted yet. Launching game process...
            </div>
          ) : (
            modalLogs.map((log, i) => (
              <div
                key={i}
                className={`flex gap-3 leading-relaxed select-text ${
                  log.stream === 'stderr' ? 'text-rose-400' : 'text-slate-300'
                }`}
              >
                <span className="text-slate-600 select-none shrink-0 font-mono text-[10px]">
                  [{log.timestamp}]
                </span>
                <span className="break-all whitespace-pre-wrap select-text">{log.text}</span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
};
