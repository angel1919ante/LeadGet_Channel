import { getAllRows, updateRow } from './sheets.ts';
import { callLLM } from './llm.ts';
import { postPrompt } from './prompts.ts';
import { postToChannel } from './telegram.ts';
import { loadToneSamples } from './toneSamples.ts';
import { disconnectMTProto } from './mtproto.ts';
import type { Candidate, Source } from './types.ts';

async function main(): Promise<void> {
  const rows = await getAllRows();
  const approved = rows.filter((r) => r.status === 'approved');
  console.log(`approved rows to publish: ${approved.length}`);
  if (!approved.length) return;

  const tone = await loadToneSamples().catch(() => ({ ours: [], learn: [] }));
  console.log(`tone samples: ours=${tone.ours.length} learn=${tone.learn.length}`);

  for (const r of approved) {
    const candidate: Candidate = {
      source: r.source as Source,
      title: r.title,
      link: r.link,
      rating: r.rating,
      description: r.summary,
    };

    let post = r.post;
    try {
      if (!post) post = await callLLM(postPrompt(candidate, tone));
      await postToChannel(post);
      await updateRow(r.rowNumber, { post, status: 'posted' });
      console.log(`posted row ${r.rowNumber}: ${r.title.slice(0, 60)}`);
    } catch (e) {
      console.error(`publish failed for row ${r.rowNumber}:`, e);
      await updateRow(r.rowNumber, { post, status: 'error' });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnectMTProto());
