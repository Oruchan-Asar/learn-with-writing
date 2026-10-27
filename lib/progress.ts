"use client";

import type { TypingResult } from "./stats";
import { readJSON, writeJSON } from "./storage";

/** What's saved for one video and caption track. */
export type VideoProgress = {
  /** The segment the user was on. */
  index: number;
  /** Results of finished segments, by segment id. */
  results: Record<number, TypingResult>;
  updatedAt: number;
};

/** An entry in the home page's list of recent videos. */
export type RecentVideo = {
  videoId: string;
  title: string;
  trackCode: string;
  completed: number;
  total: number;
  updatedAt: number;
};

export type ProgressContext = {
  videoId: string;
  title: string;
  trackCode: string;
  total: number;
};

const RECENT_KEY = "recent";
const RECENT_MAX = 20;

const progressKey = (videoId: string, trackCode: string) => `progress:${videoId}:${trackCode}`;

export function loadProgress(videoId: string, trackCode: string): VideoProgress | null {
  return readJSON<VideoProgress>(progressKey(videoId, trackCode));
}

/** Saves progress for a video and moves it to the top of the recent list. */
export function saveProgress(ctx: ProgressContext, progress: Omit<VideoProgress, "updatedAt">) {
  const updatedAt = Date.now();
  writeJSON(progressKey(ctx.videoId, ctx.trackCode), { ...progress, updatedAt });

  const entry: RecentVideo = {
    videoId: ctx.videoId,
    title: ctx.title,
    trackCode: ctx.trackCode,
    completed: Object.keys(progress.results).length,
    total: ctx.total,
    updatedAt,
  };
  const others = (readJSON<RecentVideo[]>(RECENT_KEY) ?? []).filter((r) => r.videoId !== ctx.videoId);
  writeJSON(RECENT_KEY, [entry, ...others].slice(0, RECENT_MAX));
}

export function clearProgress(videoId: string, trackCode: string) {
  writeJSON(progressKey(videoId, trackCode), null);
}

export function forgetRecent(videoId: string) {
  const recent = readJSON<RecentVideo[]>(RECENT_KEY) ?? [];
  writeJSON(RECENT_KEY, recent.filter((r) => r.videoId !== videoId));
}

export { RECENT_KEY };
