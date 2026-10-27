import { TranscriptError, type TranscriptProvider } from "./provider";
import type { Cue, TranscriptResponse, TranscriptTrack } from "./types";

const API_URL = "https://api.supadata.ai/v1";

// Long videos come back as a job to poll. Stay well inside serverless time limits.
const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 8000;

type Chunk = { text: string; offset: number; duration: number; lang?: string };

type TranscriptBody = {
  content: Chunk[] | string;
  lang: string;
  availableLangs?: string[];
};

type JobResult = Partial<TranscriptBody> & {
  status: "queued" | "active" | "completed" | "failed";
  error?: { message?: string } | null;
};

type ErrorBody = { error?: string; message?: string };

type Options = {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

/**
 * Captions through Supadata (https://supadata.ai), a paid service that fetches
 * YouTube transcripts from its own infrastructure. Used when YouTube blocks
 * requests from the server this app runs on. Only existing captions are
 * fetched ("native" mode), never AI-generated ones, which cost more.
 */
export class SupadataTranscriptProvider implements TranscriptProvider {
  private fetchImpl: typeof fetch;
  private sleep: (ms: number) => Promise<void>;

  constructor(
    private apiKey: string,
    options: Options = {},
  ) {
    this.fetchImpl = options.fetch ?? fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async fetch(videoId: string, lang?: string): Promise<TranscriptResponse> {
    const params = new URLSearchParams({ url: `https://www.youtube.com/watch?v=${videoId}`, mode: "native" });
    // Supadata takes two-letter language codes.
    if (lang) params.set("lang", lang.split("-")[0].toLowerCase());

    const res = await this.request(`/transcript?${params}`);
    const body =
      res.status === 202
        ? await this.waitForJob(((await res.json()) as { jobId: string }).jobId)
        : ((await res.json()) as TranscriptBody);
    return toResponse(videoId, body);
  }

  private async request(path: string): Promise<Response> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${API_URL}${path}`, { headers: { "x-api-key": this.apiKey } });
    } catch {
      throw new TranscriptError("upstream", "Could not reach the transcript service.");
    }
    if (res.status === 200 || res.status === 202) return res;
    throw await toError(res);
  }

  private async waitForJob(jobId: string): Promise<TranscriptBody> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await this.sleep(POLL_INTERVAL_MS);
      const job = (await (await this.request(`/transcript/${encodeURIComponent(jobId)}`)).json()) as JobResult;
      if (job.status === "completed" && job.content !== undefined && job.lang) {
        return { content: job.content, lang: job.lang, availableLangs: job.availableLangs };
      }
      if (job.status === "failed") {
        throw new TranscriptError("upstream", job.error?.message || "The transcript service couldn't get the captions.");
      }
    }
    throw new TranscriptError("upstream", "The captions for this video are still being prepared. Try again in a minute.");
  }
}

async function toError(res: Response): Promise<TranscriptError> {
  // 206 means "transcript unavailable", so it's an error despite being a 2xx.
  if (res.status === 206) return new TranscriptError("no_captions", "This video has no captions.");
  if (res.status === 404) return new TranscriptError("unavailable", "This video is unavailable.");
  if (res.status === 401 || res.status === 403) {
    return new TranscriptError("upstream", "The transcript service rejected its API key. Check SUPADATA_API_KEY.");
  }
  if (res.status === 402 || res.status === 429) {
    return new TranscriptError(
      "upstream",
      "The transcript service's quota is used up for now. Try again later, or upload subtitles.",
    );
  }
  const body = (await res.json().catch(() => ({}))) as ErrorBody;
  return new TranscriptError("upstream", body.message || `The transcript service failed (${res.status}).`);
}

function toResponse(videoId: string, body: TranscriptBody): TranscriptResponse {
  if (typeof body.content === "string") {
    throw new TranscriptError("upstream", "The transcript service sent captions without timings.");
  }
  const cues: Cue[] = body.content
    .map((c) => ({ start: c.offset / 1000, end: (c.offset + c.duration) / 1000, text: c.text.trim() }))
    .filter((c) => c.text && Number.isFinite(c.start) && Number.isFinite(c.end));
  if (!cues.length) throw new TranscriptError("no_captions", "This video has no captions.");

  const codes = [...new Set([body.lang, ...(body.availableLangs ?? [])])];
  const tracks = codes.map(toTrack);
  return {
    videoId,
    // Supadata doesn't send the title; the page falls back to the player's.
    title: "",
    track: tracks[0],
    tracks,
    cues,
  };
}

const languageNames = new Intl.DisplayNames(["en"], { type: "language" });

function toTrack(code: string): TranscriptTrack {
  let name = code;
  try {
    name = languageNames.of(code) ?? code;
  } catch {
    // Not a code Intl knows; show it as is.
  }
  // Supadata doesn't say whether captions are human-made or automatic.
  return { code, name, isAutoGenerated: false };
}
