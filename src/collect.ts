import { fetchAll } from './sources.ts';
import { ensureHeader, getAllRows, appendPending } from './sheets.ts';
import { callLLM } from './llm.ts';
import { summaryPrompt, relevancePrompt } from './prompts.ts';

async function main(): Promise<void> {
  await ensureHeader();

  const existing = await getAllRows();
  const seenLinks = new Set(existing.map((r) => r.link));
  const postedExamples = existing
    .filter((r) => r.status === 'posted')
    .map((r) => ({ title: r.title, source: r.source }))
    .slice(-30); // последние 30 опубликованных

  const candidates = await fetchAll();
  const fresh = candidates.filter((c) => !seenLinks.has(c.link));
  console.log(`fetched=${candidates.length} fresh=${fresh.length}`);

  const rows: Array<{
    source: string;
    title: string;
    summary: string;
    link: string;
    rating: number;
  }> = [];

  const MIN_RELEVANCE = 7;

  for (const c of fresh) {
    // LLM-фильтр: пропускаем нерелевантные новости до генерации саммари
    let relevance = 0;
    try {
      const raw = await callLLM(relevancePrompt(c, postedExamples));
      relevance = parseInt(raw.trim(), 10) || 0;
    } catch (e) {
      console.error(`relevance failed for ${c.link}:`, e);
    }
    if (relevance < MIN_RELEVANCE) {
      console.log(`skip (relevance=${relevance}): ${c.title.slice(0, 60)}`);
      continue;
    }

    let summary = '';
    try {
      summary = await callLLM(summaryPrompt(c));
    } catch (e) {
      console.error(`summary failed for ${c.link}:`, e);
      summary = '(саммари не сгенерировано)';
    }
    rows.push({
      source: c.source,
      title: c.title,
      summary,
      link: c.link,
      rating: relevance * 10, // нормируем в рейтинг 0–100
    });
  }

  await appendPending(rows);
  console.log(`appended ${rows.length} pending rows`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
