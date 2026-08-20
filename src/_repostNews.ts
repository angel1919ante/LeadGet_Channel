// Разовый скрипт: перевыпуск фича-поста "Подключиться к диалогу" —
// CTA раньше звучал как саппорт-футер ("попробуйте в следующий раз,
// когда...", "если нужна помощь с настройкой"), промпт исправлен.
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { updateContentPlanRow } from './sheets.ts';
import { callLLM } from './llm.ts';
import { featurePostPrompt } from './prompts.ts';
import { formatPost } from './formatter.ts';

const channel = process.env.POST_CHANNEL!;
const PLAN_ROW = 6;
const OLD_MESSAGE_ID = 79;

const TITLE = 'Подключиться к диалогу';
const PROBLEM = 'Чтобы ответить лиду лично, нужно было выходить в Telegram со своего аккаунта. Лид видел смену контакта, менеджер терял всю переписку из виду, а бот мог ответить одновременно с человеком.';
const DESCRIPTION = 'Менеджер подключается к диалогу прямо на дэшборде LeadGet, не открывая Telegram. ИИ-ассистент сразу замолкает, диалог продолжается от того же бот-аккаунта, лид не замечает подмены. Вся история переписки остаётся перед глазами, подключение происходит автоматически без настроек.';

function postLink(messageId: number): string {
  const username = channel.replace(/^@/, '');
  return `https://t.me/${username}/${messageId}`;
}

async function main() {
  const session = process.env.TELEGRAM_SESSION!;
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH!;
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 3 });
  await client.connect();

  await client.deleteMessages(channel, [OLD_MESSAGE_ID], { revoke: true });
  console.log(`deleted old message ${OLD_MESSAGE_ID}`);

  const rawPost = await callLLM(featurePostPrompt(TITLE, PROBLEM, DESCRIPTION));
  const formatted = await formatPost(rawPost);

  console.log('----- TEXT -----');
  console.log(formatted.replace(/<[^>]+>/g, ''));

  const msg = await client.sendMessage(channel, { message: formatted, parseMode: 'html' });
  const postUrl = postLink(msg.id);
  console.log(`posted: ${postUrl}`);

  await updateContentPlanRow(PLAN_ROW, { status: 'posted', post: formatted, postUrl });
  console.log(`row ${PLAN_ROW} -> posted`);

  await client.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
