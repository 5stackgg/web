<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Check, Plus } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import UtilityEmpty from "~/components/utility/UtilityEmpty.vue";
import UtilitySkeletonList from "~/components/utility/UtilitySkeletonList.vue";
import UtilityFilters from "~/components/utility/UtilityFilters.vue";
import UtilityLineupCard from "~/components/utility/UtilityLineupCard.vue";
import UtilityRadarBoard from "~/components/utility/UtilityRadarBoard.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { utilityLineupsQuery } from "~/graphql/utilityGraphql";
import { order_by } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import { useDeferredLoading } from "~/composables/useDeferredLoading";
import { emptyUtilityFilters, utilityLineupWhere } from "~/utilities/utilityDisplay";
import type { UtilityFilterState } from "~/utilities/utilityDisplay";
import type { UtilityLineup, UtilitySide } from "~/types/utility";

const props = withDefaults(
  defineProps<{
    mapName: string;
    // Pre-narrows the browse to the execute's own side.
    side?: UtilitySide | null;
    pickedIds?: string[];
  }>(),
  {
    side: null,
    pickedIds: () => [],
  },
);

const emit = defineEmits<{
  (e: "pick", lineup: UtilityLineup): void;
}>();

const open = defineModel<boolean>("open", { default: false });

const auth = useAuthStore();
const mySteamId = computed(() => auth.me?.steam_id ?? null);
const myTeamIds = computed(() =>
  (auth.me?.teams ?? []).map((team: { id: string }) => team.id),
);

const filters = ref<UtilityFilterState>(emptyUtilityFilters());
const lineups = ref<UtilityLineup[]>([]);
const loading = ref(false);

// Only the first fill draws shapes; narrowing the filters afterwards keeps the
// rows you are picking from and dims them.
const { skeleton, refreshing, reset } = useDeferredLoading(() => loading.value);

const hoveredId = ref<string | null>(null);
const PER_PAGE = 60;

const where = computed(() =>
  utilityLineupWhere(filters.value, {
    mapName: props.mapName,
    mySteamId: mySteamId.value,
    myTeamIds: myTeamIds.value,
  }),
);

const orderBy = computed(() =>
  filters.value.sort === "new"
    ? [{ created_at: order_by.desc }]
    : [{ upvotes: order_by.desc }],
);

let fetchId = 0;
async function fetchLineups() {
  const myFetch = ++fetchId;
  loading.value = true;
  try {
    const { data } = await getGraphqlClient().query({
      query: utilityLineupsQuery,
      variables: {
        where: where.value,
        order_by: orderBy.value,
        limit: PER_PAGE,
        offset: 0,
      },
      fetchPolicy: "network-only",
    });
    if (myFetch !== fetchId) {
      return;
    }
    lineups.value = (data as any)?.utility_lineups ?? [];
  } catch (error) {
    if (myFetch === fetchId) {
      console.error("[utility] playbook picker fetch error:", error);
      lineups.value = [];
    }
  } finally {
    if (myFetch === fetchId) {
      loading.value = false;
    }
  }
}

// What this visit added, as opposed to what the execute already held. The
// dialog stays open on purpose -- an execute is four or five throws and closing
// after each one would make picking them feel like a mistake -- so it owes the
// caller a running count and a way to say it is finished.
const openingCount = ref(0);
const addedHere = computed(() =>
  Math.max(0, props.pickedIds.length - openingCount.value),
);

watch(open, (isOpen) => {
  if (!isOpen) {
    return;
  }
  openingCount.value = props.pickedIds.length;
  // Reopened on a different execute: whatever is still in the list belongs to
  // the last visit.
  reset();
  filters.value = {
    ...emptyUtilityFilters(),
    sides: props.side ? [props.side] : [],
  };
  void fetchLineups();
});

watch([where, orderBy], () => {
  if (open.value) {
    void fetchLineups();
  }
});

const availableTags = computed(() => {
  const tags = new Set<string>();
  for (const lineup of lineups.value) {
    for (const tag of lineup.tags ?? []) {
      tags.add(tag);
    }
  }
  return [...tags].sort();
});

