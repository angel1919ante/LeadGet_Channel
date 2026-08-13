import { fetchAll } from './sources.ts';
import {
  ensureHeader, getAllRows, appendPending, readPreferences,
  ensureContentPlanSheet, getContentPlanRows, appendContentPlanRow,
} from './sheets.ts';
import { callLLM } from './llm.ts';
import { summaryPrompt, relevancePrompt } from './prompts.ts';

// Формат даты в ContentPlan: DD.MM.YYYY
function todayDMY(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

async function main(): Promise<void> {
  await Promise.all([ensureHeader(), ensureContentPlanSheet()]);

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
    status: string;
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
    // Доверенный источник + релевантность выше базового порога — публикуем без ручного апрува
    const autoApprove = trust === 'high' && relevance >= baseThreshold;
    if (autoApprove) console.log(`auto-approve (relevance=${relevance}, trust=high): ${c.title.slice(0, 60)}`);
    rows.push({
      source: c.source,
      title: c.title,
      summary,
      link: c.link,
      rating: relevance * 10, // нормируем в рейтинг 0–100
      status: autoApprove ? 'approved' : 'pending',
    });
  }

  await appendPending(rows);
  console.log(`appended ${rows.length} rows (${rows.filter((r) => r.status === 'approved').length} auto-approved)`);

  // Если на сегодня в ContentPlan ещё ничего не запланировано и есть approved-кандидат —
  // ставим "новость" на сегодня, чтобы autopost было что публиковать без ручного планирования.
  const today = todayDMY();
  const plans = await getContentPlanRows();
  const hasPlanToday = plans.some((p) => p.date === today);
  const hasApprovedNews = existing.some((r) => r.status === 'approved') || rows.some((r) => r.status === 'approved');
  if (!hasPlanToday && hasApprovedNews) {
    await appendContentPlanRow({ date: today, type: 'новость', title: '', token: '', data: '{}' });
    console.log(`ContentPlan: добавлена строка "новость" на ${today}`);
  } else if (!hasPlanToday) {
    console.log(`ContentPlan: на ${today} нет approved-новостей, строку не добавляю`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
