import { NextResponse } from 'next/server';
import { appendPlanRow, getCaseRows, getFeatureRows, getPlanRows } from '@/lib/sheets';

const POSTS_PER_WEEK = 3;

function parseDMY(date: string): Date | null {
  const [d, m, y] = date.split('.').map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

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

// Первый день недели без коллизии по типу с соседними днями (в пределах
// уже существующего плана + того, что уже выбрано в этом же прогоне).
// Если идеального дня в неделе нет — берём первый вообще свободный.
function pickDateInWeek(type: string, planRows: Array<{ date: string; type: string }>, weekMonday: Date): string | null {
  const byDate = new Map(planRows.map((r) => [r.date, r.type]));
  const candidate = (offset: number) => {
    const d = new Date(weekMonday);
    d.setDate(weekMonday.getDate() + offset);
    return d;
  };
  for (let i = 0; i < 7; i++) {
    const d = candidate(i);
    const dateStr = toDMY(d);
    if (byDate.has(dateStr)) continue;
    const prev = new Date(d); prev.setDate(d.getDate() - 1);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    if (byDate.get(toDMY(prev)) === type || byDate.get(toDMY(next)) === type) continue;
    return dateStr;
  }
  for (let i = 0; i < 7; i++) {
    const dateStr = toDMY(candidate(i));
    if (!byDate.has(dateStr)) return dateStr;
  }
  return null; // неделя уже полностью занята
}

export async function POST() {
  const [planRows, cases, features] = await Promise.all([
    getPlanRows(),
    getCaseRows().catch(() => []),
    getFeatureRows().catch(() => []),
  ]);

  const latest = planRows.reduce<Date | null>((max, r) => {
    const d = parseDMY(r.date);
    if (!d) return max;
    return !max || d > max ? d : max;
  }, null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const reference = latest && latest > today ? latest : today;
  const weekMonday = new Date(mondayOf(reference));
  weekMonday.setDate(weekMonday.getDate() + 7);

  const plannedFeatureTitles = new Set(planRows.filter((r) => r.type === 'фича').map((r) => r.title.trim().toLowerCase()));
  const plannedCaseTokens = new Set(planRows.filter((r) => r.type === 'кейс').map((r) => r.token));
  const availableCases = cases.filter((c) => c.status === 'pending' && !plannedCaseTokens.has(c.token));
  const availableFeatures = features.filter((f) => f.status !== 'posted' && !plannedFeatureTitles.has(f.title.trim().toLowerCase()));

  // Миксуем: сначала реальные кейс/фича (если есть — по одному), остальное новостями.
  const slots: Array<{ type: 'кейс' | 'фича' | 'новость'; token?: string; title?: string; data: string }> = [];
  if (availableCases.length > 0) {
    slots.push({ type: 'кейс', token: availableCases[0].token, data: '{}' });
  }
  if (availableFeatures.length > 0) {
    const f = availableFeatures[0];
    slots.push({ type: 'фича', title: f.title, data: JSON.stringify({ problem: f.problem, description: f.description }) });
  }
  while (slots.length < POSTS_PER_WEEK) {
    slots.push({ type: 'новость', data: '{}' });
  }

  const simulated = [...planRows.map((r) => ({ date: r.date, type: r.type }))];
  const added: Array<{ date: string; type: string }> = [];

  for (const slot of slots) {
    const date = pickDateInWeek(slot.type, simulated, weekMonday);
    if (!date) continue; // неделя переполнена — пропускаем слот
    await appendPlanRow({ date, type: slot.type, title: slot.title ?? '', token: slot.token ?? '', data: slot.data });
    simulated.push({ date, type: slot.type });
    added.push({ date, type: slot.type });
  }

  return NextResponse.json({
    ok: true,
    weekStart: toDMY(weekMonday),
    added,
    note: availableCases.length === 0 && availableFeatures.length === 0
      ? 'Свободных кейсов и фич нет — неделя вся из новостей. Добавь кейс/фичу в соответствующих разделах и сгенерируй план заново.'
      : undefined,
  });
}
