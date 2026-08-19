import React, { useState, useEffect } from 'react';
import { GameServer, GlobalConfig, NewsArticle, SyncProgressData, UserProfile } from '../types';
import { UserProfile as UserProfileComponent } from './UserProfile';
import { AuthModal } from './AuthModal';
import { NewsView } from './NewsView';
import { NewsCardsWidget } from './NewsCardsWidget';
import { SettingsView } from './SettingsView';
import { LogsView } from './LogsView';
import { TauriService } from '../services/tauri';
import { apiService } from '../services/api';
import { Loader2, Sparkles, X, Users, Globe } from 'lucide-react';

interface DashboardProps {
  selectedServer: GameServer | null;
  globalConfig: GlobalConfig;
  user: UserProfile | null;
  authToken: string | null;
  onLogout: () => void;
  onAuthSuccess: (user: UserProfile, token: string) => void;
}

interface ServerPingInfo {
  online: boolean;
  onlinePlayers: number;
  maxPlayers: number;
  loading: boolean;
  samplePlayers?: { name: string; id?: string }[];
}

type TabType = 'DASHBOARD' | 'NEWS' | 'SETTINGS' | 'LOGS';

export const Dashboard: React.FC<DashboardProps> = ({
  selectedServer,
  globalConfig,
  user,
  authToken,
  onLogout,
  onAuthSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('DASHBOARD');
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // News State
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);

  const [isInstalled, setIsInstalled] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgressData | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Ready to play');

  // Logs state
  const [gameLogs, setGameLogs] = useState<{ text: string; stream: string; timestamp: string }[]>([]);
  const [serverPing, setServerPing] = useState<ServerPingInfo | null>(null);

  useEffect(() => {
    if (!selectedServer) return;

    let isMounted = true;
    setServerPing((prev) => ({
      online: prev?.online ?? false,
      onlinePlayers: prev?.onlinePlayers ?? 0,
      maxPlayers: prev?.maxPlayers ?? 20,
      loading: true,
      samplePlayers: prev?.samplePlayers,
    }));

    const ping = async () => {
      try {
        const res = await TauriService.pingServer(
          selectedServer.ipAddress,
          selectedServer.port || 25565
        );
        if (isMounted) {
          setServerPing({
            online: res.online,
            onlinePlayers: res.online_players,
            maxPlayers: res.max_players,
            loading: false,
            samplePlayers: res.sample_players || [],
          });
        }
      } catch (err) {
        if (isMounted) {
          setServerPing({
            online: false,
            onlinePlayers: 0,
            maxPlayers: 0,
            loading: false,
            samplePlayers: [],
          });
        }
      }
    };

    ping();
    const interval = setInterval(ping, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedServer?.id, selectedServer?.ipAddress, selectedServer?.port]);

  useEffect(() => {
    let unlistenSync: (() => void) | undefined;
    let unlistenLog: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;

    TauriService.onSyncProgress((event) => {
      if (event.status === 'DOWNLOADING') {
        setIsInstalled(false);
        setIsSyncing(true);
        if (event.totalFiles > 0) {
          setStatusMessage(`Syncing modpack (${event.filesCompleted}/${event.totalFiles})...`);
        } else {
          setStatusMessage('Checking modpack files...');
        }
      } else if (event.status === 'READY') {
        setIsInstalled(true);
        setIsSyncing(false);
        setStatusMessage('Sync complete! Ready to play.');
      } else if (event.status === 'ERROR') {
        setIsSyncing(false);
        setStatusMessage(`Sync error: ${event.currentFile}`);
      }
      setSyncProgress(event);
    }).then((unsub) => (unlistenSync = unsub));

    TauriService.onGameLog((log) => {
      setGameLogs((prev) => [...prev.slice(-499), log]);
    }).then((unsub) => (unlistenLog = unsub));

    TauriService.onGameExited(() => {
      setIsGameRunning(false);
      setStatusMessage('Game session ended.');
    }).then((unsub) => (unlistenExit = unsub));

    TauriService.checkGameDownloaded(globalConfig.minecraftVersion).then(setIsInstalled);
    TauriService.isGameRunning().then(setIsGameRunning);

    apiService.fetchNews().then(setNewsArticles);

    const processPollInterval = setInterval(async () => {
      const running = await TauriService.isGameRunning();
      setIsGameRunning((prev) => {
        if (prev && !running) {
          setStatusMessage('Game session ended.');
        }
        return running;
      });
    }, 1000);

    return () => {
      if (unlistenSync) unlistenSync();
      if (unlistenLog) unlistenLog();
      if (unlistenExit) unlistenExit();
      clearInterval(processPollInterval);
    };
  }, [globalConfig.minecraftVersion]);

  const handleOpenArticle = (article: NewsArticle) => {
    setSelectedArticle(article);
    setActiveTab('NEWS');
  };

  const handleActionClick = async () => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }

    try {
      if (!isInstalled) {
        setIsSyncing(true);
        setStatusMessage('Downloading Minecraft client & assets...');
        await TauriService.downloadGameFiles({
          minecraftVersion: globalConfig.minecraftVersion,
          loaderType: globalConfig.loaderType,
          loaderVersion: globalConfig.loaderVersion,
        });
        await TauriService.syncModpack();
        setIsInstalled(true);
        setStatusMessage('Download complete! Ready to play.');
        return;
      }

      setIsSyncing(true);
      setStatusMessage('Verifying modpack files...');
      await TauriService.syncModpack();

      setIsSyncing(false);
      setIsLaunching(true);
      setStatusMessage('Starting Minecraft JVM process...');

      await TauriService.launchGame({
        playerName: user.username,
        playerUuid: user.id,
        authToken: authToken || 'offline-token',
        minecraftVersion: globalConfig.minecraftVersion,
        loaderType: globalConfig.loaderType,
        loaderVersion: globalConfig.loaderVersion,
        serverIp: selectedServer?.ipAddress,
        serverPort: selectedServer?.port,
      });

      setIsLaunching(false);
      setIsGameRunning(true);
      setStatusMessage('Minecraft is running. Enjoy playing!');
    } catch (err: any) {
      console.error('Action failed:', err);
      setStatusMessage(`Error: ${err.message || err}`);
      setIsGameRunning(false);
    } finally {
      setIsSyncing(false);
      setIsLaunching(false);
    }
  };

  const handleKillGame = async () => {
    try {
      await TauriService.killGame();
      setStatusMessage('Game terminated by user.');
    } catch (e: any) {
      setStatusMessage(`Failed to kill game: ${e}`);
    } finally {
      setIsGameRunning(false);
    }
  };

  const isBusy = isSyncing || isLaunching;
  const players = serverPing?.samplePlayers || [];

  return (
    <div className="relative w-full h-screen flex flex-col justify-between overflow-hidden bg-[#0e1013] text-slate-100 selection:bg-[#d97757] selection:text-white">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
        <div className="absolute top-[10%] left-[20%] w-[50%] h-[50%] rounded-full bg-[#d97757]/8 blur-[160px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] rounded-full bg-emerald-600/5 blur-[160px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:3.5rem_3.5rem]" />
      </div>

      <header className="relative z-30 flex items-center justify-between px-8 py-5 border-b border-white/[0.07] bg-[#0e1013]/90 backdrop-blur-xl select-none">
        <div className="flex items-center gap-3.5 cursor-pointer group" onClick={() => setActiveTab('DASHBOARD')}>
          <div className="w-12 h-12 rounded-2xl bg-[#181a1f] border border-white/10 flex items-center justify-center shadow-lg p-1.5 group-hover:border-[#d97757]/60 group-hover:scale-105 transition-all duration-200 overflow-hidden">
            {import.meta.env.VITE_NAVBAR_LOGO_URL ? (
              <img
                src={import.meta.env.VITE_NAVBAR_LOGO_URL}
                alt="Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fb = e.currentTarget.nextElementSibling;
                  if (fb) (fb as HTMLElement).style.display = 'block';
                }}
              />
            ) : null}
            <svg
              viewBox="0 0 16 16"
              className={`w-full h-full fill-[#3bb35c] ${import.meta.env.VITE_NAVBAR_LOGO_URL ? 'hidden' : ''}`}
            >
              <path d="M0 0h16v16H0z" fill="#2d8042" />
              <path d="M3 3h4v4H3zM9 3h4v4H9zM5 7h6v4H5zM3 9h2v4H3zM11 9h2v4h-2zM5 11h2v3H5zM9 11h2v3H9z" fill="#0c170e" />
            </svg>
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="font-extrabold text-base tracking-widest uppercase text-white group-hover:text-[#df9168] transition-colors">
              CML
            </span>
            <span className="text-[10px] text-slate-400 font-mono">v1.0</span>
          </div>
        </div>

        <nav className="flex items-center gap-1.5 sm:gap-3">
          {[
            { key: 'DASHBOARD', label: 'OVERVIEW' },
            { key: 'NEWS', label: 'NEWS' },
            { key: 'SETTINGS', label: 'OPTIONS' },
            { key: 'LOGS', label: 'LOGS' },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  if (tab.key === 'NEWS') setSelectedArticle(null);
                  setActiveTab(tab.key as TabType);
                }}
                className={`relative px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-200 ${
                  isActive
                    ? 'bg-white/10 text-white border border-[#d97757]/60 shadow-[0_0_12px_rgba(217,119,87,0.25)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                {tab.label}
                {tab.key === 'LOGS' && gameLogs.length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d97757] inline-block ml-1 animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <UserProfileComponent
            user={user}
            onLogout={onLogout}
            onOpenAuthModal={() => setIsAuthOpen(true)}
          />
        </div>
      </header>

      {/* CENTRAL VIEW AREA */}
      <main
        className={`relative z-10 flex-1 w-full flex flex-col ${
          activeTab === 'DASHBOARD' ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'
        }`}
      >
        {activeTab === 'DASHBOARD' && (
          <div className="w-full h-full flex flex-col justify-center px-8 sm:px-12 md:px-16 py-4 animate-in fade-in duration-300">
            <div className="max-w-6xl w-full mx-auto grid grid-cols-12 gap-8 items-center">
              <div className="col-span-7 space-y-4">
                <div className="space-y-1 select-none">
                  <div className="hero-title-solid text-4xl sm:text-6xl md:text-7xl leading-none">
                    {selectedServer?.name || 'MINECRAFT'}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs sm:text-sm font-mono font-bold tracking-widest text-[#df9168] uppercase flex-wrap">
                  <span>{globalConfig.minecraftVersion} ({globalConfig.loaderType.toUpperCase()})</span>
                  <span className="text-slate-600">•</span>
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Globe className="w-3.5 h-3.5 text-[#df9168]" />
                    {selectedServer?.ipAddress}:{selectedServer?.port || 25565}
                  </span>
                </div>

                {selectedServer?.description && (
                  <p className="text-xs sm:text-sm text-slate-300 font-normal leading-relaxed max-w-xl">
                    {selectedServer.description}
                  </p>
                )}

                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                    <Users className="w-4 h-4 text-[#df9168]" />
                    <span>
                      {serverPing
                        ? serverPing.online
                          ? `${serverPing.onlinePlayers} / ${serverPing.maxPlayers} PLAYERS ONLINE`
                          : 'SERVER OFFLINE'
                        : 'ONLINE PLAYERS'}
                    </span>
                    {serverPing?.online && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
                    )}
                  </div>

                  {players.length > 0 ? (
                    players.length <= 3 ? (
                      <div className="flex items-center gap-3 flex-wrap py-1">
                        {players.map((player, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 shadow-md backdrop-blur-md hover:border-[#d97757]/40 transition-colors"
                          >
                            <img
                              src={`https://minotar.net/helm/${player.name}/48.png`}
                              alt={player.name}
                              className="w-7 h-7 rounded-lg object-cover border border-white/15 bg-black/40 shadow-sm"
                              onError={(e) => {
                                e.currentTarget.src = 'https://minotar.net/helm/Steve/48.png';
                              }}
                            />
                            <span className="text-xs font-mono text-slate-200 font-bold">
                              {player.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="relative overflow-hidden w-full max-w-xl py-1 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
                        <div className="animate-marquee gap-3">
                          {[...players, ...players, ...players].map((player, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 shrink-0 shadow-md backdrop-blur-md"
                            >
                              <img
                                src={`https://minotar.net/helm/${player.name}/48.png`}
                                alt={player.name}
                                className="w-7 h-7 rounded-lg object-cover border border-white/15 bg-black/40 shadow-sm"
                                onError={(e) => {
                                  e.currentTarget.src = 'https://minotar.net/helm/Steve/48.png';
                                }}
                              />
                              <span className="text-xs font-mono text-slate-200 font-bold">
                                {player.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl bg-slate-900/60 border border-white/5 w-fit text-xs font-mono text-slate-400">
                      <span className="w-2 h-2 rounded-full bg-slate-500" />
                      <span>NO PLAYERS CURRENTLY ONLINE • BE THE FIRST TO JOIN</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 max-w-xl text-xs font-mono text-slate-400 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-slate-300">{statusMessage}</span>
                  </div>
                </div>
              </div>

              <div className="col-span-5 flex flex-col justify-center items-end">
                <NewsCardsWidget
                  articles={newsArticles}
                  onSelectArticle={handleOpenArticle}
                  onViewAllNews={() => {
                    setSelectedArticle(null);
                    setActiveTab('NEWS');
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'NEWS' && (
          <NewsView
            initialArticle={selectedArticle}
            onClearInitialArticle={() => setSelectedArticle(null)}
          />
        )}
        {activeTab === 'SETTINGS' && <SettingsView />}
        {activeTab === 'LOGS' && (
          <LogsView logs={gameLogs} onClearLogs={() => setGameLogs([])} />
        )}
      </main>

      <footer className="relative z-30 flex items-center justify-between px-10 py-7 sm:py-8 border-t border-white/[0.07] bg-[#0c0d10]/95 backdrop-blur-xl select-none min-h-[90px]">
        <div className="flex items-center" />

        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center z-20">
          <div className="relative flex flex-col items-center">
            <button
              onClick={isGameRunning ? handleKillGame : handleActionClick}
              disabled={isBusy && !isGameRunning}
              className={`min-w-[220px] sm:min-w-[280px] h-14 px-8 rounded-2xl font-black text-xs uppercase tracking-widest font-mono transition-all duration-300 transform active:scale-95 shadow-xl relative overflow-hidden group ${
                isGameRunning
                  ? 'bg-rose-950/40 border border-rose-500/30 text-rose-300 hover:bg-rose-900/60 hover:border-rose-400'
                  : 'bg-[#d97757] hover:bg-[#e88868] text-white border border-[#e88868]/40 shadow-[0_0_20px_rgba(217,119,87,0.35)]'
              }`}
            >
              {isSyncing && syncProgress && syncProgress.totalFiles > 0 && (
                <div
                  className="absolute inset-0 bg-[#b95737] transition-all duration-300 ease-out z-0 opacity-80"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((syncProgress.filesCompleted / syncProgress.totalFiles) * 100)
                    )}%`,
                  }}
                />
              )}

              <div className="relative z-10 flex items-center justify-center gap-2.5">
                {isBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>
                      {isSyncing
                        ? syncProgress && syncProgress.totalFiles > 0
                          ? `MODS: ${syncProgress.filesCompleted} / ${syncProgress.totalFiles} (${Math.round(
                              (syncProgress.filesCompleted / syncProgress.totalFiles) * 100
                            )}%)`
                          : 'SYNCING MODPACK'
                        : 'LAUNCHING...'}
                    </span>
                  </>
                ) : isGameRunning ? (
                  <>
                    <X className="w-4 h-4 text-rose-400 group-hover:rotate-90 transition-transform duration-200" />
                    <span>CLOSE GAME</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                    <span>{isInstalled ? 'PLAY' : 'INSTALL & PLAY'}</span>
                  </>
                )}
              </div>
            </button>

            {isSyncing && syncProgress && syncProgress.totalFiles > 0 && (
              <div className="absolute -bottom-6 w-max flex flex-col items-center">
                <div className="flex items-center gap-2 text-[10px] font-mono tracking-wider">
                  <span className="text-[#df9168] font-bold">
                    {syncProgress.filesCompleted} downloaded
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-500 font-medium">
                    {syncProgress.totalFiles - syncProgress.filesCompleted} remaining
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-5 text-xs font-mono text-slate-400">
          <a
            href={import.meta.env.VITE_DISCORD_URL || 'https://discord.gg'}
            target="_blank"
            rel="noreferrer"
            className="hover:text-white transition-colors flex items-center gap-1 uppercase"
          >
            DISCORD <span className="text-[10px]">↗</span>
          </a>
          <a
            href={import.meta.env.VITE_GITHUB_URL || 'https://github.com'}
            target="_blank"
            rel="noreferrer"
            className="hover:text-white transition-colors flex items-center gap-1 uppercase"
          >
            GITHUB <span className="text-[10px]">↗</span>
          </a>
        </div>
      </footer>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(u, token) => {
          onAuthSuccess(u, token);
          setIsAuthOpen(false);
        }}
      />
    </div>
  );
};
