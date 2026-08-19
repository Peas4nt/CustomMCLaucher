import React, { useState, useRef, useEffect } from 'react';
import { UserProfile as UserProfileType } from '../types';
import { LogOut, ShieldCheck, KeyRound } from 'lucide-react';

interface UserProfileProps {
  user: UserProfileType | null;
  onLogout: () => void;
  onOpenAuthModal: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({
  user,
  onLogout,
  onOpenAuthModal,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return (
      <button
        onClick={onOpenAuthModal}
        className="h-9 flex items-center gap-2 px-5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 hover:text-white border border-white/10 hover:border-[#d97757]/50 text-xs font-bold uppercase tracking-widest transition-all shadow-md"
      >
        <KeyRound className="w-3.5 h-3.5 text-[#df9168]" />
        <span>LOGIN</span>
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-9 flex items-center gap-2.5 px-3 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 hover:border-[#d97757]/40 transition-all group"
      >
        {/* Avatar badge */}
        <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-900 border border-white/10 shrink-0">
          <img 
            src={`https://minotar.net/helm/${user.username}/32.png`} 
            alt={user.username} 
            className="w-full h-full object-cover" 
            onError={(e) => (e.currentTarget.src = 'https://minotar.net/helm/Steve/32.png')} 
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">
            {user.username}
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl glass-panel-elevated p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="p-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-100">{user.username}</span>
              {user.role === 'ADMIN' && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  ADMIN
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400 truncate block mt-0.5">{user.email}</span>
          </div>

          <div className="p-1 mt-1">
            <button
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-sm font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
