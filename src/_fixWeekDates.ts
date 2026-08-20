import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

async function main() {
  // Строка 5 = кейс D-Format, стоял на субботу (22.08) — по новой схеме
  // Пн/Ср/Пт/Вс переносим на воскресенье (23.08), чтобы неделя 17-23.08
  // соответствовала фиксированным дням хотя бы там, где ещё не опубликовано.
  const row = 5;
  const before = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `ContentPlan!A${row}` });
  console.log(`before: ${before.data.values?.[0]?.[0]}`);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `ContentPlan!A${row}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['23.08.2026']] },
  });

  const after = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `ContentPlan!A${row}` });
  console.log(`after: ${after.data.values?.[0]?.[0]}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
