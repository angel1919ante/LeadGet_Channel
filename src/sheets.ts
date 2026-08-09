import { google, type sheets_v4 } from 'googleapis';

const SHEET_NAME = 'News';
const HEADER = ['Дата', 'Источник', 'Заголовок', 'Саммари', 'Пост', 'Ссылка', 'Рейтинг', 'Статус', 'Статья'];

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
  article: string; // 'нет' | 'habr' | 'vc' | 'dzen' | 'x' | 'все'
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

// Ширины колонок в пикселях: Дата, Источник, Заголовок, Саммари, Пост, Ссылка, Рейтинг, Статус, Статья
const COL_WIDTHS = [110, 90, 280, 420, 420, 320, 80, 90, 100];

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
        // Выпадающий список в колонке Статус (H, index 7), начиная со строки 2
        {
          setDataValidation: {
            range: { sheetId, startRowIndex: 1, startColumnIndex: 7, endColumnIndex: 8 },
            rule: {
              condition: {
                type: 'ONE_OF_LIST',
                values: [
                  { userEnteredValue: 'pending' },
                  { userEnteredValue: 'approved' },
                  { userEnteredValue: 'rejected' },
                  { userEnteredValue: 'posted' },
                  { userEnteredValue: 'error' },
                ],
              },
              showCustomUi: true,
              strict: false,
            },
          },
        },
        // Выпадающий список в колонке Статья (I, index 8), начиная со строки 2
        {
          setDataValidation: {
            range: { sheetId, startRowIndex: 1, startColumnIndex: 8, endColumnIndex: 9 },
            rule: {
              condition: {
                type: 'ONE_OF_LIST',
                values: [
                  { userEnteredValue: 'нет' },
                  { userEnteredValue: 'habr' },
                  { userEnteredValue: 'vc' },
                  { userEnteredValue: 'dzen' },
                  { userEnteredValue: 'x' },
                  { userEnteredValue: 'все' },
                ],
              },
              showCustomUi: true,
              strict: false,
            },
          },
        },
      ],
    },
  });
}

export async function ensureHeader(): Promise<void> {
  const sheets = getClient();
  const spreadsheetId = getSheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A1:I1`,
  });
  const row = res.data.values?.[0] ?? [];
  if (row.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!A1:I1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADER] },
    });
  } else if (row.length < HEADER.length) {
    // Миграция существующей таблицы: дописываем недостающие колонки заголовка
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!A1:I1`,
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
    range: `${SHEET_NAME}!A2:I`,
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
    article: (r[8] ?? 'нет').trim().toLowerCase(),
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
    'нет',
  ]);
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: `${SHEET_NAME}!A:I`,
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

// ── Лист Articles ──────────────────────────────────────────────

const ART_SHEET = 'Articles';
const ART_HEADER = ['id', 'date', 'platform', 'sourceUrl', 'sourceTitle', 'status', 'content', 'publishedUrl'];
const ART_COL_WIDTHS = [60, 110, 90, 300, 280, 100, 500, 300];

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

