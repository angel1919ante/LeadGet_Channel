import type { Platform } from '../articleTypes.ts';

export interface PlatformPublisher {
  platform: Platform;
  publish(content: string, title: string): Promise<string>; // returns published URL
}
