import { NextResponse } from 'next/server';
import { getFeatureRows, setFeatureStatus } from '@/lib/sheets';

export async function GET() {
  const rows = await getFeatureRows();
  return NextResponse.json(rows.reverse());
}

export async function POST(req: Request) {
  const { rowNumber, status } = await req.json();
  await setFeatureStatus(rowNumber, status);
  return NextResponse.json({ ok: true });
}
