import {
  ensureHeader,
  ensureAutoPostsSheet,
  ensureContentPlanSheet,
  ensureFeaturesSheet,
  ensureCasesSheet,
} from './sheets.ts';

async function main(): Promise<void> {
  await Promise.all([
    ensureHeader(),
    ensureAutoPostsSheet(),
    ensureContentPlanSheet(),
    ensureFeaturesSheet(),
    ensureCasesSheet(),
  ]);
  console.log('all sheets ready');
}

main().catch((e) => { console.error(e); process.exit(1); });
