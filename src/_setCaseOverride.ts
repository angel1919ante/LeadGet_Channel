import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

async function main() {
  const row = 4; // Анкрайт
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `ContentPlan!E${row}`,
  });
  const current = res.data.values?.[0]?.[0] ? JSON.parse(res.data.values[0][0]) : {};
  const updated = {
    ...current,
    // Было перепутано направление: Анкрайт сам перевозчик и искал ЗАКАЗЫ
    // (клиентов с грузами), а не подрядчиков-перевозчиков себе в помощь.
    task: 'поиск клиентов с грузами под конкретные машины (в т.ч. боковая погрузка), а не разовых заказов через биржу',
    mechanics: 'рассылка по базе логистических и грузовладельческих контактов, квалификация через уточняющие вопросы о маршруте, типе кузова и бюджете, передача тёплого диалога менеджеру',
  };
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `ContentPlan!E${row}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[JSON.stringify(updated)]] },
  });
  console.log(`row ${row} -> ${JSON.stringify(updated)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
