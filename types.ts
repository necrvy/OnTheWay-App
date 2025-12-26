
export interface User {
  id: string;
  name: string;
  email: string;
  gceu: string;
  avatar?: string;
}

export interface ReadingDay {
  date: string;
  title: string;
  chapters: string[];
  isCompleted: boolean;
  completedAt?: string; // Data real em que foi marcado como concluído
  notes?: string;
}

export interface GCEURanking {
  name: string;
  avgPoints: number;
  memberCount: number;
  rank: number;
}

export interface MemberRanking {
  name: string;
  gceu: string;
  points: number;
  progress: number;
  streak: number;
  avatar?: string;
}

export type TabType = 'daily' | 'plan' | 'ranking' | 'profile';

export interface Devotional {
  title: string;
  summary: string;
  reflection: string;
  prayer: string;
  keyVerse: string;
}
