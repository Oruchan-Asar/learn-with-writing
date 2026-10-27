import { charsMatch, DEFAULT_MATCH_OPTIONS, wordMatches, type MatchOptions } from "./match";
import { tokenize, type Token } from "./tokenize";

export type TypingOptions = MatchOptions & {
  /** A word only counts once the space after it is typed. */
  requireSpace: boolean;
  /** Punctuation has to be typed instead of being filled in. */
  typePunctuation: boolean;
};

export const DEFAULT_TYPING_OPTIONS: TypingOptions = {
  ...DEFAULT_MATCH_OPTIONS,
  requireSpace: false,
  typePunctuation: false,
};

export type TypingState = {
  tokens: Token[];
  /** Indexes into `tokens` of the words, in order. */
  wordTokens: number[];
  /** Indexes into `tokens` of what the user types, in order: the words, plus punctuation if it's typed. */
  units: number[];
  /** What has to be typed for each unit: its text, plus a space after it when spaces are required. */
  targets: string[];
  /** Index into `units` of the one being typed; equals its length when done. */
  current: number;
  /** What the user has typed of the current unit. */
  typed: string;
  /** Characters typed, and how many of them were wrong. */
  keystrokes: number;
  mistakes: number;
  /** Characters revealed with hints. They don't count as keystrokes. */
  hints: number;
  /** Mistakes per unit, by index into `units`. */
  mistakesByUnit: Record<number, number>;
  done: boolean;
  options: TypingOptions;
};

export type TypingAction =
  | { type: "input"; text: string }
  | { type: "backspace" }
  | { type: "clearWord" }
  | { type: "hint" };

// Wrong characters past the end of a unit that are still shown; more are ignored.
const MAX_EXTRA_CHARS = 8;

export function createTypingState(text: string, options: Partial<TypingOptions> = {}): TypingState {
  const opts = { ...DEFAULT_TYPING_OPTIONS, ...options };
  const tokens = tokenize(text);
  const wordTokens = tokens.flatMap((t, i) => (t.kind === "word" ? [i] : []));
  const units = opts.typePunctuation ? tokens.map((_, i) => i) : wordTokens;

  // A unit needs a space after it if the text has one before the next unit.
  // Punctuation that's filled in sits between them, so look at every token in between.
  const targets = units.map((tokenIndex, i) => {
    const nextUnit = units[i + 1];
    const spaceAfter =
      nextUnit !== undefined && tokens.slice(tokenIndex + 1, nextUnit + 1).some((t) => t.spaceBefore);
    return tokens[tokenIndex].text + (opts.requireSpace && spaceAfter ? " " : "");
  });

  return {
    tokens,
    wordTokens,
    units,
    targets,
    current: 0,
    typed: "",
    keystrokes: 0,
    mistakes: 0,
    hints: 0,
    mistakesByUnit: {},
    done: units.length === 0,
    options: opts,
  };
}

/**
 * Applies a keystroke. A unit must be typed correctly to move on; as soon as
 * it is, the next one starts. Unless spaces are required, they're ignored,
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
 * Reveals the next character of the current unit. Wrong characters are
 * replaced by the right ones first, so a hint always moves the user forward.
 */
function hint(state: TypingState): TypingState {
  const targetChars = [...currentTarget(state)];
  const typedChars = [...state.typed];
  let correct = 0;
  while (
    correct < typedChars.length &&
    correct < targetChars.length &&
    charsMatch(typedChars[correct], targetChars[correct], state.options)
  ) {
    correct++;
  }
  const typed = targetChars.slice(0, correct + 1).join("");
  const next = { ...state, typed, hints: state.hints + 1 };
  return correct + 1 >= targetChars.length ? advance(next) : next;
}

function advance(state: TypingState): TypingState {
  const current = state.current + 1;
  return { ...state, current, typed: "", done: current >= state.units.length };
}

function typeChar(state: TypingState, rawChar: string): TypingState {
  const isSpace = /\s/.test(rawChar);
  if (isSpace && !state.options.requireSpace) return state;
  const char = isSpace ? " " : rawChar;

  const target = currentTarget(state);
  const typedChars = [...state.typed];
  const targetChars = [...target];
  if (typedChars.length >= targetChars.length + MAX_EXTRA_CHARS) return state;

  const expected = targetChars[typedChars.length];
  // A character is only right if everything before it is right too.
  const prefixOk = typedChars.every((c, i) => charsMatch(c, targetChars[i], state.options));
  const correct = prefixOk && expected !== undefined && charsMatch(char, expected, state.options);
  const typed = state.typed + char;

  const next = {
    ...state,
    typed,
    keystrokes: state.keystrokes + 1,
    mistakes: state.mistakes + (correct ? 0 : 1),
    mistakesByUnit: correct
      ? state.mistakesByUnit
      : { ...state.mistakesByUnit, [state.current]: (state.mistakesByUnit[state.current] ?? 0) + 1 },
  };
  return wordMatches(typed, target, state.options) ? advance(next) : next;
}

/** The words the user typed wrong at least once, as written in the text. */
export function mistypedWords(state: TypingState): string[] {
  return Object.keys(state.mistakesByUnit)
    .map((i) => state.tokens[state.units[Number(i)]])
    .filter((token) => token.kind === "word")
    .map((token) => token.text);
}

/** The current unit's text, without the space after it. */
export function currentWord(state: TypingState): string {
  const index = state.units[state.current];
  return index === undefined ? "" : state.tokens[index].text;
}

function currentTarget(state: TypingState): string {
  return state.targets[state.current] ?? "";
}

/** How many words are typed, counting punctuation-only progress as none. */
export function wordsTyped(state: TypingState): number {
  if (state.done) return state.wordTokens.length;
  const currentToken = state.units[state.current];
  return state.wordTokens.filter((t) => t < currentToken).length;
}

/** Share of keystrokes that were right, from 0 to 1; 1 before any typing. */
export function accuracy(state: TypingState): number {
  return state.keystrokes ? (state.keystrokes - state.mistakes) / state.keystrokes : 1;
}

export type CharView = { char: string; status: "correct" | "wrong" | "pending" | "extra" };

// Makes a mistyped space visible.
const SPACE_MARK = "␣";

/**
 * Per-character status of the current unit, for coloring. The space a unit
 * may need after it isn't shown as a character (the gap to the next word is),
 * so anything typed past the unit's text shows as extra.
 */
export function currentWordView(state: TypingState): CharView[] {
  const wordChars = [...currentWord(state)];
  const typedChars = [...state.typed];
  const shown = (c: string) => (c === " " ? SPACE_MARK : c);
  let ok = true;
  const view: CharView[] = wordChars.map((char, i) => {
    if (i >= typedChars.length) return { char, status: "pending" };
    ok = ok && charsMatch(typedChars[i], char, state.options);
    // Show what the user typed where it's wrong, so they can see the mistake.
    return ok ? { char, status: "correct" } : { char: shown(typedChars[i]), status: "wrong" };
  });
  for (const char of typedChars.slice(wordChars.length)) view.push({ char: shown(char), status: "extra" });
  return view;
}

/**
 * Whether a token has been typed: a unit once the user has moved past it, and
 * punctuation that's filled in once the unit before it has been typed.
 */
export function tokenDone(state: TypingState, tokenIndex: number): boolean {
  if (state.done) return true;
  const currentToken = state.units[state.current];
  if (tokenIndex >= currentToken) return false;
  // Filled-in punctuation before the first unit counts as typed only once that unit is.
  return !(state.tokens[tokenIndex].kind === "punct" && state.current === 0 && !state.options.typePunctuation);
}
