import { MAX_NOTE_LENGTH } from "~/lib/notes";

export type NoteDraft = {
  /** Characters counted against the limit: the server saves the trimmed body. */
  length: number;
  limit: number;
  tooLong: boolean;
  empty: boolean;
  /** The trimmed draft differs from the saved body, which the server stored trimmed. */
  unsaved: boolean;
  canSave: boolean;
};

export function describeDraft(
  draft: string,
  savedBody: string | null
): NoteDraft {
  const trimmed = draft.trim();
  const length = trimmed.length;
  const tooLong = length > MAX_NOTE_LENGTH;
  const empty = length === 0;
  const unsaved = trimmed !== (savedBody ?? "");
  return {
    length,
    limit: MAX_NOTE_LENGTH,
    tooLong,
    empty,
    unsaved,
    canSave: unsaved && !empty && !tooLong,
  };
}
