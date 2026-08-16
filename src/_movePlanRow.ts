import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });
await sheets.spreadsheets.values.update({
  spreadsheetId: process.env.GOOGLE_SHEET_ID!,
  range: 'ContentPlan!A6',
  valueInputOption: 'RAW',
  requestBody: { values: [['22.08.2026']] },
});
console.log('moved row 6 to 22.08.2026');
