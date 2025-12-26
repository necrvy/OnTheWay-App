
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { TabType, ReadingDay, Devotional, User, GCEURanking, MemberRanking } from './types';
import { generatePlan2026, MOCK_GCEU_RANKING, MOCK_MEMBER_RANKING } from './constants';
import { getDailyDevotional } from './services/geminiService';
import Layout from './components/Layout';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('daily');
  const [plan, setPlan] = useState<ReadingDay[]>([]);
  const [devotional, setDevotional] = useState<Devotional | null>(null);
  const [loadingDevo, setLoadingDevo] = useState(false);
  const [showFullRanking, setShowFullRanking] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('otw_theme') === 'dark';
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('otw_notifications') === 'true';
  });
  
  // Profile Form State
  const [editName, setEditName] = useState('');
  const [editGceu, setEditGceu] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      setEditName(user.name);
      setEditGceu(user.gceu);
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
      if (!editName || !authEmail || !authPassword || !editGceu) return;
      const newUser: User = { 
        id: Date.now().toString(), 
        name: editName, 
        email: authEmail, 
        gceu: editGceu,
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
      name: editName, 
      gceu: editGceu, 
      avatar: profileAvatar || undefined 
    };
    setCurrentUser(updatedUser);
    localStorage.setItem('otw_user', JSON.stringify(updatedUser));
    setIsEditingProfile(false);
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
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                </div>
                <input 
                  type="text" required placeholder="Nome Completo" value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-black dark:focus:ring-white outline-none dark:text-white placeholder:text-slate-500"
                />
                <input 
                  type="text" required placeholder="Seu GCEU" value={editGceu} onChange={e => setEditGceu(e.target.value)}
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
      user={currentUser}
      isDarkMode={isDarkMode}
    >
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

      {activeTab === 'profile' && (
        <div className="space-y-8 animate-in slide-in-from-right-10 duration-500 max-w-md mx-auto">
          {!isEditingProfile ? (
            <>
              <div className="flex flex-col items-center">
                <div className="w-32 h-32 rounded-full bg-slate-100 dark:bg-zinc-900 border-4 border-white dark:border-zinc-800 shadow-2xl overflow-hidden relative mb-4">
                  {profileAvatar ? (
                    <img src={profileAvatar} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-slate-400 dark:text-zinc-600 font-serif text-5xl">W</span>
                    </div>
                  )}
                </div>
                <h2 className="text-2xl font-serif font-bold text-black dark:text-white">{currentUser.name}</h2>
                <p className="text-sm font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-widest">{currentUser.gceu}</p>
                
                <button 
                  onClick={() => setIsEditingProfile(true)}
                  className="mt-6 flex items-center gap-2 px-6 py-2 bg-black dark:bg-white text-white dark:text-black rounded-full font-bold text-xs uppercase tracking-widest hover:scale-105 transition-transform active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  Editar Perfil
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-zinc-950 p-4 rounded-3xl border border-slate-100 dark:border-zinc-900 shadow-sm flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-black dark:text-white">{currentPoints}</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Meus Pontos</span>
                </div>
                <div className="bg-white dark:bg-zinc-950 p-4 rounded-3xl border border-slate-100 dark:border-zinc-900 shadow-sm flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-black dark:text-white">{progress}%</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Progresso</span>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-950 rounded-3xl p-6 border border-slate-100 dark:border-zinc-900 shadow-sm space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 dark:bg-zinc-900 rounded-xl text-black dark:text-white group-hover:scale-110 transition-transform">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-black dark:text-white block">E-mail</span>
                        <span className="text-[10px] text-slate-500">{currentUser.email}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-zinc-900 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 dark:bg-zinc-900 rounded-xl text-black dark:text-white">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-black dark:text-white block">Modo Escuro</span>
                        <span className="text-[10px] text-slate-500">Tema do aplicativo</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsDarkMode(!isDarkMode)}
                      className={`w-10 h-6 rounded-full transition-colors relative ${isDarkMode ? 'bg-black dark:bg-white' : 'bg-slate-200 dark:bg-zinc-800'}`}
                    >
                      <div className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-all ${isDarkMode ? 'translate-x-4 bg-white dark:bg-black' : 'bg-white'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 dark:bg-zinc-900 rounded-xl text-black dark:text-white">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-black dark:text-white block">Lembretes Diários</span>
                        <span className="text-[10px] text-slate-500">Notificações push</span>
                      </div>
                    </div>
                    <button 
                      onClick={toggleNotifications}
                      className={`w-10 h-6 rounded-full transition-colors relative ${notificationsEnabled ? 'bg-black dark:bg-white' : 'bg-slate-200 dark:bg-zinc-800'}`}
                    >
                      <div className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-all ${notificationsEnabled ? 'translate-x-4 bg-white dark:bg-black' : 'bg-white'}`} />
                    </button>
                  </div>

                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 py-4 text-rose-500 font-bold text-sm border border-rose-50 dark:border-rose-900/10 rounded-2xl hover:bg-rose-50 dark:hover:bg-rose-900/5 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    Sair da Conta
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center justify-between mb-4">
                <button 
                  onClick={() => setIsEditingProfile(false)}
                  className="p-2 text-slate-500 hover:text-black dark:hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                </button>
                <h2 className="text-xl font-serif font-bold text-black dark:text-white">Editar Perfil</h2>
                <div className="w-10" /> {/* Spacer */}
              </div>

              <div className="flex flex-col items-center gap-4">
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-24 h-24 rounded-full bg-slate-100 dark:bg-zinc-900 border-2 border-dashed border-slate-300 dark:border-zinc-800 flex items-center justify-center overflow-hidden relative group"
                >
                  {profileAvatar ? (
                    <img src={profileAvatar} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center">
                      <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    </div>
                  )}
                </button>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Toque para mudar a foto</span>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-4 bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-slate-100 dark:border-zinc-900 shadow-sm">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-500 uppercase ml-1 block mb-1">Nome</label>
                    <input 
                      type="text" value={editName} onChange={e => setEditName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm focus:ring-1 focus:ring-black dark:focus:ring-white outline-none dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-500 uppercase ml-1 block mb-1">GCEU</label>
                    <input 
                      type="text" value={editGceu} onChange={e => setEditGceu(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm focus:ring-1 focus:ring-black dark:focus:ring-white outline-none dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsEditingProfile(false)}
                    className="flex-1 px-4 py-4 rounded-2xl font-bold text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-black dark:bg-white text-white dark:text-black font-bold py-4 rounded-2xl hover:opacity-90 transition-opacity shadow-lg"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          )}
          
          <div className="text-center pt-4">
            <a 
              href="https://instagram.com/ontheway_imwg" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-zinc-700 uppercase tracking-widest hover:text-black dark:hover:text-white transition-colors"
            >
              @ontheway_imwg
            </a>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
