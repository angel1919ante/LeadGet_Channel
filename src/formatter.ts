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
// и не являющимся URL — чтобы не сломать автоссылку и не получить
// вложенные теги на уже выделенных кусках.
function replaceOutsideBold(text: string, re: RegExp, replacer: (s: string) => string): string {
  return text
    .split(/(<b>[\s\S]*?<\/b>|https?:\/\/\S+)/g)
    .map((chunk) => (chunk.startsWith('<b>') || chunk.startsWith('http') ? chunk : chunk.replace(re, (m) => replacer(m))))
    .join('');
}

// Построчно, а не regex-цепочкой — иначе шаг "добавить пропуск перед первым
// буллетом" срабатывает и между соседними буллетами тоже (последний символ
// строки буллета почти всегда не '•' и не '\n', regex не отличит это от
// обычного текста). Здесь смотрим на предыдущую СТРОКУ целиком.
function tightenBulletSpacing(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBullet = line.startsWith('•');
    const prev = out[out.length - 1];
    // Пропуск между двумя буллетами — убираем, только если он реально между ними
    // (следующая непустая строка тоже буллет), иначе это законный отступ после списка.
    if (line === '' && prev?.startsWith('•')) {
      const next = lines[i + 1];
      if (next?.startsWith('•')) continue;
    }
    if (isBullet && prev !== undefined && prev !== '' && !prev.startsWith('•')) out.push(''); // пропуск перед первым буллетом — добавляем
    if (!isBullet && line !== '' && prev?.startsWith('•')) out.push(''); // и пропуск после последнего буллета — уходим из списка
    out.push(line);
  }
  return out.join('\n');
}

// Модель иногда забывает пустую строку между двумя соседними абзацами
// (COMMON_BANS требует ровно один абзац на блок — переносов внутри блока
// быть не должно, значит любой "голый" \n между двумя непустыми
// не-буллет строками — это пропущенный разрыв абзаца, а не намеренный).
// Буллеты не трогаем — они соседствуют друг с другом намеренно.
function enforceParagraphBreaks(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    if (line !== '' && prev !== undefined && prev !== '' && !line.startsWith('•') && !prev.startsWith('•')) {
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

  // `цифра или текст` → <b> — то, что модель сама пометила
  text = text.replace(/`([^`]+)`/g, '<b>$1</b>');

  // Первая строка (заголовок) → <b>
  text = text.replace(/^(.+)$/m, '<b>$1</b>');

  // Подстраховка: модель иногда забывает обернуть цифры в backtick —
  // жирним оставшиеся числа/проценты/диапазоны, которые ещё не выделены.
  text = replaceOutsideBold(text, /\b\d[\d\s]*(?:[-–]\d[\d\s]*)?%?\b/g, (m) => `<b>${m}</b>`);

  // Ник в Telegram (@username) — тоже жирным
  text = replaceOutsideBold(text, /@\w+/g, (m) => `<b>${m}</b>`);

  // Схлопываем 3+ переноса подряд до одной пустой строки — модель иногда
  // ставит двойные отступы между абзацами.
  text = text.replace(/\n{3,}/g, '\n\n');

  // Пропущенный разрыв абзаца — до того, как трогаем буллеты, чтобы не
  // спутать список с обычным текстом.
  text = enforceParagraphBreaks(text);

  // Буллеты одного списка — без пустых строк между ними; пропуск остаётся
  // только перед первым буллетом и сразу после списка, отделяя его от
  // обычного текста.
  text = tightenBulletSpacing(text);

  // Подзаголовки блоков ("⚙️ Что сделали?", "↗️ Итоги за 14 дней:") — жирным.
  text = boldSubheaders(text);

  // Анимированные эмодзи
  text = animateEmoji(text);

  return text;
}
