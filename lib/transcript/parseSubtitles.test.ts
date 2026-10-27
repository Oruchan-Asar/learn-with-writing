import { describe, expect, it } from "vitest";
import { parseSubtitles } from "./parseSubtitles";

describe("parseSubtitles", () => {
  it("reads SubRip", () => {
    const srt = [
      "1",
      "00:00:01,000 --> 00:00:03,500",
      "The kettle is on,",
      "so sit down.",
      "",
      "2",
      "00:00:04,250 --> 00:01:05,000",
      "Tea will be ready soon.",
      "",
    ].join("\n");
    expect(parseSubtitles(srt)).toEqual([
      { start: 1, end: 3.5, text: "The kettle is on, so sit down." },
      { start: 4.25, end: 65, text: "Tea will be ready soon." },
    ]);
  });

  it("reads WebVTT, with optional hours, cue ids and settings", () => {
    const vtt = [
      "WEBVTT - some title",
      "",
      "NOTE written by hand",
      "",
      "STYLE",
      "::cue { color: yellow }",
      "",
      "intro",
      "00:02.000 --> 00:04.000 align:start position:10%",
      "Good morning.",
      "",
      "01:00:00.500 --> 01:00:02.000",
      "An hour later.",
    ].join("\n");
    expect(parseSubtitles(vtt)).toEqual([
      { start: 2, end: 4, text: "Good morning." },
      { start: 3600.5, end: 3602, text: "An hour later." },
    ]);
  });

  it("removes tags, inline timestamps and positioning codes", () => {
    const vtt = [
      "WEBVTT",
      "",
      "00:00:01.000 --> 00:00:02.000",
      "<v Sam><i>Hello</i> <00:00:01.500><c.loud>there</c></v>",
      "",
      "00:00:03.000 --> 00:00:04.000",
      "{\\an8}Up top",
    ].join("\n");
    expect(parseSubtitles(vtt).map((c) => c.text)).toEqual(["Hello there", "Up top"]);
  });

  it("copes with Windows line endings, a byte-order mark and short milliseconds", () => {
    const srt = "﻿1\r\n00:00:01,5 --> 00:00:02,25\r\nHi\r\n\r\n";
    expect(parseSubtitles(srt)).toEqual([{ start: 1.5, end: 2.25, text: "Hi" }]);
  });

  it("skips blocks without timing, without text or ending before they start", () => {
    const srt = [
      "just some text",
      "",
      "1",
      "00:00:05,000 --> 00:00:06,000",
      "",
      "2",
      "00:00:09,000 --> 00:00:08,000",
      "Backwards",
    ].join("\n");
    expect(parseSubtitles(srt)).toEqual([]);
  });

  it("returns nothing for something that isn't subtitles", () => {
    expect(parseSubtitles("")).toEqual([]);
    expect(parseSubtitles("{\"not\": \"subtitles\"}")).toEqual([]);
  });
});
