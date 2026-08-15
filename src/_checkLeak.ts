import { fetchTelegramChannel, disconnectMTProto } from './mtproto.ts';
const username = process.env.POST_CHANNEL!.replace(/^@/, '');
const msgs = await fetchTelegramChannel(username, 10);
for (const m of msgs) {
  console.log(`=== id=${m.id} date=${new Date(m.date * 1000).toISOString()} ===`);
  console.log(m.text);
  console.log();
}
await disconnectMTProto();
