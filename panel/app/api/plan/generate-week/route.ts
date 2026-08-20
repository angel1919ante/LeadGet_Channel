import { NextResponse } from 'next/server';
import { appendPlanRow, getCaseRows, getFeatureRows, getPlanRows } from '@/lib/sheets';

// Фиксированные дни недели под посты: Пн, Ср, Пт, Вс — равномерно, всегда одни и те же.
const WEEK_OFFSETS = [0, 2, 4, 6];

function toDMY(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function mondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const r = new Date(d);
  r.setDate(d.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

export async function POST() {
  const [planRows, cases, features] = await Promise.all([
    getPlanRows(),
    getCaseRows().catch(() => []),
    getFeatureRows().catch(() => []),
  ]);

  const byDate = new Map(planRows.map((r) => [r.date, r.type]));

  // Первая неделя (начиная с текущей), где есть хоть один свободный
  // фиксированный слот — так недозаполненная текущая неделя достраивается
  // раньше, чем генератор перепрыгнет на следующую.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let weekMonday = mondayOf(today);
  let fixedDates: Array<{ dateStr: string; existingType: string | null }>;
  for (;;) {
    fixedDates = WEEK_OFFSETS.map((offset) => {
      const d = new Date(weekMonday);
      d.setDate(weekMonday.getDate() + offset);
      const dateStr = toDMY(d);
      return { dateStr, existingType: byDate.get(dateStr) ?? null };
    });
    if (fixedDates.some((f) => !f.existingType)) break;
    weekMonday = new Date(weekMonday);
    weekMonday.setDate(weekMonday.getDate() + 7);
  }

  const plannedFeatureTitles = new Set(planRows.filter((r) => r.type === 'фича').map((r) => r.title.trim().toLowerCase()));
  const plannedCaseTokens = new Set(planRows.filter((r) => r.type === 'кейс').map((r) => r.token));
  const availableCases = cases.filter((c) => c.status === 'pending' && !plannedCaseTokens.has(c.token));
  const availableFeatures = features.filter((f) => f.status !== 'posted' && !plannedFeatureTitles.has(f.title.trim().toLowerCase()));

  const emptyCount = fixedDates.filter((f) => !f.existingType).length;
  const pool: string[] = [];
  if (availableCases.length > 0) pool.push('кейс');
  if (availableFeatures.length > 0) pool.push('фича');
  while (pool.length < emptyCount) pool.push('новость');

  const prevSunday = new Date(weekMonday);
  prevSunday.setDate(weekMonday.getDate() - 1);
  let prevType = byDate.get(toDMY(prevSunday)) ?? null;

  const added: Array<{ date: string; type: string }> = [];
  let caseUsed = false;
  let featureUsed = false;

  for (const f of fixedDates) {
    if (f.existingType) {
      prevType = f.existingType;
      continue;
    }
    // Берём из пула первый тип, не совпадающий с типом соседнего слева дня —
    // если такого нет (пул исчерпан одинаковыми типами), берём как есть.
    let idx = pool.findIndex((t) => t !== prevType);
    if (idx === -1) idx = 0;
    const type = pool.splice(idx, 1)[0];

    let token = '';
    let title = '';
    let data = '{}';
    if (type === 'кейс' && !caseUsed) {
      token = availableCases[0].token;
      caseUsed = true;
    } else if (type === 'фича' && !featureUsed) {
      const feat = availableFeatures[0];
      title = feat.title;
      data = JSON.stringify({ problem: feat.problem, description: feat.description });
      featureUsed = true;
    }

    await appendPlanRow({ date: f.dateStr, type, title, token, data });
    added.push({ date: f.dateStr, type });
    prevType = type;
  }

  return NextResponse.json({
    ok: true,
    weekStart: toDMY(weekMonday),
    added,
    note: availableCases.length === 0 && availableFeatures.length === 0
      ? 'Свободных кейсов и фич нет — пустые слоты заполнены новостями. Добавь кейс/фичу в соответствующих разделах и сгенерируй план заново.'
      : undefined,
  });
}
