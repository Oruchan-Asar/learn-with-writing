export type ParsedYouTubeUrl = {
  videoId: string;
  /** Start time in seconds, from `t=` or `start=` in the link. */
  startSeconds?: number;
};

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

// Path prefixes that are followed by the video id, e.g. /shorts/{id}.
const ID_PATH_PREFIXES = ["embed", "shorts", "live", "v", "e"];

export function isValidVideoId(id: string): boolean {
  return VIDEO_ID.test(id);
}

/**
 * Parses a YouTube link (or a bare 11-character video id) into its video id
 * and optional start time. Returns null when the input isn't a YouTube video.
 */
export function parseYouTubeUrl(input: string): ParsedYouTubeUrl | null {
  const raw = input.trim();
  if (!raw) return null;
  if (isValidVideoId(raw)) return { videoId: raw };

  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);
  let videoId: string | null = null;

  if (host === "youtu.be" || host === "www.youtu.be") {
    videoId = segments[0] ?? null;
  } else if (YOUTUBE_HOSTS.has(host)) {
    if (segments[0] === "watch") {
      videoId = url.searchParams.get("v");
    } else if (segments.length >= 2 && ID_PATH_PREFIXES.includes(segments[0])) {
      videoId = segments[1];
    }
  }

  if (!videoId || !isValidVideoId(videoId)) return null;

  // Some links carry the time in the hash, e.g. #t=1m30s.
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  const time =
    url.searchParams.get("t") ?? url.searchParams.get("start") ?? hashParams.get("t");
  const startSeconds = time ? parseTimeParam(time) : undefined;

  return startSeconds ? { videoId, startSeconds } : { videoId };
}

/** Parses "90", "90s", "1m30s" or "1h2m3s" into seconds. */
export function parseTimeParam(value: string): number | undefined {
  const v = value.trim().toLowerCase();
  if (/^\d+$/.test(v)) return Number(v);

  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(v);
  if (!match || v === "") return undefined;
  const [, h = "0", m = "0", s = "0"] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}
