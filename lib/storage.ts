"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

// Everything this app stores is under this prefix.
export const STORAGE_PREFIX = "lww:";

// The "storage" event only fires in other tabs, so changes in this tab are
// announced with our own event.
const CHANGE_EVENT = "lww-storage";

/** Reads a JSON value, or null when it's missing, unreadable or storage is blocked. */
export function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

/** Writes a JSON value, or removes it for null. Returns false when storage failed (full or blocked). */
export function writeJSON(key: string, value: unknown): boolean {
  try {
    if (value === null) localStorage.removeItem(STORAGE_PREFIX + key);
    else localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return true;
  } catch {
    return false;
  }
}

/** All stored keys (without the prefix) that start with `prefix`. */
export function listKeys(prefix: string): string[] {
  try {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(STORAGE_PREFIX + prefix))
      .map((k) => k.slice(STORAGE_PREFIX.length));
  } catch {
    return [];
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(STORAGE_PREFIX + key);
  } catch {
    return null;
  }
}

/**
 * A stored JSON value that stays in sync with storage, in this tab and others.
 * It's null during server rendering and hydration, then the stored value.
 */
export function useStoredJSON<T>(key: string): T | null {
  // The raw string is the snapshot: strings compare by value, so React only
  // re-renders when the stored value really changed.
  const raw = useSyncExternalStore(
    subscribe,
    useCallback(() => readRaw(key), [key]),
    () => null,
  );
  return useMemo(() => {
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }, [raw]);
}
