import { appendContentPlanRow } from './sheets.ts';

const rows = [
  { date: '17.08.2026', type: 'фича', title: 'Транскрибация голосовых', token: '', data: '{}' },
  { date: '19.08.2026', type: 'кейс', title: '', token: '046b6786-4da0-49f3-a39d-6328b616d8f2', data: '{}' },
  { date: '20.08.2026', type: 'кейс', title: '', token: '99eb4410-9861-4e49-9bb3-18e78f2acb51', data: '{}' },
  { date: '21.08.2026', type: 'фича', title: 'Подключиться к диалогу', token: '', data: '{}' },
];

for (const r of rows) {
  await appendContentPlanRow(r);
  console.log(`added: ${r.date} ${r.type} ${r.title || r.token}`);
}