// Создаёт лист Articles, если его нет, и применяет форматирование + валидацию статуса.
export async function ensureArticleSheet(): Promise<void> {
  const sheets = getClient();
  const spreadsheetId = getSheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  let sheet = meta.data.sheets?.find((s) => s.properties?.title === ART_SHEET);

  if (!sheet) {
    const res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: ART_SHEET } } }],
      },
    });
    const added = res.data.replies?.[0]?.addSheet;
    sheet = { properties: added?.properties };
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${ART_SHEET}!A1:H1`,
      valueInputOption: 'RAW',
      requestBody: { values: [ART_HEADER] },
    });
  }

  const sheetId = sheet.properties?.sheetId ?? 0;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0 },
            cell: { userEnteredFormat: { wrapStrategy: 'WRAP' } },
            fields: 'userEnteredFormat.wrapStrategy',
          },
        },
        ...ART_COL_WIDTHS.map((px, i) => ({
          updateDimensionProperties: {
            range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
            properties: { pixelSize: px },
            fields: 'pixelSize',
          },
        })),
        // Выпадающий список статуса (колонка F, index 5)
        {
          setDataValidation: {
            range: { sheetId, startRowIndex: 1, startColumnIndex: 5, endColumnIndex: 6 },
            rule: {
              condition: {
                type: 'ONE_OF_LIST',
                values: [
                  { userEnteredValue: 'pending' },
                  { userEnteredValue: 'approved' },
                  { userEnteredValue: 'rejected' },
                  { userEnteredValue: 'published' },
                ],
              },
              showCustomUi: true,
              strict: false,
            },
          },
        },
      ],
    },
  });
}

export async function getArticleRows(): Promise<ArticleRow[]> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: `${ART_SHEET}!A2:H`,
  });
  const rows = res.data.values ?? [];
  return rows.map((r, i) => ({
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

export async function appendArticles(
  rows: Array<{
    id: string;
    platform: string;
    sourceUrl: string;
    sourceTitle: string;
    content: string;
  }>,
): Promise<void> {
  if (rows.length === 0) return;
  const sheets = getClient();
  const now = new Date().toISOString().slice(0, 10);
  const values = rows.map((r) => [
    r.id,
    now,
    r.platform,
    r.sourceUrl,
    r.sourceTitle,
    'pending',
    r.content,
    '',
  ]);
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: `${ART_SHEET}!A:H`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}

export async function updateArticleRow(
  rowNumber: number,
  patch: { status?: string; publishedUrl?: string },
): Promise<void> {
  const sheets = getClient();
  const spreadsheetId = getSheetId();
  const data: sheets_v4.Schema$ValueRange[] = [];
  if (patch.status !== undefined) {
    data.push({ range: `${ART_SHEET}!F${rowNumber}`, values: [[patch.status]] });
  }
  if (patch.publishedUrl !== undefined) {
    data.push({ range: `${ART_SHEET}!H${rowNumber}`, values: [[patch.publishedUrl]] });
  }
  if (data.length === 0) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'RAW', data },
  });
}

// ── Лист AutoPosts ─────────────────────────────────────────────

const AUTO_SHEET = 'AutoPosts';
const AUTO_HEADER = ['date', 'postType', 'sourceUrl', 'imageUrl', 'animationUrl', 'channelPosted', 'status'];
const AUTO_COL_WIDTHS = [110, 90, 300, 300, 300, 110, 90];

export interface AutoPostRow {
  rowNumber: number;
  date: string;
  postType: string;
  sourceUrl: string;
  imageUrl: string;
  animationUrl: string;
  channelPosted: string;
  status: string;
}

export async function ensureAutoPostsSheet(): Promise<void> {
  const sheets = getClient();
  const spreadsheetId = getSheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === AUTO_SHEET);

  let sheetId: number;
  if (!sheet) {
    const res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: AUTO_SHEET } } }] },
    });
    sheetId = res.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${AUTO_SHEET}!A1:G1`,
      valueInputOption: 'RAW',
      requestBody: { values: [AUTO_HEADER] },
    });
  } else {
    sheetId = sheet.properties?.sheetId ?? 0;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0 },
            cell: { userEnteredFormat: { wrapStrategy: 'WRAP' } },
            fields: 'userEnteredFormat.wrapStrategy',
          },
        },
        ...AUTO_COL_WIDTHS.map((px, i) => ({
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

export async function getAutoPostRows(): Promise<AutoPostRow[]> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: `${AUTO_SHEET}!A2:G`,
  });
  const rows = res.data.values ?? [];
  return rows.map((r, i) => ({
    rowNumber: i + 2,
    date: r[0] ?? '',
    postType: r[1] ?? '',
    sourceUrl: r[2] ?? '',
    imageUrl: r[3] ?? '',
    animationUrl: r[4] ?? '',
    channelPosted: r[5] ?? '',
    status: (r[6] ?? '').trim().toLowerCase(),
  }));
}

export async function appendAutoPost(row: {
  postType: string;
  sourceUrl: string;
  imageUrl: string;
  animationUrl?: string;
  channelPosted: string;
  status: string;
}): Promise<void> {
  const sheets = getClient();
  const now = new Date().toISOString().slice(0, 10);
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: `${AUTO_SHEET}!A:G`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        now,
        row.postType,
        row.sourceUrl,
        row.imageUrl,
        row.animationUrl ?? '',
        row.channelPosted,
        row.status,
      ]],
    },
  });
}

// ── Лист ContentPlan ────────────────────────────────────────────
// Колонки: Дата | Тип | Заголовок | Токен | Данные | Статус | Пост
// Дата: DD.MM.YYYY, Тип: новость/кейс/фича
// Данные: JSON — для кейса: {niche, task, mechanics?, price?}
//                для фичи: {problem, description}

const CP_SHEET = 'ContentPlan';
const CP_HEADER = ['Дата', 'Тип', 'Заголовок', 'Токен', 'Данные', 'Статус', 'Пост'];
const CP_COL_WIDTHS = [110, 90, 200, 260, 320, 100, 500];

export interface ContentPlanRow {
  rowNumber: number;
  date: string;
  type: string;     // новость | кейс | фича
  title: string;
  token: string;    // campaign token for кейс
  data: string;     // JSON string with extra fields
  status: string;   // draft | approved | posted | error
  post: string;
}

async function ensureSheetExists(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  title: string,
  header: string[],
  colWidths: number[],
  extraRequests?: sheets_v4.Schema$Request[],
): Promise<number> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets?.find((s) => s.properties?.title === title);
  let sheetId: number;

  if (!existing) {
    const res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
    sheetId = res.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${title}!A1:${String.fromCharCode(64 + header.length)}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [header] },
    });
  } else {
    sheetId = existing.properties?.sheetId ?? 0;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0 },
            cell: { userEnteredFormat: { wrapStrategy: 'WRAP' } },
            fields: 'userEnteredFormat.wrapStrategy',
          },
        },
        ...colWidths.map((px, i) => ({
          updateDimensionProperties: {
            range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
            properties: { pixelSize: px },
            fields: 'pixelSize',
          },
        })),
        ...(extraRequests?.map((r) => {
          // inject sheetId into range fields that need it
          const req = JSON.parse(JSON.stringify(r)) as sheets_v4.Schema$Request;
          const target = req.setDataValidation?.range ?? req.repeatCell?.range;
          if (target && target.sheetId === undefined) target.sheetId = sheetId;
          return req;
        }) ?? []),
      ],
    },
  });

  return sheetId;
}

