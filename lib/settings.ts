"use client";

import { useStoredJSON, writeJSON } from "./storage";

export type Settings = {
  /** "show": the whole sentence is visible. "fill": some words are hidden. */
  mode: "show" | "fill";
  /** Share of words hidden in fill mode. */
  hideRatio: number;
};

export const DEFAULT_SETTINGS: Settings = { mode: "show", hideRatio: 0.3 };

export const HIDE_LEVELS = [
  { ratio: 0.3, label: "Easy (30%)" },
  { ratio: 0.6, label: "Medium (60%)" },
  { ratio: 1, label: "Hard (all words)" },
];

const KEY = "settings";

export function useSettings(): [Settings, (change: Partial<Settings>) => void] {
  const stored = useStoredJSON<Partial<Settings>>(KEY);
  const settings = { ...DEFAULT_SETTINGS, ...stored };
  return [settings, (change) => writeJSON(KEY, { ...settings, ...change })];
}
