import { google, type sheets_v4 } from 'googleapis';

const SHEET_NAME = 'News';
const HEADER = ['Дата', 'Источник', 'Заголовок', 'Саммари', 'Пост', 'Ссылка', 'Рейтинг', 'Статус'];

export interface SheetRow {
  rowNumber: number;
  date: string;
  source: string;
  title: string;
  summary: string;
  post: string;
  link: string;
  rating: number;
  status: string;
}

function getClient(): sheets_v4.Sheets {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var missing');
  const creds = JSON.parse(raw);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

function getSheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error('GOOGLE_SHEET_ID env var missing');
  return id;
}

// Ширины колонок в пикселях: Дата, Источник, Заголовок, Саммари, Пост, Ссылка, Рейтинг, Статус
const COL_WIDTHS = [110, 90, 280, 420, 420, 320, 80, 90];

async function getSheetNumericId(sheets: sheets_v4.Sheets, spreadsheetId: string): Promise<number> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === SHEET_NAME);
  return sheet?.properties?.sheetId ?? 0;
}

async function formatColumns(sheets: sheets_v4.Sheets, spreadsheetId: string): Promise<void> {
  const sheetId = await getSheetNumericId(sheets, spreadsheetId);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        // Перенос текста для всего листа
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0 },
            cell: { userEnteredFormat: { wrapStrategy: 'WRAP' } },
            fields: 'userEnteredFormat.wrapStrategy',
          },
        },
        // Ширины колонок
        ...COL_WIDTHS.map((px, i) => ({
          updateDimensionProperties: {
            range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
            properties: { pixelSize: px },
            fields: 'pixelSize',
          },
        })),
      ],
    },
  });
}

export async function ensureHeader(): Promise<void> {
  const sheets = getClient();
  const spreadsheetId = getSheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A1:H1`,
  });
  const row = res.data.values?.[0] ?? [];
  if (row.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!A1:H1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADER] },
    });
  }
  await formatColumns(sheets, spreadsheetId);
}

export async function getAllRows(): Promise<SheetRow[]> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: `${SHEET_NAME}!A2:H`,
  });
  const rows = res.data.values ?? [];
  return rows.map((r, i) => ({
    rowNumber: i + 2,
    date: r[0] ?? '',
    source: r[1] ?? '',
    title: r[2] ?? '',
    summary: r[3] ?? '',
    post: r[4] ?? '',
    link: r[5] ?? '',
    rating: parseInt(r[6] ?? '0', 10),
    status: (r[7] ?? '').trim().toLowerCase(),
  }));
}

export async function appendPending(
  rows: Array<{ source: string; title: string; summary: string; link: string; rating: number }>,
): Promise<void> {
  if (rows.length === 0) return;
  const sheets = getClient();
  const now = new Date().toISOString().slice(0, 10);
  const values = rows.map((r) => [
    now,
    r.source,
    r.title,
    r.summary,
    '',
    r.link,
    String(r.rating),
    'pending',
  ]);
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: `${SHEET_NAME}!A:H`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}

export async function updateRow(
  rowNumber: number,
  patch: { post?: string; status?: string },
): Promise<void> {
  const sheets = getClient();
  const spreadsheetId = getSheetId();
  const data: sheets_v4.Schema$ValueRange[] = [];
  if (patch.post !== undefined) {
    data.push({ range: `${SHEET_NAME}!E${rowNumber}`, values: [[patch.post]] });
  }
  if (patch.status !== undefined) {
    data.push({ range: `${SHEET_NAME}!H${rowNumber}`, values: [[patch.status]] });
  }
  if (data.length === 0) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'RAW', data },
  });
}
