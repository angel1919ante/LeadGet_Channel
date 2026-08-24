// Перегенерирует 4 тестовые статьи (rows 15-18 в Articles) под новые правила
// промпта (тон канала, фразеологизмы, запрет копипасты, запрет той же площадки).
// Пишет прямо в существующие строки, новых не создаёт.
import { getAllRows, updateArticleRow } from './sheets.ts';
import { callLLM } from './llm.ts';
import { articlePrompt, articlePromptFromTopic } from './articlePrompts.ts';
import { loadToneSamples } from './toneSamples.ts';
import type { Candidate, Source } from './types.ts';

async function main() {
  const tone = await loadToneSamples().catch(() => ({ ours: [], learn: [] }));
  const news = await getAllRows();

  const jobs: Array<{ articleRow: number; newsRow?: number; topic?: string; platform: 'habr' | 'vc' }> = [
    { articleRow: 15, topic: 'тестовая тема для проверки генерации статей', platform: 'vc' },
    { articleRow: 16, newsRow: 91, platform: 'habr' },
    { articleRow: 17, newsRow: 83, platform: 'habr' },
    { articleRow: 18, topic: 'почему автостратегии Яндекс Директа сливают бюджет', platform: 'habr' },
  ];

  for (const job of jobs) {
    let prompt;
    if (job.newsRow) {
      const row = news.find((r) => r.rowNumber === job.newsRow);
      if (!row) { console.error(`news row ${job.newsRow} not found, skip article ${job.articleRow}`); continue; }
      const candidate: Candidate = { source: row.source as Source, title: row.title, link: row.link, rating: row.rating, description: row.summary };
      prompt = articlePrompt(candidate, job.platform, tone);
    } else if (job.topic) {
      prompt = articlePromptFromTopic(job.topic, job.platform, tone);
    } else {
      continue;
    }

    const content = await callLLM(prompt);
    await updateArticleRow(job.articleRow, { content });
    console.log(`regenerated article row ${job.articleRow} (platform=${job.platform})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
