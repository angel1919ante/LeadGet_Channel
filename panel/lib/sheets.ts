import { google, type sheets_v4 } from 'googleapis';

const NEWS_SHEET = 'News';
const CP_SHEET = 'ContentPlan';
const CASES_SHEET = 'Cases';
const FEAT_SHEET = 'Features';
const PREF_SHEET = 'Preferences';
const ART_SHEET = 'Articles';

function getClient(): sheets_v4.Sheets {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var missing');
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

function getSheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error('GOOGLE_SHEET_ID env var missing');
  return id;
}

export interface NewsRow {
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

export async function getNewsRows(): Promise<NewsRow[]> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: `${NEWS_SHEET}!A2:I`,
  });
  return (res.data.values ?? []).map((r, i) => ({
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

export async function setNewsStatus(rowNumber: number, status: string): Promise<void> {
  const sheets = getClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range: `${NEWS_SHEET}!H${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[status]] },
  });
}

export interface PlanRow {
  rowNumber: number;
  date: string;
  type: string;
  title: string;
  token: string;
  data: string;
  status: string;
  post: string;
  postUrl: string;
}

export async function getPlanRows(): Promise<PlanRow[]> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: `${CP_SHEET}!A2:H`,
  });
  return (res.data.values ?? []).map((r, i) => ({
    rowNumber: i + 2,
    date: r[0] ?? '',
    type: (r[1] ?? '').trim().toLowerCase(),
    title: r[2] ?? '',
    token: r[3] ?? '',
    data: r[4] ?? '',
    status: (r[5] ?? '').trim().toLowerCase(),
    post: r[6] ?? '',
    postUrl: r[7] ?? '',
  }));
}

// Посты только Пн/Ср/Пт/Вс, равномерно — никогда в другой день недели.
// getDay(): 0=Вс, 1=Пн, 2=Вт, 3=Ср, 4=Чт, 5=Пт, 6=Сб.
const ALLOWED_WEEKDAYS = new Set([1, 3, 5, 0]);

function assertAllowedDay(dateStr: string): void {
  const [d, m, y] = dateStr.split('.').map(Number);
  const day = new Date(y, m - 1, d).getDay();
  if (!ALLOWED_WEEKDAYS.has(day)) {
    throw new Error(`Посты можно ставить только на Пн/Ср/Пт/Вс — ${dateStr} на другой день недели`);
  }
}

export async function appendPlanRow(row: {
  date: string;
  type: string;
  title: string;
  token: string;
  data: string;
}): Promise<void> {
  assertAllowedDay(row.date);
  const sheets = getClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: `${CP_SHEET}!A:G`,
    valueInputOption: 'RAW',
    requestBody: { values: [[row.date, row.type, row.title, row.token, row.data, 'approved', '']] },
  });
}

export async function setPlanRow(
  rowNumber: number,
  patch: { date?: string; type?: string; title?: string; token?: string; status?: string; data?: string; post?: string },
): Promise<void> {
  if (patch.date !== undefined) assertAllowedDay(patch.date);
  const sheets = getClient();
  const data: sheets_v4.Schema$ValueRange[] = [];
  if (patch.date !== undefined) data.push({ range: `${CP_SHEET}!A${rowNumber}`, values: [[patch.date]] });
  if (patch.type !== undefined) data.push({ range: `${CP_SHEET}!B${rowNumber}`, values: [[patch.type]] });
  if (patch.title !== undefined) data.push({ range: `${CP_SHEET}!C${rowNumber}`, values: [[patch.title]] });
  if (patch.token !== undefined) data.push({ range: `${CP_SHEET}!D${rowNumber}`, values: [[patch.token]] });
  if (patch.data !== undefined) data.push({ range: `${CP_SHEET}!E${rowNumber}`, values: [[patch.data]] });
  if (patch.status !== undefined) data.push({ range: `${CP_SHEET}!F${rowNumber}`, values: [[patch.status]] });
  if (patch.post !== undefined) data.push({ range: `${CP_SHEET}!G${rowNumber}`, values: [[patch.post]] });
  if (data.length === 0) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: getSheetId(),
    requestBody: { valueInputOption: 'RAW', data },
  });
}

// Физически удаляет строку из ContentPlan (сдвигает нижние вверх). Нужно,
// когда строка плана лишняя/ошибочная — очистка значений оставила бы пустую
// строку, которая ломает нумерацию и мозолит глаза в панели.
export async function deletePlanRow(rowNumber: number): Promise<void> {
  const sheets = getClient();
  const spreadsheetId = getSheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetId = meta.data.sheets?.find((s) => s.properties?.title === CP_SHEET)?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) throw new Error(`лист ${CP_SHEET} не найден`);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: rowNumber - 1, endIndex: rowNumber },
        },
      }],
    },
  });
}

export interface CaseRow {
  rowNumber: number;
  date: string;
  client: string;
  token: string;
  niche: string;
  sent: number;
  leads: number;
  conversion: number;
  status: string;
}

export async function getCaseRows(): Promise<CaseRow[]> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: `${CASES_SHEET}!A2:H`,
  });
  return (res.data.values ?? []).map((r, i) => ({
    rowNumber: i + 2,
    date: r[0] ?? '',
    client: r[1] ?? '',
    token: r[2] ?? '',
    niche: r[3] ?? '',
    sent: parseInt(r[4] ?? '0', 10),
    leads: parseInt(r[5] ?? '0', 10),
    conversion: parseFloat(r[6] ?? '0'),
    status: (r[7] ?? '').trim().toLowerCase(),
  }));
}

export async function setCaseStatus(rowNumber: number, status: string): Promise<void> {
  const sheets = getClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range: `${CASES_SHEET}!H${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[status]] },
  });
}

