async function sendMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_USER_ID;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN env var missing');
  if (!chat) throw new Error('TELEGRAM_USER_ID env var missing');

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chat,
      text,
      disable_web_page_preview: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram ${res.status}: ${err}`);
  }
}

export async function postToChannel(text: string): Promise<void> {
  await sendMessage(text);
}

// Постит фото с подписью в произвольный канал через Bot API.
// Требует, чтобы бот был администратором канала.
export async function sendPhotoToChannel(
  channelId: string,
  photoUrl: string,
  captionHtml: string,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN env var missing');

  // Telegram caption limit is 1024 chars — send text separately if longer.
  const CAPTION_LIMIT = 1000;
  const caption = captionHtml.length <= CAPTION_LIMIT ? captionHtml : undefined;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: channelId,
      photo: photoUrl,
      caption,
      parse_mode: caption ? 'HTML' : undefined,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram sendPhoto ${res.status}: ${err}`);
  }

  if (!caption) {
    const textRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: channelId,
        text: captionHtml,
        parse_mode: 'HTML',
      }),
    });
    if (!textRes.ok) {
      const err = await textRes.text();
      throw new Error(`Telegram sendMessage ${textRes.status}: ${err}`);
    }
  }
}

// Telegram limit is 4096 chars; leave headroom for the part header.
const TG_LIMIT = 3900;

// Отправляет длинный текст в личку, разбивая на части по лимиту Telegram.
export async function sendLong(header: string, body: string): Promise<void> {
  const full = `${header}\n\n${body}`;
  if (full.length <= TG_LIMIT) {
    await sendMessage(full);
    return;
  }
  const chunks: string[] = [];
  for (let i = 0; i < body.length; i += TG_LIMIT) {
    chunks.push(body.slice(i, i + TG_LIMIT));
  }
  for (let i = 0; i < chunks.length; i++) {
    const partHeader = `${header} (часть ${i + 1}/${chunks.length})`;
    await sendMessage(`${partHeader}\n\n${chunks[i]}`);
  }
}
