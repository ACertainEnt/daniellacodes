import type { Topic } from './topic-shape';
import { TOPICS_A } from './topics-a';
import { TOPICS_B } from './topics-b';
import { TOPICS_C } from './topics-c';

/** The complete plain-English teaching library. One entry per concept taught. */
export const TOPICS: Record<string, Topic> = { ...TOPICS_A, ...TOPICS_B, ...TOPICS_C };

export const topic = (key: string): Topic => {
  const found = TOPICS[key];
  if (!found) throw new Error(`Curriculum references unknown topic: ${key}`);
  return found;
};
