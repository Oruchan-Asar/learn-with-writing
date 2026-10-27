"use client";

import { STORAGE_PREFIX, useStoredJSON, writeJSON } from "./storage";

export type Theme = "system" | "light" | "dark";

export type Settings = {
  /** "show": the whole sentence is visible. "fill": some words are hidden. */
  mode: "show" | "fill";
  /** Share of words hidden in fill mode. */
  hideRatio: number;
  theme: Theme;
  caseSensitive: boolean;
  /** Accept "e" for "é" and so on. */
  ignoreAccents: boolean;
  /** A word only counts once the space after it is typed. */
  requireSpace: boolean;
  /** Punctuation has to be typed instead of being filled in. */
  typePunctuation: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  mode: "show",
  hideRatio: 0.3,
  theme: "system",
  caseSensitive: false,
  ignoreAccents: true,
  requireSpace: false,
  typePunctuation: false,
};

type DifficultyRules = Pick<Settings, "requireSpace" | "caseSensitive" | "typePunctuation">;

/** Presets for how exactly the text must be typed. Accents stay a separate choice. */
export const DIFFICULTIES: { id: string; label: string; description: string; rules: DifficultyRules }[] = [
  {
    id: "easy",
    label: "Easy",
    description: "No spaces, any case, punctuation filled in",
    rules: { requireSpace: false, caseSensitive: false, typePunctuation: false },
  },
  {
    id: "medium",
    label: "Medium",
    description: "Space after each word",
    rules: { requireSpace: true, caseSensitive: false, typePunctuation: false },
  },
  {
    id: "hard",
    label: "Hard",
    description: "Spaces, exact case and punctuation",
    rules: { requireSpace: true, caseSensitive: true, typePunctuation: true },
  },
];

/** The preset the settings match, or "custom". */
export function difficultyOf(settings: Settings): string {
  const match = DIFFICULTIES.find((d) =>
    (Object.keys(d.rules) as (keyof DifficultyRules)[]).every((k) => d.rules[k] === settings[k]),
  );
  return match?.id ?? "custom";
}

export const HIDE_LEVELS = [
  { ratio: 0.3, label: "Easy (30%)" },
  { ratio: 0.6, label: "Medium (60%)" },
  { ratio: 1, label: "Hard (all words)" },
];

const KEY = "settings";

/**
 * Runs in <head> before the first paint, so a saved light/dark choice applies
 * without a flash. "system" leaves the attribute off and CSS follows the OS.
 */
export const THEME_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(
  STORAGE_PREFIX + KEY,
)})||"{}");if(s.theme==="light"||s.theme==="dark")document.documentElement.setAttribute("data-theme",s.theme)}catch(e){}})()`;

function applyTheme(theme: Theme) {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

export function useSettings(): [Settings, (change: Partial<Settings>) => void] {
  const stored = useStoredJSON<Partial<Settings>>(KEY);
  const settings = { ...DEFAULT_SETTINGS, ...stored };
  return [
    settings,
    (change) => {
      if (change.theme) applyTheme(change.theme);
      writeJSON(KEY, { ...settings, ...change });
    },
  ];
}
