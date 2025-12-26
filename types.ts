
export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // Apenas para validação local
  gceu: string;
  avatar?: string;
  points: number;
  progress: number;
}

export interface ReadingDay {
  date: string;
  title: string;
  chapters: string[];
  isCompleted: boolean;
  completedAt?: string;
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
  avatar?: string;
  rank?: number;
}

export type TabType = 'daily' | 'plan' | 'ranking' | 'profile';

export interface Devotional {
  title: string;
  summary: string;
  reflection: string;
  prayer: string;
  keyVerse: string;
}
