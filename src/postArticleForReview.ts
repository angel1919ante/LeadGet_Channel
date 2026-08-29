// Постит сгенерированную статью (из листа Articles) в канал для визуальной
// проверки (@leadgetseo) — черновик, не публикация на площадку. Длинные
// статьи режем по абзацам под лимит Telegram (4096 символов).
import { getArticleRows } from './sheets.ts';
import { postAsUser, disconnectMTProto } from './mtproto.ts';

const REVIEW_CHANNEL = process.env.REVIEW_CHANNEL ?? '@leadgetseo';
const CHUNK_LIMIT = 3800;

function splitIntoChunks(text: string): string[] {
  const paragraphs = text.split('\n\n');
  const chunks: string[] = [];
  let current = '';
  for (const p of paragraphs) {
    const candidate = current ? `${current}\n\n${p}` : p;
    if (candidate.length > CHUNK_LIMIT && current) {
      chunks.push(current);
      current = p;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function main(): Promise<void> {
  const rowNumber = Number(process.env.ARTICLE_ROW);
  if (!rowNumber) throw new Error('ARTICLE_ROW env var missing');

  const rows = await getArticleRows();
  const row = rows.find((r) => r.rowNumber === rowNumber);
  if (!row) throw new Error(`строка ${rowNumber} не найдена в Articles`);

  const header = `ЧЕРНОВИК [${row.platform.toUpperCase()}] по мотивам: ${row.sourceTitle}\nСтрока в Articles: ${rowNumber}`;
  const chunks = splitIntoChunks(row.content);

  await postAsUser(REVIEW_CHANNEL, header);
  for (let i = 0; i < chunks.length; i++) {
    const label = chunks.length > 1 ? `[часть ${i + 1}/${chunks.length}]\n\n` : '';
    await postAsUser(REVIEW_CHANNEL, `${label}${chunks[i]}`);
  }
  console.log(`posted article row ${rowNumber} (${row.platform}) to ${REVIEW_CHANNEL} in ${chunks.length} part(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnectMTProto());
