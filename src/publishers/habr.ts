import type { PlatformPublisher } from './index.ts';

export const habrPublisher: PlatformPublisher = {
  platform: 'habr',
  async publish(content: string, title: string): Promise<string> {
    // ponytail: stub — Habr API requires account verification
    console.log(`[habr] would publish: ${title.slice(0, 60)}`);
    return '';
  },
};
