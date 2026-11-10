import { problem } from "../../platform/problem.js";

// oxlint-disable-next-line eslint/no-magic-numbers -- spec: a Заметка к Бронированию is at most 500 characters
const maximumNoteLength = 500;

// oxlint-disable-next-line unicorn/no-null -- an absent Заметка к Бронированию is stored and returned as null
const absentNote = null;

/**
 * Trims a Заметка к Бронированию at the application boundary. Blank becomes `null`, internal line breaks stay,
 * and a value longer than the limit after trimming is a `validation_failed` problem.
 */
const normalizeNote = (note: string | null | undefined): string | null => {
  if (note === null || note === undefined) {
    return absentNote;
  }
  const trimmed = note.trim();
  if (trimmed.length === 0) {
    return absentNote;
  }
  if (trimmed.length > maximumNoteLength) {
    throw problem(400, "validation_failed", [
      {
        message: `Заметка к Бронированию не может быть длиннее ${String(maximumNoteLength)} символов`,
        path: "/body/note",
      },
    ]);
  }
  return trimmed;
};

export { normalizeNote };
