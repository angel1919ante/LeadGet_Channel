import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

async function main() {
  // Строка 10 — новость с четверга (20.08, вне схемы Пн/Ср/Пт/Вс), уже
  // удалена из канала. Пт (21.08) и Вс (23.08) этой недели заняты
  // фичей и кейсом, поэтому переносим на ближайший свободный
  // фиксированный день — понедельник следующей недели.
  const row = 10;
  const before = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `ContentPlan!A${row}` });
  console.log(`before: ${before.data.values?.[0]?.[0]}`);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `ContentPlan!A${row}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['24.08.2026']] },
  });

  const after = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `ContentPlan!A${row}` });
  console.log(`after: ${after.data.values?.[0]?.[0]}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
