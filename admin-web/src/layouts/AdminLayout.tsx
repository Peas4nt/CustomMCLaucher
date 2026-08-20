import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { adminApi } from '../api';
import { AdminUser } from '../types';
import {
  LayoutDashboard,
  Settings2,
  Server,
  FolderSync,
  Users,
  Newspaper,
  Tag,
  LogOut,
  Shield,
  Activity,
  ExternalLink,
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(adminApi.getStoredUser());
  const [isServerHealthy, setIsServerHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    const token = adminApi.getStoredToken();
    if (!token) {
      navigate('/login');
      return;
    }

    // Verify token / me
    adminApi
      .getMe()
      .then((user) => {
        setCurrentUser(user);
        setIsServerHealthy(true);
      })
      .catch(() => {
        adminApi.clearSession();
        navigate('/login');
      });

    // Check health periodically
    const checkHealth = () => {
      fetch('/api/health')
        .then((res) => setIsServerHealthy(res.ok))
        .catch(() => setIsServerHealthy(false));
    };
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, [navigate]);

  const handleLogout = () => {
    adminApi.clearSession();
    navigate('/login');
  };

  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/config', label: 'Game Config', icon: Settings2 },
    { to: '/servers', label: 'Game Servers', icon: Server },
    { to: '/files', label: 'File Indexer', icon: FolderSync },
    { to: '/users', label: 'Users', icon: Users },
    { to: '/news', label: 'News', icon: Newspaper },
  ];

  const isNewsSection = location.pathname.startsWith('/news');

  return (
    <div className="min-h-screen flex flex-col bg-[#0c0d10] text-slate-100 selection:bg-[#d97757] selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#0c0d10]/95 backdrop-blur-xl select-none">
        {/* Left: Brand / Logo */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#16181f] border border-white/10 flex items-center justify-center p-1.5 shadow-lg">
            <img
              src="/logo.png"
              alt="Logo"
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <Shield className="w-5 h-5 text-[#df9168]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm tracking-widest uppercase text-white">
                CML CONTROL CENTER
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#d97757]/20 text-[#df9168] border border-[#d97757]/30">
                v1.1 ADMIN
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Minecraft Launcher Backend & Distribution Manager
            </p>
          </div>
        </div>

        {/* Center: Top Navigation Pills */}
        <nav className="hidden md:flex items-center gap-1 bg-[#14161d] p-1 rounded-full border border-white/[0.08]">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                    isActive
                      ? 'bg-white/10 text-white border border-[#d97757]/60 shadow-[0_0_12px_rgba(217,119,87,0.25)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                  }`
                }
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Right: Health Badge & User Profile */}
        <div className="flex items-center gap-4">
          {/* Health Status Indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                isServerHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="text-slate-300">
              {isServerHealthy ? 'BACKEND ONLINE' : 'DISCONNECTED'}
            </span>
          </div>

          {/* User Profile Pill & Logout */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#16181f] border border-white/10 text-xs">
              <img
                src={`https://minotar.net/helm/${currentUser?.username || 'Admin'}/28.png`}
                alt="Avatar"
                className="w-5 h-5 rounded-md object-cover border border-white/15 bg-black/40"
                onError={(e) => {
                  e.currentTarget.src = 'https://minotar.net/helm/Steve/28.png';
                }}
              />
              <span className="font-bold text-slate-200 font-mono">
                {currentUser?.username || 'Admin'}
              </span>
            </div>

            <button
              onClick={handleLogout}
              title="Logout"
              className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors border border-white/10"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* News Sub-Navbar */}
      {isNewsSection && (
        <div className="border-b border-white/[0.06] bg-[#0e1017] px-6 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center gap-4">
            <span className="text-[11px] font-mono font-bold uppercase text-[#df9168] flex items-center gap-1.5 pr-3 border-r border-white/10">
              <Newspaper className="w-3.5 h-3.5" />
              <span>News Desk</span>
            </span>
            <div className="flex items-center gap-1.5">
              <NavLink
                to="/news"
                end
                className={({ isActive }) =>
                  `px-3.5 py-1 rounded-xl text-xs font-mono font-bold uppercase transition-all ${
                    isActive
                      ? 'bg-white/15 text-white border border-[#df9168]/50 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`
                }
              >
                Articles
              </NavLink>
              <NavLink
                to="/news/tags"
                className={({ isActive }) =>
                  `px-3.5 py-1 rounded-xl text-xs font-mono font-bold uppercase transition-all ${
                    isActive
                      ? 'bg-white/15 text-white border border-[#df9168]/50 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`
                }
              >
                News Tags
              </NavLink>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Navigation Bar */}
      <div className="md:hidden flex items-center justify-around px-4 py-2 border-b border-white/[0.08] bg-[#12141a]">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-bold uppercase transition-all ${
                  isActive ? 'text-[#df9168]' : 'text-slate-400'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      {/* Page Content Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-8 animate-in fade-in duration-200">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="px-8 py-5 border-t border-white/[0.06] bg-[#090a0d] text-xs font-mono text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <span>CustomMCLauncher Management Portal • v1.1</span>
        </div>
        <div className="flex items-center gap-5">
          <a
            href="/api/v1/health"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white transition-colors flex items-center gap-1"
          >
            <Activity className="w-3 h-3 text-[#df9168]" />
            <span>Health API</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
          <a
            href="/api/files/manifest"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white transition-colors flex items-center gap-1"
          >
            <FolderSync className="w-3 h-3 text-[#df9168]" />
            <span>Modpack Manifest</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </footer>
    </div>
  );
};
