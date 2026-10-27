"use client";

import { useEffect, useRef } from "react";

/**
 * Keys that don't type anything, so they're free while the typing input has
 * focus, and that don't clash with browser shortcuts.
 */
export const SHORTCUTS = [
  { keys: "Tab", description: "Hint: reveal the next letter" },
  { keys: "Enter", description: "Replay the current segment" },
  { keys: "Esc", description: "Play / pause" },
  { keys: "← / →", description: "Previous / next segment" },
  { keys: "↑ / ↓", description: "Faster / slower" },
  { keys: "Ctrl+⌫", description: "Clear the current word" },
] as const;

export type ShortcutKey = "Enter" | "Escape" | "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

/**
 * Calls a handler when one of its keys is pressed outside other form fields
 * (the typing input is fine). Several components can each handle their own keys.
 */
export function useShortcuts(handlers: Partial<Record<ShortcutKey, () => void>>) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.isComposing) return;
      const handler = ref.current[e.key as ShortcutKey];
      if (!handler || !isShortcutTarget(e.target)) return;
      e.preventDefault();
      handler();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}

function isShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return true;
  if (target.dataset.typingInput !== undefined) return true;
  // Leave keys alone in other fields, and Enter/arrows on buttons and dialogs.
  return !target.closest("input, select, textarea, button, a, [contenteditable], [role=dialog]");
}
