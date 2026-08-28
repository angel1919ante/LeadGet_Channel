import { NextResponse } from 'next/server';
import { appendPlanRow, deletePlanRow, getCaseRows, getFeatureRows, getNewsRows, getPlanRows, setPlanRow } from '@/lib/sheets';

export async function GET() {
  const [rows, cases, features, news] = await Promise.all([
    getPlanRows(),
    getCaseRows().catch(() => []),
    getFeatureRows().catch(() => []),
    getNewsRows().catch(() => []),
  ]);

  rows.sort((a, b) => {
    const [ad, am, ay] = a.date.split('.').map(Number);
    const [bd, bm, by] = b.date.split('.').map(Number);
    return new Date(ay, am - 1, ad).getTime() - new Date(by, bm - 1, bd).getTime();
  });

  const approvedNewsCount = news.filter((n) => n.status === 'approved').length;

  const enriched = rows.map((r) => {
    if (r.type === 'кейс' && r.token) {
      const c = cases.find((x) => x.token === r.token);
      if (c) return { ...r, detail: { client: c.client, niche: c.niche, sent: c.sent, leads: c.leads, conversion: c.conversion } };
    }
    if (r.type === 'фича' && r.title) {
      const f = features.find((x) => x.title.trim().toLowerCase() === r.title.trim().toLowerCase());
      if (f) return { ...r, detail: { problem: f.problem, description: f.description } };
    }
    if (r.type === 'новость' && !r.title) {
      return { ...r, detail: { approvedCount: approvedNewsCount } };
    }
    return r;
  });

  // Для формы "добавить в план": кейсы, ещё не одобренные под публикацию,
  // и фичи, которые ещё не в плане и не опубликованы.
  const plannedFeatureTitles = new Set(rows.filter((r) => r.type === 'фича').map((r) => r.title.trim().toLowerCase()));
  const plannedCaseTokens = new Set(rows.filter((r) => r.type === 'кейс').map((r) => r.token));
  const availableCases = cases
    .filter((c) => c.status === 'pending' && !plannedCaseTokens.has(c.token))
    .map((c) => ({ token: c.token, niche: c.niche }));
  const availableFeatures = features
    .filter((f) => f.status !== 'posted' && !plannedFeatureTitles.has(f.title.trim().toLowerCase()))
    .map((f) => ({ title: f.title, problem: f.problem, description: f.description }));

  return NextResponse.json({ rows: enriched, availableCases, availableFeatures });
}

export async function POST(req: Request) {
  const body = await req.json();

  if (body.create) {
    await appendPlanRow({
      date: body.date,
      type: body.type,
      title: body.title ?? '',
      token: body.token ?? '',
      data: body.data ?? '{}',
    });
    return NextResponse.json({ ok: true });
  }

  const { rowNumber, status, title, withPhoto, caseData, remove, swapWith, date, type, token, post } = body;

  if (remove) {
    await deletePlanRow(rowNumber);
    return NextResponse.json({ ok: true });
  }

  // Перестановка местами: меняем датами две строки плана — порядок в панели
  // определяется датой, так что обмен дат = обмен позициями.
  if (swapWith) {
    const rows = await getPlanRows();
    const a = rows.find((r) => r.rowNumber === rowNumber);
    const b = rows.find((r) => r.rowNumber === swapWith);
    if (!a || !b) return NextResponse.json({ error: 'строка не найдена' }, { status: 404 });
    await setPlanRow(a.rowNumber, { date: b.date });
    await setPlanRow(b.rowNumber, { date: a.date });
    return NextResponse.json({ ok: true });
  }

  if (withPhoto !== undefined || caseData) {
    // Мержим в существующий JSON строки, чтобы не потерять остальные поля.
    const rows = await getPlanRows();
    const row = rows.find((r) => r.rowNumber === rowNumber);
    let data: Record<string, unknown> = {};
    try { data = row?.data ? JSON.parse(row.data) : {}; } catch { /* оставляем пустым, если не JSON */ }
    if (withPhoto !== undefined) data.withPhoto = withPhoto;
    if (caseData) Object.assign(data, caseData);
    await setPlanRow(rowNumber, { data: JSON.stringify(data) });
    return NextResponse.json({ ok: true });
  }

  await setPlanRow(rowNumber, { status, title, date, type, token, post });
  return NextResponse.json({ ok: true });
}
