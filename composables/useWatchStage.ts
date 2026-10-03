import { useState } from "#app";

// The streamed match on the /watch stage. Shared so the ticker can mark it
// "On stage" and swap a streamed live match onto it.
export function useWatchStage() {
  const stageMatchId = useState<string | null>(
    "watch-stage-match-id",
    () => null,
  );

  function setStage(matchId: string | null) {
    stageMatchId.value = matchId;
  }

  return { stageMatchId, setStage };
}

export type WatchHighlightsEvent = { id: string; name: string };

// The event an event card's "N plays from <event>" link scopes the /watch
// highlights to. Shown as a removable chip in the highlights filter row.
export function useWatchHighlightsEvent() {
  const highlightsEvent = useState<WatchHighlightsEvent | null>(
    "watch-highlights-event",
    () => null,
  );

  function showEventHighlights(event: WatchHighlightsEvent | null) {
    highlightsEvent.value = event;
    if (event && typeof document !== "undefined") {
      document
        .getElementById("watch-highlights")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return { highlightsEvent, showEventHighlights };
}
