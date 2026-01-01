
import { createClient } from '@supabase/supabase-js';
import { User, ReadingDay, MemberRanking, GCEURanking, Devotional } from "../types";
import { generatePlan2026 } from "../constants";

const SUPABASE_URL = 'https://bsnjnnfcvkkifsbvffla.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_pmtaGepspbIpBpEczcTYlA__69YzE-c';

const isConfigured = () => {
  const isUrlValid = SUPABASE_URL.startsWith('http') && !SUPABASE_URL.includes('SUA_URL');
  const isKeyValid = SUPABASE_ANON_KEY.length > 10 && !SUPABASE_ANON_KEY.includes('SUA_CHAVE');
  return isUrlValid && isKeyValid;
};

const supabase = isConfigured() ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export const db = {
  isConfigured,
  
  checkConfig: () => {
    if (!supabase) throw new Error("Configuração incompleta no arquivo services/db.ts");
  },

  getGlobalDevotional: async (date: string): Promise<Devotional | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('devotionals')
      .select('*')
      .eq('date', date)
      .maybeSingle();
    
    if (error || !data) return null;
    return {
      title: data.title,
      summary: data.summary,
      reflection: data.reflection,
      prayer: data.prayer,
      keyVerse: data.key_verse
    };
  },

  saveGlobalDevotional: async (date: string, devotional: Devotional): Promise<void> => {
    if (!supabase) return;
    await supabase.from('devotionals').upsert({
      date,
      title: devotional.title,
      summary: devotional.summary,
      reflection: devotional.reflection,
      prayer: devotional.prayer,
      key_verse: devotional.keyVerse
    }, { onConflict: 'date' });
  },

  register: async (userData: Omit<User, 'id' | 'points' | 'progress'>): Promise<User> => {
    db.checkConfig();
    const normalizedGceu = userData.gceu.trim().toUpperCase();

    const { data, error } = await supabase!
      .from('profiles')
      .insert([{
        name: userData.name,
        email: userData.email,
        password: userData.password,
        gceu: normalizedGceu,
        avatar: userData.avatar,
        points: 0,
        progress: 0
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new Error("Este e-mail já está cadastrado.");
      throw new Error(error.message);
    }
    return data as User;
  },

  login: async (email: string, password?: string): Promise<User> => {
    db.checkConfig();
    let query = supabase!.from('profiles').select('*').eq('email', email);
    if (password) query = query.eq('password', password);

    const { data, error } = await query.maybeSingle();
    if (error || !data) throw new Error("Usuário não encontrado ou senha incorreta.");
    return data as User;
  },

  updateProfile: async (userId: string, updates: Partial<User>): Promise<User> => {
    db.checkConfig();
    if (updates.gceu) updates.gceu = updates.gceu.trim().toUpperCase();

    const { data, error } = await supabase!
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as User;
  },

  getPlan: async (userId: string): Promise<ReadingDay[]> => {
    const basePlan = generatePlan2026();
    if (!supabase) return basePlan;
    
    try {
      const { data: cloudReadings, error } = await supabase
        .from('readings')
        .select('date, is_completed, completed_at')
        .eq('user_id', userId);

      if (error) return basePlan;

      return basePlan.map(day => {
        const mark = cloudReadings?.find(r => r.date === day.date);
        return {
          ...day,
          isCompleted: mark ? mark.is_completed : false,
          completedAt: mark ? mark.completed_at : undefined,
        };
      });
    } catch (e) {
      return basePlan;
    }
  },

  updateReading: async (userId: string, date: string, isCompleted: boolean): Promise<{plan: ReadingDay[], user: User}> => {
    db.checkConfig();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const { error: readError } = await supabase!
      .from('readings')
      .upsert({
        user_id: userId,
        date: date,
        is_completed: isCompleted,
        completed_at: isCompleted ? today : null
      }, { onConflict: 'user_id, date' });

    if (readError) throw new Error("Erro ao salvar leitura.");

    const fullPlan = await db.getPlan(userId);
    const points = fullPlan.reduce((acc, d) => {
      if (d.isCompleted) {
        return acc + (d.completedAt === d.date ? 2 : 1);
      }
      return acc;
    }, 0);
    
    const progress = Math.round((fullPlan.filter(d => d.isCompleted).length / fullPlan.length) * 100);
    const updatedUser = await db.updateProfile(userId, { points, progress });

    return { plan: fullPlan, user: updatedUser };
  },

  getMemberRanking: async (): Promise<MemberRanking[]> => {
    if (!supabase) return [];
    try {
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, name, gceu, points, progress, avatar')
        .order('points', { ascending: false });

      if (pError || !profiles) return [];

      let currentRank = 0;
      let lastPoints = -1;
      return profiles.map(m => {
        if (m.points !== lastPoints) {
          currentRank++;
          lastPoints = m.points;
        }
        return { 
          name: m.name,
          gceu: m.gceu,
          points: m.points,
          progress: m.progress,
          avatar: m.avatar,
          rank: currentRank,
        } as MemberRanking;
      });
    } catch (e) {
      return [];
    }
  },

  getGCEURanking: async (): Promise<GCEURanking[]> => {
    if (!supabase) return [];
    try {
      const { data: users, error } = await supabase
        .from('profiles')
        .select('gceu, points');

      if (error) return [];

      const gceus: Record<string, { totalPoints: number; count: number }> = {};
      users.forEach(u => {
        if (!u.gceu) return;
        const normalized = u.gceu.trim().toUpperCase();
        if (!gceus[normalized]) gceus[normalized] = { totalPoints: 0, count: 0 };
        gceus[normalized].totalPoints += u.points;
        gceus[normalized].count += 1;
      });

      return Object.entries(gceus)
        .map(([name, data]) => ({
          name,
          avgPoints: data.count > 0 ? Math.round(data.totalPoints / data.count) : 0,
          memberCount: data.count,
          rank: 0
        }))
        .sort((a, b) => b.avgPoints - a.avgPoints)
        .map((g, i) => ({ ...g, rank: i + 1 }));
    } catch (e) {
      return [];
    }
  }
};
