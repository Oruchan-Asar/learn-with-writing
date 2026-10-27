"use client";

import { useEffect, useReducer, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import {
  accuracy,
  createTypingState,
  currentWordView,
  mistypedWords,
  tokenDone,
  typingReducer,
  wordsTyped,
  type TypingAction,
  type TypingOptions,
  type TypingState,
} from "@/lib/typing/engine";
import type { TypingResult } from "@/lib/stats";


type Props = {
  /** The text to type. Give the component a `key` per segment to start fresh. */
  text: string;
  /** Indexes of words to hide (fill mode); they show as dots until typed. */
  hidden?: ReadonlySet<number>;
  /** How letters are compared. Fixed for the life of the component; change its `key` to apply new ones. */
  options?: Partial<TypingOptions>;
  onComplete?: (result: TypingResult) => void;
};

const NO_HIDDEN: ReadonlySet<number> = new Set();

// After a click on the video, wait for the click to land before taking focus back.
const IFRAME_REFOCUS_MS = 300;

/**
 * Shows a segment and takes the user's typing for it. Input goes through a
 * hidden <input> that keeps focus, so it works with mobile keyboards and IMEs
 * and key presses never reach the YouTube player.
 */
export function TypingArea({ text, hidden = NO_HIDDEN, options, onComplete }: Props) {
  const [state, rawDispatch] = useReducer(typingReducer, null, () => createTypingState(text, options));
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const startedAt = useRef<number | null>(null);

  const dispatch = (action: TypingAction) => {
    startedAt.current ??= performance.now();
    rawDispatch(action);
  };

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    if (state.done) {
      onCompleteRef.current?.({
        words: state.wordTokens.length,
        chars: state.wordTokens.reduce((sum, i) => sum + [...state.tokens[i].text].length, 0),
        keystrokes: state.keystrokes,
        mistakes: state.mistakes,
        hints: state.hints,
        durationMs: startedAt.current === null ? 0 : performance.now() - startedAt.current,
        mistyped: mistypedWords(state),
      });
    }
    // Only report the moment it becomes done.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.done]);

  // Take focus back when it moves somewhere typing makes no sense: the page,
  // a button, or the video (clicking it to start playback).
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const reclaim = () => {
      clearTimeout(timer);
      // While the input's blur runs, focus hasn't reached its new place yet, so
      // look once it has. Taking it back from the video too soon can land
      // between mouse-down and mouse-up there and cancel the click.
      timer = setTimeout(() => {
        const el = document.activeElement;
        if (el?.tagName === "IFRAME") {
          timer = setTimeout(() => {
            if (document.activeElement?.tagName === "IFRAME") input.focus();
          }, IFRAME_REFOCUS_MS);
        } else if (!el || el === document.body || el.tagName === "BUTTON") {
          input.focus();
        }
      }, 0);
    };
    // Typing anywhere on the page also goes to the input.
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inField = target.closest("input, select, textarea, [contenteditable]");
      if (!inField && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) input.focus();
    };

    input.addEventListener("blur", reclaim);
    window.addEventListener("blur", reclaim);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(timer);
      input.removeEventListener("blur", reclaim);
      window.removeEventListener("blur", reclaim);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // The input stays empty: each change is read as new characters and cleared.
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if ((e.nativeEvent as InputEvent).isComposing) return;
    const value = e.target.value;
    e.target.value = "";
    if (value) dispatch({ type: "input", text: value });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      dispatch({ type: "hint" });
    } else if (e.key === "Backspace") {
      e.preventDefault();
      dispatch({ type: e.ctrlKey || e.altKey || e.metaKey ? "clearWord" : "backspace" });
    }
  }

  return (
    <div
      className="relative cursor-text rounded-xl px-2 py-4 sm:px-4 sm:py-6"
      onMouseDown={(e) => {
        // Keep focus in the input instead of the text the user clicked.
        e.preventDefault();
        inputRef.current?.focus();
      }}
    >
      <input
        ref={inputRef}
        type="text"
        aria-label="Type the sentence"
        data-typing-input
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        defaultValue=""
        onChange={handleChange}
        onCompositionEnd={(e) => {
          const value = e.currentTarget.value;
          e.currentTarget.value = "";
          if (value) dispatch({ type: "input", text: value });
        }}
        onKeyDown={handleKeyDown}
        onFocus={(e) => {
          setFocused(true);
          // On phones the on-screen keyboard covers the lower half; keep the text above it.
          if (window.matchMedia("(max-width: 639px)").matches) {
            e.currentTarget.parentElement?.scrollIntoView({ block: "center", behavior: "smooth" });
          }
        }}
        onBlur={() => setFocused(false)}
        className="absolute h-px w-px opacity-0"
      />

      <p className="text-center font-mono text-xl leading-relaxed tracking-wide sm:text-2xl" aria-live="off">
        <Tokens state={state} hidden={hidden} showCaret={focused} />
      </p>

      <div className="mt-3 flex justify-center gap-4 text-xs text-zinc-500 tabular-nums">
        <span>
          {Math.min(wordsTyped(state) + (state.done ? 0 : 1), state.wordTokens.length)} / {state.wordTokens.length} words
        </span>
        <span>{Math.round(accuracy(state) * 100)}% accuracy</span>
        {state.done ? (
          <span className="font-medium text-teal-600 dark:text-teal-400">✓ Done</span>
        ) : (
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => {
              dispatch({ type: "hint" });
              inputRef.current?.focus();
            }}
            className="underline decoration-dotted underline-offset-2 hover:text-zinc-800 dark:hover:text-zinc-200"
            title="Reveal the next letter (Tab)"
          >
            Hint (Tab){state.hints > 0 && ` · ${state.hints} used`}
          </button>
        )}
      </div>

      {!focused && !state.done && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70 text-sm font-medium text-zinc-600 backdrop-blur-[2px] dark:bg-zinc-950/70 dark:text-zinc-300">
          Click here or start typing
        </div>
      )}
    </div>
  );
}

