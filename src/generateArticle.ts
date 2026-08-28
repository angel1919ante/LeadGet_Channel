// Генерация статьи через LLM — по существующей новости (NEWS_ROW) или по
// свободной теме (TOPIC). Триггерится из панели (кнопка "Сгенерировать"
// на /articles или "→ Статья" на карточке новости) через workflow_dispatch.
import { getAllRows, appendArticles } from './sheets.ts';
import { callLLM } from './llm.ts';
import { articlePrompt, articlePromptFromTopic } from './articlePrompts.ts';
import { loadToneSamples } from './toneSamples.ts';
import { disconnectMTProto } from './mtproto.ts';
import type { Platform } from './articleTypes.ts';
import type { Candidate, Source } from './types.ts';

async function main(): Promise<void> {
  const platform = process.env.PLATFORM as Platform | undefined;
  if (!platform) throw new Error('PLATFORM env var missing');

  const newsRowNum = process.env.NEWS_ROW ? Number(process.env.NEWS_ROW) : undefined;
  const topic = process.env.TOPIC?.trim();

  const tone = await loadToneSamples().catch(() => ({ ours: [], learn: [] }));

  let prompt;
  let sourceUrl = '';
  let sourceTitle = '';

  if (newsRowNum) {
    const news = await getAllRows();
    const row = news.find((r) => r.rowNumber === newsRowNum);
    if (!row) throw new Error(`News row ${newsRowNum} не найдена`);
    // Нельзя публиковать статью по мотивам новости с площадки X обратно на X
    // (например, новость с Хабра -> статья на Хабр) — выглядит как копия/дубль
    // на той же площадке, откуда взят материал.
    if (row.source === platform) {
      throw new Error(`Нельзя сделать статью для "${platform}" из новости с этой же площадки (источник: ${row.source}) — выбери другую площадку`);
    }
    const candidate: Candidate = { source: row.source as Source, title: row.title, link: row.link, rating: row.rating, description: row.summary };
    prompt = articlePrompt(candidate, platform, tone);
    sourceUrl = row.link;
    sourceTitle = row.title;
  } else if (topic) {
    prompt = articlePromptFromTopic(topic, platform, tone);
    sourceTitle = topic;
  } else {
    throw new Error('нужен либо NEWS_ROW, либо TOPIC');
  }

  const content = await callLLM(prompt);
  await appendArticles([{ id: `${Date.now()}-${platform}`, platform, sourceUrl, sourceTitle, content }]);
  console.log(`generated article: platform=${platform} title="${sourceTitle.slice(0, 50)}"`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnectMTProto());
