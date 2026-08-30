import Parser from 'rss-parser';
import type { Candidate } from './types.ts';

const parser = new Parser();

// MARKETING_HUBS — реально по теме канала (маркетинг/реклама), берём все
// статьи без keyword-фильтра, как cossa/vc/rbc. AI_HUBS — общий AI/ML-хаб,
// тематически шире канала, поэтому дополнительно фильтруем по ключевым
// словам, чтобы не тащить чистую разработку/матан. Раньше был только
// AI_HUBS — из-за этого 29-30.08 collect дал 0 новостей два дня подряд:
// весь пул кандидатов был про LLM/RAG/файн-тюнинг, ничего про маркетинг,
// LLM-оценка релевантности справедливо резала всё по порогу.
const MARKETING_HUBS = ['internetmarketing'];
const AI_HUBS = ['artificial_intelligence', 'machine_learning'];

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

  const fetchHub = async (slug: string, requireAiKeyword: boolean) => {
    const url = `https://habr.com/ru/rss/hub/${slug}/all/?fl=ru`;
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items) {
        if (!item.link || seen.has(item.link)) continue;
        seen.add(item.link);

        if (requireAiKeyword) {
          const text = `${item.title ?? ''} ${item.contentSnippet ?? ''}`.toLowerCase();
          if (!AI_KEYWORDS.some((kw) => text.includes(kw))) continue;
        }

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
  };

  for (const slug of MARKETING_HUBS) await fetchHub(slug, false);
  for (const slug of AI_HUBS) await fetchHub(slug, true);
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

// vc.ru — общий firehose (нет отдельной RSS-ленты по тегам), поэтому те же
// ключевые слова, что у Cossa, отсеивают нерелевантное до LLM-оценки.
export async function fetchVC(): Promise<Candidate[]> {
  try {
    const feed = await parser.parseURL('https://vc.ru/rss');
    return feed.items
      .filter((item) => {
        if (!item.link) return false;
        const text = `${item.title ?? ''} ${item.contentSnippet ?? ''}`.toLowerCase();
        return COSSA_KEYWORDS.some((kw) => text.includes(kw));
      })
      .slice(0, 20)
      .map((item) => ({
        source: 'vc' as const,
        title: item.title ?? '(без заголовка)',
        link: item.link!,
        rating: 0,
        description: item.contentSnippet?.slice(0, 500) ?? item.content?.slice(0, 500) ?? '',
      }));
  } catch (e) {
    console.error('vc.ru fetch failed:', e);
    return [];
  }
}

// РБК-фид — это общая политика/экономика/происшествия, а не бизнес/маркетинг
// (в отличие от vc.ru, где firehose уже про стартапы и диджитал). Общие слова
// из COSSA_KEYWORDS ("продаж", "телеграм", "реклам") там ловят случайные
// совпадения в неродственных новостях — нужен более узкий, однозначный список.
const RBC_KEYWORDS = [
  'нейросет', 'искусственный интеллект', 'chatgpt', 'gpt', 'ии-агент', 'ллм', 'llm',
  'яндекс директ', 'vk реклама', 'вк реклама', 'telegram ads', 'google ads', 'meta ads',
  'таргетированн', 'таргетолог', 'перформанс-маркетинг', 'лидогенерац',
  'сквозная аналитик', 'коллтрекинг', 'рекламный кабинет', 'цифровой маркетинг',
  'digital-маркетинг', 'crm-систем',
];

// РБК — нет отдельной RSS-ленты по разделу "Технологии", есть только общий
// поток главных новостей — фильтруем узким списком RBC_KEYWORDS до LLM-оценки.
export async function fetchRBC(): Promise<Candidate[]> {
  try {
    const feed = await parser.parseURL('https://rssexport.rbc.ru/rbcnews/news/30/full.rss');
    return feed.items
      .filter((item) => {
        if (!item.link) return false;
        const text = `${item.title ?? ''} ${item.contentSnippet ?? ''}`.toLowerCase();
        return RBC_KEYWORDS.some((kw) => text.includes(kw));
      })
      .slice(0, 20)
      .map((item) => ({
        source: 'rbc' as const,
        title: item.title ?? '(без заголовка)',
        link: item.link!,
        rating: 0,
        description: item.contentSnippet?.slice(0, 500) ?? item.content?.slice(0, 500) ?? '',
      }));
  } catch (e) {
    console.error('rbc fetch failed:', e);
    return [];
  }
}

export async function fetchAll(): Promise<Candidate[]> {
  const [habr, cossa, vc, rbc] = await Promise.all([
    fetchHabr(),
    fetchCossa(),
    fetchVC(),
    fetchRBC(),
  ]);
  return [...habr, ...cossa, ...vc, ...rbc];
}