export interface FeatureRow {
  rowNumber: number;
  date: string;
  title: string;
  problem: string;
  description: string;
  status: string;
}

export async function getFeatureRows(): Promise<FeatureRow[]> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: `${FEAT_SHEET}!A2:E`,
  });
  return (res.data.values ?? []).map((r, i) => ({
    rowNumber: i + 2,
    date: r[0] ?? '',
    title: r[1] ?? '',
    problem: r[2] ?? '',
    description: r[3] ?? '',
    status: (r[4] ?? '').trim().toLowerCase(),
  }));
}

export async function appendFeature(row: {
  title: string;
  problem: string;
  description: string;
}): Promise<void> {
  const sheets = getClient();
  const now = new Date().toISOString().slice(0, 10);
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: `${FEAT_SHEET}!A:E`,
    valueInputOption: 'RAW',
    requestBody: { values: [[now, row.title, row.problem, row.description, 'draft']] },
  });
}

export async function setFeatureStatus(rowNumber: number, status: string): Promise<void> {
  const sheets = getClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range: `${FEAT_SHEET}!E${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[status]] },
  });
}

export interface PreferenceRow {
  updated: string;
  source: string;
  total: number;
  approved: number;
  rejected: number;
  trust: string;
  globalThreshold: string;
}

export interface ArticleRow {
  rowNumber: number;
  id: string;
  date: string;
  platform: string;
  sourceUrl: string;
  sourceTitle: string;
  status: string;
  content: string;
  publishedUrl: string;
}

export async function getArticleRows(): Promise<ArticleRow[]> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: `${ART_SHEET}!A2:H`,
  });
  return (res.data.values ?? []).map((r, i) => ({
    rowNumber: i + 2,
    id: r[0] ?? '',
    date: r[1] ?? '',
    platform: r[2] ?? '',
    sourceUrl: r[3] ?? '',
    sourceTitle: r[4] ?? '',
    status: (r[5] ?? '').trim().toLowerCase(),
    content: r[6] ?? '',
    publishedUrl: r[7] ?? '',
  }));
}

export async function appendArticle(row: { platform: string; title: string; content: string }): Promise<void> {
  const sheets = getClient();
  const now = new Date().toISOString().slice(0, 10);
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: `${ART_SHEET}!A:H`,
    valueInputOption: 'RAW',
    requestBody: { values: [[String(Date.now()), now, row.platform, '', row.title, 'pending', row.content, '']] },
  });
}

export async function setArticleRow(
  rowNumber: number,
  patch: { status?: string; content?: string; sourceTitle?: string; publishedUrl?: string },
): Promise<void> {
  const sheets = getClient();
  const data: sheets_v4.Schema$ValueRange[] = [];
  if (patch.sourceTitle !== undefined) data.push({ range: `${ART_SHEET}!E${rowNumber}`, values: [[patch.sourceTitle]] });
  if (patch.status !== undefined) data.push({ range: `${ART_SHEET}!F${rowNumber}`, values: [[patch.status]] });
  if (patch.content !== undefined) data.push({ range: `${ART_SHEET}!G${rowNumber}`, values: [[patch.content]] });
  if (patch.publishedUrl !== undefined) data.push({ range: `${ART_SHEET}!H${rowNumber}`, values: [[patch.publishedUrl]] });
  if (data.length === 0) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: getSheetId(),
    requestBody: { valueInputOption: 'RAW', data },
  });
}

export async function getPreferenceRows(): Promise<PreferenceRow[]> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: `${PREF_SHEET}!A2:I`,
  });
  return (res.data.values ?? []).map((r) => ({
    updated: r[0] ?? '',
    source: r[1] ?? '',
    total: parseInt(r[2] ?? '0', 10),
    approved: parseInt(r[3] ?? '0', 10),
    rejected: parseInt(r[4] ?? '0', 10),
    trust: (r[7] ?? '').trim().toLowerCase(),
    globalThreshold: r[8] ?? '',
  }));
}
