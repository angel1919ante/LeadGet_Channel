// Повторная публикация слайдов переписки D-Format — старый альбом (id
// 67-70) визуально потерялся в ленте из-за многократных перевыкладок
// текстового поста. Удаляем старый, публикуем свежий сразу после
// актуального кейс-поста (93). Контент тот же — реальный анонимизированный
// транскрипт от пользователя.
import { renderCaseChatSlide, type CaseChatSlideOptions } from './caseChat.ts';
import { sendAlbumAsUser, disconnectMTProto } from './mtproto.ts';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';

const channel = process.env.POST_CHANNEL!;
const category = 'МАРКЕТИНГ';
const total = 4;
const OLD_IDS = [67, 68, 69, 70];

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
    ],
    resultTitle: 'Диалог начат',
    resultCopy: 'Собеседник ответил и представился.',
  },
  {
    category,
    stageTitle: 'Выявляем интерес',
    page: 2,
    total,
    messages: [
      { role: 'bot', text: 'Пишу потому, что помогаем бизнесу выстроить стабильный поток заявок из рекламы, и судя по вашему профилю, тема может быть актуальной.' },
      { role: 'bot', text: 'Разрешите поинтересоваться, как у вас сейчас приходят клиенты?' },
      { role: 'client', text: 'По рекомендации' },
    ],
    resultTitle: 'Выявлен канал трафика',
    resultCopy: 'Собеседник назвал текущий источник клиентов.',
  },
  {
    category,
    stageTitle: 'Уточняем ситуацию',
    page: 3,
    total,
    messages: [
      { role: 'bot', text: 'Это сильная позиция, сарафан ломать незачем.' },
      { role: 'bot', text: 'Хочу уточнить: заявок хватает, или бывают периоды, когда загрузка неровная?' },
      { role: 'client', text: 'Бывает, что не ровная, давайте ближе к сути.' },
    ],
    resultTitle: 'Найдена точка входа',
    resultCopy: 'Нестабильная загрузка — повод предложить решение.',
  },
  {
    category,
    stageTitle: 'Переходим к делу',
    page: 4,
    total,
    messages: [
      { role: 'bot', text: 'Мы выстраиваем маркетинг системой: оффер, сайт, реклама, аналитика, CRM — когда сарафан упирается в потолок, реклама закрывает провал предсказуемым потоком заявок. Предлагаю бесплатный экспресс-аудит: разберём ситуацию и дадим конкретный план, без оплаты и обязательств. Интересно?' },
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
  console.log(`posted fresh case-chat album: ${images.length} slides`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnectMTProto());
