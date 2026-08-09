import { ensureCasesSheet, getCasesRows, appendCaseCandidate } from './sheets.ts';

const ADMIN_TOKEN = process.env.LEADGET_ADMIN_TOKEN ?? '';
const BASE = 'https://api.lead-get.ru/api/v1';

// Клиенты, для которых кейс уже опубликован
const SKIP_CLIENTS = ['envision', 'тотем', 'своя среда', 'seoai', 'seo ai', 'leadget'];

// Минимальный порог для попадания в Cases
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
interface Funnel { sent: number; read: number; replied: number; engaged: number; leads: number }
interface Summary { funnel: Funnel }

async function main(): Promise<void> {
  if (!ADMIN_TOKEN) throw new Error('LEADGET_ADMIN_TOKEN env var missing');

  await ensureCasesSheet();

  const existing = await getCasesRows();
  const seenTokens = new Set(existing.map((r) => r.token));

  const { items: tenants } = await adminGet('/admin/tenants') as { items: Tenant[] };

  const candidates: Array<{
    client: string; campaign: string; token: string; sent: number; leads: number; conv: number;
  }> = [];

  for (const t of tenants) {
    if (SKIP_CLIENTS.some((s) => t.name.toLowerCase().includes(s))) continue;

    let camps: Campaign[];
    try {
      const r = await adminGet(`/admin/tenants/${t.id}/campaigns`) as { items: Campaign[] };
      camps = r.items;
    } catch (e) {
      console.error(`campaigns ${t.name}:`, e);
      continue;
    }

    for (const c of camps) {
      if (c.status === 'draft' || !c.access_token) continue;
      if (seenTokens.has(c.access_token)) continue;

      let summary: Summary;
      try {
        summary = await pubGet(`/c/${c.access_token}/summary`) as Summary;
      } catch (e) {
        console.error(`summary ${t.name}/${c.name}:`, e);
        continue;
      }

      const f = summary.funnel;
      if (f.sent < MIN_SENT || f.leads < MIN_LEADS) continue;

      const conv = f.sent ? Math.round((f.leads / f.sent) * 1000) / 10 : 0;
      candidates.push({ client: t.name, campaign: c.name, token: c.access_token, sent: f.sent, leads: f.leads, conv });
    }
  }

  candidates.sort((a, b) => b.leads - a.leads);

  for (const c of candidates) {
    console.log(`+ ${c.client} / ${c.campaign}: ${c.leads} лидов (${c.conv}%)`);
    await appendCaseCandidate({
      client: c.client,
      token: c.token,
      niche: c.client,
      sent: c.sent,
      leads: c.leads,
      conversion: c.conv,
    });
  }

  console.log(`добавлено ${candidates.length} кандидатов в Cases`);
}

main().catch((e) => { console.error(e); process.exit(1); });
