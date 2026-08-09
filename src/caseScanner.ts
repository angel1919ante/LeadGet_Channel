import {
  ensureCasesSheet, ensureContentPlanSheet, getCasesRows, appendCaseCandidate,
  updateCaseStatus, appendContentPlanRow, getContentPlanRows,
} from './sheets.ts';

const ADMIN_TOKEN = process.env.LEADGET_ADMIN_TOKEN ?? '';
const BASE = 'https://api.lead-get.ru/api/v1';

const SKIP_CLIENTS = ['envision', 'тотем', 'своя среда', 'seoai', 'seo ai', 'leadget'];
const MIN_LEADS = 4;
const MIN_SENT = 100;

async function adminGet(path: string): Promise<unknown> {
  const res = await fetch(BASE + path, {
    headers: { 'X-Admin-Token': ADMIN_TOKEN, 'User-Agent': 'LeadGetBot/1.0' },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

async function pubGet(path: string): Promise<unknown> {
  const res = await fetch(BASE + path, { headers: { 'User-Agent': 'LeadGetBot/1.0' } });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

interface Tenant { id: string; name: string }
interface Campaign { id: string; name: string; status: string; access_token: string }
interface Funnel { sent: number; leads: number }
interface Summary { funnel?: Funnel }

// Следующий понедельник от сегодня (или сегодня если понедельник), DD.MM.YYYY
function nextMondayDMY(): string {
  const d = new Date();
  const day = d.getUTCDay(); // 0=вс, 1=пн ...
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

// Находим свободную дату в ContentPlan (нет кейса с любым статусом)
function findFreeCaseDate(planDates: Set<string>): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1); // минимум завтра
  for (let i = 0; i < 30; i++) {
    const pad = (n: number) => String(n).padStart(2, '0');
    const dmy = `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
    if (!planDates.has(dmy)) return dmy;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return nextMondayDMY();
}

async function main(): Promise<void> {
  if (!ADMIN_TOKEN) throw new Error('LEADGET_ADMIN_TOKEN env var missing');

  await Promise.all([ensureCasesSheet(), ensureContentPlanSheet()]);

  const [existingCases, planRows] = await Promise.all([getCasesRows(), getContentPlanRows()]);
  const seenTokens = new Set(existingCases.map((r) => r.token));

  // Даты в ContentPlan с кейсами (любой статус) — чтобы не ставить два кейса в один день
  const casesPlanDates = new Set(planRows.filter((r) => r.type === 'кейс').map((r) => r.date));

  // ── 1. Обрабатываем "add to plan" в существующих строках Cases ──
  const toAdd = existingCases.filter((r) => r.status === 'add to plan');
  for (const c of toAdd) {
    const date = findFreeCaseDate(casesPlanDates);
    casesPlanDates.add(date);
    await appendContentPlanRow({
      date,
      type: 'кейс',
      title: c.client,
      token: c.token,
      data: JSON.stringify({ niche: c.niche || c.client }),
    });
    await updateCaseStatus(c.rowNumber, 'approved');
    console.log(`→ ContentPlan: ${c.client} на ${date}`);
  }

  // ── 2. Сканируем новые кампании ──
  const { items: tenants } = await adminGet('/admin/tenants') as { items: Tenant[] };

  const newCandidates: Array<{ client: string; token: string; sent: number; leads: number; conv: number }> = [];

  for (const t of tenants) {
    if (SKIP_CLIENTS.some((s) => t.name.toLowerCase().includes(s))) continue;

    let camps: Campaign[];
    try {
      camps = (await adminGet(`/admin/tenants/${t.id}/campaigns`) as { items: Campaign[] }).items;
    } catch (e) {
      console.error(`campaigns ${t.name}:`, e);
      continue;
    }

    for (const c of camps) {
      if (c.status === 'draft' || !c.access_token || seenTokens.has(c.access_token)) continue;

      let f: Funnel | undefined;
      try {
        const s = await pubGet(`/c/${c.access_token}/summary`) as Summary;
        f = s.funnel;
      } catch (e) {
        console.error(`summary ${t.name}/${c.name}:`, e);
        continue;
      }

      if (!f || f.sent < MIN_SENT || f.leads < MIN_LEADS) continue;

      const conv = Math.round((f.leads / f.sent) * 1000) / 10;
      newCandidates.push({ client: t.name, token: c.access_token, sent: f.sent, leads: f.leads, conv });
      seenTokens.add(c.access_token);
    }
  }

  newCandidates.sort((a, b) => b.leads - a.leads);

  for (const c of newCandidates) {
    console.log(`+ ${c.client}: ${c.leads} лидов (${c.conv}%)`);
    await appendCaseCandidate({ client: c.client, token: c.token, niche: c.client, sent: c.sent, leads: c.leads, conversion: c.conv });
  }

  console.log(`обработано add-to-plan: ${toAdd.length}, новых кандидатов: ${newCandidates.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
