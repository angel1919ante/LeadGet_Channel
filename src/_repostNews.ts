// Разовый скрипт: переформатируем уже опубликованные кейс-посты (Анкрайт,
// D-Format) под новый эталон — цифра первой, без "Рассылка:"-префиксов,
// без блок-цитаты, пропуск между каждым буллетом. Формулировки те же,
// меняется только вёрстка.
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { updateContentPlanRow } from './sheets.ts';

const channel = process.env.POST_CHANNEL!;

function postLink(messageId: number): string {
  const username = channel.replace(/^@/, '');
  return `https://t.me/${username}/${messageId}`;
}

const POSTS: Array<{ row: number; oldId: number; text: string }> = [
  {
    row: 4,
    oldId: 72,
    text: `<b><tg-emoji emoji-id="5231200819986047254">📊</tg-emoji> Кейс: поиск постоянных грузов для транспортной компании</b>

Транспортная компания занимается грузоперевозками по России и искала способ наполнить машины постоянными маршрутами вместо разовых заказов через биржи. Нужны были клиенты с регулярными грузами под конкретные типы кузовов, включая специальные варианты вроде боковой погрузки. Задача: выйти на логистов и грузовладельцев напрямую, минуя посредников.

<tg-emoji emoji-id="5422439311196834318">💡</tg-emoji> База: контакты логистических компаний и грузовладельцев, которые работают с постоянными объёмами и ищут надёжного перевозчика.

<b><tg-emoji emoji-id="5341715473882955310">⚙️</tg-emoji> Что сделали?</b>

• Запустили рассылку по базе логистических и грузовладельческих контактов 📧

• Квалифицировали интерес уточняющими вопросами о маршруте, типе кузова и бюджете <tg-emoji emoji-id="5206607081334906820">✔️</tg-emoji>

• Отсеивали разовые заказы и фокусировались на постоянных грузах 🎯

• Передавали готовые диалоги менеджерам для закрытия 💼

<b><tg-emoji emoji-id="5429651785352501917">↗️</tg-emoji> Итоги за период:</b>

<b>3212</b> сообщений отправлено

<b>2521</b> прочитали: (78.5%)

<b>1728</b> ответили: (53.8%)

<b>507</b> диалогов: (15.8%)

<b>183</b> квалифицированных лида (5.7%)

Цена квалифицированного лида оказалась ниже, чем в биржах грузоперевозок, где средняя стоимость заказа часто теряется на комиссиях и конкуренции. Здесь мы работали с прогретой аудиторией, которая уже ищет постоянного партнёра, а не просто дешёвую ставку.

<tg-emoji emoji-id="5253742260054409879">✉️</tg-emoji> Работаете в логистике или грузоперевозках и хотите наполнить машины постоянными маршрутами? Напишите менеджеру <b>@LeadGet_info</b> <tg-emoji emoji-id="5330237710655306682">📱</tg-emoji>, расскажем, как это сделать.`,
  },
  {
    row: 5,
    oldId: 83,
    text: `<b><tg-emoji emoji-id="5231200819986047254">📊</tg-emoji> Кейс: лидогенерация для агентства перформанс-рекламы</b>

Агентство интернет-маркетинга ищет клиентов, которые готовы отдать управление рекламными кампаниями под ключ. Аудитория понятна: владельцы и маркетологи e-commerce, SaaS и сервисов с бюджетом на рекламу. Задача: найти их в Telegram и начать диалог.

<tg-emoji emoji-id="5422439311196834318">💡</tg-emoji> База: собственники и маркетологи компаний среднего размера, активные в профильных Telegram-каналах и сообществах.

<b><tg-emoji emoji-id="5341715473882955310">⚙️</tg-emoji> Что сделали?</b>

• Составили целевую базу контактов из каналов, где сидит целевая аудитория <tg-emoji emoji-id="5206607081334906820">✔️</tg-emoji>

• Запустили персональную рассылку через ИИ-агентов с предложением консультации <tg-emoji emoji-id="5456140674028019486">⚡</tg-emoji>

• Бот квалифицировал интерес на этапе первого контакта <tg-emoji emoji-id="5422439311196834318">💡</tg-emoji>

• Передали только готовых клиентов в воронку продаж <tg-emoji emoji-id="5244837092042750681">📈</tg-emoji>

<b><tg-emoji emoji-id="5429651785352501917">↗️</tg-emoji> Итоги за период:</b>

<b>289</b> сообщений отправлено

<b>232</b> прочитали: (80.3%)

<b>151</b> ответили: (52.2%)

<b>48</b> диалогов: (16.6%)

<b>8</b> квалифицированных лида (2.8%)

<tg-emoji emoji-id="5253742260054409879">✉️</tg-emoji> Ищете клиентов для своего агентства, консалтинга или сервиса? Напишите менеджеру <b>@LeadGet_info</b> <tg-emoji emoji-id="5330237710655306682">📱</tg-emoji>, расскажем, как это работает.`,
  },
];

async function main() {
  const session = process.env.TELEGRAM_SESSION!;
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH!;
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 3 });
  await client.connect();

  for (const p of POSTS) {
    await client.deleteMessages(channel, [p.oldId], { revoke: true });
    console.log(`deleted old message ${p.oldId} (row ${p.row})`);

    const msg = await client.sendMessage(channel, { message: p.text, parseMode: 'html' });
    const postUrl = postLink(msg.id);
    console.log(`posted: ${postUrl}`);

    await updateContentPlanRow(p.row, { status: 'posted', post: p.text, postUrl });
    console.log(`row ${p.row} -> posted`);
  }

  await client.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
