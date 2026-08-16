import {
  ensureCasesSheet, ensureContentPlanSheet, getCasesRows, appendCaseCandidate,
  updateCaseStatus, appendContentPlanRow, getContentPlanRows, pickPlanDate,
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

async function main(): Promise<void> {
  if (!ADMIN_TOKEN) throw new Error('LEADGET_ADMIN_TOKEN env var missing');

  await Promise.all([ensureCasesSheet(), ensureContentPlanSheet()]);

  const [existingCases, planRows] = await Promise.all([getCasesRows(), getContentPlanRows()]);
  const seenTokens = new Set(existingCases.map((r) => r.token));

  // Копия плана, которую пополняем по ходу цикла — pickPlanDate должен видеть
  // уже добавленные в этом же прогоне строки, иначе два кейса опять могут
  // встать подряд друг за другом.
  const livePlanRows = [...planRows];

  // ── 1. Обрабатываем "add to plan" в существующих строках Cases ──
  const toAdd = existingCases.filter((r) => r.status === 'add to plan');
  for (const c of toAdd) {
    // Анонимизация обязательна: ниша должна быть заполнена человеком и
    // отличаться от настоящего имени клиента — иначе имя клиента попадёт
    // в пост/доску/переписку. Без неё пропускаем и оставляем на ручной разбор.
    const niche = c.niche.trim();
    if (!niche || niche.toLowerCase() === c.client.trim().toLowerCase()) {
      console.warn(`skip "${c.client}": в Cases не заполнена анонимизированная Ниша (сейчас пусто или равна имени клиента)`);
      continue;
    }

    const date = pickPlanDate('кейс', livePlanRows, (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() + 1); return d; })());
    livePlanRows.push({ rowNumber: -1, date, type: 'кейс', title: '', token: c.token, data: '', status: 'approved', post: '', postUrl: '' });
    await appendContentPlanRow({
      date,
      type: 'кейс',
      title: '',
      token: c.token,
      data: JSON.stringify({ niche }),
    });
    await updateCaseStatus(c.rowNumber, 'approved');
    console.log(`→ ContentPlan: кейс (${niche}) на ${date}`);
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
    // Ниша нарочно пустая: заполняется человеком анонимизированной
    // формулировкой перед тем как ставить "add to plan" (см. проверку выше).
    await appendCaseCandidate({ client: c.client, token: c.token, niche: '', sent: c.sent, leads: c.leads, conversion: c.conv });
  }

  console.log(`обработано add-to-plan: ${toAdd.length}, новых кандидатов: ${newCandidates.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
