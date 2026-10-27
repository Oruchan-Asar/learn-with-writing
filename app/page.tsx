import { UrlForm } from "@/components/UrlForm";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Learn with writing</h1>
        <p className="max-w-md text-zinc-600 dark:text-zinc-400">
          Paste a YouTube link and type along with the video. It waits for you when you fall behind.
        </p>
      </div>
      <UrlForm />
    </main>
  );
}
