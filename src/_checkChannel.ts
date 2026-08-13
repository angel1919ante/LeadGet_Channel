// ponytail: одноразовая проверка последнего поста в канале, удалить после использования.
import { fetchTelegramChannel, disconnectMTProto } from './mtproto.ts';

async function main() {
  const msgs = await fetchTelegramChannel('LeadGet_reviews', 5);
  for (const m of msgs) {
    console.log('---');
    console.log(m.text);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => disconnectMTProto());
