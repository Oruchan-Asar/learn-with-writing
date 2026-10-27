export type MatchOptions = {
  caseSensitive: boolean;
  /** Accept "e" for "é", "c" for "ç" and so on. */
  ignoreAccents: boolean;
};

export const DEFAULT_MATCH_OPTIONS: MatchOptions = {
  caseSensitive: false,
  ignoreAccents: true,
};

// Characters that look alike but are hard or impossible to type on most keyboards.
const EQUIVALENTS: Record<string, string> = {
  "’": "'",
  "‘": "'",
  "`": "'",
  "´": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "-",
  "‐": "-",
};

/** Brings a character to the form it's compared in. */
export function normalizeChar(char: string, options: MatchOptions = DEFAULT_MATCH_OPTIONS): string {
  let c = EQUIVALENTS[char] ?? char;
  if (!options.caseSensitive) c = c.toLowerCase();
  if (options.ignoreAccents) c = c.normalize("NFD").replace(/\p{M}/gu, "");
  return c;
}

export function charsMatch(typed: string, expected: string, options: MatchOptions = DEFAULT_MATCH_OPTIONS): boolean {
  return normalizeChar(typed, options) === normalizeChar(expected, options);
}

/** Whether `typed` is exactly the word, character by character. */
export function wordMatches(typed: string, word: string, options: MatchOptions = DEFAULT_MATCH_OPTIONS): boolean {
  const a = [...typed];
  const b = [...word];
  return a.length === b.length && a.every((c, i) => charsMatch(c, b[i], options));
}
