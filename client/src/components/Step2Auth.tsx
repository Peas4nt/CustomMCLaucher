import React, { useState } from 'react';
import { Mail, Lock, ShieldCheck, UserPlus, AlertCircle, ArrowLeft, ArrowRight, Loader2, Server } from 'lucide-react';
import { apiService } from '../services/api';
import { UserProfile } from '../types';

interface Step2AuthProps {
  backendUrl: string;
  onChangeServer: () => void;
  onAuthenticated: (token: string, user: UserProfile) => void;
  onStartRegister: (email: string, passwordPlain: string) => void;
}

export const Step2Auth: React.FC<Step2AuthProps> = ({
  backendUrl,
  onChangeServer,
  onAuthenticated,
  onStartRegister,
}) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [identifier, setIdentifier] = useState<string>(''); // email or username for login
  const [email, setEmail] = useState<string>(''); // for register
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'LOGIN') {
      if (!identifier.trim() || !password) {
        setError('Please enter your email or nickname and password');
        return;
      }

      setLoading(true);
      try {
        const data = await apiService.login(identifier.trim(), password);
        onAuthenticated(data.accessToken, data.user);
      } catch (err: any) {
        setError(err.message || 'Login failed. Please check your credentials.');
      } finally {
        setLoading(false);
      }
    } else {
      // Registration: validate email and password before moving to Step 3 (Nickname)
      if (!email.trim() || !email.includes('@')) {
        setError('Please enter a valid email address');
        return;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }

      onStartRegister(email.trim(), password);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#090a0f] relative overflow-hidden select-none">
      {/* Background ambient lights */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-[#d97757]/15 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-[#df9168]/10 blur-[140px] pointer-events-none" />

      <div className="w-full max-w-lg p-8 rounded-3xl bg-[#12141c]/90 border border-white/10 shadow-2xl backdrop-blur-2xl relative z-10 space-y-6">
        {/* Header navigation & Step indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-xl bg-[#d97757]/20 text-[#df9168] border border-[#d97757]/30 flex items-center justify-center text-xs font-black font-mono">
              2
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-[#df9168] font-mono">
              Step 2 of 3
            </span>
          </div>

          <button
            onClick={onChangeServer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition-colors border border-white/5 font-mono"
            title="Change remote server URL"
          >
            <Server className="w-3.5 h-3.5 text-[#df9168]" />
            <span className="text-[11px] truncate max-w-[130px]">
              {backendUrl.replace(/^https?:\/\//, '')}
            </span>
            <ArrowLeft className="w-3 h-3 text-slate-400 ml-0.5" />
          </button>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#d97757] to-[#e89d75] flex items-center justify-center shadow-lg shadow-[#d97757]/20">
            {mode === 'LOGIN' ? (
              <ShieldCheck className="w-7 h-7 text-white" />
            ) : (
              <UserPlus className="w-7 h-7 text-white" />
            )}
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase">
            {mode === 'LOGIN' ? 'Player Authentication' : 'Create Player Account'}
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            {mode === 'LOGIN'
              ? 'Sign in to synchronize modpacks, settings, and join verified multiplayer servers.'
              : 'Enter your email address and chosen password to start registration.'}
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex p-1.5 rounded-2xl bg-slate-900 border border-white/10">
          <button
            type="button"
            onClick={() => {
              setMode('LOGIN');
              setError(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all ${
              mode === 'LOGIN'
                ? 'bg-[#d97757] text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('REGISTER');
              setError(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all ${
              mode === 'REGISTER'
                ? 'bg-[#d97757] text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-3 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Authentication Error</div>
              <div className="text-[11px] text-rose-300/80 mt-0.5">{error}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'LOGIN' ? (
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#df9168]" />
                <span>Email or Nickname</span>
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="player@example.com or Steve_Craft"
                required
                disabled={loading}
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-900/90 border border-white/10 text-sm text-white focus:outline-none focus:border-[#d97757] font-mono transition-colors placeholder-slate-600"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#df9168]" />
                <span>Email Address</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="player@example.com"
                required
                disabled={loading}
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-900/90 border border-white/10 text-sm text-white focus:outline-none focus:border-[#d97757] font-mono transition-colors placeholder-slate-600"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#df9168]" />
              <span>Password</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="•••••••• (min 6 characters)"
              required
              disabled={loading}
              className="w-full px-4 py-3.5 rounded-2xl bg-slate-900/90 border border-white/10 text-sm text-white focus:outline-none focus:border-[#d97757] font-mono transition-colors placeholder-slate-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 px-4 rounded-2xl terracotta-gradient hover:brightness-110 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider font-mono transition-all shadow-xl shadow-[#d97757]/20 flex items-center justify-center gap-2 group"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Credentials...</span>
              </>
            ) : mode === 'LOGIN' ? (
              <>
                <span>Sign In & Launch</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            ) : (
              <>
                <span>Choose Nickname</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
