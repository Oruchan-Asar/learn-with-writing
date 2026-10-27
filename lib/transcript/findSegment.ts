import type { Segment } from "./types";

/**
 * Index of the segment for `time`: the last one that has started by then, or
 * -1 before the first. Segments must be sorted by start. Binary search, since
 * this runs on every tick of the player clock.
 */
export function findSegmentIndex(segments: Segment[], time: number): number {
  let lo = 0;
  let hi = segments.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segments[mid].start <= time) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}
