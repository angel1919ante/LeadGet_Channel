import { fetchTelegramChannel, disconnectMTProto } from './mtproto.ts';
const username = process.env.POST_CHANNEL!.replace(/^@/, '');
const msgs = await fetchTelegramChannel(username, 40);
for (const m of msgs) {
  if (m.text.includes('Голосовые') || m.text.includes('диалог') && m.text.includes('LeadGet')) {
    console.log(`=== id=${m.id} ===`);
    console.log(m.text);
    console.log();
  }
}
await disconnectMTProto();
