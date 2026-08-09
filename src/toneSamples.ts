import { fetchTelegramChannel, disconnectMTProto } from './mtproto.ts';

export interface ToneSamples {
  ours: string[];    // LeadGet_channel — основной голос
  learn: string[];   // внешние каналы — учёба
}

const OUR_CHANNEL = 'Leadget_channel';
const LEARN_CHANNELS = ['molyanov_blog', '+RTqYchZh5C81OTJi'];

// Берём тексты постов: 5 наших + 3 обучающих (достаточно для промпта)
export async function loadToneSamples(): Promise<ToneSamples> {
  if (!process.env.TELEGRAM_SESSION) {
    return { ours: [], learn: [] };
  }

  try {
    const [ourMsgs, ...learnMsgs] = await Promise.all([
      fetchTelegramChannel(OUR_CHANNEL, 10),
      ...LEARN_CHANNELS.map((ch) => fetchTelegramChannel(ch, 10).catch(() => [])),
    ]);

    const ours = ourMsgs
      .filter((m) => m.text.length > 100)
      .slice(0, 5)
      .map((m) => m.text.slice(0, 800));

    const learn = learnMsgs
      .flat()
      .filter((m) => m.text.length > 100)
      .slice(0, 3)
      .map((m) => m.text.slice(0, 800));

    return { ours, learn };
  } catch (e) {
    console.error('toneSamples fetch failed:', e);
    return { ours: [], learn: [] };
  } finally {
    await disconnectMTProto();
  }
}
