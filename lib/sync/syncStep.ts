import { findSegmentIndex } from "@/lib/transcript/findSegment";
import type { Segment } from "@/lib/transcript/types";

export type SyncState = {
  /** The segment being typed. */
  index: number;
  /** Whether the user has finished typing it. */
  done: boolean;
  /** Whether we paused the video to wait for the user (vs. the user pausing it). */
  pausedByApp: boolean;
  /** Video time at the previous tick, to notice seeks; -1 before the first tick. */
  lastTime: number;
};

export type PlayerSample = {
  time: number;
  playing: boolean;
  rate: number;
};

export type SyncStepResult = {
  state: SyncState;
  /** Pause the video now. */
  pause: boolean;
};

/** A jump in video time bigger than this between ticks means the user seeked. */
export const SEEK_JUMP_S = 1;

/** Move to the next segment this early, so its first word isn't missed. */
export const ADVANCE_LEAD_S = 0.05;

/**
 * Pause this early before a segment ends, to make up for the polling interval
 * and the delay before the player actually stops. Faster playback covers more
 * video in that time.
 */
export function pauseLead(rate: number): number {
  return 0.05 + 0.1 * rate;
}

export function initialSyncState(): SyncState {
  return { index: 0, done: false, pausedByApp: false, lastTime: -1 };
}

/**
 * One tick of the sync loop: given where the video is, decide what to type
 * and whether to pause.
 *
 * - A seek (or the first tick) moves typing to the segment at the new time.
 * - While the segment isn't typed, the video pauses at its end.
 * - Once it's typed, typing moves on when the video reaches the next segment.
 */
export function syncStep(state: SyncState, sample: PlayerSample, segments: Segment[]): SyncStepResult {
  const { time } = sample;
  const next: SyncState = { ...state, lastTime: time };
  if (!segments.length) return { state: next, pause: false };

  const seeked = state.lastTime < 0 || Math.abs(time - state.lastTime) > SEEK_JUMP_S;
  if (seeked) {
    const index = Math.max(0, findSegmentIndex(segments, time));
    // Seeking within the same segment keeps what was typed.
    if (index === state.index) return { state: { ...next, pausedByApp: false }, pause: false };
    return { state: { index, done: false, pausedByApp: false, lastTime: time }, pause: false };
  }

  if (!state.done) {
    const segment = segments[state.index];
    if (sample.playing && time >= segment.end - pauseLead(sample.rate)) {
      return { state: { ...next, pausedByApp: true }, pause: true };
    }
    return { state: next, pause: false };
  }

  const following = segments[state.index + 1];
  if (following && time >= following.start - ADVANCE_LEAD_S) {
    return { state: { ...next, index: state.index + 1, done: false }, pause: false };
  }
  return { state: next, pause: false };
}

/**
 * The user finished typing the segment. Returns the new state and whether to
 * resume the video, which we do only if we were the ones who paused it.
 */
export function completeSegment(state: SyncState): { state: SyncState; resume: boolean } {
  return { state: { ...state, done: true, pausedByApp: false }, resume: state.pausedByApp };
}

/** Jump typing to a segment the user picked; the caller seeks the video there. */
export function selectSegment(state: SyncState, index: number, segments: Segment[]): SyncState {
  const clamped = Math.min(Math.max(index, 0), segments.length - 1);
  return { index: clamped, done: false, pausedByApp: false, lastTime: segments[clamped]?.start ?? state.lastTime };
}
