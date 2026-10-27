"use client";

import { useEffect, useMemo, useState } from "react";
import { segmentCues } from "./segmenter";
import type { Segment, TranscriptErrorResponse, TranscriptResponse } from "./types";

export type TranscriptState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; transcript: TranscriptResponse; segments: Segment[] };

type Result = { key: string; transcript?: TranscriptResponse; error?: string };

/** Loads a video's captions from /api/transcript and splits them into segments. */
export function useTranscript(videoId: string, lang?: string): TranscriptState {
  const key = `${videoId}:${lang ?? ""}`;
  // Results are tagged with the request they belong to, so a stale result
  // reads as "loading" without resetting state inside the effect.
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ v: videoId });
    if (lang) params.set("lang", lang);

    fetch(`/api/transcript?${params}`, { signal: controller.signal })
      .then(async (res) => {
        const body: TranscriptResponse | TranscriptErrorResponse = await res.json();
        if ("error" in body) setResult({ key, error: body.error });
        else setResult({ key, transcript: body });
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") setResult({ key, error: "Could not load the captions. Check your connection." });
      });

    return () => controller.abort();
  }, [key, videoId, lang]);

  const transcript = result?.key === key ? result.transcript : undefined;
  const segments = useMemo(() => (transcript ? segmentCues(transcript.cues) : []), [transcript]);

  if (!result || result.key !== key) return { status: "loading" };
  if (result.error || !transcript) return { status: "error", error: result.error ?? "No captions." };
  return { status: "ready", transcript, segments };
}
