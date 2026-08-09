import { getAllRows, ensurePreferencesSheet, writePreferences } from './sheets.ts';
import type { PreferenceRow } from './sheets.ts';

// Рейтинг хранится как 0–100 (relevance*10), возвращаем к шкале 1–10
function toScore(rating: number): number {
  return rating > 10 ? rating / 10 : rating;
}

// Находим порог (1–10), при котором лучше всего разделяются approved и rejected
function findThreshold(decided: Array<{ score: number; positive: boolean }>): number {
  let bestThreshold = 7;
  let bestAccuracy = 0;

  for (let t = 5; t <= 10; t += 0.5) {
    const correct = decided.filter(
      (d) => (d.positive && d.score >= t) || (!d.positive && d.score < t),
    ).length;
    const accuracy = correct / decided.length;
    if (accuracy > bestAccuracy) {
      bestAccuracy = accuracy;
      bestThreshold = t;
    }
  }
  return bestThreshold;
}

async function main(): Promise<void> {
  await ensurePreferencesSheet();

  const rows = await getAllRows();
  const decided = rows.filter((r) => ['approved', 'posted', 'rejected'].includes(r.status));

  if (decided.length === 0) {
    console.log('learn: нет решённых строк, пропускаем');
    return;
  }

  // Глобальный порог
  const scoredDecided = decided.map((r) => ({
    score: toScore(r.rating),
    positive: r.status === 'approved' || r.status === 'posted',
  }));
  const threshold = findThreshold(scoredDecided);
  console.log(`learn: решено=${decided.length}, порог=${threshold}`);

  // Статистика по источникам
  const bySource = new Map<string, { scores: number[]; positive: number; negative: number }>();

  for (const r of decided) {
    const key = r.source || 'unknown';
    if (!bySource.has(key)) bySource.set(key, { scores: [], positive: 0, negative: 0 });
    const entry = bySource.get(key)!;
    const score = toScore(r.rating);
    entry.scores.push(score);
    if (r.status === 'approved' || r.status === 'posted') entry.positive++;
    else entry.negative++;
  }

  const prefRows: PreferenceRow[] = [];

  for (const [source, s] of bySource) {
    const total = s.positive + s.negative;
    const approvalRate = s.positive / total;

    const positiveScores = [];
    const negativeScores = [];
    let si = 0;
    for (const r of decided) {
      if ((r.source || 'unknown') !== source) continue;
      const score = s.scores[si++];
      if (r.status === 'approved' || r.status === 'posted') positiveScores.push(score);
      else negativeScores.push(score);
    }

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    // Доверие: минимум 5 наблюдений для уверенного вывода
    let trust = 'normal';
    if (total >= 5) {
      if (approvalRate >= 0.7) trust = 'high';
      else if (approvalRate <= 0.3) trust = 'low';
    }

    prefRows.push({
      source,
      total,
      approved: s.positive,
      rejected: s.negative,
      avgRatingApproved: avg(positiveScores),
      avgRatingRejected: avg(negativeScores),
      trust,
      globalThreshold: threshold,
    });
  }

  // Сортируем: сначала high trust, потом по количеству
  prefRows.sort((a, b) => {
    const trustOrder = { high: 0, normal: 1, low: 2 };
    const to = (trustOrder[a.trust as keyof typeof trustOrder] ?? 1) -
               (trustOrder[b.trust as keyof typeof trustOrder] ?? 1);
    return to !== 0 ? to : b.total - a.total;
  });

  await writePreferences(prefRows, threshold);

  console.log(`learn: записано ${prefRows.length} источников`);
  console.log('Топ по доверию:');
  prefRows.slice(0, 5).forEach((r) =>
    console.log(`  ${r.trust.padEnd(6)} ${r.source}: ${r.approved}/${r.total} (avg approved: ${r.avgRatingApproved.toFixed(1)})`),
  );
}

main().catch((e) => { console.error(e); process.exit(1); });
