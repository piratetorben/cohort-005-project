import { describeDraft as describe, type NoteDraft } from "./lib/draft";

export type { NoteDraft };

/**
 * What the Note editor shows for the text in the box: the character count
 * against the limit, whether it differs from the saved Note, and whether
 * Save is worth pressing.
 */
export function describeNoteDraft(
  draft: string,
  savedBody: string | null
): NoteDraft {
  return describe(draft, savedBody);
}
