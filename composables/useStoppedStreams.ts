import { reactive } from "vue";

// Streams the viewer turned off on a match page: the Stop button, or
// closing the floating player / pop-out window for the match they're on.
// Without this the inline player has no way to stay off — closing the
// floating player hands the stream back to the page, which autoplays it.
//
// Module-level so the inline players, the floating PiP and the pop-out
// tracker all read one set. Mirrored to sessionStorage so a stopped
// stream stays stopped across navigation and reloads in this tab, while
// a fresh tab autoplays again.
//
// Keys: the game-streamer feed follows the match (`liveStreamKey`), so a
// stream that restarts mid-match stays stopped; embeds follow their row
// (`embedStreamKey`), so stopping one Twitch channel leaves the others.

const STORAGE_KEY = "5stack:stopped-streams";

function readStopped(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const parsed = JSON.parse(
      window.sessionStorage.getItem(STORAGE_KEY) ?? "[]",
    );
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((key): key is string => typeof key === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

const stopped = reactive(readStopped());

function writeStopped() {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...stopped]));
  } catch {
    // A blocked store only means the stream autoplays again on reload.
  }
}

export const liveStreamKey = (matchId: string) => `live:${matchId}`;
export const embedStreamKey = (streamId: string) => `embed:${streamId}`;

export function useStoppedStreams() {
  function isStopped(key: string) {
    return stopped.has(key);
  }

  function stop(key: string) {
    if (stopped.has(key)) return;
    stopped.add(key);
    writeStopped();
  }

  function resume(key: string) {
    if (!stopped.delete(key)) return;
    writeStopped();
  }

  return { isStopped, stop, resume };
}
