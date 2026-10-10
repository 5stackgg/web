<script setup lang="ts">
import { computed, h, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  ClipboardCheck,
  ExternalLink,
  Library,
  ListOrdered,
  Maximize2,
  Minus,
  Plus,
  Rows3,
  Tags,
  X,
} from "lucide-vue-next";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import HeightSwap from "~/components/ui/transitions/HeightSwap.vue";
import { Button } from "~/components/ui/button";
import Pagination from "~/components/Pagination.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import UtilityFilters from "~/components/utility/UtilityFilters.vue";
import UtilityBlockPanel from "~/components/utility/UtilityBlockPanel.vue";
import UtilityPlaybooksPanel from "~/components/utility/UtilityPlaybooksPanel.vue";
import UtilityCreatePanel from "~/components/utility/UtilityCreatePanel.vue";
import UtilityMapRail from "~/components/utility/UtilityMapRail.vue";
import UtilityPracticeBar from "~/components/utility/UtilityPracticeBar.vue";
import UtilityPracticePanel from "~/components/utility/UtilityPracticePanel.vue";
import UtilityMetaIcon from "~/components/utility/UtilityMetaIcon.vue";
import UtilityMetaPanel from "~/components/utility/UtilityMetaPanel.vue";
import type { UtilityMetaScope } from "~/components/utility/UtilityMetaPanel.vue";
import UtilityMetaSpotView from "~/components/utility/UtilityMetaSpotView.vue";
import UtilityPracticePlanPanel from "~/components/utility/UtilityPracticePlanPanel.vue";
import UtilityRadarBoard from "~/components/utility/UtilityRadarBoard.vue";
import UtilityCollectionsPanel from "~/components/utility/UtilityCollectionsPanel.vue";
import UtilityLineupCard from "~/components/utility/UtilityLineupCard.vue";
import UtilityTypeChips from "~/components/utility/UtilityTypeChips.vue";
import UtilityTypeHeader from "~/components/utility/UtilityTypeHeader.vue";
import Fold from "~/components/ui/transitions/Fold.vue";
import { useElementSize } from "@vueuse/core";
import UtilityMobileSheet from "~/components/utility/UtilityMobileSheet.vue";
import UtilityEmpty from "~/components/utility/UtilityEmpty.vue";
import UtilitySkeletonList from "~/components/utility/UtilitySkeletonList.vue";
import UtilityForkDialog from "~/components/utility/UtilityForkDialog.vue";
import UtilityArchiveDialog from "~/components/utility/UtilityArchiveDialog.vue";
import UtilityDeleteDialog from "~/components/utility/UtilityDeleteDialog.vue";
import UtilityLineupDetail from "~/components/utility/UtilityLineupDetail.vue";
import { useUtilityPracticeSession } from "~/composables/useUtilityPracticeSession";
import { useUtilityLoad } from "~/composables/useUtilityLoad";
import {
  notOpenedHere,
  openedHere,
  stepOutOf,
  useBackDismiss,
} from "~/composables/useBackDismiss";
import { addressOpenMode, addressWrites } from "~/utilities/backDismiss";
import { escapeTaken, takeEscape } from "~/utilities/escapeKey";
import {
  arriveUtilityPage,
  leaveUtilityPage,
  morphFromRect,
  restingRect,
} from "~/composables/useUtilityMapHandoff";
import { provideUtilityCardViews } from "~/composables/useUtilityCardViews";
import { useDeferredLoading } from "~/composables/useDeferredLoading";
import { useMapCover } from "~/composables/useMapCover";
import { getQueryString, useRouteTab } from "~/composables/useRouteTab";
import { useSidebar } from "~/components/ui/sidebar/utils";
import cleanMapName from "~/utilities/cleanMapName";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { toast, ToastAction } from "~/components/ui/toast";
import {
  archiveUtilityLineupMutation,
  requestUtilityLineupPublicMutation,
  reviewUtilityLineupPublicMutation,
  UTILITY_LANDINGS_LIMIT,
  myUtilityProgressSubscription,
  utilityLibraryPulseSubscription,
  utilityLineupsCountQuery,
  utilityLineupsQuery,
  utilityMetaLineupsQuery,
  utilityScopeCountSubscription,
} from "~/graphql/utilityGraphql";
import { utilityLineupBucketsQuery } from "~/graphql/utilityMetaGraphql";
import { renderUtilityLineupPreviewMutation } from "~/graphql/utilityRenderGraphql";
import { e_player_roles_enum, order_by } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import { useUtilityReactions } from "~/composables/useUtilityReactions";
import { normalizeMapName } from "~/utilities/mapAssets";
import {
  UTILITY_TYPES,
  matchUtilityMetaSpot,
  utilityLineupWhere,
  toUtilityMetaSpots,
} from "~/utilities/utilityDisplay";
import type {
  UtilityFilterState,
  UtilityBarOffer,
  UtilityLineupContext,
  UtilityMetaSpot,
  UtilityPanelBoard,
  UtilityPracticeTarget,
  UtilityScope,
  UtilitySort,
} from "~/utilities/utilityDisplay";
import type {
  UtilityLineup,
  UtilityLineupProgress,
  UtilityMetaLineup,
  UtilityType,
} from "~/types/utility";

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
    "page",
    "meta",
    "metaScope",
    "minThrowers",
    "planSide",
    "planSource",
  ],
});

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const mapName = computed(() => normalizeMapName(String(route.params.map)));

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

/**
 * Everything this page holds -- which tab, which sub-filter, which page -- goes
 * into the URL, so a refresh lands you back where you were rather than on
 * Lineups page 1. `replace` rather than `push`: reading a library is one place,
 * not twenty history entries, and the route's page key ignores the query
 * (app.vue), so none of these writes remount anything.
 *
 * A value equal to its default is deleted instead of written, or every visit
 * would arrive carrying eight parameters that say nothing.
 */
//
// Writes made in the same tick are merged into one navigation. The router only
// keeps the last navigation it is handed, and each of these starts from the
// query as it stands -- so a tab switch that also closes a lineup, written as
// two navigations, would land with only one of the two changes.
let queryPatch: Record<string, string | null> | null = null;
let queryMode: "push" | "replace" = "replace";

// The entry that opens one of these notes where it is, so the page's own
// Back can step to just before it however much has been opened since.
const OPENED_BY_ADDRESS = ["lineup", "spot"];

function writeQuery(
  patch: Record<string, string | null>,
  mode: "push" | "replace" = "replace",
) {
  if (!queryPatch) {
    queryPatch = {};
    queryMode = "replace";
    void nextTick(flushQuery);
  }
  Object.assign(queryPatch, patch);
  if (mode === "push") {
    queryMode = "push";
  }
}

// One at a time: each starts from the address the one before it left.
let writing: Promise<unknown> = Promise.resolve();

function flushQuery() {
  const patch = queryPatch ?? {};
  const mode = queryMode;
  queryPatch = null;
  writing = writing.then(() => applyQuery(patch, mode));
}

async function applyQuery(
  patch: Record<string, string | null>,
  mode: "push" | "replace",
) {
  const writes = addressWrites(route.query, patch, mode, OPENED_BY_ADDRESS);
  const at = { path: route.path, hash: route.hash };
  if (writes.replace) {
    // Taken out of an entry by hand, that entry has to stop claiming it was
    // opened there.
    await router.replace({
      ...at,
      query: writes.replace as any,
      state: Object.assign({}, ...writes.removed.map(notOpenedHere)),
    });
  }
  if (writes.push) {
    await router.push({
      ...at,
      query: writes.push as any,
      state: Object.assign({}, ...writes.opening.map(openedHere)),
    });
  }
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
    writeQuery({
      scope: next.scope === "public" ? null : next.scope,
      sort: next.sort === "top" ? null : next.sort,
      q: next.search,
      type: next.types.join(","),
      side: next.sides.join(","),
      tech: next.techniques.join(","),
      str: next.strengths.join(","),
      tag: next.tags.join(","),
    });
  },
});

const lineups = ref<UtilityLineup[]>([]);
const loading = ref(true);

// Changing scope, sorting or paging re-queries a list you are already reading.
// Blanking it to four grey boxes and back is two layout changes to watch for
// one click, so a refetch keeps its rows and dims them; only the first fill of
// the column, and a change of map, are drawn as shapes.
const {
  skeleton: listSkeleton,
  refreshing: listRefreshing,
  reset: resetListLoading,
} = useDeferredLoading(() => loading.value);

const totalCount = ref(0);

// Where you are in the list is part of where you are on the page. Reset is a
// delete rather than `page=1`, so the common case leaves no parameter behind.
const page = computed<number>({
  get: () => {
    const value = Number(getQueryString(route.query, "page"));
    return Number.isFinite(value) && value > 1 ? Math.floor(value) : 1;
  },
  set: (value) => writeQuery({ page: value > 1 ? String(value) : null }),
});
const perPage = 60;
const selectedId = ref<string | null>(null);
const hoveredId = ref<string | null>(null);
const practiceOpen = ref(false);

// The same session the top bar shows, so the page's button never disagrees
// with the chrome about whether a server exists.
const { session: practiceSession } = useUtilityPracticeSession();

const { isMobile } = useSidebar();
const forkOpen = ref(false);
type LineupRef = { id: string; name: string };
const forkLineup = ref<LineupRef | null>(null);
const archiveOpen = ref(false);
const archiveLineup = ref<LineupRef | null>(null);
const deleteOpen = ref(false);
const deleteLineup = ref<LineupRef | null>(null);

const LIST_TAB = "lineups";
const META_TAB = "meta";
const CREATE_TAB = "create";
const BLOCK_TAB = "block";
const PLAYBOOKS_TAB = "playbooks";
const PLAN_TAB = "plan";
const COLLECTIONS_TAB = "collections";

// Every key the strip can hold, including the two that never appear on it:
// this list is what `?tab=` is validated against, and it is deliberately the
// static set rather than the visible `listTabs` below. `listTabs` reads the
// active tab (to keep Meta on the strip while a map is still loading), so
// feeding it back in here would be a computed that depends on itself.
// Availability is enforced by the watcher on `listTabs` instead.
const ALL_TABS = [
  LIST_TAB,
  META_TAB,
  COLLECTIONS_TAB,
  PLAYBOOKS_TAB,
  PLAN_TAB,
  BLOCK_TAB,
  CREATE_TAB,
];
// Read through useRouteTab, written through the page's own writer, so picking
// a tab can share a navigation with whatever else that click changes.
const routeTab = useRouteTab({ defaultTab: LIST_TAB, tabs: ALL_TABS });
const listTab = computed<string>({
  get: () => routeTab.value,
  set: (tab) => {
    if (ALL_TABS.includes(tab)) {
      writeQuery({ tab: tab === LIST_TAB ? null : tab });
    }
  },
});

