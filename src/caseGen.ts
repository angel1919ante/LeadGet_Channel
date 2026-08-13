import { callLLM } from './llm.ts';
import { casePostPrompt } from './prompts.ts';
import type { ContentPlanRow } from './sheets.ts';
import type { CaseBoardNumber } from './caseBoard.ts';

interface CampaignInfo {
  name: string;
}

interface CampaignSummary {
  sent: number;
  read: number;
  replied: number;
  engaged: number;
  leads: number;
  disqualified?: number;
}

const LEADGET_BASE = 'https://api.lead-get.ru/api/v1';

async function fetchCampaignInfo(token: string): Promise<CampaignInfo> {
  const res = await fetch(`${LEADGET_BASE}/c/${token}`, {
    headers: { 'User-Agent': 'LeadGetBot/1.0' },
  });
  if (!res.ok) throw new Error(`campaign info fetch failed: ${res.status}`);
  const json = await res.json() as { name?: string; campaign?: { name?: string } };
  const name = json.name ?? json.campaign?.name ?? token;
  return { name };
}

async function fetchCampaignSummary(token: string): Promise<CampaignSummary> {
  const res = await fetch(`${LEADGET_BASE}/c/${token}/summary`, {
    headers: { 'User-Agent': 'LeadGetBot/1.0' },
  });
  if (!res.ok) throw new Error(`campaign summary fetch failed: ${res.status}`);
  const json = await res.json() as { funnel?: CampaignSummary; data?: CampaignSummary } & CampaignSummary;
  // API возвращает {funnel: {...}} или flat или {data: {...}}
  return json.funnel ?? json.data ?? json;
}

function pct(part: number, total: number): string {
  if (!total) return '0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

function buildResultsString(s: CampaignSummary, price?: string): string {
  if (!s.sent) {
    return 'нет данных о рассылке';
  }

  const convPct = pct(s.leads, s.sent).replace('%', '');

  const inner = [
    `Рассылка: \`${s.sent}\` сообщений отправлено`,
    `Прочитали: \`${s.read}\` (${pct(s.read, s.sent)}) Ответили: \`${s.replied}\` (${pct(s.replied, s.sent)})`,
    `Квал. диалогов: \`${s.engaged}\` (${pct(s.engaged, s.sent)})`,
    `Конверсия в лид: \`${convPct}%\` — \`${s.leads}\` квалифицированных лидов`,
    ...(price ? [`\`${price} ₽\` цена квал. лида`] : []),
  ].join('\n');
  return `[QUOTE]${inner}[/QUOTE]`;
}

export interface CaseBoardData {
  title: string;
  subtitle: string;
  numbers: [CaseBoardNumber, CaseBoardNumber, CaseBoardNumber];
}

export interface CaseGenResult {
  postText: string;
  board: CaseBoardData;
}

export async function generateCase(row: ContentPlanRow): Promise<CaseGenResult> {
  let data: Record<string, string> = {};
  try {
    data = row.data ? JSON.parse(row.data) : {};
  } catch {
    console.warn('ContentPlan Данные не JSON, игнорируем');
  }

  const [info, summary] = await Promise.all([
    fetchCampaignInfo(row.token),
    fetchCampaignSummary(row.token),
  ]);

  const niche = data.niche ?? info.name;
  const task = data.task ?? 'лидогенерация через Telegram';
  const mechanics = data.mechanics ?? 'рассылка по целевой базе, квалификация через бот';
  const results = buildResultsString(summary, data.price);

  console.log(`case: ${info.name} | sent=${summary.sent} leads=${summary.leads}`);

  const rawPost = await callLLM(casePostPrompt(niche, task, mechanics));
  // Inject results directly — LLM cannot strip [QUOTE] tags this way
  const postText = rawPost.replace('<<RESULTS>>', results);

  // Схема цифр борда: отправок / квал. лидов / гибкая третья (цена контакта, если есть, иначе конверсия)
  const board: CaseBoardData = {
    title: data.boardTitle ?? niche,
    subtitle: data.boardSubtitle ?? 'Выход на аудиторию в Telegram',
    numbers: [
      { value: String(summary.sent), label: 'отправок' },
      { value: String(summary.leads), label: 'квал. лидов' },
      data.price
        ? { value: `${data.price} ₽`, label: 'контакт' }
        : { value: pct(summary.leads, summary.sent), label: 'конверсия' },
    ],
  };

  return { postText, board };
}