// A count, not a flag: the second helping of a smoke is a different sentence
// from the first, and the picker is where you find out you are ordering it.
const pickedCounts = computed(() => {
  const counts: Record<string, number> = {};
  for (const id of props.pickedIds) {
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
});

function pick(id: string) {
  const lineup = lineups.value.find((entry) => entry.id === id);
  if (lineup) {
    emit("pick", lineup);
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-5xl">
      <DialogHeader>
        <DialogTitle>{{ $t("pages.utility.playbooks.pick_title") }}</DialogTitle>
        <DialogDescription>
          {{ $t("pages.utility.playbooks.pick_description") }}
        </DialogDescription>
      </DialogHeader>

      <UtilityFilters
        v-model="filters"
        :available-tags="availableTags"
        :signed-in="!!mySteamId"
        :has-team="myTeamIds.length > 0"
      />

      <div class="grid gap-3 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div class="hidden lg:block">
          <UtilityRadarBoard
            :map-name="mapName"
            :lineups="lineups"
            :hovered-id="hoveredId"
            @hover="(id) => (hoveredId = id)"
            @select="(id) => id && pick(id)"
          />
        </div>

        <div class="max-h-[55vh] overflow-y-auto pr-1">
          <!-- The skeletons are the same height as the cards they stand in
               for, so re-filtering dissolves instead of collapsing the list to
               nothing and springing it back. -->
          <FadeSwap>
            <UtilitySkeletonList v-if="skeleton" key="loading" :count="4" />

            <UtilityEmpty
              v-else-if="!lineups.length"
              key="empty"
              :title="$t('pages.utility.empty.no_lineups')"
              :description="$t('pages.utility.empty.no_lineups_description')"
            />

            <TransitionGroup
              v-else
              key="list"
              tag="div"
              name="pick"
              class="flex flex-col gap-2 transition-opacity [transition-duration:180ms]"
              :class="refreshing ? 'pointer-events-none opacity-50' : ''"
            >
              <!-- A lineup already in the execute stays pickable -- a re-smoke
                   is a real call -- but it has to look spent, or you add the
                   same smoke five times and only find out in the step list. -->
              <div
                v-for="lineup of lineups"
                :key="lineup.id"
                class="relative rounded-md transition-[box-shadow,opacity] duration-200"
                :class="
                  pickedCounts[lineup.id]
                    ? 'ring-1 ring-[hsl(var(--tac-amber)/0.55)]'
                    : ''
                "
                @mouseenter="hoveredId = lineup.id"
                @mouseleave="hoveredId = null"
              >
                <UtilityLineupCard
                  :lineup="lineup"
                  :selected="hoveredId === lineup.id"
                  :show-open-link="false"
                  class="transition-opacity duration-200"
                  :class="
                    pickedCounts[lineup.id] && hoveredId !== lineup.id
                      ? 'opacity-50'
                      : ''
                  "
                  @select="pick"
                  @hover="(id) => (hoveredId = id)"
                />
                <Transition name="picked">
                  <span
                    v-if="pickedCounts[lineup.id]"
                    class="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-sm border border-[hsl(var(--tac-amber)/0.5)] bg-background/90 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))]"
                  >
                    <Check class="h-3 w-3" />
                    {{ $t("pages.utility.playbooks.already_in") }}
                    <span
                      v-if="pickedCounts[lineup.id] > 1"
                      class="tabular-nums"
                    >
                      ×{{ pickedCounts[lineup.id] }}
                    </span>
                  </span>
                </Transition>
              </div>
            </TransitionGroup>
          </FadeSwap>
        </div>
      </div>

      <!-- Closing the window was the only way out, which reads as abandoning
           the picks rather than finishing with them. -->
      <DialogFooter class="sm:justify-between">
        <span
          class="flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
        >
          <Plus
            class="h-3 w-3"
            :class="addedHere ? 'text-[hsl(var(--tac-amber))]' : 'opacity-40'"
          />
          <span
            class="tabular-nums transition-colors"
            :class="addedHere ? 'text-[hsl(var(--tac-amber))]' : ''"
          >
            {{ $t("pages.utility.playbooks.added_count", { count: addedHere }) }}
          </span>
        </span>
        <Button class="tac-amber-cta" @click="open = false">
          {{ $t("pages.utility.playbooks.done") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.pick-move {
  transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.pick-enter-active {
  transition:
    opacity 240ms ease-out,
    transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.pick-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

/* The badge is the receipt for the click that just happened, so it arrives
   from the press rather than blinking into place. */
.picked-enter-active,
.picked-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
}
.picked-enter-from,
.picked-leave-to {
  opacity: 0;
  transform: scale(0.85);
}

@media (prefers-reduced-motion: reduce) {
  .pick-move,
  .pick-enter-active,
  .picked-enter-active,
  .picked-leave-active {
    transition-duration: 1ms;
  }
}
</style>
