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
    summaryOverride: { sent: 3212, read: 2521, replied: 1728, engaged: 507, leads: 183, disqualified: 0 },
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
