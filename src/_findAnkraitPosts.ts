import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';

const channel = process.env.POST_CHANNEL!;

async function main() {
  const session = process.env.TELEGRAM_SESSION!;
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH!;
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 3 });
  await client.connect();

  const messages = await client.getMessages(channel, { limit: 10 });
  for (const m of messages) {
    const preview = (m.text ?? m.message ?? '').slice(0, 60).replace(/\n/g, ' ');
    console.log(`id=${m.id} groupedId=${m.groupedId ?? ''} media=${!!m.media} date=${m.date} text="${preview}"`);
  }

  await client.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
