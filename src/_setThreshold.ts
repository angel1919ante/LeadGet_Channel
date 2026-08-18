import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

async function main() {
  const before = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Preferences!I2' });
  console.log(`before: ${before.data.values?.[0]?.[0]}`);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: 'Preferences!I2',
    valueInputOption: 'RAW',
    requestBody: { values: [['4']] },
  });

  const after = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Preferences!I2' });
  console.log(`after: ${after.data.values?.[0]?.[0]}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
