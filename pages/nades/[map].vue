<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  ArrowLeft,
  ListOrdered,
  Plus,
  Rocket,
  ShieldHalf,
  Users,
} from "lucide-vue-next";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import Pagination from "~/components/Pagination.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import NadeFilters from "~/components/nades/NadeFilters.vue";
import NadePracticePlanPanel from "~/components/nades/NadePracticePlanPanel.vue";
import NadeRadarBoard from "~/components/nades/NadeRadarBoard.vue";
import NadeLineupCard from "~/components/nades/NadeLineupCard.vue";
import NadeForkDialog from "~/components/nades/NadeForkDialog.vue";
import StartPracticeDialog from "~/components/nades/StartPracticeDialog.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  nadeLineupsCountQuery,
  nadeLineupsQuery,
  nadeMetaLineupsQuery,
} from "~/graphql/nadesGraphql";
import { order_by } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import { normalizeMapName } from "~/utilities/mapAssets";
import cleanMapName from "~/utilities/cleanMapName";
import {
  matchNadeMetaSpot,
  nadeLineupWhere,
  toNadeMetaSpots,
} from "~/utilities/nadeDisplay";
import type {
  NadeFilterState,
  NadeMetaSpot,
  NadeScope,
  NadeSort,
} from "~/utilities/nadeDisplay";
import type { NadeLineup, NadeMetaLineup } from "~/types/nade";

definePageMeta({
  persistQueryKeys: [
    "scope",
    "sort",
    "q",
    "type",
    "side",
    "tech",
    "str",
    "tag",
  ],
});

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const mapName = computed(() => normalizeMapName(String(route.params.map)));
const mapTitle = computed(() => cleanMapName(mapName.value));

const auth = useAuthStore();
const mySteamId = computed(() => auth.me?.steam_id ?? null);
const myTeamIds = computed(() =>
  (auth.me?.teams ?? []).map((team: { id: string }) => team.id),
);

function readList(key: string): string[] {
  const raw = route.query[key];
  if (typeof raw !== "string" || raw.length === 0) {
    return [];
  }
  return raw.split(",").filter((entry) => entry.length > 0);
}

const filters = computed<NadeFilterState>({
  get: () => ({
    scope: (route.query.scope as NadeScope) || "public",
    types: readList("type") as NadeFilterState["types"],
    sides: readList("side") as NadeFilterState["sides"],
    techniques: readList("tech") as NadeFilterState["techniques"],
    strengths: readList("str") as NadeFilterState["strengths"],
    tags: readList("tag"),
    sort: (route.query.sort as NadeSort) || "top",
    search: typeof route.query.q === "string" ? route.query.q : "",
  }),
  set: (next) => {
    const query = { ...route.query } as Record<string, unknown>;
    const write = (key: string, value: string) => {
      if (value) {
        query[key] = value;
      } else {
        delete query[key];
      }
    };
    write("scope", next.scope === "public" ? "" : next.scope);
    write("sort", next.sort === "top" ? "" : next.sort);
    write("q", next.search);
    write("type", next.types.join(","));
    write("side", next.sides.join(","));
    write("tech", next.techniques.join(","));
    write("str", next.strengths.join(","));
    write("tag", next.tags.join(","));
    router.replace({ path: route.path, query: query as any, hash: route.hash });
  },
});

const lineups = ref<NadeLineup[]>([]);
const loading = ref(true);
const totalCount = ref(0);
const page = ref(1);
const perPage = 60;
const selectedId = ref<string | null>(null);
const hoveredId = ref<string | null>(null);
const practiceOpen = ref(false);
const forkOpen = ref(false);
const forkLineup = ref<NadeLineup | null>(null);

const LIST_TAB = "lineups";
const PLAN_TAB = "plan";
const listTab = ref<string>(LIST_TAB);

// The plan is ranked against the caller's own drill record, so there is nothing
// to show a signed-out visitor.
const listTabs = computed(() => {
  const tabs: Array<{ key: string; label: string; count?: number }> = [
    { key: LIST_TAB, label: t("pages.nades.lineups"), count: totalCount.value },
  ];
  if (mySteamId.value) {
    tabs.push({ key: PLAN_TAB, label: t("pages.nades.plan.tab") });
  }
  return tabs;
});

