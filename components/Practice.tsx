"use client";

import { useEffect, useMemo, useState, type ReactNode, type RefObject } from "react";
import { SegmentList } from "@/components/SegmentList";
import { SessionSummary } from "@/components/SessionSummary";
import { TypingArea } from "@/components/TypingArea";
import type { YouTubePlayerHandle } from "@/components/YouTubePlayer";
import { formatTime } from "@/lib/format";
import { clearProgress, loadProgress, saveProgress } from "@/lib/progress";
import { DIFFICULTIES, difficultyOf, HIDE_LEVELS, useSettings } from "@/lib/settings";
import { useShortcuts } from "@/lib/shortcuts";
import { summarize, type TypingResult } from "@/lib/stats";
import { usePlayerSync } from "@/lib/sync/usePlayerSync";
import type { Segment } from "@/lib/transcript/types";
import { pickHiddenWords } from "@/lib/typing/hide";
import { tokenize } from "@/lib/typing/tokenize";

type Props = {
  player: RefObject<YouTubePlayerHandle | null>;
  /** The player is ready to be read and controlled. */
  ready: boolean;
  segments: Segment[];
  videoId: string;
  title: string;
  /** Identifies the caption track; progress is saved per track. */
  trackCode: string;
};

const NO_HIDDEN: ReadonlySet<number> = new Set();

