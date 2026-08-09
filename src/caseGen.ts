import { callLLM } from './llm.ts';
import { casePostPrompt } from './prompts.ts';
import type { ContentPlanRow } from './sheets.ts';

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
  const json = await res.json() as CampaignSummary & { data?: CampaignSummary };
  // API может вернуть данные напрямую или в поле data
  return json.data ?? json;
}

function pct(part: number, total: number): string {
  if (!total) return '0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

function buildResultsString(s: CampaignSummary, price?: string): string {
  const lines = [
    `Отправлено: \`${s.sent}\``,
    `Прочитали: \`${s.read}\` (${pct(s.read, s.sent)})`,
    `Ответили: \`${s.replied}\` (${pct(s.replied, s.sent)})`,
    `Диалогов: \`${s.engaged}\` (${pct(s.engaged, s.sent)})`,
    `Квал. лидов: \`${s.leads}\` (${pct(s.leads, s.sent)})`,
  ];
  if (s.disqualified) lines.push(`Дисквалифицировано: \`${s.disqualified}\``);
  if (price) lines.push(`Цена квал. лида: \`${price} ₽\``);
  return lines.join('\n');
}

export async function generateCasePost(row: ContentPlanRow): Promise<string> {
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

  return callLLM(casePostPrompt(niche, task, mechanics, results));
}
