import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';

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
export async function postAsUser(channelId: string, htmlText: string): Promise<void> {
  const client = await getClient();
  await client.sendMessage(channelId, {
    message: htmlText,
    parseMode: 'html',
  });
}

// Постит фото + подпись в канал от имени пользователя.
export async function sendPhotoAsUser(channelId: string, photoUrl: string, captionHtml: string): Promise<void> {
  const client = await getClient();
  await client.sendFile(channelId, {
    file: photoUrl,
    caption: captionHtml,
    parseMode: 'html',
  });
}

export async function disconnectMTProto(): Promise<void> {
  if (_client) {
    await _client.disconnect();
    _client = null;
  }
}
