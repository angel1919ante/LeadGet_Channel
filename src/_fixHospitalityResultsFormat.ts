// Одноразовый фикс: пост row 12 (t.me/LeadGet_reviews/135) опубликован до
// исправления buildResultsString (caseGen.ts) — там ещё старый блок итогов
// (проценты не моноширинные, "783 диалогов" вместо "диалога", "114
// квалифицированных лида" вместо "лидов", без отступа после заголовка).
// Правим текст на месте и редактируем уже отправленное сообщение.
import { getContentPlanRows, updateContentPlanRow } from './sheets.ts';
import { editMessageAsUser, disconnectMTProto } from './mtproto.ts';

const channel = process.env.POST_CHANNEL;

function messageIdFromUrl(url: string): number | null {
  const m = url.match(/\/(\d+)$/);
  return m ? Number(m[1]) : null;
}

const OLD_BLOCK = `<code>2788</code> сообщений отправлено
<code>2186</code> прочитали: (78.4%)
<code>1177</code> ответили: (42.2%)
<code>783</code> диалогов: (28.1%)
<code>114</code> квалифицированных лида (4.1%)`;

const NEW_BLOCK = `
<code>2788</code> сообщений отправлено
<code>2186</code> прочитали: (<code>78.4%</code>)
<code>1177</code> ответили: (<code>42.2%</code>)
<code>783</code> диалога: (<code>28.1%</code>)
<code>114</code> квалифицированных лидов (<code>4.1%</code>)`;

async function main(): Promise<void> {
  if (!channel) throw new Error('POST_CHANNEL env var missing');
  const rowNumber = 12;

  const rows = await getContentPlanRows();
  const row = rows.find((r) => r.rowNumber === rowNumber);
  if (!row) throw new Error(`строка ${rowNumber} не найдена в ContentPlan`);
  if (!row.postUrl) throw new Error(`у строки ${rowNumber} нет postUrl`);
  if (!row.post.includes(OLD_BLOCK)) throw new Error('старый блок итогов не найден в тексте — формат разошёлся, правь руками');

  const messageId = messageIdFromUrl(row.postUrl);
  if (!messageId) throw new Error(`не смог достать id сообщения из ${row.postUrl}`);

  const newText = row.post.replace(OLD_BLOCK, NEW_BLOCK);

  await editMessageAsUser(channel, messageId, newText);
  console.log(`edited message ${messageId}`);

  await updateContentPlanRow(rowNumber, { post: newText });
  console.log(`row ${rowNumber} post обновлён в ContentPlan`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnectMTProto());