function Tokens({ state, hidden, showCaret }: { state: TypingState; hidden: ReadonlySet<number>; showCaret: boolean }) {
  const currentToken = state.done ? -1 : state.wordTokens[state.current];
  const isHidden = (tokenIndex: number) => hidden.has(state.wordTokens.indexOf(tokenIndex));

  return state.tokens.map((token, i) => {
    const space = token.spaceBefore ? " " : "";

    if (i === currentToken) {
      const view = currentWordView(state);
      const caretAt = [...state.typed].length;
      const hideRest = isHidden(i);
      return (
        <span key={i}>
          {space}
          <span className="border-b-2 border-sky-500">
            {view.map((c, j) => (
              <span key={j} className={charClass(c.status, j === caretAt && showCaret)}>
                {hideRest && c.status === "pending" ? HIDDEN_CHAR : c.char}
              </span>
            ))}
            {caretAt >= view.length && showCaret && <Caret />}
          </span>
        </span>
      );
    }

    const done = tokenDone(state, i);
    const className = done
      ? "text-teal-600 dark:text-teal-400"
      : token.kind === "word"
        ? "text-zinc-400 underline decoration-zinc-300 decoration-dotted underline-offset-8 dark:text-zinc-500 dark:decoration-zinc-700"
        : "text-zinc-400 dark:text-zinc-500";
    const shown = !done && token.kind === "word" && isHidden(i) ? HIDDEN_CHAR.repeat([...token.text].length) : token.text;
    return (
      <span key={i}>
        {space}
        <span className={className}>{shown}</span>
      </span>
    );
  });
}

// Stands in for each letter of a hidden word; same width in a monospace font.
const HIDDEN_CHAR = "•";

function charClass(status: "correct" | "wrong" | "pending" | "extra", caret: boolean): string {
  const color = {
    correct: "text-zinc-900 dark:text-zinc-50",
    wrong: "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400",
    extra: "bg-red-100 text-red-600 line-through dark:bg-red-950 dark:text-red-400",
    pending: "text-zinc-400 dark:text-zinc-500",
  }[status];
  // The caret sits on the left edge of the next character to type.
  return caret ? `${color} shadow-[inset_2px_0_0_0] shadow-sky-500 animate-pulse` : color;
}

function Caret() {
  return <span className="inline-block h-[1.1em] w-0.5 translate-y-1 animate-pulse bg-sky-500" aria-hidden />;
}
