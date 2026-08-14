// ponytail: одноразовая проверка листа Cases и ContentPlan, удалить после использования.
import { getCasesRows, getContentPlanRows } from './sheets.ts';

async function main() {
  const cases = await getCasesRows();
  console.log('=== Cases ===');
  for (const c of cases) {
    console.log(`[${c.status}] ${c.client} | token=${c.token} | ниша=${c.niche} | отправлено=${c.sent} лиды=${c.leads} конв=${c.conversion}%`);
  }

  const plans = await getContentPlanRows();
  console.log('=== ContentPlan (кейсы) ===');
  for (const p of plans.filter((p) => p.type === 'кейс')) {
    console.log(`[${p.status}] ${p.date} ${p.title} token=${p.token}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
