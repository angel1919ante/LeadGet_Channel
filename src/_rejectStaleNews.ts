import { getAllRows, updateRow } from './sheets.ts';

const rows = await getAllRows();
const stale = rows.filter((r) => r.status === 'pending' && r.rating === 0);
console.log(`найдено ${stale.length} старых неоценённых новостей`);

for (const r of stale) {
  await updateRow(r.rowNumber, { status: 'rejected' });
}
console.log(`отклонено ${stale.length}`);
