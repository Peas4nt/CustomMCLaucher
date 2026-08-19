import React, { useRef, useEffect, useState } from 'react';
import { Terminal, Trash2, Copy, Check, Search, ArrowDown } from 'lucide-react';
import { TauriService } from '../services/tauri';

interface GameLogEntry {
  text: string;
  stream: string;
  timestamp: string;
}

interface LogsViewProps {
  logs: GameLogEntry[];
  onClearLogs: () => void;
}

export const LogsView: React.FC<LogsViewProps> = ({ logs: propLogs, onClearLogs }) => {
  const [copied, setCopied] = useState(false);
  const [modalLogs, setModalLogs] = useState<GameLogEntry[]>(propLogs);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL');
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Sync prop logs
  useEffect(() => {
    if (propLogs.length > 0) {
      setModalLogs(propLogs);
    }
  }, [propLogs]);

  // Real-time polling
  useEffect(() => {
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
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Auto-scroll logic
  useEffect(() => {
    if (isAutoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [modalLogs.length, isAutoScroll]);

  const handleClear = async () => {
    await TauriService.clearGameLogs();
    setModalLogs([]);
    onClearLogs();
  };

  const handleCopy = () => {
    const fullText = filteredLogs.map((l) => `[${l.timestamp}] [${l.stream.toUpperCase()}] ${l.text}`).join('\n');
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter logs
  const filteredLogs = modalLogs.filter((log) => {
    if (searchQuery.trim()) {
      if (!log.text.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
    }
    if (filterLevel === 'ERROR') {
      return log.stream === 'stderr' || log.text.includes('/ERROR') || log.text.includes('Exception') || log.text.includes('Error');
    }
    if (filterLevel === 'WARN') {
      return log.text.includes('/WARN') || log.text.includes('Warning');
    }
    if (filterLevel === 'INFO') {
      return log.text.includes('/INFO');
    }
    return true;
  });

  return (
    <div className="w-full h-full flex flex-col px-6 pt-4 pb-3 overflow-hidden animate-in fade-in duration-200">
      <div className="max-w-7xl mx-auto w-full h-full flex flex-col space-y-3 min-h-0">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#d97757] mb-0.5">
              <Terminal className="w-3.5 h-3.5" />
              <span>Runtime Diagnostics</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Live Minecraft Console Logs
            </h1>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 transition-colors border border-white/10"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Logs'}</span>
            </button>

            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 transition-colors border border-white/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>

            <button
              onClick={() => setIsAutoScroll(!isAutoScroll)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                isAutoScroll
                  ? 'bg-[#d97757]/20 border-[#d97757]/40 text-[#df9168]'
                  : 'bg-white/5 border-white/10 text-slate-400'
              }`}
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>Auto-Scroll: {isAutoScroll ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search in log lines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#d97757] font-mono"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
            {(['ALL', 'INFO', 'WARN', 'ERROR'] as const).map((level) => (
              <button
                key={level}
                onClick={() => setFilterLevel(level)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  filterLevel === level
                    ? 'bg-[#d97757] text-white shadow-md'
                    : 'bg-white/5 hover:bg-white/10 text-slate-400 border border-white/5'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Terminal Window */}
        <div
          ref={containerRef}
          className="flex-1 min-h-0 h-full p-4 rounded-2xl bg-[#090b10] border border-white/10 overflow-y-auto font-mono text-xs select-text cursor-text selection:bg-[#d97757] selection:text-white space-y-1 custom-scrollbar shadow-inner"
        >
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 select-none space-y-2">
              <Terminal className="w-8 h-8 stroke-[1.5] text-slate-700" />
              <span>No logs matching criteria. Launch the game to stream stdout/stderr.</span>
            </div>
          ) : (
            filteredLogs.map((log, i) => {
              const isErr = log.stream === 'stderr' || log.text.includes('/ERROR') || log.text.includes('Exception');
              const isWarn = log.text.includes('/WARN') || log.text.includes('Warning');
              return (
                <div
                  key={i}
                  className={`flex gap-3 leading-relaxed select-text ${
                    isErr ? 'text-rose-400' : isWarn ? 'text-amber-300' : 'text-slate-300'
                  }`}
                >
                  <span className="text-slate-600 select-none shrink-0 font-mono text-[10px]">
                    [{log.timestamp}]
                  </span>
                  <span className="break-all whitespace-pre-wrap select-text">{log.text}</span>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
};
