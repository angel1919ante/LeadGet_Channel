import { NextResponse } from 'next/server';
import { getCaseRows, getFeatureRows, getNewsRows, getPlanRows, setPlanRow } from '@/lib/sheets';

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

  return NextResponse.json(enriched);
}

export async function POST(req: Request) {
  const { rowNumber, status, title } = await req.json();
  await setPlanRow(rowNumber, { status, title });
  return NextResponse.json({ ok: true });
}
