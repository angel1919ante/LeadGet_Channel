import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';

const channel = process.env.POST_CHANNEL!;

async function main() {
  const session = process.env.TELEGRAM_SESSION!;
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH!;
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 3 });
  await client.connect();

  await client.deleteMessages(channel, [62, 63, 64, 65, 66], { revoke: true });
  console.log('deleted 5-slide chat album (ids 62-66)');

  await client.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
