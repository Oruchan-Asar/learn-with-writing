import { describe, expect, it } from "vitest";
import { charsMatch, normalizeChar, wordMatches } from "./match";

const strict = { caseSensitive: true, ignoreAccents: false };

describe("normalizeChar", () => {
  it.each([
    ["’", "'"],
    ["“", '"'],
    ["—", "-"],
    ["A", "a"],
    ["é", "e"],
    ["Ç", "c"],
  ])("normalizes %s to %s by default", (input, expected) => {
    expect(normalizeChar(input)).toBe(expected);
  });

  it("keeps case and accents when asked", () => {
    expect(normalizeChar("É", strict)).toBe("É");
  });
});

describe("charsMatch", () => {
  it("is lenient by default", () => {
    expect(charsMatch("a", "A")).toBe(true);
    expect(charsMatch("e", "é")).toBe(true);
    expect(charsMatch("'", "’")).toBe(true);
    expect(charsMatch("a", "b")).toBe(false);
  });

  it("can be strict", () => {
    expect(charsMatch("a", "A", strict)).toBe(false);
    expect(charsMatch("e", "é", strict)).toBe(false);
    expect(charsMatch("'", "’", strict)).toBe(true);
  });
});

describe("wordMatches", () => {
  it("needs every character, and the same length", () => {
    expect(wordMatches("dont", "don't")).toBe(false);
    expect(wordMatches("don't", "Don’t")).toBe(true);
    expect(wordMatches("cafe", "café")).toBe(true);
    expect(wordMatches("hello", "hell")).toBe(false);
    expect(wordMatches("", "")).toBe(true);
  });
});
