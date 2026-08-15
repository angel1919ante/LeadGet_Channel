import { fetchTelegramChannel, disconnectMTProto } from './mtproto.ts';

const watchdog = setTimeout(() => {
  console.error('TIMEOUT: fetchTelegramChannel took longer than 30s, aborting');
  process.exit(1);
}, 30_000);

const username = process.env.POST_CHANNEL!.replace(/^@/, '');
console.log(`fetching ${username}...`);
const msgs = await fetchTelegramChannel(username, 20);
console.log(`got ${msgs.length} messages`);
for (const m of msgs) {
  console.log(`id=${m.id} date=${new Date(m.date * 1000).toISOString()} text="${m.text.slice(0, 70).replace(/\n/g, ' ')}"`);
}
clearTimeout(watchdog);
await disconnectMTProto();
