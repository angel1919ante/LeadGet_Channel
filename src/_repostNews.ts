// Разовый скрипт: перегенерировать и перевыложить кейс-пост D-Format —
// заголовок доски раньше был длинным (ниша с уточнением в скобках) и
// переполнял блок, наезжая на маскота. Запускать ПОСЛЕ fix-week-dates
// (правит boardTitle в Данных строки), чтобы взять короткий заголовок.
import { getContentPlanRows, updateContentPlanRow } from './sheets.ts';
import { generateCase } from './caseGen.ts';
import { renderCaseBoardCard } from './caseBoard.ts';
import { formatPost } from './formatter.ts';
import { sendPhotoAsUser, disconnectMTProto } from './mtproto.ts';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';

const channel = process.env.POST_CHANNEL!;
const ROW = 5;
const OLD_ID = 92;

function postLink(messageId: number): string {
  const username = channel.replace(/^@/, '');
  return `https://t.me/${username}/${messageId}`;
}

async function main() {
  const rows = await getContentPlanRows();
  const planRow = rows.find((r) => r.rowNumber === ROW);
  if (!planRow) throw new Error(`строка ${ROW} не найдена`);

  const { postText, board } = await generateCase(planRow);
  const formatted = await formatPost(postText);
  const boardImage = await renderCaseBoardCard(board);

  console.log('----- TEXT -----');
  console.log(formatted.replace(/<[^>]+>/g, ''));

  const session = process.env.TELEGRAM_SESSION!;
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH!;
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 3 });
  await client.connect();
  await client.deleteMessages(channel, [OLD_ID], { revoke: true });
  console.log(`deleted old message ${OLD_ID}`);
  await client.disconnect();

  const messageId = await sendPhotoAsUser(channel, boardImage, formatted);
  const postUrl = postLink(messageId);
  console.log(`posted: ${postUrl}`);

  await updateContentPlanRow(ROW, { status: 'posted', post: formatted, postUrl });
  console.log(`row ${ROW} -> posted`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnectMTProto());
