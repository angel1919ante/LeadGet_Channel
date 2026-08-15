import { NextResponse } from 'next/server';
import { appendFeature, getFeatureRows, setFeatureStatus } from '@/lib/sheets';

export async function GET() {
  const rows = await getFeatureRows();
  return NextResponse.json(rows.reverse());
}

export async function POST(req: Request) {
  const body = await req.json();
  if (body.rowNumber) {
    await setFeatureStatus(body.rowNumber, body.status);
  } else {
    await appendFeature({ title: body.title, problem: body.problem, description: body.description });
  }
  return NextResponse.json({ ok: true });
}
