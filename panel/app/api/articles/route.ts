import { NextResponse } from 'next/server';
import { appendArticle, getArticleRows, setArticleRow } from '@/lib/sheets';

export async function GET() {
  const rows = await getArticleRows();
  return NextResponse.json(rows.reverse());
}

export async function POST(req: Request) {
  const body = await req.json();
  if (body.rowNumber) {
    const { rowNumber, ...patch } = body;
    await setArticleRow(rowNumber, patch);
  } else {
    await appendArticle({ platform: body.platform, title: body.title, content: body.content });
  }
  return NextResponse.json({ ok: true });
}
