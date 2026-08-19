import React, { useState, useEffect } from 'react';
import { AdminUser } from '../types';
import { X, Check, Loader2, ShieldCheck, User } from 'lucide-react';
import { adminApi } from '../api';

interface UserEditModalProps {
  user: AdminUser | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const UserEditModal: React.FC<UserEditModalProps> = ({ user, isOpen, onClose, onSaved }) => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'USER'>('USER');
  const [status, setStatus] = useState<'ACTIVE' | 'DEACTIVATED'>('ACTIVE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setEmail(user.email);
      setUsername(user.username);
      setRole(user.role);
      setStatus(user.status);
      setPassword('');
      setError(null);
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await adminApi.updateUser(user.id, {
        email,
        username,
        role,
        status,
        ...(password ? { password } : {}),
      });

      onSaved();
    } catch (err: any) {
      setError(err.message || 'Error saving user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md rounded-3xl glass-panel-elevated p-6 shadow-2xl border border-white/10 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Edit User</h2>
              <p className="text-xs text-slate-400">Modify player account details</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && <div className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">{error}</div>}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-sm focus:border-emerald-500 text-slate-200" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-sm focus:border-emerald-500 text-slate-200" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">New Password (leave empty to keep current)</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" minLength={6} className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-sm focus:border-emerald-500 text-slate-200" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as any)} className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-sm focus:border-emerald-500 text-slate-200">
                <option value="USER">User</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-sm focus:border-emerald-500 text-slate-200">
                <option value="ACTIVE">Active</option>
                <option value="DEACTIVATED">Deactivated</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 hover:bg-white/5">Cancel</button>
            <button type="submit" disabled={loading} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
