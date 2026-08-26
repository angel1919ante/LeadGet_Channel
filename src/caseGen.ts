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
  read?: number;
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

// Пользователь явно попросил: в реальных постах "отправок" всегда должно
// выглядеть как объём в диапазоне 2000-4000, неровное число — остальные
// цифры пересчитываются по тем же процентам конверсии, что и реальные.
// Детерминированно (по исходному sent), чтобы одинаковый кейс всегда
// масштабировался в одно и то же число при повторной генерации.
function scaleSummary(s: CampaignSummary): CampaignSummary {
  if (!s.sent || (s.sent >= 2000 && s.sent <= 4000)) return s;
  const target = 2137 + ((s.sent * 13) % 1863); // 2137..3999, неровное
  const scale = target / s.sent;
  return {
    sent: target,
    read: s.read !== undefined ? Math.round(s.read * scale) : undefined,
    replied: Math.round(s.replied * scale),
    engaged: Math.round(s.engaged * scale),
    leads: Math.round(s.leads * scale),
    disqualified: s.disqualified !== undefined ? Math.round(s.disqualified * scale) : undefined,
  };
}

// Формат-эталон (зафиксирован пользователем): цифра сначала моноширинным
// (<code>, не <b>), текст после, без "Рассылка:"-префиксов. Пачкой —
// без пустых строк между строками (formatPost это защищает через [STACK]).
function buildResultsString(s: CampaignSummary, price?: string): string {
  if (!s.sent) {
    return 'нет данных о рассылке';
  }

  const convPct = pct(s.leads, s.sent).replace('%', '');

  const lines = [
    `<code>${s.sent}</code> сообщений отправлено`,
    ...(s.read !== undefined ? [`<code>${s.read}</code> прочитали: (${pct(s.read, s.sent)})`] : []),
    `<code>${s.replied}</code> ответили: (${pct(s.replied, s.sent)})`,
    `<code>${s.engaged}</code> диалогов: (${pct(s.engaged, s.sent)})`,
    `<code>${s.leads}</code> квалифицированных лида (${convPct}%)`,
    ...(price ? [`<code>${price}</code> ₽ цена квал. лида`] : []),
  ].join('\n');
  return `[STACK]${lines}[/STACK]`;
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
  let data: Record<string, string> & { summaryOverride?: Partial<CampaignSummary> } = {};
  try {
    data = row.data ? JSON.parse(row.data) : {};
  } catch {
    console.warn('ContentPlan Данные не JSON, игнорируем');
  }

  // summaryOverride в Данных — ручная поправка, когда цифры из LeadGet API
  // неполные/устаревшие (сравнено с реальным дашбордом клиента).
  const [info, summary] = await Promise.all([
    fetchCampaignInfo(row.token).catch((e) => {
      console.warn('campaign info fetch failed, продолжаем без имени:', e);
      return { name: row.token };
    }),
    data.summaryOverride
      ? Promise.resolve({
          sent: data.summaryOverride.sent ?? 0,
          read: data.summaryOverride.read,
          replied: data.summaryOverride.replied ?? 0,
          engaged: data.summaryOverride.engaged ?? 0,
          leads: data.summaryOverride.leads ?? 0,
          disqualified: data.summaryOverride.disqualified,
        })
      : fetchCampaignSummary(row.token),
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
  const task = data.task || 'лидогенерация через Telegram';
  const mechanics = data.mechanics || 'рассылка по целевой базе, квалификация через бот';
  const display = scaleSummary(summary);
  const results = buildResultsString(display, data.price);

  console.log(`case: ${info.name} | sent=${summary.sent}->${display.sent} leads=${summary.leads}->${display.leads}`);

  const rawPost = await callLLM(casePostPrompt(niche, task, mechanics, data.marketComparison));
  // Inject results directly — LLM cannot strip [QUOTE] tags this way
  const postText = rawPost.replace('<<RESULTS>>', results);

  // Схема цифр борда (правка Павла): отправок / диалогов / квалов — те же
  // (масштабированные) цифры, что и в тексте поста, чтобы не расходились.
  // Заголовок доски — короткий: без уточнения в скобках (оно для текста
  // поста, на доске с широким шрифтом такая длина переполняет заголовок).
  const board: CaseBoardData = {
    title: data.boardTitle ?? niche.replace(/\s*\([^)]*\)\s*$/, ''),
    subtitle: data.boardSubtitle ?? 'Выход на аудиторию в Telegram',
    numbers: [
      { value: String(display.sent), label: 'отправок' },
      { value: String(display.engaged), label: 'диалогов' },
      { value: String(display.leads), label: 'квалов' },
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
