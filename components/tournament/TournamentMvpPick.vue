<script setup lang="ts">
import { computed, inject, ref, watch } from "vue";
import gql from "graphql-tag";
import { useApolloClient } from "@vue/apollo-composable";
import { Check, Crown, History, Repeat } from "lucide-vue-next";
import ManageSection from "~/components/common/ManageSection.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { HeightSwap } from "~/components/ui/transitions";
import { schemaHasField } from "~/utilities/schemaHasType";
import { dateLocale } from "~/utilities/dateLocale";

type Candidate = {
  player_steam_id: string;
  name: string;
  avatar_url: string | null;
  tournament_team_id: string;
  rank: number;
  avg_impact: number;
  matches: number;
  kdr: number;
  adr: number;
  headshot_percentage: number;
};

type PickRow = {
  id: string;
  player_steam_id: string;
  note: string | null;
  replaced_steam_id: string | null;
  created_at: string;
  player: { steam_id: string; name: string } | null;
  picked_by: { steam_id: string; name: string } | null;
  replaced_player: { steam_id: string; name: string } | null;
};

type PickState = {
  can_pick_mvp: boolean;
  organizer_picks_mvp: boolean;
  finished_at: string | null;
  mvp_picks: PickRow[];
};

// Raw gql: the switch, the history and both actions ship with the api ahead
// of the generated types.
const PICK_STATE = gql`
  query TournamentMvpPickState($id: uuid!) {
    tournaments_by_pk(id: $id) {
      id
      can_pick_mvp
      organizer_picks_mvp
      finished_at
      mvp_picks(order_by: [{ created_at: desc }, { id: desc }]) {
        id
        player_steam_id
        note
        replaced_steam_id
        created_at
        player {
          steam_id
          name
        }
        picked_by {
          steam_id
          name
        }
        replaced_player {
          steam_id
          name
        }
      }
    }
  }
`;

const CANDIDATES = gql`
  query TournamentMvpCandidates($id: uuid!) {
    tournamentMvpCandidates(tournament_id: $id) {
      player_steam_id
      name
      avatar_url
      tournament_team_id
      rank
      avg_impact
      matches
      kdr
      adr
      headshot_percentage
    }
  }
`;

const SET_SWITCH = gql`
  mutation SetTournamentOrganizerPicksMvp($id: uuid!, $value: Boolean!) {
    update_tournaments_by_pk(
      pk_columns: { id: $id }
      _set: { organizer_picks_mvp: $value }
    ) {
      id
      organizer_picks_mvp
    }
  }
`;

const SET_MVP = gql`
  mutation SetTournamentMvp($id: uuid!, $steamId: String!, $note: String) {
    setTournamentMvp(
      tournament_id: $id
      player_steam_id: $steamId
      note: $note
    ) {
      success
    }
  }
`;

const props = defineProps<{ tournament: Record<string, any> }>();

const refetchTournamentStatic = inject<() => unknown>(
  "refetchTournamentStatic",
  () => {},
);

const { client } = useApolloClient();
const auth = useAuthStore();

const supported = ref(false);
const state = ref<PickState | null>(null);
const candidates = ref<Candidate[]>([]);
const savingSwitch = ref(false);

const dialogOpen = ref(false);
const step = ref<"choose" | "confirm">("choose");
const selected = ref<string | null>(null);
const note = ref("");

const finished = computed(() => props.tournament?.status === "Finished");
const awardsOn = computed(() => props.tournament?.awards_enabled !== false);
const canPick = computed(() => !!state.value?.can_pick_mvp);
const organizerPicks = computed(() => !!state.value?.organizer_picks_mvp);

const mvp = computed(
  () =>
    ((props.tournament?.awards || []) as any[]).find(
      (grant) => grant.placement === 0,
    ) || null,
);

const mvpPicked = computed(
  () =>
    !!mvp.value &&
    (mvp.value.source === "manual" || !!mvp.value.awarded_by_steam_id),
);

const ranked = computed(() =>
  [...candidates.value].sort((a, b) => a.rank - b.rank),
);

const suggestedSteamId = computed(
  () => ranked.value.find((c) => c.rank === 1)?.player_steam_id ?? null,
);

const rosterPlayers = computed(() => {
  const players = new Map<string, any>();
  for (const team of (props.tournament?.teams || []) as any[]) {
    for (const row of team.roster || []) {
      if (row.player?.steam_id) {
        players.set(String(row.player.steam_id), row.player);
      }
    }
  }
  return players;
});

function playerFor(candidate: Candidate) {
  return (
    rosterPlayers.value.get(String(candidate.player_steam_id)) ?? {
      steam_id: candidate.player_steam_id,
      name: candidate.name,
      avatar_url: candidate.avatar_url,
    }
  );
}

