
import { useState, useEffect, useMemo, useRef } from 'react';
import { TabType, ReadingDay, Devotional, User, MemberRanking, GCEURanking } from './types';
import { db } from './services/db';
import { getDailyDevotional } from './services/geminiService';
import Layout, { LogoOfficial } from './components/Layout';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('daily');
  const [plan, setPlan] = useState<ReadingDay[]>([]);
  const [devotional, setDevotional] = useState<Devotional | null>(null);
  const [loadingDevotional, setLoadingDevotional] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showFullRanking, setShowFullRanking] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberRanking | null>(null);
  const [memberRanking, setMemberRanking] = useState<MemberRanking[]>([]);
  const [gceuRanking, setGceuRanking] = useState<GCEURanking[]>([]);
  
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('otw_theme') === 'dark');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  
  const [formName, setFormName] = useState('');
  const [formGceu, setFormGceu] = useState('');
  const [formAvatar, setFormAvatar] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [viewingMonth, setViewingMonth] = useState(new Date().getMonth());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const todayDateStr = useMemo(() => {
    const now = new Date();
    return `2026-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('otw_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const refreshRankings = async () => {
    if (db.isConfigured()) {
      try {
        const [members, gceus] = await Promise.all([
          db.getMemberRanking(),
          db.getGCEURanking()
        ]);
        setMemberRanking(members);
        setGceuRanking(gceus);
      } catch (err) { console.warn("Erro ao atualizar ranking", err); }
    }
  };

  const loadData = async (email: string) => {
    setLoadingData(true);
    try {
      const user = await db.login(email);
      if (!user) throw new Error("User not found");
      const userPlan = await db.getPlan(user.id);
      setCurrentUser(user);
      setPlan(userPlan);
      refreshRankings();
    } catch (err) {
      console.error("Erro no carregamento:", err);
      localStorage.removeItem('otw_session');
      setCurrentUser(null);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    const sessionEmail = localStorage.getItem('otw_session');
    if (sessionEmail && db.isConfigured()) {
      loadData(sessionEmail);
    } else {
      setLoadingData(false);
    }
  }, []);

  const todayReading = useMemo(() => plan.find(d => d.date === todayDateStr) || plan[0], [plan, todayDateStr]);

  useEffect(() => {
    const fetchDevotional = async () => {
      if (activeTab === 'daily' && todayReading) {
        setLoadingDevotional(true);
        try {
          let data = await db.getGlobalDevotional(todayDateStr);
          if (!data) {
            data = await getDailyDevotional(todayReading.title);
            await db.saveGlobalDevotional(todayDateStr, data);
          }
          setDevotional(data);
        } catch (err) { console.error(err); }
        finally { setLoadingDevotional(false); }
      }
    };
    fetchDevotional();
  }, [activeTab, todayReading, todayDateStr]);

  const toggleComplete = async (date: string) => {
    if (!currentUser || isSyncing) return;
    setIsSyncing(true);
    try {
      const currentDay = plan.find(d => d.date === date);
      const { plan: newPlan, user: newUser } = await db.updateReading(currentUser.id, date, !currentDay?.isCompleted);
      setPlan(newPlan);
      setCurrentUser(newUser);
      await refreshRankings();
    } catch (err: any) { console.error(err); }
    finally { setIsSyncing(false); }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || isSyncing) return;
    setIsSyncing(true);
    try {
      const updated = await db.updateProfile(currentUser.id, { 
        name: formName, 
        gceu: formGceu, 
        avatar: formAvatar.trim() || undefined 
      });
      setCurrentUser(updated);
      setIsEditingProfile(false);
      await refreshRankings();
    } catch (err: any) { alert(err.message); }
    finally { setIsSyncing(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { 
        alert("Escolha uma imagem de até 1MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    try {
      if (isRegistering) {
        await db.register({ name: formName, email: formEmail, password: formPassword, gceu: formGceu });
      }
      await loadData(formEmail);
      localStorage.setItem('otw_session', formEmail);
    } catch (err: any) { 
      alert(err.message); 
    } finally {
      setIsSyncing(false);
    }
  };

  if (loadingData && !currentUser) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">Sincronizando Dados...</p>
      </div>
    );
  }

  if (!currentUser) return (
    <div className="min-h-screen bg-slate-50 dark:bg-black flex items-center justify-center p-6">
      <div className="w-full max-sm:px-4 max-w-sm space-y-8 animate-in">
        <div className="text-center space-y-4">
          <LogoOfficial className="w-40 h-40 mx-auto shadow-2xl" textClassName="text-[8rem]" />
          <h1 className="text-3xl font-brand font-black dark:text-white uppercase italic tracking-tighter">On The Way</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Plano Bíblico 2026</p>
        </div>
        <form onSubmit={handleAuth} className="bg-white dark:bg-zinc-950 p-6 rounded-[2.5rem] border border-black/5 dark:border-white/5 shadow-xl space-y-4 relative">
          {isSyncing && <div className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-md z-20 flex items-center justify-center rounded-[2.5rem]"><div className="w-8 h-8 border-4 border-black dark:border-white border-t-transparent rounded-full animate-spin" /></div>}
          {isRegistering && (
            <>
              <input type="text" placeholder="Seu Nome" required value={formName} onChange={e => setFormName(e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-sm outline-none dark:text-white" />
              <input type="text" placeholder="Seu GCEU" required value={formGceu} onChange={e => setFormGceu(e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-sm outline-none dark:text-white" />
            </>
          )}
          <input type="email" placeholder="E-mail" required value={formEmail} onChange={e => setFormEmail(e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-sm outline-none dark:text-white" />
          <input type="password" placeholder="Senha" required value={formPassword} onChange={e => setFormPassword(e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-sm outline-none dark:text-white" />
          <button type="submit" className="w-full bg-black dark:bg-white text-white dark:text-black font-brand font-black py-4 rounded-xl uppercase italic shadow-lg active:scale-95 transition-transform">{isRegistering ? 'Criar Conta' : 'Entrar'}</button>
        </form>
        <button onClick={() => setIsRegistering(!isRegistering)} className="w-full text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isRegistering ? 'Fazer Login' : 'Não tem conta? Cadastre-se'}</button>
      </div>
    </div>
  );

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} user={currentUser} isDarkMode={isDarkMode} onLogout={() => { localStorage.removeItem('otw_session'); window.location.reload(); }}>
      {activeTab === 'daily' && (
        <div className="space-y-6 animate-in">
          <div className="bg-black dark:bg-zinc-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden border border-white/5">
              <div className="relative z-10 flex justify-between items-center gap-6">
                <div className="space-y-2">
                  <span className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.2em]">{new Date().getDate()} {monthNames[new Date().getMonth()]}</span>
                  <h3 className="text-4xl font-brand font-black tracking-tighter italic leading-none">{todayReading?.title}</h3>
                </div>
                <button disabled={isSyncing} onClick={() => toggleComplete(todayReading.date)} className={`p-5 rounded-3xl shadow-2xl transition-all active:scale-90 shrink-0 ${todayReading?.isCompleted ? 'bg-white text-black' : 'bg-white/10 text-white/20 border border-white/10'}`}>
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                </button>
              </div>
          </div>

          <div className="bg-white dark:bg-zinc-950 p-8 rounded-[3rem] border border-slate-100 dark:border-white/5 shadow-sm space-y-8">
            {loadingDevotional ? (
              <div className="space-y-6 animate-pulse">
                <div className="h-8 bg-slate-100 dark:bg-zinc-900 rounded-full w-3/4" />
                <div className="h-24 bg-slate-50 dark:bg-zinc-900/50 rounded-3xl" />
              </div>
            ) : devotional && (
              <div className="space-y-6">
                <div className="space-y-2 text-center">
                  <span className="text-[9px] font-black text-yellow-500 uppercase tracking-[0.3em]">Insight do Dia</span>
                  <h4 className="text-2xl font-brand font-black text-black dark:text-white italic tracking-tighter uppercase leading-tight">{devotional.title}</h4>
                </div>
                <div className="p-5 bg-slate-50 dark:bg-zinc-900/50 rounded-3xl italic text-sm text-slate-600 dark:text-zinc-300 border border-slate-100 dark:border-zinc-900">"{devotional.keyVerse}"</div>
                
                <div className="space-y-8">
                  <div>
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-black dark:text-white mb-3">Reflexão</h5>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">{devotional.reflection}</p>
                  </div>
                  
                  <div className="pt-6 border-t border-slate-50 dark:border-zinc-900">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-black dark:text-white mb-3">Oração</h5>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 italic leading-relaxed">{devotional.prayer}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'plan' && (
        <div className="space-y-6 animate-in pb-8">
          <div className="flex items-center justify-between px-2">
             <div className="flex flex-col">
                <h2 className="text-2xl font-brand font-black uppercase italic tracking-tighter dark:text-white">Cronograma</h2>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{monthNames[viewingMonth]} 2026</span>
             </div>
             <div className="flex gap-1">
                <button onClick={() => setViewingMonth(Math.max(0, viewingMonth - 1))} className="p-2 bg-slate-50 dark:bg-zinc-900 rounded-xl transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg></button>
                <button onClick={() => setViewingMonth(Math.min(11, viewingMonth + 1))} className="p-2 bg-slate-50 dark:bg-zinc-900 rounded-xl transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg></button>
             </div>
          </div>
          <div className="space-y-2">
            {plan.filter(d => new Date(d.date + 'T12:00:00').getMonth() === viewingMonth).map(day => (
              <div key={day.date} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${day.isCompleted ? 'bg-slate-50 dark:bg-zinc-900/30 border-slate-100 dark:border-zinc-900' : 'bg-white dark:bg-zinc-950 shadow-sm border-slate-100 dark:border-zinc-900'} ${day.date === todayDateStr ? 'ring-2 ring-yellow-400/50' : ''}`}>
                <span className={`text-xs font-black w-8 ${day.isCompleted ? 'text-slate-300' : 'text-slate-400'}`}>{day.date.split('-')[2]}</span>
                <span className={`flex-1 text-sm font-bold truncate uppercase tracking-tight ${day.isCompleted ? 'text-slate-300 line-through' : 'dark:text-zinc-300'}`}>{day.title}</span>
                <button disabled={isSyncing} onClick={() => toggleComplete(day.date)} className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${day.isCompleted ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white shadow-lg' : 'border-slate-200 dark:border-zinc-800 text-transparent'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'ranking' && (
        <div className="space-y-8 animate-in pb-8">
          <section className="px-2">
             <div className="bg-slate-50 dark:bg-zinc-900/50 p-5 rounded-[2rem] border border-slate-100 dark:border-zinc-900 text-center">
                <span className="text-[10px] font-black uppercase tracking-widest block mb-1">Critérios de Pontuação</span>
                <p className="text-[9px] text-slate-500 font-medium uppercase tracking-wider">
                   Leitura no dia: 2 pts • Leitura atrasada: 1 pt
                </p>
             </div>
          </section>

          <section className="space-y-5">
            <h2 className="text-2xl font-brand font-black uppercase italic tracking-tighter px-2 dark:text-white">Top GCEUs</h2>
            <div className="space-y-3">
              {gceuRanking.map((g) => (
                <div key={g.name} className={`bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-slate-100 dark:border-zinc-900 flex items-center gap-4 transition-all shadow-sm ${currentUser && g.name === currentUser.gceu.toUpperCase() ? 'ring-2 ring-black dark:ring-white scale-[1.02] shadow-xl' : ''}`}>
                  <div className="w-10 h-10 flex items-center justify-center bg-black dark:bg-zinc-800 rounded-2xl text-[10px] font-black text-white italic shrink-0">{g.rank}º</div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-black dark:text-white uppercase italic tracking-tighter truncate">{g.name}</h4>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{g.memberCount} Membros</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-lg font-brand font-black block tracking-tighter italic dark:text-white leading-none">{g.avgPoints}</span>
                    <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Média Pts</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-5">
            <div className="flex justify-between items-end px-2">
              <h2 className="text-2xl font-brand font-black uppercase italic tracking-tighter dark:text-white">Top Membros</h2>
              <button onClick={() => setShowFullRanking(!showFullRanking)} className="text-[9px] font-black uppercase tracking-widest underline decoration-2 underline-offset-4">{showFullRanking ? 'Ver Menos' : 'Ver Tudo'}</button>
            </div>
            <div className="bg-white dark:bg-zinc-950 rounded-[2.5rem] border border-slate-100 dark:border-zinc-900 overflow-hidden shadow-xl">
              {(showFullRanking ? memberRanking : memberRanking.slice(0, 10)).map(m => (
                <div key={m.name} onClick={() => setSelectedMember(m)} className={`flex items-center gap-4 p-5 cursor-pointer active:bg-slate-50 dark:active:bg-zinc-900 border-b border-slate-50 dark:border-zinc-900 last:border-0 ${currentUser && m.name === currentUser.name ? 'bg-slate-50/50 dark:bg-zinc-900/20' : ''}`}>
                  <span className="w-5 text-[10px] font-black text-slate-400 shrink-0">{m.rank}</span>
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-900 overflow-hidden shrink-0 border border-slate-100 dark:border-zinc-800 shadow-sm">
                    {m.avatar ? <img src={m.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-brand font-black text-slate-300">W</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-black truncate dark:text-white uppercase italic tracking-tighter">{m.name}</h4>
                    <p className="text-[9px] text-slate-500 font-bold uppercase truncate tracking-wider">{m.gceu}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-brand font-black block italic dark:text-white leading-none">{m.points}</span>
                    <span className="text-[9px] text-slate-400 uppercase font-black">{m.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
          
          {selectedMember && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in">
              <div className="bg-white dark:bg-zinc-950 w-full max-w-sm rounded-[3rem] p-8 space-y-6 relative overflow-hidden shadow-2xl">
                <button onClick={() => setSelectedMember(null)} className="absolute top-6 right-6 p-2 bg-slate-100 dark:bg-zinc-900 rounded-full hover:scale-110 transition-transform"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <div className="flex flex-col items-center gap-3">
                  <div className="w-24 h-24 rounded-3xl bg-slate-100 dark:bg-zinc-900 overflow-hidden shadow-lg border border-slate-100 dark:border-zinc-900">
                    {selectedMember.avatar ? <img src={selectedMember.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-brand font-black text-slate-300 text-3xl">W</div>}
                  </div>
                  <div className="text-center">
                    <h4 className="text-2xl font-brand font-black dark:text-white uppercase italic tracking-tighter">{selectedMember.name}</h4>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedMember.gceu}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="bg-slate-50 dark:bg-zinc-900 p-4 rounded-2xl text-center">
                    <span className="text-2xl font-brand font-black italic dark:text-white leading-none">{selectedMember.points}</span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mt-1">Pontos</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-zinc-900 p-4 rounded-2xl text-center">
                    <span className="text-2xl font-brand font-black italic dark:text-white leading-none">{selectedMember.progress}%</span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mt-1">Progresso</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="space-y-8 animate-in pb-8">
            <div className="flex flex-col items-center gap-5 py-8">
                <div className="relative group">
                    <div className="w-36 h-36 rounded-[2.5rem] bg-white dark:bg-zinc-950 p-1 shadow-2xl border border-slate-100 dark:border-white/5 overflow-hidden flex items-center justify-center">
                        {currentUser.avatar ? <img src={currentUser.avatar} className="w-full h-full object-cover rounded-[2.2rem]" /> : <LogoOfficial className="w-full h-full italic text-7xl rounded-[2.2rem]" />}
                    </div>
                    <button onClick={() => { setFormName(currentUser.name); setFormGceu(currentUser.gceu); setFormAvatar(currentUser.avatar || ''); setIsEditingProfile(true); }} className="absolute -bottom-2 -right-2 bg-black dark:bg-white text-white dark:text-black p-3 rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-transform border border-white/10">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                </div>
                <div className="text-center space-y-1">
                  <h2 className="text-3xl font-brand font-black dark:text-white uppercase italic tracking-tighter leading-none">{currentUser.name}</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{currentUser.gceu}</p>
                </div>
            </div>

            <div className="px-2 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-white dark:bg-zinc-950 p-6 rounded-[2rem] border border-slate-100 dark:border-zinc-900 text-center shadow-sm">
                    <span className="block text-3xl font-brand font-black italic tracking-tighter dark:text-white leading-none">{currentUser.points}</span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-2 block">Pontos Totais</span>
                 </div>
                 <div className="bg-white dark:bg-zinc-950 p-6 rounded-[2rem] border border-slate-100 dark:border-zinc-900 text-center shadow-sm">
                    <span className="block text-3xl font-brand font-black italic tracking-tighter dark:text-white leading-none">{currentUser.progress}%</span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-2 block">Progresso 2026</span>
                 </div>
              </div>

              <div className="bg-white dark:bg-zinc-950 rounded-[2.5rem] border border-slate-100 dark:border-zinc-900 p-8 space-y-6 shadow-sm">
                 <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-widest dark:text-white italic">Modo Escuro</span>
                    <button onClick={() => setIsDarkMode(!isDarkMode)} className={`w-12 h-6 rounded-full transition-colors relative ${isDarkMode ? 'bg-white' : 'bg-slate-200'}`}>
                       <div className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-all ${isDarkMode ? 'translate-x-6 bg-black' : 'bg-white'}`} />
                    </button>
                 </div>
                 <button onClick={() => { localStorage.removeItem('otw_session'); window.location.reload(); }} className="w-full text-center py-4 text-rose-500 font-black text-[10px] uppercase tracking-widest border border-rose-50 dark:border-rose-950/20 rounded-2xl italic hover:bg-rose-50 transition-colors">Encerrar Sessão</button>
              </div>
            </div>
        </div>
      )}

      {/* Modal Editar Perfil */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in">
          <form onSubmit={handleUpdateProfile} className="bg-white dark:bg-zinc-950 w-full max-w-sm rounded-[3rem] p-8 space-y-6 relative border border-white/5 shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-2xl font-brand font-black uppercase italic tracking-tighter text-center">Editar Perfil</h3>
            
            <div className="flex flex-col items-center gap-4">
               <div className="relative group">
                  <div className="w-24 h-24 rounded-3xl bg-slate-50 dark:bg-zinc-900 overflow-hidden border border-slate-100 dark:border-zinc-800 shadow-inner flex items-center justify-center">
                    {formAvatar ? <img src={formAvatar} className="w-full h-full object-cover" /> : <div className="text-3xl font-brand font-black text-slate-300">W</div>}
                  </div>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute -bottom-1 -right-1 bg-black dark:bg-white text-white dark:text-black p-2 rounded-xl shadow-lg border border-white/10">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </button>
               </div>
               <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
               <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Alterar foto da galeria</span>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest px-1">Nome de Exibição</label>
                <input type="text" required value={formName} onChange={e => setFormName(e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-sm outline-none dark:text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest px-1">Seu GCEU</label>
                <input type="text" required value={formGceu} onChange={e => setFormGceu(e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-sm outline-none dark:text-white" />
              </div>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setIsEditingProfile(false)} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Cancelar</button>
              <button type="submit" disabled={isSyncing} className="flex-[2] bg-black dark:bg-white text-white dark:text-black font-brand font-black py-4 px-8 rounded-2xl uppercase italic shadow-xl disabled:opacity-50 transition-all">{isSyncing ? 'Salvando...' : 'Salvar Alterações'}</button>
            </div>
          </form>
        </div>
      )}
    </Layout>
  );
};

export default App;
