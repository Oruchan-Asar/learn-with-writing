"use client";

import { useEffect, useReducer, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import {
  accuracy,
  createTypingState,
  currentWordView,
  tokenDone,
  typingReducer,
  type TypingState,
} from "@/lib/typing/engine";

export type TypingResult = {
  keystrokes: number;
  mistakes: number;
  accuracy: number;
};

type Props = {
  /** The text to type. Give the component a `key` per segment to start fresh. */
  text: string;
  onComplete?: (result: TypingResult) => void;
};

// After a click on the video, wait for the click to land before taking focus back.
const IFRAME_REFOCUS_MS = 300;

/**
 * Shows a segment and takes the user's typing for it. Input goes through a
 * hidden <input> that keeps focus, so it works with mobile keyboards and IMEs
 * and key presses never reach the YouTube player.
 */
export function TypingArea({ text, onComplete }: Props) {
  const [state, dispatch] = useReducer(typingReducer, text, createTypingState);
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    if (state.done) {
      onCompleteRef.current?.({ keystrokes: state.keystrokes, mistakes: state.mistakes, accuracy: accuracy(state) });
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
      const delay = document.activeElement?.tagName === "IFRAME" ? IFRAME_REFOCUS_MS : 0;
      timer = setTimeout(() => {
        const el = document.activeElement;
        if (!el || el === document.body || el.tagName === "BUTTON" || el.tagName === "IFRAME") input.focus();
      }, delay);
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
    if (e.key !== "Backspace") return;
    e.preventDefault();
    dispatch({ type: e.ctrlKey || e.altKey || e.metaKey ? "clearWord" : "backspace" });
  }

  return (
    <div
      className="relative cursor-text rounded-xl px-4 py-6"
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
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="absolute h-px w-px opacity-0"
      />

      <p className="text-center font-mono text-2xl leading-relaxed tracking-wide" aria-live="off">
        <Tokens state={state} showCaret={focused} />
      </p>

      <div className="mt-3 flex justify-center gap-4 text-xs text-zinc-500 tabular-nums">
        <span>
          {Math.min(state.current + (state.done ? 0 : 1), state.wordTokens.length)} / {state.wordTokens.length} words
        </span>
        <span>{Math.round(accuracy(state) * 100)}% accuracy</span>
        {state.done && <span className="font-medium text-teal-600 dark:text-teal-400">✓ Done</span>}
      </div>

      {!focused && !state.done && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70 text-sm font-medium text-zinc-600 backdrop-blur-[2px] dark:bg-zinc-950/70 dark:text-zinc-300">
          Click here or start typing
        </div>
      )}
    </div>
  );
}

function Tokens({ state, showCaret }: { state: TypingState; showCaret: boolean }) {
  const currentToken = state.done ? -1 : state.wordTokens[state.current];

  return state.tokens.map((token, i) => {
    const space = token.spaceBefore ? " " : "";

    if (i === currentToken) {
      const view = currentWordView(state);
      const caretAt = [...state.typed].length;
      return (
        <span key={i}>
          {space}
          <span className="border-b-2 border-sky-500">
            {view.map((c, j) => (
              <span key={j} className={charClass(c.status, j === caretAt && showCaret)}>
                {c.char}
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
    return (
      <span key={i}>
        {space}
        <span className={className}>{token.text}</span>
      </span>
    );
  });
}

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
