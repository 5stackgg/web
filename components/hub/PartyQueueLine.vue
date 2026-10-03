<script setup lang="ts">
import { computed } from "vue";
import { ChevronDown, Check, Globe, Lock, Play, Swords } from "lucide-vue-next";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import { useQuickQueue } from "~/composables/useQuickQueue";
import { useMatchReadyModal } from "~/composables/useMatchReadyModal";

// The queue, as one line between the seats and the chat. It changes with the
// party: pick-and-queue for the leader, read-only for everyone else, the clock
// while searching, check-in when a match is found, the match once it starts.
const props = defineProps<{ lobby: any }>();

const { modes, quickMode, queue, clock, modeTitle, join, leave, partySize } =
  useQuickQueue();
const matchmakingStore = useMatchmakingStore();
const { openMatchReadyModal } = useMatchReadyModal();

const me = computed(() => useAuthStore().me);
const leader = computed(
  () =>
    (props.lobby?.players ?? []).find(
      (slot: any) => slot.captain,
    ) as any,
);
const isLeader = computed(
  () => String(leader.value?.player?.steam_id) === String(me.value?.steam_id),
);

const regionLabels = computed(() =>
  (matchmakingStore.preferredRegions as Array<{ description?: string; value: string }>).map(
    (region) => region.description || region.value,
  ),
);
const regionSummary = computed(() => {
  const [first, ...rest] = regionLabels.value;
  if (!first) return null;
  return rest.length ? `${first} +${rest.length}` : first;
});

const confirmation = computed(() => {
  const pending = (matchmakingStore.joinedMatchmakingQueues as any)
    ?.confirmation;
  return pending && !pending.matchId ? pending : null;
});

const liveMatch = computed(
  () => (useMatchLobbyStore().myMatches as any[])?.[0] ?? null,
);
const liveMatchLabel = computed(() => {
  const match = liveMatch.value;
  if (!match) return "";
  return (
    match.label ||
    `${match.lineup_1?.name ?? "TBD"} vs ${match.lineup_2?.name ?? "TBD"}`
  );
});

const rowClass =
  "flex min-h-[3.25rem] items-center gap-2.5 border-b border-border px-3 py-2";
</script>

