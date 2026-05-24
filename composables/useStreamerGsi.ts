import {
  ref,
  computed,
  watch,
  onBeforeUnmount,
  shallowRef,
  type ComputedRef,
  type Ref,
} from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import type { ApolloClient, NormalizedCacheObject } from "@apollo/client/core";
import { generateMutation } from "~/graphql/graphqlGen";

// Live spec state pulled from the streamer pod's spec-server via the
// `getLiveStreamSpecState` Hasura action. Source of truth for player
// names, slot indices, and team grouping is GSI (cs2 itself), not the
// api's lineup data — that way the deck always matches what cs2 is
// actually rendering, even if the api lineup ordering disagrees.
//
// One poller per matchId. Both stream-deck/index.vue (per card) and
// stream-deck/[matchId].vue (focus window) consume this so the visual
// treatment — CT row / T row, alive state, active highlight — stays in
// lockstep. Multiple composable instances for the same match share a
// single poll timer and only assign refs when GSI data actually changes.
export type LiveSpecSlot = {
  slot: number;
  steam_id: string;
  name: string | null;
  team: "T" | "CT" | null;
  alive: boolean;
  health: number;
};

const EMPTY_SLOTS: LiveSpecSlot[] = [];

type SharedGsi = {
  matchId: string;
  refCount: number;
  wantsPollCount: number;
  pollTimer: ReturnType<typeof setInterval> | null;
  pollIntervalMs: number;
  specSlots: Ref<LiveSpecSlot[]>;
  spectatedSteamId: Ref<string | null>;
  teamCtName: Ref<string | null>;
  teamTName: Ref<string | null>;
  teamCtScore: Ref<number>;
  teamTScore: Ref<number>;
};

const sharedByMatch = new Map<string, SharedGsi>();

// Tab-visibility gate. The poll fans out to ~1Hz of `getLiveStreamSpecState`
// per active match — burning request budget on a backgrounded tab serves
// nobody. Register once per module load and broadcast visibility changes
// to all active shared pollers.
let tabVisible =
  typeof document === "undefined" ? true : !document.hidden;
let visibilityListenerInstalled = false;
function installVisibilityListener(
  apolloClient: ApolloClient<NormalizedCacheObject>,
) {
  if (visibilityListenerInstalled || typeof document === "undefined") return;
  visibilityListenerInstalled = true;
  document.addEventListener("visibilitychange", () => {
    const nowVisible = !document.hidden;
    if (nowVisible === tabVisible) return;
    tabVisible = nowVisible;
    for (const shared of sharedByMatch.values()) {
      if (shared.wantsPollCount <= 0) continue;
      if (tabVisible) maybeStartPoll(shared, apolloClient);
      else stopPollTimer(shared);
    }
  });
}

function stopPollTimer(shared: SharedGsi) {
  if (shared.pollTimer) {
    clearInterval(shared.pollTimer);
    shared.pollTimer = null;
  }
}

function slotsEqual(a: LiveSpecSlot[], b: LiveSpecSlot[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.slot !== y.slot ||
      x.steam_id !== y.steam_id ||
      x.name !== y.name ||
      x.team !== y.team ||
      x.alive !== y.alive ||
      x.health !== y.health
    ) {
      return false;
    }
  }
  return true;
}

function applyGsi(shared: SharedGsi, gsi: Record<string, unknown>) {
  if (Array.isArray(gsi.spec_slots)) {
    const next = gsi.spec_slots as LiveSpecSlot[];
    if (!slotsEqual(shared.specSlots.value, next)) {
      shared.specSlots.value = next;
    }
  }
  const nextSpectated =
    typeof gsi.spectated_steam_id === "string" ? gsi.spectated_steam_id : null;
  if (shared.spectatedSteamId.value !== nextSpectated) {
    shared.spectatedSteamId.value = nextSpectated;
  }
  if (
    typeof gsi.team_ct_name === "string" &&
    shared.teamCtName.value !== gsi.team_ct_name
  ) {
    shared.teamCtName.value = gsi.team_ct_name;
  }
  if (
    typeof gsi.team_t_name === "string" &&
    shared.teamTName.value !== gsi.team_t_name
  ) {
    shared.teamTName.value = gsi.team_t_name;
  }
  if (
    typeof gsi.team_ct_score === "number" &&
    shared.teamCtScore.value !== gsi.team_ct_score
  ) {
    shared.teamCtScore.value = gsi.team_ct_score;
  }
  if (
    typeof gsi.team_t_score === "number" &&
    shared.teamTScore.value !== gsi.team_t_score
  ) {
    shared.teamTScore.value = gsi.team_t_score;
  }
}

async function pollShared(
  shared: SharedGsi,
  apolloClient: ApolloClient<NormalizedCacheObject>,
) {
  if (shared.wantsPollCount <= 0) return;
  try {
    const { data } = await apolloClient.mutate({
      // Cast: action lives outside zeus until codegen runs, same
      // pattern as createClipRender / createClipFromPreset.
      mutation: generateMutation({
        getLiveStreamSpecState: [
          { match_id: shared.matchId },
          {
            gsi: {
              spectated_steam_id: true,
              team_ct_name: true,
              team_t_name: true,
              team_ct_score: true,
              team_t_score: true,
              spec_slots: {
                slot: true,
                steam_id: true,
                name: true,
                team: true,
                alive: true,
                health: true,
              },
            },
          },
        ],
      } as any),
      // Don't pollute the apollo cache — high-frequency poll, the
      // data is short-lived and never re-read.
      fetchPolicy: "no-cache",
    });
    const gsi = (data as any)?.getLiveStreamSpecState?.gsi;
    if (gsi) applyGsi(shared, gsi);
  } catch {
    // Pod transient: ignore. Next tick will retry.
  }
}

