// Мало Места: реальная конверсия в лид 3.8% (не 2.0% как посчитали раньше из
// сырой выгрузки status=qualified) — обновляем leads в summaryOverride и
// перевыкладываем живой пост с правильными цифрами.
import { getContentPlanRows, updateContentPlanRow } from './sheets.ts';
import { generateCase } from './caseGen.ts';
import { renderCaseBoardCard } from './caseBoard.ts';
import { formatPost } from './formatter.ts';
import { postAsUser, sendPhotoAsUser, deleteMessagesAsUser, disconnectMTProto } from './mtproto.ts';

const channel = process.env.POST_CHANNEL!;

function postLink(messageId: number): string {
  const username = channel.replace(/^@/, '');
  return `https://t.me/${username}/${messageId}`;
}

async function main() {
  const rows = await getContentPlanRows();
  const row = rows.find((r) => r.rowNumber === 17);
  if (!row) throw new Error('row 17 not found');

  const data = JSON.parse(row.data);
  data.summaryOverride.leads = 19;
  await updateContentPlanRow(17, { data: JSON.stringify(data) });
  console.log('summaryOverride.leads -> 19');

  const oldId = row.postUrl ? Number(row.postUrl.split('/').pop()) : undefined;
  if (oldId) {
    await deleteMessagesAsUser(channel, [oldId]);
    console.log(`deleted old message ${oldId}`);
  }

  const updatedRow = { ...row, data: JSON.stringify(data) };
  const { postText, board } = await generateCase(updatedRow);
  const formatted = await formatPost(postText);
  const boardImage = await renderCaseBoardCard(board);

  const messageId = await sendPhotoAsUser(channel, boardImage, formatted);
  const postUrl = postLink(messageId);
  console.log(`posted: ${postUrl}`);

  await updateContentPlanRow(17, { post: formatted, postUrl });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnectMTProto());
