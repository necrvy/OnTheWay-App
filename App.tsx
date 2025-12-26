
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { TabType, ReadingDay, Devotional, User, GCEURanking, MemberRanking } from './types';
import { generatePlan2026, MOCK_GCEU_RANKING, MOCK_MEMBER_RANKING } from './constants';
import { getDailyDevotional, askBibleAssistant } from './services/geminiService';
import Layout from './components/Layout';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('daily');
  const [plan, setPlan] = useState<ReadingDay[]>([]);
  const [devotional, setDevotional] = useState<Devotional | null>(null);
  const [loadingDevo, setLoadingDevo] = useState(false);
  const [showFullRanking, setShowFullRanking] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('otw_theme') === 'dark';
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('otw_notifications') === 'true';
  });
  
  // Auth & Profile Form State
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authGceu, setAuthGceu] = useState('');
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'ai', text: string}[]>([]);
  const [isAnswering, setIsAnswering] = useState(false);
  const [viewingMonth, setViewingMonth] = useState(0);

  // Sync Dark Mode with DOM
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('otw_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('otw_theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const savedUser = localStorage.getItem('otw_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      setAuthName(user.name);
      setAuthGceu(user.gceu);
      setProfileAvatar(user.avatar || null);
    }

    const PLAN_KEY = 'otw_plan_2026_v5';
    const savedPlan = localStorage.getItem(PLAN_KEY);
    if (savedPlan) {
      setPlan(JSON.parse(savedPlan));
    } else {
      const newPlan = generatePlan2026();
      setPlan(newPlan);
      localStorage.setItem(PLAN_KEY, JSON.stringify(newPlan));
    }

    const now = new Date();
    setViewingMonth(now.getFullYear() === 2026 ? now.getMonth() : 0);
  }, []);

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      alert("Este navegador não suporta notificações.");
      return;
    }
    
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotificationsEnabled(true);
      localStorage.setItem('otw_notifications', 'true');
      new Notification("On The Way", {
        body: "Lembretes ativados! Vamos caminhar juntos na Palavra.",
        icon: "logo.png"
      });
    } else {
      alert("Permissão de notificação negada.");
    }
  };

  const toggleNotifications = () => {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      localStorage.setItem('otw_notifications', 'false');
    } else {
      requestNotificationPermission();
    }
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegistering) {
      if (!authName || !authEmail || !authPassword || !authGceu) return;
      const newUser: User = { 
        id: Date.now().toString(), 
        name: authName, 
        email: authEmail, 
        gceu: authGceu,
        avatar: profileAvatar || undefined
      };
      setCurrentUser(newUser);
      localStorage.setItem('otw_user', JSON.stringify(newUser));
    } else {
      if (!authEmail || !authPassword) return;
      const mockUser: User = { id: '1', name: 'Usuário On The Way', email: authEmail, gceu: 'GCEU Shalom' };
      setCurrentUser(mockUser);
      localStorage.setItem('otw_user', JSON.stringify(mockUser));
    }
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const updatedUser = { 
      ...currentUser, 
      name: authName, 
      gceu: authGceu, 
      avatar: profileAvatar || undefined 
    };
    setCurrentUser(updatedUser);
    localStorage.setItem('otw_user', JSON.stringify(updatedUser));
    setIsProfileOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('otw_user');
  };

  const getTodayDateStr = useCallback(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    if (currentYear < 2026) return '2026-01-01';
    if (currentYear > 2026) return '2026-12-31';
    return now.toISOString().split('T')[0];
  }, []);

  const todayDateStr = useMemo(() => getTodayDateStr(), [getTodayDateStr]);

  const todayReading = useMemo(() => {
    if (plan.length === 0) return null;
    return plan.find(d => d.date === todayDateStr) || plan[0];
  }, [plan, todayDateStr]);

  useEffect(() => {
    if (currentUser && todayReading && !devotional) {
      const fetchDevo = async () => {
        setLoadingDevo(true);
        try {
          const data = await getDailyDevotional(todayReading.title);
          setDevotional(data);
        } catch (error) {
          console.error("Failed to fetch devotional", error);
        } finally {
          setLoadingDevo(false);
        }
      };
      fetchDevo();
    }
  }, [todayReading, devotional, currentUser]);

  const toggleComplete = useCallback((date: string) => {
    setPlan(prev => {
      const updated = prev.map(d => {
        if (d.date === date) {
          const isMarkingAsComplete = !d.isCompleted;
          return { 
            ...d, 
            isCompleted: isMarkingAsComplete,
            completedAt: isMarkingAsComplete ? new Date().toISOString().split('T')[0] : undefined
          };
        }
        return d;
      });
      localStorage.setItem('otw_plan_2026_v5', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Lógica de Pontos: 2 em dia, 1 atrasado
  const currentPoints = useMemo(() => {
    return plan.reduce((acc, day) => {
      if (!day.isCompleted) return acc;
      const isOnTime = day.completedAt === day.date;
      return acc + (isOnTime ? 2 : 1);
    }, 0);
  }, [plan]);

  const progress = useMemo(() => {
    if (plan.length === 0) return 0;
    const completed = plan.filter(d => d.isCompleted).length;
    return Math.round((completed / plan.length) * 100);
  }, [plan]);

  const filteredPlan = useMemo(() => {
    return plan.filter(d => {
      const dDate = new Date(d.date + 'T12:00:00');
      return dDate.getMonth() === viewingMonth;
    });
  }, [plan, viewingMonth]);

  // Ranking Denso (Empates sucessivos: 1, 1, 1, 2, 2...)
  const sortedRanking = useMemo(() => {
    const list = [...MOCK_MEMBER_RANKING];
    if (currentUser) {
        const filteredList = list.filter(m => m.name !== currentUser.name);
        filteredList.push({
            name: currentUser.name,
            gceu: currentUser.gceu,
            points: currentPoints,
            progress: progress,
            streak: 0,
            avatar: currentUser.avatar
        });
        
        filteredList.sort((a, b) => b.points - a.points);

        let rank = 0;
        let lastPoints = -1;
        return filteredList.map((member) => {
          if (member.points !== lastPoints) {
            rank++;
            lastPoints = member.points;
          }
          return { ...member, rank };
        });
    }
    return list;
  }, [currentUser, currentPoints, progress]);

  const handleAsk = async () => {
    if (!chatInput.trim() || isAnswering) return;
    const question = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: question }]);
    setIsAnswering(true);
    try {
      const answer = await askBibleAssistant(question, todayReading?.title || "Bíblia");
      setChatHistory(prev => [...prev, { role: 'ai', text: answer }]);
    } catch (e) {
      setChatHistory(prev => [...prev, { role: 'ai', text: "Ocorreu um erro." }]);
    } finally {
      setIsAnswering(false);
    }
  };

  const LogoComponent = ({ className }: { className: string }) => (
    <div className={`${className} bg-black rounded-full flex items-center justify-center overflow-hidden border border-white/10 shadow-lg`}>
      <span className="text-white font-serif font-bold text-4xl mt-[-2px]">W</span>
    </div>
  );

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center p-6 transition-colors duration-300">
        <div className="w-full max-w-sm space-y-8 animate-in fade-in zoom-in duration-500 text-center">
          <div className="space-y-4">
            <LogoComponent className="w-32 h-32 mx-auto" />
            <h1 className="text-3xl font-serif font-bold text-black dark:text-white mt-6">On The Way</h1>
            <p className="text-slate-700 dark:text-zinc-500 font-medium tracking-tight">
              {isRegistering ? 'Plano de Leitura 2026' : 'Bem-vindo à Jornada'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-black/5 dark:border-white/5 shadow-xl shadow-slate-200 dark:shadow-none space-y-4 text-left">
            {isRegistering && (
              <>
                <div className="flex flex-col items-center gap-2 mb-2">
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-full bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 flex items-center justify-center overflow-hidden relative group"
                  >
                    {profileAvatar ? (
                      <img src={profileAvatar} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-zinc-900">
                        <span className="text-slate-300 dark:text-zinc-700 font-serif text-2xl">W</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                  </button>
                  <span className="text-[10px] text-slate-600 dark:text-zinc-600 font-bold uppercase text-center w-full">Foto de Perfil</span>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                </div>
                <input 
                  type="text" required placeholder="Nome Completo" value={authName} onChange={e => setAuthName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-black dark:focus:ring-white outline-none dark:text-white placeholder:text-slate-500"
                />
                <input 
                  type="text" required placeholder="Seu GCEU" value={authGceu} onChange={e => setAuthGceu(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-black dark:focus:ring-white outline-none dark:text-white placeholder:text-slate-500"
                />
              </>
            )}
            <input 
              type="email" required placeholder="E-mail" value={authEmail} onChange={e => setAuthEmail(e.target.value)}
              className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-black dark:focus:ring-white outline-none dark:text-white placeholder:text-slate-500"
            />
            <input 
              type="password" required placeholder="Senha" value={authPassword} onChange={e => setAuthPassword(e.target.value)}
              className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-black dark:focus:ring-white outline-none dark:text-white placeholder:text-slate-500"
            />
            <button 
              type="submit"
              className="w-full bg-black dark:bg-white text-white dark:text-black font-bold py-3.5 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors shadow-lg active:scale-95"
            >
              {isRegistering ? 'Criar Conta' : 'Entrar'}
            </button>
          </form>

          <button 
            onClick={() => setIsRegistering(!isRegistering)}
            className="w-full text-center text-sm font-bold text-slate-600 dark:text-zinc-600 hover:text-black dark:hover:text-white transition-colors"
          >
            {isRegistering ? 'Já tem conta? Entrar' : 'Novo por aqui? Criar conta'}
          </button>
        </div>
      </div>
    );
  }

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const visibleRanking = showFullRanking ? sortedRanking : sortedRanking.slice(0, 15);

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      onLogout={handleLogout} 
      user={currentUser}
      onOpenProfile={() => setIsProfileOpen(true)}
      isDarkMode={isDarkMode}
      toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
    >
      {/* Profile Modal */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsProfileOpen(false)} />
          <div className="relative bg-white dark:bg-zinc-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in duration-300 border dark:border-white/10 overflow-y-auto max-h-[90vh]">
            <h2 className="text-2xl font-serif font-bold text-black dark:text-white mb-6 text-center">Configurações</h2>
            
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="flex flex-col items-center gap-2 mb-4">
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-24 h-24 rounded-full bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 shadow-md flex items-center justify-center overflow-hidden relative group"
                >
                  {profileAvatar ? (
                    <img src={profileAvatar} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-zinc-800">
                       <span className="text-slate-300 dark:text-zinc-700 font-serif text-3xl">W</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                    MUDAR
                  </div>
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-600 uppercase ml-1">Nome</label>
                  <input 
                    type="text" value={authName} onChange={setAuthName}
                    className="w-full bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-black dark:focus:ring-white outline-none dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-600 uppercase ml-1">GCEU</label>
                  <input 
                    type="text" value={authGceu} onChange={setAuthGceu}
                    className="w-full bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-black dark:focus:ring-white outline-none dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 space-y-4">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 dark:bg-zinc-800 rounded-lg text-black dark:text-white">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-black dark:text-white block">Lembretes Diários</span>
                        <span className="text-[10px] text-slate-600">Notificações de leitura</span>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={toggleNotifications}
                      className={`w-10 h-6 rounded-full transition-colors relative ${notificationsEnabled ? 'bg-black dark:bg-white' : 'bg-slate-300 dark:bg-zinc-800'}`}
                    >
                      <div className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-all ${notificationsEnabled ? 'translate-x-4 bg-white dark:bg-black' : 'bg-white'}`} />
                    </button>
                 </div>

                 <a 
                   href="https://instagram.com/ontheway_imwg" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="flex items-center justify-between p-1 group"
                 >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 dark:bg-zinc-800 rounded-lg text-black dark:text-white group-hover:scale-110 transition-transform">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.308.975.975 1.247 2.242 1.308 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.334 2.633-1.308 3.608-.975.975-2.242 1.247-3.608 1.308-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.334-3.608-1.308-.975-.975-1.247-2.242-1.308-3.608-.058-1.266-.07-1.646-.07-4.85s.012-3.584.07-4.85c.062-1.366.334-2.633 1.308-3.608.975-.975 2.242-1.247 3.608-1.308 1.266-.058-1.646-.07 4.85-.07zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948s.014 3.667.072 4.947c.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072s3.667-.014 4.947-.072c4.358-.2 6.78-2.618 6.98-6.98.058-1.281.072-1.689.072-4.948s-.014-3.667-.072-4.947c-.2-4.358-2.618-6.78-6.98-6.98-1.281-.058-1.689-.072-4.948-.072zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-black dark:text-white block">Siga-nos</span>
                        <span className="text-[10px] text-slate-600">@ontheway_imwg</span>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                 </a>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" onClick={() => setIsProfileOpen(false)}
                  className="flex-1 px-4 py-3 text-sm font-bold text-slate-600 hover:text-black transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-black dark:bg-white text-white dark:text-black font-bold py-3 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-lg"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'daily' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <section className="bg-black dark:bg-zinc-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-300 dark:shadow-none relative overflow-hidden border border-white/5 transition-colors">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-400 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest">Olá, {currentUser.name.split(' ')[0]}</span>
                <span className="bg-white/10 dark:bg-white/5 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest border border-white/10">{currentPoints} Pts</span>
              </div>
              <div className="flex items-end justify-between">
                <h2 className="text-4xl font-bold">{progress}%</h2>
                <span className="text-xs font-bold uppercase tracking-widest mb-1 opacity-60">{currentUser.gceu}</span>
              </div>
              <div className="w-full bg-white/10 dark:bg-white/5 h-2 rounded-full mt-4 overflow-hidden">
                <div className="bg-white h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div className="absolute top-[-20px] right-[-20px] w-32 h-32 bg-white/5 rounded-full blur-3xl" />
          </section>

          <section className="bg-white dark:bg-zinc-950 rounded-3xl p-6 border border-slate-200 dark:border-zinc-900 shadow-sm transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-slate-600 dark:text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Hoje • {todayDateStr.split('-').reverse().join('/')}</h3>
                <h4 className="text-2xl font-serif font-bold text-black dark:text-white leading-tight">{todayReading?.title}</h4>
              </div>
              <button 
                onClick={() => todayReading && toggleComplete(todayReading.date)}
                className={`p-3 rounded-2xl transition-all duration-300 border-2 ${todayReading?.isCompleted ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' : 'bg-white dark:bg-transparent text-slate-500 dark:text-zinc-800 border-slate-200 dark:border-zinc-900 shadow-sm'}`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
              </button>
            </div>

            {loadingDevo ? (
              <div className="space-y-3 py-4 animate-pulse">
                <div className="h-4 bg-slate-200 dark:bg-zinc-900 rounded w-3/4"></div>
                <div className="h-4 bg-slate-200 dark:bg-zinc-900 rounded w-full"></div>
                <div className="h-4 bg-slate-200 dark:bg-zinc-900 rounded w-5/6"></div>
              </div>
            ) : devotional && (
              <div className="space-y-4">
                <div className="italic text-slate-700 dark:text-zinc-400 border-l-2 border-black dark:border-white pl-4 py-1 text-sm leading-relaxed">
                  "{devotional.keyVerse}"
                </div>
                <p className="text-slate-800 dark:text-zinc-400 text-sm leading-relaxed">{devotional.reflection}</p>
                <div className="pt-2 border-t border-slate-200 dark:border-zinc-900 mt-4">
                  <span className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest block mb-1">Oração sugerida</span>
                  <p className="text-slate-700 dark:text-zinc-500 text-xs italic leading-snug">"{devotional.prayer}"</p>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'plan' && (
        <div className="space-y-4 animate-in slide-in-from-right-10 duration-500">
          <div className="flex items-center justify-between px-1 mb-2">
            <button onClick={() => setViewingMonth(Math.max(0, viewingMonth - 1))} className="p-2 text-slate-600 dark:text-zinc-800 hover:text-black dark:hover:text-white transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg></button>
            <h2 className="text-xl font-serif font-bold text-black dark:text-white">{monthNames[viewingMonth]} 2026</h2>
            <button onClick={() => setViewingMonth(Math.min(11, viewingMonth + 1))} className="p-2 text-slate-600 dark:text-zinc-800 hover:text-black dark:hover:text-white transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg></button>
          </div>
          <div className="space-y-2">
            {filteredPlan.map((day) => {
              const isDelayed = !day.isCompleted && day.date < todayDateStr;
              return (
                <div key={day.date} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                  day.isCompleted ? 'bg-slate-50 dark:bg-zinc-900/40 border-slate-200 dark:border-zinc-900 opacity-60' : 
                  isDelayed ? 'bg-white dark:bg-zinc-950 border-rose-300 dark:border-rose-900/30 shadow-sm' : 'bg-white dark:bg-zinc-950 border-slate-300 dark:border-zinc-900 shadow-sm'
                }`}>
                  <div className={`text-lg font-bold w-8 text-center ${day.isCompleted ? 'text-slate-600 dark:text-zinc-600' : isDelayed ? 'text-rose-600' : 'text-slate-700 dark:text-zinc-600'}`}>
                    {day.date.split('-')[2]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm truncate ${day.isCompleted ? 'text-slate-600 dark:text-zinc-600' : 'text-slate-900 dark:text-zinc-300'}`}>
                        {day.title}
                      </span>
                      {isDelayed && (
                        <span className="bg-black dark:bg-white text-white dark:text-black text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter">
                          Atrasado
                        </span>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => toggleComplete(day.date)} 
                    className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
                      day.isCompleted ? 'bg-black dark:bg-white border-black dark:border-white text-white dark:text-black' : 
                      isDelayed ? 'border-rose-400 dark:border-rose-900/50 text-transparent' : 'border-slate-400 dark:border-zinc-800 text-transparent hover:border-black dark:hover:border-white'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'ranking' && (
        <div className="space-y-8 animate-in slide-in-from-right-10 duration-500">
          <div>
            <h2 className="text-2xl font-serif font-bold text-black dark:text-white">GCEUs</h2>
            <p className="text-xs text-slate-600 dark:text-zinc-600 uppercase font-bold tracking-widest mt-1">Média de Pontos</p>
          </div>

          <div className="space-y-3">
            {MOCK_GCEU_RANKING.map((gceu) => (
              <div key={gceu.name} className={`bg-white dark:bg-zinc-950 rounded-2xl p-4 border border-slate-200 dark:border-zinc-900 shadow-sm flex items-center gap-4 ${gceu.name === currentUser.gceu ? 'ring-1 ring-black dark:ring-white shadow-lg' : ''}`}>
                <div className="w-8 h-8 flex items-center justify-center font-bold text-sm bg-slate-100 dark:bg-zinc-900 rounded-lg dark:text-zinc-400">
                  {gceu.rank}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-black dark:text-white text-sm leading-none">{gceu.name}</h4>
                  <p className="text-[9px] text-slate-600 dark:text-zinc-600 uppercase font-bold mt-1">{gceu.memberCount} MEMBROS</p>
                </div>
                <div className="text-right">
                  <div className="text-black dark:text-white font-bold text-sm">{gceu.avgPoints}</div>
                  <div className="text-[9px] text-slate-600 dark:text-zinc-600 font-bold uppercase tracking-tighter">MÉDIA PTS</div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4">
            <div className="flex items-end justify-between mb-4 px-1">
              <div>
                <h3 className="text-xl font-serif font-bold text-black dark:text-white">Top Leitores</h3>
                <p className="text-xs text-slate-600 dark:text-zinc-600 uppercase font-bold tracking-widest mt-1">Destaques • Empates Sucessivos</p>
              </div>
              {!showFullRanking && (
                <button 
                  onClick={() => setShowFullRanking(true)}
                  className="text-black dark:text-white text-xs font-bold uppercase underline underline-offset-4"
                >
                  Ver Tudo
                </button>
              )}
            </div>
            
            <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-slate-200 dark:border-zinc-900 shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-200 dark:divide-zinc-900">
                {visibleRanking.map((member) => {
                  const isCurrent = member.name === currentUser.name;
                  const displayAvatar = isCurrent ? currentUser.avatar : member.avatar;
                  
                  return (
                    <div key={member.name} className={`flex items-center gap-3 p-4 ${isCurrent ? 'bg-slate-50 dark:bg-zinc-900/30' : ''}`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                        (member as any).rank <= 3 ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-slate-200 dark:bg-zinc-900 text-slate-600 dark:text-zinc-600'
                      }`}>
                        {(member as any).rank}
                      </div>

                      <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-900 overflow-hidden flex items-center justify-center shrink-0 border border-slate-300 dark:border-zinc-800">
                        {displayAvatar ? (
                          <img src={displayAvatar} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-200 dark:bg-zinc-900">
                            <span className="text-slate-500 dark:text-zinc-700 font-serif text-[10px]">W</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-black dark:text-white text-sm leading-tight truncate">{member.name}</div>
                        <div className="text-[9px] text-slate-600 dark:text-zinc-600 font-bold uppercase truncate">{member.gceu}</div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-[11px] font-bold text-black dark:text-white flex items-center justify-end gap-1">
                            {member.points}
                          </div>
                          <div className="text-[8px] text-slate-600 dark:text-zinc-600 font-bold uppercase">PONTOS</div>
                        </div>
                        <div className="w-8 text-right">
                          <div className="text-[11px] font-bold text-black dark:text-zinc-300">{member.progress}%</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="h-full flex flex-col animate-in slide-in-from-right-10 duration-500 min-h-[60vh]">
          <div className="mb-4">
            <h2 className="text-xl font-serif font-bold text-black dark:text-white">Assistente Bíblico</h2>
            <p className="text-xs text-slate-700 dark:text-zinc-500">Mergulhe nas escrituras com IA.</p>
          </div>
          <div className="flex-1 bg-slate-50 dark:bg-zinc-900/50 rounded-3xl p-4 space-y-4 min-h-[300px] overflow-y-auto mb-4 border border-slate-200 dark:border-zinc-900">
            {chatHistory.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <LogoComponent className="w-20 h-20 mb-6" />
                <p className="text-slate-600 dark:text-zinc-600 text-xs font-bold uppercase tracking-wider">Como posso ajudar na sua jornada hoje?</p>
              </div>
            )}
            {chatHistory.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed border transition-all ${msg.role === 'user' ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white rounded-br-none' : 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-300 border-slate-300 dark:border-zinc-800 rounded-bl-none'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isAnswering && <div className="text-slate-600 dark:text-zinc-600 text-[9px] font-bold uppercase animate-pulse ml-2">Analisando as escrituras...</div>}
          </div>
          <div className="flex gap-2">
            <input 
              type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleAsk()} 
              placeholder="Pergunte sobre a leitura..." 
              className="flex-1 bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-2xl px-5 py-4 text-sm focus:ring-1 focus:ring-black dark:focus:ring-white outline-none shadow-sm transition-all placeholder:text-slate-500 dark:placeholder:text-zinc-700 dark:text-white" 
            />
            <button 
              onClick={handleAsk} disabled={isAnswering} 
              className="bg-black dark:bg-white text-white dark:text-black p-4 rounded-2xl hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors shadow-lg active:scale-95 disabled:opacity-30"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </div>
          
          <div className="mt-4 text-center">
            <a 
              href="https://instagram.com/ontheway_imwg" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[10px] font-bold text-slate-700 dark:text-zinc-600 uppercase tracking-widest hover:text-black dark:hover:text-white transition-colors"
            >
              Caminhe conosco no Instagram @ontheway_imwg
            </a>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
