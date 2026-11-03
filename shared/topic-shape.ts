import type { CodeSnippet } from './types';

/** One concept, taught from zero. The curriculum builder expands these into
 *  the mandatory 13-part lesson body. */
export interface Topic {
  title: string;
  /** Plain-English explanation. Never assumes a term has already been learnt. */
  plain: string;
  analogy?: string;
  /** Concrete, small steps a complete beginner can actually follow. */
  steps: string[];
  /** A true statement — used as the correct knowledge-check option. */
  truth: string;
  /** A believable misconception — used as a knowledge-check distractor. */
  myth: string;
  mistake: string;
  code?: {
    language: CodeSnippet['language'];
    title: string;
    code: string;
    notes: [number, string][];
  };
}
