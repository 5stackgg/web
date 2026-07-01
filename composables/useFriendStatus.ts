import { computed } from "vue";
import type { Component, MaybeRefOrGetter } from "vue";
import { toValue } from "vue";
import { Gamepad2, Swords, Users } from "lucide-vue-next";
import { isInCs2 } from "~/utilities/cs2Presence";

export type FriendStatusKey =
  | "offline"
  | "available"
  | "in_lobby"
  | "in_draft"
  | "in_match"
  // Playing CS2 outside 5stack (from Steam rich presence via the friend bot).
  | "in_cs2";

const DOT_CLASS: Record<FriendStatusKey, string> = {
  offline: "bg-muted-foreground/40",
  available: "bg-green-500",
  in_lobby: "bg-sky-500",
  in_draft: "bg-[hsl(var(--tac-amber))]",
  in_match: "bg-red-500",
  in_cs2: "bg-green-500",
};

const ICON: Partial<Record<FriendStatusKey, Component>> = {
  in_lobby: Users,
  in_draft: Swords,
  in_match: Gamepad2,
  // in_cs2 intentionally has no icon — rendered via <Cs2PresenceStatus>.
};

const LABEL_KEY: Record<FriendStatusKey, string> = {
  offline: "common.offline",
  available: "matchmaking.friends.available",
  in_lobby: "matchmaking.friends.in_lobby",
  in_draft: "matchmaking.friends.in_draft",
  in_match: "matchmaking.friends.in_match",
  in_cs2: "matchmaking.friends.playing_cs2",
};

export function useFriendStatus(
  player: MaybeRefOrGetter<any>,
  online: MaybeRefOrGetter<boolean>,
) {
  const inCs2 = computed(() => isInCs2(toValue(player)?.last_presence_state));

  const statusKey = computed<FriendStatusKey>(() => {
    const p = toValue(player)?.player;
    // A live 5stack match is our own data — it wins over Steam rich presence
    // regardless of whether they have 5stack web open.
    if (currentMatch.value) return "in_match";
    if (toValue(online)) {
      if (p?.is_in_draft) return "in_draft";
      if (p?.is_in_lobby) return "in_lobby";
    }
    if (inCs2.value) return "in_cs2";
    if (toValue(online)) return "available";
    return "offline";
  });

  const dotClass = computed(() => DOT_CLASS[statusKey.value]);
  const statusIcon = computed(() => ICON[statusKey.value] ?? null);
  const statusLabelKey = computed(() => LABEL_KEY[statusKey.value]);

  // A draft the current user can drop into: the subscription only returns
  // Open + Friends/Open-access drafts the friend is in, so presence here means
  // joinable — unless it's already at capacity.
  const joinableDraft = computed(() => {
    if (statusKey.value !== "in_draft") return null;
    const entry = toValue(player)?.player?.draft_game_players?.[0];
    const draft = entry?.draft_game;
    if (!draft) return null;
    const count = draft.players?.length ?? 0;
    return {
      id: draft.id as string,
      full: draft.capacity != null && count >= draft.capacity,
      requireApproval: !!draft.require_approval,
    };
  });

  // Friend's current live match, oriented to their lineup (their score first).
  const currentMatch = computed(() => {
    const entry = toValue(player)?.player?.player_lineup?.[0];
    const match = entry?.lineup?.match;
    if (!match) return null;

    const friendLineupId = String(entry.lineup?.id ?? "");
    const isLineup1 = friendLineupId === String(match.lineup_1_id ?? "");

    const maps = match.match_maps ?? [];
    const currentMap =
      maps.find((m: any) => m.is_current_map) ??
      maps.find((m: any) => !m.winning_lineup_id) ??
      maps[maps.length - 1] ??
      null;

    const mapsWonBy = (mine: boolean) =>
      maps.filter(
        (m: any) =>
          m.winning_lineup_id &&
          (String(m.winning_lineup_id) === friendLineupId) === mine,
      ).length;

    const bestOf = match.options?.best_of ?? 1;

    return {
      id: match.id as string,
      type: match.options?.type ?? null,
      startedAt: match.started_at ?? null,
      hasLiveStream: (match.streams?.length ?? 0) > 0,
      bestOf,
      isSeries: bestOf > 1,
      mapName: currentMap?.map?.label ?? currentMap?.map?.name ?? null,
      mapNumber: currentMap?.order ?? null,
      friendScore: currentMap
        ? (isLineup1 ? currentMap.lineup_1_score : currentMap.lineup_2_score) ??
          0
        : null,
      oppScore: currentMap
        ? (isLineup1 ? currentMap.lineup_2_score : currentMap.lineup_1_score) ??
          0
        : null,
      friendMapsWon: mapsWonBy(true),
      oppMapsWon: mapsWonBy(false),
    };
  });

  return {
    statusKey,
    dotClass,
    statusIcon,
    statusLabelKey,
    joinableDraft,
    currentMatch,
  };
}
