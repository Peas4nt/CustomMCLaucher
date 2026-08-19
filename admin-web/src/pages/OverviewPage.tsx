import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../api';
import { GlobalConfig, GameServer, ModpackManifest, AdminUser } from '../types';
import {
  Server,
  Settings2,
  FolderSync,
  Users,
  HardDrive,
  RefreshCw,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

export const OverviewPage: React.FC = () => {
  const [config, setConfig] = useState<GlobalConfig | null>(null);
  const [servers, setServers] = useState<GameServer[]>([]);
  const [manifest, setManifest] = useState<ModpackManifest | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescanning, setRescanning] = useState(false);
  const [rescanSuccess, setRescanSuccess] = useState(false);

  const loadData = async () => {
    try {
      const [cfg, srvs, man, usrList] = await Promise.all([
        adminApi.getGlobalConfig().catch(() => null),
        adminApi.getServers().catch(() => []),
        adminApi.getManifest().catch(() => null),
        adminApi.getUsers().catch(() => []),
      ]);
      setConfig(cfg);
      setServers(srvs);
      setManifest(man);
      setUsers(usrList);
    } catch (e) {
      console.error('Error loading overview data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRescan = async () => {
    setRescanning(true);
    setRescanSuccess(false);
    try {
      const updatedManifest = await adminApi.rescanFiles();
      setManifest(updatedManifest);
      setRescanSuccess(true);
      setTimeout(() => setRescanSuccess(false), 3000);
    } catch (e) {
      console.error('Rescan failed:', e);
    } finally {
      setRescanning(false);
    }
  };

  const primaryServer = servers.find((s) => s.isPrimary) || servers[0] || null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#df9168]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Banner / Welcome */}
      <div className="p-8 rounded-3xl bg-gradient-to-r from-[#141720] to-[#1a1d28] border border-white/10 shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-[#df9168]">
            <ShieldCheck className="w-4 h-4" />
            <span>Operational Center</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase">
            Launcher Server Overview
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 font-mono leading-relaxed">
            Manage synchronized modpack distribution, Minecraft version specifications, live server connection routing, and registered player authentication.
          </p>
        </div>

        {/* Rescan Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleRescan}
            disabled={rescanning}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all border shadow-lg ${
              rescanSuccess
                ? 'bg-emerald-600/30 border-emerald-500/50 text-emerald-300'
                : 'bg-white/5 hover:bg-white/10 text-white border-white/10 hover:border-[#d97757]/40'
            }`}
          >
            {rescanning ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[#df9168]" />
            ) : rescanSuccess ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <RefreshCw className="w-4 h-4 text-[#df9168]" />
            )}
            <span>{rescanning ? 'Rescanning SHA-256...' : rescanSuccess ? 'Index Synced!' : 'Rescan Files'}</span>
          </button>
        </div>
      </div>

      {/* Metrics 4-Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1: Minecraft Version */}
        <Link
          to="/config"
          className="p-6 rounded-3xl bg-[#12141c] border border-white/10 hover:border-[#d97757]/50 transition-all group flex flex-col justify-between space-y-4 shadow-lg hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-2xl bg-[#d97757]/15 text-[#df9168] border border-[#d97757]/20">
              <Settings2 className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
          </div>
          <div>
            <span className="text-[11px] font-mono uppercase text-slate-400 tracking-wider">
              Client Version & Loader
            </span>
            <div className="text-xl font-black text-white uppercase tracking-tight mt-1 truncate">
              {config ? `${config.minecraftVersion} (${config.loaderType})` : 'Not Configured'}
            </div>
          </div>
        </Link>

        {/* Metric 2: Primary Game Server */}
        <Link
          to="/servers"
          className="p-6 rounded-3xl bg-[#12141c] border border-white/10 hover:border-[#d97757]/50 transition-all group flex flex-col justify-between space-y-4 shadow-lg hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              <Server className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
          </div>
          <div>
            <span className="text-[11px] font-mono uppercase text-slate-400 tracking-wider">
              Primary Server ({servers.length} total)
            </span>
            <div className="text-xl font-black text-white uppercase tracking-tight mt-1 truncate">
              {primaryServer ? primaryServer.name : 'No Servers'}
            </div>
          </div>
        </Link>

        {/* Metric 3: Indexed Files & Modpack Size */}
        <Link
          to="/files"
          className="p-6 rounded-3xl bg-[#12141c] border border-white/10 hover:border-[#d97757]/50 transition-all group flex flex-col justify-between space-y-4 shadow-lg hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
              <HardDrive className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
          </div>
          <div>
            <span className="text-[11px] font-mono uppercase text-slate-400 tracking-wider">
              Modpack Size ({manifest?.totalFiles || 0} files)
            </span>
            <div className="text-xl font-black text-white uppercase tracking-tight mt-1">
              {formatBytes(manifest?.totalSizeBytes || 0)}
            </div>
          </div>
        </Link>

        {/* Metric 4: Total Users */}
        <Link
          to="/users"
          className="p-6 rounded-3xl bg-[#12141c] border border-white/10 hover:border-[#d97757]/50 transition-all group flex flex-col justify-between space-y-4 shadow-lg hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-2xl bg-violet-500/15 text-violet-400 border border-violet-500/20">
              <Users className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
          </div>
          <div>
            <span className="text-[11px] font-mono uppercase text-slate-400 tracking-wider">
              Registered Accounts
            </span>
            <div className="text-xl font-black text-white uppercase tracking-tight mt-1">
              {users.length} User{users.length === 1 ? '' : 's'}
            </div>
          </div>
        </Link>
      </div>

      {/* Detailed Status Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel: Primary Server Info */}
        <div className="p-7 rounded-3xl bg-[#12141c] border border-white/10 space-y-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2.5 font-bold text-white uppercase tracking-wider text-sm">
              <Server className="w-4 h-4 text-[#df9168]" />
              <span>Target Connection Realm</span>
            </div>
            <Link
              to="/servers"
              className="text-xs font-mono text-[#df9168] hover:underline flex items-center gap-1"
            >
              Manage <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          {primaryServer ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/60 border border-white/5 font-mono text-xs">
                <span className="text-slate-400">Server Host & Port:</span>
                <span className="text-white font-bold">
                  {primaryServer.ipAddress}:{primaryServer.port}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/60 border border-white/5 font-mono text-xs">
                <span className="text-slate-400">Realm Display Name:</span>
                <span className="text-white font-bold">{primaryServer.name}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/60 border border-white/5 font-mono text-xs">
                <span className="text-slate-400">Primary Launcher Default:</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ACTIVE
                </span>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 font-mono text-xs space-y-2">
              <AlertTriangle className="w-6 h-6 mx-auto text-amber-400" />
              <p>No primary game server configured yet.</p>
              <Link
                to="/servers"
                className="inline-block mt-2 px-4 py-2 rounded-xl bg-[#d97757] text-white font-bold text-xs"
              >
                Add Game Server
              </Link>
            </div>
          )}
        </div>

        {/* Right Panel: File Categories Summary */}
        <div className="p-7 rounded-3xl bg-[#12141c] border border-white/10 space-y-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2.5 font-bold text-white uppercase tracking-wider text-sm">
              <FolderSync className="w-4 h-4 text-[#df9168]" />
              <span>Modpack Asset Breakdown</span>
            </div>
            <Link
              to="/files"
              className="text-xs font-mono text-[#df9168] hover:underline flex items-center gap-1"
            >
              Upload / View <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'mods', label: 'Mods (.jar)', count: manifest?.categories?.mods?.length || 0 },
              { key: 'config', label: 'Configs (.json/.toml)', count: manifest?.categories?.config?.length || 0 },
              { key: 'shaderpacks', label: 'Shaderpacks (.zip)', count: manifest?.categories?.shaderpacks?.length || 0 },
              { key: 'resourcepacks', label: 'Resourcepacks (.zip)', count: manifest?.categories?.resourcepacks?.length || 0 },
            ].map((cat) => (
              <div key={cat.key} className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 font-mono text-xs">
                <div className="text-slate-400 text-[11px]">{cat.label}</div>
                <div className="text-lg font-black text-white mt-1">{cat.count} files</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
