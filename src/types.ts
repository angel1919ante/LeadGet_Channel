export type Source = 'habr' | 'cossa' | 'vc' | 'rbc';

export interface Candidate {
  source: Source;
  title: string;
  link: string;
  rating: number;
  description?: string;
}
