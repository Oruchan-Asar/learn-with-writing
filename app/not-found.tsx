import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="text-5xl font-semibold text-zinc-300 dark:text-zinc-700">404</p>
      <h1 className="text-xl font-semibold">That page doesn&apos;t exist</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        If you followed a video link, check that it was copied completely. YouTube video ids are 11 characters long.
      </p>
      <Link href="/" className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white transition hover:bg-sky-500">
        Paste another link
      </Link>
    </main>
  );
}
