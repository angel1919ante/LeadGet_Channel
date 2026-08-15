import { getContentPlanRows, updateContentPlanRow } from './sheets.ts';
import { fetchTelegramChannel, disconnectMTProto } from './mtproto.ts';

// Наш сохранённый текст в HTML (<b>, <tg-emoji>), а то, что отдаёт
// getMessages, в Markdown (**bold**) — убираем разметку с обеих сторон.
function normalize(text: string): string {
  return text.replace(/<[^>]+>/g, '').replace(/\*+/g, '').replace(/\s+/g, ' ').trim();
}

async function main() {
  const channel = process.env.POST_CHANNEL!;
  const username = channel.replace(/^@/, '');

  const plans = await getContentPlanRows();
  const toFix = plans.filter((r) => r.status === 'posted' && !r.postUrl && r.post);
  if (toFix.length === 0) {
    console.log('нет постов без ссылки');
    return;
  }

  const messages = await fetchTelegramChannel(username, 100);
  const channelTexts = messages.map((m) => ({ id: m.id, text: normalize(m.text) }));

  for (const row of toFix) {
    const target = normalize(row.post).slice(0, 60);
    const match = channelTexts.find((m) => m.text.slice(0, 60) === target);
    if (match) {
      await updateContentPlanRow(row.rowNumber, { postUrl: `https://t.me/${username}/${match.id}` });
      console.log(`matched row ${row.rowNumber} -> https://t.me/${username}/${match.id}`);
    } else {
      console.log(`no match for row ${row.rowNumber}: "${target}"`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => disconnectMTProto());
