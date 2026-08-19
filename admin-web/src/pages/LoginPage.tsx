import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../api';
import { Shield, Lock, Mail, User, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    // Check if token already exists
    if (adminApi.getStoredToken()) {
      navigate('/');
      return;
    }

    // Check if admin setup is needed
    adminApi
      .getAdminStatus()
      .then((status) => {
        setIsSetupMode(!status.hasAdmin);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to check admin status:', err);
        setLoading(false);
      });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (isSetupMode) {
        if (!email.trim() || !username.trim() || !password.trim()) {
          throw new Error('All fields are required for initial administrator setup.');
        }
        const data = await adminApi.setupFirstAdmin(email.trim(), username.trim(), password);
        adminApi.setSession(data.accessToken, data.user);
        navigate('/');
      } else {
        if (!email.trim() || !password.trim()) {
          throw new Error('Please enter your email or username and password.');
        }
        const data = await adminApi.login(email.trim(), password);
        adminApi.setSession(data.accessToken, data.user);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0c0d10] text-slate-100">
        <Loader2 className="w-8 h-8 animate-spin text-[#df9168]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0c0d10] text-slate-100 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-[20%] left-[25%] w-[40%] h-[40%] rounded-full bg-[#d97757]/8 blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[25%] w-[35%] h-[35%] rounded-full bg-emerald-500/5 blur-[160px] pointer-events-none" />

      <div className="w-full max-w-md p-8 rounded-3xl bg-[#12141c]/90 border border-white/10 shadow-2xl backdrop-blur-2xl relative z-10 space-y-6">
        {/* Header Icon & Title */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-[#181b24] border border-white/10 flex items-center justify-center mx-auto shadow-xl p-2 text-[#df9168]">
            <Shield className="w-8 h-8 stroke-[2]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
            {isSetupMode ? 'Create Superadmin' : 'Admin Portal'}
          </h1>
          <p className="text-xs font-mono text-slate-400">
            {isSetupMode
              ? 'Initialize the first administrator account for CustomMCLauncher'
              : 'Enter administrator credentials to access the management center'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[#df9168]" />
              <span>{isSetupMode ? 'Email Address' : 'Email or Username'}</span>
            </label>
            <input
              type={isSetupMode ? 'email' : 'text'}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isSetupMode ? 'admin@example.com' : 'admin@example.com / admin'}
              className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#d97757] font-mono transition-colors"
            />
          </div>

          {isSetupMode && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#df9168]" />
                <span>Admin Username</span>
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#d97757] font-mono transition-colors"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#df9168]" />
              <span>Password</span>
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#d97757] font-mono transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-6 rounded-xl font-bold text-xs uppercase tracking-widest text-white terracotta-gradient hover:brightness-110 shadow-[0_0_25px_rgba(217,119,87,0.35)] transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <>
                <span>{isSetupMode ? 'Create & Sign In' : 'Authenticate'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
