// Форматирование поста в HTML для Telegram без LLM-вызова.
// Регулярные замены надёжнее — LLM срезал эмодзи и менял разметку.

// Маппинг из паков NewsEmoji + FinanceEmoji
const ANIMATED: Record<string, string> = {
  '🔔': '5458603043203327669',
  '📊': '5231200819986047254',
  '⚠️': '5447644880824181073',
  '✔️': '5206607081334906820',
  '💸': '5233326571099534068',
  '⚡️': '5456140674028019486',
  '⚡': '5456140674028019486',
  '💡': '5422439311196834318',
  'ℹ️': '5334544901428229844',
  '🛍': '5229064374403998351',
  '💎': '5427168083074628963',
  '📌': '5397782960512444700',
  '🎙': '5294339927318739359',
  '⭐️': '5438496463044752972',
  '⚙️': '5341715473882955310',
  '📈': '5244837092042750681',
  '✉️': '5253742260054409879',
  '🔥': '5424972470023104089',
  '↗️': '5429651785352501917',
  '💰': '5287231198098117669',
  '🚀': '5195033767969839232',
  '📱': '5330237710655306682',  // ApplicationEmoji #27
  '📉': '5246762912428603768',
  '🔴': '5411225014148014586',
  '🟢': '5416081784641168838',
  '💯': '5341498088408234504',
};

// Заменяем emoji → <tg-emoji emoji-id="...">emoji</tg-emoji>.
// Один regex-проход, не цепочка split/join — иначе '⚡' внутри уже
// обёрнутого '⚡️' обрачивается второй раз (вложенные теги). Длинные
// (многокодовые) идут первыми в альтернации, чтобы совпадали раньше.
function animateEmoji(text: string): string {
  const entries = Object.entries(ANIMATED).sort((a, b) => b[0].length - a[0].length);
  const pattern = new RegExp(entries.map(([e]) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  return text.replace(pattern, (m) => `<tg-emoji emoji-id="${ANIMATED[m]}">${m}</tg-emoji>`);
}

// Применяет regex-замену только к частям текста, ещё не обёрнутым в <b>
// или <code>, не являющимся URL, и не проценту в скобках вида "(78.5%)" —
// по эталону это вспомогательное число рядом с жирным/моноширинным, само
// остаётся обычным текстом. Иначе получаем вложенные теги / раздробленный
// "78" "." "5" "%".
function replaceOutsideBold(text: string, re: RegExp, replacer: (s: string) => string): string {
  return text
    .split(/(<b>[\s\S]*?<\/b>|<code>[\s\S]*?<\/code>|https?:\/\/\S+|\([\d.,]+%\))/g)
    .map((chunk) => (chunk.startsWith('<b>') || chunk.startsWith('<code>') || chunk.startsWith('http') || /^\([\d.,]+%\)$/.test(chunk) ? chunk : chunk.replace(re, (m) => replacer(m))))
    .join('');
}

// Эталон форматирования (зафиксирован пользователем): пропуск между КАЖДОЙ
// парой соседних непустых строк — буллеты в том числе, они такой же
// самостоятельный абзац, как и обычный текст. Содержимое <blockquote> и
// [STACK]...[/STACK] (статистика кейса — caseGen.ts) не трогаем: строки
// цифр там нарочно идут пачкой, без пропусков.
function enforceParagraphBreaks(text: string): string {
  return text
    .split(/(<blockquote>[\s\S]*?<\/blockquote>|\[STACK\][\s\S]*?\[\/STACK\])/g)
    .map((chunk) => (chunk.startsWith('<blockquote>') || chunk.startsWith('[STACK]') ? chunk : addMissingBreaks(chunk)))
    .join('');
}

function addMissingBreaks(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    if (line !== '' && prev !== undefined && prev !== '') {
      out.push('');
    }
    out.push(line);
  }
  return out.join('\n');
}

// Заголовок блока — короткая строка вида "⚙️ Что сделали?" / "↗️ Итоги за 14 дней:".
// Модель их бэктиками не выделяет (это не цифра), поэтому жирним отдельно:
// строка начинается с разрешённого эмодзи и заканчивается на ":" или "?".
function boldSubheaders(text: string): string {
  const emojis = Object.keys(ANIMATED);
  return text
    .split('\n')
    .map((line, i) => {
      if (i === 0) return line; // заголовок поста уже жирнится отдельно
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('•')) return line;
      if (!emojis.some((e) => trimmed.startsWith(e))) return line;
      if (!/[:?]$/.test(trimmed)) return line;
      const plain = trimmed.replace(/<[^>]+>/g, '');
      if (plain.length > 60) return line;
      return `<b>${line.replace(/<\/?b>/g, '')}</b>`;
    })
    .join('\n');
}

export async function formatPost(raw: string): Promise<string> {
  let text = raw;

  // [QUOTE]...[/QUOTE] → <blockquote>
  text = text.replace(/\[QUOTE\]([\s\S]*?)\[\/QUOTE\]/g, (_, inner) =>
    `<blockquote>${inner.trim()}</blockquote>`
  );

  // "💡 База:" в кейс-постах — само слово "База" жирным (эмодзи-заголовок
  // короче обычного subheader'а: с контентом на той же строке).
  text = text.replace(/(^|\n)(💡\s*)База:/g, '$1$2<b>База</b>:');

  // `цифра или текст` → <b> — то, что модель сама пометила
  text = text.replace(/`([^`]+)`/g, '<b>$1</b>');

  // Модель иногда вместо backtick использует markdown **текст** — тоже
  // жирним, а не оставляем звёздочки буквально в посте.
  text = text.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

  // Первая строка (заголовок) → <b>, если ещё не обёрнута целиком (иначе
  // получим вложенные <b><b>...</b></b> — например, когда модель уже
  // написала заголовок markdown'ом **...** и его сняли строкой выше).
  text = text.replace(/^(.+)$/m, (line) =>
    /^<b>.*<\/b>$/.test(line) ? line : `<b>${line}</b>`
  );

  // Подстраховка: модель иногда забывает обернуть цифры в backtick —
  // жирним оставшиеся числа/проценты/диапазоны, которые ещё не выделены.
  text = replaceOutsideBold(text, /\b\d[\d\s]*(?:[-–]\d[\d\s]*)?%?\b/g, (m) => `<b>${m}</b>`);

  // Ник в Telegram (@username) — тоже жирным
  text = replaceOutsideBold(text, /@\w+/g, (m) => `<b>${m}</b>`);

  // Схлопываем 3+ переноса подряд до одной пустой строки — модель иногда
  // ставит двойные отступы между абзацами.
  text = text.replace(/\n{3,}/g, '\n\n');

  // Пропуск между каждой парой соседних непустых строк (включая буллеты).
  text = enforceParagraphBreaks(text);

  // [STACK]...[/STACK] защитил статистику кейса от пропусков выше — снимаем
  // служебные маркеры, сам текст остаётся как есть (без блок-цитаты).
  text = text.replace(/\[STACK\]([\s\S]*?)\[\/STACK\]/g, (_, inner) => inner.trim());

  // Подзаголовки блоков ("⚙️ Что сделали?", "↗️ Итоги за 14 дней:") — жирным.
  text = boldSubheaders(text);

  // Анимированные эмодзи
  text = animateEmoji(text);

  return text;
}
