import { decodeSmokeVoxels } from "~/utilities/replayStage/frameIndex";
import type { SmokeVoxelRow } from "~/utilities/replayStage/frameIndex";
import type { StageSmokeVoxels } from "~/utilities/replayStage/types";

const loaded = new Map<string, Promise<StageSmokeVoxels | null>>();

/**
 * A lineup's real smoke, as the practice plugin recorded it off the grenade
 * (the same grid a reparsed demo carries). Fetched once per url: the url is
 * cache-busted by when it was recorded. Null when there is none to draw, and
 * the stage floods its own estimate instead.
 */
export function lineupSmokeVoxels(
  url: string | null | undefined,
): Promise<StageSmokeVoxels | null> {
  if (!url) {
    return Promise.resolve(null);
  }
  let pending = loaded.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((res) => (res.ok ? (res.json() as Promise<SmokeVoxelRow>) : null))
      .then((row) => (row ? decodeSmokeVoxels(row) : null))
      .catch(() => null);
    loaded.set(url, pending);
  }
  return pending;
}
