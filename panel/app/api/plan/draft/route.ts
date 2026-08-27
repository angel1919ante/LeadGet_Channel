import { NextResponse } from 'next/server';

const REPO = 'angel1919ante/LeadGet_Channel';

// Генерация черновика поста без публикации (job draft-row в autopost.yml).
// Текст ложится в колонку "Пост" со статусом draft — можно прочитать,
// поправить руками в панели, и только потом публиковать.
export async function POST(req: Request) {
  const { rowNumber } = await req.json();
  const token = process.env.GITHUB_TOKEN;
  if (!token) return NextResponse.json({ error: 'GITHUB_TOKEN не настроен' }, { status: 500 });

  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/autopost.yml/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: 'main',
      inputs: { job: 'draft-row', plan_row: String(rowNumber) },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `GitHub API ${res.status}: ${text}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
