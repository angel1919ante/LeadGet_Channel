import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

const PROBLEM = 'Вложения, которые присылал лид — фото, видео, видео-кружки, документы, голосовые сообщения — в дэшборде отображались просто как текст-заглушка вроде «[фото]» или «[видео]». Менеджер не видел, что именно прислал клиент, и не мог посмотреть или скачать файл, не открывая Telegram.';
const DESCRIPTION = 'Теперь любое вложение от лида открывается прямо в дэшборде LeadGet: фото и видео можно посмотреть, видео-кружки и голосовые — прослушать, документы — скачать. Всё без переключения в Telegram.';
const TITLE = 'Просмотр вложений от лида в дэшборде';

async function main() {
  // Features!C4:E4 — problem, description, title (заодно обновим заголовок под расширенный список).
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: 'Features!B4:D4',
    valueInputOption: 'RAW',
    requestBody: { values: [[TITLE, PROBLEM, DESCRIPTION]] },
  });
  console.log('Features row 4 обновлён');

  // ContentPlan row 15 (26.08.2026) — новость -> фича с этими данными.
  const data = JSON.stringify({ problem: PROBLEM, description: DESCRIPTION });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: 'ContentPlan!B15:E15',
    valueInputOption: 'RAW',
    requestBody: { values: [['фича', TITLE, '', data]] },
  });
  console.log('ContentPlan row 15 -> фича:', TITLE);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
