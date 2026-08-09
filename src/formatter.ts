// Форматирование поста в HTML для Telegram без LLM-вызова.
// Регулярные замены надёжнее — LLM срезал эмодзи и менял разметку.

export async function formatPost(raw: string): Promise<string> {
  let text = raw;

  // [QUOTE]...[/QUOTE] → <blockquote>
  text = text.replace(/\[QUOTE\]([\s\S]*?)\[\/QUOTE\]/g, (_, inner) =>
    `<blockquote>${inner.trim()}</blockquote>`
  );

  // `цифра или текст` → <b>
  text = text.replace(/`([^`]+)`/g, '<b>$1</b>');

  // Первая строка (заголовок) → <b>
  text = text.replace(/^(.+)$/m, '<b>$1</b>');

  return text;
}