const showPlan = computed(
  () => listTab.value === PLAN_TAB && !!mySteamId.value,
);

// ?practice= carries an invite code, not a session id.
const joinInviteCode = computed(() =>
  typeof route.query.practice === "string" ? route.query.practice : null,
);

watch(
  joinInviteCode,
  (id) => {
    if (id) {
      practiceOpen.value = true;
    }
  },
  { immediate: true },
);

const where = computed<Record<string, unknown>>(() =>
  nadeLineupWhere(filters.value, {
    mapName: mapName.value,
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
    const client = getGraphqlClient();
    const [rows, counts] = await Promise.all([
      client.query({
        query: nadeLineupsQuery,
        variables: {
          where: where.value,
          order_by: orderBy.value,
          limit: perPage,
          offset: (page.value - 1) * perPage,
        },
        fetchPolicy: "network-only",
      }),
      client.query({
        query: nadeLineupsCountQuery,
        variables: { where: where.value },
        fetchPolicy: "network-only",
      }),
    ]);
    if (myFetch !== fetchId) {
      return;
    }
    lineups.value = (rows.data as any)?.nade_lineups ?? [];
    totalCount.value =
      (counts.data as any)?.nade_lineups_aggregate?.aggregate?.count ?? 0;
  } catch (error) {
    if (myFetch === fetchId) {
      console.error("[nades] lineup fetch error:", error);
      lineups.value = [];
      totalCount.value = 0;
    }
  } finally {
    if (myFetch === fetchId) {
      loading.value = false;
    }
  }
}

fetchLineups();

watch([where, orderBy], () => {
  selectedId.value = null;
  if (page.value !== 1) {
    page.value = 1;
    return;
  }
  void fetchLineups();
});

watch(page, () => {
  void fetchLineups();
});

const metaSpots = ref<NadeMetaSpot[]>([]);
const showMeta = ref(false);

// Best effort by design: the mined meta is a nice-to-have overlay, and a page
// full of lineups must still render if the aggregate is unavailable.
async function fetchMeta() {
  try {
    const { data } = await getGraphqlClient().query({
      query: nadeMetaLineupsQuery,
      variables: {
        where: { map_name: { _eq: mapName.value } },
        order_by: [{ throwers: order_by.desc }],
        limit: 400,
      },
      fetchPolicy: "cache-first",
    });
    metaSpots.value = toNadeMetaSpots(
      ((data as any)?.nade_meta_lineups ?? []) as NadeMetaLineup[],
    );
  } catch (error) {
    console.error("[nades] meta load error:", error);
    metaSpots.value = [];
  }
}

watch(mapName, () => void fetchMeta(), { immediate: true });

const metaThrowersByLineup = computed(() => {
  const counts: Record<string, number> = {};
  if (!metaSpots.value.length) {
    return counts;
  }
  for (const lineup of lineups.value) {
    const spot = matchNadeMetaSpot(lineup, metaSpots.value);
    if (spot && spot.throwers > 0) {
      counts[lineup.id] = spot.throwers;
    }
  }
  return counts;
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

function startFork(id: string) {
  forkLineup.value = lineups.value.find((entry) => entry.id === id) ?? null;
  forkOpen.value = !!forkLineup.value;
}

function selectLineup(id: string | null) {
  selectedId.value = selectedId.value === id ? null : id;
  if (!selectedId.value || typeof document === "undefined") {
    return;
  }
  // Keeping the list in step with the board is the whole point of the split
  // view, so a marker click has to bring its card into view as well.
  document
    .getElementById(`nade-card-${selectedId.value}`)
    ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
</script>

<template>
  <PageTransition>
    <TacticalPageHeader>
      <template #description>{{ $t("pages.nades.eyebrow") }}</template>
      <template #title>{{ mapTitle }}</template>
      <template #subtitle>
        {{ $t("pages.nades.map_subtitle", { count: totalCount }) }}
      </template>
      <template #actions>
        <NuxtLink :to="{ name: 'nades' }">
          <Button variant="outline">
            <ArrowLeft class="mr-1 h-4 w-4" />
            {{ $t("pages.nades.all_maps") }}
          </Button>
        </NuxtLink>
        <NuxtLink :to="{ name: 'nades-block-map', params: { map: mapName } }">
          <Button variant="outline">
            <ShieldHalf class="mr-1 h-4 w-4" />
            {{ $t("pages.nades.block.title") }}
          </Button>
        </NuxtLink>
        <NuxtLink
          :to="{ name: 'nades-playbooks-map', params: { map: mapName } }"
        >
          <Button variant="outline">
            <ListOrdered class="mr-1 h-4 w-4" />
            {{ $t("pages.nades.playbooks.title") }}
          </Button>
        </NuxtLink>
        <NuxtLink :to="{ name: 'nades-meta-map', params: { map: mapName } }">
          <Button variant="outline">
            <Users class="mr-1 h-4 w-4" />
            {{ $t("pages.nades.meta.title") }}
          </Button>
        </NuxtLink>
        <NuxtLink :to="{ name: 'nades-new-map', params: { map: mapName } }">
          <Button variant="outline">
            <Plus class="mr-1 h-4 w-4" />
            {{ $t("pages.nades.create.action") }}
          </Button>
        </NuxtLink>
        <Button class="tac-amber-cta" @click="practiceOpen = true">
          <Rocket class="mr-1 h-4 w-4" />
          {{ $t("pages.nades.practice.start") }}
        </Button>
      </template>
    </TacticalPageHeader>
  </PageTransition>

  <PageTransition :delay="60" class="mt-4">
    <NadeFilters
      v-model="filters"
      :available-tags="availableTags"
      :signed-in="!!mySteamId"
      :has-team="myTeamIds.length > 0"
    />
  </PageTransition>

  <PageTransition :delay="80" class="mt-4">
    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div class="lg:sticky lg:top-4 lg:self-start">
        <NadeRadarBoard
          :map-name="mapName"
          :lineups="lineups"
          :selected-id="selectedId"
          :hovered-id="hoveredId"
          :meta-spots="showMeta ? metaSpots : []"
          @select="selectLineup"
          @hover="(id) => (hoveredId = id)"
        />
        <div class="mt-2 flex items-start justify-between gap-2">
          <p class="text-xs text-muted-foreground">
            {{ $t("pages.nades.board.hint") }}
          </p>
          <Button
            v-if="metaSpots.length"
            size="sm"
            variant="outline"
            class="shrink-0"
            :class="showMeta ? 'text-[hsl(var(--tac-amber))]' : ''"
            @click="showMeta = !showMeta"
          >
            <Users class="mr-1 h-4 w-4" />
            {{ $t("pages.nades.meta.overlay") }}
          </Button>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <AnimatedFilters
          v-if="listTabs.length > 1"
          v-model="listTab"
          :options="listTabs"
          square
          block
        />

        <NadePracticePlanPanel
          v-if="showPlan"
          :map-name="mapName"
          @select="selectLineup"
          @hover="(id) => (hoveredId = id)"
        />

        <template v-else-if="loading">
          <Skeleton v-for="i in 6" :key="i" class="h-28 w-full rounded-md" />
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
            :id="`nade-card-${lineup.id}`"
            :key="lineup.id"
          >
            <NadeLineupCard
              :lineup="lineup"
              :selected="selectedId === lineup.id"
              :meta-throwers="metaThrowersByLineup[lineup.id] ?? null"
              :show-fork="!!mySteamId"
              @select="selectLineup"
              @hover="(id) => (hoveredId = id)"
              @fork="startFork"
            />
          </div>
        </template>
      </div>
    </div>
  </PageTransition>

  <Pagination
    v-if="!showPlan && totalCount > perPage"
    :total="totalCount"
    :page="page"
    :per-page="perPage"
    @page="(value) => (page = value)"
  />

  <NadeForkDialog
    v-model:open="forkOpen"
    :lineup-id="forkLineup?.id ?? null"
    :source-name="forkLineup?.name ?? null"
  />

  <StartPracticeDialog
    v-model:open="practiceOpen"
    :map-name="mapName"
    :join-invite-code="joinInviteCode"
  />
</template>
