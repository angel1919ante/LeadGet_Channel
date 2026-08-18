import { getAllRows } from './sheets.ts';
import { callLLM } from './llm.ts';
import { postPrompt } from './prompts.ts';
import { formatPost } from './formatter.ts';
import { loadToneSamples } from './toneSamples.ts';
import type { Candidate, Source } from './types.ts';

async function main() {
  const rows = await getAllRows();
  const match = rows.find((r) =>
    /рекоменд|конкурент|нейросет|ChatGPT|GEO|AI.?поиск/i.test(`${r.title} ${r.summary}`),
  );

  const c: Candidate = match
    ? { source: match.source as Source, title: match.title, link: match.link, rating: match.rating, description: match.summary }
    : {
        source: 'habr' as Source,
        link: 'https://example.com/test',
        title: 'AI-поисковики и чат-боты чаще рекомендуют крупные бренды, малый бизнес почти не попадает в ответы',
        rating: 8,
        description:
          'Исследование показало: когда пользователи спрашивают ChatGPT, Perplexity и AI-поиск Яндекса "что купить" или "кого выбрать", ' +
          'ответы почти всегда называют крупных известных игроков рынка. Малый и средний бизнес без активного SEO/упоминаний в интернете ' +
          'практически не попадает в рекомендации нейросетей, даже если предлагает аналогичный или лучший продукт. Причина — ИИ строит ответ ' +
          'на основе того, что чаще всего упоминается в интернете (отзывы, статьи, форумы), а не на реальном качестве. Это создаёт новый барьер ' +
          'для роста: клиенты всё чаще выбирают через диалог с ИИ, а не через поисковую выдачу или рекламу.',
      };

  console.log(`используем: ${match ? 'найденную новость из таблицы' : 'тестовый кейс (в таблице подходящей не нашлось)'}`);
  console.log(`title=${c.title}\nlink=${c.link}\n`);

  const tone = await loadToneSamples().catch(() => ({ ours: [], learn: [] }));
  const rawPost = await callLLM(postPrompt(c, tone));
  const withSource = `${rawPost}\n\nИсточник: ${c.link}`;
  const formatted = await formatPost(withSource);

  console.log('----- RAW -----');
  console.log(rawPost);
  console.log('----- FORMATTED (HTML) -----');
  console.log(formatted);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
