import { computed, ref } from "vue";
import { useNow } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { e_match_types_enum } from "~/generated/zeus";
import socket from "~/web-sockets/Socket";
import { toast } from "~/components/ui/toast";
import {
  EXPECTED_PLAYERS,
  canPartyQueue,
  playersInQueue as countPlayersInQueue,
} from "~/utilities/matchmakingPartySize";

// Queueing from anywhere, not just the Play page: the header's Play button
// queues the mode you played last, its arrow picks another, and the hub's
// party room shows the same line. The Play page still owns the full picker;
// this shares its rules (party size, enabled modes, preferred regions) so the
// two never disagree about what you can queue.

const LAST_TYPE_KEY = "matchmaking-last-type";

const QUEUEABLE_TYPES = [
  e_match_types_enum.Competitive,
  e_match_types_enum.Wingman,
  e_match_types_enum.Duel,
  e_match_types_enum.Rush,
];

function readLastType(): e_match_types_enum | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_TYPE_KEY) as e_match_types_enum;
  } catch {
    return null;
  }
}

const lastType = ref<e_match_types_enum | null>(readLastType());

export function rememberQueueType(type: e_match_types_enum) {
  lastType.value = type;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_TYPE_KEY, type);
  } catch {
    // Remembering the mode is a convenience; a blocked store just means the
    // button falls back to the first mode the party can play.
  }
}

export type QuickQueueMode = {
  type: e_match_types_enum;
  canQueue: boolean;
  expected: number;
  inQueue: number;
};

export function useQuickQueue() {
  const { t, te } = useI18n();
  const matchmakingStore = useMatchmakingStore();

  // Only accepted lobby members queue -- pending invites don't count, which is
  // how the api sizes the lobby too.
  const partySize = computed(() => {
    const lobby = matchmakingStore.currentLobby as any;
    const accepted = lobby?.players?.filter(
      (player: { status: string }) => player.status === "Accepted",
    );
    return accepted?.length || 1;
  });

  const regions = computed(() =>
    (matchmakingStore.preferredRegions as Array<{ value: string }>).map(
      (region) => region.value,
    ),
  );

  const modes = computed<QuickQueueMode[]>(() =>
    QUEUEABLE_TYPES.filter((type) =>
      useApplicationSettingsStore().isMatchmakingTypeEnabled(
        type.toLowerCase(),
      ),
    ).map((type) => ({
      type,
      canQueue: canPartyQueue(type, partySize.value),
      expected: EXPECTED_PLAYERS[type] ?? 0,
      inQueue: countPlayersInQueue(
        matchmakingStore.regionStats,
        type,
        regions.value,
      ),
    })),
  );

  // The mode the Play button queues with one click: the last one played if the
  // party can still play it, otherwise the first one it can.
  const quickMode = computed(
    () =>
      modes.value.find(
        (mode) => mode.type === lastType.value && mode.canQueue,
      ) ??
      modes.value.find((mode) => mode.canQueue) ??
      null,
  );

  const queue = computed(
    () =>
      (matchmakingStore.joinedMatchmakingQueues as any)?.details as
        | { type: e_match_types_enum; regions?: string[]; joinedAt?: string }
        | undefined,
  );

  // How long the search has been running, as m:ss. Only reads the clock while
  // a search is on, so an idle header never re-renders on the tick.
  const now = useNow({ interval: 1000 });
  const clock = computed(() => {
    const joinedAt = queue.value?.joinedAt;
    if (!joinedAt) return null;
    const seconds = Math.max(
      0,
      Math.floor((now.value.getTime() - new Date(joinedAt).getTime()) / 1000),
    );
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  });

  function modeTitle(type: string) {
    const key = `matchmaking.match_types.${type.toLowerCase()}.title`;
    return te(key) ? t(key) : type;
  }

  function join(type: e_match_types_enum) {
    const mode = modes.value.find((candidate) => candidate.type === type);
    if (!mode?.canQueue) {
      toast({
        title: t("matchmaking.party_size.requirement", {
          half: (mode?.expected ?? 0) / 2,
          full: mode?.expected ?? 0,
        }),
        variant: "destructive",
      });
      return;
    }
    if (regions.value.length === 0) {
      toast({
        title: t("matchmaking.no_preferred_regions"),
        variant: "destructive",
      });
      return;
    }
    rememberQueueType(type);
    socket.event("matchmaking:join-queue", { type, regions: regions.value });
  }

  function leave() {
    socket.event("matchmaking:leave");
  }

  return {
    partySize,
    regions,
    modes,
    quickMode,
    queue,
    clock,
    modeTitle,
    join,
    leave,
  };
}