// A mined spot is an address, like a lineup: `?spot=<key>` is what a link to
// one looks like, and Back closes it.
const selectedMetaKey = computed<string | null>({
  get: () => getQueryString(route.query, "spot"),
  set: (key) =>
    writeQuery(
      { spot: key },
      key ? addressOpenMode(!!getQueryString(route.query, "spot")) : "replace",
    ),
});

function closeMetaSpot() {
  stepOutOf(router, "spot", () => (selectedMetaKey.value = null));
}
const hoveredMetaKey = ref<string | null>(null);
const createSeed = ref<UtilityMetaSpot | null>(null);

// The board belongs to the page and outlives every tab. A panel that needs to
// draw on it publishes `UtilityPanelBoard` instead of mounting a second board --
// inside a 400px rail a second map does not fit beside anything, it lands on
// top of it.
const panelBoard = ref<UtilityPanelBoard | null>(null);

// The board's zoom row lives in the page header, beside the map's name.
const board = ref<InstanceType<typeof UtilityRadarBoard> | null>(null);

// Picked off the maps index, the board is the tile you picked, grown: it opens
// on the radar the tile was showing and comes out of where the tile was, and
// the rest of the page fades in around it. Going back hands the index the
// board's own place, so the tile shrinks out of it the same way.
const arrival = arriveUtilityPage("index", mapName.value);
const arriving = ref(!!arrival);

onBeforeRouteLeave((to) => {
  if (to.name === "utility") {
    leaveUtilityPage("map", mapName.value, restingRect(board.value?.viewport));
  }
});

function toggleCallouts() {
  if (board.value) {
    board.value.showCallouts = !board.value.showCallouts;
  }
}

// Where views opened over the card draw: the tabs' own, and above them what
// can open over any tab.
const {
  base: cardViews,
  top: cardViewsTop,
  stage: cardStage,
  staged,
} = provideUtilityCardViews();

// What the tab on screen tells the page about itself. A collection, an execute
// or a picker opened inside a tab draws over the card; while one is, the list
// under it steps back the way it does for a lineup.
const panelCover = ref(false);

// What the bar at the foot of the card offers, asked of whatever is on top:
// the open lineup, then the open spot, then the tab's own view, then the tab.
const detailBar = ref<UtilityBarOffer | null>(null);
const spotBar = ref<UtilityBarOffer | null>(null);
const panelBar = ref<UtilityBarOffer | null>(null);

function setDetailBar(offer: UtilityBarOffer | null) {
  detailBar.value = offer;
}

// The plan's queue by type, for the strip the page draws above it.
const panelTypeCounts = ref<Partial<Record<UtilityType, number>> | null>(null);

// The first entry of the plan's queue, which the practice bar offers to load.
type PlanEntry = {
  id: string;
  lineup: UtilityLineup;
  context: UtilityLineupContext;
};
const planNext = ref<PlanEntry | null>(null);
const planPanel = ref<{
  after: (id: string) => { id: string; context: UtilityLineupContext } | null;
} | null>(null);

// A tab you leave must not carry its answers to the next one.
watch(listTab, () => {
  panelCover.value = false;
  panelTypeCounts.value = null;
  planNext.value = null;
  panelBar.value = null;
});

// The list draws its own empty state with the add action inside it, so while
// the shelf is bare the button under it would be the same offer twice.
const secondaryHidden = computed(
  () => listTab.value === LIST_TAB && !loading.value && !lineups.value.length,
);

const metaSpots = ref<UtilityMetaSpot[]>([]);
const metaLoaded = ref(false);

// The overlay is a state of the board, not a preference: with it on, the rings
// are most of what you are looking at, and a refresh that silently turns them
// off looks like the map lost its data.
const showMeta = computed<boolean>({
  get: () => getQueryString(route.query, "meta") === "1",
  set: (value) => writeQuery({ meta: value ? "1" : null }),
});

// Distinct players, not throws, so the floor cannot be met by one person
// repeating a spot. Ten is enough to mean "people do this here" while cutting
// the long tail of one- and two-player habits that made the overlay unreadable.
const META_DEFAULT_THROWERS = 10;
const metaMinThrowers = computed<number>({
  get: () => {
    const value = Number(getQueryString(route.query, "minThrowers"));
    return Number.isFinite(value) && value > 0
      ? Math.floor(value)
      : META_DEFAULT_THROWERS;
  },
  set: (value) =>
    writeQuery({
      minThrowers:
        value && value !== META_DEFAULT_THROWERS ? String(value) : null,
    }),
});

const metaThresholdOptions = computed(() => [
  { key: "10", label: "10+" },
  { key: "25", label: "25+" },
  { key: "50", label: "50+" },
  { key: "100", label: "100+" },
]);

const metaThresholdModel = computed<string>({
  get: () => String(metaMinThrowers.value),
  set: (value) => {
    metaMinThrowers.value = Number(value) || 0;
  },
});

// Which spots the Meta tab lists: all of them, the ones nobody has written up,
// or the ones somebody has. It is the tab's own filter, so the overlay on the
// other tabs ignores it.
const metaScope = computed<UtilityMetaScope>({
  get: () => {
    const value = getQueryString(route.query, "metaScope");
    return value === "unwritten" || value === "written" ? value : "all";
  },
  set: (value) => writeQuery({ metaScope: value === "all" ? null : value }),
});

// Everything that clears the floor, on the side being looked at. A spot with
// no side recorded is not evidence that it is the wrong side, so it survives a
// side filter rather than being hidden by a gap in the mined data.
const thresholdMetaSpots = computed(() =>
  metaSpots.value.filter(
    (spot) =>
      spot.throwers >= metaMinThrowers.value &&
      !(
        filters.value.sides.length &&
        spot.side &&
        !filters.value.sides.includes(spot.side)
      ),
  ),
);

// How many lineups YOU can open sit in each cluster. The meta's own count
// includes private and archived ones, so a spot it calls written can have
// nothing in it for the person looking -- and to them that spot is unwritten.
// Until this has answered, the server's count stands in.
const lineupBuckets = ref<Record<string, number> | null>(null);

function writtenInSpot(spot: UtilityMetaSpot) {
  return lineupBuckets.value
    ? (lineupBuckets.value[spot.key] ?? 0)
    : spot.lineups;
}

function isWrittenSpot(spot: UtilityMetaSpot) {
  return writtenInSpot(spot) > 0;
}

const metaScopeCounts = computed(() => {
  const written = thresholdMetaSpots.value.filter(isWrittenSpot).length;
  return {
    all: thresholdMetaSpots.value.length,
    written,
    unwritten: thresholdMetaSpots.value.length - written,
  };
});

const scopedMetaSpots = computed(() => {
  if (listTab.value !== META_TAB || metaScope.value === "all") {
    return thresholdMetaSpots.value;
  }
  const written = metaScope.value === "written";
  return thresholdMetaSpots.value.filter(
    (spot) => isWrittenSpot(spot) === written,
  );
});

// The type chips sit directly over these rings, so they narrow the rings too:
// the same chips must not mean two things depending on which tab you are on.
const visibleMetaSpots = computed(() =>
  scopedMetaSpots.value.filter(
    (spot) =>
      !filters.value.types.length ||
      filters.value.types.includes(spot.utilityType),
  ),
);

// The plan is ranked against the caller's own drill record, so there is nothing
// to show a signed-out visitor. Meta is only a tab once the map has mined data.
const listTabs = computed(() => {
  // Every tab carries a title, because on a narrow board the strip collapses to
  // its icons and the label stops being there to read.
  const tabs: Array<{
    key: string;
    label: string;
    title?: string;
    desc?: string;
    count?: number;
    icon?: unknown;
  }> = [
    {
      key: LIST_TAB,
      label: t("pages.utility.lineups"),
      title: t("pages.utility.lineups"),
      icon: Rows3,
    },
  ];
  // Present while it has spots -- or while you are standing on it and the map
  // you just switched to has not answered yet. Without the second clause the
  // tab is briefly not in this list, and the watcher below reads that as "the
  // tab you are on is gone" and moves you to Lineups.
  if (metaSpots.value.length || (!metaLoaded.value && listTab.value === META_TAB)) {
    tabs.push({
      key: META_TAB,
      label: t("pages.utility.views.meta_tab"),
      title: t("pages.utility.views.meta_tab"),
      desc: t("pages.utility.views.meta_hint"),
      icon: UtilityMetaIcon,
    });
  }
  // Collections had nowhere to be looked at: you could add a lineup to one from
  // three dialogs and then never see it again. This is the missing half.
  // Collections, executes and the plan are all things you own, so a signed-out
  // visitor gets the library and the meta and nothing that needs an account.
  // Block is built but not ready to ship, so it stays off the strip. Everything
  // behind BLOCK_TAB is left wired up for when it is.
  if (mySteamId.value) {
    tabs.push({
      key: COLLECTIONS_TAB,
      label: t("pages.utility.collections.tab"),
      title: t("pages.utility.collections.tab"),
      desc: t("pages.utility.collections.hint"),
      icon: Library,
    });
    tabs.push({
      key: PLAYBOOKS_TAB,
      label: t("pages.utility.views.playbooks_tab"),
      title: t("pages.utility.views.playbooks_tab"),
      desc: t("pages.utility.views.playbooks_hint"),
      icon: ListOrdered,
    });
    tabs.push({
      key: PLAN_TAB,
      label: t("pages.utility.plan.tab"),
      title: t("pages.utility.plan.tab"),
      desc: t("pages.utility.plan.description"),
      icon: ClipboardCheck,
    });
  }
  // Authoring is an action, not a view. It never joins the strip — a tab that
  // appears on click makes the whole bar jump. AnimatedFilters drops its
  // indicator when nothing matches, which is the honest state: you are not in
  // any of these views.
  return tabs;
});

const showPlan = computed(
  () => listTab.value === PLAN_TAB && !!mySteamId.value,
);

// The type filter, in one place for every tab that lists throws: a strip of
// chips under the tabs, over a list cut into those same types. A chip and its
// section header are the same switch.
function toggleType(type: UtilityType) {
  const types = filters.value.types.includes(type)
    ? filters.value.types.filter((entry) => entry !== type)
    : [...filters.value.types, type];
  filters.value = { ...filters.value, types };
}

// Meta counts the spots the threshold, the side filter and the scope leave
// standing -- everything the list would show if no type were picked.
const metaTypeCounts = computed(() => {
  const tally: Partial<Record<UtilityType, number>> = {};
  for (const spot of scopedMetaSpots.value) {
    tally[spot.utilityType] = (tally[spot.utilityType] ?? 0) + 1;
  }
  return tally;
});

const typeCounts = computed(() => {
  if (listTab.value === META_TAB) {
    return metaTypeCounts.value;
  }
  if (listTab.value === PLAN_TAB) {
    return panelTypeCounts.value;
  }
  return lineupTypeCounts.value;
});

// Whether the tab on screen is a list of throws the type filter narrows.
const typeFilterApplies = computed(
  () =>
    listTab.value === LIST_TAB ||
    showMetaPanel.value ||
    (showPlan.value && !!panelTypeCounts.value),
);

