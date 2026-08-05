import type { PlatformPublisher } from './index.ts';

export const dzenPublisher: PlatformPublisher = {
  platform: 'dzen',
  async publish(content: string, title: string): Promise<string> {
    // ponytail: stub — Яндекс Дзен API integration pending
    console.log(`[dzen] would publish: ${title.slice(0, 60)}`);
    return '';
  },
};
