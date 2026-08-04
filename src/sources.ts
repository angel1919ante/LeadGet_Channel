import Parser from 'rss-parser';
import type { Candidate } from './types.ts';

const HABR_HUBS = [
  'artificial_intelligence',
  'machine_learning',
];

const HABR_MIN_RATING = 50;
const REDDIT_MIN_UPS = 500;

const parser = new Parser();

// Habr RSS не содержит рейтинг, приходится дёргать страницу статьи и парсить.
// ponytail: regex по HTML, не тащим cheerio ради одного значения.
async function getHabrRating(url: string): Promise<number> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadGetBot/1.0)' },
    });
    if (!res.ok) return 0;
    const html = await res.text();
    const m = html.match(/tm-votes-meter__value[^>]*>\s*([+-]?\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  } catch {
    return 0;
  }
}

export async function fetchHabr(): Promise<Candidate[]> {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const hub of HABR_HUBS) {
    const url = `https://habr.com/ru/rss/hub/${hub}/all/?fl=ru`;
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items) {
        if (!item.link || seen.has(item.link)) continue;
        seen.add(item.link);
        const rating = await getHabrRating(item.link);
        if (rating < HABR_MIN_RATING) continue;
        out.push({
          source: 'habr',
          title: item.title ?? '(без заголовка)',
          link: item.link,
          rating,
          description: item.contentSnippet ?? item.content ?? '',
        });
      }
    } catch (e) {
      console.error(`habr hub ${hub} fetch failed:`, e);
    }
  }
  return out;
}

interface RedditFeedItem {
  title?: string;
  link?: string;
  content?: string;
  contentSnippet?: string;
}

export async function fetchReddit(): Promise<Candidate[]> {
  const url = 'https://www.reddit.com/r/MachineLearning/top.rss?t=day&limit=50';
  try {
    const feed = await parser.parseURL(url);
    // RSS не содержит upvotes — берём все топ-посты за день без порога рейтинга,
    // понижаем порог до 0 и оставляем модерацию на усмотрение редактора.
    return (feed.items as RedditFeedItem[])
      .filter((item) => !!item.link)
      .slice(0, 20)
      .map((item) => ({
        source: 'reddit' as const,
        title: item.title ?? '(без заголовка)',
        link: item.link!,
        rating: 0,
        description: item.contentSnippet?.slice(0, 500) ?? item.content?.slice(0, 500) ?? '',
      }));
  } catch (e) {
    console.error('reddit fetch failed:', e);
    return [];
  }
}

export async function fetchAll(): Promise<Candidate[]> {
  const [h, r] = await Promise.all([fetchHabr(), fetchReddit()]);
  return [...h, ...r];
}
