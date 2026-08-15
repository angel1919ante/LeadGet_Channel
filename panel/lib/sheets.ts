import { google, type sheets_v4 } from 'googleapis';

const NEWS_SHEET = 'News';
const CP_SHEET = 'ContentPlan';
const CASES_SHEET = 'Cases';
const FEAT_SHEET = 'Features';
const PREF_SHEET = 'Preferences';

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

export async function setPlanRow(
  rowNumber: number,
  patch: { title?: string; status?: string },
): Promise<void> {
  const sheets = getClient();
  const data: sheets_v4.Schema$ValueRange[] = [];
  if (patch.title !== undefined) data.push({ range: `${CP_SHEET}!C${rowNumber}`, values: [[patch.title]] });
  if (patch.status !== undefined) data.push({ range: `${CP_SHEET}!F${rowNumber}`, values: [[patch.status]] });
  if (data.length === 0) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: getSheetId(),
    requestBody: { valueInputOption: 'RAW', data },
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
