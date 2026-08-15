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
import { postAsUser, sendPhotoAsUser, sendAlbumAsUser, disconnectMTProto } from './mtproto.ts';
import { generateCase, generateCaseChatSlides } from './caseGen.ts';
import { renderCaseBoardCard } from './caseBoard.ts';
import { renderCaseChatSlide } from './caseChat.ts';
import { loadToneSamples } from './toneSamples.ts';
import type { Candidate, Source } from './types.ts';

const channel = process.env.POST_CHANNEL;

// Формат даты в ContentPlan: DD.MM.YYYY
function todayDMY(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

// Ссылка на пост в Telegram: работает только для каналов с публичным @username.
function postLink(messageId: number): string {
  const username = channel!.replace(/^@/, '');
  return `https://t.me/${username}/${messageId}`;
}

async function postAndRecord(
  postType: string,
  postText: string,
  sourceRef: string,
  preRenderedImage?: Buffer,
): Promise<string> {
  if (!channel) throw new Error('POST_CHANNEL env var missing');
  // Новости всегда без фото — картинка тут не несёт данных кейса/фичи,
  // не стоит того, чтобы зависеть от Replicate. Кейсы (детерминированная
  // доска) и фичи по-прежнему уважают SKIP_IMAGE.
  const skipImage = postType === 'новость' || process.env.SKIP_IMAGE === 'true';
  let imageUrl = '';
  let messageId: number;

  if (skipImage) {
    messageId = await postAsUser(channel, postText);
  } else if (preRenderedImage) {
    messageId = await sendPhotoAsUser(channel, preRenderedImage, postText);
    imageUrl = 'board';
  } else {
    const concept = await generateImageConcept(postText, postType);
    imageUrl = await generateImage(concept, postType);
    messageId = await sendPhotoAsUser(channel, imageUrl, postText);
  }

  await appendAutoPost({ postType, sourceUrl: sourceRef, imageUrl, channelPosted: channel!, status: 'success' });
  console.log(`posted [${postType}]: ${sourceRef.slice(0, 60)}`);
  return postLink(messageId);
}

// Спек: references/case-cards/case-chat-spec.md. Отдельным сообщением
// (альбомом, без подписи) сразу после доски кейса. Best-effort: если
// генерация/отправка упала — кейс всё равно считается опубликованным,
// доска и текст уже ушли, тут только теряем бонусные слайды.
async function postCaseChatSlides(niche: string, task: string, mechanics: string): Promise<void> {
  if (!channel) return;
  try {
    const slides = await generateCaseChatSlides(niche, task, mechanics);
    const images = await Promise.all(slides.map((s) => renderCaseChatSlide(s)));
    await sendAlbumAsUser(channel, images);
    console.log(`posted case-chat album: ${images.length} slides`);
  } catch (e) {
    console.error('case-chat slides failed (не критично, кейс уже опубликован):', e);
  }
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
      status: 'approved', post: '', postUrl: '',
    };
    const { postText, board, niche, task, mechanics } = await generateCase(fakeRow);
    const formatted = await formatPost(postText);
    const boardImage = await renderCaseBoardCard(board);
    await postAndRecord('кейс', formatted, `leadget:${testToken}`, boardImage);
    await postCaseChatSlides(niche, task, mechanics);
    return;
  }

  // TEST_NEWS_TEXT: прямой пост готового текста новости без ContentPlan
  const testNewsText = process.env.TEST_NEWS_TEXT;
  if (testNewsText) {
    console.log('TEST MODE: news text provided directly');
    const formatted = await formatPost(testNewsText);
    await postAndRecord('новость', formatted, 'test:news-direct');
    return;
  }

  // TEST_FEATURE_TITLE: прямой пост про фичу без ContentPlan
  const testFeatureTitle = process.env.TEST_FEATURE_TITLE;
  if (testFeatureTitle) {
    console.log(`TEST MODE: feature "${testFeatureTitle}"`);
    const fakeRow: ContentPlanRow = {
      rowNumber: -1, date: '', type: 'фича',
      title: testFeatureTitle,
      token: '',
      data: JSON.stringify({
        problem: process.env.TEST_FEATURE_PROBLEM ?? '',
        description: process.env.TEST_FEATURE_DESCRIPTION ?? '',
      }),
      status: 'approved', post: '', postUrl: '',
    };
    const rawPost = await handleFeature(fakeRow);
    const formatted = await formatPost(rawPost);
    await postAndRecord('фича', formatted, `feature:${testFeatureTitle}`);
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
  let boardImage: Buffer | undefined;
  let caseChatArgs: { niche: string; task: string; mechanics: string } | undefined;

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
      const { postText, board, niche, task, mechanics } = await generateCase(planRow);
      rawPost = postText;
      sourceRef = `leadget:${planRow.token}`;
      boardImage = await renderCaseBoardCard(board);
      caseChatArgs = { niche, task, mechanics };
    } else if (planRow.type === 'фича') {
      rawPost = await handleFeature(planRow);
      sourceRef = `feature:${planRow.title}`;
    } else {
      throw new Error(`неизвестный тип: ${planRow.type}`);
    }

    const formatted = await formatPost(rawPost);
    const postUrl = await postAndRecord(planRow.type, formatted, sourceRef, boardImage);
    await updateContentPlanRow(planRow.rowNumber, { status: 'posted', post: formatted, postUrl });
    if (newsRowNumber !== undefined) {
      await updateRow(newsRowNumber, { status: 'posted' });
    }
    if (caseChatArgs) {
      await postCaseChatSlides(caseChatArgs.niche, caseChatArgs.task, caseChatArgs.mechanics);
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
