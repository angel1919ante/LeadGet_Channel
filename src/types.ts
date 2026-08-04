export type Source = 'habr' | 'reddit' | 'cossa';

export interface Candidate {
  source: Source;
  title: string;
  link: string;
  rating: number;
  description?: string;
}
