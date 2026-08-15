import { NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Отдаёт исходный текст формальных спек как есть, без пересказа —
// файлы лежат в panel/specs/, скопированы из references/case-cards/.
const ALLOWED: Record<string, string> = {
  'case-preview': 'case-preview-spec.md',
  'case-chat': 'case-chat-spec.md',
};

export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get('name') ?? '';
  const file = ALLOWED[name];
  if (!file) return NextResponse.json({ error: 'unknown spec' }, { status: 404 });

  const content = readFileSync(join(process.cwd(), 'specs', file), 'utf-8');
  return NextResponse.json({ content });
}
