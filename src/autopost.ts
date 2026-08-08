import { ensureHeader, getAllRows, ensureAutoPostsSheet, getAutoPostRows, appendAutoPost } from './sheets.ts';
import { callLLM } from './llm.ts';
import { postPrompt } from './prompts.ts';
import { generateImageConcept, generateImage } from './imageGen.ts';
import { formatPost } from './formatter.ts';
import { sendPhotoToChannel } from './telegram.ts';
import type { Candidate, Source } from './types.ts';

// Этап 1: только новостные посты, только тестовый канал.
const POST_TYPE = 'новость';

async function main(): Promise<void> {
  await ensureHeader();
  await ensureAutoPostsSheet();

  const channel = process.env.POST_CHANNEL;
  if (!channel) throw new Error('POST_CHANNEL env var missing');

  const news = await getAllRows();
  const posted = await getAutoPostRows();
  const alreadyPosted = new Set(posted.map((r) => r.sourceUrl));

  // Берём лучшую одобренную новость, которую ещё не автопостили.
  const candidateRow = [...news]
    .filter((r) => r.status === 'approved' && !alreadyPosted.has(r.link))
    .sort((a, b) => b.rating - a.rating)[0];

  if (!candidateRow) {
    console.log('no approved candidates for autopost');
    return;
  }

  const candidate: Candidate = {
    source: candidateRow.source as Source,
    title: candidateRow.title,
    link: candidateRow.link,
    rating: candidateRow.rating,
    description: candidateRow.summary,
  };

  try {
    const rawPost = await callLLM(postPrompt(candidate));
    const formatted = await formatPost(rawPost);
    const concept = await generateImageConcept(rawPost, POST_TYPE);
    const imageUrl = await generateImage(concept, POST_TYPE);

    await sendPhotoToChannel(channel, imageUrl, formatted);

    await appendAutoPost({
      postType: POST_TYPE,
      sourceUrl: candidateRow.link,
      imageUrl,
      channelPosted: channel,
      status: 'success',
    });
    console.log(`autoposted: ${candidateRow.title.slice(0, 60)}`);
  } catch (e) {
    console.error('autopost failed:', e);
    await appendAutoPost({
      postType: POST_TYPE,
      sourceUrl: candidateRow.link,
      imageUrl: '',
      channelPosted: channel,
      status: 'error',
    });
    throw e;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
