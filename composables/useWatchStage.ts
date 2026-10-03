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
