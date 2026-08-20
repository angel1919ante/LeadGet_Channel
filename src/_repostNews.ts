// Разовый скрипт: пересобираем уже опубликованный кейс-пост D-Format —
// внутри <blockquote> появились лишние пустые строки между цифрами
// из-за бага enforceParagraphBreaks (уже исправлен в formatter.ts).
// Текст такой же, просто убираем \n\n на \n внутри цитаты и перепощиваем.
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { updateContentPlanRow } from './sheets.ts';

const channel = process.env.POST_CHANNEL!;
const PLAN_ROW = 5;
const OLD_MESSAGE_ID = 82;

const STORED_TEXT = `<b><tg-emoji emoji-id="5231200819986047254">📊</tg-emoji> Кейс: лидогенерация для агентства перформанс-рекламы</b>

Агентство интернет-маркетинга ищет клиентов, которые готовы отдать управление рекламными кампаниями под ключ. Аудитория понятна: владельцы и маркетологи e-commerce, SaaS и сервисов с бюджетом на рекламу. Задача: найти их в Telegram и начать диалог.

<tg-emoji emoji-id="5422439311196834318">💡</tg-emoji> База: собственники и маркетологи компаний среднего размера, активные в профильных Telegram-каналах и сообществах.

<b><tg-emoji emoji-id="5341715473882955310">⚙️</tg-emoji> Что сделали?</b>

• Составили целевую базу контактов из каналов, где сидит целевая аудитория <tg-emoji emoji-id="5206607081334906820">✔️</tg-emoji>
• Запустили персональную рассылку через ИИ-агентов с предложением консультации <tg-emoji emoji-id="5456140674028019486">⚡</tg-emoji>
• Бот квалифицировал интерес на этапе первого контакта <tg-emoji emoji-id="5422439311196834318">💡</tg-emoji>
• Передали только готовых клиентов в воронку продаж <tg-emoji emoji-id="5244837092042750681">📈</tg-emoji>

<b><tg-emoji emoji-id="5429651785352501917">↗️</tg-emoji> Итоги за период:</b>
<blockquote>Рассылка: <b>289</b> сообщений отправлено
Прочитали: <b>232</b> (<b>80</b>.<b>3</b>%) Ответили: <b>151</b> (<b>52</b>.<b>2</b>%)
Диалогов: <b>48</b> (<b>16</b>.<b>6</b>%)
Конверсия в лид: <b>2.8%</b> — <b>8</b> квалифицированных лидов</blockquote>

<tg-emoji emoji-id="5253742260054409879">✉️</tg-emoji> Ищете клиентов для своего агентства, консалтинга или сервиса? Напишите менеджеру <b>@LeadGet_info</b> <tg-emoji emoji-id="5330237710655306682">📱</tg-emoji>, расскажем, как это работает.`;

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

  const msg = await client.sendMessage(channel, { message: STORED_TEXT, parseMode: 'html' });
  const postUrl = postLink(msg.id);
  console.log(`posted: ${postUrl}`);

  await updateContentPlanRow(PLAN_ROW, { status: 'posted', post: STORED_TEXT, postUrl });
  console.log(`row ${PLAN_ROW} -> posted`);

  await client.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
