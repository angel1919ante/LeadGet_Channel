// Разовый скрипт: перевыпуск той же новости — теперь с промптом, который
// не приписывает LeadGet чужие услуги (раньше CTA звал "перевести бюджет
// из Директа в Telegram", хотя LeadGet этим не занимается).
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { updateContentPlanRow } from './sheets.ts';
import { callLLM } from './llm.ts';
import { postPrompt } from './prompts.ts';
import { formatPost } from './formatter.ts';
import { loadToneSamples } from './toneSamples.ts';
import type { Candidate } from './types.ts';

const channel = process.env.POST_CHANNEL!;
const PLAN_ROW = 10;
const OLD_MESSAGE_ID = 76;

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
  const session = process.env.TELEGRAM_SESSION!;
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH!;
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 3 });
  await client.connect();

  await client.deleteMessages(channel, [OLD_MESSAGE_ID], { revoke: true });
  console.log(`deleted old message ${OLD_MESSAGE_ID}`);

  const tone = await loadToneSamples().catch(() => ({ ours: [], learn: [] }));
  const rawPost = await callLLM(postPrompt(candidate, tone));
  const withSource = `${rawPost}\n\nИсточник: ${candidate.link}`;
  const formatted = await formatPost(withSource);

  console.log('----- TEXT -----');
  console.log(formatted.replace(/<[^>]+>/g, ''));

  const msg = await client.sendMessage(channel, { message: formatted, parseMode: 'html' });
  const postUrl = postLink(msg.id);
  console.log(`posted: ${postUrl}`);

  await updateContentPlanRow(PLAN_ROW, { status: 'posted', post: formatted, postUrl });
  console.log(`row ${PLAN_ROW} -> posted`);

  await client.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
