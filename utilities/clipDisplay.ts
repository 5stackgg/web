import type { Clip } from "~/types/clip";
import cleanMapName from "~/utilities/cleanMapName";
import type { ClipQueueItem } from "~/composables/useClipModal";

type Translate = (key: string, ...args: any[]) => string;

// The API's auto-title leads with "<player> — " (or " - ", " – "); every
// surface already names the player beside the title, so drop the prefix.
export function clipDisplayTitle(
  title: string | null | undefined,
  playerName: string | null | undefined,
): string | null {
  const raw = title?.trim() ?? "";
  if (!raw) return null;
  const player = playerName?.trim();
  if (!player) return raw;
  const escaped = player.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stripped = raw
    .replace(new RegExp(`^${escaped}\\s*[—–-]\\s*`, "i"), "")
    .trim();
  return stripped || raw;
}

export type ClipKillTier = {
  // Five slanted marks with `filled` lit -- only for single-round clips,
  // where the count is a real multi-kill (a recap's total isn't).
  marks: boolean;
  filled: number;
  label: string;
};

export function clipKillTier(
  clip: Pick<Clip, "kills_count" | "round">,
  t: Translate,
): ClipKillTier | null {
  const kills = clip.kills_count ?? 0;
  if (kills <= 0) return null;
  if (clip.round != null && kills <= 5) {
    let label: string;
    if (kills === 5) label = t("clips.tile.kills.ace");
    else if (kills === 1) label = t("clips.tile.kills.one");
    else label = t("clips.tile.kills.multi", { n: kills });
    return { marks: true, filled: kills, label };
  }
  return {
    marks: false,
    filled: 0,
    label: t("clips.tile.kills.total", { count: kills }, kills),
  };
}

export function formatClipDuration(
  ms: number | null | undefined,
): string | null {
  if (!ms || ms <= 0) return null;
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function clipQueueItem(c: Clip): ClipQueueItem {
  const map = c.match_map?.map;
  return {
    id: c.id,
    title: c.title ?? null,
    playerName: c.target?.name ?? c.user?.name ?? null,
    teamName: null,
    durationMs: c.duration_ms ?? null,
    thumbnailUrl: c.thumbnail_download_url ?? null,
    posterUrl: c.match_map?.map?.poster ?? null,
    killsCount: c.kills_count ?? null,
    round: c.round ?? null,
    mapLabel: map?.label || (map?.name ? cleanMapName(map.name) : null),
  };
}