function candidateFor(steamId?: string | null) {
  if (!steamId) {
    return null;
  }
  return (
    candidates.value.find(
      (c) => String(c.player_steam_id) === String(steamId),
    ) ?? null
  );
}

function teamName(tournamentTeamId?: string | null) {
  const team = ((props.tournament?.teams || []) as any[]).find(
    (entry) => entry.id === tournamentTeamId,
  );
  return team?.team?.name || team?.name || "";
}

const winnerName = computed(() =>
  teamName(
    ranked.value[0]?.tournament_team_id ?? mvp.value?.tournament_team_id,
  ),
);

const mvpStats = computed(() => candidateFor(mvp.value?.player_steam_id));

const selectedCandidate = computed(() => candidateFor(selected.value));

function isSelf(steamId?: string | null) {
  return (
    !auth.isAdmin &&
    !!auth.me?.steam_id &&
    String(auth.me.steam_id) === String(steamId)
  );
}

function isSelected(candidate: Candidate) {
  return String(selected.value) === String(candidate.player_steam_id);
}

function choose(candidate: Candidate) {
  if (isSelf(candidate.player_steam_id)) {
    return;
  }
  selected.value = String(candidate.player_steam_id);
}

const unchanged = computed(
  () =>
    mvpPicked.value &&
    String(selected.value) === String(mvp.value?.player_steam_id) &&
    note.value.trim() === (mvp.value?.note || ""),
);

const history = computed(() => {
  const picks = state.value?.mvp_picks ?? [];
  const rows = picks.map((pick, index) => ({
    key: pick.id,
    name: pick.player?.name ?? pick.player_steam_id,
    by: pick.picked_by?.name ?? null,
    at: pick.created_at,
    current:
      index === 0 &&
      !!mvp.value?.awarded_by_steam_id &&
      String(mvp.value?.player_steam_id) === String(pick.player_steam_id),
    automatic: false,
  }));

  const first = picks[picks.length - 1];
  if (first?.replaced_steam_id) {
    rows.push({
      key: "automatic",
      name: first.replaced_player?.name ?? first.replaced_steam_id,
      by: null,
      at: state.value?.finished_at ?? null,
      current: false,
      automatic: true,
    });
  }

  return rows;
});

function formatImpact(value?: number | null) {
  return Number(value ?? 0).toFixed(2);
}

