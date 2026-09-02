// Временный скрипт: постит готовый текст статьи напрямую в @leadgetseo,
// минуя лист Articles. Для одноразового теста autopost-skill на статьях.
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
  const text = process.env.ARTICLE_TEXT_DIRECT;
  const platform = process.env.ARTICLE_PLATFORM_DIRECT ?? 'habr';
  if (!text) throw new Error('ARTICLE_TEXT_DIRECT env var missing');

  const header = `ЧЕРНОВИК [${platform.toUpperCase()}] тест autopost-skill (без строки в Articles)`;
  const chunks = splitIntoChunks(text);

  await postAsUser(REVIEW_CHANNEL, header);
  for (let i = 0; i < chunks.length; i++) {
    const label = chunks.length > 1 ? `[часть ${i + 1}/${chunks.length}]\n\n` : '';
    await postAsUser(REVIEW_CHANNEL, `${label}${chunks[i]}`);
  }
  console.log(`posted direct article text (${platform}) to ${REVIEW_CHANNEL} in ${chunks.length} part(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnectMTProto());
