import { readPreferences, writePreferences } from './sheets.ts';

async function main() {
  const { sources } = await readPreferences();
  await writePreferences(sources, 6);
  console.log(`threshold -> 6, sources=${sources.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
