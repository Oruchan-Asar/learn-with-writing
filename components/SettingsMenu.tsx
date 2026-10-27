"use client";

import { useEffect, useRef, useState } from "react";
import { SHORTCUTS } from "@/lib/shortcuts";
import { useSettings, type Theme } from "@/lib/settings";

const THEMES: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** Settings popover: theme, matching rules and the keyboard shortcuts. */
export function SettingsMenu() {
  const [settings, update] = useSettings();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on a click outside or on Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="h-8 rounded-lg px-3 text-sm text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        ⚙ Settings
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Settings"
          className="absolute right-0 z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-zinc-200 bg-white p-4 text-sm shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        >
          <fieldset>
            <legend className="mb-2 font-medium">Theme</legend>
            <div className="flex overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700" role="group">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={settings.theme === t.value}
                  onClick={() => update({ theme: t.value })}
                  className="h-8 flex-1 transition hover:bg-zinc-100 aria-pressed:bg-sky-600 aria-pressed:text-white dark:hover:bg-zinc-800"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-4 flex flex-col gap-2">
            <legend className="mb-2 font-medium">Typing</legend>
            <Toggle
              label="Match upper and lower case"
              checked={settings.caseSensitive}
              onChange={(caseSensitive) => update({ caseSensitive })}
            />
            <Toggle
              label="Accept letters without accents (e for é)"
              checked={settings.ignoreAccents}
              onChange={(ignoreAccents) => update({ ignoreAccents })}
            />
          </fieldset>

          <div className="mt-4">
            <h3 className="mb-2 font-medium">Keyboard shortcuts</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-zinc-600 dark:text-zinc-400">
              {SHORTCUTS.map((s) => (
                <div key={s.keys} className="contents">
                  <dt>
                    <kbd className="rounded border border-zinc-300 bg-zinc-50 px-1.5 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-800">
                      {s.keys}
                    </kbd>
                  </dt>
                  <dd>{s.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-sky-600"
      />
      {label}
    </label>
  );
}
