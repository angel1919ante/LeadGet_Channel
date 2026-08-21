import { getContentPlanRows, updateContentPlanRow } from './sheets.ts';

async function main() {
  const rows = await getContentPlanRows();
  const row = rows.find(r => r.rowNumber === 5);
  if (!row) throw new Error('row 5 not found');
  console.log('current data:', row.data);
  const data = JSON.parse(row.data);
  data.task = 'лидогенерация среди строительных компаний (не e-commerce)';
  await updateContentPlanRow(5, { data: JSON.stringify(data) });
  console.log('updated:', JSON.stringify(data));
}

main().catch(e => { console.error(e); process.exit(1); });
