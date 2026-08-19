import React, { useState, useEffect } from 'react';
import { GameServer } from '../types';
import { X, Check, Loader2, Server } from 'lucide-react';
import { adminApi } from '../api';

interface ServerEditModalProps {
  server: GameServer | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ServerEditModal: React.FC<ServerEditModalProps> = ({ server, isOpen, onClose, onSaved }) => {
  const [name, setName] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [port, setPort] = useState(25565);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (server) {
      setName(server.name);
      setIpAddress(server.ipAddress);
      setPort(server.port);
      setDescription(server.description || '');
      setError(null);
    }
  }, [server, isOpen]);

  if (!isOpen || !server) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await adminApi.updateServer(server.id, {
        name,
        ipAddress,
        port,
        description: description || undefined,
      });
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Error updating server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md rounded-3xl glass-panel-elevated p-6 shadow-2xl border border-white/10 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Edit Server</h2>
              <p className="text-xs text-slate-400">Modify game server details</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && <div className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">{error}</div>}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Server Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-sm focus:border-cyan-500 text-slate-200" />
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">IP Address / Hostname</label>
              <input type="text" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} required className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-sm focus:border-cyan-500 text-slate-200" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Port</label>
              <input type="number" value={port} onChange={(e) => setPort(parseInt(e.target.value) || 25565)} required className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-sm focus:border-cyan-500 text-slate-200" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Description (Optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-sm focus:border-cyan-500 text-slate-200" />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 hover:bg-white/5">Cancel</button>
            <button type="submit" disabled={loading} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-semibold text-sm">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
