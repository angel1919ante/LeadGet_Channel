// Разовый скрипт: перегенерировать и перевыложить кейс-посты Анкрайт и
// D-Format через реальный пайплайн generateCase() — теперь с масштабированием
// отправок (D-Format 289 -> ~2000-4000) и новым форматом итогов (моноширинные
// цифры пачкой). Доска тоже перерисовывается с новыми цифрами.
import { getContentPlanRows, updateContentPlanRow } from './sheets.ts';
import { generateCase } from './caseGen.ts';
import { renderCaseBoardCard } from './caseBoard.ts';
import { formatPost } from './formatter.ts';
import { postAsUser, sendPhotoAsUser, disconnectMTProto } from './mtproto.ts';

const channel = process.env.POST_CHANNEL!;

const TARGETS: Array<{ row: number; oldId: number }> = [
  { row: 4, oldId: 88 },
  { row: 5, oldId: 89 },
];

function postLink(messageId: number): string {
  const username = channel.replace(/^@/, '');
  return `https://t.me/${username}/${messageId}`;
}

async function main() {
  const rows = await getContentPlanRows();

  for (const t of TARGETS) {
    const planRow = rows.find((r) => r.rowNumber === t.row);
    if (!planRow) throw new Error(`строка ${t.row} не найдена`);

    const { postText, board } = await generateCase(planRow);
    const formatted = await formatPost(postText);
    const boardImage = await renderCaseBoardCard(board);

    console.log(`----- row ${t.row}: TEXT -----`);
    console.log(formatted.replace(/<[^>]+>/g, ''));

    // Тут не используем postAsUser напрямую для удаления/пересылки —
    // сначала удаляем старое сообщение, затем шлём новое с фото.
    const { TelegramClient } = await import('telegram');
    const { StringSession } = await import('telegram/sessions/index.js');
    const session = process.env.TELEGRAM_SESSION!;
    const apiId = Number(process.env.TELEGRAM_API_ID);
    const apiHash = process.env.TELEGRAM_API_HASH!;
    const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 3 });
    await client.connect();
    await client.deleteMessages(channel, [t.oldId], { revoke: true });
    console.log(`deleted old message ${t.oldId}`);
    await client.disconnect();

    const messageId = await sendPhotoAsUser(channel, boardImage, formatted);
    const postUrl = postLink(messageId);
    console.log(`posted: ${postUrl}`);

    await updateContentPlanRow(t.row, { status: 'posted', post: formatted, postUrl });
    console.log(`row ${t.row} -> posted`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnectMTProto());
