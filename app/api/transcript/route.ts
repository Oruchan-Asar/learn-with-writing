import type { NextRequest } from "next/server";
import { FallbackTranscriptProvider } from "@/lib/transcript/fallback";
import {
  TranscriptError,
  YoutubeiTranscriptProvider,
  type TranscriptErrorCode,
  type TranscriptProvider,
} from "@/lib/transcript/provider";
import { SupadataTranscriptProvider } from "@/lib/transcript/supadata";
import type { TranscriptErrorResponse, TranscriptResponse } from "@/lib/transcript/types";
import { isValidVideoId } from "@/lib/youtube/parseUrl";

// YouTube directly first (free), then Supadata when a key is set: YouTube
// blocks many cloud servers, such as serverless hosts.
const providers: TranscriptProvider[] = [new YoutubeiTranscriptProvider()];
if (process.env.SUPADATA_API_KEY) providers.push(new SupadataTranscriptProvider(process.env.SUPADATA_API_KEY));
const provider = new FallbackTranscriptProvider(providers);

// Captions rarely change, so keep recent ones in memory.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 100;
const cache = new Map<string, { at: number; data: TranscriptResponse }>();

const STATUS: Record<TranscriptErrorCode, number> = {
  unavailable: 404,
  no_captions: 404,
  blocked: 503,
  upstream: 502,
};

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("v") ?? "";
  const lang = request.nextUrl.searchParams.get("lang") || undefined;
  if (!isValidVideoId(videoId)) return errorResponse("Invalid video id.", 400);

  const key = `${videoId}:${lang ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return Response.json(hit.data);

  try {
    const data = await provider.fetch(videoId, lang);
    cache.delete(key);
    cache.set(key, { at: Date.now(), data });
    if (cache.size > CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value!);
    return Response.json(data);
  } catch (err) {
    if (err instanceof TranscriptError) return errorResponse(err.message, STATUS[err.code]);
    console.error("Transcript fetch failed", err);
    return errorResponse("Something went wrong while fetching the captions.", 500);
  }
}

function errorResponse(error: string, status: number) {
  return Response.json({ error } satisfies TranscriptErrorResponse, { status });
}
