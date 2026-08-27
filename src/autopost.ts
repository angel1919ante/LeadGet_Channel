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
import { generateCase } from './caseGen.ts';
import { renderCaseBoardCard } from './caseBoard.ts';
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
  forceNoImage?: boolean,
): Promise<string> {
  if (!channel) throw new Error('POST_CHANNEL env var missing');
  // Новости всегда без фото — картинка тут не несёт данных кейса/фичи,
  // не стоит того, чтобы зависеть от Replicate. Кейсы (детерминированная
  // доска) и фичи по-прежнему уважают SKIP_IMAGE, плюс кейс может явно
  // попросить "без фото" через forceNoImage (см. data.withPhoto в плане).
  const skipImage = postType === 'новость' || forceNoImage || process.env.SKIP_IMAGE === 'true';
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
  if (!problem || !description) throw new Error('Недостаточно информации: для фичи нужны поля problem и description в Данных');
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
    const { postText, board } = await generateCase(fakeRow);
    const formatted = await formatPost(postText);
    const boardImage = await renderCaseBoardCard(board);
    await postAndRecord('кейс', formatted, `leadget:${testToken}`, boardImage);
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

  // FORCE_ROW: публикация конкретной строки плана по кнопке "Опубликовать
  // сейчас" в панели — вне очереди, независимо от даты строки.
  const forceRow = process.env.FORCE_ROW ? Number(process.env.FORCE_ROW) : undefined;
  // DRAFT_ROW: сгенерировать текст в черновик (кнопка "Черновик" в панели),
  // НЕ публикуя — чтобы можно было прочитать и поправить руками до выхода.
  const draftRow = process.env.DRAFT_ROW ? Number(process.env.DRAFT_ROW) : undefined;

  const plans = await getContentPlanRows();
  let planRow: ContentPlanRow | undefined;

  if (draftRow !== undefined) {
    planRow = plans.find((r) => r.rowNumber === draftRow);
    if (!planRow) {
      console.log(`DRAFT_ROW=${draftRow}: строка не найдена в ContentPlan`);
      return;
    }
    console.log(`DRAFT_ROW=${draftRow}: генерируем черновик без публикации`);
  } else if (forceRow !== undefined) {
    planRow = plans.find((r) => r.rowNumber === forceRow);
    if (!planRow) {
      console.log(`FORCE_ROW=${forceRow}: строка не найдена в ContentPlan`);
      return;
    }
    console.log(`FORCE_ROW=${forceRow}: публикуем вне очереди`);
  } else {
    const today = todayDMY();
    console.log(`autopost: today=${today}`);
    planRow = plans.find((r) => r.date === today && ['approved', 'draft'].includes(r.status));
    if (!planRow) {
      console.log(`нет approved/draft строки в ContentPlan на ${today}`);
      return;
    }
  }

  const isDraftMode = draftRow !== undefined;
  // Готовый (возможно отредактированный вручную) черновик публикуем как есть —
  // не перегенерируем, иначе правки пользователя молча потеряются.
  const useExistingDraft = !isDraftMode && planRow.status === 'draft' && !!planRow.post.trim();

  console.log(`plan: type=${planRow.type} title="${planRow.title}"`);

  let rawPost: string;
  let sourceRef: string;
  let newsRowNumber: number | undefined;
  let boardImage: Buffer | undefined;
  let forceNoImage = false;
  let caseData: Record<string, unknown> | undefined;
  let caseWithPhoto = false;

  try {
    if (planRow.type === 'новость') {
      if (useExistingDraft) {
        rawPost = planRow.post;
        let planData: Record<string, unknown> = {};
        try { planData = planRow.data ? JSON.parse(planRow.data) : {}; } catch { /* пусто */ }
        sourceRef = String(planData.link ?? `news:${planRow.title}`);
        // newsRow сохранён на этапе черновика — иначе эта же новость из листа
        // News осталась бы approved и могла уйти во второй пост повторно.
        if (typeof planData.newsRow === 'number') newsRowNumber = planData.newsRow;
      } else {
        const news = await handleNews(planRow);
        // Записываем в план выбранную новость — чтобы было видно саммари и ссылку
        await updateContentPlanRow(planRow.rowNumber, {
          title: news.title,
          data: JSON.stringify({ link: news.link, summary: news.summary, newsRow: news.rowNumber }),
        });
        rawPost = news.rawPost;
        sourceRef = news.link;
        newsRowNumber = news.rowNumber;
      }
    } else if (planRow.type === 'кейс') {
      if (!planRow.token) throw new Error('Недостаточно информации: для кейса нужен Токен в ContentPlan');
      // Борд с цифрами нужен всегда, текст — только если черновика ещё нет.
      const { postText, board } = await generateCase(planRow, useExistingDraft);
      rawPost = useExistingDraft ? planRow.post : postText;
      sourceRef = `leadget:${planRow.token}`;

      // Переключатель "с фото / без фото" — data.withPhoto в ContentPlan.Данные,
      // по умолчанию true. Без фото — доски нет.
      let planData: Record<string, unknown> = {};
      try { planData = planRow.data ? JSON.parse(planRow.data) : {}; } catch { /* см. лог ниже по коду */ }
      const withPhoto = planData.withPhoto !== false;
      caseData = planData;
      caseWithPhoto = withPhoto;

      if (withPhoto) {
        boardImage = await renderCaseBoardCard(board);
      } else {
        forceNoImage = true;
      }
    } else if (planRow.type === 'фича') {
      rawPost = useExistingDraft ? planRow.post : await handleFeature(planRow);
      sourceRef = `feature:${planRow.title}`;
    } else {
      throw new Error(`неизвестный тип: ${planRow.type}`);
    }

    // Уже отформатированный черновик не прогоняем через formatPost повторно —
    // иначе HTML-теги из него экранируются/ломаются на второй проход.
    const formatted = useExistingDraft ? rawPost : await formatPost(rawPost);

    if (isDraftMode) {
      await updateContentPlanRow(planRow.rowNumber, { status: 'draft', post: formatted });
      console.log(`draft ready for row ${planRow.rowNumber} (${formatted.length} симв.), не публикуем`);
      return;
    }

    const postUrl = await postAndRecord(planRow.type, formatted, sourceRef, boardImage, forceNoImage);
    await updateContentPlanRow(planRow.rowNumber, { status: 'posted', post: formatted, postUrl });
    if (newsRowNumber !== undefined) {
      await updateRow(newsRowNumber, { status: 'posted' });
    }
    if (planRow.type === 'кейс') {
      // Панель показывает алерт, если превью-доска не запостилась (withPhoto=false).
      // Диалоги переписки НЕ генерируем — LeadGet API не отдаёт реальный
      // транскрипт, а придумывать его от лица клиента нечестно.
      await updateContentPlanRow(planRow.rowNumber, {
        data: JSON.stringify({ ...caseData, boardPosted: caseWithPhoto }),
      });
    }
  } catch (e) {
    console.error('autopost failed:', e);
    // Сохраняем причину прямо в план — панель показывает post-текст и для
    // status=error, не нужно лезть в логи GitHub Actions, чтобы понять,
    // почему не запостилось (обычно это "недостаточно информации: ...").
    const reason = e instanceof Error ? e.message : String(e);
    await updateContentPlanRow(planRow.rowNumber, { status: 'error', post: reason });
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
