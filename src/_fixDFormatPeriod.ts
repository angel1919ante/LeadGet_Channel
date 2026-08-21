// Живой пост D-Format содержал буквальный "[ПЕРИОД]" вместо реального
// значения (LLM не подставил, как требует CASE_TZ) — чинит на месте.
import { getContentPlanRows, updateContentPlanRow } from './sheets.ts';
import { generateCase } from './caseGen.ts';
import { renderCaseBoardCard } from './caseBoard.ts';
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

  const oldId = row.postUrl ? Number(row.postUrl.split('/').pop()) : undefined;
  if (oldId) {
    await deleteMessagesAsUser(channel, [oldId]);
    console.log(`deleted old message ${oldId}`);
  }

  const fixed = row.post.replace(/\[ПЕРИОД\]/g, '14 дней');
  const { board } = await generateCase(row);
  const boardImage = await renderCaseBoardCard(board);

  const messageId = await sendPhotoAsUser(channel, boardImage, fixed);
  const postUrl = postLink(messageId);
  console.log(`posted: ${postUrl}`);

  await updateContentPlanRow(5, { post: fixed, postUrl });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnectMTProto());