// Only where there is a list of throws under it. Not on a phone: the sheet is
// too short to give the filter a row, so there it rides in the Filters menu.
const typeStripOpen = computed(
  () => !isMobile.value && typeFilterApplies.value,
);

// The list as it is drawn: each type's heading, then its rows, in the app's
// usual type order. The rows keep the order the sort gave them.
type ListEntry =
  | { kind: "header"; key: string; type: UtilityType; count: number }
  | { kind: "row"; key: string; lineup: UtilityLineup };

const listEntries = computed<ListEntry[]>(() => {
  const out: ListEntry[] = [];
  for (const type of UTILITY_TYPES) {
    const rows = lineups.value.filter((lineup) => lineup.utility_type === type);
    if (!rows.length) {
      continue;
    }
    out.push({
      kind: "header",
      key: `type-${type}`,
      type,
      count: lineupTypeCounts.value?.[type] ?? rows.length,
    });
    for (const lineup of rows) {
      out.push({ kind: "row", key: lineup.id, lineup });
    }
  }
  return out;
});

// Section headings pin under the list's own controls, which change height with
// the tab and the filters in them.
const listHead = ref<HTMLElement | null>(null);
const { height: listHeadHeight } = useElementSize(listHead, undefined, {
  box: "border-box",
});
/**
 * Controls that exist only because this map has mined spots. Between two maps
 * we do not yet know whether the next one does, and blinking them out and back
 * on every switch is the switch drawing attention to its own plumbing -- so
 * they hold their place through the wait, but only for someone who has the
 * overlay on and would notice them leave. A first page load still gets the
 * honest answer: nothing appears until the query says it should.
 */
const metaControlsHeld = computed(
  () => metaSpots.value.length > 0 || (!metaLoaded.value && showMeta.value),
);

const showMetaPanel = computed(
  () =>
    listTab.value === META_TAB &&
    (metaSpots.value.length > 0 || !metaLoaded.value),
);
const showCreatePanel = computed(
  () => listTab.value === CREATE_TAB && !!mySteamId.value,
);
const showBlockPanel = computed(() => listTab.value === BLOCK_TAB);

const showPlaybooks = computed(() => listTab.value === PLAYBOOKS_TAB);

/**
 * One primary action -- Practice, true on every tab -- and one slot that belongs
 * to the tab you are on. The header used to pin "Add a Lineup" above every view
 * and then let Executes add a second amber button beside it, which wrapped onto
 * its own row and competed with Practice for the same job.
 */
const secondaryAction = computed(() => {
  if (!mySteamId.value) {
    return null;
  }
  if (listTab.value === CREATE_TAB) {
    return {
      key: "cancel",
      icon: X,
      label: t("common.cancel"),
      run: () => {
        createSeed.value = null;
        listTab.value = LIST_TAB;
      },
    };
  }
  if (listTab.value === LIST_TAB || listTab.value === META_TAB) {
    return {
      key: "create",
      icon: Plus,
      label: t("pages.utility.create.action"),
      run: () => {
        createSeed.value = null;
        listTab.value = CREATE_TAB;
      },
    };
  }
  // Collections and executes keep New beside their own controls, Block draws
  // its own search, and the plan is a ranking rather than something you add
  // to. None of them gets a second button down here.
  return null;
});

// The legend doubles as the type filter, so it belongs on every view whose
// board is the library. Executes and the plan read their own lists but leave
// the board on the filtered lineups, so hiding the chips there only took the
// control away -- the filter was still doing its work. The author panel drives
// the board itself, so it is the one view that keeps them off.
const boardFiltersApply = computed(() => listTab.value !== CREATE_TAB);

// A tab that stops driving the board must hand it back, or its markers outlive
// the panel that drew them.
watch(listTab, () => {
  panelBoard.value = null;
});

// Straight into the lineup it just wrote: the author's next question is always
// whether it looks right on the board.
// Straight into the author with the cluster's own numbers already in the form:
// the point of a mined spot nobody has written up is that the hard part --
// where to stand and where to look -- is already known.
function writeUpMetaSpot(spot: UtilityMetaSpot) {
  createSeed.value = spot;
  selectedMetaKey.value = null;
  listTab.value = CREATE_TAB;
}

function onLineupCreated(id: string) {
  createdHere.add(id);
  createSeed.value = null;
  listTab.value = LIST_TAB;
  void fetchLineups();
  openLineup(id);
}

// Clicking a ring -- or a row on the Meta tab -- is a question about that
// spot, and whichever tab you asked it from, the answer opens over the card
// the way a lineup does. Looked up in everything mined rather than in what the
// threshold leaves, so a link to a spot still opens it when your floor is
// higher than the one it was copied under.
const selectedMetaSpot = computed(
  () =>
    (selectedMetaKey.value
      ? (metaSpots.value.find((spot) => spot.key === selectedMetaKey.value) ??
        null)
      : null),
);

// Turning the overlay off takes the rings off the map, and a spot left open
// would be answering a question about a ring that is no longer there -- unless
// the Meta tab is the thing holding it.
watch([showMeta, showMetaPanel], ([on, panel]) => {
  if (!on && !panel) {
    selectedMetaKey.value = null;
  }
});

// The overlay toggle is for reading the meta *against* the library; the Meta
// tab is the meta itself, so it draws the clusters whatever the toggle says.
// The spot that is open is always drawn, whatever filtered it out.
const metaOnBoard = computed(() => {
  const list =
    showMetaPanel.value || showMeta.value ? visibleMetaSpots.value : [];
  const open = selectedMetaSpot.value;
  return open && !list.some((spot) => spot.key === open.key)
    ? [...list, open]
    : list;
});

// A tab that disappears (meta drains, sign-out) must not strand the panel on a
// key nothing renders -- and now that the key is in the URL it has to be
// corrected there too, or the refresh puts you straight back on the tab that
// was not there.
//
// Immediate, because a link to a tab you cannot see (?tab=plan, signed out) has
// to be caught on arrival rather than on the next change. It waits for the
// session check first: until that lands, "signed out" and "not asked yet" look
// identical, and bouncing on the second one would break every deep link into
// the plan for someone who IS signed in.
watch(
  [listTabs, () => auth.hasCheckedSession],
  ([tabs, checked]) => {
    if (
      checked &&
      listTab.value !== CREATE_TAB &&
      !tabs.some((tab) => tab.key === listTab.value)
    ) {
      listTab.value = LIST_TAB;
    }
  },
  { immediate: true },
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
  utilityLineupWhere(filters.value, {
    mapName: mapName.value,
    mySteamId: mySteamId.value,
    myTeamIds: myTeamIds.value,
  }),
);

// The same question with the type filter left out. The live pulse below asks
// this one, so the type strip can say how many of each type there are to narrow
// down to -- a count that shrank to the types already picked would be a count
// of nothing useful.
const whereAnyType = computed<Record<string, unknown>>(() =>
  utilityLineupWhere(
    { ...filters.value, types: [] },
    {
      mapName: mapName.value,
      mySteamId: mySteamId.value,
      myTeamIds: myTeamIds.value,
    },
  ),
);
const lineupTypeCounts = ref<Partial<Record<UtilityType, number>> | null>(null);

// The library, live. One light row per lineup in the filtered library: it is
// how the page notices that the list on screen has gone stale. A lineup saved from a practice server, a review approved somewhere
// else, an archive undone from its toast -- each used to wait for a reload,
// which made the page feel detached from the game it is about.
type PulseRow = {
  id: string;
  utility_type: UtilityType;
  land_x: number | string | null;
  land_y: number | string | null;
  land_z: number | string | null;
  name: string;
  visibility: string;
  archived_at: string | null;
  public_requested_at: string | null;
  preview_rendered_at: string | null;
  author_steam_id: string | number | null;
};

let pulseSub: { unsubscribe: () => void } | null = null;
let pulseSignature: string | null = null;
let pulseIds = new Set<string>();
let pulseRefetch: ReturnType<typeof setTimeout> | null = null;

// Lineups this page created itself. The author panel already opens what it
// just saved, so announcing it again as news would be noise.
const createdHere = new Set<string>();

function pulseKey(row: PulseRow) {
  return [
    row.id,
    row.name,
    row.visibility,
    row.archived_at,
    row.public_requested_at,
    row.preview_rendered_at,
    row.land_x,
    row.land_y,
    row.land_z,
  ].join("|");
}

function announceSaved(row: PulseRow) {
  toast({
    title: t("pages.utility.live.saved", { name: row.name }),
    action: h(
      ToastAction,
      {
        altText: t("pages.utility.live.show"),
        onClick: () => selectLineup(row.id),
      },
      () => t("pages.utility.live.show"),
    ),
  });
}

function onPulse(rows: PulseRow[]) {
  const tally: Partial<Record<UtilityType, number>> = {};
  for (const row of rows) {
    tally[row.utility_type] = (tally[row.utility_type] ?? 0) + 1;
  }
  lineupTypeCounts.value = tally;

  const signature = rows.map(pulseKey).sort().join(";");
  const ids = new Set(rows.map((row) => row.id));
  const first = pulseSignature === null;
  const changed = !first && signature !== pulseSignature;

  if (changed && mySteamId.value) {
    for (const row of rows) {
      if (
        !pulseIds.has(row.id) &&
        !createdHere.has(row.id) &&
        String(row.author_steam_id) === String(mySteamId.value)
      ) {
        announceSaved(row);
      }
    }
  }

  pulseSignature = signature;
  pulseIds = ids;

  // Coalesced: an execute saved from a practice server lands as five rows in
  // as many seconds, and that is one refetch, not five.
  if (changed) {
    if (pulseRefetch) {
      clearTimeout(pulseRefetch);
    }
    pulseRefetch = setTimeout(() => {
      pulseRefetch = null;
      void fetchLineups({ quiet: true });
      void fetchLineupBuckets();
    }, 400);
  }
}

function unsubscribePulse() {
  pulseSub?.unsubscribe();
  pulseSub = null;
  if (pulseRefetch) {
    clearTimeout(pulseRefetch);
    pulseRefetch = null;
  }
}

function subscribePulse() {
  unsubscribePulse();
  lineupTypeCounts.value = null;
  // A new question starts a new baseline: its first answer is what the list
  // query is fetching anyway, not a change to react to.
  pulseSignature = null;
  pulseIds = new Set();
  pulseSub = getGraphqlClient()
    .subscribe({
      query: utilityLibraryPulseSubscription,
      variables: { where: whereAnyType.value, limit: UTILITY_LANDINGS_LIMIT },
    })
    .subscribe({
      next: ({ data }: { data: any }) =>
        onPulse((data?.utility_lineups ?? []) as PulseRow[]),
      // Best effort, like the meta overlay: without it the list stops
      // updating itself, but the page still works.
      error: (error: unknown) => {
        console.error("[utility] library subscription error:", error);
      },
    });
}

watch(() => JSON.stringify(whereAnyType.value), subscribePulse, {
  immediate: true,
});
onBeforeUnmount(unsubscribePulse);

