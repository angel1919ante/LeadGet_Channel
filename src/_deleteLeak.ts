import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';

const session = process.env.TELEGRAM_SESSION!;
const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH!;
const username = process.env.POST_CHANNEL!.replace(/^@/, '');

const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 3 });
await client.connect();
const ids = [34, 35, 36, 37, 38];
const result = await client.deleteMessages(username, ids, { revoke: true });
console.log('deleted:', JSON.stringify(result));
await client.disconnect();
