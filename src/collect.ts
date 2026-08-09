import { fetchAll } from './sources.ts';
import { ensureHeader, getAllRows, appendPending, readPreferences } from './sheets.ts';
import { callLLM } from './llm.ts';
import { summaryPrompt, relevancePrompt } from './prompts.ts';

async function main(): Promise<void> {
  await ensureHeader();

  const [existing, prefs] = await Promise.all([getAllRows(), readPreferences().catch(() => ({ globalThreshold: 7, sources: [] }))]);
  const seenLinks = new Set(existing.map((r) => r.link));
  const postedExamples = existing
    .filter((r) => r.status === 'posted')
    .map((r) => ({ title: r.title, source: r.source }))
    .slice(-30);

  // Справочник доверия по источнику
  const trustMap = new Map(prefs.sources.map((s) => [s.source, s.trust]));
  const baseThreshold = prefs.globalThreshold || 7;
  console.log(`prefs: threshold=${baseThreshold}, sources=${prefs.sources.length}`);

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
    // High-trust источники проходят по сниженному порогу, low-trust — по повышенному
    const trust = trustMap.get(c.source) ?? 'normal';
    const threshold = trust === 'high' ? Math.max(5, baseThreshold - 1.5)
                    : trust === 'low'  ? Math.min(9, baseThreshold + 1)
                    : baseThreshold;

    let relevance = 0;
    try {
      const raw = await callLLM(relevancePrompt(c, postedExamples));
      relevance = parseInt(raw.trim(), 10) || 0;
    } catch (e) {
      console.error(`relevance failed for ${c.link}:`, e);
    }
    if (relevance < threshold) {
      console.log(`skip (relevance=${relevance}, threshold=${threshold}, trust=${trust}): ${c.title.slice(0, 60)}`);
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