// Your own drill record on this map, live. Every throw in the practice server
// writes to it, and patching the cards from it means the hit rate and streak
// move while you are still in the game rather than the next time you reload.
let progressSub: { unsubscribe: () => void } | null = null;
const myProgress = ref<Map<string, UtilityLineupProgress>>(new Map());

function applyProgress() {
  if (!myProgress.value.size) {
    return;
  }
  let touched = false;
  const next = lineups.value.map((lineup) => {
    const row = myProgress.value.get(lineup.id);
    if (!row) {
      return lineup;
    }
    const current = lineup.progress?.[0];
    if (
      current &&
      current.attempts === row.attempts &&
      current.successes === row.successes &&
      current.mastered_at === row.mastered_at
    ) {
      return lineup;
    }
    touched = true;
    return { ...lineup, progress: [row] };
  });
  if (touched) {
    lineups.value = next;
  }
}

function subscribeProgress() {
  progressSub?.unsubscribe();
  progressSub = null;
  myProgress.value = new Map();
  if (!mySteamId.value || !mapName.value) {
    return;
  }
  progressSub = getGraphqlClient()
    .subscribe({
      query: myUtilityProgressSubscription,
      variables: { steam_id: mySteamId.value, map_name: mapName.value },
    })
    .subscribe({
      next: ({ data }: { data: any }) => {
        const rows = (data?.utility_lineup_progress ?? []) as UtilityLineupProgress[];
        myProgress.value = new Map(rows.map((row) => [row.utility_lineup_id, row]));
        applyProgress();
      },
      error: (error: unknown) => {
        console.error("[utility] progress subscription error:", error);
      },
    });
}

watch([mySteamId, mapName], subscribeProgress, { immediate: true });
onBeforeUnmount(() => progressSub?.unsubscribe());

// Declared above the scope-count subscription because it reads this, and that
// subscription is armed at setup: with the auth store already warm, the old
// ordering threw "Cannot access 'canReview' before initialization" and the
// page never mounted.
const canReview = computed(() =>
  useAuthStore().isRoleAbove(e_player_roles_enum.moderator),
);

// One count per scope tab, so "MINE" says how many are yours before you click
// it. Every other filter still applies -- the tabs count what you would get,
// not what exists.
const SCOPES = [
  "public",
  "mine",
  "team",
  "favorites",
  "archived",
  "pending",
] as const;

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

// A signed-out visitor only ever sees Public, so the other counts would be work
// spent on tabs they cannot press.
const countedScopes = computed(() =>
  mySteamId.value
    ? SCOPES.filter((scope) => scope !== "pending" || canReview.value)
    : ["public"],
);

/**
 * The tallies above the list, kept live.
 *
 * These are what a player reads to find out whether what they just did
 * registered -- a lineup saved, a submission put in the review queue -- and as
 * a one-shot query they only moved when something else happened to refetch
 * them, so the honest answer to "did it work" was to switch tabs and look
 * again. Subscribed rather than polled: the counts change when anybody's
 * lineup changes, not only when this player does something.
 *
 * One subscription per scope rather than one aliased six-in-one: Hasura only
 * accepts a single top level field in a subscription, so the aliased shape was
 * rejected wholesale -- every tab read 0 while the list beneath it showed rows.
 */
let scopeCountSubs: Array<{ unsubscribe: () => void }> = [];

function unsubscribeScopeCounts() {
  for (const sub of scopeCountSubs) {
    sub.unsubscribe();
  }
  scopeCountSubs = [];
}

function subscribeScopeCounts() {
  unsubscribeScopeCounts();

  const client = getGraphqlClient();

  for (const scope of countedScopes.value) {
    scopeCountSubs.push(
      client
        .subscribe({
          query: utilityScopeCountSubscription,
          variables: { where: scopeWheres.value[scope] },
        })
        .subscribe({
          next: ({ data }: { data: any }) => {
            scopeCounts.value = {
              ...scopeCounts.value,
              [scope]: data?.utility_lineups_aggregate?.aggregate?.count ?? 0,
            };
          },
          error: (error: unknown) => {
            console.error(`[utility] ${scope} count subscription error:`, error);
          },
        }),
    );
  }
}

// Serialised for the same reason the list query is: `scopeWheres` rebuilds its
// object on every query-string change, so watching it by reference would tear
// down and re-open six live aggregates every time the open lineup or the meta
// overlay moved. What the counts care about is whether the question changed.
const scopeCountsKey = computed(() =>
  JSON.stringify([countedScopes.value, scopeWheres.value]),
);

watch(scopeCountsKey, subscribeScopeCounts, { immediate: true });

onBeforeUnmount(unsubscribeScopeCounts);

const orderBy = computed(() =>
  filters.value.sort === "new"
    ? [{ created_at: order_by.desc }]
    : [{ upvotes: order_by.desc }],
);

