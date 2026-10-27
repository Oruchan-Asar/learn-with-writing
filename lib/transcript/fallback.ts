import { TranscriptError, type TranscriptProvider } from "./provider";
import type { TranscriptResponse } from "./types";

/**
 * Tries providers in order until one returns captions. Stops early when one
 * says the video has no captions: that answer comes from YouTube itself, so
 * asking a paid service too would only spend a credit.
 */
export class FallbackTranscriptProvider implements TranscriptProvider {
  constructor(private providers: TranscriptProvider[]) {}

  async fetch(videoId: string, lang?: string): Promise<TranscriptResponse> {
    const errors: TranscriptError[] = [];
    for (const provider of this.providers) {
      try {
        return await provider.fetch(videoId, lang);
      } catch (err) {
        const error =
          err instanceof TranscriptError
            ? err
            : new TranscriptError("upstream", err instanceof Error ? err.message : "Fetching the captions failed.");
        errors.push(error);
        if (error.code === "no_captions") break;
      }
    }
    // An answer about the video itself beats a provider failing; otherwise the
    // last provider's error, since it was the last resort.
    throw errors.find((e) => e.code === "no_captions" || e.code === "unavailable") ?? errors.at(-1)!;
  }
}
