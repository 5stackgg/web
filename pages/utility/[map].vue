<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  ArrowLeft,
  Plus,
  Rocket,
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
import UtilityFilters from "~/components/utility/UtilityFilters.vue";
import UtilityBlockPanel from "~/components/utility/UtilityBlockPanel.vue";
import UtilityPlaybooksPanel from "~/components/utility/UtilityPlaybooksPanel.vue";
import UtilityCreatePanel from "~/components/utility/UtilityCreatePanel.vue";
import UtilityMetaPanel from "~/components/utility/UtilityMetaPanel.vue";
import UtilityPracticePlanPanel from "~/components/utility/UtilityPracticePlanPanel.vue";
import UtilityRadarBoard from "~/components/utility/UtilityRadarBoard.vue";
import UtilityLineupCard from "~/components/utility/UtilityLineupCard.vue";
import UtilityForkDialog from "~/components/utility/UtilityForkDialog.vue";
import UtilityArchiveDialog from "~/components/utility/UtilityArchiveDialog.vue";
import UtilityLineupDialog from "~/components/utility/UtilityLineupDialog.vue";
import StartPracticeDialog from "~/components/utility/StartPracticeDialog.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  utilityLineupsCountQuery,
  utilityScopeCountsQuery,
  utilityLineupsQuery,
  utilityMetaLineupsQuery,
} from "~/graphql/utilityGraphql";
import { order_by } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import { useUtilityReactions } from "~/composables/useUtilityReactions";
import { normalizeMapName } from "~/utilities/mapAssets";
import cleanMapName from "~/utilities/cleanMapName";
import {
  matchUtilityMetaSpot,
  utilityLineupWhere,
  toUtilityMetaSpots,
} from "~/utilities/utilityDisplay";
import type {
  UtilityBoardMarker,
  UtilityBoardSegment,
  UtilityFilterState,
  UtilityMetaSpot,
  UtilityScope,
  UtilitySort,
} from "~/utilities/utilityDisplay";
import type { UtilityLineup, UtilityMetaLineup } from "~/types/utility";

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

