import { describe, expect, it } from "vitest";
import { cleanCaptionText, normalizeCues, segmentCues } from "./segmenter";
import type { Cue } from "./types";

/** Builds back-to-back cues, each `duration` seconds long. */
function cuesFrom(lines: string[], duration = 2, startAt = 0): Cue[] {
  return lines.map((text, i) => ({ start: startAt + i * duration, end: startAt + (i + 1) * duration, text }));
}

/** One cue per word, like auto-generated captions, with no punctuation. */
function wordCues(count: number, wordDuration = 0.3): Cue[] {
  return Array.from({ length: count }, (_, i) => ({
    start: i * wordDuration,
    end: (i + 1) * wordDuration,
    text: `w${i}`,
  }));
}

const texts = (cues: Cue[], options = {}) => segmentCues(cues, options).map((s) => s.text);

describe("cleanCaptionText", () => {
  it.each([
    ["it&#39;s &amp; that&quot;s", `it's & that"s`],
    ["caf&#xe9; &nbsp;time", "café time"],
    ["[Music] hello [Applause]", "hello"],
    ["(laughs) okay then", "okay then"],
    ["♪ la la la ♪ and we're back", "and we're back"],
    ["♫ hello", "hello"],
    [">> So what now?", "So what now?"],
    ["JOHN: I think so.", "I think so."],
    ["- Are you sure?", "Are you sure?"],
    ["  lots   of\n spaces ", "lots of spaces"],
    ["[Music]", ""],
  ])("cleans %j", (input, expected) => {
    expect(cleanCaptionText(input)).toBe(expected);
  });

  it("keeps an unknown entity and normal colons", () => {
    expect(cleanCaptionText("a &bogus; b")).toBe("a &bogus; b");
    expect(cleanCaptionText("the ratio is 3:1")).toBe("the ratio is 3:1");
  });
});

describe("normalizeCues", () => {
  it("sorts cues, clips overlaps and drops empty ones", () => {
    expect(
      normalizeCues([
        { start: 3, end: 6, text: "second" },
        { start: 0, end: 4, text: "first" },
        { start: 5, end: 7, text: "[Music]" },
      ]),
    ).toEqual([
      { start: 0, end: 3, text: "first" },
      { start: 3, end: 6, text: "second" },
    ]);
  });

  it("doesn't clip a cue to a next cue that starts at the same time", () => {
    expect(
      normalizeCues([
        { start: 1, end: 2, text: "a" },
        { start: 1, end: 3, text: "b" },
      ]),
    ).toEqual([
      { start: 1, end: 2, text: "a" },
      { start: 1, end: 3, text: "b" },
    ]);
  });
});

describe("segmentCues", () => {
  it("merges cues into whole sentences", () => {
    expect(texts(cuesFrom(["This is the first", "sentence here.", "And here is", "the second one."]))).toEqual([
      "This is the first sentence here.",
      "And here is the second one.",
    ]);
  });

  it("splits a cue that holds two sentences", () => {
    expect(texts(cuesFrom(["We went home. Then we slept well."], 4))).toEqual([
      "We went home.",
      "Then we slept well.",
    ]);
  });

  it("keeps very short sentences with the next one", () => {
    expect(texts(cuesFrom(["Okay.", "Let's get started now."]))).toEqual(["Okay. Let's get started now."]);
  });

  it("doesn't end a sentence at an abbreviation", () => {
    expect(texts(cuesFrom(["I met Dr. Smith", "at the station."]))).toEqual(["I met Dr. Smith at the station."]);
  });

  it("closes a segment at a long pause even without punctuation", () => {
    const cues: Cue[] = [
      { start: 0, end: 1, text: "so we" },
      { start: 1, end: 2, text: "begin here" },
      { start: 5, end: 6, text: "and continue" },
    ];
    expect(texts(cues)).toEqual(["so we begin here", "and continue"]);
  });

  it("splits long unpunctuated captions by word count", () => {
    const segments = segmentCues(wordCues(40, 0.1));
    expect(segments.map((s) => s.text.split(" ").length)).toEqual([18, 18, 4]);
  });

  it("splits long unpunctuated captions by duration", () => {
    const segments = segmentCues(wordCues(12, 1));
    expect(segments.map((s) => s.text.split(" ").length)).toEqual([8, 4]);
    expect(segments.every((s) => s.end - s.start <= 8)).toBe(true);
  });

  it("prefers to split a long segment at its last comma", () => {
    const words = "one two three four five six seven, eight nine ten eleven twelve".split(" ");
    const cues = words.map((text, i) => ({ start: i * 0.2, end: (i + 1) * 0.2, text }));
    expect(texts(cues, { maxWords: 10 })).toEqual([
      "one two three four five six seven,",
      "eight nine ten eleven twelve",
    ]);
  });

  it("times segments from their words and numbers them in order", () => {
    const segments = segmentCues(cuesFrom(["First sentence goes here.", "Second sentence goes here."], 3, 10));
    expect(segments.map(({ id, text }) => ({ id, text }))).toEqual([
      { id: 0, text: "First sentence goes here." },
      { id: 1, text: "Second sentence goes here." },
    ]);
    expect(segments[0].start).toBeCloseTo(10);
    expect(segments[0].end).toBeCloseTo(13);
    expect(segments[1].start).toBeCloseTo(13);
    expect(segments[1].end).toBeCloseTo(16);
  });

  it("times words inside a cue in proportion to their length", () => {
    // Each word weighs its length plus one: 17 of the 39 units are in the first sentence.
    const [first, second] = segmentCues([{ start: 0, end: 10, text: "Hi there friend. Lovely morning today!" }]);
    expect(first.text).toBe("Hi there friend.");
    expect(first.end).toBeCloseTo(second.start);
    expect(first.end).toBeCloseTo((17 / 39) * 10);
  });

  it("returns nothing for empty or non-speech input", () => {
    expect(segmentCues([])).toEqual([]);
    expect(segmentCues(cuesFrom(["[Music]", "♪ ♪"]))).toEqual([]);
  });
});
