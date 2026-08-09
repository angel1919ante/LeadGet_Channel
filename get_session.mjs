import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import * as readline from 'readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
if (!apiId || !apiHash) {
  console.error('Нужны TELEGRAM_API_ID и TELEGRAM_API_HASH в env');
  process.exit(1);
}
const client = new TelegramClient(new StringSession(''), apiId, apiHash, { connectionRetries: 3 });
await client.start({
  phoneNumber: async () => await ask('Номер телефона: '),
  password: async () => await ask('Пароль 2FA (если есть): '),
  phoneCode: async () => await ask('Код из Telegram: '),
  onError: (e) => console.error(e),
});

console.log('\nTELEGRAM_SESSION =', client.session.save());
rl.close();
await client.disconnect();
