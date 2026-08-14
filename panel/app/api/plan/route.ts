import { NextResponse } from 'next/server';
import { getPlanRows, setPlanRow } from '@/lib/sheets';

export async function GET() {
  const rows = await getPlanRows();
  rows.sort((a, b) => {
    const [ad, am, ay] = a.date.split('.').map(Number);
    const [bd, bm, by] = b.date.split('.').map(Number);
    return new Date(ay, am - 1, ad).getTime() - new Date(by, bm - 1, bd).getTime();
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { rowNumber, status, title } = await req.json();
  await setPlanRow(rowNumber, { status, title });
  return NextResponse.json({ ok: true });
}
