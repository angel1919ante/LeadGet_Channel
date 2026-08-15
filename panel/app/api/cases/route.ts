import { NextResponse } from 'next/server';
import { getCaseRows, setCaseStatus } from '@/lib/sheets';

export async function GET() {
  const rows = await getCaseRows();
  return NextResponse.json(rows.filter((r) => r.status === 'pending').reverse());
}

export async function POST(req: Request) {
  const { rowNumber, status } = await req.json();
  await setCaseStatus(rowNumber, status);
  return NextResponse.json({ ok: true });
}
