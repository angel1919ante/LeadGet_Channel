// Разовый скрипт: перевыпуск конкретной новости (та же история, что была
// удалена) с обновлённым промптом — теперь показывает изъян чужой
// рекламной платформы, а не хвалит её. handleNews() в autopost.ts всегда
// САМ выбирает лучшую approved-новость из очереди, поэтому для повторной
// публикации именно ЭТОЙ истории собираем пост вручную, в обход очереди.
import { updateContentPlanRow } from './sheets.ts';
import { callLLM } from './llm.ts';
import { postPrompt } from './prompts.ts';
import { formatPost } from './formatter.ts';
import { postAsUser, disconnectMTProto } from './mtproto.ts';
import { loadToneSamples } from './toneSamples.ts';
import type { Candidate } from './types.ts';

const channel = process.env.POST_CHANNEL!;
const PLAN_ROW = 10;

const candidate: Candidate = {
  source: 'cossa',
  title: 'Рекламодатели заработали 1,5 млрд рублей благодаря инструменту, который сам находит самые прибыльные сделки',
  link: 'https://www.cossa.ru/news/350430/',
  rating: 0,
  description:
    'Яндекс Директ выпустил инструмент, который автоматически ищет и предлагает самые выгодные объявления для рекламодателей, и те заработали на этом 1,5 млрд рублей. ' +
    'Это важно, потому что теперь предприниматели могут тратить меньше времени на анализ данных и сразу получать готовые варианты для максимальной прибыли. ' +
    'Если вы занимаетесь рекламой, этот инструмент может помочь вам быстрее находить выгодные сделки и зарабатывать больше без дополнительных усилий.',
};

function postLink(messageId: number): string {
  const username = channel.replace(/^@/, '');
  return `https://t.me/${username}/${messageId}`;
}

async function main() {
  const tone = await loadToneSamples().catch(() => ({ ours: [], learn: [] }));
  const rawPost = await callLLM(postPrompt(candidate, tone));
  const withSource = `${rawPost}\n\nИсточник: ${candidate.link}`;
  const formatted = await formatPost(withSource);

  console.log('----- TEXT -----');
  console.log(formatted.replace(/<[^>]+>/g, ''));

  const messageId = await postAsUser(channel, formatted);
  const postUrl = postLink(messageId);
  console.log(`posted: ${postUrl}`);

  await updateContentPlanRow(PLAN_ROW, { status: 'posted', post: formatted, postUrl });
  console.log(`row ${PLAN_ROW} -> posted`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnectMTProto());
