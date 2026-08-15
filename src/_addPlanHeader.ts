import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });
await sheets.spreadsheets.values.update({
  spreadsheetId: process.env.GOOGLE_SHEET_ID!,
  range: 'ContentPlan!H1',
  valueInputOption: 'RAW',
  requestBody: { values: [['Ссылка']] },
});
console.log('header set');
