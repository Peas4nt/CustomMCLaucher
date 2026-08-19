import React, { useState, useEffect } from 'react';
import { User, CheckCircle2, XCircle, AlertCircle, ArrowLeft, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { apiService } from '../services/api';
import { UserProfile } from '../types';

interface Step3NicknameProps {
  email: string;
  passwordPlain: string;
  onBack: () => void;
  onRegistered: (token: string, user: UserProfile) => void;
}

export const Step3Nickname: React.FC<Step3NicknameProps> = ({
  email,
  passwordPlain,
  onBack,
  onRegistered,
}) => {
  const [nickname, setNickname] = useState<string>('');
  const [checking, setChecking] = useState<boolean>(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced availability check
  useEffect(() => {
    const trimmed = nickname.trim();
    if (trimmed.length < 3) {
      setIsAvailable(null);
      return;
    }

    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        const available = await apiService.checkNickname(trimmed);
        setIsAvailable(available);
      } catch (e) {
        console.warn('Nickname check failed:', e);
      } finally {
        setChecking(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [nickname]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nickname.trim();

    if (trimmed.length < 3) {
      setError('Nickname must be at least 3 characters long');
      return;
    }

    if (isAvailable === false) {
      setError('This nickname is already taken. Please choose another.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const data = await apiService.register(email, trimmed, passwordPlain);
      onRegistered(data.accessToken, data.user);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Nickname might have been taken.');
    } finally {
      setSubmitting(false);
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
              3
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-[#df9168] font-mono">
              Step 3 of 3
            </span>
          </div>

          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition-colors border border-white/5 font-mono"
          >
            <ArrowLeft className="w-3 h-3 text-slate-400" />
            <span>Back</span>
          </button>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#d97757] to-[#e89d75] flex items-center justify-center shadow-lg shadow-[#d97757]/20">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase">
            Choose Player Nickname
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            This name will be displayed in game, in multiplayer realms, and on your player skin profile.
          </p>
        </div>

        {/* Live 3D Head Avatar Preview Banner */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 flex items-center gap-4 shadow-md">
          <div className="w-16 h-16 rounded-2xl bg-[#181b24] border-2 border-[#d97757]/40 shadow-xl p-1 shrink-0 flex items-center justify-center overflow-hidden">
            <img
              src={`https://minotar.net/helm/${nickname.trim() || 'Steve'}/64.png`}
              alt="Player Head"
              className="w-full h-full object-cover rounded-xl"
              onError={(e) => {
                e.currentTarget.src = 'https://minotar.net/helm/Steve/64.png';
              }}
            />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
              Minecraft Skin Avatar
            </span>
            <div className="text-base font-black text-white truncate font-mono">
              {nickname.trim() || 'Steve'}
            </div>
            <p className="text-[11px] text-slate-500 font-mono">
              Live avatar skin rendered in real time.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-3 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Setup Error</div>
              <div className="text-[11px] text-rose-300/80 mt-0.5">{error}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#df9168]" />
                <span>In-Game Nickname</span>
              </label>

              {checking && (
                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                  <Loader2 className="w-3 h-3 animate-spin text-[#df9168]" />
                  <span>Checking...</span>
                </div>
              )}
              {!checking && isAvailable === true && (
                <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold font-mono">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Available</span>
                </div>
              )}
              {!checking && isAvailable === false && (
                <div className="flex items-center gap-1 text-[10px] text-rose-400 font-bold font-mono">
                  <XCircle className="w-3 h-3" />
                  <span>Already Taken</span>
                </div>
              )}
            </div>

            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. Steve_Craft"
              required
              minLength={3}
              maxLength={16}
              disabled={submitting}
              className={`w-full px-4 py-3.5 rounded-2xl bg-slate-900/90 border text-sm text-white focus:outline-none font-mono transition-colors placeholder-slate-600 ${
                isAvailable === true
                  ? 'border-emerald-500/80 focus:border-emerald-400'
                  : isAvailable === false
                  ? 'border-rose-500/80 focus:border-rose-400'
                  : 'border-white/10 focus:border-[#d97757]'
              }`}
            />
            <div className="text-[11px] text-slate-500 font-mono">
              Must be 3–16 characters (letters, numbers, and underscores).
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || checking || isAvailable === false || nickname.trim().length < 3}
            className="w-full py-4 px-4 rounded-2xl terracotta-gradient hover:brightness-110 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider font-mono transition-all shadow-xl shadow-[#d97757]/20 flex items-center justify-center gap-2 group"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Finalizing Account...</span>
              </>
            ) : (
              <>
                <span>Complete & Launch</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
