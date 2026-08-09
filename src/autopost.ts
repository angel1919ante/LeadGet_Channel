import {
  ensureHeader,
  getAllRows,
  updateRow,
  ensureAutoPostsSheet,
  appendAutoPost,
  ensureContentPlanSheet,
  getContentPlanRows,
  updateContentPlanRow,
  ensureFeaturesSheet,
  ensureCasesSheet,
  type ContentPlanRow,
} from './sheets.ts';
import { callLLM } from './llm.ts';
import { postPrompt, featurePostPrompt } from './prompts.ts';
import { generateImageConcept, generateImage } from './imageGen.ts';
import { formatPost } from './formatter.ts';
import { postAsUser, sendPhotoAsUser, disconnectMTProto } from './mtproto.ts';
import { generateCasePost } from './caseGen.ts';
import { loadToneSamples } from './toneSamples.ts';
import type { Candidate, Source } from './types.ts';

const channel = process.env.POST_CHANNEL;

// Формат даты в ContentPlan: DD.MM.YYYY
function todayDMY(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

async function postAndRecord(
  postType: string,
  postText: string,
  sourceRef: string,
): Promise<void> {
  if (!channel) throw new Error('POST_CHANNEL env var missing');
  const skipImage = process.env.SKIP_IMAGE === 'true';
  let imageUrl = '';

  if (skipImage) {
    await postAsUser(channel, postText);
  } else {
    const concept = await generateImageConcept(postText, postType);
    imageUrl = await generateImage(concept, postType);
    await sendPhotoAsUser(channel, imageUrl, postText);
  }

  await appendAutoPost({ postType, sourceUrl: sourceRef, imageUrl, channelPosted: channel!, status: 'success' });
  console.log(`posted [${postType}]: ${sourceRef.slice(0, 60)}`);
}

interface NewsResult {
  rawPost: string;
  link: string;
  title: string;
  summary: string;
  rowNumber: number;
}

async function handleNews(planRow: ContentPlanRow): Promise<NewsResult> {
  const news = await getAllRows();
  const alreadyPosted = new Set(
    (await import('./sheets.ts').then((m) => m.getAutoPostRows()))
      .filter((r) => r.status === 'success')
      .map((r) => r.sourceUrl),
  );

  const candidate = [...news]
    .filter((r) => r.status === 'approved' && !alreadyPosted.has(r.link))
    .sort((a, b) => b.rating - a.rating)[0];

  if (!candidate) throw new Error('нет одобренных новостей для автопоста');

  const c: Candidate = {
    source: candidate.source as Source,
    title: candidate.title,
    link: candidate.link,
    rating: candidate.rating,
    description: candidate.summary,
  };
  const tone = await loadToneSamples().catch(() => ({ ours: [], learn: [] }));
  const rawPost = await callLLM(postPrompt(c, tone));
  return { rawPost, link: candidate.link, title: candidate.title, summary: candidate.summary, rowNumber: candidate.rowNumber };
}

async function handleFeature(planRow: ContentPlanRow): Promise<string> {
  let data: Record<string, string> = {};
  try {
    data = planRow.data ? JSON.parse(planRow.data) : {};
  } catch {
    console.warn('ContentPlan Данные не JSON');
  }
  const problem = data.problem ?? '';
  const description = data.description ?? '';
  if (!problem || !description) throw new Error('для фичи нужны поля problem и description в Данных');
  return callLLM(featurePostPrompt(planRow.title, problem, description));
}

async function main(): Promise<void> {
  if (!channel) throw new Error('POST_CHANNEL env var missing');

  await Promise.all([
    ensureHeader(),
    ensureAutoPostsSheet(),
    ensureContentPlanSheet(),
    ensureFeaturesSheet(),
    ensureCasesSheet(),
  ]);

  // TEST_CASE_TOKEN: прямой тест кейса без ContentPlan
  const testToken = process.env.TEST_CASE_TOKEN;
  if (testToken) {
    console.log(`TEST MODE: case token=${testToken}`);
    const fakeRow: ContentPlanRow = {
      rowNumber: -1, date: '', type: 'кейс',
      title: process.env.TEST_CASE_TITLE ?? 'Тест',
      token: testToken,
      data: process.env.TEST_CASE_DATA ?? '{}',
      status: 'approved', post: '',
    };
    const rawPost = await generateCasePost(fakeRow);
    const formatted = await formatPost(rawPost);
    await postAndRecord('кейс', formatted, `leadget:${testToken}`);
    return;
  }

  const today = todayDMY();
  console.log(`autopost: today=${today}`);

  const plans = await getContentPlanRows();
  const planRow = plans.find((r) => r.date === today && r.status === 'approved');

  if (!planRow) {
    console.log(`нет approved строки в ContentPlan на ${today}`);
    return;
  }

  console.log(`plan: type=${planRow.type} title="${planRow.title}"`);

  let rawPost: string;
  let sourceRef: string;
  let newsRowNumber: number | undefined;

  try {
    if (planRow.type === 'новость') {
      const news = await handleNews(planRow);
      // Записываем в план выбранную новость — чтобы было видно саммари и ссылку
      await updateContentPlanRow(planRow.rowNumber, {
        title: news.title,
        data: JSON.stringify({ link: news.link, summary: news.summary }),
      });
      // Ссылка на источник всегда в конце поста
      rawPost = `${news.rawPost}\n\nИсточник: ${news.link}`;
      sourceRef = news.link;
      newsRowNumber = news.rowNumber;
    } else if (planRow.type === 'кейс') {
      if (!planRow.token) throw new Error('для кейса нужен Токен в ContentPlan');
      rawPost = await generateCasePost(planRow);
      sourceRef = `leadget:${planRow.token}`;
    } else if (planRow.type === 'фича') {
      rawPost = await handleFeature(planRow);
      sourceRef = `feature:${planRow.title}`;
    } else {
      throw new Error(`неизвестный тип: ${planRow.type}`);
    }

    const formatted = await formatPost(rawPost);
    await postAndRecord(planRow.type, formatted, sourceRef);
    await updateContentPlanRow(planRow.rowNumber, { status: 'posted', post: formatted });
    if (newsRowNumber !== undefined) {
      await updateRow(newsRowNumber, { status: 'posted' });
    }
  } catch (e) {
    console.error('autopost failed:', e);
    await updateContentPlanRow(planRow.rowNumber, { status: 'error' });
    await appendAutoPost({
      postType: planRow.type,
      sourceUrl: planRow.title,
      imageUrl: '',
      channelPosted: channel,
      status: 'error',
    });
    throw e;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnectMTProto());