/** Type along with the video: the typing area, its controls, stats and the segment list. */
export function Practice({ player, ready, segments, videoId, title, trackCode }: Props) {
  const sync = usePlayerSync(player, segments, ready);
  const [settings, updateSettings] = useSettings();

  // Practice only renders once captions have loaded in the browser, so storage can be read here.
  const [saved] = useState(() => loadProgress(videoId, trackCode));
  const [results, setResults] = useState<Record<number, TypingResult>>(() => saved?.results ?? {});
  const [resumeAt, setResumeAt] = useState<number | null>(() =>
    saved && saved.index > 0 && saved.index < segments.length ? saved.index : null,
  );
  const [showSummary, setShowSummary] = useState(false);

  const segment = segments[sync.index];
  const next = segments[sync.index + 1];
  const typedCount = Object.keys(results).length;

  // Save where the user is. Don't overwrite a saved position with the start of
  // the video before they've chosen whether to continue from it.
  useEffect(() => {
    if (sync.index === 0 && (resumeAt !== null || typedCount === 0)) return;
    saveProgress({ videoId, title, trackCode, total: segments.length }, { index: sync.index, results });
  }, [sync.index, results, resumeAt, typedCount, videoId, title, trackCode, segments.length]);

  const wordCount = useMemo(() => (segment ? tokenize(segment.text).filter((t) => t.kind === "word").length : 0), [segment]);
  const hidden = useMemo(
    () =>
      settings.mode === "fill" && segment
        ? pickHiddenWords(wordCount, settings.hideRatio, `${videoId}:${trackCode}:${segment.id}`)
        : NO_HIDDEN,
    [settings.mode, settings.hideRatio, wordCount, videoId, trackCode, segment],
  );
  const summary = useMemo(() => summarize(Object.values(results)), [results]);
  const completed = useMemo(() => new Set(Object.keys(results).map(Number)), [results]);

  useShortcuts({
    Enter: sync.replay,
    ArrowLeft: () => goTo(sync.index - 1),
    ArrowRight: () => goTo(sync.index + 1),
  });

  if (!segment) return null;

  // Changing a typing rule starts the segment again with the new rules.
  const typingRulesKey = [settings.caseSensitive, settings.ignoreAccents, settings.requireSpace, settings.typePunctuation]
    .map(Number)
    .join("");
  const difficulty = difficultyOf(settings);

  function handleComplete(result: TypingResult) {
    setResults((r) => ({ ...r, [segment.id]: result }));
    setResumeAt(null);
    sync.complete();
    if (!next) setShowSummary(true);
  }

  function goTo(index: number) {
    if (index < 0 || index >= segments.length) return;
    setResumeAt(null);
    sync.goTo(index);
  }

  return (
    <div className="flex flex-col gap-3">
      {resumeAt !== null && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-sky-50 px-4 py-3 text-sm dark:bg-sky-950/40">
          <span className="flex-1">
            You were on segment {resumeAt + 1} ({formatTime(segments[resumeAt].start)}) with {typedCount} typed.
          </span>
          <ControlButton onClick={() => goTo(resumeAt)} label="Continue from where you left off">
            Continue
          </ControlButton>
          <ControlButton
            onClick={() => {
              clearProgress(videoId, trackCode);
              setResults({});
              setResumeAt(null);
            }}
            label="Forget the saved progress and start over"
          >
            Start over
          </ControlButton>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <ControlButton onClick={() => goTo(sync.index - 1)} disabled={sync.index === 0} label="Previous segment">
          ← Prev
        </ControlButton>
        <ControlButton onClick={sync.replay} label="Play this segment again">
          ↺ Replay
        </ControlButton>
        <ControlButton onClick={() => goTo(sync.index + 1)} disabled={!next} label="Skip to the next segment">
          Skip →
        </ControlButton>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <select
            value={difficulty}
            onChange={(e) => {
              const preset = DIFFICULTIES.find((d) => d.id === e.target.value);
              if (preset) updateSettings(preset.rules);
            }}
            aria-label="Difficulty"
            title={DIFFICULTIES.find((d) => d.id === difficulty)?.description ?? "Your own mix of typing rules (see Settings)"}
            className="h-8 rounded-lg border border-zinc-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {DIFFICULTIES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}: {d.description}
              </option>
            ))}
            {difficulty === "custom" && (
              <option value="custom" disabled>
                Custom (see Settings)
              </option>
            )}
          </select>
          <div className="flex overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700" role="group" aria-label="Mode">
            {(["show", "fill"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={settings.mode === mode}
                onClick={() => updateSettings({ mode })}
                title={mode === "show" ? "Show the whole sentence" : "Hide some words: type what you hear"}
                className="h-8 px-3 transition hover:bg-zinc-100 aria-pressed:bg-sky-600 aria-pressed:text-white dark:hover:bg-zinc-800"
              >
                {mode === "show" ? "Show" : "Fill"}
              </button>
            ))}
          </div>
          {settings.mode === "fill" && (
            <select
              value={settings.hideRatio}
              onChange={(e) => updateSettings({ hideRatio: Number(e.target.value) })}
              aria-label="Words hidden"
              className="h-8 rounded-lg border border-zinc-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {HIDE_LEVELS.map((level) => (
                <option key={level.ratio} value={level.ratio}>
                  {level.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className="h-full bg-teal-500 transition-[width]" style={{ width: `${(typedCount / segments.length) * 100}%` }} />
      </div>

      <TypingArea
        key={`${sync.index}:${sync.attempt}:${settings.mode}:${typingRulesKey}`}
        text={segment.text}
        hidden={hidden}
        options={{
          caseSensitive: settings.caseSensitive,
          ignoreAccents: settings.ignoreAccents,
          requireSpace: settings.requireSpace,
          typePunctuation: settings.typePunctuation,
        }}
        onComplete={handleComplete}
      />

      <p className="min-h-5 text-center text-sm text-zinc-500" aria-live="polite">
        {status(sync, next)}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm tabular-nums text-zinc-500">
        <span>
          Segment {sync.index + 1} / {segments.length} · {typedCount} typed
        </span>
        {typedCount > 0 && (
          <>
            <span>{Math.round(summary.wpm)} wpm</span>
            <span>{Math.round(summary.accuracy * 100)}% accuracy</span>
          </>
        )}
        <button
          type="button"
          onClick={() => setShowSummary((v) => !v)}
          disabled={typedCount === 0}
          className="ml-auto underline decoration-dotted underline-offset-2 hover:text-zinc-800 disabled:no-underline disabled:opacity-40 dark:hover:text-zinc-200"
        >
          {showSummary ? "Hide summary" : "Summary"}
        </button>
      </div>

      {showSummary && typedCount > 0 && (
        <SessionSummary summary={summary} total={segments.length} onClose={() => setShowSummary(false)} />
      )}

      <SegmentList segments={segments} activeIndex={sync.index} onSelect={goTo} completed={completed} />
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
  children: ReactNode;
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
