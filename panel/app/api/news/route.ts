import { NextResponse } from 'next/server';
import { getNewsRows, setNewsStatus } from '@/lib/sheets';

export async function GET() {
  const rows = await getNewsRows();
  return NextResponse.json(rows.reverse());
}

export async function POST(req: Request) {
  const { rowNumber, status } = await req.json();
  await setNewsStatus(rowNumber, status);
  return NextResponse.json({ ok: true });
}
