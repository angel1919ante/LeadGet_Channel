import Parser from 'rss-parser';
import type { Candidate } from './types.ts';
import { fetchTelegramChannel, disconnectMTProto } from './mtproto.ts';

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
        // Нужен именно AI НА СТЫКЕ с маркетингом/рекламой/продажами —
        // просто AI/ML-статья без бизнес-контекста не подходит.
        const text = `${item.title ?? ''} ${item.contentSnippet ?? ''}`.toLowerCase();
        const AI_KEYWORDS = [
          'ии', 'искусственный интеллект', 'нейросет', 'chatgpt', 'gpt',
          'llm', 'машинное обучение', 'machine learning', 'ai-агент', 'ai агент',
        ];
        const MARKETING_KEYWORDS = [
          'маркет', 'реклам', 'продаж', 'лид', 'telegram', 'телеграм',
          'конверс', 'трафик', 'smm', 'таргет', 'воронк', 'клиент',
        ];
        const hasAI = AI_KEYWORDS.some((kw) => text.includes(kw));
        const hasMarketing = MARKETING_KEYWORDS.some((kw) => text.includes(kw));
        if (!hasAI || !hasMarketing) continue;
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

// Ключевые слова для фильтрации Cossa — хотя бы одно должно совпасть
const COSSA_KEYWORDS = [
  'яндекс', 'директ', 'vk реклам', 'вк реклам', 'telegram ads', 'телеграм ads',
  'google ads', 'meta ads', 'таргет', 'лидоген', 'лид', 'конверс',
  'коллтрекинг', 'crm', 'roi', 'roas', 'сквозная аналитик',
  'рекламный кабинет', 'реклам', 'перформанс', 'performance',
  'ии', 'искусственный интеллект', 'нейросет', 'автоматизац',
  'telegram', 'телеграм', 'мессенджер', 'chatbot', 'чат-бот',
  'воронк', 'продаж', 'cpa', 'cpc', 'cpm',
];

// Cossa.ru — главный российский сайт про digital-маркетинг и рекламу
export async function fetchCossa(): Promise<Candidate[]> {
  try {
    const feed = await parser.parseURL('https://www.cossa.ru/rss/');
    return feed.items
      .filter((item) => {
        if (!item.link) return false;
        const text = `${item.title ?? ''} ${item.contentSnippet ?? ''}`.toLowerCase();
        return COSSA_KEYWORDS.some((kw) => text.includes(kw));
      })
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

// Reddit r/marketing — JSON API даёт score постов, RSS не даёт
export async function fetchReddit(): Promise<Candidate[]> {
  try {
    const res = await fetch(
      'https://www.reddit.com/r/marketing/top.json?t=day&limit=50',
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadGetBot/1.0)' } },
    );
    if (!res.ok) return [];
    const json = await res.json() as { data: { children: Array<{ data: { score: number; title: string; url: string; selftext: string; permalink: string } }> } };
    return json.data.children
      .filter((c) => c.data.score >= 50)
      .slice(0, 15)
      .map((c) => ({
        source: 'reddit' as const,
        title: c.data.title,
        link: `https://www.reddit.com${c.data.permalink}`,
        rating: c.data.score,
        description: c.data.selftext.slice(0, 500),
      }));
  } catch (e) {
    console.error('reddit fetch failed:', e);
    return [];
  }
}

// Telegram-каналы: username без @ или invite-хэш для приватных
const TG_CHANNELS: Array<{ id: string; source: string }> = [
  { id: 'molyanov_blog', source: 'tg:molyanov_blog' },
  { id: 'Leadget_channel', source: 'tg:leadget_channel' },
  { id: '+RTqYchZh5C81OTJi', source: 'tg:private_channel' },
];

export async function fetchTelegramChannels(): Promise<Candidate[]> {
  // Пропускаем если MTProto-переменные не заданы (например в тестах)
  if (!process.env.TELEGRAM_SESSION) return [];

  const out: Candidate[] = [];
  for (const ch of TG_CHANNELS) {
    try {
      const messages = await fetchTelegramChannel(ch.id, 30);
      for (const msg of messages) {
        const link = `https://t.me/${ch.id.startsWith('+') ? 'c/' + ch.id.slice(1) : ch.id}/${msg.id}`;
        const firstLine = msg.text.split('\n')[0].slice(0, 120);
        out.push({
          source: ch.source,
          title: firstLine,
          link,
          rating: 0,
          description: msg.text.slice(0, 600),
        });
      }
    } catch (e) {
      console.error(`tg channel ${ch.id} fetch failed:`, e);
    }
  }
  await disconnectMTProto();
  return out;
}

export async function fetchAll(): Promise<Candidate[]> {
  const [habr, cossa, reddit, tg] = await Promise.all([
    fetchHabr(),
    fetchCossa(),
    fetchReddit(),
    fetchTelegramChannels(),
  ]);
  return [...habr, ...cossa, ...reddit, ...tg];
}
