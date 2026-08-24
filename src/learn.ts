import { getAllRows, ensurePreferencesSheet, writePreferences, readPreferences } from './sheets.ts';
import type { PreferenceRow } from './sheets.ts';

// Рейтинг хранится как 0–100 (relevance*10), возвращаем к шкале 1–10
function toScore(rating: number): number {
  return rating > 10 ? rating / 10 : rating;
}

// ВАЖНО: глобальный порог релевантности мы больше НЕ подбираем автоматически
// по approved/rejected. Отказ (rejected) далеко не всегда означает "низкая
// релевантность" — часто новость просто "не подошла" (не тот формат, дата,
// дубль темы), хотя релевантность у неё нормальная. Автоподбор трактовал
// каждый reject как сигнал "требовать выше" и на реальных данных утянул
// порог до 2 (почти отключил фильтр) — потому что часть решённых строк
// вообще без скоринга (rating=0, старые/бэкфиленные), что математически
// "хорошо разделяется" при любом пороге ≥2, но не отражает реальность.
// Порог теперь только ручной (Preferences!I2), учимся — только per-source trust.

async function main(): Promise<void> {
  await ensurePreferencesSheet();

  const rows = await getAllRows();
  const decided = rows.filter((r) => ['approved', 'posted', 'rejected'].includes(r.status));

  if (decided.length === 0) {
    console.log('learn: нет решённых строк, пропускаем');
    return;
  }

  // Порог берём как есть из Preferences (ручная настройка) — не пересчитываем.
  const { globalThreshold: threshold } = await readPreferences().catch(() => ({ globalThreshold: 7 }));
  console.log(`learn: решено=${decided.length}, порог сохранён=${threshold}`);

  // Статистика по источникам: сразу раскладываем оценки по positive/negative
  const bySource = new Map<string, { positive: number[]; negative: number[] }>();

  for (const r of decided) {
    const key = r.source || 'unknown';
    if (!bySource.has(key)) bySource.set(key, { positive: [], negative: [] });
    const entry = bySource.get(key)!;
    const score = toScore(r.rating);
    const isPositive = r.status === 'approved' || r.status === 'posted';
    (isPositive ? entry.positive : entry.negative).push(score);
  }

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const prefRows: PreferenceRow[] = [];

  for (const [source, s] of bySource) {
    const total = s.positive.length + s.negative.length;
    const approvalRate = s.positive.length / total;

    // Доверие: минимум 5 наблюдений для уверенного вывода
    let trust = 'normal';
    if (total >= 5) {
      if (approvalRate >= 0.7) trust = 'high';
      else if (approvalRate <= 0.3) trust = 'low';
    }

    prefRows.push({
      source,
      total,
      approved: s.positive.length,
      rejected: s.negative.length,
      avgRatingApproved: avg(s.positive),
      avgRatingRejected: avg(s.negative),
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
