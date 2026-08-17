import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });
const spreadsheetId = process.env.GOOGLE_SHEET_ID!;

// row 4 = Анкрайт (046b6786...), row 5 = D-Format (99eb4410...)
const updates = [
  { row: 4, data: { withPhoto: false, niche: 'транспортная компания (грузоперевозки автотранспортом по России)' } },
  { row: 5, data: { niche: 'агентство интернет-маркетинга (перформанс-реклама под ключ)' } },
];

for (const u of updates) {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `ContentPlan!E${u.row}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[JSON.stringify(u.data)]] },
  });
  console.log(`row ${u.row} -> ${JSON.stringify(u.data)}`);
}
