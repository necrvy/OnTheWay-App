
import { User, ReadingDay, MemberRanking, GCEURanking } from "../types";
import { generatePlan2026 } from "../constants";

const USERS_KEY = 'otw_db_users';
const READINGS_KEY = 'otw_db_readings';

// Helper para persistência
const save = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));
const load = (key: string) => JSON.parse(localStorage.getItem(key) || 'null');

/**
 * Este serviço simula um banco de dados real.
 * Em produção, substituiríamos as chamadas de LocalStorage por chamadas fetch/axios
 * para uma API REST ou SDK do Firebase/Supabase.
 */
export const db = {
  // --- Autenticação ---
  register: (userData: Omit<User, 'id' | 'points' | 'progress'>): User => {
    const users: User[] = load(USERS_KEY) || [];
    if (users.find(u => u.email === userData.email)) {
      throw new Error("Este e-mail já está sendo usado.");
    }

    const newUser: User = {
      ...userData,
      id: Math.random().toString(36).substr(2, 9),
      points: 0,
      progress: 0
    };

    users.push(newUser);
    save(USERS_KEY, users);

    const allReadings = load(READINGS_KEY) || {};
    allReadings[newUser.id] = generatePlan2026();
    save(READINGS_KEY, allReadings);

    return newUser;
  },

  login: (email: string, password?: string): User => {
    const users: User[] = load(USERS_KEY) || [];
    const user = users.find(u => u.email === email && (!password || u.password === password));
    if (!user) {
      throw new Error("Dados de acesso incorretos.");
    }
    return user;
  },

  updateUser: (userId: string, updates: Partial<User>): User => {
    const users: User[] = load(USERS_KEY) || [];
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) throw new Error("Membro não encontrado.");
    
    users[idx] = { ...users[idx], ...updates };
    save(USERS_KEY, users);
    return users[idx];
  },

  // --- Leituras ---
  getPlan: (userId: string): ReadingDay[] => {
    const allReadings = load(READINGS_KEY) || {};
    return allReadings[userId] || generatePlan2026();
  },

  updateReading: (userId: string, date: string, isCompleted: boolean): ReadingDay[] => {
    const allReadings = load(READINGS_KEY) || {};
    const userPlan: ReadingDay[] = allReadings[userId] || generatePlan2026();
    
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const updatedPlan = userPlan.map(day => {
      if (day.date === date) {
        return {
          ...day,
          isCompleted,
          completedAt: isCompleted ? today : undefined
        };
      }
      return day;
    });

    allReadings[userId] = updatedPlan;
    save(READINGS_KEY, allReadings);

    const points = updatedPlan.reduce((acc, d) => {
      if (!d.isCompleted) return acc;
      // Bonus por leitura no dia correto
      return acc + (d.completedAt === d.date ? 2 : 1);
    }, 0);
    
    const progress = Math.round((updatedPlan.filter(d => d.isCompleted).length / updatedPlan.length) * 100);
    db.updateUser(userId, { points, progress });

    return updatedPlan;
  },

  // --- Rankings ---
  getMemberRanking: (): MemberRanking[] => {
    const users: User[] = load(USERS_KEY) || [];
    const sorted = users
      .map(u => ({
        name: u.name,
        gceu: u.gceu,
        points: u.points,
        progress: u.progress,
        avatar: u.avatar
      }))
      .sort((a, b) => b.points - a.points);

    let rank = 0;
    let lastPoints = -1;
    return sorted.map(m => {
      if (m.points !== lastPoints) {
        rank++;
        lastPoints = m.points;
      }
      return { ...m, rank };
    });
  },

  getGCEURanking: (): GCEURanking[] => {
    const users: User[] = load(USERS_KEY) || [];
    const gceus: Record<string, { totalPoints: number; count: number }> = {};

    users.forEach(u => {
      if (!gceus[u.gceu]) gceus[u.gceu] = { totalPoints: 0, count: 0 };
      gceus[u.gceu].totalPoints += u.points;
      gceus[u.gceu].count += 1;
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
  }
};
