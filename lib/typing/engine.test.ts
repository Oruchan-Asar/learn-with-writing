import { describe, expect, it } from "vitest";
import {
  accuracy,
  createTypingState,
  currentWord,
  currentWordView,
  mistypedWords,
  wordsTyped,
  tokenDone,
  typingReducer,
  type TypingAction,
  type TypingState,
} from "./engine";

const type = (state: TypingState, ...actions: (string | TypingAction)[]) =>
  actions.reduce((s, a) => typingReducer(s, typeof a === "string" ? { type: "input", text: a } : a), state);

const backspace: TypingAction = { type: "backspace" };

describe("typing engine", () => {
  it("moves to the next word as soon as a word is right", () => {
    const s = type(createTypingState("Hello there, friend."), "hello");
    expect(s.current).toBe(1);
    expect(s.typed).toBe("");
    expect(currentWord(s)).toBe("there");
  });

  it("finishes after the last word and ignores more input", () => {
    const s = type(createTypingState("Hi there friend."), "hi", "there", "friend");
    expect(s.done).toBe(true);
    expect(type(s, "more")).toBe(s);
  });

  it("ignores spaces, so typing them between words is harmless", () => {
    const s = type(createTypingState("one two three"), "one two thr");
    expect(s.current).toBe(2);
    expect(s.typed).toBe("thr");
    expect(s.keystrokes).toBe(9);
    expect(s.mistakes).toBe(0);
  });

  it("handles input that arrives in one chunk, like a paste", () => {
    expect(type(createTypingState("one two"), "onetwo").done).toBe(true);
  });

  it("counts wrong characters and blocks the word until they're fixed", () => {
    let s = type(createTypingState("cat dog"), "cx");
    expect(s.mistakes).toBe(1);
    expect(s.typed).toBe("cx");

    s = type(s, "t");
    expect(s.current).toBe(0);
    expect(s.mistakes).toBe(2);

    s = type(s, backspace, backspace, "at");
    expect(s.current).toBe(1);
    expect(s.keystrokes).toBe(5);
    expect(s.mistakes).toBe(2);
    expect(accuracy(s)).toBeCloseTo(3 / 5);
  });

  it("caps how many wrong characters are kept past the end of a word", () => {
    const s = type(createTypingState("go"), "gxxxxxxxxxxxxxxxxxxxx");
    expect(s.typed).toHaveLength(2 + 8);
  });

  it("clears the current word, and backspace stops at its start", () => {
    let s = type(createTypingState("one two"), "one", "tw", { type: "clearWord" });
    expect(s.typed).toBe("");
    expect(s.current).toBe(1);
    s = type(s, backspace);
    expect(s.current).toBe(1);
  });

  it("is case- and accent-insensitive by default, and can be strict", () => {
    expect(type(createTypingState("Café Olé"), "cafe ole").done).toBe(true);
    const strict = createTypingState("Café", { caseSensitive: true, ignoreAccents: false });
    expect(type(strict, "cafe").done).toBe(false);
    expect(type(strict, "Café").done).toBe(true);
  });

  it("accepts a straight apostrophe for a curly one", () => {
    expect(type(createTypingState("It’s fine"), "it's fine").done).toBe(true);
  });

  it("is done right away when there are no words to type", () => {
    expect(createTypingState("").done).toBe(true);
    expect(createTypingState("— ?!").done).toBe(true);
  });
});

describe("currentWordView", () => {
  it("marks correct, wrong, pending and extra characters", () => {
    expect(currentWordView(type(createTypingState("cat"), "cx"))).toEqual([
      { char: "c", status: "correct" },
      { char: "x", status: "wrong" },
      { char: "t", status: "pending" },
    ]);
    expect(currentWordView(type(createTypingState("cat"), "cazz"))).toEqual([
      { char: "c", status: "correct" },
      { char: "a", status: "correct" },
      { char: "z", status: "wrong" },
      { char: "z", status: "extra" },
    ]);
  });

  it("marks everything after the first mistake wrong", () => {
    expect(currentWordView(type(createTypingState("cat"), "xa")).map((c) => c.status)).toEqual([
      "wrong",
      "wrong",
      "pending",
    ]);
  });

  it("is empty when done", () => {
    expect(currentWordView(type(createTypingState("a"), "a"))).toEqual([]);
  });
});

describe("tokenDone", () => {
  // Tokens: ( Hello ) there .
  const fresh = createTypingState("(Hello) there.");

  it("marks words and punctuation done as the user goes", () => {
    expect([0, 1, 2, 3, 4].map((i) => tokenDone(fresh, i))).toEqual([false, false, false, false, false]);
    const s = type(fresh, "hello");
    expect([0, 1, 2, 3, 4].map((i) => tokenDone(s, i))).toEqual([true, true, true, false, false]);
    const done = type(s, "there");
    expect([0, 1, 2, 3, 4].map((i) => tokenDone(done, i))).toEqual([true, true, true, true, true]);
  });
});