export async function ensureContentPlanSheet(): Promise<void> {
  const sheets = getClient();
  const spreadsheetId = getSheetId();
  await ensureSheetExists(sheets, spreadsheetId, CP_SHEET, CP_HEADER, CP_COL_WIDTHS, [
    {
      setDataValidation: {
        range: { startRowIndex: 1, startColumnIndex: 1, endColumnIndex: 2 },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: 'новость' },
              { userEnteredValue: 'кейс' },
              { userEnteredValue: 'фича' },
            ],
          },
          showCustomUi: true,
          strict: false,
        },
      },
    },
    {
      setDataValidation: {
        range: { startRowIndex: 1, startColumnIndex: 5, endColumnIndex: 6 },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: 'draft' },
              { userEnteredValue: 'approved' },
              { userEnteredValue: 'posted' },
              { userEnteredValue: 'error' },
            ],
          },
          showCustomUi: true,
          strict: false,
        },
      },
    },
  ]);
}

export async function getContentPlanRows(): Promise<ContentPlanRow[]> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: `${CP_SHEET}!A2:G`,
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
  }));
}

export async function updateContentPlanRow(
  rowNumber: number,
  patch: { status?: string; post?: string },
): Promise<void> {
  const sheets = getClient();
  const data: sheets_v4.Schema$ValueRange[] = [];
  if (patch.status !== undefined) data.push({ range: `${CP_SHEET}!F${rowNumber}`, values: [[patch.status]] });
  if (patch.post !== undefined) data.push({ range: `${CP_SHEET}!G${rowNumber}`, values: [[patch.post]] });
  if (data.length === 0) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: getSheetId(),
    requestBody: { valueInputOption: 'RAW', data },
  });
}

// ── Лист Features ───────────────────────────────────────────────
// Справочник фич: пользователь заполняет идеи, потом ссылается в ContentPlan.
// Колонки: Дата | Название | Проблема | Описание | Статус

const FEAT_SHEET = 'Features';
const FEAT_HEADER = ['Дата', 'Название', 'Проблема', 'Описание', 'Статус'];
const FEAT_COL_WIDTHS = [110, 200, 300, 400, 100];

export async function ensureFeaturesSheet(): Promise<void> {
  const sheets = getClient();
  const spreadsheetId = getSheetId();
  await ensureSheetExists(sheets, spreadsheetId, FEAT_SHEET, FEAT_HEADER, FEAT_COL_WIDTHS, [
    {
      setDataValidation: {
        range: { startRowIndex: 1, startColumnIndex: 4, endColumnIndex: 5 },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: 'draft' },
              { userEnteredValue: 'approved' },
              { userEnteredValue: 'posted' },
            ],
          },
          showCustomUi: true,
          strict: false,
        },
      },
    },
  ]);
}

// ── Лист Cases ──────────────────────────────────────────────────
// Кандидаты на кейс-посты из LeadGet.
// Колонки: Дата | Клиент | Токен | Ниша | Отправлено | Лиды | Конверсия% | Статус

const CASES_SHEET = 'Cases';
const CASES_HEADER = ['Дата', 'Клиент', 'Токен', 'Ниша', 'Отправлено', 'Лиды', 'Конверсия%', 'Статус'];
const CASES_COL_WIDTHS = [110, 180, 260, 180, 110, 80, 110, 100];

export interface CasesRow {
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

export async function ensureCasesSheet(): Promise<void> {
  const sheets = getClient();
  const spreadsheetId = getSheetId();
  await ensureSheetExists(sheets, spreadsheetId, CASES_SHEET, CASES_HEADER, CASES_COL_WIDTHS, [
    {
      setDataValidation: {
        range: { startRowIndex: 1, startColumnIndex: 7, endColumnIndex: 8 },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: 'pending' },
              { userEnteredValue: 'approved' },
              { userEnteredValue: 'posted' },
              { userEnteredValue: 'skip' },
            ],
          },
          showCustomUi: true,
          strict: false,
        },
      },
    },
  ]);
}

export async function getCasesRows(): Promise<CasesRow[]> {
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

export async function appendCaseCandidate(row: {
  client: string;
  token: string;
  niche: string;
  sent: number;
  leads: number;
  conversion: number;
}): Promise<void> {
  const sheets = getClient();
  const now = new Date().toISOString().slice(0, 10);
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: `${CASES_SHEET}!A:H`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        now,
        row.client,
        row.token,
        row.niche,
        String(row.sent),
        String(row.leads),
        row.conversion.toFixed(1),
        'pending',
      ]],
    },
  });
}
