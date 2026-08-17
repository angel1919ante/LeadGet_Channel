import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });
const spreadsheetId = process.env.GOOGLE_SHEET_ID!;

const meta = await sheets.spreadsheets.get({ spreadsheetId });
const cpSheet = meta.data.sheets?.find((s) => s.properties?.title === 'ContentPlan');
const cpSheetId = cpSheet?.properties?.sheetId ?? 0;

// Удаляем строку 4 (Транскрибация голосовых, 17.08, error — дубль уже опубликованной фичи)
await sheets.spreadsheets.batchUpdate({
  spreadsheetId,
  requestBody: {
    requests: [{ deleteDimension: { range: { sheetId: cpSheetId, dimension: 'ROWS', startIndex: 3, endIndex: 4 } } }],
  },
});
console.log('deleted ContentPlan row 4 (Транскрибация голосовых)');

// Добавляем обе уже опубликованные фичи в Features как историю (status=posted)
await sheets.spreadsheets.values.append({
  spreadsheetId,
  range: 'Features!A:E',
  valueInputOption: 'RAW',
  requestBody: {
    values: [
      [
        '2026-08-09',
        'Транскрибация голосовых',
        'Лиды отвечают голосовыми, менеджеры тратят часы на прослушивание. Каждое сообщение — пауза, перемотка, повтор.',
        'LeadGet автоматически расшифровывает голосовые сообщения от лидов в текст прямо в диалоге. Менеджер видит готовый текст рядом с аудиофайлом, может искать по тексту вместо перемотки записи. Работает без настроек, включается автоматически для всех входящих голосовых.',
        'posted',
      ],
      [
        '2026-08-11',
        'Подключиться к диалогу',
        'Чтобы ответить лиду лично, нужно было выходить в Telegram со своего аккаунта. Лид видел смену контакта, менеджер терял всю переписку из виду, а бот мог ответить одновременно с человеком.',
        'Менеджер подключается к диалогу прямо на дэшборде LeadGet, не открывая Telegram. ИИ-ассистент сразу замолкает, диалог продолжается от того же бот-аккаунта, лид не замечает подмены. Вся история переписки остаётся перед глазами, подключение происходит автоматически без настроек.',
        'posted',
      ],
    ],
  },
});
console.log('added 2 historical features (posted)');
