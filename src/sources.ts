import Parser from 'rss-parser';
import type { Candidate } from './types.ts';

const parser = new Parser();

// Хабы, которые реально существуют и релевантны теме канала
const HABR_HUBS = ['artificial_intelligence', 'machine_learning'];

// Только AI/ML-тематика — этим уже гарантирует выбор хаба, keyword-проверка
// тут просто подстраховка от случайных кросспостов. Бизнес-релевантность
// (маркетинг/лидген/продажи) решает LLM-оценка в collect.ts, а не жёсткий
// regex-фильтр здесь — иначе отсекаем всё до того, как модель успеет оценить.
// Рейтинг статьи раньше парсили regex'ом со страницы Хабра — вёрстка
// поменялась, regex молча возвращал 0 и резал 100% кандидатов. Скрейпинг
// ненадёжен, поэтому просто не фильтруем по рейтингу вообще.
export async function fetchHabr(): Promise<Candidate[]> {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  const AI_KEYWORDS = [
    'ии', 'искусственный интеллект', 'нейросет', 'chatgpt', 'gpt',
    'llm', 'машинное обучение', 'machine learning', 'ai-агент', 'ai агент',
  ];

  for (const slug of HABR_HUBS) {
    const url = `https://habr.com/ru/rss/hub/${slug}/all/?fl=ru`;
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items) {
        if (!item.link || seen.has(item.link)) continue;
        seen.add(item.link);

        const text = `${item.title ?? ''} ${item.contentSnippet ?? ''}`.toLowerCase();
        if (!AI_KEYWORDS.some((kw) => text.includes(kw))) continue;

        out.push({
          source: 'habr',
          title: item.title ?? '(без заголовка)',
          link: item.link,
          rating: 0,
          description: item.contentSnippet ?? item.content ?? '',
        });
      }
    } catch (e) {
      console.error(`habr hub ${slug} fetch failed:`, e);
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

export async function fetchAll(): Promise<Candidate[]> {
  const [habr, cossa, reddit] = await Promise.all([
    fetchHabr(),
    fetchCossa(),
    fetchReddit(),
  ]);
  return [...habr, ...cossa, ...reddit];
}
