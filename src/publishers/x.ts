import type { PlatformPublisher } from './index.ts';

export const xPublisher: PlatformPublisher = {
  platform: 'x',
  async publish(content: string, title: string): Promise<string> {
    // ponytail: stub — X API v2 thread creation pending
    console.log(`[x] would publish thread: ${title.slice(0, 60)}`);
    return '';
  },
};
