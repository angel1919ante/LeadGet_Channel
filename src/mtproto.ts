import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { CustomFile } from 'telegram/client/uploads.js';

let _client: TelegramClient | null = null;

async function getClient(): Promise<TelegramClient> {
  if (_client?.connected) return _client;

  const session = process.env.TELEGRAM_SESSION;
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH;
  if (!session || !apiId || !apiHash) {
    throw new Error('TELEGRAM_SESSION / TELEGRAM_API_ID / TELEGRAM_API_HASH env vars missing');
  }

  _client = new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 3,
  });
  await _client.connect();
  return _client;
}

// Постит текст в канал от имени пользователя (не бота).
// HTML-форматирование полное: blockquote, custom emoji, bold и т.д.
// Возвращает id отправленного сообщения — нужен для ссылки на пост.
export async function postAsUser(channelId: string, htmlText: string): Promise<number> {
  const client = await getClient();
  const msg = await client.sendMessage(channelId, {
    message: htmlText,
    parseMode: 'html',
  });
  return msg.id;
}

// Постит фото + подпись в канал от имени пользователя.
// photo — URL строкой (Replicate и т.п.) или готовый Buffer (например из caseBoard.ts).
export async function sendPhotoAsUser(channelId: string, photo: string | Buffer, captionHtml: string): Promise<number> {
  const client = await getClient();
  const file = Buffer.isBuffer(photo) ? new CustomFile('photo.png', photo.length, '', photo) : photo;
  const msg = await client.sendFile(channelId, {
    file,
    caption: captionHtml,
    parseMode: 'html',
  });
  return msg.id;
}

// Читает последние N сообщений из канала. username — без @.
export async function fetchTelegramChannel(
  username: string,
  limit = 30,
): Promise<Array<{ id: number; text: string; date: number }>> {
  const client = await getClient();
  const messages = await client.getMessages(username, { limit });
  return messages
    .filter((m) => m.text && m.text.length > 50)
    .map((m) => ({ id: m.id, text: m.text, date: m.date }));
}

export async function disconnectMTProto(): Promise<void> {
  if (_client) {
    await _client.disconnect();
    _client = null;
  }
}
