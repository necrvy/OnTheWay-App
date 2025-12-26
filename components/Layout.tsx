
import React from 'react';
import { TabType, User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  user: User;
  isDarkMode: boolean;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, user, isDarkMode, onLogout }) => {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-black transition-colors duration-300">
      <header className="bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-black/10 dark:border-white/10 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center overflow-hidden border border-white/10 shadow-lg shrink-0">
               <span className="text-white font-brand font-black text-xl">W</span>
            </div>
            <div className="min-w-0">
              <h1 className="font-brand text-lg font-black tracking-tighter text-black dark:text-white leading-none truncate uppercase italic">
                On The Way
              </h1>
              <p className="text-[9px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mt-0.5">Plano Bíblico 2026</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-rose-500 dark:text-zinc-600 dark:hover:text-rose-400 transition-colors"
              title="Sair da Conta"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 overflow-hidden flex items-center justify-center shrink-0 ml-1">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-black dark:text-white font-serif font-bold text-xs">{user.name[0]}</span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-md mx-auto px-4 py-6">
          {children}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-black border-t border-black/10 dark:border-white/10 py-3 z-20 shadow-lg transition-colors duration-300">
        <div className="max-w-md mx-auto flex justify-around items-center px-2">
          <NavButton 
            isActive={activeTab === 'daily'} 
            onClick={() => setActiveTab('daily')}
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
            label="Início"
          />
          <NavButton 
            isActive={activeTab === 'plan'} 
            onClick={() => setActiveTab('plan')}
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
            label="Plano"
          />
          <NavButton 
            isActive={activeTab === 'ranking'} 
            onClick={() => setActiveTab('ranking')}
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
            label="Ranking"
          />
          <NavButton 
            isActive={activeTab === 'profile'} 
            onClick={() => setActiveTab('profile')}
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
            label="Perfil"
          />
        </div>
      </nav>
    </div>
  );
};

const NavButton: React.FC<{ isActive: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ isActive, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 transition-all ${isActive ? 'text-black dark:text-white scale-105' : 'text-slate-600 dark:text-zinc-600 hover:text-slate-800 dark:hover:text-zinc-400'}`}
  >
    {icon}
    <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
  </button>
);

export default Layout;