// Удаляет уже опубликованный пост из канала по номеру строки ContentPlan
// (кнопка "Удалить пост" в панели → GH Actions job delete-row → сюда).
// Строка возвращается в approved и очищается post/postUrl, чтобы её можно
// было отредактировать и опубликовать заново через "Опубликовать сейчас".
import { getContentPlanRows, updateContentPlanRow } from './sheets.ts';
import { deleteMessagesAsUser, disconnectMTProto } from './mtproto.ts';

const channel = process.env.POST_CHANNEL;

function messageIdFromUrl(url: string): number | null {
  const m = url.match(/\/(\d+)$/);
  return m ? Number(m[1]) : null;
}

async function main(): Promise<void> {
  if (!channel) throw new Error('POST_CHANNEL env var missing');
  const rowNumber = Number(process.env.DELETE_ROW);
  if (!rowNumber) throw new Error('DELETE_ROW env var missing');

  const rows = await getContentPlanRows();
  const row = rows.find((r) => r.rowNumber === rowNumber);
  if (!row) throw new Error(`строка ${rowNumber} не найдена в ContentPlan`);
  if (!row.postUrl) throw new Error(`у строки ${rowNumber} нет postUrl — нечего удалять`);

  const messageId = messageIdFromUrl(row.postUrl);
  if (!messageId) throw new Error(`не смог достать id сообщения из ссылки: ${row.postUrl}`);

  await deleteMessagesAsUser(channel, [messageId]);
  console.log(`deleted message ${messageId} (row ${rowNumber})`);

  await updateContentPlanRow(rowNumber, { status: 'approved', post: '', postUrl: '' });
  console.log(`row ${rowNumber} -> approved, post/postUrl очищены`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnectMTProto());
