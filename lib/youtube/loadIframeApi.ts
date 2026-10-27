declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
  }
}

const SCRIPT_SRC = "https://www.youtube.com/iframe_api";

let apiPromise: Promise<typeof YT> | null = null;

/** Loads the YouTube IFrame Player API once and resolves with the global `YT`. */
export function loadYouTubeIframeApi(): Promise<typeof YT> {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    // The API calls this global once it's ready; keep any handler set by someone else.
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error("Could not load the YouTube player. Check your connection or ad blocker."));
    };
    document.head.appendChild(script);
  });

  return apiPromise;
}
