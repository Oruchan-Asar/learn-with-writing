import type { SessionSummary as Summary } from "@/lib/stats";

type Props = {
  summary: Summary;
  total: number;
  onClose: () => void;
};

/** WPM, accuracy, time and the words that went wrong most, for this video. */
export function SessionSummary({ summary, total, onClose }: Props) {
  const minutes = Math.floor(summary.typingMs / 60000);
  const seconds = Math.round((summary.typingMs % 60000) / 1000);

  return (
    <section
      aria-label="Session summary"
      className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/60"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Session summary</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          Close
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Words per minute" value={Math.round(summary.wpm).toString()} />
        <Stat label="Accuracy" value={`${Math.round(summary.accuracy * 100)}%`} />
        <Stat label="Segments typed" value={`${summary.segments} / ${total}`} />
        <Stat label="Typing time" value={`${minutes}:${String(seconds).padStart(2, "0")}`} />
      </dl>

      <p className="mt-4 text-sm text-zinc-500">
        {summary.words} words typed · {summary.hints} {summary.hints === 1 ? "hint" : "hints"} used
      </p>

      {summary.mistyped.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium">Words to practice</h3>
          <ul className="flex flex-wrap gap-2">
            {summary.mistyped.map(({ word, count }) => (
              <li
                key={word}
                className="rounded-md bg-red-50 px-2 py-1 font-mono text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
              >
                {word}
                {count > 1 && <span className="ml-1 text-xs opacity-70">×{count}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
