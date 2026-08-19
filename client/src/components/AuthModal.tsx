import React, { useState } from 'react';
import { apiService } from '../services/api';
import { authService } from '../services/auth';
import { UserProfile } from '../types';
import { X, Lock, Mail, User, Loader2, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile, token: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        const data = await apiService.register(email.trim(), username.trim(), password);
        authService.setSession(data.accessToken, data.user);
        onSuccess(data.user, data.accessToken);
        onClose();
      } else {
        const identifier = email.trim();
        const data = await apiService.login(identifier, password);
        authService.setSession(data.accessToken, data.user);
        onSuccess(data.user, data.accessToken);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl bg-[#141720] p-7 shadow-2xl border border-white/10 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold text-white uppercase tracking-wider font-mono">
              {isRegister ? 'Create Account' : 'Player Sign In'}
            </h2>
            <p className="text-xs text-slate-400">
              {isRegister
                ? 'Register your unique Minecraft nickname'
                : 'Sign in to synchronize with your profile'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Avatar if Registering */}
        {isRegister && (
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-white/10 flex items-center gap-3.5 shadow-md">
            <div className="w-12 h-12 rounded-xl bg-[#181b24] border-2 border-[#d97757]/40 p-1 shrink-0 flex items-center justify-center overflow-hidden">
              <img
                src={`https://minotar.net/helm/${username.trim() || 'Steve'}/64.png`}
                alt="Player Head"
                className="w-full h-full object-cover rounded-lg"
                onError={(e) => {
                  e.currentTarget.src = 'https://minotar.net/helm/Steve/64.png';
                }}
              />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Skin Avatar
              </span>
              <div className="text-sm font-black text-white truncate font-mono">
                {username.trim() || 'Steve'}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
              {isRegister ? 'Email Address' : 'Email or Nickname'}
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-[#df9168]" />
              <input
                type={isRegister ? 'email' : 'text'}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isRegister ? 'player@example.com' : 'Nickname or email'}
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-900 border border-white/10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#d97757] font-mono"
              />
            </div>
          </div>

          {isRegister && (
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                Unique Player Nickname
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 w-4 h-4 text-[#df9168]" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. Steve_Craft"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-900 border border-white/10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#d97757] font-mono"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-[#df9168]" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-900 border border-white/10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#d97757] font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-2xl terracotta-gradient hover:brightness-110 font-bold text-xs uppercase tracking-wider font-mono text-white transition-all shadow-xl shadow-[#d97757]/20 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{isRegister ? 'Register & Play' : 'Log In'}</span>
          </button>
        </form>

        <div className="text-center pt-1">
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="text-xs font-mono text-[#df9168] hover:underline"
          >
            {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
          </button>
        </div>
      </div>
    </div>
  );
};
