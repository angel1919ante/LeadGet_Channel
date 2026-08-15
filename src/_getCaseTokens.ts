import { getCasesRows } from './sheets.ts';
const rows = await getCasesRows();
for (const r of rows) {
  if (r.status === 'approved') {
    console.log(`${r.client} | token=${r.token} | ${r.sent}/${r.leads}/${r.conversion}%`);
  }
}
