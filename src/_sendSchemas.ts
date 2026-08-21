// Схематичные примеры трёх шаблонов (новость/фича/кейс) с плейсхолдерами
// вместо реального текста — чтобы наглядно показать структуру и эмодзи.
// Шлём в личку боту (TELEGRAM_BOT_TOKEN/TELEGRAM_USER_ID), не в канал.
import { formatPost } from './formatter.ts';

const NEWS_RAW = `🔔 Вот тут заголовок новости, цепляет читателя лично

Вот тут находится описание новости на два предложения: что случилось, какие цифры, откуда источник.

📊 Что изменилось конкретно
• Пункт 1 эмодзи
• Пункт 2 эмодзи
• Пункт 3 эмодзи

⚠️ Вывод, что это значит для рынка/МСП, одно-два предложения

[QUOTE]Вот тут ключевой факт отдельным блоком-цитатой[/QUOTE]

ℹ️ Вот тут позиция LeadGet: 2-4 предложения, цифры, механика, результат

Мягкий вопрос-CTA. Напишите менеджеру @LeadGet_info 📱, что сделаем вместе.

Источник: вот тут ссылка`;

const FEATURE_RAW = `⚡️ Вот тут заголовок в формате "Теперь можно X"

Вот тут находится описание проблемы на два предложения: что раньше не работало или было неудобно.

⚙️ Что изменилось:
• Пункт 1 эмодзи
• Пункт 2 эмодзи
• Пункт 3 эмодзи

[QUOTE]Раньше: вот тут одной фразой, что было плохо[/QUOTE]
[QUOTE]Теперь: вот тут одной фразой, что стало[/QUOTE]

✅ Результат:
Вот тут 1-2 предложения, что это даёт на практике.

Вот тут дополнительный абзац: когда это особенно полезно, конкретный сценарий.

Попробуйте эту фичу. Напишите менеджеру @LeadGet_info 📱, подключим.`;

const CASE_RAW = `📊 Кейс: вот тут ниша или тип задачи

Вот тут находится описание кампании на два предложения: что за ниша/продукт и какая была задача.

💡 База: вот тут какой сегмент аудитории

⚙️ Что сделали?
• Действие 1 эмодзи
• Действие 2 эмодзи
• Действие 3 эмодзи
• Действие 4 эмодзи

↗️ Итоги за период:
[STACK]\`X\` сообщений отправлено
\`X\` прочитали: (X%)
\`X\` ответили: (X%)
\`X\` диалогов: (X%)
\`X\` квалифицированных лида (X%)[/STACK]

Вот тут вывод: почему это дешевле/эффективнее традиционных каналов.

✉️ Если вы в похожей нише, напишите менеджеру @LeadGet_info 📱.`;

async function sendHtml(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_USER_ID;
  if (!token || !chat) throw new Error('TELEGRAM_BOT_TOKEN/TELEGRAM_USER_ID env var missing');
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML' }),
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`);
}

async function main() {
  for (const [label, raw] of [['НОВОСТЬ', NEWS_RAW], ['ФИЧА', FEATURE_RAW], ['КЕЙС', CASE_RAW]] as const) {
    const formatted = await formatPost(raw);
    await sendHtml(`<b>— схема: ${label} —</b>\n\n${formatted}`);
    console.log(`sent: ${label}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
