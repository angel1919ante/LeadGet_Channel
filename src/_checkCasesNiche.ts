import { getCasesRows } from './sheets.ts';
const rows = await getCasesRows();
for (const r of rows) {
  if (r.token === '046b6786-4da0-49f3-a39d-6328b616d8f2' || r.token === '99eb4410-9861-4e49-9bb3-18e78f2acb51') {
    console.log(r.client, '|', r.niche, '|', r.token);
  }
}
