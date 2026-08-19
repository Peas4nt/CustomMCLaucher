import React, { useState, useEffect } from 'react';
import { adminApi } from '../api';
import { AdminUser, GlobalConfig, GameServer, ModpackManifest, ModLoaderType } from '../types';
import { ShieldCheck, LogOut, Settings, Server, FileBox, Users, AlertTriangle, Loader2, CheckCircle2, XCircle, RefreshCw, Upload, Trash2, Edit } from 'lucide-react';
import { UserEditModal } from './UserEditModal';
import { ServerEditModal } from './ServerEditModal';

interface AdminDashboardProps {
  user: AdminUser;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'CONFIG' | 'SERVERS' | 'FILES' | 'USERS'>('CONFIG');
  
  // Data State
  const [config, setConfig] = useState<GlobalConfig | null>(null);
  const [servers, setServers] = useState<GameServer[]>([]);
  const [manifest, setManifest] = useState<ModpackManifest | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  
  // View State
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Edit Modals State
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editingServer, setEditingServer] = useState<GameServer | null>(null);

  // Ext Data
  const [mojangVersions, setMojangVersions] = useState<string[]>([]);
  const [availableLoaderVersions, setAvailableLoaderVersions] = useState<string[]>([]);
  const [loadingLoaderVersions, setLoadingLoaderVersions] = useState(false);

  useEffect(() => {
    loadData();
    adminApi.fetchMojangVersions().then(setMojangVersions);
  }, []);

  const updateLoaderVersionOptions = async (mcVer: string, loaderType: ModLoaderType, currentLoaderVer?: string) => {
    if (loaderType === 'VANILLA') {
      setAvailableLoaderVersions([]);
      return;
    }
    setLoadingLoaderVersions(true);
    try {
      let versions: string[] = [];
      if (loaderType === 'FABRIC') {
        versions = await adminApi.fetchFabricLoaderVersions(mcVer);
      } else if (loaderType === 'NEOFORGE') {
        versions = await adminApi.fetchNeoForgeLoaderVersions(mcVer);
      } else if (loaderType === 'FORGE') {
        versions = await adminApi.fetchForgeLoaderVersions(mcVer);
      }
      setAvailableLoaderVersions(versions);
      if (versions.length > 0) {
        const keepVal = currentLoaderVer && versions.includes(currentLoaderVer) ? currentLoaderVer : versions[0];
        setConfig((prev) => prev ? { ...prev, loaderVersion: keepVal } : null);
      }
    } catch (e) {
      console.error('Failed to fetch loader versions', e);
    } finally {
      setLoadingLoaderVersions(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [conf, srvs, man, usrs] = await Promise.all([
        adminApi.getConfig(),
        adminApi.getServers(),
        adminApi.getManifest(),
        adminApi.getUsers(),
      ]);
      setConfig(conf);
      setServers(srvs);
      setManifest(man);
      setUsers(usrs);
      
      updateLoaderVersionOptions(conf.minecraftVersion, conf.loaderType, conf.loaderVersion);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setActionLoading(true);
    try {
      const updated = await adminApi.updateConfig({
        minecraftVersion: config.minecraftVersion,
        loaderType: config.loaderType,
        loaderVersion: config.loaderVersion,
        javaVersion: config.javaVersion,
        jvmArgs: config.jvmArgs,
      });
      setConfig(updated);
      alert('Global configuration updated successfully');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRescanFiles = async () => {
    setActionLoading(true);
    try {
      const result = await adminApi.triggerRescan();
      alert(`Scanned: ${result.scannedCount}, Added: ${result.addedCount}, Updated: ${result.updatedCount}, Deleted: ${result.deletedCount}`);
      const man = await adminApi.getManifest();
      setManifest(man);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>, category: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setActionLoading(true);
    try {
      await adminApi.uploadFile(category, file);
      await adminApi.triggerRescan();
      const man = await adminApi.getManifest();
      setManifest(man);
      alert(`${file.name} uploaded successfully.`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteFile = async (category: string, path: string) => {
    if (!window.confirm(`Delete ${path}?`)) return;
    setActionLoading(true);
    try {
      await adminApi.deleteFile(category, path);
      await adminApi.triggerRescan();
      const man = await adminApi.getManifest();
      setManifest(man);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetPrimaryServer = async (id: string) => {
    setActionLoading(true);
    try {
      await adminApi.setPrimaryServer(id);
      const srvs = await adminApi.getServers();
      setServers(srvs);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteServer = async (id: string) => {
    if (!window.confirm('Delete this server from the launcher?')) return;
    setActionLoading(true);
    try {
      await adminApi.deleteServer(id);
      const srvs = await adminApi.getServers();
      setServers(srvs);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const name = formData.get('name') as string;
    const ip = formData.get('ip') as string;
    const portStr = formData.get('port') as string;
    const port = parseInt(portStr) || 25565;

    if (!name || !ip) return;
    setActionLoading(true);
    try {
      await adminApi.createServer({ name, ipAddress: ip, port });
      const srvs = await adminApi.getServers();
      setServers(srvs);
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0f17] text-emerald-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const isUnconfigured = !config || config.minecraftVersion === 'UNCONFIGURED' || !config.loaderType;

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f17] text-slate-200">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 glass-panel border-b border-white/5 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white">CMCL Admin Portal</h1>
            <div className="flex items-center gap-2">
              <img src={`https://minotar.net/helm/${user.username}/32.png`} alt={user.username} className="w-4 h-4 rounded-sm" onError={(e) => (e.currentTarget.src = 'https://minotar.net/helm/Steve/32.png')} />
              <div className="text-[11px] font-mono text-emerald-400">
                Logged in as {user.username}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            adminApi.clearSession();
            onLogout();
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-400 text-sm font-semibold transition-colors text-slate-300 border border-white/5"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </header>

      {/* Global Alert Banner */}
      {isUnconfigured && (
        <div className="bg-amber-500/20 border-b border-amber-500/40 p-3 flex justify-center text-amber-300 text-sm font-semibold">
          <AlertTriangle className="w-5 h-5 mr-2" />
          Warning: Global Minecraft Version or Mod Loader is unconfigured. Launcher clients will fail to sync.
        </div>
      )}

      {/* Main Layout */}
      <div className="flex-1 w-full p-6 flex flex-col md:flex-row gap-6">
        {/* Sidebar Nav */}
        <div className="w-full md:w-64 shrink-0 flex flex-col gap-2">
          {[
            { id: 'CONFIG', icon: Settings, label: 'Global Config' },
            { id: 'SERVERS', icon: Server, label: 'Game Servers' },
            { id: 'FILES', icon: FileBox, label: 'File Indexer' },
            { id: 'USERS', icon: Users, label: 'Player Accounts' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all border ${
                  isActive
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                    : 'bg-transparent border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0 glass-panel p-6 rounded-3xl overflow-hidden">
          {error && (
            <div className="p-4 mb-6 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          {/* TAB 1: CONFIG */}
          {activeTab === 'CONFIG' && config && (
            <div className="space-y-6 animate-in fade-in">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Launcher Configuration</h2>
                <p className="text-xs text-slate-400">Define the Minecraft version and mod loader clients will sync against.</p>
              </div>

              <form onSubmit={handleUpdateConfig} className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Minecraft Release Version</label>
                  <select
                    value={config.minecraftVersion}
                    onChange={(e) => {
                      const newVer = e.target.value;
                      setConfig({ ...config, minecraftVersion: newVer });
                      updateLoaderVersionOptions(newVer, config.loaderType, config.loaderVersion);
                    }}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-900/80 border border-white/10 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="UNCONFIGURED">Select Version...</option>
                    {mojangVersions.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Mod Loader Type</label>
                    <select
                      value={config.loaderType}
                      onChange={(e) => {
                        const type = e.target.value as ModLoaderType;
                        setConfig({ ...config, loaderType: type });
                        updateLoaderVersionOptions(config.minecraftVersion, type, config.loaderVersion);
                      }}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-900/80 border border-white/10 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="FABRIC">Fabric</option>
                      <option value="NEOFORGE">NeoForge</option>
                      <option value="FORGE">Forge</option>
                      <option value="VANILLA">Vanilla</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Loader Version</label>
                    {config.loaderType === 'VANILLA' ? (
                      <input
                        type="text"
                        disabled
                        value="None (Vanilla Minecraft)"
                        className="w-full px-4 py-3 rounded-2xl bg-slate-900/40 border border-white/5 text-sm text-slate-500 cursor-not-allowed"
                      />
                    ) : (
                      <select
                        value={config.loaderVersion}
                        disabled={loadingLoaderVersions}
                        onChange={(e) => setConfig({ ...config, loaderVersion: e.target.value })}
                        className="w-full px-4 py-3 rounded-2xl bg-slate-900/80 border border-white/10 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                      >
                        {loadingLoaderVersions && (
                          <option value={config.loaderVersion}>Loading available versions...</option>
                        )}
                        {!loadingLoaderVersions && availableLoaderVersions.length === 0 && (
                          <option value={config.loaderVersion}>{config.loaderVersion || 'No versions found'}</option>
                        )}
                        {availableLoaderVersions.map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Default JVM Arguments</label>
                    <textarea
                      value={config.jvmArgs}
                      onChange={(e) => setConfig({ ...config, jvmArgs: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-900/80 border border-white/10 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-500/25 flex justify-center items-center gap-2"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Save Configuration
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: SERVERS */}
          {activeTab === 'SERVERS' && (
            <div className="space-y-6 animate-in fade-in">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Game Servers</h2>
                <p className="text-xs text-slate-400">Manage the servers injected into the client's multiplayer menu.</p>
              </div>

              <div className="bg-slate-900/50 rounded-2xl overflow-hidden border border-white/10">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-800/50 text-xs font-semibold uppercase text-slate-400">
                    <tr>
                      <th className="px-6 py-3">Server</th>
                      <th className="px-6 py-3">Address</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {servers.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-white flex items-center gap-2">
                            {s.name}
                            {s.isPrimary && <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">Primary</span>}
                          </div>
                          <div className="text-xs text-slate-500 truncate max-w-[200px]">{s.description}</div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">{s.ipAddress}:{s.port}</td>
                        <td className="px-6 py-4 flex justify-end gap-2">
                          {!s.isPrimary && (
                            <button onClick={() => handleSetPrimaryServer(s.id)} className="p-1.5 rounded-lg bg-slate-800 text-emerald-400 hover:bg-slate-700" title="Set Primary">
                              <ShieldCheck className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => setEditingServer(s)} className="p-1.5 rounded-lg bg-slate-800 text-blue-400 hover:bg-slate-700" title="Edit Server">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteServer(s.id)} className="p-1.5 rounded-lg bg-slate-800 text-rose-400 hover:bg-rose-500 hover:text-white" title="Delete Server">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-8 border-t border-white/10 pt-6 max-w-2xl">
                <h3 className="text-sm font-bold text-white mb-4">Add New Server</h3>
                <form onSubmit={handleCreateServer} className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Name</label>
                    <input name="name" type="text" placeholder="Server Name" required className="w-full px-4 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-sm focus:border-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-semibold text-slate-400 mb-1">IP Address</label>
                    <input name="ip" type="text" placeholder="play.server.com" required className="w-full px-4 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-sm focus:border-emerald-500" />
                  </div>
                  <div className="w-24 shrink-0">
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Port</label>
                    <input name="port" type="number" defaultValue={25565} required className="w-full px-4 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-sm focus:border-emerald-500" />
                  </div>
                  <button type="submit" disabled={actionLoading} className="py-2 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold h-[38px] flex items-center gap-2">
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Add</span>}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: FILES */}
          {activeTab === 'FILES' && manifest && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">File System Indexer</h2>
                  <p className="text-xs text-slate-400">Total Indexed Files: <strong className="text-emerald-400">{manifest.totalFiles}</strong> ({(manifest.totalSizeBytes / 1024 / 1024).toFixed(2)} MB)</p>
                </div>
                <button onClick={handleRescanFiles} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20">
                  <RefreshCw className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
                  Rescan Modpack
                </button>
              </div>

              {['mods', 'config', 'shaderpacks', 'resourcepacks'].map((cat) => {
                const categoryFiles = manifest.categories[cat as keyof typeof manifest.categories] || [];
                return (
                  <div key={cat} className="glass-panel p-4 rounded-2xl">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">{cat} <span className="text-slate-500 text-xs normal-case ml-2">({categoryFiles.length} files)</span></h3>
                      <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer text-xs text-emerald-400 font-semibold border border-white/5 transition-colors">
                        <Upload className="w-3.5 h-3.5" /> Upload File
                        <input type="file" className="hidden" onChange={(e) => handleUploadFile(e, cat)} />
                      </label>
                    </div>

                    {categoryFiles.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-500 bg-slate-900/30 rounded-xl border border-dashed border-white/10">No files indexed in this category.</div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto pr-2 space-y-1.5">
                        {categoryFiles.map((f) => (
                          <div key={f.path} className="flex justify-between items-center px-3 py-2 rounded-xl bg-slate-900/50 hover:bg-slate-800/80 group text-xs border border-transparent hover:border-white/5 transition-colors">
                            <div className="truncate pr-4 flex-1 font-mono text-slate-300">{f.path.split('/').pop()}</div>
                            <div className="flex items-center gap-4 shrink-0">
                              <span className="text-[10px] text-slate-500 font-mono">{(f.sizeBytes / 1024).toFixed(1)} KB</span>
                              <span className="text-[10px] text-emerald-600/80 font-mono w-16 truncate">{f.sha256.substring(0, 8)}</span>
                              <button onClick={() => handleDeleteFile(cat, f.path)} className="text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 4: USERS */}
          {activeTab === 'USERS' && (
            <div className="space-y-6 animate-in fade-in">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Player Accounts</h2>
                <p className="text-xs text-slate-400">Manage registered users, roles, and deactivations.</p>
              </div>

              <div className="bg-slate-900/50 rounded-2xl overflow-hidden border border-white/10">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-800/50 text-xs font-semibold uppercase text-slate-400">
                    <tr>
                      <th className="px-6 py-3">Player</th>
                      <th className="px-6 py-3">Role</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 flex items-center gap-3">
                          <img src={`https://minotar.net/helm/${u.username}/40.png`} alt={u.username} className="w-10 h-10 rounded-lg shadow-sm" onError={(e) => (e.currentTarget.src = 'https://minotar.net/helm/Steve/40.png')} />
                          <div>
                            <div className="font-bold text-white">{u.username}</div>
                            <div className="text-xs text-slate-500">{u.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                           <span className={`px-2 py-1 rounded text-[10px] font-bold ${u.role === 'ADMIN' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-300'}`}>
                             {u.role}
                           </span>
                        </td>
                        <td className="px-6 py-4">
                          {u.status === 'ACTIVE' ? (
                            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> Active</span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs text-rose-400 font-semibold"><XCircle className="w-3.5 h-3.5" /> Deactivated</span>
                          )}
                        </td>
                        <td className="px-6 py-4 flex justify-end gap-2">
                          <button onClick={() => setEditingUser(u)} className="p-1.5 rounded-lg bg-slate-800 text-blue-400 hover:bg-slate-700 transition-colors" title="Edit User">
                            <Edit className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
      
      {/* Edit Modals */}
      <UserEditModal 
        user={editingUser} 
        isOpen={!!editingUser} 
        onClose={() => setEditingUser(null)} 
        onSaved={() => { setEditingUser(null); loadData(); }} 
      />
      <ServerEditModal 
        server={editingServer} 
        isOpen={!!editingServer} 
        onClose={() => setEditingServer(null)} 
        onSaved={() => { setEditingServer(null); loadData(); }} 
      />
    </div>
  );
};
