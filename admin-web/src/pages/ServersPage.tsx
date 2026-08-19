import React, { useEffect, useState } from 'react';
import { adminApi } from '../api';
import { GameServer } from '../types';
import {
  Server,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Globe,
  Star,
  Loader2,
  X,
} from 'lucide-react';

export const ServersPage: React.FC = () => {
  const [servers, setServers] = useState<GameServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<GameServer | null>(null);
  const [formName, setFormName] = useState('');
  const [formIp, setFormIp] = useState('');
  const [formPort, setFormPort] = useState(25565);
  const [formIsPrimary, setFormIsPrimary] = useState(false);
  const [formDescription, setFormDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadServers = async () => {
    try {
      const data = await adminApi.getServers();
      setServers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load servers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServers();
  }, []);

  const openCreateModal = () => {
    setEditingServer(null);
    setFormName('');
    setFormIp('127.0.0.1');
    setFormPort(25565);
    setFormIsPrimary(servers.length === 0);
    setFormDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (srv: GameServer) => {
    setEditingServer(srv);
    setFormName(srv.name);
    setFormIp(srv.ipAddress);
    setFormPort(srv.port);
    setFormIsPrimary(srv.isPrimary);
    setFormDescription(srv.description || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (editingServer) {
        await adminApi.updateServer(editingServer.id, {
          name: formName.trim(),
          ipAddress: formIp.trim(),
          port: Number(formPort),
          isPrimary: formIsPrimary,
          description: formDescription.trim() || null,
        });
      } else {
        await adminApi.createServer({
          name: formName.trim(),
          ipAddress: formIp.trim(),
          port: Number(formPort),
          isPrimary: formIsPrimary,
          description: formDescription.trim() || undefined,
        });
      }
      setIsModalOpen(false);
      await loadServers();
    } catch (err: any) {
      setError(err.message || 'Failed to save server');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete server "${name}"?`)) return;
    try {
      await adminApi.deleteServer(id);
      await loadServers();
    } catch (err: any) {
      setError(err.message || 'Failed to delete server');
    }
  };

  const handleSetPrimary = async (srv: GameServer) => {
    try {
      await adminApi.updateServer(srv.id, { isPrimary: true });
      await loadServers();
    } catch (err: any) {
      setError(err.message || 'Failed to set primary server');
    }
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
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-[#df9168] mb-1">
            <Server className="w-4 h-4" />
            <span>Realm Routing</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase">
            Game Servers Management
          </h1>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Manage your official multiplayer Minecraft realms. The primary server is loaded automatically on client startup.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider text-white terracotta-gradient hover:brightness-110 shadow-[0_0_20px_rgba(217,119,87,0.3)] transition-all w-fit"
        >
          <Plus className="w-4 h-4" />
          <span>Add Game Server</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Server Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {servers.map((server) => (
          <div
            key={server.id}
            className={`p-7 rounded-3xl bg-[#12141c] border transition-all flex flex-col justify-between gap-6 shadow-xl relative overflow-hidden ${
              server.isPrimary
                ? 'border-[#d97757]/80 shadow-[0_0_30px_rgba(217,119,87,0.15)]'
                : 'border-white/10'
            }`}
          >
            {/* Primary Glow Accent */}
            {server.isPrimary && (
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#d97757]/15 rounded-full blur-3xl pointer-events-none" />
            )}

            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-slate-800 border border-white/10 text-[#df9168] shrink-0">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">{server.name}</h3>
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                      <Globe className="w-3 h-3 text-[#df9168]" />
                      <span>
                        {server.ipAddress}:{server.port}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Primary Badge or Set Primary Action */}
                {server.isPrimary ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                    <Star className="w-3 h-3 fill-emerald-400 text-emerald-400" />
                    <span>PRIMARY REALM</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleSetPrimary(server)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors shrink-0"
                  >
                    <Star className="w-3 h-3 text-slate-500" />
                    <span>SET PRIMARY</span>
                  </button>
                )}
              </div>

              {/* Description */}
              <p className="text-xs font-mono text-slate-400 leading-relaxed">
                {server.description || 'No custom description provided for this realm.'}
              </p>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <div className="text-[11px] font-mono text-slate-500">
                Created {new Date(server.createdAt).toLocaleDateString()}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditModal(server)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors border border-white/5 text-xs flex items-center gap-1.5 font-mono"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>

                <button
                  onClick={() => handleDelete(server.id, server.name)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors border border-white/5 text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {servers.length === 0 && (
          <div className="col-span-2 p-12 text-center rounded-3xl bg-[#12141c] border border-dashed border-white/10 space-y-3">
            <Server className="w-10 h-10 mx-auto text-slate-600" />
            <div className="text-sm font-mono text-slate-400">No game servers registered yet.</div>
            <button
              onClick={openCreateModal}
              className="px-5 py-2.5 rounded-xl bg-[#d97757] text-white font-bold text-xs uppercase font-mono"
            >
              Add First Game Server
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit Server Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg p-8 rounded-3xl bg-[#141720] border border-white/10 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-lg font-bold text-white uppercase tracking-wider">
                {editingServer ? 'Edit Game Server' : 'Add New Game Server'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold uppercase text-slate-300">
                  Realm Display Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Official Survival SMP"
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-white/10 text-sm text-white font-mono focus:outline-none focus:border-[#d97757]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-mono font-bold uppercase text-slate-300">
                    Host / IP Address
                  </label>
                  <input
                    type="text"
                    required
                    value={formIp}
                    onChange={(e) => setFormIp(e.target.value)}
                    placeholder="play.example.com"
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-white/10 text-sm text-white font-mono focus:outline-none focus:border-[#d97757]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-bold uppercase text-slate-300">Port</label>
                  <input
                    type="number"
                    required
                    value={formPort}
                    onChange={(e) => setFormPort(parseInt(e.target.value, 10))}
                    placeholder="25565"
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-white/10 text-sm text-white font-mono focus:outline-none focus:border-[#d97757]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold uppercase text-slate-300">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Short description shown on client launcher main screen"
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-white/10 text-xs text-white font-mono focus:outline-none focus:border-[#d97757]"
                />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-white/5">
                <input
                  type="checkbox"
                  id="primaryCheckbox"
                  checked={formIsPrimary}
                  onChange={(e) => setFormIsPrimary(e.target.checked)}
                  className="w-4 h-4 rounded text-[#d97757] focus:ring-0 bg-slate-800 border-white/20"
                />
                <label htmlFor="primaryCheckbox" className="text-xs font-mono text-slate-300 cursor-pointer">
                  Set as Primary Default Server for All Clients
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl font-bold text-xs uppercase font-mono text-white terracotta-gradient hover:brightness-110 shadow-lg disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Server'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
