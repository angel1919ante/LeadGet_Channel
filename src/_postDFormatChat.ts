// Сжимаем альбом переписки D-Format с 4 до 3 слайдов — было много пустого
// места. Соседние реплики одной стороны объединены в один bubble, контент
// тот же (реальный анонимизированный транскрипт), просто короче на слайд.
import { renderCaseChatSlide, type CaseChatSlideOptions } from './caseChat.ts';
import { sendAlbumAsUser, disconnectMTProto } from './mtproto.ts';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';

const channel = process.env.POST_CHANNEL!;
const category = 'МАРКЕТИНГ';
const total = 3;
const OLD_IDS = [94, 95, 96, 97];

const slides: CaseChatSlideOptions[] = [
  {
    category,
    stageTitle: 'Первый контакт',
    page: 1,
    total,
    messages: [
      { role: 'bot', text: 'Добрый день! Могу к вам обратиться?' },
      { role: 'client', text: 'Здравствуйте, чем могу быть полезен?' },
      { role: 'bot', text: 'Представляю агентство интернет-маркетинга полного цикла. Помогаем бизнесу выстроить стабильный поток заявок из рекламы — судя по вашему профилю, тема может быть актуальной. Как у вас сейчас приходят клиенты?' },
      { role: 'client', text: 'По рекомендации' },
    ],
    resultTitle: 'Диалог начат',
    resultCopy: 'Собеседник ответил и назвал текущий источник клиентов.',
  },
  {
    category,
    stageTitle: 'Выявляем точку входа',
    page: 2,
    total,
    messages: [
      { role: 'bot', text: 'Это сильная позиция, сарафан ломать незачем. Хочу уточнить: заявок хватает, или бывают периоды, когда загрузка неровная?' },
      { role: 'client', text: 'Бывает, что не ровная, давайте ближе к сути.' },
      { role: 'bot', text: 'Мы выстраиваем маркетинг системой: оффер, сайт, реклама, аналитика, CRM — когда сарафан упирается в потолок, реклама закрывает провал предсказуемым потоком заявок.' },
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
      { role: 'bot', text: 'Предлагаю бесплатный экспресс-аудит: разберём ситуацию и дадим конкретный план, без оплаты и обязательств. Интересно?' },
      { role: 'client', text: 'Давайте' },
      { role: 'bot', text: 'Отлично, передам вас нашему менеджеру — он проведёт аудит, разберёт ситуацию и пришлёт презентацию с кейсами.' },
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
  console.log(`posted compact case-chat album: ${images.length} slides`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnectMTProto());
