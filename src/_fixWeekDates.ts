import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

async function main() {
  const row = 6; // "Подключиться к диалогу"
  const data = {
    problem: 'Чтобы ответить лиду лично, нужно было выходить в Telegram со своего аккаунта. Лид видел смену контакта, менеджер терял всю переписку из виду, а бот мог ответить одновременно с человеком.',
    description: 'Менеджер подключается к диалогу прямо на дэшборде LeadGet, не открывая Telegram. ИИ-ассистент сразу замолкает, диалог продолжается от того же бот-аккаунта, лид не замечает подмены. Вся история переписки остаётся перед глазами, подключение происходит автоматически без настроек.',
  };
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `ContentPlan!E${row}:F${row}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[JSON.stringify(data), 'approved']] },
  });
  console.log(`row ${row}: Данные заполнены, status -> approved`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
