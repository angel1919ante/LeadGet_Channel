import { callLLM } from './llm.ts';
import { casePostPrompt, caseChatPrompt } from './prompts.ts';
import type { ContentPlanRow } from './sheets.ts';
import type { CaseBoardNumber } from './caseBoard.ts';
import type { CaseChatSlideOptions } from './caseChat.ts';

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
  niche: string;
  task: string;
  mechanics: string;
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

  // Анонимизация обязательна (case-preview-spec.md, case-chat-spec.md, п.9-10):
  // реальное имя клиента (info.name из LeadGet API) нигде не должно попасть
  // в пост/доску/переписку — только обезличенная ниша из ContentPlan.Данные.
  if (!data.niche) {
    throw new Error(
      'Недостаточно информации: нужна анонимизированная "niche" в ContentPlan.Данные (JSON) — ' +
      'без неё в пост попало бы настоящее имя клиента из LeadGet API',
    );
  }
  const niche = data.niche;
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

  return { postText, board, niche, task, mechanics };
}

interface RawChatSlide {
  stageTitle: string;
  messages: Array<{ role: 'bot' | 'client'; text: string }>;
  resultTitle: string;
  resultCopy: string;
}

// Спек: references/case-cards/case-chat-spec.md. LLM пишет анонимизированный
// диалог по данным кейса, caseChat.ts рендерит его детерминированно в PNG.
export async function generateCaseChatSlides(
  niche: string,
  task: string,
  mechanics: string,
): Promise<CaseChatSlideOptions[]> {
  const raw = await callLLM(caseChatPrompt(niche, task, mechanics));
  const cleaned = raw.trim().replace(/^```(?:json)?\n?/, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(cleaned) as { category: string; slides: RawChatSlide[] };

  if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
    throw new Error('caseChat: LLM вернул пустой slides');
  }

  const total = parsed.slides.length;
  return parsed.slides.map((s, i) => ({
    category: parsed.category,
    stageTitle: s.stageTitle,
    page: i + 1,
    total,
    messages: s.messages,
    resultTitle: s.resultTitle,
    resultCopy: s.resultCopy,
  }));
}
