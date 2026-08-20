// Разовый скрипт: реальные (анонимизированные) слайды переписки для кейса
// D-Format — на основе транскрипта, который прислал пользователь.
// Имя менеджера (Жулдыз), название компании (D-Format) и ссылка на
// менеджера убраны/обобщены.
import { renderCaseChatSlide, type CaseChatSlideOptions } from './caseChat.ts';
import { sendAlbumAsUser, disconnectMTProto } from './mtproto.ts';

const channel = process.env.POST_CHANNEL!;
const category = 'МАРКЕТИНГ';
const total = 4;

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
  const images = await Promise.all(slides.map((s) => renderCaseChatSlide(s)));
  await sendAlbumAsUser(channel, images);
  console.log(`posted real case-chat album: ${images.length} slides`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnectMTProto());
