import React from 'react';
import { GameServer } from '../types';
import { Server, Wifi, Check, Users, Sparkles } from 'lucide-react';

interface ServersViewProps {
  servers: GameServer[];
  selectedServer: GameServer | null;
  onSelectServer: (server: GameServer) => void;
  serverPing?: { online: boolean; onlinePlayers: number; maxPlayers: number } | null;
}

export const ServersView: React.FC<ServersViewProps> = ({
  servers,
  selectedServer,
  onSelectServer,
  serverPing,
}) => {
  return (
    <div className="w-full h-full flex flex-col p-6 sm:p-10 overflow-y-auto custom-scrollbar animate-in fade-in duration-200">
      <div className="max-w-5xl mx-auto w-full space-y-8 pb-24">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#d97757] mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Multiplayer Realms</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Select Game Server
            </h1>
          </div>
          <div className="text-xs text-slate-400 font-mono bg-slate-900/80 px-4 py-2 rounded-xl border border-white/10 w-fit">
            {servers.length} Available Realm{servers.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* Server Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {servers.map((server) => {
            const isSelected = selectedServer?.id === server.id;
            return (
              <div
                key={server.id}
                onClick={() => onSelectServer(server)}
                className={`p-6 rounded-3xl transition-all duration-300 cursor-pointer flex flex-col justify-between border relative overflow-hidden shadow-xl ${
                  isSelected
                    ? 'bg-slate-900/90 border-[#d97757] shadow-[0_0_30px_rgba(217,119,87,0.2)]'
                    : 'bg-slate-900/50 hover:bg-slate-900/80 border-white/10 hover:border-white/20'
                }`}
              >
                {/* Active glow accent */}
                {isSelected && (
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#d97757]/15 rounded-full blur-3xl pointer-events-none" />
                )}

                <div className="space-y-4">
                  {/* Top badges */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-slate-800 border border-white/10 text-[#df9168]">
                        <Server className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold text-white tracking-tight">
                            {server.name}
                          </h2>
                          {server.isPrimary && (
                            <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md">
                              Primary
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                          <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{server.ipAddress}:{server.port}</span>
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-8 h-8 rounded-full bg-[#d97757] text-white flex items-center justify-center shadow-lg">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-300 leading-relaxed font-normal">
                    {server.description || 'Fast differential modpack synchronization with SHA-256 integrity.'}
                  </p>
                </div>

                {/* Bottom stats & select button */}
                <div className="pt-6 mt-6 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className={`w-2 h-2 rounded-full ${isSelected && serverPing?.online ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-500'}`} />
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      {isSelected && serverPing ? `${serverPing.onlinePlayers}/${serverPing.maxPlayers} Online` : 'Online'}
                    </span>
                  </div>

                  <button
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                      isSelected
                        ? 'bg-[#d97757] text-white shadow-md'
                        : 'bg-white/5 group-hover:bg-white/10 text-slate-300 border border-white/5'
                    }`}
                  >
                    {isSelected ? 'Active Realm' : 'Switch To Realm'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
