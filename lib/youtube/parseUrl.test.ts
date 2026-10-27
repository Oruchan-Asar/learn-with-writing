import { describe, expect, it } from "vitest";
import { parseTimeParam, parseYouTubeUrl } from "./parseUrl";

const ID = "dQw4w9WgXcQ";

describe("parseYouTubeUrl", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`],
    [`https://youtube.com/watch?v=${ID}&list=PL123&index=2`],
    [`https://m.youtube.com/watch?v=${ID}`],
    [`https://music.youtube.com/watch?v=${ID}`],
    [`www.youtube.com/watch?v=${ID}`],
    [`youtube.com/watch?feature=share&v=${ID}`],
    [`https://youtu.be/${ID}`],
    [`https://youtu.be/${ID}?si=abc123`],
    [`https://www.youtube.com/shorts/${ID}`],
    [`https://www.youtube.com/embed/${ID}`],
    [`https://www.youtube-nocookie.com/embed/${ID}`],
    [`https://www.youtube.com/live/${ID}?feature=share`],
    [`https://www.youtube.com/v/${ID}`],
    [`  https://youtu.be/${ID}  `],
    [ID],
  ])("reads the video id from %s", (input) => {
    expect(parseYouTubeUrl(input)?.videoId).toBe(ID);
  });

  it.each([
    [`https://youtu.be/${ID}?t=90`, 90],
    [`https://www.youtube.com/watch?v=${ID}&t=1m30s`, 90],
    [`https://www.youtube.com/watch?v=${ID}&t=1h2m3s`, 3723],
    [`https://www.youtube.com/embed/${ID}?start=42`, 42],
    [`https://www.youtube.com/watch?v=${ID}#t=15`, 15],
  ])("reads the start time from %s", (input, seconds) => {
    expect(parseYouTubeUrl(input)).toEqual({ videoId: ID, startSeconds: seconds });
  });

  it("leaves out a zero or invalid start time", () => {
    expect(parseYouTubeUrl(`https://youtu.be/${ID}?t=0`)).toEqual({ videoId: ID });
    expect(parseYouTubeUrl(`https://youtu.be/${ID}?t=abc`)).toEqual({ videoId: ID });
  });

  it.each([
    [""],
    ["   "],
    ["hello world"],
    ["https://vimeo.com/123456789"],
    [`https://example.com/watch?v=${ID}`],
    ["https://www.youtube.com/watch?v=short"],
    ["https://www.youtube.com/watch"],
    ["https://www.youtube.com/@3blue1brown"],
    ["https://www.youtube.com/playlist?list=PL123"],
    ["https://youtu.be/"],
  ])("rejects %j", (input) => {
    expect(parseYouTubeUrl(input)).toBeNull();
  });
});

describe("parseTimeParam", () => {
  it.each([
    ["90", 90],
    ["90s", 90],
    ["2m", 120],
    ["1m5s", 65],
    ["1h", 3600],
    ["1H2M3S", 3723],
  ])("parses %s", (input, seconds) => {
    expect(parseTimeParam(input)).toBe(seconds);
  });

  it.each([[""], ["abc"], ["1.5"], ["5s1m"]])("rejects %j", (input) => {
    expect(parseTimeParam(input)).toBeUndefined();
  });
});
