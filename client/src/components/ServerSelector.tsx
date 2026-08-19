import React, { useState, useRef, useEffect } from 'react';
import { GameServer } from '../types';
import { ChevronDown, Server, Wifi, Check } from 'lucide-react';

interface ServerSelectorProps {
  servers: GameServer[];
  selectedServer: GameServer | null;
  onSelectServer: (server: GameServer) => void;
  serverPing?: { online: boolean; onlinePlayers: number; maxPlayers: number } | null;
}

export const ServerSelector: React.FC<ServerSelectorProps> = ({
  servers,
  selectedServer,
  onSelectServer,
  serverPing,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-11 flex items-center gap-3 px-3.5 rounded-xl glass-button border border-white/10 hover:border-emerald-500/30 text-sm font-medium transition-all group"
      >
        <div
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
            serverPing?.online
              ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse'
              : 'bg-slate-500'
          }`}
        />
        <Server className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform shrink-0" />
        <div className="flex flex-col text-left justify-center">
          <span className="text-xs text-slate-100 font-bold truncate max-w-[125px] leading-tight">
            {selectedServer ? selectedServer.name : 'Select Server'}
          </span>
          <span className="text-[10px] text-slate-400 font-normal leading-tight">
            {serverPing
              ? serverPing.online
                ? `${serverPing.onlinePlayers} online`
                : 'Offline'
              : 'Active Server'}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-emerald-400' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl glass-panel-elevated p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 text-xs font-semibold text-slate-400 border-b border-white/5 uppercase tracking-wider">
            Available Realms
          </div>
          <div className="mt-1 space-y-1 max-h-64 overflow-y-auto">
            {servers.map((server) => {
              const isSelected = selectedServer?.id === server.id;
              return (
                <button
                  key={server.id}
                  onClick={() => {
                    onSelectServer(server);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                      : 'hover:bg-white/5 text-slate-200 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-800/80 border border-white/5">
                      <Server className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-100">{server.name}</span>
                        {server.isPrimary && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                            PRIMARY
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <Wifi className="w-3 h-3 text-emerald-400" />
                        {server.ipAddress}:{server.port}
                      </span>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
