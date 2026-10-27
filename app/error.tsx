"use client";

import Link from "next/link";

/** Shown when something on a page crashes, instead of a blank screen. */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  // Values thrown in client code may not be Error objects.
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        The page hit an unexpected error. Your saved progress is still there.
      </p>
      {digest && <p className="font-mono text-xs text-zinc-400">Error id: {digest}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white transition hover:bg-sky-500"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-zinc-300 px-4 py-2 font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