const filters = computed<UtilityFilterState>({
  get: () => ({
    scope: (route.query.scope as UtilityScope) || "public",
    types: readList("type") as UtilityFilterState["types"],
    sides: readList("side") as UtilityFilterState["sides"],
    techniques: readList("tech") as UtilityFilterState["techniques"],
    strengths: readList("str") as UtilityFilterState["strengths"],
    tags: readList("tag"),
    sort: (route.query.sort as UtilitySort) || "top",
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

const lineups = ref<UtilityLineup[]>([]);
const loading = ref(true);
const totalCount = ref(0);
const page = ref(1);
const perPage = 60;
const selectedId = ref<string | null>(null);
const hoveredId = ref<string | null>(null);
const practiceOpen = ref(false);
const forkOpen = ref(false);
const forkLineup = ref<UtilityLineup | null>(null);
const archiveOpen = ref(false);
const archiveLineup = ref<UtilityLineup | null>(null);

const LIST_TAB = "lineups";
const META_TAB = "meta";
const CREATE_TAB = "create";
const BLOCK_TAB = "block";
const PLAYBOOKS_TAB = "playbooks";
const PLAN_TAB = "plan";
const listTab = ref<string>(LIST_TAB);
const selectedMetaKey = ref<string | null>(null);

// The board belongs to the page and outlives every tab. A panel that needs to
// draw on it publishes what it wants drawn instead of mounting a second board.
type PanelBoard = {
  picking?: boolean;
  pickZ?: number;
  markers?: UtilityBoardMarker[];
  segments?: UtilityBoardSegment[];
  lineups?: UtilityLineup[];
  selectedId?: string | null;
  hoveredId?: string | null;
  onPick?: (point: { x: number; y: number; z: number }) => void;
  onSelect?: (id: string | null) => void;
  onHover?: (id: string | null) => void;
};

const panelBoard = ref<PanelBoard | null>(null);

// The plan is ranked against the caller's own drill record, so there is nothing
// to show a signed-out visitor. Meta is only a tab once the map has mined data.
const listTabs = computed(() => {
  const tabs: Array<{ key: string; label: string; count?: number }> = [
    { key: LIST_TAB, label: t("pages.utility.lineups"), count: totalCount.value },
  ];
  if (metaSpots.value.length) {
    tabs.push({
      key: META_TAB,
      label: t("pages.utility.views.meta_tab"),
      count: metaSpots.value.length,
    });
  }
  tabs.push({
    key: PLAYBOOKS_TAB,
    label: t("pages.utility.views.playbooks_tab"),
  });
  tabs.push({ key: BLOCK_TAB, label: t("pages.utility.views.block_tab") });
  if (mySteamId.value) {
    tabs.push({ key: PLAN_TAB, label: t("pages.utility.plan.tab") });
  }
  // Authoring is reached from the header, so it is not a standing tab — but it
  // joins the strip while it is open, or the indicator has nothing to sit on.
  if (listTab.value === CREATE_TAB) {
    tabs.push({ key: CREATE_TAB, label: t("pages.utility.views.create_tab") });
  }
  return tabs;
});

const showPlan = computed(
  () => listTab.value === PLAN_TAB && !!mySteamId.value,
);
const showMetaPanel = computed(
  () => listTab.value === META_TAB && metaSpots.value.length > 0,
);
const showCreatePanel = computed(
  () => listTab.value === CREATE_TAB && !!mySteamId.value,
);
const showBlockPanel = computed(() => listTab.value === BLOCK_TAB);

// Executes are a card grid and a step editor, neither of which reads in a
// 380px column, so this view takes the board's width instead of its surface.
const showPlaybooks = computed(() => listTab.value === PLAYBOOKS_TAB);

// A tab that stops driving the board must hand it back, or its markers outlive
// the panel that drew them.
watch(listTab, () => {
  panelBoard.value = null;
});

// Straight into the lineup it just wrote: the author's next question is always
// whether it looks right on the board.
function onLineupCreated(id: string) {
  listTab.value = LIST_TAB;
  void fetchLineups();
  openLineup(id);
}

// The overlay toggle is for reading the meta *against* the library; the Meta
// tab is the meta itself, so it draws the clusters whatever the toggle says.
const metaOnBoard = computed(() =>
  showMetaPanel.value || showMeta.value ? metaSpots.value : [],
);

// A tab that disappears (meta drains, sign-out) must not strand the panel on a
// key nothing renders.
watch(listTabs, (tabs) => {
  if (
    listTab.value !== CREATE_TAB &&
    !tabs.some((tab) => tab.key === listTab.value)
  ) {
    listTab.value = LIST_TAB;
  }
});

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
  utilityLineupWhere(filters.value, {
    mapName: mapName.value,
    mySteamId: mySteamId.value,
    myTeamIds: myTeamIds.value,
  }),
);

// One count per scope tab, so "MINE" says how many are yours before you click
// it. Every other filter still applies -- the tabs count what you would get,
// not what exists.
const SCOPES = ["public", "mine", "team", "favorites"] as const;

const scopeCounts = ref<Record<string, number>>({});

const scopeWheres = computed(() =>
  Object.fromEntries(
    SCOPES.map((scope) => [
      scope,
      utilityLineupWhere(
        { ...filters.value, scope },
        {
          mapName: mapName.value,
          mySteamId: mySteamId.value,
          myTeamIds: myTeamIds.value,
        },
      ),
    ]),
  ),
);

async function fetchScopeCounts() {
  // A signed-out visitor only ever sees Public, so three of the four counts
  // would be a round trip spent on tabs they cannot press.
  const scopes = mySteamId.value ? [...SCOPES] : ["public"];

  try {
    const { data } = await getGraphqlClient().query({
      query: utilityScopeCountsQuery(scopes),
      variables: Object.fromEntries(
        scopes.map((scope) => [`where_${scope}`, scopeWheres.value[scope]]),
      ),
      fetchPolicy: "network-only",
    });

    scopeCounts.value = Object.fromEntries(
      scopes.map((scope) => [
        scope,
        (data as any)?.[`scope_${scope}`]?.aggregate?.count ?? 0,
      ]),
    );
  } catch (error) {
    console.error("[utility] scope count error:", error);
    scopeCounts.value = {};
  }
}

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
        query: utilityLineupsQuery,
        variables: {
          where: where.value,
          order_by: orderBy.value,
          limit: perPage,
          offset: (page.value - 1) * perPage,
        },
        fetchPolicy: "network-only",
      }),
      client.query({
        query: utilityLineupsCountQuery,
        variables: { where: where.value },
        fetchPolicy: "network-only",
      }),
    ]);
    if (myFetch !== fetchId) {
      return;
    }
    lineups.value = (rows.data as any)?.utility_lineups ?? [];
    totalCount.value =
      (counts.data as any)?.utility_lineups_aggregate?.aggregate?.count ?? 0;
  } catch (error) {
    if (myFetch === fetchId) {
      console.error("[utility] lineup fetch error:", error);
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
fetchScopeCounts();

watch([where, orderBy], () => {
  selectedId.value = null;
  void fetchScopeCounts();
  if (page.value !== 1) {
    page.value = 1;
    return;
  }
  void fetchLineups();
});

watch(page, () => {
  void fetchLineups();
});

const metaSpots = ref<UtilityMetaSpot[]>([]);
const showMeta = ref(false);

// Best effort by design: the mined meta is a nice-to-have overlay, and a page
// full of lineups must still render if the aggregate is unavailable.
async function fetchMeta() {
  try {
    const { data } = await getGraphqlClient().query({
      query: utilityMetaLineupsQuery,
      variables: {
        where: { map_name: { _eq: mapName.value } },
        order_by: [{ throwers: order_by.desc }],
        limit: 400,
      },
      fetchPolicy: "cache-first",
    });
    metaSpots.value = toUtilityMetaSpots(
      ((data as any)?.utility_meta_lineups ?? []) as UtilityMetaLineup[],
    );
  } catch (error) {
    console.error("[utility] meta load error:", error);
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
    const spot = matchUtilityMetaSpot(lineup, metaSpots.value);
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

const reactions = useUtilityReactions();

const detailOpen = ref(false);
const detailId = ref<string | null>(null);

function openLineup(id: string) {
  detailId.value = id;
  detailOpen.value = true;
}

// Practising from the dialog hands off to the practice dialog rather than
// stacking one modal on another.
function practiceFromDetail(id: string) {
  detailOpen.value = false;
  selectedId.value = id;
  practiceOpen.value = true;
}

// Patched in place rather than refetched: the whole list would flicker to move
// one number, and the row you clicked is the one thing you are looking at.
function patchLineup(id: string, patch: Partial<UtilityLineup>) {
  lineups.value = lineups.value.map((entry) =>
    entry.id === id ? { ...entry, ...patch } : entry,
  );
}

async function onVote(id: string, value: 1 | -1) {
  const steamId = mySteamId.value;
  const lineup = lineups.value.find((entry) => entry.id === id);

  if (!steamId || !lineup) {
    return;
  }

  const before = { ...lineup };
  patchLineup(id, reactions.afterVote(lineup, value));

  if (!(await reactions.vote(lineup, steamId, value))) {
    patchLineup(id, before);
  }
}

async function onFavorite(id: string) {
  const steamId = mySteamId.value;
  const lineup = lineups.value.find((entry) => entry.id === id);

  if (!steamId || !lineup) {
    return;
  }

  const before = { ...lineup };
  patchLineup(id, reactions.afterFavorite(lineup));

  if (await reactions.toggleFavorite(lineup, steamId)) {
    // SAVED is a scope, so favouriting changes what one of the tabs holds.
    void fetchScopeCounts();
  } else {
    patchLineup(id, before);
  }
}

function startArchive(id: string) {
  archiveLineup.value = lineups.value.find((entry) => entry.id === id) ?? null;
  archiveOpen.value = !!archiveLineup.value;
}

// Dropped from the list on the spot rather than after a refetch: the row is
// gone either way, and waiting a round trip to admit it makes the click feel
// like it missed. The undo in the toast puts it back.
function onArchived(id: string) {
  lineups.value = lineups.value.filter((entry) => entry.id !== id);
  totalCount.value = Math.max(0, totalCount.value - 1);

  if (selectedId.value === id) {
    selectedId.value = null;
  }

  void fetchScopeCounts();
}

function selectLineup(id: string | null) {
  selectedId.value = selectedId.value === id ? null : id;
  if (!selectedId.value || typeof document === "undefined") {
    return;
  }
  // Keeping the list in step with the board is the whole point of the split
  // view, so a marker click has to bring its card into view as well.
  document
    .getElementById(`utility-card-${selectedId.value}`)
    ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
</script>

<template>
  <PageTransition>
    <TacticalPageHeader>
      <template #description>{{ $t("pages.utility.eyebrow") }}</template>
      <template #title>{{ mapTitle }}</template>
      <template #subtitle>
        {{ $t("pages.utility.map_subtitle", { count: totalCount }) }}
      </template>
      <template #actions>
        <NuxtLink :to="{ name: 'utility' }">
          <Button variant="ghost" class="text-muted-foreground">
            <ArrowLeft class="mr-1 h-4 w-4" />
            {{ $t("pages.utility.all_maps") }}
          </Button>
        </NuxtLink>
        <!-- Three other ways to look at this same map, behind one control.
             Six buttons at equal weight is six decisions; the two that are
             actually actions stay out here on their own. -->

        <Button
          v-if="mySteamId"
          variant="outline"
          :class="listTab === CREATE_TAB ? 'text-[hsl(var(--tac-amber))]' : ''"
          @click="listTab = CREATE_TAB"
        >
          <Plus class="mr-1 h-4 w-4" />
          {{ $t("pages.utility.create.action") }}
        </Button>
        <Button class="tac-amber-cta" @click="practiceOpen = true">
          <Rocket class="mr-1 h-4 w-4" />
          {{ $t("pages.utility.practice.start") }}
        </Button>
      </template>
    </TacticalPageHeader>
  </PageTransition>

  <!-- Scope, tags and sort only mean anything to the library list; the other
       views carry their own controls. -->
  <PageTransition v-if="listTab === LIST_TAB" :delay="60" class="mt-4">
    <UtilityFilters
      v-model="filters"
      :available-tags="availableTags"
      :signed-in="!!mySteamId"
      :has-team="myTeamIds.length > 0"
      :scope-counts="scopeCounts"
    />
  </PageTransition>

  <PageTransition :delay="80" class="mt-4">
    <div
      class="grid gap-4"
      :class="showPlaybooks ? '' : 'lg:grid-cols-[minmax(0,1fr)_380px]'"
    >
      <div v-if="!showPlaybooks" class="lg:sticky lg:top-4 lg:self-start">
        <UtilityRadarBoard
          :map-name="mapName"
          :lineups="panelBoard?.lineups ?? lineups"
          :selected-id="panelBoard ? (panelBoard.selectedId ?? null) : selectedId"
          :hovered-id="panelBoard ? (panelBoard.hoveredId ?? null) : hoveredId"
          :meta-spots="metaOnBoard"
          :selected-meta-key="selectedMetaKey"
          :meta-interactive="showMetaPanel"
          :picking="!!panelBoard?.picking"
          :pick-z="panelBoard?.pickZ ?? 0"
          :markers="panelBoard?.markers ?? []"
          :segments="panelBoard?.segments ?? []"
          @select="
            (id) =>
              panelBoard?.onSelect ? panelBoard.onSelect(id) : selectLineup(id)
          "
          @hover="
            (id) =>
              panelBoard?.onHover ? panelBoard.onHover(id) : (hoveredId = id)
          "
          @select-meta="(key) => (selectedMetaKey = key)"
          @pick="(point) => panelBoard?.onPick?.(point)"
        />
        <div class="mt-2 flex items-start justify-between gap-2">
          <p class="text-xs text-muted-foreground">
            {{ $t("pages.utility.board.hint") }}
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
            {{ $t("pages.utility.meta.overlay") }}
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

        <UtilityPracticePlanPanel
          v-if="showPlan"
          :map-name="mapName"
          @select="selectLineup"
          @hover="(id) => (hoveredId = id)"
        />

        <UtilityPlaybooksPanel
          v-else-if="showPlaybooks"
          :map-name="mapName"
        />

        <UtilityBlockPanel
          v-else-if="showBlockPanel"
          :map-name="mapName"
          @board="(state) => (panelBoard = state)"
          @open="openLineup"
        />

        <UtilityCreatePanel
          v-else-if="showCreatePanel"
          :map-name="mapName"
          @board="(state) => (panelBoard = state)"
          @created="onLineupCreated"
        />

        <UtilityMetaPanel
          v-else-if="showMetaPanel"
          v-model:selected-key="selectedMetaKey"
          :spots="metaSpots"
          :lineups="lineups"
          @open="openLineup"
        />

        <!-- Shaped like the cards they stand in for. A short placeholder that
             is replaced by a tall card makes the whole list jump, which reads
             as jank even though nothing moved twice. The stagger keeps them
             from strobing as one block. -->
        <template v-else-if="loading">
          <div
            v-for="i in 4"
            :key="`skeleton-${i}`"
            class="animate-in fade-in rounded-md border border-border bg-card/40 p-3 [animation-duration:240ms] [animation-fill-mode:backwards]"
            :style="{ animationDelay: `${(i - 1) * 60}ms` }"
          >
            <div class="flex items-start gap-2">
              <Skeleton class="mt-1 h-3 w-3 shrink-0 rounded-[2px]" />
              <div class="min-w-0 flex-1 space-y-1.5">
                <Skeleton class="h-4 w-2/5" />
                <Skeleton class="h-2.5 w-1/4" />
              </div>
            </div>
            <div class="mt-2.5 flex flex-wrap gap-1.5">
              <Skeleton class="h-5 w-20 rounded-full" />
              <Skeleton class="h-5 w-12 rounded-full" />
              <Skeleton class="h-5 w-24 rounded-full" />
            </div>
            <Skeleton class="mt-2.5 h-9 w-full rounded-md" />
            <div class="mt-2.5 flex items-center justify-between">
              <Skeleton class="h-6 w-28 rounded-full" />
              <Skeleton class="h-4 w-14" />
            </div>
          </div>
        </template>

        <Empty v-else-if="!lineups.length">
          <EmptyTitle>{{ $t("pages.utility.empty.no_lineups") }}</EmptyTitle>
          <EmptyDescription>
            {{ $t("pages.utility.empty.no_lineups_description") }}
          </EmptyDescription>
        </Empty>

        <!-- A list that changes under you without moving is a list you have to
             re-read. Filtering, archiving and paging all reorder this, so the
             rows carry themselves to their new positions instead. -->
        <TransitionGroup
          v-else
          tag="div"
          class="contents"
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 -translate-x-1"
          enter-to-class="opacity-100 translate-x-0"
          leave-active-class="absolute w-full transition duration-150 ease-in"
          leave-from-class="opacity-100 translate-x-0"
          leave-to-class="opacity-0 translate-x-3"
          move-class="transition-transform duration-200 ease-out"
        >
          <div
            v-for="lineup of lineups"
            :id="`utility-card-${lineup.id}`"
            :key="lineup.id"
          >
            <UtilityLineupCard
              :lineup="lineup"
              :selected="selectedId === lineup.id"
              :meta-throwers="metaThrowersByLineup[lineup.id] ?? null"
              :show-fork="!!mySteamId"
              :show-archive="!!mySteamId"
              @select="selectLineup"
              @hover="(id) => (hoveredId = id)"
              :can-react="!!mySteamId"
              open-in-place
              @open="openLineup"
              @fork="startFork"
              @archive="startArchive"
              @vote="onVote"
              @favorite="onFavorite"
            />
          </div>
        </TransitionGroup>
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

  <UtilityForkDialog
    v-model:open="forkOpen"
    :lineup-id="forkLineup?.id ?? null"
    :source-name="forkLineup?.name ?? null"
  />

  <UtilityLineupDialog
    v-model:open="detailOpen"
    v-model:lineup-id="detailId"
    :lineups="lineups"
    :can-react="!!mySteamId"
    @practice="practiceFromDetail"
    @vote="onVote"
    @favorite="onFavorite"
  />

  <UtilityArchiveDialog
    v-model:open="archiveOpen"
    :lineup-id="archiveLineup?.id ?? null"
    :lineup-name="archiveLineup?.name ?? null"
    @archived="onArchived"
  />

  <StartPracticeDialog
    v-model:open="practiceOpen"
    :map-name="mapName"
    :join-invite-code="joinInviteCode"
  />
</template>
