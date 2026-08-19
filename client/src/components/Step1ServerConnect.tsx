import React, { useState, useEffect } from 'react';
import { Globe, Server, CheckCircle2, AlertCircle, ArrowRight, Loader2, Zap } from 'lucide-react';
import { apiService } from '../services/api';

interface Step1ServerConnectProps {
  onConnected: (backendUrl: string) => void;
}

export const Step1ServerConnect: React.FC<Step1ServerConnectProps> = ({ onConnected }) => {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    service: string;
    version: string;
    minecraftVersion?: string;
    loaderType?: string;
    pingMs: number;
  } | null>(null);

  useEffect(() => {
    const existing = apiService.getBaseUrl();
    if (existing) {
      setUrl(existing);
    }
  }, []);

  const handleValidateAndConnect = async (e?: React.FormEvent, customUrl?: string) => {
    if (e) e.preventDefault();
    const targetUrl = customUrl || url;
    if (!targetUrl.trim()) {
      setError('Please enter the remote server URL or IP address');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessInfo(null);

    const startTime = Date.now();
    let formattedUrl = targetUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `http://${formattedUrl}`;
      setUrl(formattedUrl);
    }

    try {
      const health = await apiService.checkHealth(formattedUrl);
      const pingMs = Date.now() - startTime;

      setSuccessInfo({
        service: health.service,
        version: health.version,
        minecraftVersion: health.minecraftVersion,
        loaderType: health.loaderType,
        pingMs,
      });

      apiService.setBaseUrl(formattedUrl);

      // Auto-advance after brief confirmation animation
      setTimeout(() => {
        onConnected(formattedUrl);
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Could not connect to the server. Please check IP address, port, and network.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#090a0f] relative overflow-hidden select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-[#d97757]/15 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-[#df9168]/10 blur-[140px] pointer-events-none" />

      <div className="w-full max-w-lg p-8 rounded-3xl bg-[#12141c]/90 border border-white/10 shadow-2xl backdrop-blur-2xl relative z-10 space-y-6">
        {/* Step Indicator & Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-xl bg-[#d97757]/20 text-[#df9168] border border-[#d97757]/30 flex items-center justify-center text-xs font-black font-mono">
              1
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-[#df9168] font-mono">
              Step 1 of 3
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
            <Zap className="w-3.5 h-3.5 text-[#df9168]" />
            <span>CONNECT REALM</span>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#d97757] to-[#e89d75] flex items-center justify-center shadow-lg shadow-[#d97757]/20">
            <Server className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase">
            Connect to Server
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Enter the IP address or host URL of the launcher distribution server to synchronize modpacks, configs, and authentication.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-3 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Connection Failed</div>
              <div className="text-[11px] text-rose-300/80 mt-0.5">{error}</div>
            </div>
          </div>
        )}

        {successInfo && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-3 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            <div className="flex-1">
              <div className="font-bold flex items-center justify-between">
                <span>Server Verified ({successInfo.pingMs}ms)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                  ONLINE
                </span>
              </div>
              <div className="text-[11px] text-emerald-200/80 mt-1 font-mono">
                {successInfo.minecraftVersion
                  ? `Minecraft ${successInfo.minecraftVersion} (${successInfo.loaderType})`
                  : successInfo.service}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleValidateAndConnect} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#df9168]" />
              <span>Backend IP or Host URL</span>
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g. http://localhost:4000 or http://192.168.1.100:4000"
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
                <span>Checking Server Health...</span>
              </>
            ) : (
              <>
                <span>Validate & Connect</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="pt-2 text-center text-xs font-mono text-slate-500">
          Default local server is <code className="text-[#df9168]">http://localhost:4000</code>
        </div>
      </div>
    </div>
  );
};
