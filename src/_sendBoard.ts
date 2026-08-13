// ponytail: одноразовый скрипт для отправки превью кейса SeoAI, удалить после использования.
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { CustomFile } from 'telegram/client/uploads.js';
import { readFileSync } from 'node:fs';

async function main() {
  const session = process.env.TELEGRAM_SESSION!;
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH!;
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 3 });
  await client.connect();

  const buf = readFileSync('.tmp_cards_2/patched.png');
  const file = new CustomFile('case_seoai.png', buf.length, '.tmp_cards_2/patched.png', buf);

  await client.sendFile('@LeadGet_reviews', {
    file,
    caption: '📊 Тест: превью кейса SeoAI — шрифты из реальной design system (Unbounded/JetBrains Mono), рука на месте, честные цифры от 2431',
  });

  console.log('sent');
  await client.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
