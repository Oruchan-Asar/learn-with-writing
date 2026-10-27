import { describe, expect, it } from "vitest";
import { parseJson3 } from "./json3";

describe("parseJson3", () => {
  it("makes one cue per event for manual captions", () => {
    const cues = parseJson3({
      events: [
        { tStartMs: 1000, dDurationMs: 2500, segs: [{ utf8: "Hello there,\nfriend." }] },
        { tStartMs: 4000, dDurationMs: 1000, segs: [{ utf8: "How are you?" }] },
      ],
    });
    expect(cues).toEqual([
      { start: 1, end: 3.5, text: "Hello there, friend." },
      { start: 4, end: 5, text: "How are you?" },
    ]);
  });

  it("makes one cue per word when words carry their own offsets", () => {
    const cues = parseJson3({
      events: [
        {
          tStartMs: 2000,
          dDurationMs: 3000,
          segs: [{ utf8: "we" }, { utf8: " are", tOffsetMs: 400 }, { utf8: " here", tOffsetMs: 1000 }],
        },
      ],
    });
    expect(cues).toEqual([
      { start: 2, end: 2.4, text: "we" },
      { start: 2.4, end: 3, text: "are" },
      { start: 3, end: 5, text: "here" },
    ]);
  });

  it("skips newline-only events, events without text and events without a start", () => {
    const cues = parseJson3({
      events: [
        { tStartMs: 0, dDurationMs: 100 },
        { tStartMs: 100, dDurationMs: 100, segs: [{ utf8: "\n" }] },
        { dDurationMs: 100, segs: [{ utf8: "no start" }] },
        { tStartMs: 300, dDurationMs: 100, segs: [{ utf8: "kept" }] },
      ],
    });
    expect(cues).toEqual([{ start: 0.3, end: 0.4, text: "kept" }]);
  });

  it("handles a missing duration and an empty document", () => {
    expect(parseJson3({ events: [{ tStartMs: 500, segs: [{ utf8: "x" }] }] })).toEqual([
      { start: 0.5, end: 0.5, text: "x" },
    ]);
    expect(parseJson3({})).toEqual([]);
  });
});
