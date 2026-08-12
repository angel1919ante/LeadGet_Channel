// ponytail: одноразовый скрипт для теста карточек диалога, удалить после использования.
import { postAsUser, disconnectMTProto } from './mtproto.ts';
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

  const files = ['.tmp_cards/card_1_final.png', '.tmp_cards/card_2_final.png', '.tmp_cards/card_3_final.png'];
  const toUpload = files.map((f) => {
    const buf = readFileSync(f);
    return new CustomFile(f.split('/').pop()!, buf.length, f, buf);
  });

  await client.sendFile('@LeadGet_reviews', {
    file: toUpload,
    caption: '📊 Тест: карточки диалога кейса (IT-продукт для Авито) — детерминированный HTML-рендер, реальная переписка',
  });

  console.log('sent');
  await client.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
