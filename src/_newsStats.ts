import { getAllRows } from './sheets.ts';
const rows = await getAllRows();
const byStatus: Record<string, number> = {};
for (const r of rows) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
console.log(JSON.stringify(byStatus, null, 2));
console.log('total', rows.length);
