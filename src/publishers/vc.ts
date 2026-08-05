import type { PlatformPublisher } from './index.ts';

export const vcPublisher: PlatformPublisher = {
  platform: 'vc',
  async publish(content: string, title: string): Promise<string> {
    // ponytail: stub — vc.ru API integration pending
    console.log(`[vc] would publish: ${title.slice(0, 60)}`);
    return '';
  },
};
