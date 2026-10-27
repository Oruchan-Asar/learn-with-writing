import type { Cue, Segment } from "./types";

export type SegmenterOptions = {
  /** A sentence end only closes a segment once it has this many words. */
  minWords: number;
  /** Split segments longer than this, at a comma when possible. */
  maxWords: number;
  /** Split segments longer than this many seconds. */
  maxDuration: number;
  /** A pause longer than this many seconds always closes a segment. */
  maxGap: number;
};

export const DEFAULT_SEGMENTER_OPTIONS: SegmenterOptions = {
  minWords: 3,
  maxWords: 18,
  maxDuration: 8,
  maxGap: 1.5,
};

type TimedWord = { text: string; start: number; end: number };

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const ABBREVIATIONS = new Set(["mr.", "mrs.", "ms.", "dr.", "prof.", "st.", "vs.", "etc.", "e.g.", "i.e."]);

/**
 * Removes what isn't speech from a caption line: HTML entities, sound
 * descriptions like [Music] or (laughs), music notes, ">>" speaker-change marks,
 * "NAME:" speaker labels and leading dialogue dashes.
 */
export function cleanCaptionText(text: string): string {
  return text
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
      if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? match;
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    })
    .replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
    .replace(/♪[^♪]*♪|[♪♫]/g, " ")
    .replace(/>>+/g, " ")
    .replace(/(^|\s)[A-Z][A-Z0-9 .'-]*:\s/g, "$1")
    .replace(/^\s*[-–—]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Sorts cues and clips each one to end where the next starts, since caption
 * lines often overlap. Cues with no text left after cleaning are dropped.
 */
export function normalizeCues(cues: Cue[]): Cue[] {
  const cleaned = cues
    .map((c) => ({ ...c, text: cleanCaptionText(c.text) }))
    .filter((c) => c.text && Number.isFinite(c.start) && Number.isFinite(c.end))
    .sort((a, b) => a.start - b.start);

  return cleaned.map((cue, i) => {
    const next = cleaned[i + 1];
    const end = next && next.start > cue.start ? Math.min(cue.end, next.start) : cue.end;
    return { ...cue, end: Math.max(cue.start, end) };
  });
}

/**
 * Splits transcript cues into typable segments of about one sentence.
 *
 * Works on a stream of words, so it both merges short cues and splits long
 * ones. A segment closes at a sentence end, at a long pause, or when it gets
 * too long (preferring the last comma). Auto-generated captions have no
 * punctuation, so for those the pauses and length limits do the work.
 */
export function segmentCues(cues: Cue[], options: Partial<SegmenterOptions> = {}): Segment[] {
  const opts = { ...DEFAULT_SEGMENTER_OPTIONS, ...options };
  const words = normalizeCues(cues).flatMap(cueToWords);
  const segments: Segment[] = [];
  let current: TimedWord[] = [];

  const flush = (count = current.length) => {
    const taken = current.slice(0, count);
    current = current.slice(count);
    if (!taken.length) return;
    segments.push({
      id: segments.length,
      start: taken[0].start,
      end: taken[taken.length - 1].end,
      text: taken.map((w) => w.text).join(" "),
    });
  };

  words.forEach((word, i) => {
    current.push(word);
    const next = words[i + 1];
    if (!next) return flush();

    if (endsSentence(word.text) && current.length >= opts.minWords) return flush();
    if (next.start - word.end > opts.maxGap) return flush();

    const tooLong =
      current.length >= opts.maxWords || next.end - current[0].start > opts.maxDuration;
    if (tooLong) flush(softBreakIndex(current, opts.minWords) ?? current.length);
  });
  flush();

  return segments;
}

/** Spreads a cue's time over its words in proportion to their length. */
function cueToWords(cue: Cue): TimedWord[] {
  const parts = cue.text.split(" ");
  const total = parts.reduce((sum, w) => sum + w.length + 1, 0);
  const duration = cue.end - cue.start;
  let t = cue.start;
  return parts.map((text) => {
    const start = t;
    t += (duration * (text.length + 1)) / total;
    return { text, start, end: t };
  });
}

function endsSentence(word: string): boolean {
  return /[.!?…]["'”’]*$/.test(word) && !ABBREVIATIONS.has(word.toLowerCase());
}

/**
 * Where to split a segment that got too long: just after its last comma-like
 * word, if that leaves at least `minWords` on both sides. Returns the number
 * of words to take, or undefined when there's no good spot.
 */
function softBreakIndex(words: TimedWord[], minWords: number): number | undefined {
  for (let i = words.length - 1 - minWords; i >= minWords - 1; i--) {
    if (/[,;:–—]["'”’]*$/.test(words[i].text)) return i + 1;
  }
  return undefined;
}
