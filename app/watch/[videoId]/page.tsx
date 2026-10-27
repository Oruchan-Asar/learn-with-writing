import { Suspense } from "react";
import { notFound } from "next/navigation";
import { WatchView } from "@/components/WatchView";
import { isValidVideoId, parseTimeParam } from "@/lib/youtube/parseUrl";

type WatchPageProps = PageProps<"/watch/[videoId]">;

export default function WatchPage({ params, searchParams }: WatchPageProps) {
  return (
    <Suspense fallback={<WatchSkeleton />}>
      <Watch params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Watch({ params, searchParams }: WatchPageProps) {
  const { videoId } = await params;
  const { t } = await searchParams;
  if (!isValidVideoId(videoId)) notFound();

  const startSeconds = typeof t === "string" ? parseTimeParam(t) : undefined;
  return <WatchView videoId={videoId} startSeconds={startSeconds} />;
}

function WatchSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6">
      <div className="h-5" />
      <div className="aspect-video w-full animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
    </main>
  );
}
