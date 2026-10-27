import type { Cue } from "./types";

// "00:01:02,500", "01:02.500" or "1:02:03.5" (hours optional, "," or "." before ms).
const TIME = String.raw`(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?`;
const TIMING_LINE = new RegExp(String.raw`^\s*${TIME}\s*-->\s*${TIME}`);

/**
 * Parses SubRip (.srt) or WebVTT (.vtt) subtitles into cues. Styling tags,
 * inline timestamps, ASS-style codes like {\an8}, VTT NOTE/STYLE/REGION blocks
 * and cue numbers are dropped. Blocks without a valid timing line are skipped.
 */
export function parseSubtitles(content: string): Cue[] {
  const blocks = content
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/);

  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block.split("\n");
    const timingAt = lines.findIndex((line) => TIMING_LINE.test(line));
    if (timingAt === -1) continue;

    const match = TIMING_LINE.exec(lines[timingAt])!;
    const start = toSeconds(match.slice(1, 5));
    const end = toSeconds(match.slice(5, 9));
    const text = lines
      .slice(timingAt + 1)
      .map(stripMarkup)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text && end >= start) cues.push({ start, end, text });
  }
  return cues;
}

function toSeconds([h, m, s, ms]: (string | undefined)[]): number {
  const millis = ms ? Number(ms.padEnd(3, "0")) : 0;
  return Number(h ?? 0) * 3600 + Number(m) * 60 + Number(s) + millis / 1000;
}

function stripMarkup(line: string): string {
  return line
    .replace(/<\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3}>/g, "")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/\{\\[^}]*\}/g, "");
}
