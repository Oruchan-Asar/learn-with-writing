import { charsMatch, DEFAULT_MATCH_OPTIONS, wordMatches, type MatchOptions } from "./match";
import { tokenize, type Token } from "./tokenize";

export type TypingState = {
  tokens: Token[];
  /** Indexes into `tokens` of the words the user types, in order. */
  wordTokens: number[];
  /** Index into `wordTokens` of the word being typed; equals its length when done. */
  current: number;
  /** What the user has typed of the current word. */
  typed: string;
  /** Characters typed, and how many of them were wrong. */
  keystrokes: number;
  mistakes: number;
  /** Letters revealed with hints. They don't count as keystrokes. */
  hints: number;
  /** Mistakes per word, by index into `wordTokens`. */
  mistakesByWord: Record<number, number>;
  done: boolean;
  options: MatchOptions;
};

export type TypingAction =
  | { type: "input"; text: string }
  | { type: "backspace" }
  | { type: "clearWord" }
  | { type: "hint" };

// Wrong characters past the end of a word that are still shown; more are ignored.
const MAX_EXTRA_CHARS = 8;

export function createTypingState(text: string, options: Partial<MatchOptions> = {}): TypingState {
  const tokens = tokenize(text);
  const wordTokens = tokens.flatMap((t, i) => (t.kind === "word" ? [i] : []));
  return {
    tokens,
    wordTokens,
    current: 0,
    typed: "",
    keystrokes: 0,
    mistakes: 0,
    hints: 0,
    mistakesByWord: {},
    done: wordTokens.length === 0,
    options: { ...DEFAULT_MATCH_OPTIONS, ...options },
  };
}

/**
 * Applies a keystroke. A word must be typed correctly to move on; as soon as
 * it is, the next word starts, so no space is needed. Spaces are ignored,
 * which also absorbs the habit of pressing space after each word. Wrong
 * characters stay until they're deleted.
 */
export function typingReducer(state: TypingState, action: TypingAction): TypingState {
  if (state.done) return state;

  switch (action.type) {
    case "input": {
      let next = state;
      for (const char of action.text) {
        if (next.done) break;
        next = typeChar(next, char);
      }
      return next;
    }
    case "backspace":
      return state.typed ? { ...state, typed: [...state.typed].slice(0, -1).join("") } : state;
    case "clearWord":
      return state.typed ? { ...state, typed: "" } : state;
    case "hint":
      return hint(state);
  }
}

/**
 * Reveals the next letter of the current word. Wrong letters are replaced by
 * the right ones first, so a hint always moves the user forward.
 */
function hint(state: TypingState): TypingState {
  const wordChars = [...currentWord(state)];
  const typedChars = [...state.typed];
  let correct = 0;
  while (correct < typedChars.length && correct < wordChars.length && charsMatch(typedChars[correct], wordChars[correct], state.options)) {
    correct++;
  }
  const typed = wordChars.slice(0, correct + 1).join("");
  const next = { ...state, typed, hints: state.hints + 1 };
  return typed.length === wordChars.join("").length ? advance(next) : next;
}

function advance(state: TypingState): TypingState {
  const current = state.current + 1;
  return { ...state, current, typed: "", done: current >= state.wordTokens.length };
}

function typeChar(state: TypingState, char: string): TypingState {
  if (/\s/.test(char)) return state;

  const word = currentWord(state);
  const typedChars = [...state.typed];
  const wordChars = [...word];
  if (typedChars.length >= wordChars.length + MAX_EXTRA_CHARS) return state;

  const expected = wordChars[typedChars.length];
  // A character is only right if everything before it is right too.
  const prefixOk = typedChars.every((c, i) => charsMatch(c, wordChars[i], state.options));
  const correct = prefixOk && expected !== undefined && charsMatch(char, expected, state.options);
  const typed = state.typed + char;

  const next = {
    ...state,
    typed,
    keystrokes: state.keystrokes + 1,
    mistakes: state.mistakes + (correct ? 0 : 1),
    mistakesByWord: correct
      ? state.mistakesByWord
      : { ...state.mistakesByWord, [state.current]: (state.mistakesByWord[state.current] ?? 0) + 1 },
  };
  return wordMatches(typed, word, state.options) ? advance(next) : next;
}

/** The words the user typed wrong at least once, as written in the text. */
export function mistypedWords(state: TypingState): string[] {
  return Object.keys(state.mistakesByWord).map((i) => state.tokens[state.wordTokens[Number(i)]].text);
}

export function currentWord(state: TypingState): string {
  const index = state.wordTokens[state.current];
  return index === undefined ? "" : state.tokens[index].text;
}

/** Share of keystrokes that were right, from 0 to 1; 1 before any typing. */
export function accuracy(state: TypingState): number {
  return state.keystrokes ? (state.keystrokes - state.mistakes) / state.keystrokes : 1;
}

export type CharView = { char: string; status: "correct" | "wrong" | "pending" | "extra" };

/** Per-character status of the current word, for coloring. */
export function currentWordView(state: TypingState): CharView[] {
  const wordChars = [...currentWord(state)];
  const typedChars = [...state.typed];
  let ok = true;
  const view: CharView[] = wordChars.map((char, i) => {
    if (i >= typedChars.length) return { char, status: "pending" };
    ok = ok && charsMatch(typedChars[i], char, state.options);
    // Show what the user typed where it's wrong, so they can see the mistake.
    return ok ? { char, status: "correct" } : { char: typedChars[i], status: "wrong" };
  });
  for (const char of typedChars.slice(wordChars.length)) view.push({ char, status: "extra" });
  return view;
}

/**
 * Whether a token has been typed: a word once the user has moved past it,
 * punctuation once the word before it has been typed.
 */
export function tokenDone(state: TypingState, tokenIndex: number): boolean {
  if (state.done) return true;
  const currentToken = state.wordTokens[state.current];
  if (tokenIndex >= currentToken) return false;
  // Punctuation before the first word counts as typed only once that word is.
  return !(state.tokens[tokenIndex].kind === "punct" && state.current === 0);
}