function maybeStartPoll(
  shared: SharedGsi,
  apolloClient: ApolloClient<NormalizedCacheObject>,
) {
  if (shared.wantsPollCount <= 0 || shared.pollTimer) return;
  if (!tabVisible) return;
  void pollShared(shared, apolloClient);
  shared.pollTimer = setInterval(
    () => void pollShared(shared, apolloClient),
    shared.pollIntervalMs,
  );
}

function maybeStopPoll(shared: SharedGsi) {
  if (shared.wantsPollCount > 0) return;
  stopPollTimer(shared);
}

function acquireShared(matchId: string, pollIntervalMs: number): SharedGsi {
  let shared = sharedByMatch.get(matchId);
  if (!shared) {
    shared = {
      matchId,
      refCount: 0,
      wantsPollCount: 0,
      pollTimer: null,
      pollIntervalMs,
      // shallowRef for the slot array: replaced atomically each tick,
      // deep reactivity on every nested player object is wasted work.
      specSlots: shallowRef<LiveSpecSlot[]>([]),
      spectatedSteamId: ref<string | null>(null),
      teamCtName: ref<string | null>(null),
      teamTName: ref<string | null>(null),
      teamCtScore: ref(0),
      teamTScore: ref(0),
    };
    sharedByMatch.set(matchId, shared);
  }
  shared.refCount++;
  return shared;
}

function releaseShared(matchId: string) {
  const shared = sharedByMatch.get(matchId);
  if (!shared) return;
  shared.refCount--;
  if (shared.refCount <= 0) {
    maybeStopPoll(shared);
    sharedByMatch.delete(matchId);
  }
}

export function useStreamerGsi(
  matchId: ComputedRef<string | null | undefined>,
  isLive: ComputedRef<boolean>,
  pollIntervalMs = 1000,
  enabled: ComputedRef<boolean> = computed(() => true),
) {
  const { client: apolloClient } = useApolloClient();
  installVisibilityListener(apolloClient);

  const activeShared = shallowRef<SharedGsi | null>(null);
  let wantsPoll = false;

  function detachShared() {
    const shared = activeShared.value;
    if (!shared) return;
    if (wantsPoll) {
      shared.wantsPollCount--;
      wantsPoll = false;
      maybeStopPoll(shared);
    }
    releaseShared(shared.matchId);
    activeShared.value = null;
  }

  function syncShared() {
    const id = matchId.value;
    const shouldPoll = !!(id && isLive.value && enabled.value);

    if (activeShared.value && activeShared.value.matchId !== id) {
      detachShared();
    }

    if (id && !activeShared.value) {
      activeShared.value = acquireShared(id, pollIntervalMs);
    }

    const shared = activeShared.value;
    if (!shared) return;

    if (shouldPoll && !wantsPoll) {
      shared.wantsPollCount++;
      wantsPoll = true;
      maybeStartPoll(shared, apolloClient);
    } else if (!shouldPoll && wantsPoll) {
      shared.wantsPollCount--;
      wantsPoll = false;
      maybeStopPoll(shared);
    }
  }

  watch([matchId, isLive, enabled], syncShared, { immediate: true });

  onBeforeUnmount(() => {
    detachShared();
  });

  const specSlots = computed(
    () => activeShared.value?.specSlots.value ?? EMPTY_SLOTS,
  );
  const spectatedSteamId = computed(
    () => activeShared.value?.spectatedSteamId.value ?? null,
  );
  const teamCtName = computed(
    () => activeShared.value?.teamCtName.value ?? null,
  );
  const teamTName = computed(
    () => activeShared.value?.teamTName.value ?? null,
  );
  const teamCtScore = computed(
    () => activeShared.value?.teamCtScore.value ?? 0,
  );
  const teamTScore = computed(
    () => activeShared.value?.teamTScore.value ?? 0,
  );

  // CT / T groupings come straight from GSI. cs2 maintains the
  // keybinds (spec_player_<N> ↔ observer_slot N), so click target and
  // label are sourced from the same place — no risk of drift.
  const ctSlots = computed(() =>
    specSlots.value
      .filter((s) => s.team === "CT")
      .slice()
      .sort((a, b) => a.slot - b.slot),
  );
  const tSlots = computed(() =>
    specSlots.value
      .filter((s) => s.team === "T")
      .slice()
      .sort((a, b) => a.slot - b.slot),
  );
  const hasGsi = computed(() => specSlots.value.length > 0);

  function slotIsActive(s: LiveSpecSlot): boolean {
    const sid = spectatedSteamId.value;
    if (!sid) return false;
    return s.steam_id === sid;
  }

  return {
    specSlots,
    spectatedSteamId,
    teamCtName,
    teamTName,
    teamCtScore,
    teamTScore,
    ctSlots,
    tSlots,
    hasGsi,
    slotIsActive,
  };
}
