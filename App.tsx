
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { TabType, ReadingDay, Devotional, User, MemberRanking, GCEURanking } from './types';
import { db } from './services/db';
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
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('otw_theme') === 'dark');
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem('otw_notifications') === 'true');
  
  // Auth/Profile Form State
  const [formName, setFormName] = useState('');
  const [formGceu, setFormGceu] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formAvatar, setFormAvatar] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewingMonth, setViewingMonth] = useState(new Date().getMonth());

  // Countdown State
  const [timeLeft, setTimeLeft] = useState<{days:number, hours:number, mins:number, secs:number}>({days:0, hours:0, mins:0, secs:0});
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const target = new Date('2026-01-01T00:00:00').getTime();
      const now = new Date().getTime();
      const diff = target - now;

      if (diff <= 0) {
        setHasStarted(true);
        clearInterval(timer);
      } else {
        setTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          mins: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          secs: Math.floor((diff % (1000 * 60)) / 1000),
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('otw_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    const session = localStorage.getItem('otw_session');
    if (session) {
      try {
        const user = db.login(session); 
        setCurrentUser(user);
        setPlan(db.getPlan(user.id));
      } catch {
        localStorage.removeItem('otw_session');
      }
    }
  }, []);

  const [memberRanking, setMemberRanking] = useState<MemberRanking[]>([]);
  const [gceuRanking, setGceuRanking] = useState<GCEURanking[]>([]);

  useEffect(() => {
    if (activeTab === 'ranking') {
      setMemberRanking(db.getMemberRanking());
      setGceuRanking(db.getGCEURanking());
    }
  }, [activeTab, currentUser]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoggingIn(true);
    
    // Simulação de acesso à nuvem (em produção isso chamaria um banco real via IP)
    await new Promise(r => setTimeout(r, 1500));

    try {
      let user: User;
      if (isRegistering) {
        user = db.register({ name: formName, email: formEmail, password: formPassword, gceu: formGceu, avatar: formAvatar || undefined });
      } else {
        user = db.login(formEmail, formPassword);
      }
      setCurrentUser(user);
      setPlan(db.getPlan(user.id));
      localStorage.setItem('otw_session', user.email);
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const updated = db.updateUser(currentUser.id, { name: formName, gceu: formGceu, avatar: formAvatar || undefined });
    setCurrentUser(updated);
    setIsEditingProfile(false);
  };

  const handleLogout = () => {
    if (window.confirm("Deseja sair da conta?")) {
      setCurrentUser(null);
      localStorage.removeItem('otw_session');
      setActiveTab('daily');
    }
  };

  const todayDateStr = useMemo(() => {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `2026-${m}-${d}`;
  }, []);

  const todayReading = useMemo(() => plan.find(d => d.date === todayDateStr) || plan[0], [plan, todayDateStr]);

  useEffect(() => {
    if (currentUser && todayReading && !devotional && hasStarted) {
      const fetchDevo = async () => {
        setLoadingDevo(true);
        try {
          const data = await getDailyDevotional(todayReading.title);
          setDevotional(data);
        } catch (error) { console.error(error); } 
        finally { setLoadingDevo(false); }
      };
      fetchDevo();
    }
  }, [todayReading, currentUser, hasStarted]);

  const toggleComplete = (date: string) => {
    if (!currentUser) return;
    const isNowCompleted = !plan.find(d => d.date === date)?.isCompleted;
    const updatedPlan = db.updateReading(currentUser.id, date, isNowCompleted);
    setPlan(updatedPlan);
    const updatedUser = db.login(currentUser.email, currentUser.password);
    setCurrentUser(updatedUser);
  };

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-black flex items-center justify-center p-6 transition-colors">
        <div className="w-full max-w-sm space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="text-center space-y-4">
            <div className="w-24 h-24 bg-black rounded-full mx-auto flex items-center justify-center shadow-2xl border border-white/10 overflow-hidden">
               <span className="text-white font-brand font-black text-4xl italic">W</span>
            </div>
            <h1 className="text-3xl font-brand font-black text-black dark:text-white uppercase italic tracking-tighter">On The Way</h1>
            <p className="text-slate-500 dark:text-zinc-500 font-bold uppercase text-[10px] tracking-[0.2em]">Plano Bíblico 2026</p>
          </div>

          <form onSubmit={handleAuth} className="bg-white dark:bg-zinc-950 p-6 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-xl space-y-4 relative overflow-hidden transition-all">
            {isLoggingIn && (
              <div className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-md z-20 flex flex-col items-center justify-center gap-4">
                <div className="w-10 h-10 border-4 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">Sincronizando...</span>
              </div>
            )}
            
            {authError && <div className="p-3 bg-rose-50 text-rose-600 text-[10px] font-bold rounded-xl text-center uppercase tracking-widest border border-rose-100">{authError}</div>}
            
            {isRegistering && (
              <>
                <input type="text" placeholder="Nome Completo" required value={formName} onChange={e => setFormName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-black dark:focus:ring-white outline-none dark:text-white" />
                <input type="text" placeholder="Seu GCEU" required value={formGceu} onChange={e => setFormGceu(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-black dark:focus:ring-white outline-none dark:text-white" />
              </>
            )}
            <input type="email" placeholder="E-mail" required value={formEmail} onChange={e => setFormEmail(e.target.value)}
              className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-black dark:focus:ring-white outline-none dark:text-white" />
            <input type="password" placeholder="Senha" required value={formPassword} onChange={e => setFormPassword(e.target.value)}
              className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-black dark:focus:ring-white outline-none dark:text-white" />
            
            <button type="submit" className="w-full bg-black dark:bg-white text-white dark:text-black font-brand font-black py-4 rounded-xl shadow-lg active:scale-95 transition-transform uppercase italic tracking-tighter">
              {isRegistering ? 'Criar Cadastro' : 'Acessar Plano'}
            </button>
          </form>

          <button onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }} className="w-full text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-black dark:hover:text-white transition-colors">
            {isRegistering ? 'Já sou membro • Login' : 'Novo por aqui? • Registrar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} user={currentUser} isDarkMode={isDarkMode} onLogout={handleLogout}>
      {activeTab === 'daily' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          {!hasStarted ? (
            <div className="space-y-6">
              <div className="bg-black rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden text-center border border-white/5">
                 <div className="relative z-10 space-y-8">
                    <span className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] block">Prepare seu Coração</span>
                    <div className="grid grid-cols-4 gap-3">
                       {[
                         {v: timeLeft.days, l: 'Dias'},
                         {v: timeLeft.hours, l: 'Hrs'},
                         {v: timeLeft.mins, l: 'Min'},
                         {v: timeLeft.secs, l: 'Seg'}
                       ].map(t => (
                         <div key={t.l} className="flex flex-col items-center">
                            <span className="text-4xl font-brand font-black tracking-tighter italic leading-none">{String(t.v).padStart(2, '0')}</span>
                            <span className="text-[7px] font-black text-zinc-600 uppercase mt-2 tracking-widest">{t.l}</span>
                         </div>
                       ))}
                    </div>
                    <div className="pt-8 border-t border-white/5">
                       <h3 className="font-brand font-black uppercase italic text-xl tracking-tighter">Lançamento em 2026</h3>
                       <p className="text-xs text-zinc-500 mt-2 font-serif leading-relaxed italic">"Lâmpada para os meus pés é tua palavra e luz, para o meu caminho." (Salmos 119:105)</p>
                    </div>
                 </div>
                 <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black opacity-90" />
                 <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-[120px]" />
              </div>
              
              <div className="bg-white dark:bg-zinc-950 p-6 rounded-[2rem] border border-slate-100 dark:border-zinc-900 shadow-sm text-center">
                 <p className="text-[10px] text-slate-400 dark:text-zinc-600 font-bold uppercase tracking-widest leading-loose">
                   Olá {currentUser.name.split(' ')[0]}! <br/>O plano ainda não começou, mas você já está garantido. Explore o cronograma e os rankings enquanto aguardamos o dia 01/01.
                 </p>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-black dark:bg-zinc-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden border border-white/5">
                <div className="relative z-10 flex flex-col h-full justify-between gap-8">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">Seu Progresso</p>
                      <h2 className="text-4xl font-brand font-black tracking-tighter italic">{currentUser.progress}%</h2>
                    </div>
                    <div className="bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
                      <span className="text-[10px] font-black uppercase tracking-widest">{currentUser.points} Pts</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-zinc-400 text-xs mb-2 italic font-bold">Caminhando na Palavra</p>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                      <div className="bg-white h-full rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(255,255,255,0.5)]" style={{ width: `${currentUser.progress}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-950 p-6 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm space-y-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-widest">Leitura do Dia</span>
                    <h3 className="text-2xl font-brand font-black text-black dark:text-white uppercase italic tracking-tighter">{todayReading?.title}</h3>
                  </div>
                  <button onClick={() => toggleComplete(todayReading.date)} className={`p-4 rounded-2xl transition-all shadow-lg active:scale-95 ${todayReading?.isCompleted ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-slate-50 dark:bg-zinc-900 text-slate-300 dark:text-zinc-800'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                  </button>
                </div>
                {devotional && (
                  <div className="space-y-5 animate-in slide-in-from-bottom-2 duration-700">
                    <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed italic border-l-2 border-black dark:border-white pl-4">"{devotional.keyVerse}"</p>
                    <p className="text-sm text-slate-800 dark:text-zinc-300 leading-relaxed font-medium">{devotional.reflection}</p>
                    <div className="bg-slate-50 dark:bg-zinc-900/40 p-5 rounded-[1.5rem] border border-slate-100 dark:border-white/5">
                      <span className="text-[9px] font-black text-black dark:text-white uppercase tracking-[0.2em] block mb-2">Momento de Oração</span>
                      <p className="text-xs text-slate-600 dark:text-zinc-500 italic leading-relaxed">"{devotional.prayer}"</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'plan' && (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-8">
          <div className="flex items-center justify-between px-2">
             <div className="flex flex-col">
                <h2 className="text-2xl font-brand font-black uppercase italic tracking-tighter dark:text-white">Cronograma</h2>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{monthNames[viewingMonth]} 2026</span>
             </div>
             <div className="flex gap-1">
                <button onClick={() => setViewingMonth(Math.max(0, viewingMonth - 1))} className="p-2 bg-slate-50 dark:bg-zinc-900 rounded-xl text-slate-400 hover:text-black dark:hover:text-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg></button>
                <button onClick={() => setViewingMonth(Math.min(11, viewingMonth + 1))} className="p-2 bg-slate-50 dark:bg-zinc-900 rounded-xl text-slate-400 hover:text-black dark:hover:text-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg></button>
             </div>
          </div>
          
          <div className="space-y-2">
            {plan.filter(d => new Date(d.date + 'T12:00:00').getMonth() === viewingMonth).map(day => (
              <div key={day.date} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${day.isCompleted ? 'bg-slate-50 dark:bg-zinc-900/30 opacity-40 grayscale' : 'bg-white dark:bg-zinc-950 shadow-sm border-slate-100 dark:border-zinc-900'}`}>
                <span className="w-6 text-center text-xs font-black text-slate-400">{day.date.split('-')[2]}</span>
                <span className="flex-1 text-sm font-bold dark:text-zinc-300 truncate uppercase tracking-tight">{day.title}</span>
                <button onClick={() => toggleComplete(day.date)} className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${day.isCompleted ? 'bg-black text-white dark:bg-white dark:text-black shadow-lg' : 'border-slate-200 dark:border-zinc-800 text-transparent hover:border-black dark:hover:border-white'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'ranking' && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500 pb-8">
          <section className="space-y-5">
            <h2 className="text-2xl font-brand font-black uppercase italic tracking-tighter px-2 dark:text-white">GCEU Leaderboard</h2>
            <div className="space-y-3">
              {gceuRanking.map(g => (
                <div key={g.name} className={`bg-white dark:bg-zinc-950 p-5 rounded-3xl border border-slate-100 dark:border-zinc-900 flex items-center gap-4 transition-all ${g.name === currentUser.gceu ? 'ring-2 ring-black dark:ring-white shadow-xl' : 'shadow-sm'}`}>
                  <div className="w-10 h-10 flex items-center justify-center bg-black dark:bg-zinc-900 rounded-2xl text-[10px] font-black text-white italic">{g.rank}º</div>
                  <div className="flex-1">
                    <h4 className="text-sm font-black dark:text-white uppercase italic tracking-tighter">{g.name}</h4>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{g.memberCount} Membros Ativos</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-brand font-black block tracking-tighter italic">{g.avgPoints}</span>
                    <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Média Pts</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-5">
            <div className="flex justify-between items-end px-2">
              <h2 className="text-2xl font-brand font-black uppercase italic tracking-tighter dark:text-white">Top Leitores</h2>
              {!showFullRanking && <button onClick={() => setShowFullRanking(true)} className="text-[9px] font-black uppercase tracking-widest underline decoration-2 underline-offset-4">Ver Lista Completa</button>}
            </div>
            <div className="bg-white dark:bg-zinc-950 rounded-[2.5rem] border border-slate-100 dark:border-zinc-900 overflow-hidden divide-y divide-slate-50 dark:divide-zinc-900 shadow-xl">
              {(showFullRanking ? memberRanking : memberRanking.slice(0, 8)).map(m => (
                <div key={m.name} className={`flex items-center gap-4 p-5 ${m.name === currentUser.name ? 'bg-slate-50 dark:bg-zinc-900/30' : ''}`}>
                  <span className="w-5 text-center text-[10px] font-black text-slate-400">{m.rank}</span>
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-900 overflow-hidden shrink-0 border border-slate-200 dark:border-zinc-800 shadow-sm">
                    {m.avatar ? <img src={m.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-brand font-black text-slate-300 dark:text-zinc-700">W</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-black truncate dark:text-white uppercase italic tracking-tighter">{m.name}</h4>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest truncate">{m.gceu}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-brand font-black block tracking-tighter italic">{m.points}</span>
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest">{m.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="space-y-8 animate-in fade-in duration-500 pb-8">
          {!isEditingProfile ? (
            <div className="space-y-8">
              <div className="flex flex-col items-center gap-5 py-8">
                <div className="w-36 h-36 rounded-[2.5rem] bg-white dark:bg-zinc-950 p-1 shadow-2xl border border-slate-100 dark:border-white/5 relative group transition-transform hover:scale-105">
                  <div className="w-full h-full rounded-[2.2rem] bg-slate-50 dark:bg-zinc-900 overflow-hidden flex items-center justify-center border border-slate-200 dark:border-white/5">
                    {currentUser.avatar ? <img src={currentUser.avatar} className="w-full h-full object-cover" /> : <span className="text-6xl font-brand font-black text-slate-200 dark:text-zinc-800 italic">W</span>}
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-black dark:bg-white text-white dark:text-black w-10 h-10 rounded-2xl flex items-center justify-center shadow-xl border-4 border-white dark:border-black">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                  </div>
                </div>
                <div className="text-center space-y-1">
                  <h2 className="text-3xl font-brand font-black dark:text-white uppercase italic tracking-tighter leading-none">{currentUser.name}</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{currentUser.gceu}</p>
                </div>
                <button onClick={() => { setIsEditingProfile(true); setFormName(currentUser.name); setFormGceu(currentUser.gceu); setFormAvatar(currentUser.avatar || null); }} 
                  className="px-8 py-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 transition-transform active:scale-95 italic">
                  Editar Cadastro
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-white dark:bg-zinc-950 p-6 rounded-[2rem] border border-slate-100 dark:border-zinc-900 shadow-sm text-center">
                    <span className="block text-3xl font-brand font-black italic tracking-tighter dark:text-white">{currentUser.points}</span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Meus Pontos</span>
                 </div>
                 <div className="bg-white dark:bg-zinc-950 p-6 rounded-[2rem] border border-slate-100 dark:border-zinc-900 shadow-sm text-center">
                    <span className="block text-3xl font-brand font-black italic tracking-tighter dark:text-white">{currentUser.progress}%</span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Concluído</span>
                 </div>
              </div>

              <div className="bg-white dark:bg-zinc-950 rounded-[2.5rem] border border-slate-100 dark:border-zinc-900 p-8 space-y-8 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3.5 bg-slate-50 dark:bg-zinc-900 rounded-2xl text-black dark:text-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg></div>
                    <div className="flex flex-col"><span className="text-[11px] font-black uppercase tracking-widest dark:text-white">Modo Escuro</span><span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Foco total na leitura</span></div>
                  </div>
                  <button onClick={() => setIsDarkMode(!isDarkMode)} className={`w-14 h-7 rounded-full transition-colors relative ${isDarkMode ? 'bg-black dark:bg-white' : 'bg-slate-200 dark:bg-zinc-800'}`}>
                    <div className={`absolute top-1 left-1 w-5 h-5 rounded-full transition-all shadow-md ${isDarkMode ? 'translate-x-7 bg-white dark:bg-black' : 'bg-white'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3.5 bg-slate-50 dark:bg-zinc-900 rounded-2xl text-black dark:text-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg></div>
                    <div className="flex flex-col"><span className="text-[11px] font-black uppercase tracking-widest dark:text-white">Notificações</span><span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Lembretes Diários</span></div>
                  </div>
                  <button onClick={() => { setNotificationsEnabled(!notificationsEnabled); localStorage.setItem('otw_notifications', (!notificationsEnabled).toString()); }} 
                    className={`w-14 h-7 rounded-full transition-colors relative ${notificationsEnabled ? 'bg-black dark:bg-white' : 'bg-slate-200 dark:bg-zinc-800'}`}>
                    <div className={`absolute top-1 left-1 w-5 h-5 rounded-full transition-all shadow-md ${notificationsEnabled ? 'translate-x-7 bg-white dark:bg-black' : 'bg-white'}`} />
                  </button>
                </div>

                <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 py-5 text-rose-500 font-black text-[10px] uppercase tracking-[0.3em] border border-rose-50 dark:border-rose-950/20 rounded-[1.5rem] hover:bg-rose-50 dark:hover:bg-rose-950/10 transition-colors italic">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  Encerrar Sessão
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
               <div className="flex items-center gap-4">
                  <button onClick={() => setIsEditingProfile(false)} className="p-3 bg-slate-50 dark:bg-zinc-900 rounded-2xl text-slate-400 hover:text-black dark:hover:text-white transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
                  <h2 className="text-2xl font-brand font-black uppercase italic tracking-tighter dark:text-white leading-none mt-1">Editar Cadastro</h2>
               </div>

               <div className="flex flex-col items-center gap-4 pb-4">
                 <button onClick={() => fileInputRef.current?.click()} className="w-32 h-32 rounded-[2.5rem] bg-slate-50 dark:bg-zinc-900 border-2 border-dashed border-slate-200 dark:border-zinc-800 flex items-center justify-center overflow-hidden transition-all hover:border-black dark:hover:border-white">
                    {formAvatar ? <img src={formAvatar} className="w-full h-full object-cover" /> : <div className="flex flex-col items-center gap-2"><svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg><span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Nova Foto</span></div>}
                 </button>
                 <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => {
                   const file = e.target.files?.[0];
                   if (file) {
                     const r = new FileReader();
                     r.onloadend = () => setFormAvatar(r.result as string);
                     r.readAsDataURL(file);
                   }
                 }} />
               </div>

               <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="bg-white dark:bg-zinc-950 p-8 rounded-[2.5rem] border border-slate-100 dark:border-zinc-900 space-y-5 shadow-sm">
                    <div className="space-y-2">
                       <label className="text-[9px] font-black uppercase tracking-widest ml-1 dark:text-zinc-500">Nome de Membro</label>
                       <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Como quer ser chamado?" className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl px-5 py-4 text-sm font-bold dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[9px] font-black uppercase tracking-widest ml-1 dark:text-zinc-500">Seu GCEU</label>
                       <input type="text" value={formGceu} onChange={e => setFormGceu(e.target.value)} placeholder="Qual o seu GCEU?" className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl px-5 py-4 text-sm font-bold dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all" />
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-black dark:bg-white text-white dark:text-black font-brand font-black py-5 rounded-[1.5rem] shadow-2xl active:scale-95 transition-all uppercase italic tracking-tighter">Salvar Alterações</button>
               </form>
            </div>
          )}
          
          <div className="text-center pt-8 border-t border-slate-100 dark:border-zinc-900">
             <p className="text-[10px] font-black text-slate-300 dark:text-zinc-800 uppercase tracking-[0.4em] mb-4 italic">On The Way • 2026</p>
             <div className="flex justify-center gap-6">
                <a href="https://instagram.com/ontheway_imwg" target="_blank" rel="noopener noreferrer" className="p-3 bg-slate-50 dark:bg-zinc-900 rounded-2xl text-slate-400 hover:text-black dark:hover:text-white transition-all"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.332 3.608 1.308.975.975 1.245 2.242 1.308 3.607.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.063 1.365-.333 2.632-1.308 3.607-.975.975-2.242 1.246-3.607 1.308-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.365-.063-2.632-.333-3.607-1.308-.975-.975-1.246-2.242-1.308-3.607-.058-1.266-.07-1.646-.07-4.85s.012-3.584.07-4.85c.062-1.366.332-2.633 1.308-3.608.975-.975 2.242-1.245 3.607-1.308 1.266-.058 1.646-.07 4.85-.07zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12s.014 3.667.072 4.947c.2 4.353 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072s3.667-.014 4.947-.072c4.351-.2 6.78-2.618 6.98-6.98.058-1.28.072-1.689.072-4.948s-.014-3.667-.072-4.947c-.2-4.353-2.619-6.78-6.98-6.98C15.667.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg></a>
             </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
