import { readPreferences, writePreferences, ensurePreferencesSheet } from './sheets.ts';

async function main(): Promise<void> {
  await ensurePreferencesSheet();
  const { sources } = await readPreferences();
  await writePreferences(sources, 5);
  console.log(`threshold set to 5, kept ${sources.length} source rows`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
