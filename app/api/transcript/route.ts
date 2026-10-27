import type { NextRequest } from "next/server";
import { TranscriptError, YoutubeiTranscriptProvider, type TranscriptErrorCode } from "@/lib/transcript/provider";
import type { TranscriptErrorResponse, TranscriptResponse } from "@/lib/transcript/types";
import { isValidVideoId } from "@/lib/youtube/parseUrl";

const provider = new YoutubeiTranscriptProvider();

// Captions rarely change, so keep recent ones in memory.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 100;
const cache = new Map<string, { at: number; data: TranscriptResponse }>();

const STATUS: Record<TranscriptErrorCode, number> = {
  unavailable: 404,
  no_captions: 404,
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
