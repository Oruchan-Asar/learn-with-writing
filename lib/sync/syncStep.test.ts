import { describe, expect, it } from "vitest";
import type { Segment } from "@/lib/transcript/types";
import {
  completeSegment,
  initialSyncState,
  pauseLead,
  selectSegment,
  syncStep,
  type PlayerSample,
  type SyncState,
} from "./syncStep";

const seg = (id: number, start: number, end: number): Segment => ({ id, start, end, text: `s${id}` });
// A gap of silence between segments 1 and 2.
const segments = [seg(0, 1, 4), seg(1, 4, 7), seg(2, 10, 13)];

const playing = (time: number, rate = 1): PlayerSample => ({ time, playing: true, rate });
const paused = (time: number): PlayerSample => ({ time, playing: false, rate: 1 });
const state = (overrides: Partial<SyncState> = {}): SyncState => ({
  index: 0,
  done: false,
  pausedByApp: false,
  lastTime: 0,
  ...overrides,
});

/** Runs ticks one after another, collecting whether each one paused. */
function run(start: SyncState, samples: PlayerSample[]) {
  let s = start;
  const pauses: boolean[] = [];
  for (const sample of samples) {
    const r = syncStep(s, sample, segments);
    s = r.state;
    pauses.push(r.pause);
  }
  return { state: s, pauses };
}

describe("syncStep", () => {
  it("starts on the segment at the current time", () => {
    expect(syncStep(initialSyncState(), paused(0), segments).state.index).toBe(0);
    expect(syncStep(initialSyncState(), paused(5), segments).state.index).toBe(1);
    expect(syncStep(initialSyncState(), paused(11), segments).state.index).toBe(2);
  });

  it("pauses at the end of a segment that isn't typed yet", () => {
    const { state: s, pauses } = run(state({ lastTime: 3.5 }), [playing(3.6), playing(3.9)]);
    expect(pauses).toEqual([false, true]);
    expect(s.pausedByApp).toBe(true);
    expect(s.index).toBe(0);
  });

  it("pauses earlier at faster playback", () => {
    const t = 4 - pauseLead(1) - 0.02; // just before the 1× pause point
    expect(syncStep(state({ lastTime: t - 0.05 }), playing(t, 1), segments).pause).toBe(false);
    expect(syncStep(state({ lastTime: t - 0.05 }), playing(t, 2), segments).pause).toBe(true);
  });

  it("doesn't pause a video that isn't playing", () => {
    expect(syncStep(state({ lastTime: 3.95 }), paused(3.95), segments).pause).toBe(false);
  });

  it("keeps playing once the segment is typed, and moves on at the next one", () => {
    const { state: s, pauses } = run(state({ done: true, lastTime: 3.5 }), [playing(3.9), playing(3.96), playing(4.0)]);
    expect(pauses).toEqual([false, false, false]);
    expect(s.index).toBe(1);
    expect(s.done).toBe(false);
  });

  it("waits through a gap before moving to the next segment", () => {
    const { state: s } = run(state({ index: 1, done: true, lastTime: 6.5 }), [playing(7), playing(7.5), playing(8)]);
    expect(s.index).toBe(1);
    expect(s.done).toBe(true);
  });

  it("stays done after the last segment", () => {
    const { state: s, pauses } = run(state({ index: 2, done: true, lastTime: 12.9 }), [playing(13), playing(13.5)]);
    expect(s).toMatchObject({ index: 2, done: true });
    expect(pauses).toEqual([false, false]);
  });

  it("follows a seek to another segment and starts it fresh", () => {
    const r = syncStep(state({ index: 0, done: true, pausedByApp: true, lastTime: 2 }), paused(11), segments);
    expect(r.state).toEqual({ index: 2, done: false, pausedByApp: false, lastTime: 11 });
  });

  it("keeps progress when a seek lands in the same segment", () => {
    const r = syncStep(state({ index: 1, done: true, lastTime: 6.5 }), paused(4.2), segments);
    expect(r.state).toMatchObject({ index: 1, done: true, pausedByApp: false });
  });

  it("goes to the first segment on a seek before it starts", () => {
    expect(syncStep(state({ index: 2, lastTime: 11 }), paused(0), segments).state.index).toBe(0);
  });

  it("does nothing without segments", () => {
    expect(syncStep(state(), playing(5), []).pause).toBe(false);
  });
});

describe("completeSegment", () => {
  it("resumes only when the app paused the video", () => {
    expect(completeSegment(state({ pausedByApp: true }))).toEqual({
      state: state({ done: true, pausedByApp: false }),
      resume: true,
    });
    expect(completeSegment(state()).resume).toBe(false);
  });
});

describe("selectSegment", () => {
  it("starts the chosen segment fresh, at its start time", () => {
    expect(selectSegment(state({ done: true, pausedByApp: true }), 2, segments)).toEqual({
      index: 2,
      done: false,
      pausedByApp: false,
      lastTime: 10,
    });
  });

  it("clamps to the available segments", () => {
    expect(selectSegment(state(), -3, segments).index).toBe(0);
    expect(selectSegment(state(), 99, segments).index).toBe(2);
  });
});
