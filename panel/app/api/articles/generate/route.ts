import { NextResponse } from 'next/server';

const REPO = 'angel1919ante/LeadGet_Channel';

// Триггерит генерацию статьи через GitHub Actions (job generate-article в
// autopost.yml) — панель не хранит OPENROUTER_API_KEY, та же схема, что у
// publish/delete: просим бота на GitHub сделать это прямо сейчас.
export async function POST(req: Request) {
  const { newsRow, topic, platform } = await req.json();
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
      inputs: {
        job: 'generate-article',
        news_row: newsRow ? String(newsRow) : '',
        topic: topic ?? '',
        platform,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `GitHub API ${res.status}: ${text}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
