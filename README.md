# Learn with writing

Type along with YouTube videos to practice a language.

Paste a YouTube link. The video plays above, and its transcript appears below, one sentence-sized segment at a time. You type the segment while the video plays. If the segment ends before you finish, the video pauses and waits for you. When you've typed it, the video plays on.

## Features

- **Pause and resume.** The video pauses at the end of any segment you haven't typed and starts again as soon as you finish. If you paused the video yourself, it stays paused.
- **Forgiving typing.** You move to the next word as soon as the current one is right, so spaces are optional. Wrong letters show in red until you delete them. Punctuation is filled in for you. Case and accents are ignored by default; you can make both strict in Settings.
- **Fill mode.** Hide 30%, 60% or all of the words and type what you hear.
- **Hints.** Press Tab to reveal the next letter.
- **Stats.** Words per minute, accuracy, and a session summary that lists the words you mistyped most.
- **Saved progress.** Your place and results are saved in the browser for each video. When you come back, you can continue where you left off. Recent videos are listed on the home page.
- **Your own subtitles.** If a video has no captions, or YouTube won't hand them out, upload an `.srt` or `.vtt` file instead.
- **Caption languages.** Pick any caption track the video has. Human-made captions are preferred over auto-generated ones.
- **Settings.** Light, dark or system theme, and typing rules.
- **Phone layout.** The page works on phones too.

### Keyboard shortcuts

| Key | Action |
|---|---|
| `Tab` | Hint: reveal the next letter |
| `Enter` | Replay the current segment |
| `Esc` | Play / pause |
| `←` / `→` | Previous / next segment |
| `↑` / `↓` | Faster / slower |
| `Ctrl` + `Backspace` | Clear the current word |

## Getting started

You need [Node.js](https://nodejs.org) 22.12 or newer. The app itself runs on 20.9 and up, but the unit tests need 22.12.

```bash
npm install
npm run dev
```

Then open http://localhost:3000 and paste a YouTube link.

**The first time you play a video, click the video itself, not the app's Play button.** Browsers block a video with sound from starting until you've started it yourself once. After that, the app can pause and resume it.

## Tests

Unit tests (Vitest) cover the core logic: link parsing, caption parsing, segmentation, typing, sync, stats and subtitle files.

```bash
npm test
```

End-to-end tests (Playwright) run in a real browser. They paste a link, check that the video pauses at the end of a segment, type it, and check that the video plays on. They also cover the subtitle upload and the error screens. The transcript is mocked with made-up text, but the YouTube player is real, so these tests need internet access.

```bash
npx playwright install chromium   # once
npm run test:e2e
```

Other checks:

```bash
npm run lint
npm run build
```

## How it works

| Part | Where |
|---|---|
| Embedding and controlling the video ([YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)) | `components/YouTubePlayer.tsx` |
| Fetching captions on the server ([youtubei.js](https://github.com/LuanRT/YouTube.js)), with a short in-memory cache | `app/api/transcript/route.ts`, `lib/transcript/provider.ts` |
| Splitting captions into segments at sentence ends, pauses and length limits | `lib/transcript/segmenter.ts` |
| The typing logic, as a pure reducer | `lib/typing/engine.ts` |
| Keeping video and typing in step (checked every 50 ms) | `lib/sync/syncStep.ts`, `lib/sync/usePlayerSync.ts` |
| Settings, progress and uploaded subtitles, saved in `localStorage` | `lib/storage.ts`, `lib/settings.ts`, `lib/progress.ts` |

Built with Next.js 16, React 19, TypeScript and Tailwind CSS 4. [PLAN.md](PLAN.md) has the original plan, plus notes on what each milestone taught.

## Known limits

- **Captions come from an unofficial source.** YouTube has no public API for the captions of videos you don't own. The app uses YouTube's internal API through youtubei.js, which can break whenever YouTube changes something.
- **YouTube may rate-limit caption downloads.** After many requests in a short time (for example, reloading often during development), YouTube answers with "429 Too Many Requests" for a while. The app says so and offers the subtitle upload. The cache lives in memory only, so it's empty again after every server restart.
- **The first start needs a click on the video.** YouTube's player can also ignore a click made the moment it appears; clicking again works.
- **Hiding YouTube's own captions is unofficial.** The player switches them off while the video plays, so they don't give away the text, but the call it uses is undocumented and could stop working.
- **Some videos can't be embedded.** Their owners don't allow it. The player then shows an "Open on YouTube" link.
- **Everything is stored in your browser.** There are no accounts. Progress doesn't follow you to another browser or device, and clearing site data removes it.
- **Ads.** During a YouTube ad, the video's own time doesn't move, so the typing simply waits until the ad ends.
- **Segment lengths are approximate.** Auto-generated captions have little punctuation, so those segments are cut by pauses and length limits rather than at sentence ends. Very short segments can pause almost immediately.
