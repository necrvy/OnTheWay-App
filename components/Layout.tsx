
import React from 'react';
import { TabType, User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onLogout: () => void;
  user: User;
  onOpenProfile: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, onLogout, user, onOpenProfile, isDarkMode, toggleDarkMode }) => {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-black transition-colors duration-300">
      <header className="bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-black/10 dark:border-white/10 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={onOpenProfile}
              className="w-10 h-10 rounded-full bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
            >
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                   <span className="text-black dark:text-white font-serif font-bold text-lg">W</span>
                </div>
              )}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center overflow-hidden border border-white/10 shadow-lg">
                 <span className="text-white font-serif font-bold text-xl mt-[-2px]">W</span>
              </div>
              <div>
                <h1 className="font-serif text-lg font-bold tracking-tight text-black dark:text-white leading-none">
                  On The Way
                </h1>
                <p className="text-[9px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mt-0.5">Plano Anual 2026</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={toggleDarkMode}
              className="p-2 text-slate-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
              title="Alternar Tema"
            >
              {isDarkMode ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>
            <button 
              onClick={onLogout}
              className="p-2 text-slate-500 dark:text-zinc-600 hover:text-black dark:hover:text-white transition-colors"
              title="Sair"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
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
            label="Hoje"
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
            isActive={activeTab === 'insights'} 
            onClick={() => setActiveTab('insights')}
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
            label="Insights"
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
