import { describe, expect, it } from "vitest";
import { pickHiddenWords } from "./hide";

describe("pickHiddenWords", () => {
  it("hides the given share of words, rounded", () => {
    expect(pickHiddenWords(10, 0.3, "a").size).toBe(3);
    expect(pickHiddenWords(10, 0.6, "a").size).toBe(6);
    expect(pickHiddenWords(7, 0.5, "a").size).toBe(4);
  });

  it("hides everything at 1 and nothing at 0", () => {
    expect([...pickHiddenWords(4, 1, "a")].sort()).toEqual([0, 1, 2, 3]);
    expect(pickHiddenWords(4, 0, "a").size).toBe(0);
  });

  it("hides at least one word for any ratio above 0", () => {
    expect(pickHiddenWords(2, 0.1, "a").size).toBe(1);
  });

  it("gives the same words for the same seed, and usually different ones for another", () => {
    expect(pickHiddenWords(20, 0.3, "video:5")).toEqual(pickHiddenWords(20, 0.3, "video:5"));
    const seeds = ["video:1", "video:2", "video:3", "video:4"].map((s) => [...pickHiddenWords(20, 0.3, s)].sort().join());
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });

  it("only returns valid indexes", () => {
    const hidden = pickHiddenWords(15, 0.6, "x");
    expect([...hidden].every((i) => i >= 0 && i < 15)).toBe(true);
  });

  it("handles a segment without words", () => {
    expect(pickHiddenWords(0, 0.5, "a").size).toBe(0);
  });
});
