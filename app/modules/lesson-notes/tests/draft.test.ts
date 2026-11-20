import { describe, expect, it } from "vitest";
import { describeNoteDraft } from "../index";
import { MAX_NOTE_LENGTH } from "~/lib/notes";

describe("describeNoteDraft", () => {
  it("cannot save an empty box", () => {
    const draft = describeNoteDraft("   \n ", null);
    expect(draft).toMatchObject({
      length: 0,
      empty: true,
      unsaved: false,
      canSave: false,
    });
  });

  it("can save a first Note", () => {
    const draft = describeNoteDraft("Remember tsc --init", null);
    expect(draft).toEqual({
      length: 19,
      limit: MAX_NOTE_LENGTH,
      tooLong: false,
      empty: false,
      unsaved: true,
      canSave: true,
    });
  });

  it("has nothing to save when the box matches the saved Note", () => {
    const draft = describeNoteDraft("  same text \n", "same text");
    expect(draft).toMatchObject({ unsaved: false, canSave: false });
  });

  it("can save an edit to a saved Note", () => {
    const draft = describeNoteDraft("new text", "old text");
    expect(draft).toMatchObject({ unsaved: true, canSave: true });
  });

  it("counts the trimmed body, as the server does", () => {
    expect(describeNoteDraft("  abc  ", null).length).toBe(3);
  });

  it("allows exactly the limit", () => {
    const draft = describeNoteDraft("a".repeat(MAX_NOTE_LENGTH), null);
    expect(draft).toMatchObject({ tooLong: false, canSave: true });
  });

  it("refuses one character over the limit", () => {
    const draft = describeNoteDraft("a".repeat(MAX_NOTE_LENGTH + 1), null);
    expect(draft).toMatchObject({
      length: MAX_NOTE_LENGTH + 1,
      tooLong: true,
      canSave: false,
    });
  });
});
