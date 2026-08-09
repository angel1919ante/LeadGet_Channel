// Запуск: node get_emoji_ids.mjs <short_name_пака>
// Например: node get_emoji_ids.mjs AnimatedEmojies
// short_name — последняя часть ссылки t.me/addemoji/PackName

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram/tl/index.js';
import { readFileSync } from 'fs';
// Читаем .env вручную
try {
  const env = readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch {}

const shortName = process.argv[2];
if (!shortName) {
  console.error('Usage: node get_emoji_ids.mjs <short_name>');
  process.exit(1);
}

const client = new TelegramClient(
  new StringSession(process.env.TELEGRAM_SESSION),
  Number(process.env.TELEGRAM_API_ID),
  process.env.TELEGRAM_API_HASH,
  { connectionRetries: 3 }
);

await client.connect();

const result = await client.invoke(new Api.messages.GetStickerSet({
  stickerset: new Api.InputStickerSetShortName({ shortName }),
  hash: 0,
}));

console.log(`\nПак: ${result.set.title} (${result.documents.length} эмодзи)\n`);
for (const doc of result.documents) {
  const attr = doc.attributes?.find(a => a.className === 'DocumentAttributeCustomEmoji' || a.alt);
  const emoji = attr?.alt ?? '?';
  console.log(`${emoji}  →  ${doc.id}`);
}

await client.disconnect();
