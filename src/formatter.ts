import { callLLM } from './llm.ts';

const FORMAT_PROMPT = `Отформатируй пост для Telegram канала.
Правила форматирования:
- Заголовок: <b>текст</b>
- Ключевые цифры и факты: <b>текст</b>
- Блок-цитата: <blockquote>текст</blockquote>
- Эмодзи по смыслу:
  📊 — данные, цифры
  ⚡ — фича, быстрый результат
  📰 — новость
  ✅ — плюсы
  ⚠️ — риски
  💸 — деньги
Запрещено:
- Длинное тире (—), только запятая или точка
- Markdown (*, _), только HTML теги
- Лишние переносы строк
Верни ТОЛЬКО отформатированный текст, без комментариев.`;

export async function formatPost(rawPost: string): Promise<string> {
  return callLLM(`${FORMAT_PROMPT}\n\n${rawPost}`);
}
