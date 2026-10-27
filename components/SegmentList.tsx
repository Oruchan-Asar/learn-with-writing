"use client";

import { useEffect, useRef } from "react";
import { formatTime } from "@/lib/format";
import { findSegmentIndex } from "@/lib/transcript/findSegment";
import type { Segment } from "@/lib/transcript/types";

type Props = {
  segments: Segment[];
  currentTime: number;
  onSeek: (seconds: number) => void;
};

/**
 * Debug view of the segmented transcript: every segment with its time range,
 * the one at the current time highlighted, click to jump there.
 */
export function SegmentList({ segments, currentTime, onSeek }: Props) {
  const listRef = useRef<HTMLOListElement>(null);
  const active = findSegmentIndex(segments, currentTime);

  // Keep the active segment in view by scrolling the list only, not the page.
  useEffect(() => {
    const list = listRef.current;
    const item = list?.children[active] as HTMLElement | undefined;
    if (!list || !item) return;
    const top = item.offsetTop - list.offsetTop;
    if (top < list.scrollTop || top + item.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTo({ top: top - list.clientHeight / 3, behavior: "smooth" });
    }
  }, [active]);

  return (
    <ol ref={listRef} className="max-h-96 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      {segments.map((seg, i) => (
        <li key={seg.id}>
          <button
            type="button"
            onClick={() => onSeek(seg.start)}
            aria-current={i === active ? "true" : undefined}
            className="flex w-full gap-4 border-b border-zinc-100 px-4 py-2 text-left text-sm transition last:border-0 hover:bg-zinc-50 aria-[current]:bg-sky-50 dark:border-zinc-900 dark:hover:bg-zinc-900 dark:aria-[current]:bg-sky-950/60"
          >
            <span className="w-24 shrink-0 font-mono text-xs leading-5 tabular-nums text-zinc-500">
              {formatTime(seg.start)}–{formatTime(seg.end)}
            </span>
            <span className="leading-5">{seg.text}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
