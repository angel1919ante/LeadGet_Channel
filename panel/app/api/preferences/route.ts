import { NextResponse } from 'next/server';
import { getPreferenceRows } from '@/lib/sheets';

export async function GET() {
  const rows = await getPreferenceRows();
  return NextResponse.json(rows);
}
