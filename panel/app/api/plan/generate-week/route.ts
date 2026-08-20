import { NextResponse } from 'next/server';
import { appendPlanRow, getCaseRows, getFeatureRows, getPlanRows } from '@/lib/sheets';

// Фиксированные дни недели под посты: Пн, Ср, Пт, Вс — равномерно, всегда одни и те же.
const WEEK_OFFSETS = [0, 2, 4, 6];

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

// Раскладывает до 2 "особых" типов (кейс/фича) по слотам так, чтобы они не
// стояли соседними слотами друг с другом или с одинаковыми новостями рядом.
// Остальные слоты — новости.
function placeTypes(special: string[]): string[] {
  const slots = ['новость', 'новость', 'новость', 'новость'];
  const positions = special.length === 1 ? [1] : [0, 2];
  special.forEach((t, i) => { slots[positions[i]] = t; });
  return slots;
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

  const special: string[] = [];
  if (availableCases.length > 0) special.push('кейс');
  if (availableFeatures.length > 0) special.push('фича');
  const typeSlots = placeTypes(special);

  // Не повторять тип в воскресенье прошлой недели и понедельник этой —
  // единственная граница между неделями, которую видим на момент генерации.
  const prevSunday = new Date(weekMonday); prevSunday.setDate(weekMonday.getDate() - 1);
  const prevSundayType = planRows.find((r) => r.date === toDMY(prevSunday))?.type;
  if (prevSundayType === typeSlots[0] && typeSlots[1] !== typeSlots[0]) {
    [typeSlots[0], typeSlots[1]] = [typeSlots[1], typeSlots[0]];
  }

  const byDate = new Map(planRows.map((r) => [r.date, r.type]));
  const added: Array<{ date: string; type: string }> = [];
  let caseUsed = false;
  let featureUsed = false;

  for (let i = 0; i < WEEK_OFFSETS.length; i++) {
    const d = new Date(weekMonday);
    d.setDate(weekMonday.getDate() + WEEK_OFFSETS[i]);
    const dateStr = toDMY(d);
    if (byDate.has(dateStr)) continue; // день уже занят — не перетираем

    const type = typeSlots[i];
    let token = '';
    let title = '';
    let data = '{}';
    if (type === 'кейс' && !caseUsed) {
      token = availableCases[0].token;
      caseUsed = true;
    } else if (type === 'фича' && !featureUsed) {
      const f = availableFeatures[0];
      title = f.title;
      data = JSON.stringify({ problem: f.problem, description: f.description });
      featureUsed = true;
    }

    await appendPlanRow({ date: dateStr, type, title, token, data });
    added.push({ date: dateStr, type });
  }

  return NextResponse.json({
    ok: true,
    weekStart: toDMY(weekMonday),
    added,
    note: special.length === 0
      ? 'Свободных кейсов и фич нет — неделя вся из новостей. Добавь кейс/фичу в соответствующих разделах и сгенерируй план заново.'
      : undefined,
  });
}
