export interface HNStory {
  id: number;
  title: string;
  url?: string;
  score?: number;
  by?: string;
  time?: number;
  descendants?: number;
  type?: string;
}

export type CategoryFilter = 'all' | 'llm' | 'models' | 'companies' | 'research';

export interface CategorySpec {
  id: CategoryFilter;
  label: string;
  keywords: string[];
}
