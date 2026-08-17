import { getAutoPostRows } from './sheets.ts';
const rows = await getAutoPostRows();
const features = rows.filter(r => r.postType === 'фича');
for (const r of features) {
  console.log(r.status, r.sourceUrl);
}
