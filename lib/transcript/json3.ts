import type { Cue } from "./types";

/** YouTube's "json3" caption format (timedtext with `fmt=json3`). */
export type Json3 = {
  events?: Json3Event[];
};

type Json3Event = {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: { utf8?: string; tOffsetMs?: number }[];
};

/**
 * Turns json3 captions into cues. Auto-generated tracks carry a time offset per
 * word, so those become one cue per word for exact timing; other events become
 * one cue each. Line breaks become spaces and empty events are dropped.
 */
export function parseJson3(data: Json3): Cue[] {
  const cues: Cue[] = [];

  for (const event of data.events ?? []) {
    if (!event.segs?.length || event.tStartMs === undefined) continue;
    const eventStart = event.tStartMs;
    const eventEnd = eventStart + (event.dDurationMs ?? 0);

    const hasWordTimes = event.segs.length > 1 && event.segs.some((s) => s.tOffsetMs !== undefined);
    if (!hasWordTimes) {
      pushCue(cues, eventStart, eventEnd, event.segs.map((s) => s.utf8 ?? "").join(""));
      continue;
    }

    event.segs.forEach((seg, i) => {
      const start = eventStart + (seg.tOffsetMs ?? 0);
      const nextOffset = event.segs![i + 1]?.tOffsetMs;
      const end = nextOffset !== undefined ? eventStart + nextOffset : eventEnd;
      pushCue(cues, start, end, seg.utf8 ?? "");
    });
  }

  return cues;
}

function pushCue(cues: Cue[], startMs: number, endMs: number, text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return;
  cues.push({ start: startMs / 1000, end: Math.max(startMs, endMs) / 1000, text: clean });
}
