// Одноразовый скрипт: row 11 (04.09, DML vs PSM/Wildberries) была написана
// до правки NEWS_TZ (живой тон, эталон от Паши) — старый пост удалён,
// перегенерируем текст ПО ТОЙ ЖЕ новости (не берём новую тему) с новым
// промптом и сохраняем как черновик для проверки перед публикацией.
import { getContentPlanRows, updateContentPlanRow } from './sheets.ts';
import { callLLM } from './llm.ts';
import { postPrompt } from './prompts.ts';
import { formatPost } from './formatter.ts';
import { loadToneSamples } from './toneSamples.ts';
import { disconnectMTProto } from './mtproto.ts';
import type { Candidate, Source } from './types.ts';

async function main(): Promise<void> {
  const rowNumber = 11;
  const rows = await getContentPlanRows();
  const row = rows.find((r) => r.rowNumber === rowNumber);
  if (!row) throw new Error(`строка ${rowNumber} не найдена`);

  let data: { link?: string; summary?: string } = {};
  try { data = row.data ? JSON.parse(row.data) : {}; } catch { /* пусто */ }
  if (!data.link || !data.summary) throw new Error('нет link/summary в data строки — нечего перегенерировать');

  const candidate: Candidate = {
    source: 'habr' as Source,
    title: row.title,
    link: data.link,
    rating: 0,
    description: data.summary,
  };

  const tone = await loadToneSamples().catch(() => ({ ours: [], learn: [] }));
  const rawPost = await callLLM(postPrompt(candidate, tone));
  const formatted = await formatPost(rawPost);

  await updateContentPlanRow(rowNumber, { status: 'draft', post: formatted });
  console.log(`row ${rowNumber} -> draft, ${formatted.length} символов`);
  console.log('---TEXT---');
  console.log(formatted);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnectMTProto());
