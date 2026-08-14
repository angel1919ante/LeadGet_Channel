import { getAllRows } from './sheets.ts';
const rows = await getAllRows();
const decided = rows.filter(r => ['approved','posted','rejected'].includes(r.status));
for (const r of decided) {
  console.log(r.status, JSON.stringify(r.rating), r.source);
}
