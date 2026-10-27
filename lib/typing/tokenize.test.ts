import { describe, expect, it } from "vitest";
import { tokenize, type Token } from "./tokenize";

const w = (text: string, spaceBefore = true): Token => ({ kind: "word", text, spaceBefore });
const p = (text: string, spaceBefore = false): Token => ({ kind: "punct", text, spaceBefore });

describe("tokenize", () => {
  it("splits words and trailing punctuation", () => {
    expect(tokenize("Hello there, friend.")).toEqual([w("Hello", false), w("there"), p(","), w("friend"), p(".")]);
  });

  it("keeps apostrophes, hyphens and number separators inside words", () => {
    expect(tokenize("don't well-known 3.5 1,000 it’s").map((t) => t.text)).toEqual([
      "don't",
      "well-known",
      "3.5",
      "1,000",
      "it’s",
    ]);
  });

  it("splits leading and wrapping punctuation off", () => {
    expect(tokenize('He said "yes" (twice)')).toEqual([
      w("He", false),
      w("said"),
      p('"', true),
      w("yes", false),
      p('"'),
      p("(", true),
      w("twice", false),
      p(")"),
    ]);
  });

  it("treats a lone dash or symbol as punctuation with a space before", () => {
    expect(tokenize("wait — what?!")).toEqual([w("wait", false), p("—", true), w("what"), p("?!")]);
    expect(tokenize("$5 & more").map((t) => [t.kind, t.text])).toEqual([
      ["punct", "$"],
      ["word", "5"],
      ["punct", "&"],
      ["word", "more"],
    ]);
  });

  it("handles letters and digits together, accents and non-Latin scripts", () => {
    expect(tokenize("28x28 café Ünïcode привет").map((t) => t.text)).toEqual(["28x28", "café", "Ünïcode", "привет"]);
  });

  it("ends a word at a trailing apostrophe or dot", () => {
    expect(tokenize("the dogs' U.S.").map((t) => t.text)).toEqual(["the", "dogs", "'", "U.S", "."]);
  });

  it("returns nothing for empty text", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("   ")).toEqual([]);
  });
});