describe("hints", () => {
  it("reveals the next letter without counting a keystroke", () => {
    const s = type(createTypingState("cat dog"), { type: "hint" });
    expect(s.typed).toBe("c");
    expect(s.hints).toBe(1);
    expect(s.keystrokes).toBe(0);
  });

  it("replaces wrong letters with the right ones first", () => {
    const s = type(createTypingState("cat"), "cx", { type: "hint" });
    expect(s.typed).toBe("ca");
  });

  it("moves to the next word when the hint completes it", () => {
    const s = type(createTypingState("cat dog"), "ca", { type: "hint" });
    expect(s.current).toBe(1);
    expect(s.typed).toBe("");
  });

  it("can finish the whole segment", () => {
    let s = createTypingState("go");
    s = type(s, { type: "hint" }, { type: "hint" });
    expect(s.done).toBe(true);
    expect(s.hints).toBe(2);
  });
});

describe("mistypedWords", () => {
  it("lists each word that got a wrong letter, once", () => {
    const s = type(createTypingState("The cat, the dog."), "the", "cx", backspace, "at", "tje", backspace, backspace, "he", "dog");
    expect(mistypedWords(s)).toEqual(["cat", "the"]);
    // In "tje", the "e" after the wrong "j" counts as wrong too.
    expect(s.mistakesByUnit).toEqual({ 1: 1, 2: 2 });
  });
});

describe("requiring a space after each word", () => {
  const opts = { requireSpace: true };

  it("waits for the space before moving on", () => {
    let s = type(createTypingState("one two", opts), "one");
    expect(s.current).toBe(0);
    s = type(s, " ");
    expect(s.current).toBe(1);
  });

  it("doesn't need a space after the last word", () => {
    expect(type(createTypingState("one two", opts), "one two").done).toBe(true);
  });

  it("counts a missing space as a mistake", () => {
    const s = type(createTypingState("one two", opts), "onet");
    expect(s.mistakes).toBe(1);
    expect(s.current).toBe(0);
    expect(currentWordView(s).at(-1)).toEqual({ char: "t", status: "extra" });
  });

  it("counts a space inside a word as a mistake, and shows it", () => {
    const s = type(createTypingState("open door", opts), "op ");
    expect(s.mistakes).toBe(1);
    expect(currentWordView(s)[2]).toEqual({ char: "␣", status: "wrong" });
  });

  it("treats any whitespace as a space", () => {
    expect(type(createTypingState("one two", opts), "one two").done).toBe(true);
  });

  it("needs the space even when punctuation in between is filled in", () => {
    let s = type(createTypingState("Hi, there.", opts), "hi");
    expect(s.current).toBe(0);
    s = type(s, " there");
    expect(s.done).toBe(true);
  });

  it("can be revealed by a hint", () => {
    const s = type(createTypingState("one two", opts), "one", { type: "hint" });
    expect(s.current).toBe(1);
    expect(s.hints).toBe(1);
  });
});

describe("typing punctuation", () => {
  const opts = { typePunctuation: true };

  it("makes punctuation part of what's typed", () => {
    let s = type(createTypingState("Hi, there.", opts), "hithere");
    expect(s.done).toBe(false);
    expect(currentWord(s)).toBe(",");
    s = type(createTypingState("Hi, there.", opts), "hi,there.");
    expect(s.done).toBe(true);
  });

  it("counts wrong punctuation as a mistake, but only lists words as mistyped", () => {
    const s = type(createTypingState("Stop. Go", opts), "stop!", backspace, ".go");
    expect(s.done).toBe(true);
    expect(s.mistakes).toBe(1);
    expect(mistypedWords(s)).toEqual([]);
  });

  it("accepts the keyboard version of typographic punctuation", () => {
    expect(type(createTypingState("Wait… “yes” — it’s fine", opts), `wait."yes"-it's fine`).done).toBe(true);
  });

  it("is exactly the text with spaces required too", () => {
    const strict = { typePunctuation: true, requireSpace: true, caseSensitive: true };
    expect(type(createTypingState("Hi, there. (Twice!)", strict), "Hi, there. (Twice!)").done).toBe(true);
    expect(type(createTypingState("Hi, there.", strict), "Hi,there.").done).toBe(false);
  });

  it("counts typed punctuation before the first word as done once typed", () => {
    let s = type(createTypingState("(Hello) there", opts), "(");
    expect(tokenDone(s, 0)).toBe(true);
    s = type(s, "hello)");
    expect([0, 1, 2].map((i) => tokenDone(s, i))).toEqual([true, true, true]);
  });

  it("counts only words in the word total", () => {
    let s = createTypingState("Hi, there.", opts);
    expect(wordsTyped(s)).toBe(0);
    s = type(s, "hi,");
    expect(wordsTyped(s)).toBe(1);
  });
});
