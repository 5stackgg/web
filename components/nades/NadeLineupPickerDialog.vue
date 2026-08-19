<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Check } from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import NadeFilters from "~/components/nades/NadeFilters.vue";
import NadeLineupCard from "~/components/nades/NadeLineupCard.vue";
import NadeRadarBoard from "~/components/nades/NadeRadarBoard.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { nadeLineupsQuery } from "~/graphql/nadesGraphql";
import { order_by } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import { emptyNadeFilters, nadeLineupWhere } from "~/utilities/nadeDisplay";
import type { NadeFilterState } from "~/utilities/nadeDisplay";
import type { NadeLineup, NadeSide } from "~/types/nade";

const props = withDefaults(
  defineProps<{
    mapName: string;
    // Pre-narrows the browse to the execute's own side.
    side?: NadeSide | null;
    pickedIds?: string[];
  }>(),
  {
    side: null,
    pickedIds: () => [],
  },
);

const emit = defineEmits<{
  (e: "pick", lineup: NadeLineup): void;
}>();

const open = defineModel<boolean>("open", { default: false });

const auth = useAuthStore();
const mySteamId = computed(() => auth.me?.steam_id ?? null);
const myTeamIds = computed(() =>
  (auth.me?.teams ?? []).map((team: { id: string }) => team.id),
);

const filters = ref<NadeFilterState>(emptyNadeFilters());
const lineups = ref<NadeLineup[]>([]);
const loading = ref(false);
const hoveredId = ref<string | null>(null);
const PER_PAGE = 60;

const where = computed(() =>
  nadeLineupWhere(filters.value, {
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
      query: nadeLineupsQuery,
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
    lineups.value = (data as any)?.nade_lineups ?? [];
  } catch (error) {
    if (myFetch === fetchId) {
      console.error("[nades] playbook picker fetch error:", error);
      lineups.value = [];
    }
  } finally {
    if (myFetch === fetchId) {
      loading.value = false;
    }
  }
}

watch(open, (isOpen) => {
  if (!isOpen) {
    return;
  }
  filters.value = {
    ...emptyNadeFilters(),
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

const picked = computed(() => new Set(props.pickedIds));

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
        <DialogTitle>{{ $t("pages.nades.playbooks.pick_title") }}</DialogTitle>
        <DialogDescription>
          {{ $t("pages.nades.playbooks.pick_description") }}
        </DialogDescription>
      </DialogHeader>

      <NadeFilters
        v-model="filters"
        :available-tags="availableTags"
        :signed-in="!!mySteamId"
        :has-team="myTeamIds.length > 0"
      />

      <div class="grid gap-3 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div class="hidden lg:block">
          <NadeRadarBoard
            :map-name="mapName"
            :lineups="lineups"
            :hovered-id="hoveredId"
            @hover="(id) => (hoveredId = id)"
            @select="(id) => id && pick(id)"
          />
        </div>

        <div class="flex max-h-[55vh] flex-col gap-2 overflow-y-auto pr-1">
          <template v-if="loading">
            <Skeleton v-for="i in 5" :key="i" class="h-28 w-full rounded-md" />
          </template>

          <Empty v-else-if="!lineups.length">
            <EmptyTitle>{{ $t("pages.nades.empty.no_lineups") }}</EmptyTitle>
            <EmptyDescription>
              {{ $t("pages.nades.empty.no_lineups_description") }}
            </EmptyDescription>
          </Empty>

          <template v-else>
            <div
              v-for="lineup of lineups"
              :key="lineup.id"
              class="relative"
              @mouseenter="hoveredId = lineup.id"
              @mouseleave="hoveredId = null"
            >
              <NadeLineupCard
                :lineup="lineup"
                :selected="hoveredId === lineup.id"
                :show-open-link="false"
                @select="pick"
                @hover="(id) => (hoveredId = id)"
              />
              <span
                v-if="picked.has(lineup.id)"
                class="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-sm border border-[hsl(var(--tac-amber)/0.5)] bg-background/90 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))]"
              >
                <Check class="h-3 w-3" />
                {{ $t("pages.nades.playbooks.already_in") }}
              </span>
            </div>
          </template>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
