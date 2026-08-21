// Уплотняем 3 слайда D-Format — было мало сообщений на слайд, много
// пустого места. Возвращаем более полный (ближе к дословному) текст и
// пакуем плотнее, оставляя 3 слайда.
import { renderCaseChatSlide, type CaseChatSlideOptions } from './caseChat.ts';
import { sendAlbumAsUser, disconnectMTProto } from './mtproto.ts';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';

const channel = process.env.POST_CHANNEL!;
const category = 'МАРКЕТИНГ';
const total = 3;
const OLD_IDS = [98, 99, 100];

const slides: CaseChatSlideOptions[] = [
  {
    category,
    stageTitle: 'Первый контакт',
    page: 1,
    total,
    messages: [
      { role: 'bot', text: 'Добрый день! Могу к вам обратиться?' },
      { role: 'client', text: 'Здравствуйте, чем могу быть полезен?' },
      { role: 'bot', text: 'Представляю агентство интернет-маркетинга полного цикла.' },
      { role: 'bot', text: 'Пишу потому, что помогаем бизнесу выстроить стабильный поток заявок из рекламы, и судя по вашему профилю, тема может быть актуальной. Разрешите поинтересоваться, как у вас сейчас приходят клиенты?' },
    ],
    resultTitle: 'Диалог начат',
    resultCopy: 'Собеседник ответил, представление и вопрос заданы.',
  },
  {
    category,
    stageTitle: 'Выявляем точку входа',
    page: 2,
    total,
    messages: [
      { role: 'client', text: 'По рекомендации' },
      { role: 'bot', text: 'Это сильная позиция, сарафан ломать незачем. Хочу уточнить: заявок хватает, или бывают периоды, когда загрузка неровная?' },
      { role: 'client', text: 'Бывает, что не ровная, давайте ближе к сути.' },
      { role: 'bot', text: 'Понял, коротко по сути. Мы выстраиваем маркетинг системой: оффер, сайт, реклама, аналитика, CRM. Когда сарафан упирается в потолок или загрузка проседает, реклама закрывает этот провал предсказуемым потоком заявок с понятной стоимостью.' },
    ],
    resultTitle: 'Найдена точка входа',
    resultCopy: 'Нестабильная загрузка — повод предложить решение.',
  },
  {
    category,
    stageTitle: 'Переходим к делу',
    page: 3,
    total,
    messages: [
      { role: 'bot', text: 'Предлагаю начать с бесплатного экспресс-аудита. Разберём вашу ситуацию, покажем, за счёт чего можно выровнять поток, и дадим конкретный план. Без оплаты и без обязательств. Интересно?' },
      { role: 'client', text: 'Давайте' },
      { role: 'bot', text: 'Отлично, передам вас нашему менеджеру — он проведёт аудит, разберёт ситуацию и пришлёт презентацию с кейсами и результатами клиентов.' },
    ],
    resultTitle: 'Квалифицирован как лид',
    resultCopy: 'Интерес подтверждён, диалог передан менеджеру.',
  },
];

async function main() {
  const session = process.env.TELEGRAM_SESSION!;
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH!;
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 3 });
  await client.connect();
  await client.deleteMessages(channel, OLD_IDS, { revoke: true });
  console.log(`deleted old album: ${OLD_IDS.join(', ')}`);
  await client.disconnect();

  const images = await Promise.all(slides.map((s) => renderCaseChatSlide(s)));
  await sendAlbumAsUser(channel, images);
  console.log(`posted denser case-chat album: ${images.length} slides`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnectMTProto());
