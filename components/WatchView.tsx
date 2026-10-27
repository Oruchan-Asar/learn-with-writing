"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { YouTubePlayer, type YouTubePlayerHandle } from "@/components/YouTubePlayer";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5];

const STATE_LABELS: Record<number, string> = {
  [-1]: "Not started",
  0: "Ended",
  1: "Playing",
  2: "Paused",
  3: "Buffering",
  5: "Ready",
};

type Props = { videoId: string; startSeconds?: number };

export function WatchView({ videoId, startSeconds }: Props) {
  const player = useRef<YouTubePlayerHandle>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<number>(-1);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  // The first start has to be the user's own click on the video (see YouTubePlayer.play).
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll the current time. M4 turns this into the pause/resume sync loop.
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      setTime(player.current?.getCurrentTime() ?? 0);
      setDuration(player.current?.getDuration() ?? 0);
    }, 100);
    return () => clearInterval(id);
  }, [ready]);

  const playing = state === 1 || state === 3;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6">
      <nav>
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          ← Another video
        </Link>
      </nav>

      <YouTubePlayer
        ref={player}
        videoId={videoId}
        startSeconds={startSeconds}
        onReady={() => setReady(true)}
        onStateChange={(s) => {
          setState(s);
          if (s === 1) setStarted(true);
        }}
        onError={setError}
      />

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          disabled={!started}
          onClick={() => (playing ? player.current?.pause() : player.current?.play())}
          className="h-9 w-20 rounded-lg bg-zinc-900 font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {playing ? "Pause" : "Play"}
        </button>

        <div className="flex overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={!ready}
              aria-pressed={speed === s}
              onClick={() => {
                player.current?.setPlaybackRate(s);
                setSpeed(s);
              }}
              className="h-9 px-3 tabular-nums transition hover:bg-zinc-100 disabled:opacity-40 aria-pressed:bg-sky-600 aria-pressed:text-white dark:hover:bg-zinc-800"
            >
              {s}×
            </button>
          ))}
        </div>

        {ready && !started && (
          <span className="text-zinc-500">Click the video to start it.</span>
        )}

        <span className="ml-auto font-mono tabular-nums text-zinc-500">
          {formatTime(time)} / {formatTime(duration)} · {STATE_LABELS[state] ?? "…"}
        </span>
      </div>

      <section className="rounded-xl border border-dashed border-zinc-300 px-6 py-10 text-center text-zinc-500 dark:border-zinc-700">
        The transcript and typing area will appear here.
      </section>
    </main>
  );
}

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
