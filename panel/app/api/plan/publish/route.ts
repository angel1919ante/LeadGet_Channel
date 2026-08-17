import { NextResponse } from 'next/server';

const REPO = 'angel1919ante/LeadGet_Channel';

// Триггерит реальную публикацию строки ContentPlan через GitHub Actions
// (job post-row в autopost.yml) — панель сама Telegram/Replicate не трогает,
// только просит бота на GitHub сделать это прямо сейчас, а не по расписанию.
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
      inputs: { job: 'post-row', plan_row: String(rowNumber) },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `GitHub API ${res.status}: ${text}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
