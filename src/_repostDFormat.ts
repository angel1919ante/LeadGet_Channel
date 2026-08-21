// Перевыкладываем кейс Д-Format: их ниша - строительные компании, не e-commerce.
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
  const row = rows.find((r) => r.rowNumber === 5);
  if (!row) throw new Error('row 5 not found');
  console.log('row.postUrl:', row.postUrl);

  const oldId = row.postUrl ? Number(row.postUrl.split('/').pop()) : undefined;
  if (oldId) {
    await deleteMessagesAsUser(channel, [oldId]);
    console.log(`deleted old message ${oldId}`);
  }

  const { postText, board } = await generateCase(row);
  const formatted = await formatPost(postText);
  const boardImage = await renderCaseBoardCard(board);

  const messageId = await sendPhotoAsUser(channel, boardImage, formatted);
  const postUrl = postLink(messageId);
  console.log(`posted: ${postUrl}`);

  const data = JSON.parse(row.data);
  await updateContentPlanRow(5, {
    post: formatted,
    postUrl,
    data: JSON.stringify({ ...data, boardPosted: true }),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnectMTProto());
