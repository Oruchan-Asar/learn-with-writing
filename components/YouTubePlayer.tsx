"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { loadYouTubeIframeApi } from "@/lib/youtube/loadIframeApi";

/** Imperative controls the rest of the app uses to drive the video. */
export type YouTubePlayerHandle = {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getState: () => YT.PlayerState | null;
  getPlaybackRate: () => number;
  setPlaybackRate: (rate: number) => void;
  /** The video's title as the player knows it; empty until it's loaded. */
  getTitle: () => string;
};

type Props = {
  videoId: string;
  startSeconds?: number;
  ref?: Ref<YouTubePlayerHandle>;
  onReady?: () => void;
  onStateChange?: (state: YT.PlayerState) => void;
  onError?: (message: string) => void;
};

const ERROR_MESSAGES: Record<number, string> = {
  2: "The video id is invalid.",
  5: "This video can't be played in the browser's HTML5 player.",
  100: "This video doesn't exist or is private.",
  // YouTube also uses these codes for videos that don't exist.
  101: "This video can't be played here. It may not exist, or its owner doesn't allow embedding.",
  150: "This video can't be played here. It may not exist, or its owner doesn't allow embedding.",
};

/**
 * Turns off YouTube's own captions, which would show the text the user is typing.
 * `cc_load_policy: 0` doesn't override a viewer's "always show captions" setting,
 * so unload the captions module instead. It's undocumented, so ignore failures.
 */
function hideCaptions(player: YT.Player) {
  const p = player as YT.Player & { unloadModule?: (name: string) => void };
  try {
    p.unloadModule?.("captions");
    p.unloadModule?.("cc");
  } catch {
    // Not available in this player version; captions stay as they are.
  }
}

export function YouTubePlayer({ videoId, startSeconds, ref, onReady, onStateChange, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Keep the latest callbacks without recreating the player when they change.
  const callbacks = useRef({ onReady, onStateChange, onError });
  useEffect(() => {
    callbacks.current = { onReady, onStateChange, onError };
  });

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    // YT.Player replaces its target element with an iframe, so give it a fresh
    // child each time instead of the container React owns.
    const target = document.createElement("div");
    container.appendChild(target);

    loadYouTubeIframeApi()
      .then((api) => {
        if (cancelled) return;
        playerRef.current = new api.Player(target, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            start: startSeconds ? Math.floor(startSeconds) : undefined,
            playsinline: 1,
            rel: 0,
            iv_load_policy: 3,
          },
          events: {
            onReady: () => callbacks.current.onReady?.(),
            onStateChange: (e) => {
              if (e.data === api.PlayerState.PLAYING) hideCaptions(e.target);
              callbacks.current.onStateChange?.(e.data);
            },
            onError: (e) =>
              callbacks.current.onError?.(ERROR_MESSAGES[e.data] ?? `The player failed (error ${e.data}).`),
          },
        });
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      container.replaceChildren();
    };
  }, [videoId, startSeconds]);

  useImperativeHandle(
    ref,
    () => {
      // Methods only exist once the player is ready, so guard every call.
      const p = () => {
        const player = playerRef.current;
        return player && typeof player.getCurrentTime === "function" ? player : null;
      };
      return {
        // Browsers block unmuted playback started from outside the iframe until the user
        // has played the video themselves once, so the first start must be a click on it.
        play: () => p()?.playVideo(),
        pause: () => p()?.pauseVideo(),
        seekTo: (seconds) => p()?.seekTo(seconds, true),
        getCurrentTime: () => p()?.getCurrentTime() ?? 0,
        getDuration: () => p()?.getDuration() ?? 0,
        getState: () => p()?.getPlayerState() ?? null,
        getPlaybackRate: () => p()?.getPlaybackRate() ?? 1,
        setPlaybackRate: (rate) => p()?.setPlaybackRate(rate),
        // getVideoData is part of the player but missing from its type definitions.
        getTitle: () => (p() as (YT.Player & { getVideoData?: () => { title?: string } }) | null)?.getVideoData?.().title ?? "",
      };
    },
    [],
  );

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-lg">
      <div ref={containerRef} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-zinc-300">
          {loadError}
        </div>
      )}
    </div>
  );
}
