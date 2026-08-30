import {
  ensureArticleSheet,
  getAllRows,
  getArticleRows,
  appendArticles,
} from './sheets.ts';
import { callLLM } from './llm.ts';
import { sendLong } from './telegram.ts';
import { articlePrompt } from './articlePrompts.ts';
import { fetchArticleText } from './sources.ts';
import type { Platform } from './articleTypes.ts';
import type { Candidate, Source } from './types.ts';

const PLATFORM_LABEL: Record<Platform, string> = {
  habr: 'ХАБР',
  vc: 'VC.RU',
  dzen: 'ДЗЕН',
  x: 'X (TWITTER)',
  tenchat: 'TENCHAT',
  rbc: 'РБК',
};

const ALL_PLATFORMS: Platform[] = ['habr', 'vc', 'dzen', 'x', 'tenchat', 'rbc'];

function platformsFor(article: string): Platform[] {
  const v = article.trim().toLowerCase();
  if (v === 'все') return ALL_PLATFORMS;
  if ((ALL_PLATFORMS as string[]).includes(v)) return [v as Platform];
  return []; // 'нет' или пусто — статья не нужна
}

async function main(): Promise<void> {
  await ensureArticleSheet();

  // Кандидаты — новости из листа News, где владелец выбрал площадку в колонке "Статья"
  const news = await getAllRows();
  const selected = news.filter((r) => platformsFor(r.article).length > 0);

  if (selected.length === 0) {
    console.log('no news marked for article generation');
    return;
  }

  // Дедуп: не генерируем статью для той же новости+площадки повторно
  const existing = await getArticleRows();
  const seen = new Set(existing.map((r) => `${r.sourceUrl}|${r.platform}`));

  const toAppend: Array<{
    id: string;
    platform: string;
    sourceUrl: string;
    sourceTitle: string;
    content: string;
  }> = [];

  for (const row of selected) {
    const fullText = await fetchArticleText(row.link);
    const candidate: Candidate = {
      source: row.source as Source,
      title: row.title,
      link: row.link,
      rating: row.rating,
      description: fullText ?? row.summary,
    };

    for (const platform of platformsFor(row.article)) {
      if (seen.has(`${row.link}|${platform}`)) continue;
      try {
        const content = await callLLM(articlePrompt(candidate, platform));
        toAppend.push({
          id: `${Date.now()}-${platform}`,
          platform,
          sourceUrl: row.link,
          sourceTitle: row.title,
          content,
        });
        await sendLong(
          `📝 СТАТЬЯ ДЛЯ ${PLATFORM_LABEL[platform]}\nИсточник: ${row.link}`,
          content,
        );
        console.log(`generated [${platform}] for ${row.title.slice(0, 50)}`);
      } catch (e) {
        console.error(`article gen failed [${platform}] ${row.link}:`, e);
      }
    }
  }

  await appendArticles(toAppend);
  console.log(`appended ${toAppend.length} article rows`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
