import Parser from 'rss-parser';
import type { Candidate } from './types.ts';

const parser = new Parser();

// Habr RSS не содержит рейтинг — парсим со страницы статьи.
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

// Хабр: только хабы, которые реально существуют
const HABR_HUBS = [
  { slug: 'artificial_intelligence', minRating: 30 },
  { slug: 'machine_learning', minRating: 30 },
];

export async function fetchHabr(): Promise<Candidate[]> {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const hub of HABR_HUBS) {
    const url = `https://habr.com/ru/rss/hub/${hub.slug}/all/?fl=ru`;
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items) {
        if (!item.link || seen.has(item.link)) continue;
        seen.add(item.link);
        const rating = await getHabrRating(item.link);
        if (rating < hub.minRating) continue;
        // Берём только если в тексте есть маркетинг/реклама/AI для бизнеса
        const text = `${item.title ?? ''} ${item.contentSnippet ?? ''}`.toLowerCase();
        const relevant = [
          'маркет', 'реклам', 'продаж', 'лид', 'telegram', 'телеграм',
          'chatgpt', 'gpt', 'llm', 'автоматизац', 'бизнес', 'клиент',
          'конверс', 'трафик', 'smm', 'таргет',
        ].some((kw) => text.includes(kw));
        if (!relevant) continue;
        out.push({
          source: 'habr',
          title: item.title ?? '(без заголовка)',
          link: item.link,
          rating,
          description: item.contentSnippet ?? item.content ?? '',
        });
      }
    } catch (e) {
      console.error(`habr hub ${hub.slug} fetch failed:`, e);
    }
  }
  return out;
}

// Cossa.ru — главный российский сайт про digital-маркетинг и рекламу
export async function fetchCossa(): Promise<Candidate[]> {
  try {
    const feed = await parser.parseURL('https://www.cossa.ru/rss/');
    return feed.items
      .filter((item) => !!item.link)
      .slice(0, 20)
      .map((item) => ({
        source: 'cossa' as const,
        title: item.title ?? '(без заголовка)',
        link: item.link!,
        rating: 0,
        description: item.contentSnippet?.slice(0, 500) ?? item.content?.slice(0, 500) ?? '',
      }));
  } catch (e) {
    console.error('cossa fetch failed:', e);
    return [];
  }
}

// Reddit r/marketing — международный маркетинг, тренды, инструменты
export async function fetchReddit(): Promise<Candidate[]> {
  try {
    const feed = await parser.parseURL(
      'https://www.reddit.com/r/marketing/top.rss?t=day&limit=25',
    );
    return feed.items
      .filter((item) => !!item.link)
      .slice(0, 15)
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
  const [habr, cossa, reddit] = await Promise.all([
    fetchHabr(),
    fetchCossa(),
    fetchReddit(),
  ]);
  return [...habr, ...cossa, ...reddit];
}