function formatWhen(value?: string | null) {
  if (!value) {
    return "";
  }
  return new Date(value).toLocaleString(dateLocale(), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadCandidates() {
  try {
    const { data } = await client.query({
      query: CANDIDATES,
      variables: { id: props.tournament.id },
      fetchPolicy: "network-only",
    });
    candidates.value = (data as any)?.tournamentMvpCandidates ?? [];
  } catch (error) {
    console.error("[tournament-mvp] candidates query error", error);
  }
}

async function load() {
  const id = props.tournament?.id;
  if (!id || typeof window === "undefined") {
    return;
  }

  const [hasSwitch, hasHistory] = await Promise.all([
    schemaHasField(client, "tournaments", "can_pick_mvp"),
    schemaHasField(client, "tournaments", "mvp_picks"),
  ]);
  supported.value = hasSwitch && hasHistory;
  if (!supported.value) {
    return;
  }

  try {
    const { data } = await client.query({
      query: PICK_STATE,
      variables: { id },
      fetchPolicy: "network-only",
    });
    if (props.tournament?.id === id) {
      state.value = (data as any)?.tournaments_by_pk ?? null;
    }
  } catch (error) {
    console.error("[tournament-mvp] state query error", error);
    return;
  }

  if (canPick.value && finished.value && awardsOn.value) {
    await loadCandidates();
  }
}

watch(
  () => [
    props.tournament?.id,
    props.tournament?.status,
    props.tournament?.awards_enabled,
  ],
  load,
  { immediate: true },
);

async function toggleSwitch(next: boolean) {
  savingSwitch.value = true;
  try {
    await client.mutate({
      mutation: SET_SWITCH,
      variables: { id: props.tournament.id, value: next },
    });
    if (state.value) {
      state.value = { ...state.value, organizer_picks_mvp: next };
    }
    if (!next && finished.value) {
      await refetchTournamentStatic();
    }
  } catch (error) {
    console.error("[tournament-mvp] switch error", error);
  } finally {
    savingSwitch.value = false;
  }
}

async function openPicker() {
  selected.value =
    mvp.value?.player_steam_id != null
      ? String(mvp.value.player_steam_id)
      : suggestedSteamId.value;
  note.value = mvpPicked.value ? mvp.value?.note || "" : "";
  step.value = "choose";
  dialogOpen.value = true;
  if (candidates.value.length === 0) {
    await loadCandidates();
    selected.value ??= suggestedSteamId.value;
  }
}

async function confirmPick() {
  if (!selected.value) {
    return;
  }
  try {
    await client.mutate({
      mutation: SET_MVP,
      variables: {
        id: props.tournament.id,
        steamId: String(selected.value),
        note: note.value.trim() || null,
      },
    });
    await Promise.all([load(), refetchTournamentStatic()]);
    dialogOpen.value = false;
  } catch (error) {
    console.error("[tournament-mvp] pick error", error);
  }
}

const confirmReplaces = computed(() => {
  const current = mvp.value;
  if (!current?.player_steam_id || !selectedCandidate.value) {
    return null;
  }
  const name = current.player?.name ?? current.player_steam_id;
  if (String(current.player_steam_id) === String(selected.value)) {
    return { key: "tournament.mvp_pick.confirm_keeps", name };
  }
  return {
    key: mvpPicked.value
      ? "tournament.mvp_pick.confirm_replaces_pick"
      : "tournament.mvp_pick.confirm_replaces_automatic",
    name,
  };
});
</script>

<template>
  <ManageSection
    v-if="supported"
    :label="$t('tournament.mvp_pick.title')"
    :hint="
      organizerPicks
        ? $t('tournament.mvp_pick.hint_organizer')
        : $t('tournament.mvp_pick.hint_automatic')
    "
  >
    <div
      v-if="!canPick"
      class="rounded-sm border border-dashed border-border px-4 py-6 text-center font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground"
    >
      {{ $t("tournament.awards_config.organizer_access_required") }}
    </div>

    <div
      v-else-if="!awardsOn"
      class="rounded-sm border border-dashed border-border bg-background/30 px-4 py-6 text-center font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground"
    >
      {{ $t("tournament.mvp_pick.awards_off") }}
    </div>

    <div v-else class="grid gap-4">
      <HeightSwap>
        <div
          v-if="!finished"
          key="waiting"
          class="rounded-sm border border-dashed border-border bg-background/30 px-4 py-6 text-center font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground"
        >
          {{ $t("tournament.mvp_pick.not_finished") }}
        </div>

        <div
          v-else-if="mvp"
          :key="`mvp-${mvp.player_steam_id}-${mvpPicked}`"
          class="flex flex-wrap items-center gap-3 rounded-md border border-border/70 bg-background/30 p-3"
        >
          <PlayerDisplay
            v-if="mvp.player"
            :player="mvp.player"
            :show-name="false"
            :show-flag="false"
            :show-role="false"
            :show-elo="false"
            :linkable="false"
            :show-online="false"
            :tooltip="false"
            :context-menu="false"
            size="sm"
          />
          <div class="grid min-w-0 flex-1 gap-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="truncate text-sm font-semibold">
                {{ mvp.player?.name ?? mvp.player_steam_id }}
              </span>
              <span
                v-if="mvpPicked"
                class="rounded-sm border border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.12)] px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]"
              >
                {{ $t("tournament.mvp_pick.picked_by_organizers") }}
              </span>
              <span
                v-else
                class="rounded-sm border border-border bg-muted/30 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground"
              >
                {{ $t("tournament.mvp_pick.suggested") }}
              </span>
            </div>
            <span
              v-if="mvpPicked && mvp.note"
              class="text-xs italic text-muted-foreground"
            >
              “{{ mvp.note }}”
            </span>
            <span
              v-else
              class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
            >
              ↳ {{ teamName(mvp.tournament_team_id) }}
              <template v-if="mvpStats">
                ·
                {{
                  $t("tournament.mvp_pick.impact_value", {
                    value: formatImpact(mvpStats.avg_impact),
                  })
                }}
                ·
                {{ $t("tournament.mvp_pick.matches_count", mvpStats.matches) }}
              </template>
            </span>
          </div>
          <Button
            v-if="mvp.source !== 'manual'"
            size="sm"
            variant="outline"
            class="gap-1.5 [&_svg]:size-3.5"
            @click="openPicker"
          >
            <Repeat />
            {{ $t("tournament.mvp_pick.change") }}
          </Button>
        </div>

        <div
          v-else
          key="empty"
          class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border px-3 py-3"
        >
          <span class="text-sm text-muted-foreground">
            {{ $t("tournament.mvp_pick.none_yet") }}
          </span>
          <Button
            size="sm"
            class="gap-1.5 bg-[hsl(var(--tac-amber))] font-bold text-black hover:bg-[hsl(var(--tac-amber)/0.85)] [&_svg]:size-3.5"
            :disabled="ranked.length === 0"
            @click="openPicker"
          >
            <Crown />
            {{ $t("tournament.mvp_pick.pick") }}
          </Button>
        </div>
      </HeightSwap>

      <label
        class="flex cursor-pointer items-center justify-between gap-4 rounded-md border border-border/70 px-3 py-2.5"
      >
        <span class="grid gap-0.5">
          <span class="text-sm font-medium">
            {{ $t("tournament.mvp_pick.switch_label") }}
          </span>
          <span class="text-xs text-muted-foreground">
            {{ $t("tournament.mvp_pick.switch_hint") }}
          </span>
        </span>
        <Switch
          :model-value="organizerPicks"
          :disabled="savingSwitch"
          @update:model-value="toggleSwitch"
        />
      </label>

      <div v-if="finished && history.length" class="grid gap-1">
        <span
          class="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground"
        >
          {{ $t("tournament.mvp_pick.history") }}
        </span>
        <TransitionGroup
          tag="ul"
          name="pick"
          class="relative flex flex-col divide-y divide-border/60 text-sm"
        >
          <li
            v-for="row in history"
            :key="row.key"
            class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
            :class="{ 'text-muted-foreground': !row.current }"
          >
            <Check
              v-if="row.current"
              class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
              aria-hidden="true"
            />
            <History v-else class="h-3.5 w-3.5" aria-hidden="true" />
            <span
              class="font-semibold"
              :class="{
                'line-through decoration-muted-foreground/60': !row.current,
              }"
            >
              {{ row.name }}
            </span>
            <span class="text-xs text-muted-foreground">
              {{
                row.automatic
                  ? $t("tournament.mvp_pick.history_automatic")
                  : $t("tournament.mvp_pick.history_picked_by", {
                      name: row.by ?? "—",
                    })
              }}
            </span>
            <span
              class="ml-auto font-mono text-[0.65rem] tabular-nums text-muted-foreground"
            >
              {{ formatWhen(row.at) }}
            </span>
          </li>
        </TransitionGroup>
      </div>
    </div>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="sm:max-w-2xl">
        <HeightSwap>
          <div v-if="step === 'choose'" key="choose" class="grid gap-4">
            <DialogHeader>
              <DialogTitle>
                {{
                  mvp
                    ? $t("tournament.mvp_pick.dialog_title_change")
                    : $t("tournament.mvp_pick.dialog_title_pick")
                }}
              </DialogTitle>
              <DialogDescription>
                {{
                  winnerName
                    ? $t("tournament.mvp_pick.dialog_description", {
                        team: winnerName,
                      })
                    : $t("tournament.mvp_pick.dialog_description_fallback")
                }}
              </DialogDescription>
            </DialogHeader>

            <div
              v-if="ranked.length === 0"
              class="rounded-sm border border-dashed border-border px-4 py-6 text-center font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground"
            >
              {{ $t("tournament.mvp_pick.no_candidates") }}
            </div>

            <div v-else class="overflow-x-auto">
              <div
                class="grid min-w-[28rem] gap-1.5"
                role="radiogroup"
                :aria-label="$t('tournament.mvp_pick.dialog_title_pick')"
              >
                <div
                  class="grid grid-cols-[1rem_minmax(0,1fr)_repeat(5,3.25rem)] items-center gap-2 px-2.5 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground"
                >
                  <span></span>
                  <span>{{ $t("tournament.mvp_pick.column_player") }}</span>
                  <span class="text-right">
                    {{ $t("tournament.mvp_pick.column_impact") }}
                  </span>
                  <span class="text-right">
                    {{ $t("tournament.mvp_pick.column_matches") }}
                  </span>
                  <span class="text-right">K/D</span>
                  <span class="text-right">ADR</span>
                  <span class="text-right">HS%</span>
                </div>
                <FiveStackToolTip
                  v-for="candidate in ranked"
                  :key="candidate.player_steam_id"
                  as-child
                  :disabled="!isSelf(candidate.player_steam_id)"
                  :delay-duration="120"
                >
                  <template #trigger>
                    <button
                      type="button"
                      role="radio"
                      :aria-checked="isSelected(candidate)"
                      :aria-disabled="isSelf(candidate.player_steam_id)"
                      :data-steam-id="candidate.player_steam_id"
                      class="grid grid-cols-[1rem_minmax(0,1fr)_repeat(5,3.25rem)] items-center gap-2 rounded-md border px-2.5 py-2 text-left text-[0.8125rem] transition-colors duration-150 motion-reduce:transition-none"
                      :class="[
                        isSelected(candidate)
                          ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.08)]'
                          : 'border-border/70',
                        isSelf(candidate.player_steam_id)
                          ? 'cursor-not-allowed opacity-50'
                          : 'hover:bg-muted/30',
                      ]"
                      @click="choose(candidate)"
                    >
                      <span
                        class="grid h-4 w-4 place-items-center rounded-full border transition-colors duration-150 motion-reduce:transition-none"
                        :class="
                          isSelected(candidate)
                            ? 'border-[hsl(var(--tac-amber))]'
                            : 'border-border'
                        "
                      >
                        <span
                          class="h-2 w-2 rounded-full bg-[hsl(var(--tac-amber))] transition-transform duration-150 motion-reduce:transition-none"
                          :class="
                            isSelected(candidate) ? 'scale-100' : 'scale-0'
                          "
                        ></span>
                      </span>
                      <span class="flex min-w-0 items-center gap-2">
                        <PlayerDisplay
                          :player="playerFor(candidate)"
                          :show-name="false"
                          :show-flag="false"
                          :show-role="false"
                          :show-elo="false"
                          :linkable="false"
                          :show-online="false"
                          :tooltip="false"
                          :context-menu="false"
                          size="xs"
                        />
                        <span class="grid min-w-0 leading-tight">
                          <span class="truncate font-semibold">
                            {{ candidate.name }}
                          </span>
                          <span
                            v-if="candidate.rank === 1"
                            class="truncate font-mono text-[0.5rem] uppercase tracking-[0.16em] text-muted-foreground"
                          >
                            {{ $t("tournament.mvp_pick.suggested") }}
                          </span>
                        </span>
                      </span>
                      <span
                        v-for="(value, index) in [
                          formatImpact(candidate.avg_impact),
                          candidate.matches,
                          Number(candidate.kdr ?? 0).toFixed(2),
                          Math.round(Number(candidate.adr ?? 0)),
                          `${Math.round(Number(candidate.headshot_percentage ?? 0))}%`,
                        ]"
                        :key="index"
                        class="text-right font-mono text-xs tabular-nums text-muted-foreground"
                      >
                        {{ value }}
                      </span>
                    </button>
                  </template>
                  {{ $t("tournament.mvp_pick.self_disabled") }}
                </FiveStackToolTip>
              </div>
            </div>

            <label class="grid gap-1.5">
              <span
                class="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground"
              >
                {{ $t("tournament.mvp_pick.note_label") }}
              </span>
              <Input v-model="note" maxlength="140" />
            </label>

            <DialogFooter>
              <Button variant="outline" @click="dialogOpen = false">
                {{ $t("common.cancel") }}
              </Button>
              <Button
                :disabled="
                  !selectedCandidate || unchanged || isSelf(selected)
                "
                @click="step = 'confirm'"
              >
                {{ $t("tournament.mvp_pick.continue") }}
              </Button>
            </DialogFooter>
          </div>

          <div v-else key="confirm" class="grid gap-4">
            <DialogHeader>
              <DialogTitle>
                {{
                  $t("tournament.mvp_pick.confirm_title", {
                    name: selectedCandidate?.name,
                  })
                }}
              </DialogTitle>
              <DialogDescription>
                <template v-if="confirmReplaces">
                  {{ $t(confirmReplaces.key, { name: confirmReplaces.name }) }}
                </template>
                <template
                  v-if="
                    String(selected) !== String(mvp?.player_steam_id ?? '')
                  "
                >
                  {{
                    $t("tournament.mvp_pick.confirm_gets", {
                      name: selectedCandidate?.name,
                    })
                  }}
                </template>
              </DialogDescription>
            </DialogHeader>

            <p
              v-if="note.trim()"
              class="border-l-2 border-[hsl(var(--tac-amber)/0.6)] pl-3 text-sm italic text-muted-foreground"
            >
              “{{ note.trim() }}”
            </p>

            <DialogFooter>
              <Button variant="outline" @click="step = 'choose'">
                {{ $t("common.back") }}
              </Button>
              <Button @click="confirmPick">
                {{ $t("tournament.mvp_pick.confirm") }}
              </Button>
            </DialogFooter>
          </div>
        </HeightSwap>
      </DialogContent>
    </Dialog>
  </ManageSection>
</template>

<style scoped>
.pick-move,
.pick-enter-active,
.pick-leave-active {
  transition:
    transform 260ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 200ms ease;
}

.pick-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

.pick-leave-to {
  opacity: 0;
}

.pick-leave-active {
  position: absolute;
  width: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .pick-move,
  .pick-enter-active,
  .pick-leave-active {
    transition: none;
  }
}
</style>
