export type Token = {
  /** Words are typed by the user; punctuation is shown and filled in automatically. */
  kind: "word" | "punct";
  text: string;
  /** Whether a space comes before this token when the text is shown. */
  spaceBefore: boolean;
};

// A word starts and ends with a letter or digit, and may contain apostrophes,
// hyphens, dots or commas between them: don't, well-known, 3.5, 1,000, U.S
const WORD = /[\p{L}\p{N}]+(?:['’.,\-][\p{L}\p{N}]+)*/gu;

/** Splits a segment's text into word and punctuation tokens. */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];

  for (const chunk of text.split(/\s+/).filter(Boolean)) {
    let spaceBefore = tokens.length > 0;
    let last = 0;
    const push = (kind: Token["kind"], part: string) => {
      tokens.push({ kind, text: part, spaceBefore });
      spaceBefore = false;
    };

    for (const match of chunk.matchAll(WORD)) {
      if (match.index > last) push("punct", chunk.slice(last, match.index));
      push("word", match[0]);
      last = match.index + match[0].length;
    }
    if (last < chunk.length) push("punct", chunk.slice(last));
  }

  return tokens;
}
