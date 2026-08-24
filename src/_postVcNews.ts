// Пост в канал по источнику vc.ru про слив бюджета на автостратегиях Яндекс
// Директа (личный опыт Дениса). Отдельная новость, старый пост #78 не трогаем.
import { callLLM } from './llm.ts';
import { postPrompt } from './prompts.ts';
import { formatPost } from './formatter.ts';
import { postAsUser, disconnectMTProto } from './mtproto.ts';
import { loadToneSamples } from './toneSamples.ts';
import { appendPending, appendContentPlanRow, getContentPlanRows, updateContentPlanRow } from './sheets.ts';
import type { Candidate } from './types.ts';

const channel = process.env.POST_CHANNEL!;

function postLink(messageId: number): string {
  const username = channel.replace(/^@/, '');
  return `https://t.me/${username}/${messageId}`;
}

const candidate: Candidate = {
  source: 'vc',
  title: 'Как Яндекс.Директ сливает бюджет',
  link: 'https://vc.ru/marketing/897099-kak-yandeksdirekt-slivaet-byudzhet',
  rating: 90,
  description: 'Личный опыт маркетолога Дениса: специалист Яндекса настроил кампанию с нерелевантными фразами и автотаргетингом, реклама показывала странные объявления. Яндекс запретил блокировать площадки с префиксом "yandex", раньше это можно было отключать вручную. Клиент слил 7000 рублей за один день на РСЯ, основная причина — случайные клики по рекламе в мобильных приложениях (например, в приложении Like) при закрытии баннера, а не реальный интерес. РСЯ начала списывать вдвое больше, чем раньше, без объяснений.',
};

function todayDMY(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

async function main() {
  const tone = await loadToneSamples().catch(() => ({ ours: [], learn: [] }));
  const rawPost = await callLLM(postPrompt(candidate, tone));
  const formatted = await formatPost(`${rawPost}\n\nИсточник: ${candidate.link}`);

  console.log('----- TEXT -----');
  console.log(formatted.replace(/<[^>]+>/g, ''));

  const messageId = await postAsUser(channel, formatted);
  const postUrl = postLink(messageId);
  console.log(`posted: ${postUrl}`);

  await appendPending([{
    source: candidate.source,
    title: candidate.title,
    summary: candidate.description ?? '',
    link: candidate.link,
    rating: candidate.rating,
    status: 'posted',
  }]);

  const dateStr = todayDMY();
  await appendContentPlanRow({ date: dateStr, type: 'новость', title: candidate.title, token: '', data: JSON.stringify({ link: candidate.link, summary: candidate.description }) });
  const rows = await getContentPlanRows();
  const newRow = rows.find((r) => r.date === dateStr && r.type === 'новость' && r.title === candidate.title);
  if (newRow) {
    await updateContentPlanRow(newRow.rowNumber, { status: 'posted', post: formatted, postUrl });
    console.log(`ContentPlan row ${newRow.rowNumber} -> posted`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnectMTProto());
