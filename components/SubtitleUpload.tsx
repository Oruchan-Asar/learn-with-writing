"use client";

import { useRef, useState } from "react";
import { writeJSON } from "@/lib/storage";
import { parseSubtitles } from "@/lib/transcript/parseSubtitles";
import type { Cue } from "@/lib/transcript/types";

/** Subtitles the user uploaded for a video, saved in the browser. */
export type UploadedSubtitles = {
  fileName: string;
  cues: Cue[];
};

export const uploadedSubtitlesKey = (videoId: string) => `subs:${videoId}`;

// Subtitle files are text; anything this big is almost certainly something else.
const MAX_FILE_BYTES = 2 * 1024 * 1024;

type Props = {
  videoId: string;
  /** Button text; the default suits a small link next to other controls. */
  label?: string;
  className?: string;
};

/** A button that reads an .srt or .vtt file and uses it as this video's transcript. */
export function SubtitleUpload({ videoId, label = "Upload subtitles", className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (file.size > MAX_FILE_BYTES) {
      setError("That file is too big to be subtitles.");
      return;
    }
    const cues = parseSubtitles(await file.text());
    if (!cues.length) {
      setError("No subtitles found in that file. Use an .srt or .vtt file.");
      return;
    }
    const saved = writeJSON(uploadedSubtitlesKey(videoId), { fileName: file.name, cues } satisfies UploadedSubtitles);
    if (!saved) setError("Couldn't save the subtitles: the browser's storage is full or blocked.");
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={
          className ??
          "text-sm text-zinc-500 underline decoration-dotted underline-offset-2 hover:text-zinc-800 dark:hover:text-zinc-200"
        }
      >
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".srt,.vtt,text/vtt,application/x-subrip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />
      {error && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </span>
  );
}
