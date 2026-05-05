import { ref, computed, watch, onBeforeUnmount, type ComputedRef } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
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
// lockstep.
export type LiveSpecSlot = {
  slot: number;
  steam_id: string;
  name: string | null;
  team: "T" | "CT" | null;
  alive: boolean;
  health: number;
};

export function useStreamerGsi(
  matchId: ComputedRef<string | null | undefined>,
  isLive: ComputedRef<boolean>,
  pollIntervalMs = 1000,
) {
  const { client: apolloClient } = useApolloClient();

  const specSlots = ref<LiveSpecSlot[]>([]);
  const spectatedSteamId = ref<string | null>(null);
  const teamCtName = ref<string | null>(null);
  const teamTName = ref<string | null>(null);
  const teamCtScore = ref<number>(0);
  const teamTScore = ref<number>(0);

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  async function poll() {
    const id = matchId.value;
    if (!id || !isLive.value) return;
    try {
      const { data } = await apolloClient.mutate({
        // Cast: action lives outside zeus until codegen runs, same
        // pattern as createClipRender / createClipFromPreset.
        mutation: generateMutation({
          getLiveStreamSpecState: [
            { match_id: id },
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
      if (!gsi) return;
      if (Array.isArray(gsi.spec_slots)) specSlots.value = gsi.spec_slots;
      spectatedSteamId.value = gsi.spectated_steam_id ?? null;
      if (typeof gsi.team_ct_name === "string")
        teamCtName.value = gsi.team_ct_name;
      if (typeof gsi.team_t_name === "string")
        teamTName.value = gsi.team_t_name;
      if (typeof gsi.team_ct_score === "number")
        teamCtScore.value = gsi.team_ct_score;
      if (typeof gsi.team_t_score === "number")
        teamTScore.value = gsi.team_t_score;
    } catch {
      // Pod transient: ignore. Next tick will retry.
    }
  }

  function start() {
    stop();
    void poll();
    pollTimer = setInterval(poll, pollIntervalMs);
  }
  function stop() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // React to live + matchId transitions — start polling when the
  // stream goes live, stop when it drops, so we don't hammer a dead
  // pod with state requests while the operator's still on the page.
  watch(
    [isLive, matchId],
    ([live, id]) => {
      if (live && id) start();
      else stop();
    },
    { immediate: true },
  );

  onBeforeUnmount(() => stop());

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
    if (!spectatedSteamId.value) return false;
    return s.steam_id === spectatedSteamId.value;
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
