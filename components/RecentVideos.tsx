"use client";

import Image from "next/image";
import Link from "next/link";
import { forgetRecent, RECENT_KEY, type RecentVideo } from "@/lib/progress";
import { useStoredJSON } from "@/lib/storage";

/** Videos the user practiced recently, with how far they got. */
export function RecentVideos() {
  const recent = useStoredJSON<RecentVideo[]>(RECENT_KEY);
  if (!recent?.length) return null;

  return (
    <section className="w-full">
      <h2 className="mb-3 text-sm font-medium text-zinc-500">Continue practicing</h2>
      <ul className="flex flex-col gap-2">
        {recent.map((video) => {
          const percent = video.total ? Math.round((video.completed / video.total) * 100) : 0;
          return (
            <li key={video.videoId} className="group relative">
              <Link
                href={`/watch/${video.videoId}`}
                className="flex items-center gap-3 rounded-lg p-2 pr-10 transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <Image
                  src={`https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`}
                  alt=""
                  width={96}
                  height={54}
                  className="aspect-video shrink-0 rounded-md bg-zinc-200 object-cover dark:bg-zinc-800"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{video.title || video.videoId}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                      <div className="h-full bg-teal-500" style={{ width: `${percent}%` }} />
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                      {video.completed} / {video.total}
                    </span>
                  </div>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => forgetRecent(video.videoId)}
                aria-label={`Remove ${video.title || video.videoId} from the list`}
                title="Remove from the list"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-zinc-400 opacity-0 transition group-hover:opacity-100 hover:text-zinc-700 focus:opacity-100 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
