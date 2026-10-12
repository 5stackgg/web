import {
  buildStageFrame,
  roundTick,
  stageRounds,
} from "../../../utilities/replayStage/frame";
import type { StageFrameOptions } from "../../../utilities/replayStage/frame";
import type { StageBlob } from "../../../utilities/replayStage/frameIndex";
import type { Scenario } from "./index";

/**
 * A real playback blob (built by build-fixture.mjs from a demo), played
 * through `buildStageFrame`: `?scenario=blob&fixture=inferno&round=8&t=14.5`.
 * `t` is seconds after freeze time ended; `select` picks a player by steam id
 * or name. `options` are the viewer's toggles (heatmap, trails, ...).
 */
export async function blobScenario(
  fixture: string,
  round: number | null,
  select: string | null,
  options: StageFrameOptions = {},
): Promise<Scenario> {
  const res = await fetch(`./fixtures/${fixture}.json`);
  if (!res.ok) {
    throw new Error(
      `fixture ${fixture}: ${res.status} (run scripts/replay-stage/build-fixture.mjs)`,
    );
  }
  const blob = (await res.json()) as StageBlob;
  const rounds = stageRounds(blob);
  const range = rounds.find((r) => r.round === round) ?? rounds[0];
  if (!range) {
    throw new Error(`fixture ${fixture} has no rounds`);
  }
  const selectedId =
    (select &&
      (blob.players ?? []).find(
        (p: { steam_id: string; name: string }) =>
          p.steam_id === select ||
          p.name.toLowerCase() === select.toLowerCase(),
      )?.steam_id) ||
    null;
  const rate = blob.tick_rate || 64;
  return {
    name: `blob:${fixture}`,
    map: blob.map_name ?? "",
    floor: 0,
    duration: (range.endTick - range.freezeEndTick) / rate,
    frameAt(t) {
      return buildStageFrame(
        blob,
        range.round,
        roundTick(blob, range.round, t),
        { ...options, selectedId },
      );
    },
  };
}
