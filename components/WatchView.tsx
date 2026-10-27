"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Practice } from "@/components/Practice";
import { SubtitleUpload, uploadedSubtitlesKey, type UploadedSubtitles } from "@/components/SubtitleUpload";
import { YouTubePlayer, type YouTubePlayerHandle } from "@/components/YouTubePlayer";
import { formatTime } from "@/lib/format";
import { useStoredJSON, writeJSON } from "@/lib/storage";
import { segmentCues } from "@/lib/transcript/segmenter";
import type { TranscriptTrack } from "@/lib/transcript/types";
import { useTranscript } from "@/lib/transcript/useTranscript";

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
  const [lang, setLang] = useState<string>();
  // Fallback title from the player, for when the captions request fails.
  const [playerTitle, setPlayerTitle] = useState("");
  const transcript = useTranscript(videoId, lang);
  // Subtitles the user uploaded take the place of YouTube's captions.
  const uploaded = useStoredJSON<UploadedSubtitles>(uploadedSubtitlesKey(videoId));
  const uploadedSegments = useMemo(() => (uploaded ? segmentCues(uploaded.cues) : null), [uploaded]);
  const title = (transcript.status === "ready" ? transcript.transcript.title : "") || playerTitle;

  // Poll the current time for the clock display.
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
        onReady={() => {
          setReady(true);
          setPlayerTitle(player.current?.getTitle() ?? "");
        }}
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

      {uploaded && uploadedSegments && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <h1 className="min-w-0 flex-1 truncate font-medium" title={title}>
              {title || "Your subtitles"}
            </h1>
            <span className="text-zinc-500">
              {uploadedSegments.length} segments · from {uploaded.fileName}
            </span>
            <button
              type="button"
              onClick={() => writeJSON(uploadedSubtitlesKey(videoId), null)}
              className="text-zinc-500 underline decoration-dotted underline-offset-2 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Use YouTube captions
            </button>
          </div>
          {uploadedSegments.length ? (
            <Practice
              key={`upload:${uploaded.fileName}`}
              player={player}
              ready={ready}
              segments={uploadedSegments}
              videoId={videoId}
              title={title}
              trackCode="upload"
            />
          ) : (
            <p className="text-sm text-zinc-500">These subtitles contain no speech to type.</p>
          )}
        </section>
      )}

      {!uploaded && transcript.status === "loading" && (
        <p className="py-6 text-center text-sm text-zinc-500">Loading captions…</p>
      )}

      {!uploaded && transcript.status === "error" && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        >
          <span className="flex-1">{transcript.error}</span>
          <SubtitleUpload
            videoId={videoId}
            label="Upload an .srt or .vtt file instead"
            className="font-medium underline underline-offset-2"
          />
        </div>
      )}

      {!uploaded && transcript.status === "ready" && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <h1 className="min-w-0 flex-1 truncate font-medium" title={title}>
              {title}
            </h1>
            <span className="text-zinc-500">
              {transcript.segments.length} segments
              {transcript.transcript.track.isAutoGenerated && " · auto-generated captions"}
            </span>
            <select
              value={transcript.transcript.track.code}
              onChange={(e) => setLang(e.target.value)}
              aria-label="Caption language"
              className="h-8 rounded-lg border border-zinc-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {languageOptions(transcript.transcript.tracks).map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name}
                </option>
              ))}
            </select>
            <SubtitleUpload videoId={videoId} />
          </div>
          <Practice
            key={transcript.transcript.track.code}
            player={player}
            ready={ready}
            segments={transcript.segments}
            videoId={videoId}
            title={title}
            trackCode={transcript.transcript.track.code}
          />
        </section>
      )}
    </main>
  );
}

/**
 * One option per language. A language with a human-made track uses that
 * (the API prefers it); one with only auto-generated captions is marked so.
 */
function languageOptions(tracks: TranscriptTrack[]): TranscriptTrack[] {
  const byCode = new Map<string, TranscriptTrack>();
  for (const t of tracks) {
    const existing = byCode.get(t.code);
    if (!existing || (existing.isAutoGenerated && !t.isAutoGenerated)) byCode.set(t.code, t);
  }
  return [...byCode.values()]
    .map((t) => ({ ...t, name: t.isAutoGenerated && !/auto/i.test(t.name) ? `${t.name} (auto-generated)` : t.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