let fetchId = 0;
// Quiet is the live path: the library changed under the list, so the rows are
// swapped in place rather than dimmed and redrawn -- a lineup appearing should
// not look like the page reloading.
async function fetchLineups({ quiet = false }: { quiet?: boolean } = {}) {
  const myFetch = ++fetchId;
  if (!quiet) {
    loading.value = true;
  }
  try {
    const client = getGraphqlClient();
    const [rows, counts] = await Promise.all([
      client.query({
        query: utilityLineupsQuery(),
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
    applyProgress();
  } catch (error) {
    // A quiet refetch that fails keeps what is on screen: it was right a
    // moment ago, and blanking it would be worse than leaving it a beat stale.
    if (myFetch === fetchId && !quiet) {
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

// Serialised, not watched by reference. `filters` rebuilds its object on every
// change to the query string, and so therefore does `where` -- so with the tab,
// the overlay, the meta threshold and the open lineup all living in the URL
// now, watching the objects meant re-running both queries every time any of
// them moved. What the list actually cares about is whether the *shape* of the
// question changed.
const listQueryKey = computed(() =>
  JSON.stringify([where.value, orderBy.value]),
);

watch(listQueryKey, () => {
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


// Best effort by design: the mined meta is a nice-to-have overlay, and a page
// full of lineups must still render if the aggregate is unavailable.
//
// Whether it has answered is load-bearing now that the page survives a map
// change: "this map has no mined spots" and "we have not asked yet" both look
// like an empty list, and the Meta tab exists or does not on the strength of
// that list. Told apart, standing on the Meta tab and switching maps keeps you
// there; conflated, the tab vanishes from under you mid-swap and the strip
// bounces you back to Lineups.
let metaFetch = 0;
async function fetchMeta() {
  const mine = ++metaFetch;
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
    if (mine !== metaFetch) {
      return;
    }
    metaSpots.value = toUtilityMetaSpots(
      ((data as any)?.utility_meta_lineups ?? []) as UtilityMetaLineup[],
    );
  } catch (error) {
    if (mine !== metaFetch) {
      return;
    }
    console.error("[utility] meta load error:", error);
    metaSpots.value = [];
  } finally {
    if (mine === metaFetch) {
      metaLoaded.value = true;
    }
  }
}

// Best effort, like the meta it annotates: without it the spots fall back to
// the server's own count of what is written.
let bucketFetch = 0;
async function fetchLineupBuckets() {
  const mine = ++bucketFetch;
  try {
    const { data } = await getGraphqlClient().query({
      query: utilityLineupBucketsQuery,
      variables: {
        where: {
          map_name: { _eq: mapName.value },
          archived_at: { _is_null: true },
        },
        limit: UTILITY_LANDINGS_LIMIT,
      },
      fetchPolicy: "network-only",
    });
    if (mine !== bucketFetch) {
      return;
    }
    const tally: Record<string, number> = {};
    for (const row of ((data as any)?.utility_lineups ?? []) as Array<{
      lineup_bucket: string | null;
    }>) {
      if (row.lineup_bucket) {
        tally[row.lineup_bucket] = (tally[row.lineup_bucket] ?? 0) + 1;
      }
    }
    lineupBuckets.value = tally;
  } catch (error) {
    if (mine === bucketFetch) {
      console.error("[utility] lineup buckets error:", error);
      lineupBuckets.value = null;
    }
  }
}

// The panel column, so a map switch can hold the height it already has.
const panelShell = ref<{ $el?: HTMLElement } | null>(null);
const reservedPanelHeight = ref<number | null>(null);

// Past this the column is taller than the screen and the shrink is happening
// whatever we do, so holding it only means a wall of shimmer on the way down.
const MAX_RESERVED_PANEL_PX = 640;

// Everything on this page is scoped to one map, and the page no longer unmounts
// between them -- so what a remount used to throw away has to be thrown away
// here instead. Markers, meta rings and the list clear on the spot, which is
// what lets the board dissolve into the next map with nothing stale drawn over
// it; the fetches below refill them. `where` also changes with the map, so the
// watcher on it resets the page and the selection and refires the queries.
watch(
  mapName,
  (_map, previous) => {
    // Measured before the list is cleared, while the outgoing answer is still
    // standing: the placeholder then comes in at exactly that height, so the
    // column moves once -- when the new map's lineups land -- instead of
    // spiking to three cards and dropping back. Only while the list is the
    // thing standing there; every other tab fills the same shell with a panel
    // of its own, and its height is not a promise about this one.
    const height =
      listTab.value === LIST_TAB
        ? (panelShell.value?.$el?.getBoundingClientRect().height ?? 0)
        : 0;
    reservedPanelHeight.value =
      height > 0 ? Math.min(height, MAX_RESERVED_PANEL_PX) : null;

    resetListLoading();
    lineups.value = [];
    totalCount.value = 0;
    metaSpots.value = [];
    metaLoaded.value = false;
    lineupBuckets.value = null;
    hoveredId.value = null;
    // Only on a change of map: the first run is the page arriving, possibly
    // by a link to a spot, and that spot belongs to this map.
    if (previous) {
      selectedMetaKey.value = null;
    }
    hoveredMetaKey.value = null;
    createSeed.value = null;
    panelBoard.value = null;
    void fetchMeta();
    void fetchLineupBuckets();
  },
  { immediate: true },
);

const metaBusiest = computed(() =>
  Math.max(0, ...metaSpots.value.map((spot) => spot.throwers)),
);

const metaSpotByLineup = computed(() => {
  const spots: Record<string, UtilityMetaSpot> = {};
  if (!metaSpots.value.length) {
    return spots;
  }
  for (const lineup of lineups.value) {
    const spot = matchUtilityMetaSpot(lineup, metaSpots.value);
    if (spot && spot.throwers > 0) {
      spots[lineup.id] = spot;
    }
  }
  return spots;
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

const reactions = useUtilityReactions();

/**
 * A lineup is an address, not a modal flag. `?lineup=<id>` is what a link to one
 * looks like now that the standalone page is gone: the dialog is driven by the
 * URL, so a link opens straight onto it and Back closes it.
 */
const detailId = computed<string | null>({
  get: () =>
    typeof route.query.lineup === "string" && route.query.lineup
      ? route.query.lineup
      : null,
  set: (id) => setDetailId(id, "replace"),
});

// Opening pushes so Back closes it; swapping one lineup for another replaces,
// or flipping past ten lineups would bury the page you came from.
function setDetailId(id: string | null, mode: "push" | "replace") {
  writeQuery({ lineup: id }, mode);
}

// Arrived at by link there is no entry of ours to step back to, and the
// lineup comes out of the address instead.
function closeDetail() {
  stepOutOf(router, "lineup", () => setDetailId(null, "replace"));
}

const detailOpen = computed<boolean>({
  get: () => !!detailId.value,
  set: (value) => {
    if (!value) {
      closeDetail();
    }
  },
});

// Where the open lineup was opened from, when that is somewhere other than
// the Lineups list: its panel says so, and the plan adds why it is queued.
const detailContext = ref<UtilityLineupContext | null>(null);

// Opening pushes so Back closes it; picking another lineup while one is open
// swaps it in place, so Back still lands on the list and not on the last one.
function openLineup(id: string, context?: UtilityLineupContext | null) {
  detailContext.value = context ?? null;
  setDetailId(id, addressOpenMode(!!detailId.value));
}

// The plan is a queue, so from one of its lineups there is a next one.
function skipFromDetail(id: string) {
  const next = planPanel.value?.after(id);
  if (next) {
    detailContext.value = next.context;
    setDetailId(next.id, "replace");
  }
}

// Reviewing, restoring and deleting all take the row out of the list you were
// reading, so the lineup closes first instead of turning into a fetched orphan.
function reviewFromDetail(id: string, approve: boolean) {
  closeDetail();
  void reviewPublic(id, approve);
}

function restoreFromDetail(id: string) {
  closeDetail();
  void restoreLineup(id);
}

function deleteFromDetail(id: string) {
  closeDetail();
  startDelete(id);
}

// The board follows the open lineup, and Back puts the list exactly where it
// was: the same scroll position, and on a phone the same sheet height. Opening
// a lineup there raises the sheet so there is room to read it; going back
// lowers it again if that is how you had it, so the map you were picking from
// is back in view with the row you picked still under your thumb.
const listScroller = ref<HTMLElement | null>(null);
const sheet = ref<InstanceType<typeof UtilityMobileSheet> | null>(null);
let listScrollTop = 0;

watch(
  detailId,
  (id) => {
    selectedId.value = id;
    if (!id) {
      detailContext.value = null;
    }
  },
  { immediate: true },
);

// Something is open over the list: a lineup, a meta spot, or a view one of
// the tabs opened. The same rule covers all of them.
const covered = computed(
  () => detailOpen.value || panelCover.value || !!selectedMetaSpot.value,
);

watch(covered, (on, was) => {
  if (on && !was) {
    listScrollTop = listScroller.value?.scrollTop ?? 0;
  } else if (!on && was) {
    nextTick(() => {
      if (listScroller.value) {
        listScroller.value.scrollTop = listScrollTop;
      }
    });
  }
});

// On a phone the sheet lies over the bottom of the map, so the board is told
// how much of it is under there and lets the map be moved out. Beside the
// map, as on a desktop, nothing is over it and nothing is measured.
const { cover: boardCover } = useMapCover({
  frame: () => board.value?.viewport,
  coveredFrom: () => (isMobile.value ? sheet.value?.top() : null),
});

// The sheet coming to rest somewhere new is when the open lineup is brought
// back into sight -- not a scroll or a resize, which the map only gives way
// to. A tick later, so the board has the new cover to clear.
watch(
  () => (isMobile.value ? sheet.value?.snap() : null),
  async (snap, was) => {
    if (snap && was && snap !== was) {
      await nextTick();
      board.value?.showSelected();
    }
  },
  { flush: "post" },
);

// Watched, not read once on mount: on a hard load the media query reports
// after the first paint, and a link straight to a lineup would find a desktop
// column where there is about to be a sheet.
watch(
  [() => covered.value && isMobile.value, sheet],
  ([held, instance]) => {
    if (held) {
      instance?.hold();
    } else {
      instance?.release();
    }
  },
  { flush: "post", immediate: true },
);

// Picking a tab means you want to see it, and the lineup, the spot and the
// server all sit over whatever the tab is showing -- so a tab switch put the
// new tab behind a panel that still covered it.
//
// Only what was open BEFORE the tab changed is closed. Saving a new lineup
// picks the Lineups tab and opens the lineup in one go, and that one has to
// survive the switch it arrived with.
watch(
  [listTab, detailId, selectedMetaKey],
  ([tab, lineup, spot], [previousTab, previousLineup, previousSpot]) => {
    if (tab === previousTab) {
      return;
    }
    practiceOpen.value = false;
    const patch: Record<string, string | null> = {};
    if (lineup && lineup === previousLineup) {
      patch.lineup = null;
    }
    if (spot && spot === previousSpot) {
      patch.spot = null;
    }
    if (Object.keys(patch).length) {
      writeQuery(patch);
    }
  },
);

// What the server panel should have ready when it opens: the lineup you were
// reading, the execute, or the collection it was opened from.
const practiceTarget = ref<UtilityPracticeTarget | null>(null);

function openPractice(target: UtilityPracticeTarget | null = null) {
  practiceTarget.value = target;
  practiceOpen.value = true;
}

// The drawer's handle. A drawer with no close button is closed by the thing
// drawers have: press the handle, or pull it down. Pulled past a short way and
// let go, it closes from where it was let go; short of that it settles back.
const drawerPull = ref(0);
const drawerPulling = ref(false);
let drawerPullFrom = 0;
const DRAWER_CLOSE_PX = 56;

function onDrawerGrab(event: PointerEvent) {
  drawerPulling.value = true;
  drawerPullFrom = event.clientY;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function onDrawerPull(event: PointerEvent) {
  if (drawerPulling.value) {
    drawerPull.value = Math.max(0, event.clientY - drawerPullFrom);
  }
}

function onDrawerRelease() {
  if (!drawerPulling.value) {
    return;
  }
  drawerPulling.value = false;
  // No travel at all is a press on the handle, which closes it too.
  if (drawerPull.value > DRAWER_CLOSE_PX || drawerPull.value < 4) {
    practiceOpen.value = false;
  } else {
    drawerPull.value = 0;
  }
}

watch(practiceOpen, (open) => {
  if (open) {
    drawerPull.value = 0;
  }
});

useBackDismiss(
  () => practiceOpen.value,
  () => (practiceOpen.value = false),
);

// "Practice next" on the plan: open the lineup and put it on the server. With
// a server on this map that is one command; with one elsewhere the host brings
// it over; with none, the first step is starting one.
const load = useUtilityLoad();

async function practiceNext() {
  const next = planNext.value;
  if (!next) {
    return;
  }
  openLineup(next.id, next.context);
  if (load.canLoad(mapName.value)) {
    await load.sendLineup(next.lineup);
  } else if (load.canSwitchTo(mapName.value)) {
    await load.switchMap(mapName.value, {
      key: next.id,
      name: next.lineup.name,
      lineup_id: next.id,
    });
  } else {
    openPractice({ lineupId: next.id });
  }
}

// The plan's one action is the head of its queue -- and only once there is a
// server to put it on. Before that the bar is just where one is started.
const planBar = computed<UtilityBarOffer | null>(() => {
  const next = showPlan.value ? planNext.value : null;
  if (!next || isMobile.value) {
    return null;
  }
  const reachable =
    load.canLoad(mapName.value) || load.canSwitchTo(mapName.value);
  return {
    target: { lineupId: next.id },
    title: t("pages.utility.plan.next_up", { name: next.lineup.name }),
    actions: reachable
      ? [
          {
            kind: "run",
            key: "plan-next",
            label: t("pages.utility.plan.practice_next"),
            run: practiceNext,
            loading: load.sending.value === next.id,
          },
        ]
      : [],
  };
});

const barOffer = computed<UtilityBarOffer | null>(() => {
  if (detailOpen.value) {
    return detailBar.value;
  }
  if (selectedMetaSpot.value) {
    return spotBar.value;
  }
  return panelBar.value ?? planBar.value;
});

// Started from the bar, the server opens with what you were looking at.
function togglePractice() {
  if (practiceOpen.value) {
    practiceOpen.value = false;
  } else {
    openPractice(barOffer.value?.target ?? null);
  }
}

// Fork and archive are asked for from inside the dialog; both open a dialog of
// their own, so the detail has to get out of the way first.
function forkFromDetail(id: string, name: string) {
  closeDetail();
  forkLineup.value = { id, name };
  forkOpen.value = true;
}

function archiveFromDetail(id: string, name: string) {
  closeDetail();
  archiveLineup.value = { id, name };
  archiveOpen.value = true;
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

  if (!(await reactions.toggleFavorite(lineup, steamId))) {
    patchLineup(id, before);
  }
}

// Restoring from the Archived scope drops the row for the same reason
// archiving drops it from the library: it no longer belongs to the list you
// are looking at.
async function restoreLineup(id: string) {
  try {
    await getGraphqlClient().mutate({
      mutation: archiveUtilityLineupMutation,
      variables: { id, archived_at: null },
    });
    lineups.value = lineups.value.filter((entry) => entry.id !== id);
    totalCount.value = Math.max(0, totalCount.value - 1);
    toast({ title: t("pages.utility.archive.restored") });
  } catch (error: any) {
    toast({
      title: t("pages.utility.archive.restore_failed"),
      description: error?.message,
      variant: "destructive",
    });
  }
}

// Telling someone the library is empty while three lineups sit one tab away is
// how the counts stop being believed. Offer the tabs that do have something.
const populatedElsewhere = computed(() =>
  SCOPES.filter(
    (scope) =>
      scope !== filters.value.scope &&
      (!!mySteamId.value || scope === "public") &&
      (scopeCounts.value[scope] ?? 0) > 0,
  ).map((scope) => ({ scope, count: scopeCounts.value[scope] ?? 0 })),
);


// Asking, not publishing. The table's trigger is what refuses a self-promotion,
// so this cannot be talked into more than a request.
async function requestPublic(id: string) {
  try {
    await getGraphqlClient().mutate({
      mutation: requestUtilityLineupPublicMutation,
      variables: { id, public_requested_at: new Date().toISOString() },
    });
    patchLineup(id, { public_requested_at: new Date().toISOString() });
    toast({ title: t("pages.utility.publish.requested") });
  } catch (error: any) {
    toast({
      title: t("pages.utility.publish.request_failed"),
      description: error?.message,
      variant: "destructive",
    });
  }
}

async function reviewPublic(id: string, approve: boolean) {
  try {
    await getGraphqlClient().mutate({
      mutation: reviewUtilityLineupPublicMutation,
      variables: {
        id,
        visibility: approve ? "Public" : undefined,
        // Approving clears the request through the trigger; rejecting has to
        // clear it here, or the queue never empties.
        public_requested_at: approve ? undefined : null,
        public_review_note: null,
      },
    });
    lineups.value = lineups.value.filter((entry) => entry.id !== id);
    totalCount.value = Math.max(0, totalCount.value - 1);
    toast({
      title: approve
        ? t("pages.utility.publish.approved")
        : t("pages.utility.publish.rejected"),
    });
  } catch (error: any) {
    toast({
      title: t("pages.utility.publish.review_failed"),
      description: error?.message,
      variant: "destructive",
    });
  }
}

// The approval itself books the first render through the table's event
// trigger; this is the reviewer's re-run for one that came out wrong.
async function rerenderPreview(id: string) {
  try {
    const { data } = await getGraphqlClient().mutate({
      mutation: renderUtilityLineupPreviewMutation,
      variables: { utility_lineup_id: id },
    });
    const result = (data as any)?.renderUtilityLineupPreview;
    toast({
      title: result?.success
        ? t("pages.utility.render_queue.requeued")
        : t("pages.utility.render_queue.not_requeued"),
      description: result?.reason ?? undefined,
      variant: result?.success ? undefined : "destructive",
    });
  } catch (error: any) {
    toast({
      title: t("pages.utility.render_queue.not_requeued"),
      description: error?.message,
      variant: "destructive",
    });
  }
}

function startDelete(id: string) {
  deleteLineup.value = lineups.value.find((entry) => entry.id === id) ?? null;
  deleteOpen.value = !!deleteLineup.value;
}

// Dropped from the list on the spot rather than after a refetch: the row is
// gone either way, and waiting a round trip to admit it makes the click feel
// like it missed. The undo in the toast puts it back.
function onDeleted(id: string) {
  onArchived(id);
}

function onArchived(id: string) {
  lineups.value = lineups.value.filter((entry) => entry.id !== id);
  totalCount.value = Math.max(0, totalCount.value - 1);

  if (selectedId.value === id) {
    selectedId.value = null;
  }
}

// Escape peels back one layer at a time, innermost first: the meta ring you
// picked, then the selected lineup, then the spot popover it was picked from. Dialogs handle
// their own Escape, and a key pressed while typing belongs to the field.
function closeTopLayer(event: KeyboardEvent) {
  if (event.key !== "Escape" || escapeTaken(event)) {
    return;
  }
  const target = event.target instanceof Element ? event.target : null;
  if (
    practiceOpen.value &&
    !target?.closest("input, textarea, select, [contenteditable='true']") &&
    !document.querySelector(
      "[role='dialog'][data-state='open'], [role='menu'], [role='listbox']",
    )
  ) {
    practiceOpen.value = false;
    takeEscape(event);
    return;
  }
  if (
    target?.closest("input, textarea, select, [contenteditable='true']") ||
    document.querySelector("[role='dialog'][data-state='open']")
  ) {
    return;
  }
  // A spot, a collection or an execute opened over the card answers Escape
  // itself; all that is left here is a marker highlighted from the list.
  if (!selectedId.value || covered.value) {
    return;
  }
  selectedId.value = null;
  takeEscape(event);
}

onMounted(() => {
  if (arrival?.rect) {
    morphFromRect(board.value?.viewport, arrival.rect);
  }
  if (arriving.value) {
    window.setTimeout(() => (arriving.value = false), 600);
  }
  window.addEventListener("keydown", closeTopLayer);
});
onBeforeUnmount(() => window.removeEventListener("keydown", closeTopLayer));

// A marker is the lineup: clicking one opens it. A click on the bare map
// clears a highlight but never closes an open lineup -- that same click is how
// a fanned-out cluster gets folded away.
function selectLineup(id: string | null) {
  if (id) {
    openLineup(id);
  } else if (!detailId.value) {
    selectedId.value = null;
  }
}
</script>

<template>
  <PageTransition :appear="!arrival">
    <!-- The map on its own, and one card for everything else (the maps rail
         beside them belongs to the shell, `pages/utility.vue`, so it does not
         move or redraw when the map or the page under it changes):
         the tabs on top, the list under them, the lineup and the practice
         server sliding out over that list, and the server's bar at the foot.
         On a phone the card is a sheet over the map. -->
    <div
      class="grid w-full gap-4 md:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] lg:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)]"
      :class="isMobile ? 'pb-[40svh]' : ''"
    >

      <!-- Capped at the map's own size, so the control row above fits the
           window with it and shares its edges. -->
      <div
        class="relative mx-auto w-full min-w-0 max-w-[min(1000px,calc(100dvh-var(--header-height,4rem)-5rem))] md:sticky md:top-4 md:flex md:min-h-[calc(100dvh-var(--header-height,4rem)-2rem)] md:flex-col md:self-start"
      >
        <!-- Centred on the line the rail is, when the window is taller than
             the map needs. Auto margins rather than justify-center: they fall
             to zero instead of pushing the top off-screen when it is not. -->
        <div class="md:my-auto">
        <UtilityMapRail :map-name="mapName" horizontal class="mb-3 lg:hidden" />

        <div
          class="flex min-h-11 items-center gap-2.5 px-1 pb-2"
          :class="arriving ? 'utility-arrive' : ''"
        >
          <!-- The rail's lit emblem already says which map this is. -->
          <h1 class="sr-only">{{ cleanMapName(mapName) }}</h1>
          <div
            v-if="board?.ready && !staged"
            class="ml-auto flex shrink-0 items-center gap-2"
          >
            <!-- Everything that changes what the map draws lives in this one
                 row: what the pros throw, the callout names, the zoom. The
                 meta controls used to sit under the map with a legend, a
                 second place to look for the same kind of thing.

                 The threshold is only worth offering once the overlay is on:
                 it is the knob that decides how much of the mined tail lands
                 on the board. It unfolds from the toggle it belongs to. -->
            <template
              v-if="boardFiltersApply && (metaControlsHeld || showMetaPanel)"
            >
              <Transition
                enter-active-class="transition-[opacity,transform] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
                leave-active-class="transition-[opacity,transform] [transition-duration:110ms] ease-in motion-reduce:![transition-duration:1ms]"
                enter-from-class="translate-x-2 opacity-0"
                leave-to-class="translate-x-2 opacity-0"
              >
                <FiveStackToolTip
                  v-if="showMeta || showMetaPanel"
                  as-child
                  side="bottom"
                  :delay-duration="120"
                  :tap-toggle="false"
                >
                  <template #trigger>
                    <AnimatedFilters
                      v-model="metaThresholdModel"
                      :options="metaThresholdOptions"
                      square
                      class="shrink-0"
                      :aria-label="$t('pages.utility.meta.min_throwers')"
                    />
                  </template>
                  {{ $t("pages.utility.meta.min_throwers") }}
                </FiveStackToolTip>
              </Transition>
              <FiveStackToolTip
                as-child
                side="bottom"
                :delay-duration="120"
                :tap-toggle="false"
              >
                <template #trigger>
                  <!-- On the Meta tab the rings are the tab, so the switch is
                       lit and stays that way: there is nothing to turn off. -->
                  <Button
                    size="icon-sm"
                    variant="outline"
                    :class="[
                      showMeta || showMetaPanel
                        ? 'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))] hover:!bg-[hsl(var(--tac-amber)/0.18)]'
                        : 'border-white/10',
                      showMetaPanel ? 'cursor-default' : '',
                    ]"
                    :aria-label="$t('pages.utility.meta.overlay')"
                    :aria-pressed="showMeta || showMetaPanel"
                    :aria-disabled="showMetaPanel || undefined"
                    @click="showMetaPanel || (showMeta = !showMeta)"
                  >
                    <UtilityMetaIcon class="h-4 w-4" />
                  </Button>
                </template>
                {{ $t("pages.utility.meta.overlay") }}
                <!-- The count waits for the query rather than printing 0/0. -->
                <span
                  v-if="(showMeta || showMetaPanel) && metaLoaded"
                  class="tabular-nums text-muted-foreground"
                >
                  · {{ visibleMetaSpots.length }}/{{ metaSpots.length }}
                </span>
              </FiveStackToolTip>
            </template>
            <FiveStackToolTip
              v-if="board.hasCallouts"
              as-child
              side="bottom"
              :delay-duration="120"
              :tap-toggle="false"
            >
              <template #trigger>
                <Button
                  size="icon-sm"
                  variant="outline"
                  :class="
                    board.showCallouts
                      ? 'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))] hover:!bg-[hsl(var(--tac-amber)/0.18)]'
                      : 'border-white/10'
                  "
                  :aria-label="$t('pages.utility.board.callouts_tip')"
                  :aria-pressed="board.showCallouts"
                  @click="toggleCallouts"
                >
                  <Tags class="h-4 w-4" />
                </Button>
              </template>
              {{ $t("pages.utility.board.callouts_tip") }}
            </FiveStackToolTip>
            <div
              class="flex h-8 items-center overflow-hidden rounded-md border border-white/10"
            >
              <FiveStackToolTip
                v-for="(control, index) of [
                  { icon: Minus, label: 'zoom_out', run: board.zoomOut, disabled: !board.canZoomOut },
                  { icon: Plus, label: 'zoom_in', run: board.zoomIn, disabled: !board.canZoomIn },
                  { icon: Maximize2, label: 'zoom_reset', run: board.resetZoom, disabled: !board.canZoomOut },
                ]"
                :key="control.label"
                as-child
                side="bottom"
                :delay-duration="120"
                :tap-toggle="false"
              >
                <template #trigger>
                  <button
                    type="button"
                    class="grid h-full w-8 place-items-center text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70 disabled:pointer-events-none disabled:opacity-30"
                    :class="index > 0 ? 'border-l border-white/10' : ''"
                    :disabled="control.disabled"
                    :aria-label="$t(`pages.utility.board.${control.label}`)"
                    @click="control.run()"
                  >
                    <component :is="control.icon" class="h-4 w-4" />
                  </button>
                </template>
                {{ $t(`pages.utility.board.${control.label}`) }}
              </FiveStackToolTip>
            </div>
          </div>
        </div>

        <!-- The stage sits on the board's own square: what a view puts there
             -- an execute thrown in 3D -- takes the map's place at the map's
             size, and leaves it as it was. -->
        <div class="relative">
        <UtilityRadarBoard
          ref="board"
          class="!rounded-none !border-0 !bg-transparent"
          :controls="false"
          peek
          :cover="boardCover"
          :seed-src="arrival?.src"
          :map-name="mapName"
          :lineups="panelBoard?.lineups ?? lineups"
          :selected-id="panelBoard ? (panelBoard.selectedId ?? null) : selectedId"
          :hovered-id="panelBoard ? (panelBoard.hoveredId ?? null) : hoveredId"
          :meta-spots="metaOnBoard"
          :selected-meta-key="selectedMetaKey"
          :hovered-meta-key="hoveredMetaKey"
          :meta-interactive="showMetaPanel || showMeta"
          :picking="!!panelBoard?.picking"
          :pick-z="panelBoard?.pickZ ?? 0"
          :markers="panelBoard?.markers ?? []"
          :segments="panelBoard?.segments ?? []"
          :selected-segment-key="panelBoard?.selectedSegmentKey ?? null"
          :show-all-lines="!!panelBoard?.showAllLines"
          @select="
            (id) =>
              panelBoard?.onSelect ? panelBoard.onSelect(id) : selectLineup(id)
          "
          @hover="
            (id) =>
              panelBoard?.onHover ? panelBoard.onHover(id) : (hoveredId = id)
          "
          @select-meta="(key) => (selectedMetaKey = key)"
          @hover-meta="(key) => (hoveredMetaKey = key)"
          @pick="(point) => panelBoard?.onPick?.(point)"
          @marker-grab="(key) => panelBoard?.onMarkerGrab?.(key)"
          @marker-drag="
            (key, point) => panelBoard?.onMarkerDrag?.(key, point)
          "
          @select-segment="(key) => panelBoard?.onSelectSegment?.(key)"
        />
        <div
          ref="cardStage"
          class="pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto aspect-square w-full max-w-[calc(100vh-12rem)]"
        />
        </div>
        </div>
      </div>

      <UtilityMobileSheet
        ref="sheet"
        :enabled="isMobile"
        :class="arriving ? 'utility-arrive' : ''"
        class="utility-card flex min-h-0 flex-col overflow-hidden md:sticky md:top-4 md:h-[calc(100dvh-var(--header-height,4rem)-2rem)] md:self-start md:rounded-2xl md:border md:border-white/[0.08] md:bg-sidebar md:shadow-[0_24px_48px_-16px_rgba(0,0,0,0.85)]"
      >
        <template #peek>
          <div
            v-if="typeFilterApplies"
            class="flex touch-pan-x gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>button]:h-11 [&>button]:text-[0.7rem]"
            role="group"
            :aria-label="$t('pages.utility.meta.types')"
          >
            <UtilityTypeChips
              :model-value="filters.types"
              :counts="typeCounts"
              fill
              @update:model-value="(types) => (filters = { ...filters, types })"
            />
          </div>
          <p
            v-else
            class="flex h-11 items-center justify-center font-mono text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted-foreground"
          >
            {{ listTabs.find((tab) => tab.key === listTab)?.label }}
          </p>
        </template>
        <div class="shrink-0 px-3 pt-3 max-md:pt-0">
          <AnimatedFilters
            v-model="listTab"
            :options="listTabs"
            square
            block
            collapse
          />
        </div>

        <!-- Everything under the tabs is one box that never changes size. A
             lineup, a spot or one of a tab's own views opens OVER the list
             and Back uncovers it again; nothing folds or leaves to make room,
             because anything that resizes while a panel slides reads as the
             panel growing or shrinking. The bar under it is not part of what
             they cover: it is the foot of the card whatever is open. -->
        <div class="relative flex min-h-0 flex-1 flex-col">
          <div class="relative flex min-h-0 flex-1 flex-col">
          <!-- The lineup pushes in over the list rather than landing on it: the
               list steps back the way the detail arrives, and comes forward
               again on Back, scrolled to where you left it. -->
          <div
            ref="listScroller"
            class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(1rem,env(safe-area-inset-bottom))] transition-[opacity,transform] motion-reduce:![transition-duration:1ms]"
            :class="
              covered
                ? 'pointer-events-none -translate-x-4 opacity-0 [transition-duration:110ms] ease-in'
                : '[transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]'
            "
            :inert="covered || undefined"
            :style="{ '--utility-list-head': `${listHeadHeight}px` }"
          >
            <!-- Whose lineups, and which of them: they steer the list, so they
                 stay put while it scrolls. -->
            <div
              ref="listHead"
              class="sticky top-0 z-20 bg-sidebar pb-2 pt-2 max-md:bg-background"
            >
              <!-- The type filter: the same row, in the same place, on every
                   tab that lists throws. Each chip says how many there are. -->
              <Fold :open="typeStripOpen">
                <div
                  class="flex gap-1 pb-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  role="group"
                  :aria-label="$t('pages.utility.meta.types')"
                >
                  <UtilityTypeChips
                    :model-value="filters.types"
                    :counts="typeCounts"
                    fill
                    @update:model-value="(types) => (filters = { ...filters, types })"
                  />
                </div>
              </Fold>
              <HeightSwap>
                <div
                  v-if="listTab === LIST_TAB"
                  key="list-controls"
                  class="flex w-0 min-w-full flex-col gap-2"
                >
                  <!-- Signed out, Public is the only scope there is, and a
                       switch with one position is not a choice. -->
                  <UtilityFilters
                    v-if="mySteamId"
                    v-model="filters"
                    :signed-in="!!mySteamId"
                    :has-team="myTeamIds.length > 0"
                    :scope-counts="scopeCounts"
                    :can-review="canReview"
                    :parts="['scope']"
                    bare
                  />
                  <div class="flex items-center gap-2">
                    <UtilityFilters
                      v-model="filters"
                      :available-tags="availableTags"
                      :signed-in="!!mySteamId"
                      :has-team="myTeamIds.length > 0"
                      :parts="['search', 'menu']"
                      :types-in-menu="isMobile"
                      :type-counts="typeCounts"
                      bare
                      class="min-w-0 flex-1 flex-nowrap [&>div:first-child]:max-w-none [&>div:first-child]:flex-1"
                    />
                  </div>
                </div>
              </HeightSwap>
            </div>

            <!-- w-0 + min-w-full: this contributes NOTHING to the column's
                 max-content width, so the track above sizes to the tab strip
                 alone, then this fills whatever that came out as. Without it a
                 single long lineup name would set the column width. -->
            <div class="flex w-0 min-w-full flex-col gap-2">
              <!-- A phone has no type strip, and only Lineups has a Filters
                   menu to put it in -- so on Meta and the plan the chips sit
                   here. -->
              <div
                v-if="isMobile && typeFilterApplies && listTab !== LIST_TAB"
                class="flex flex-wrap gap-1.5 pb-1"
              >
                <UtilityTypeChips
                  :model-value="filters.types"
                  :counts="typeCounts"
                  @update:model-value="(types) => (filters = { ...filters, types })"
                />
              </div>
              <!-- Every tab lands in the same slot, so switching tabs is a swap, not
                 a navigation: out-in, because two tabs hold completely different
                 content and crossfading them prints one over the other.

                 It measures, rather than just fading. Opacity-only was chosen so a
                 size tween could not freeze mid-flight while the incoming panel
                 fired its queries -- but the cost was that the column dropped to
                 zero height between the two halves, and the add button and pager
                 below it flew up 700px and back down on every tab click. The
                 panels now hold their placeholder for longer than this tween runs,
                 so the shell is back to auto before any of them changes size. -->
            <HeightSwap ref="panelShell">
              <UtilityPracticePlanPanel
                v-if="showPlan"
                key="plan"
                ref="planPanel"
                :map-name="mapName"
                :types="filters.types"
                :open-lineup-id="detailId"
                :progress="myProgress"
                @board="(state) => (panelBoard = state)"
                @toggle-type="toggleType"
                @open-lineup="openLineup"
                @type-counts="(counts) => (panelTypeCounts = counts)"
                @next="(entry) => (planNext = entry)"
              />

              <UtilityCollectionsPanel
                v-else-if="listTab === COLLECTIONS_TAB && mySteamId"
                key="collections"
                :map-name="mapName"
                :types="filters.types"
                :open-lineup-id="detailId"
                :can-practice="!isMobile"
                @board="(state) => (panelBoard = state)"
                @cover="(value) => (panelCover = value)"
                @bar="(offer) => (panelBar = offer)"
                @toggle-type="toggleType"
                @open-lineup="openLineup"
                @practice="openPractice"
              />

              <UtilityPlaybooksPanel
                v-else-if="showPlaybooks && mySteamId"
                key="playbooks"
                :map-name="mapName"
                :types="filters.types"
                :open-lineup-id="detailId"
                :can-practice="!isMobile"
                @board="(state) => (panelBoard = state)"
                @cover="(value) => (panelCover = value)"
                @bar="(offer) => (panelBar = offer)"
                @toggle-type="toggleType"
                @open-lineup="openLineup"
                @practice="openPractice"
              />

              <UtilityBlockPanel
                v-else-if="showBlockPanel"
                key="block"
                :map-name="mapName"
                :types="filters.types"
                :sides="filters.sides"
                @board="(state) => (panelBoard = state)"
                @open="openLineup"
              />

              <!-- Keyed on the map, unlike its neighbours. Every other panel takes
                   a map change as a refetch, but this one is holding points you
                   picked off the board: world coordinates that mean nothing on the
                   next map. It gets torn down and rebuilt rather than carried. -->
              <UtilityCreatePanel
                v-else-if="showCreatePanel"
                :key="`create-${mapName}`"
                :map-name="mapName"
                :seed="createSeed"
                @board="(state) => (panelBoard = state)"
                @created="onLineupCreated"
              />

              <UtilityMetaPanel
                v-else-if="showMetaPanel"
                key="meta"
                :loading="!metaLoaded"
                v-model:scope="metaScope"
                v-model:hovered-key="hoveredMetaKey"
                v-model:threshold="metaThresholdModel"
                :map-name="mapName"
                :threshold-options="metaThresholdOptions"
                :spots="scopedMetaSpots"
                :written="lineupBuckets"
                :busiest="Math.max(1, metaBusiest)"
                :types="filters.types"
                :scope-counts="metaScopeCounts"
                @toggle-type="toggleType"
                @open="(key) => (selectedMetaKey = key)"
              />

              <!-- Shaped like the rows they stand in for: a placeholder of a
                   different height makes the whole list jump when the rows
                   arrive, which reads as jank even though nothing moved twice. -->
              <UtilitySkeletonList
                v-else-if="listSkeleton"
                key="loading"
                :count="3"
                :fill="reservedPanelHeight"
                shape="row"
              />

              <UtilityEmpty
                v-else-if="!lineups.length"
                key="no-lineups"
                :title="$t('pages.utility.empty.no_lineups')"
                :description="$t('pages.utility.empty.no_lineups_description')"
              >
                <Button
                  v-if="mySteamId"
                  size="sm"
                  variant="outline"
                  class="border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.08)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.14)]"
                  @click="
                    createSeed = null;
                    listTab = CREATE_TAB;
                  "
                >
                  <Plus class="mr-1 h-4 w-4" />
                  {{ $t("pages.utility.create.action") }}
                </Button>

                <!-- Telling someone the library is empty while three lineups sit
                     one tab away is how the counts stop being believed. -->
                <template v-if="populatedElsewhere.length" #footer>
                  <Button
                    v-for="entry of populatedElsewhere"
                    :key="entry.scope"
                    size="sm"
                    variant="ghost"
                    class="h-7 text-xs"
                    @click="filters = { ...filters, scope: entry.scope }"
                  >
                    {{ $t(`pages.utility.scope.${entry.scope}`) }}
                    <span class="ml-1 opacity-60">{{ entry.count }}</span>
                  </Button>
                </template>
              </UtilityEmpty>

              <!-- A list that changes under you without moving is a list you have
                   to re-read. Filtering, archiving and paging all reorder this, so
                   the rows carry themselves to their new positions instead.

                   A leaver folds in place rather than going `position:absolute`:
                   an absolutely-positioned flex child takes its static position
                   from the container ORIGIN, so an archived card used to teleport
                   to the top of the list to die. The row gap rides inside the clip
                   (-mt on the container, pt inside each cell) so it collapses with
                   the row instead of leaving a hole. -->
              <TransitionGroup
                v-else
                key="list"
                tag="div"
                name="lrow"
                class="-mt-2 flex flex-col transition-opacity [transition-duration:180ms]"
                :class="listRefreshing ? 'pointer-events-none opacity-50' : ''"
              >
              <!-- Cut into types, each under a heading that pins while you
                   read its rows. The heading is the type's chip again: press
                   either to narrow the list and the map to that type. -->
              <div
                v-for="entry of listEntries"
                :key="entry.key"
                class="lrow"
                :class="
                  entry.kind === 'header'
                    ? 'sticky top-[var(--utility-list-head,0px)] z-10 bg-sidebar max-md:bg-background'
                    : ''
                "
              >
                <div class="min-h-0 overflow-hidden">
                <div v-if="entry.kind === 'header'" class="pt-2">
                  <UtilityTypeHeader
                    :type="entry.type"
                    :count="entry.count"
                    :active="filters.types.includes(entry.type)"
                    @toggle="toggleType(entry.type)"
                  />
                </div>
                <div v-else :id="`utility-card-${entry.lineup.id}`" class="pt-2">
                <!-- A click opens the lineup in the panel, where everything you can
                     do with it lives -- so the row carries no menu of its own. -->
                <UtilityLineupCard
                  :lineup="entry.lineup"
                  mode="row"
                  :menu="false"
                  :show-status="filters.scope !== 'public'"
                  :quiet-public="filters.scope === 'mine'"
                  :selected="selectedId === entry.lineup.id"
                  :hovered="hoveredId === entry.lineup.id"
                  :meta-throwers="metaSpotByLineup[entry.lineup.id]?.throwers ?? null"
                  :meta-throws="metaSpotByLineup[entry.lineup.id]?.throws ?? null"
                  :meta-busiest="metaBusiest"
                  :show-practice="!isMobile"
                  :can-review="canReview"
                  :can-react="!!mySteamId"
                  @select="openLineup"
                  @hover="(id) => (hoveredId = id)"
                  @review-public="reviewPublic"
                  @vote="onVote"
                  @favorite="onFavorite"
                />
                </div>
                </div>
              </div>
              </TransitionGroup>
            </HeightSwap>

            <!-- At the foot of the column, under whatever the tab is showing: an
                 add button belongs after the thing you are adding to, not above
                 it competing with the tab strip for the same corner. -->
            <button
              v-if="mySteamId && secondaryAction && !secondaryHidden"
              type="button"
              class="group flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border/70 py-2.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-[hsl(var(--tac-amber))]"
              @click="secondaryAction.run()"
            >
              <component :is="secondaryAction.icon" class="h-3.5 w-3.5" />
              {{ secondaryAction.label }}
            </button>

            <!-- Pages the list, so it belongs to the column the list is in -->
            <Pagination
              v-if="listTab === LIST_TAB && totalCount > perPage"
              :total="totalCount"
              :page="page"
              :per-page="perPage"
              @page="(value) => (page = value)"
            />
            </div>
          </div>

          <!-- Where the tabs' own views draw: a collection, an execute, the
               lists you pick lineups from. Above them, what can open over any
               tab -- a meta spot -- and above that, the lineup. -->
          <div ref="cardViews" class="contents" />
          <div ref="cardViewsTop" class="contents" />

          <UtilityMetaSpotView
            :spot="selectedMetaSpot"
            :map-name="mapName"
            :lineups="lineups"
            :busiest="Math.max(1, metaBusiest)"
            :signed-in="!!mySteamId"
            :can-practice="!!mySteamId && !isMobile"
            @back="closeMetaSpot"
            @open-lineup="openLineup"
            @write-up="writeUpMetaSpot"
            @bar="(offer) => (spotBar = offer)"
          />

          <UtilityLineupDetail
            v-model:open="detailOpen"
            :lineup-id="detailId"
            :lineups="lineups"
            :context="detailContext"
            :can-react="!!mySteamId"
            :can-practice="!isMobile && !!mySteamId"
            :can-review="canReview"
            @skip="skipFromDetail"
            @bar="setDetailBar"
            @vote="onVote"
            @favorite="onFavorite"
            @fork="forkFromDetail"
            @archive="archiveFromDetail"
            @updated="patchLineup"
            @request-public="requestPublic"
            @rerender-preview="rerenderPreview"
            @review-public="reviewFromDetail"
            @restore="restoreFromDetail"
            @delete="deleteFromDetail"
          />

          <!-- The server pulls up out of its bar, like a drawer out of the
               foot of the card. The bar does not move -- it is the handle,
               and the press that opened the drawer closes it without the
               pointer going anywhere -- and the drawer is only as tall as
               what is in it, so opening it is not the whole card changing.
               What is behind it steps back; a press there lets it down. -->
          <Transition name="drawer" :duration="{ enter: 280, leave: 180 }">
            <div
              v-show="practiceOpen"
              :data-utility-practice-open="practiceOpen || undefined"
              class="absolute inset-0 z-30 flex flex-col justify-end overflow-hidden"
            >
              <button
                type="button"
                tabindex="-1"
                aria-hidden="true"
                class="drawer-scrim absolute inset-0 cursor-default bg-black/60"
                @click="practiceOpen = false"
              />
              <!-- The panel travels inside this box and nowhere else. It ends
                   at the bar's top edge, so on its way up the panel is never
                   drawn over the bar or below it: it comes out of the bar.
                   The room above is for its shadow. -->
              <section
                class="relative flex min-h-0 flex-col overflow-hidden pt-8"
                :aria-label="$t('pages.utility.practice.title')"
              >
                <div
                  class="drawer-panel min-h-0 overflow-y-auto overscroll-contain rounded-t-xl border-t border-white/[0.1] bg-sidebar px-4 pb-4 shadow-[0_-14px_28px_-14px_rgba(0,0,0,0.9)]"
                  :class="drawerPulling ? '' : 'drawer-settle'"
                  :style="{ '--drawer-pull': `${drawerPull}px` }"
                >
                  <button
                    type="button"
                    class="group sticky top-0 z-10 -mx-4 flex h-7 w-[calc(100%+2rem)] cursor-grab touch-none items-center justify-center rounded-t-xl bg-sidebar focus-visible:outline-none active:cursor-grabbing"
                    :aria-label="$t('common.close')"
                    data-no-sheet-drag
                    @pointerdown="onDrawerGrab"
                    @pointermove="onDrawerPull"
                    @pointerup="onDrawerRelease"
                    @pointercancel="onDrawerRelease"
                    @keydown.enter.prevent="practiceOpen = false"
                    @keydown.space.prevent="practiceOpen = false"
                  >
                    <span
                      aria-hidden="true"
                      class="h-1 w-10 rounded-full bg-white/25 transition-colors duration-150 group-hover:bg-white/45 group-focus-visible:bg-white/70"
                    />
                  </button>
                  <UtilityPracticePanel
                    :active="practiceOpen"
                    :map-name="mapName"
                    :lineup-id="practiceTarget?.lineupId ?? selectedId"
                    :playbook-id="practiceTarget?.playbookId ?? null"
                    :collection-id="practiceTarget?.collectionId ?? null"
                    :join-invite-code="joinInviteCode"
                    @joined="practiceOpen = false"
                  />
                </div>
              </section>
            </div>
          </Transition>
          </div>

          <!-- The foot of the card, under the list and under whatever is open
               over it. It starts the server, and it carries what the thing
               above it is for: sending it to that server once you are in one,
               or the view's own main action. Signed out there is no server to
               have -- starting one, joining one and the list of them all need
               an account -- and a phone cannot join one, so there the bar is
               only ever a view's action. -->
          <UtilityPracticeBar
            v-if="mySteamId && (!isMobile || barOffer?.actions.length)"
            :map-name="mapName"
            :open="practiceOpen"
            :server="!isMobile"
            :offer="barOffer"
            @toggle="togglePractice"
          />
        </div>

      </UtilityMobileSheet>
    </div>
  </PageTransition>

  <UtilityForkDialog
    v-model:open="forkOpen"
    :lineup-id="forkLineup?.id ?? null"
    :source-name="forkLineup?.name ?? null"
    :map-name="mapName"
  />

  <UtilityArchiveDialog
    v-model:open="archiveOpen"
    :lineup-id="archiveLineup?.id ?? null"
    :lineup-name="archiveLineup?.name ?? null"
    @archived="onArchived"
  />

  <UtilityDeleteDialog
    v-model:open="deleteOpen"
    :lineup-id="deleteLineup?.id ?? null"
    :lineup-name="deleteLineup?.name ?? null"
    @deleted="onDeleted"
  />
</template>

<style scoped>
/* Rows fold instead of flying: see the note on the list group above. */
.lrow {
  display: grid;
  grid-template-rows: 1fr;
}
.lrow-enter-active {
  transition:
    grid-template-rows 240ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 220ms ease-out;
}
.lrow-leave-active {
  transition:
    grid-template-rows 200ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 110ms ease-in;
}
.lrow-enter-from,
.lrow-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}
.lrow-move {
  transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* The practice drawer. The wrapper is what Vue times; the parts move. The
   panel rides up inside a box that ends at the bar's top edge, so it reads as
   coming out of the bar rather than passing over it. */
.drawer-panel {
  transform: translateY(var(--drawer-pull, 0px));
}
/* Let go short of closing, it settles back; while held it follows the hand. */
.drawer-panel.drawer-settle {
  transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}
.drawer-enter-active .drawer-panel {
  transition: transform 280ms cubic-bezier(0.16, 1, 0.3, 1);
}
.drawer-leave-active .drawer-panel {
  transition: transform 180ms cubic-bezier(0.4, 0, 1, 1);
}
.drawer-enter-active .drawer-scrim {
  transition: opacity 200ms ease-out;
}
.drawer-leave-active .drawer-scrim {
  transition: opacity 180ms ease-in;
}
.drawer-enter-from .drawer-panel,
.drawer-leave-to .drawer-panel {
  transform: translateY(100%);
}
.drawer-enter-from .drawer-scrim,
.drawer-leave-to .drawer-scrim {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .lrow-enter-active,
  .lrow-leave-active,
  .lrow-move,
  .drawer-panel.drawer-settle,
  .drawer-enter-active .drawer-panel,
  .drawer-leave-active .drawer-panel,
  .drawer-enter-active .drawer-scrim,
  .drawer-leave-active .drawer-scrim {
    transition-duration: 1ms;
  }
}
</style>
