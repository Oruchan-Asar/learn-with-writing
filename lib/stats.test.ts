import { describe, expect, it } from "vitest";
import { summarize, type TypingResult } from "./stats";

const result = (overrides: Partial<TypingResult> = {}): TypingResult => ({
  words: 5,
  chars: 25,
  keystrokes: 25,
  mistakes: 0,
  hints: 0,
  durationMs: 15000,
  mistyped: [],
  ...overrides,
});

describe("summarize", () => {
  it("computes words per minute from letters and typing time", () => {
    // 50 letters = 10 "words" in 30 seconds = 20 wpm.
    expect(summarize([result(), result()]).wpm).toBeCloseTo(20);
  });

  it("computes accuracy over all keystrokes", () => {
    const s = summarize([result({ keystrokes: 30, mistakes: 3 }), result({ keystrokes: 10, mistakes: 1 })]);
    expect(s.accuracy).toBeCloseTo(36 / 40);
  });

  it("adds up segments, words, hints and time", () => {
    const s = summarize([result({ hints: 2 }), result({ words: 3, hints: 1, durationMs: 5000 })]);
    expect(s).toMatchObject({ segments: 2, words: 8, hints: 3, typingMs: 20000 });
  });

  it("ranks mistyped words across segments, ignoring case", () => {
    const s = summarize([
      result({ mistyped: ["The", "network"] }),
      result({ mistyped: ["the", "layer"] }),
      result({ mistyped: ["network", "the"] }),
    ]);
    expect(s.mistyped).toEqual([
      { word: "the", count: 3 },
      { word: "network", count: 2 },
      { word: "layer", count: 1 },
    ]);
  });

  it("is sensible with no results or no typing time", () => {
    expect(summarize([])).toMatchObject({ segments: 0, wpm: 0, accuracy: 1, mistyped: [] });
    expect(summarize([result({ durationMs: 0 })]).wpm).toBe(0);
  });
});