<template>
  <!-- In a match: the match, one click away. -->
  <NuxtLink
    v-if="liveMatch"
    :to="{ name: 'matches-id', params: { id: liveMatch.id } }"
    :class="[rowClass, 'transition-colors hover:bg-white/[0.03]']"
  >
    <span
      class="grid size-8 shrink-0 place-items-center rounded-md border border-red-500/30 bg-red-500/10 text-red-300"
    >
      <Swords class="size-3.5" />
    </span>
    <div class="min-w-0 flex-1">
      <div class="truncate text-xs font-medium text-foreground">
        {{ liveMatchLabel }}
      </div>
      <div class="text-[0.7rem] text-muted-foreground">
        {{
          liveMatch.status === "WaitingForCheckIn"
            ? $t("match.check_in.check_in")
            : liveMatch.e_match_status?.description || liveMatch.status
        }}
      </div>
    </div>
    <span class="text-xs font-medium text-[hsl(var(--tac-amber))]">
      {{ $t("layouts.party_room.open_match") }}
    </span>
  </NuxtLink>

  <!-- A match was found: check in from here or from the header. -->
  <div
    v-else-if="confirmation"
    :class="[rowClass, 'bg-[hsl(var(--tac-amber)/0.07)]']"
  >
    <div class="min-w-0 flex-1">
      <div class="text-xs font-semibold text-[hsl(var(--tac-amber))]">
        {{ $t("matchmaking.match_found") }}
      </div>
      <div class="text-[0.7rem] text-muted-foreground tabular-nums">
        {{
          $t("layouts.party_room.ready_count", {
            confirmed: confirmation.confirmed ?? 0,
            players: confirmation.players ?? 0,
          })
        }}
      </div>
    </div>
    <button
      type="button"
      class="tac-amber-cta inline-flex h-8 items-center rounded-md border px-3 text-xs font-semibold"
      @click="openMatchReadyModal()"
    >
      {{ $t("matchmaking.check_in") }}
    </button>
  </div>

  <!-- Searching: the clock, where, how busy, and the way out. -->
  <div
    v-else-if="queue"
    :class="[rowClass, 'bg-[hsl(var(--tac-amber)/0.05)]']"
  >
    <span class="relative flex size-2 shrink-0" aria-hidden="true">
      <span
        class="absolute inline-flex size-full animate-ping rounded-full bg-[hsl(var(--tac-amber))] opacity-75"
      />
      <span
        class="relative inline-flex size-2 rounded-full bg-[hsl(var(--tac-amber))]"
      />
    </span>
    <div class="min-w-0 flex-1">
      <div class="text-xs text-foreground">
        {{ $t("layouts.party_room.searching", { mode: modeTitle(queue.type) }) }}
        <span
          v-if="clock"
          class="font-semibold tabular-nums text-[hsl(var(--tac-amber))]"
        >
          {{ clock }}
        </span>
      </div>
      <div class="truncate text-[0.7rem] text-muted-foreground">
        <template v-if="regionSummary">{{ regionLabels.join(", ") }} · </template>
        {{
          $t("layouts.queue.in_queue", {
            count:
              modes.find((mode) => mode.type === queue?.type)?.inQueue ?? 0,
          })
        }}
      </div>
    </div>
    <button
      v-if="isLeader"
      type="button"
      class="inline-flex h-7 items-center rounded-md border border-border bg-zinc-900 px-2.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
      @click="leave"
    >
      {{ $t("layouts.party_room.cancel") }}
    </button>
  </div>

  <!-- Idle, leader: pick a mode and queue. -->
  <div v-else-if="isLeader && quickMode" :class="rowClass">
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <button
          type="button"
          class="inline-flex h-8 min-w-0 flex-1 items-center justify-between gap-2 rounded-md border border-border bg-zinc-900/60 px-2.5 text-xs font-medium text-foreground transition-colors hover:border-[hsl(var(--tac-amber)/0.45)]"
          :aria-label="$t('layouts.queue.pick_mode')"
        >
          <span class="truncate">{{ modeTitle(quickMode.type) }}</span>
          <ChevronDown class="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" class="w-64">
        <DropdownMenuItem
          v-for="mode in modes"
          :key="mode.type"
          :disabled="!mode.canQueue"
          @select="join(mode.type)"
        >
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="text-sm">
              {{ modeTitle(mode.type) }}
              <span class="text-muted-foreground">
                {{ mode.expected / 2 }}v{{ mode.expected / 2 }}
              </span>
            </span>
            <span class="text-[0.7rem] text-muted-foreground">
              {{
                mode.canQueue
                  ? $t("layouts.queue.in_queue", { count: mode.inQueue })
                  : $t("layouts.queue.party_too_big", { count: partySize })
              }}
            </span>
          </div>
          <Check
            v-if="quickMode.type === mode.type"
            class="text-[hsl(var(--tac-amber))]"
          />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem @select="navigateTo('/play')">
          {{ $t("layouts.queue.all_modes") }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <NuxtLink
      to="/settings/matchmaking"
      class="inline-flex h-8 max-w-[7.5rem] items-center gap-1.5 rounded-md border border-border px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
      :title="regionLabels.join(', ')"
    >
      <Globe class="size-3.5 shrink-0" />
      <span class="truncate">
        {{ regionSummary ?? $t("layouts.party_room.pick_regions") }}
      </span>
    </NuxtLink>
    <button
      type="button"
      class="tac-amber-cta inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold"
      @click="join(quickMode.type)"
    >
      <Play class="size-3 fill-current" />
      {{ $t("layouts.party_room.queue") }}
    </button>
  </div>

  <!-- Idle, member: the leader picks. -->
  <div v-else-if="!isLeader" :class="rowClass">
    <Lock class="size-3.5 shrink-0 text-zinc-500" />
    <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground">
      {{
        $t("layouts.party_room.leader_picks", {
          name: leader?.player?.name ?? "",
        })
      }}
    </span>
  </div>
</template>
