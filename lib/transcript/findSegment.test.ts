import { describe, expect, it } from "vitest";
import { findSegmentIndex } from "./findSegment";
import type { Segment } from "./types";

const seg = (id: number, start: number, end: number): Segment => ({ id, start, end, text: `s${id}` });
const segments = [seg(0, 1, 3), seg(1, 3, 5), seg(2, 8, 10)];

describe("findSegmentIndex", () => {
  it.each([
    [0, -1],
    [0.99, -1],
    [1, 0],
    [2.5, 0],
    [3, 1],
    [6, 1], // in the gap after segment 1, it stays current
    [8, 2],
    [100, 2],
  ])("at %s seconds returns %s", (time, index) => {
    expect(findSegmentIndex(segments, time)).toBe(index);
  });

  it("returns -1 for no segments", () => {
    expect(findSegmentIndex([], 5)).toBe(-1);
  });
});
