/** How one segment went. */
export type TypingResult = {
  words: number;
  /** Letters in the typed words, for words-per-minute. */
  chars: number;
  keystrokes: number;
  mistakes: number;
  hints: number;
  /** From the first keystroke (or hint) to the last. */
  durationMs: number;
  mistyped: string[];
};

export type SessionSummary = {
  segments: number;
  words: number;
  /** Words per minute while typing, with a "word" being 5 letters as usual. */
  wpm: number;
  /** Share of keystrokes that were right, 0 to 1. */
  accuracy: number;
  hints: number;
  typingMs: number;
  /** Words mistyped most often, most first. */
  mistyped: { word: string; count: number }[];
};

const MISTYPED_SHOWN = 8;

export function summarize(results: TypingResult[]): SessionSummary {
  const sum = (pick: (r: TypingResult) => number) => results.reduce((total, r) => total + pick(r), 0);
  const chars = sum((r) => r.chars);
  const keystrokes = sum((r) => r.keystrokes);
  const mistakes = sum((r) => r.mistakes);
  const typingMs = sum((r) => r.durationMs);

  const counts = new Map<string, number>();
  for (const word of results.flatMap((r) => r.mistyped)) {
    const key = word.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const mistyped = [...counts]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, MISTYPED_SHOWN);

  return {
    segments: results.length,
    words: sum((r) => r.words),
    wpm: typingMs > 0 ? chars / 5 / (typingMs / 60000) : 0,
    accuracy: keystrokes ? (keystrokes - mistakes) / keystrokes : 1,
    hints: sum((r) => r.hints),
    typingMs,
    mistyped,
  };
}
