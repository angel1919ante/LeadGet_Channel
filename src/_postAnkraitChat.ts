// Разовый скрипт: реальные (анонимизированные) слайды переписки для кейса
// Анкрайт — на основе транскрипта, который прислал пользователь, а не
// придуманного LLM диалога. Компания, ФИО менеджера, ИНН, Telegram-ссылка
// и названия клиентов (НЛМК/Мостотряд/Детский мир) убраны или обобщены.
import { renderCaseChatSlide, type CaseChatSlideOptions } from './caseChat.ts';
import { sendAlbumAsUser, disconnectMTProto } from './mtproto.ts';

const channel = process.env.POST_CHANNEL!;
const category = 'ЛОГИСТИКА';

const slides: CaseChatSlideOptions[] = [
  {
    category,
    stageTitle: 'Первый контакт',
    page: 1,
    total: 4,
    messages: [
      { role: 'bot', text: 'Добрый день)' },
      { role: 'bot', text: 'Могу обратиться?' },
      { role: 'bot', text: 'Представляю транспортную компанию, занимаемся грузоперевозками по всей России.' },
      { role: 'bot', text: 'Вижу, что вы работаете с керамогранитом — это отгрузки, доставки, поиск транспорта. Как сейчас закрываете перевозки: есть постоянный подрядчик или ищете под каждую задачу отдельно?' },
    ],
    resultTitle: 'Диалог начат',
    resultCopy: 'Собеседник вовлечён и задаёт предметный вопрос.',
  },
  {
    category,
    stageTitle: 'Выявляем интерес',
    page: 2,
    total: 4,
    messages: [
      { role: 'client', text: 'ИНН?' },
      { role: 'client', text: 'Что за компания?' },
      { role: 'bot', text: 'Более 10 лет занимаемся автомобильными грузоперевозками по России. Шторные полуприцепы до 25 тонн, бортовые и траллы под нестандартные грузы. Свой автопарк и проверенные партнёры — больше 100 единиц техники.' },
      { role: 'bot', text: 'ИНН уточню и передам, либо сразу свяжу вас с менеджером.' },
    ],
    resultTitle: 'Интерес подтверждён',
    resultCopy: 'Собеседник узнал условия и продолжил диалог.',
  },
  {
    category,
    stageTitle: 'Уточняем задачу',
    page: 3,
    total: 4,
    messages: [
      { role: 'bot', text: 'Среди клиентов — крупные производственные и ритейл-компании. Работаем без посредников, поэтому и по цене выходит интереснее, и по срокам надёжнее.' },
      { role: 'bot', text: 'Вы сейчас перевозками занимаетесь сами, или есть кто-то, кто это закрывает?' },
      { role: 'client', text: 'Есть сейчас потребность в боковой погрузке с Оренбурга на Москву' },
      { role: 'client', text: 'Готов платить 80 000 за машину' },
    ],
    resultTitle: 'Потребность выявлена',
    resultCopy: 'Запрос и контекст для следующего шага понятны.',
  },
  {
    category,
    stageTitle: 'Передаём менеджеру',
    page: 4,
    total: 4,
    messages: [
      { role: 'bot', text: 'Хорошее направление, Оренбург — Москва возим.' },
      { role: 'bot', text: 'По цене скажу честно: 80 000 за шторник на этом маршруте сейчас ниже рынка, реальная ставка будет повыше. Точную цифру лучше считать под конкретный груз и даты.' },
      { role: 'bot', text: 'Передам вас нашему менеджеру, он быстро посчитает и скажет как есть.' },
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
