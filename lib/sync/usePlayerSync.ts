"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { YouTubePlayerHandle } from "@/components/YouTubePlayer";
import type { Segment } from "@/lib/transcript/types";
import { completeSegment, initialSyncState, selectSegment, syncStep, type SyncState } from "./syncStep";

// setInterval rather than requestAnimationFrame, which stops in background tabs.
const TICK_MS = 50;

const PLAYING = 1;

export type PlayerSync = {
  /** The segment being typed. */
  index: number;
  done: boolean;
  /** The video is paused waiting for the user to finish typing. */
  waiting: boolean;
  /** Changes whenever the current segment should be typed from scratch. */
  attempt: number;
  /** Call when the user has typed the current segment. */
  complete: () => void;
  /** Jump to a segment, seek the video there and play. */
  goTo: (index: number) => void;
  /** Play the current segment again from its start, keeping what was typed. */
  replay: () => void;
};

/**
 * Keeps the video and the typing in step: the video pauses at the end of each
 * segment until it's typed, then plays on. Seeks made in the YouTube player
 * move typing to the segment at the new time.
 */
export function usePlayerSync(
  player: RefObject<YouTubePlayerHandle | null>,
  segments: Segment[],
  enabled: boolean,
): PlayerSync {
  const sync = useRef<SyncState>(initialSyncState());
  const [view, setView] = useState({ index: 0, done: false, waiting: false, attempt: 0 });

  // Mirror the loop's state into React state, only when something visible changed.
  const publish = useCallback((next: SyncState, newAttempt = false) => {
    setView((v) =>
      !newAttempt && v.index === next.index && v.done === next.done && v.waiting === next.pausedByApp
        ? v
        : { index: next.index, done: next.done, waiting: next.pausedByApp, attempt: v.attempt + (newAttempt ? 1 : 0) },
    );
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      const p = player.current;
      if (!p) return;
      const result = syncStep(
        sync.current,
        { time: p.getCurrentTime(), playing: p.getState() === PLAYING, rate: p.getPlaybackRate() },
        segments,
      );
      sync.current = result.state;
      if (result.pause) p.pause();
      publish(result.state);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [enabled, player, segments, publish]);

  const complete = useCallback(() => {
    const { state, resume } = completeSegment(sync.current);
    sync.current = state;
    if (resume) player.current?.play();
    publish(state);
  }, [player, publish]);

  const goTo = useCallback(
    (index: number) => {
      if (!segments.length) return;
      const state = selectSegment(sync.current, index, segments);
      sync.current = state;
      player.current?.seekTo(segments[state.index].start);
      player.current?.play();
      publish(state, true);
    },
    [player, segments, publish],
  );

  const replay = useCallback(() => {
    const segment = segments[sync.current.index];
    if (!segment) return;
    sync.current = { ...sync.current, pausedByApp: false, lastTime: segment.start };
    player.current?.seekTo(segment.start);
    player.current?.play();
    publish(sync.current);
  }, [player, segments, publish]);

  return { ...view, complete, goTo, replay };
}
