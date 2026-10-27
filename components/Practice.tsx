"use client";

import type { RefObject } from "react";
import { SegmentList } from "@/components/SegmentList";
import { TypingArea } from "@/components/TypingArea";
import type { YouTubePlayerHandle } from "@/components/YouTubePlayer";
import { formatTime } from "@/lib/format";
import { usePlayerSync } from "@/lib/sync/usePlayerSync";
import type { Segment } from "@/lib/transcript/types";

type Props = {
  player: RefObject<YouTubePlayerHandle | null>;
  /** The player is ready to be read and controlled. */
  ready: boolean;
  segments: Segment[];
};

/** Type along with the video: the typing area, its controls and the segment list. */
export function Practice({ player, ready, segments }: Props) {
  const sync = usePlayerSync(player, segments, ready);
  const segment = segments[sync.index];
  const next = segments[sync.index + 1];
  if (!segment) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <ControlButton onClick={() => sync.goTo(sync.index - 1)} disabled={sync.index === 0} label="Previous segment">
          ← Prev
        </ControlButton>
        <ControlButton onClick={sync.replay} label="Play this segment again">
          ↺ Replay
        </ControlButton>
        <ControlButton onClick={() => sync.goTo(sync.index + 1)} disabled={!next} label="Skip to the next segment">
          Skip →
        </ControlButton>
        <span className="ml-auto tabular-nums text-zinc-500">
          Segment {sync.index + 1} / {segments.length}
        </span>
      </div>

      <div className="h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full bg-teal-500 transition-[width]"
          style={{ width: `${((sync.index + (sync.done ? 1 : 0)) / segments.length) * 100}%` }}
        />
      </div>

      <TypingArea key={`${sync.index}:${sync.attempt}`} text={segment.text} onComplete={sync.complete} />

      <p className="min-h-5 text-center text-sm text-zinc-500" aria-live="polite">
        {status(sync, next)}
      </p>

      <SegmentList segments={segments} activeIndex={sync.index} onSelect={sync.goTo} />
    </div>
  );
}

function status(sync: { done: boolean; waiting: boolean }, next: Segment | undefined): string {
  if (sync.waiting) return "Paused — finish typing to continue, or skip.";
  if (!sync.done) return "";
  if (!next) return "That was the last segment. Well done!";
  return `Next segment starts at ${formatTime(next.start)}.`;
}

function ControlButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="h-8 rounded-lg border border-zinc-300 px-3 transition hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      {children}
    </button>
  );
}
