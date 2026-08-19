import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';

const channel = process.env.POST_CHANNEL!;

async function main() {
  const session = process.env.TELEGRAM_SESSION!;
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH!;
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 3 });
  await client.connect();

  const messages = await client.getMessages(channel, { limit: 2 });
  for (const m of messages) {
    console.log(`id=${m.id} media=${!!m.media}`);
    console.log(m.text ?? m.message ?? '');
    console.log('---');
  }

  await client.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
