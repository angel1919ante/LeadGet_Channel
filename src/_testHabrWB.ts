// Одноразовый тест: Хабр-статья по Wildberries-новости (row 103, источник
// тоже habr) — обходит анти-самоперепост guard в generateArticle.ts, это
// тестовый прогон, не публикация.
import { getAllRows, appendArticles } from './sheets.ts';
import { callLLM } from './llm.ts';
import { articlePrompt } from './articlePrompts.ts';
import { loadToneSamples } from './toneSamples.ts';
import { fetchArticleText } from './sources.ts';
import { disconnectMTProto } from './mtproto.ts';
import type { Candidate, Source } from './types.ts';

async function main(): Promise<void> {
  const rowNumber = 103;
  const news = await getAllRows();
  const row = news.find((r) => r.rowNumber === rowNumber);
  if (!row) throw new Error(`News row ${rowNumber} не найдена`);

  const tone = await loadToneSamples().catch(() => ({ ours: [], learn: [] }));
  const fullText = await fetchArticleText(row.link);
  console.log(fullText ? `fetched full source text (${fullText.length} chars)` : 'full source fetch failed, falling back to short summary');

  const candidate: Candidate = { source: row.source as Source, title: row.title, link: row.link, rating: row.rating, description: fullText ?? row.summary };
  const content = await callLLM(articlePrompt(candidate, 'habr', tone));
  await appendArticles([{ id: `${Date.now()}-habr-wb-test`, platform: 'habr', sourceUrl: row.link, sourceTitle: row.title, content }]);
  console.log(`generated TEST habr article (WB), ${content.length} chars`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnectMTProto());
