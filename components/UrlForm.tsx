"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { parseYouTubeUrl } from "@/lib/youtube/parseUrl";

export function UrlForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = parseYouTubeUrl(value);
    if (!parsed) {
      setError("That doesn't look like a YouTube video link.");
      return;
    }
    const query = parsed.startSeconds ? `?t=${parsed.startSeconds}` : "";
    router.push(`/watch/${parsed.videoId}${query}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2">
      <div className="flex w-full gap-2">
        <input
          type="text"
          inputMode="url"
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="Paste a YouTube link, e.g. https://youtu.be/…"
          aria-label="YouTube video link"
          aria-invalid={error ? true : undefined}
          className="h-12 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-4 text-base outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="h-12 shrink-0 rounded-lg bg-sky-600 px-5 font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start
        </button>
      </div>
      <p role="alert" className="min-h-5 text-sm text-red-600 dark:text-red-400">
        {error}
      </p>
    </form>
  );
}
