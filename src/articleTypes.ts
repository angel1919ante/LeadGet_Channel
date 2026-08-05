export type Platform = 'habr' | 'vc' | 'dzen' | 'x';

export interface ArticleCandidate {
  sourceUrl: string;
  sourceTitle: string;
  sourceSummary: string;
  platform: Platform;
  content: string;
  generatedAt: string; // ISO date string
  status: 'pending' | 'approved' | 'rejected' | 'published';
}
