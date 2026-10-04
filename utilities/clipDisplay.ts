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

// A row's `round` is only the round its first segment starts in, so it doesn't
// mean the clip stays inside that round. The API's auto-titles do say:
// "Best Round (4K)" is that round's own count, and the "+ 1 Knife Kill" tail
// on auto highlights is a knife kill from another round, which older rows
// still count in kills_count -- a 4K plus a knife kill isn't an ace.
const BEST_ROUND_TITLE = /\bBest Round \((\d+)K\)/i;
// Reels cut from more than one round (or not provably one): multi-kills from
// several rounds, several knife kills, a recap of several cuts.
const MULTI_ROUND_TITLE =
  /\bMulti-Kills \((?!1× \d+K\))|\d Knife Kills\b|\bMatch Recap \([^)]*clips\)/i;

// Kills the clip shows inside one round, or null when it isn't one round.
export function clipRoundKills(
  clip: Pick<Clip, "kills_count" | "round"> & { title?: string | null },
): number | null {
  const kills = clip.kills_count ?? 0;
  if (clip.round == null || kills <= 0) return null;
  const title = clip.title ?? "";
  const bestRound = title.match(BEST_ROUND_TITLE);
  if (bestRound) return Math.min(kills, Number(bestRound[1]));
  if (MULTI_ROUND_TITLE.test(title)) return null;
  return kills;
}

export function clipKillTier(
  clip: Pick<Clip, "kills_count" | "round"> & { title?: string | null },
  t: Translate,
): ClipKillTier | null {
  const kills = clip.kills_count ?? 0;
  if (kills <= 0) return null;
  const roundKills = clipRoundKills(clip);
  if (roundKills != null && roundKills <= 5) {
    let label: string;
    if (roundKills === 5) label = t("clips.tile.kills.ace");
    else if (roundKills === 1) label = t("clips.tile.kills.one");
    else label = t("clips.tile.kills.multi", { n: roundKills });
    return { marks: true, filled: roundKills, label };
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
