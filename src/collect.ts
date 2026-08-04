import { fetchAll } from './sources.ts';
import { ensureHeader, getAllRows, appendPending } from './sheets.ts';
import { callLLM } from './llm.ts';
import { summaryPrompt } from './prompts.ts';

async function main(): Promise<void> {
  await ensureHeader();

  const existing = await getAllRows();
  const seenLinks = new Set(existing.map((r) => r.link));

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

  for (const c of fresh) {
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
      rating: c.rating,
    });
  }

  await appendPending(rows);
  console.log(`appended ${rows.length} pending rows`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
