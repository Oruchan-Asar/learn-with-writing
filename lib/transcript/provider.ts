import { Innertube, Log } from "youtubei.js";
import { parseJson3, type Json3 } from "./json3";
import type { TranscriptResponse, TranscriptTrack } from "./types";

// youtubei.js warns loudly whenever YouTube adds a field it doesn't know yet.
Log.setLevel(Log.Level.ERROR);

/** "blocked": YouTube refuses requests from this server (bot check or rate limit). */
export type TranscriptErrorCode = "unavailable" | "no_captions" | "blocked" | "upstream";

// The bot check sticks to cloud servers; the rate limit passes after a while.
const BOT_CHECK_MESSAGE =
  "YouTube is blocking caption requests from this server. Upload the subtitles as a file, or run the app on your own computer.";
const RATE_LIMIT_MESSAGE =
  "YouTube is limiting caption requests from this server right now. Try again in a few minutes, or upload the subtitles as a file.";

/** YouTube's reasons for refusing a request it thinks comes from a bot. */
export function isBotCheck(reason: string): boolean {
  return /not a bot|sign in to confirm|unusual traffic/i.test(reason);
}

export class TranscriptError extends Error {
  constructor(
    public code: TranscriptErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** Fetches captions for a video. Kept as an interface so the source can be swapped. */
export interface TranscriptProvider {
  fetch(videoId: string, lang?: string): Promise<TranscriptResponse>;
}

type CaptionTrack = {
  base_url: string;
  language_code: string;
  kind?: string;
  name?: { toString(): string };
};

// Clients tried in order. WEB works today; IOS is a fallback when WEB is refused.
const CLIENTS = ["WEB", "IOS"] as const;

const DEFAULT_LANGUAGE = "en";

/**
 * Reads captions through YouTube's internal API via youtubei.js. There is no
 * official API for captions of videos you don't own, so this can break when
 * YouTube changes things; errors say so instead of failing silently.
 */
export class YoutubeiTranscriptProvider implements TranscriptProvider {
  private client: Promise<Innertube> | null = null;

  async fetch(videoId: string, lang?: string): Promise<TranscriptResponse> {
    const { title, tracks } = await this.loadTracks(videoId);
    const track = pickTrack(tracks, lang ?? DEFAULT_LANGUAGE);

    const url = new URL(track.base_url, "https://www.youtube.com");
    url.searchParams.set("fmt", "json3");
    const res = await fetch(url);
    if (res.status === 429) throw new TranscriptError("blocked", RATE_LIMIT_MESSAGE);
    if (!res.ok) throw new TranscriptError("upstream", `YouTube refused the caption download (${res.status}).`);

    let data: Json3;
    try {
      data = await res.json();
    } catch {
      throw new TranscriptError("upstream", "YouTube sent captions in an unexpected format.");
    }
    const cues = parseJson3(data);
    if (!cues.length) throw new TranscriptError("no_captions", "The captions for this video are empty.");

    return {
      videoId,
      title,
      track: toTrack(track),
      tracks: dedupeTracks(tracks.map(toTrack)),
      cues,
    };
  }

  private async loadTracks(videoId: string): Promise<{ title: string; tracks: CaptionTrack[] }> {
    const yt = await this.getClient();
    let reason = "This video is unavailable.";

    for (const client of CLIENTS) {
      try {
        const info = await yt.getBasicInfo(videoId, { client });
        const tracks = (info.captions?.caption_tracks ?? []) as CaptionTrack[];
        const status = info.playability_status?.status;
        if (tracks.length) return { title: info.basic_info.title ?? "", tracks };
        if (status === "OK") throw new TranscriptError("no_captions", "This video has no captions.");
        reason = info.playability_status?.reason || reason;
      } catch (err) {
        if (err instanceof TranscriptError) throw err;
        reason = err instanceof Error && err.message ? err.message : reason;
      }
    }
    throw isBotCheck(reason) ? new TranscriptError("blocked", BOT_CHECK_MESSAGE) : new TranscriptError("unavailable", reason);
  }

  private getClient(): Promise<Innertube> {
    this.client ??= Innertube.create({ generate_session_locally: true }).catch((err) => {
      this.client = null;
      throw new TranscriptError("upstream", `Could not connect to YouTube: ${err.message}`);
    });
    return this.client;
  }
}

/**
 * Picks the best track for a language: a human-made one, then an
 * auto-generated one, matching "en" to "en-GB" too. Without a match, falls back
 * to the first human-made track, then to any track.
 */
export function pickTrack<T extends Pick<CaptionTrack, "language_code" | "kind">>(tracks: T[], lang: string): T {
  const base = lang.toLowerCase().split("-")[0];
  const isAuto = (t: T) => t.kind === "asr";
  const exact = (t: T) => t.language_code.toLowerCase() === lang.toLowerCase();
  const sameBase = (t: T) => t.language_code.toLowerCase().split("-")[0] === base;

  return (
    tracks.find((t) => exact(t) && !isAuto(t)) ??
    tracks.find((t) => sameBase(t) && !isAuto(t)) ??
    tracks.find((t) => exact(t)) ??
    tracks.find((t) => sameBase(t)) ??
    tracks.find((t) => !isAuto(t)) ??
    tracks[0]
  );
}

function toTrack(t: CaptionTrack): TranscriptTrack {
  const isAutoGenerated = t.kind === "asr";
  return {
    code: t.language_code,
    name: t.name?.toString() || t.language_code,
    isAutoGenerated,
  };
}

function dedupeTracks(tracks: TranscriptTrack[]): TranscriptTrack[] {
  const seen = new Set<string>();
  return tracks.filter((t) => {
    const key = `${t.code}:${t.isAutoGenerated}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
