export type Source = 'habr' | 'reddit';

export interface Candidate {
  source: Source;
  title: string;
  link: string;
  rating: number;
  description?: string;
}
