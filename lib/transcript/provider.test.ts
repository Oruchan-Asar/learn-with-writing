import { describe, expect, it } from "vitest";
import { pickTrack } from "./provider";

const track = (language_code: string, kind?: string) => ({ language_code, kind });

describe("pickTrack", () => {
  const tracks = [track("de"), track("en", "asr"), track("en-GB"), track("fr", "asr")];

  it("prefers a human-made track in the language", () => {
    expect(pickTrack(tracks, "en")).toEqual(track("en-GB"));
  });

  it("prefers an exact language match among human-made tracks", () => {
    expect(pickTrack([track("en-GB"), track("en")], "en")).toEqual(track("en"));
  });

  it("uses an auto-generated track when there's no human-made one", () => {
    expect(pickTrack(tracks, "fr")).toEqual(track("fr", "asr"));
  });

  it("falls back to the first human-made track, then to any track", () => {
    expect(pickTrack(tracks, "ja")).toEqual(track("de"));
    expect(pickTrack([track("fr", "asr"), track("es", "asr")], "ja")).toEqual(track("fr", "asr"));
  });

  it("matches case-insensitively", () => {
    expect(pickTrack([track("pt-BR")], "PT-br")).toEqual(track("pt-BR"));
  });
});
