import Parser from 'rss-parser';
import type { Candidate } from './types.ts';

const parser = new Parser();

// MARKETING_HUBS — реально по теме канала (маркетинг/реклама), берём все
// статьи без keyword-фильтра, как cossa/vc/rbc.
//
// Раньше здесь были ещё и AI_HUBS (artificial_intelligence, machine_learning)
// с гейтом по AI-ключевым словам — идея была не тащить чистую разработку.
// На практике гейт почти не фильтровал: в AI/ML-хабе почти любая статья и
// так упоминает "ии"/"нейросеть", так что проходило 60-80 из ~100
// кандидатов за прогон, а по теме канала (лидогенерация/маркетинг) из них
// не подходило почти ничего — 2-4 из 10 по релевантности. AI_HUBS топили
// нормальный internetmarketing-хаб в шуме и жгли LLM-вызовы впустую.
// Убраны, MARKETING_HUBS одного хаба хватает (см. git log для истории).
const MARKETING_HUBS = ['internetmarketing'];

// Рейтинг статьи раньше парсили regex'ом со страницы Хабра — вёрстка
// поменялась, regex молча возвращал 0 и резал 100% кандидатов. Скрейпинг
// ненадёжен, поэтому просто не фильтруем по рейтингу вообще.
export async function fetchHabr(): Promise<Candidate[]> {
  const out: Candidate[] = [];

  for (const slug of MARKETING_HUBS) {
    const url = `https://habr.com/ru/rss/hub/${slug}/all/?fl=ru`;
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items) {
        if (!item.link) continue;
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

// Саммари в News (2-3 предложения для Telegram-поста) недостаточно для
// полноформатной статьи — модель придумывает конкретику, которой в саммари
// нет (реальный инцидент: 5 тестовых статей выдумали 5 разных "трёх ошибок"
// в одном и том же источнике, ни одна не совпала с настоящими). Качаем
// реальную страницу источника и достаём текст — модель не может открыть
// ссылку сама, но мы можем скачать её и вставить текст в промпт.
export async function fetchArticleText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadGetBot/1.0; +https://lead-get.ru)' },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const text = html
      .replace(/<(script|style|nav|header|footer|aside)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&laquo;/g, '«')
      .replace(/&raquo;/g, '»')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .join('\n');
    return text.length > 500 ? text : null;
  } catch {
    return null;
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
