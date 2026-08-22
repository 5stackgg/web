<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  ClipboardCheck,
  ExternalLink,
  Library,
  LayoutList,
  ListOrdered,
  Plus,
  Rows3,
  Server,
  SquareStack,
  X,
} from "lucide-vue-next";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import HeightSwap from "~/components/ui/transitions/HeightSwap.vue";
import { Button } from "~/components/ui/button";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import Pagination from "~/components/Pagination.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import UtilityFilters from "~/components/utility/UtilityFilters.vue";
import UtilityBlockPanel from "~/components/utility/UtilityBlockPanel.vue";
import UtilityPlaybooksPanel from "~/components/utility/UtilityPlaybooksPanel.vue";
import UtilityCreatePanel from "~/components/utility/UtilityCreatePanel.vue";
import UtilityMapPicker from "~/components/utility/UtilityMapPicker.vue";
import UtilityPracticeMapBanner from "~/components/utility/UtilityPracticeMapBanner.vue";
import UtilityMetaIcon from "~/components/utility/UtilityMetaIcon.vue";
import UtilityMetaPanel from "~/components/utility/UtilityMetaPanel.vue";
import UtilityMetaSelection from "~/components/utility/UtilityMetaSelection.vue";
import UtilityPracticePlanPanel from "~/components/utility/UtilityPracticePlanPanel.vue";
import UtilityRadarBoard from "~/components/utility/UtilityRadarBoard.vue";
import UtilityCollectionsPanel from "~/components/utility/UtilityCollectionsPanel.vue";
import UtilityLineupCard from "~/components/utility/UtilityLineupCard.vue";
import UtilityEmpty from "~/components/utility/UtilityEmpty.vue";
import UtilitySkeletonList from "~/components/utility/UtilitySkeletonList.vue";
import UtilityForkDialog from "~/components/utility/UtilityForkDialog.vue";
import UtilityArchiveDialog from "~/components/utility/UtilityArchiveDialog.vue";
import UtilityDeleteDialog from "~/components/utility/UtilityDeleteDialog.vue";
import UtilityLineupDialog from "~/components/utility/UtilityLineupDialog.vue";
import StartPracticeDialog from "~/components/utility/StartPracticeDialog.vue";
import { useUtilityPracticeSession } from "~/composables/useUtilityPracticeSession";
import { useDeferredLoading } from "~/composables/useDeferredLoading";
import { getQueryString, useRouteTab } from "~/composables/useRouteTab";
import { useSidebar } from "~/components/ui/sidebar/utils";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { toast } from "~/components/ui/toast";
import {
  archiveUtilityLineupMutation,
  requestUtilityLineupPublicMutation,
  reviewUtilityLineupPublicMutation,
  utilityLineupsCountQuery,
  utilityScopeCountsQuery,
  utilityLineupsQuery,
  utilityMetaLineupsQuery,
} from "~/graphql/utilityGraphql";
import { renderUtilityLineupPreviewMutation } from "~/graphql/utilityRenderGraphql";
import { e_player_roles_enum, order_by } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import { useUtilityReactions } from "~/composables/useUtilityReactions";
import { normalizeMapName } from "~/utilities/mapAssets";
import {
  matchUtilityMetaSpot,
  utilityLineupWhere,
  toUtilityMetaSpots,
} from "~/utilities/utilityDisplay";
import type {
  UtilityFilterState,
  UtilityMetaSpot,
  UtilityPanelBoard,
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
    "page",
    "meta",
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
function writeQuery(patch: Record<string, string | null>) {
  const query = { ...route.query } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (value) {
      query[key] = value;
    } else {
      delete query[key];
    }
  }
  void router.replace({
    path: route.path,
    query: query as any,
    hash: route.hash,
  });
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
const listTab = useRouteTab({ defaultTab: LIST_TAB, tabs: ALL_TABS });
const selectedMetaKey = ref<string | null>(null);
const hoveredMetaKey = ref<string | null>(null);
const createSeed = ref<UtilityMetaSpot | null>(null);

// The board belongs to the page and outlives every tab. A panel that needs to
// draw on it publishes `UtilityPanelBoard` instead of mounting a second board --
// inside a 400px rail a second map does not fit beside anything, it lands on
// top of it.
const panelBoard = ref<UtilityPanelBoard | null>(null);

/**
 * Whether the panel on screen is showing its own empty state. An empty panel
 * offers the add action inside that message, so the page's button underneath
 * would be the same offer twice, one above the other.
 */
const panelEmpty = ref(false);

// A tab you leave must not carry its emptiness to the next one: the panels
// only speak up once they have loaded, so the gap between would otherwise be
// answered with the last tab's answer.
watch(listTab, () => {
  panelEmpty.value = false;
});

/**
 * The list draws its own empty state the same way the panels do, and the same
 * rule applies to it: while the shelf is bare, the message owns the offer.
 */
const secondaryHidden = computed(() => {
  if (listTab.value === LIST_TAB) {
    return !loading.value && !lineups.value.length;
  }
  return panelEmpty.value;
});

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

// The type chips sit directly under these rings and used to do nothing to
// them: the board filtered meta by thrower count alone, so turning everything
// but smokes off left every molotov cluster on the map. The Meta tab has always
// honoured type and side -- the overlay simply did not, which made the same
// chips mean two different things depending on which tab you were on.
const visibleMetaSpots = computed(() =>
  metaSpots.value.filter((spot) => {
    if (spot.throwers < metaMinThrowers.value) {
      return false;
    }
    if (
      filters.value.types.length &&
      !filters.value.types.includes(spot.utilityType)
    ) {
      return false;
    }
    // A spot with no side recorded is not evidence that it is the wrong side,
    // so it survives a side filter rather than being hidden by a gap in the
    // mined data.
    if (
      filters.value.sides.length &&
      spot.side &&
      !filters.value.sides.includes(spot.side)
    ) {
      return false;
    }
    return true;
  }),
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
  if (
    metaSpots.value.length ||
    (!metaLoaded.value && listTab.value === META_TAB)
  ) {
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
  // Block is built but not ready to ship, so it stays off the strip. Everything
  // behind BLOCK_TAB is left wired up for when it is.
  if (mySteamId.value) {
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

const playbooksPanel = ref<{ startCreate: () => void } | null>(null);
const collectionsPanel = ref<{ startCreate: () => void } | null>(null);

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
  if (listTab.value === PLAYBOOKS_TAB) {
    return {
      key: "playbook",
      icon: Plus,
      label: t("pages.utility.playbooks.new"),
      run: () => playbooksPanel.value?.startCreate(),
    };
  }
  if (listTab.value === COLLECTIONS_TAB) {
    return {
      key: "collection",
      icon: Plus,
      label: t("pages.utility.collections.new"),
      run: () => collectionsPanel.value?.startCreate(),
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
  // Block draws its own search next to the two points it needs, and the plan is
  // a ranking rather than something you add to. Neither has a second action, so
  // neither gets a second button.
  return null;
});

// The legend doubles as the type filter, so it belongs on every view whose
// board is the library. Executes and the plan read their own lists but leave
// the board on the filtered lineups, so hiding the chips there only took the
// control away -- the filter was still doing its work. The author panel drives
// the board itself, so it is the one view that keeps them off.
const boardFiltersApply = computed(() => listTab.value !== CREATE_TAB);

// A view preference, so it outlives the route without following it into the URL.
const listDensity = useState<"cards" | "rows">(
  "utility-list-density",
  () => "rows",
);

// Icon-only: the label rides in the tooltip, because two words beside two icons
// would cost more of the options row than the search box can spare.
const densityOptions = computed(() => [
  {
    key: "cards",
    label: "",
    icon: SquareStack,
    title: t("pages.utility.density.cards"),
    desc: t("pages.utility.density.cards_hint"),
  },
  {
    key: "rows",
    label: "",
    icon: LayoutList,
    title: t("pages.utility.density.rows"),
    desc: t("pages.utility.density.rows_hint"),
  },
]);

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
  listTab.value = CREATE_TAB;
}

function onLineupCreated(id: string) {
  createSeed.value = null;
  listTab.value = LIST_TAB;
  void fetchLineups();
  openLineup(id);
}

// Clicking a ring while the overlay is on is a question about that cluster, and
// the Meta tab is not necessarily the tab you are on when you ask it. The card
// answers it in the column instead, so the overlay stops being a picture you
// can only look at. On the Meta tab the panel already owns the selection, so
// the card stays out of its way.
const selectedMetaSpot = computed(() =>
  selectedMetaKey.value
    ? (visibleMetaSpots.value.find(
        (spot) => spot.key === selectedMetaKey.value,
      ) ?? null)
    : null,
);

/**
 * How much of the picked cluster the column shows.
 *
 * "full" is the card: the ring you clicked, what people throw there, and the
 * saved lineups sitting in it. It belongs over the library, because that is
 * what it is about.
 *
 * Executes, Collections and the drill plan are lists of something else, and a
 * card about one smoke on top of one of them is a second subject competing for
 * a 22rem column. There the cluster keeps only the part that is about doing
 * something -- go throw it -- and the Meta tab keeps nothing, because the
 * panel already owns the selection.
 */
const metaSelectionMode = computed<"full" | "action" | null>(() => {
  if (!selectedMetaSpot.value || listTab.value === META_TAB) {
    return null;
  }
  if (listTab.value === LIST_TAB || listTab.value === CREATE_TAB) {
    return "full";
  }
  // Nothing but the action would survive, and the action is signed-in only.
  return mySteamId.value ? "action" : null;
});

// visibleMetaSpots is the threshold's list, not the overlay's, so a spot picked
// on the board outlives the toggle that drew it -- the card sat there answering
// a question about a ring that was no longer on the map. Turning the overlay
// off drops the selection with it, unless the Meta tab is the thing holding it.
watch([showMeta, showMetaPanel], ([on, panel]) => {
  if (!on && !panel) {
    selectedMetaKey.value = null;
  }
});

// Which saved lineups sit in the picked cluster. Read off the map the page
// already builds rather than re-running the match: matchUtilityMetaSpot walks
// every spot for every lineup, and doing that again on each selection change
// would repeat the page's most expensive computed for one row of a card.
const selectedMetaLineups = computed(() => {
  const spot = selectedMetaSpot.value;
  if (!spot) {
    return [];
  }
  return lineups.value.filter(
    (lineup) => metaSpotByLineup.value[lineup.id]?.key === spot.key,
  );
});

// The overlay toggle is for reading the meta *against* the library; the Meta
// tab is the meta itself, so it draws the clusters whatever the toggle says.
const metaOnBoard = computed(() =>
  showMetaPanel.value || showMeta.value ? visibleMetaSpots.value : [],
);

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

// Declared above fetchScopeCounts because that function reads it, and the first
// call runs at setup: with the auth store already warm, the old ordering threw
// "Cannot access 'canReview' before initialization" and the page never mounted.
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

async function fetchScopeCounts() {
  // A signed-out visitor only ever sees Public, so three of the four counts
  // would be a round trip spent on tabs they cannot press.
  const scopes = mySteamId.value
    ? SCOPES.filter((scope) => scope !== "pending" || canReview.value)
    : ["public"];

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

// Everything on this page is scoped to one map, and the page no longer unmounts
// between them -- so what a remount used to throw away has to be thrown away
// here instead. Markers, meta rings and the list clear on the spot, which is
// what lets the board dissolve into the next map with nothing stale drawn over
// it; the fetches below refill them. `where` also changes with the map, so the
// watcher on it resets the page and the selection and refires the queries.
watch(
  mapName,
  () => {
    resetListLoading();
    lineups.value = [];
    totalCount.value = 0;
    metaSpots.value = [];
    metaLoaded.value = false;
    hoveredId.value = null;
    selectedMetaKey.value = null;
    hoveredMetaKey.value = null;
    createSeed.value = null;
    panelBoard.value = null;
    void fetchMeta();
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

function startFork(id: string) {
  forkLineup.value = lineups.value.find((entry) => entry.id === id) ?? null;
  forkOpen.value = !!forkLineup.value;
}

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

function setDetailId(id: string | null, mode: "push" | "replace") {
  const query = { ...route.query } as Record<string, unknown>;
  if (id) {
    query.lineup = id;
  } else {
    delete query.lineup;
  }
  const to = { path: route.path, query: query as any, hash: route.hash };
  // Opening pushes so Back closes it; stepping through the set replaces, or
  // flipping past ten lineups would bury the page you came from.
  if (mode === "push") {
    void router.push(to);
  } else {
    void router.replace(to);
  }
}

const detailOpen = computed<boolean>({
  get: () => !!detailId.value,
  set: (value) => {
    if (!value) {
      setDetailId(null, "replace");
    }
  },
});

function openLineup(id: string) {
  setDetailId(id, "push");
}

// Practising from the dialog hands off to the practice dialog rather than
// stacking one modal on another.
function practiceFromDetail(id: string) {
  setDetailId(null, "replace");
  selectedId.value = id;
  practiceOpen.value = true;
}

// Fork and archive are asked for from inside the dialog; both open a dialog of
// their own, so the detail has to get out of the way first.
function forkFromDetail(id: string, name: string) {
  setDetailId(null, "replace");
  forkLineup.value = { id, name };
  forkOpen.value = true;
}

function archiveFromDetail(id: string, name: string) {
  setDetailId(null, "replace");
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

  if (await reactions.toggleFavorite(lineup, steamId)) {
    // SAVED is a scope, so favouriting changes what one of the tabs holds.
    void fetchScopeCounts();
  } else {
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
    void fetchScopeCounts();
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
    void fetchScopeCounts();
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

function startArchive(id: string) {
  archiveLineup.value = lineups.value.find((entry) => entry.id === id) ?? null;
  archiveOpen.value = !!archiveLineup.value;
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
    <!-- The board's track is sized to exactly what the board can use, not to
         1fr: a square board capped at the viewport's height leaves slack in a
         greedy track, and wherever that slack lands inside the grid it becomes
         a hole between the map and the list. With neither track greedy the
         pair is narrower than the page, so `justify-center` puts the leftover
         in the page margins -- equal on both sides, pair still welded. -->
    <!-- The column is EXACTLY as wide as its tab strip needs, measured by the
         browser rather than guessed at, and every other child of that column
         is neutralised so the strip is the only thing it measures. It must be
         fit-content() and not min(max-content, ..): CSS min()/max()/clamp()
         reject intrinsic keywords, and an invalid value drops the whole
         grid-template-columns, collapsing the page to a single column. -->
    <div
      class="mx-auto grid w-full gap-4 [--board:1000px] lg:max-w-[1900px] lg:grid-cols-[minmax(0,var(--board))_fit-content(60rem)] lg:justify-center"
    >
      <!-- --board sizes the BOX, and the box wants to be wide: the map picker,
           the practice button, the type chips and the meta control all live
           along its edges, and they are the things that get squeezed. So it is
           capped by width alone. Fitting the viewport height is the MAP's job,
           not the box's -- the map area carries its own height budget and
           shrinks inside a box that stays full width. Tying the box to 100vh
           instead is what kept crushing this chrome.

           Both columns are capped: the board by --board and the list by its own tab strip,
           which is why the panel below uses w-0 + min-w-full -- a long lineup
           name must not set the column width. Two capped tracks in a wider
           container means leftover space is unavoidable; the only decision is
           where it goes.

           An fr on either track puts it INSIDE, which is the one wrong answer.
           On the board track it becomes a gap between the map and the list,
           because the board is mx-auto and centres in a track wider than
           itself; on the list track it stretches the list past its strip.
           justify-center puts the leftover outside both, so the list always
           sits directly beside the map. Below that width nothing is left over,
           the tracks shrink, and the board -- min 0 against the list's
           fit-content -- gives up width only once there is none to give. -->
      <!-- The map is the page: the board's own frame holds the name, the
           practice button and the legend, so the chrome stops competing with
           the list's own controls. Only the legend still floats on the map --
           the chips carry the colours the board draws with, so they belong on
           it. `utility-board` makes this a
           query container, because what crowds these overlays is the board's
           width, not the viewport's -- collapsing the left nav or opening the
           right hub narrows it on a desktop, so a viewport breakpoint would
           fire at all the wrong times. -->
      <div
        class="utility-board relative mx-auto w-full max-w-[var(--board)] overflow-hidden rounded-md border border-border bg-card/40 lg:sticky lg:top-4 lg:self-start"
      >
        <!-- The map names itself, the way a map does everywhere else in the
             app, and it still does it inside the board's own frame -- but in a
             band the map cannot reach rather than on top of it. Floating
             worked while the name was bare text with a shadow; now that the
             switcher carries the map's patch and a wash of its screenshot it
             is an opaque control, and an opaque control over the map hides the
             part of the map under it. Reserving the strip makes the overlap
             impossible at any board width, on any radar -- the frame moved out
             to this wrapper so the band reads as part of the board. -->
        <div class="relative z-10 flex items-center gap-2 px-3 py-2">
          <!-- The name IS the switcher, so there is no index page to go back
               to and no "All Maps" link taking up a line under it. It is also
               the page's identity, so it is the one thing here that never
               yields its width: the strip used to be shrink-0 against a
               min-w-0 name, which crushed the title to nothing under a 560px
               board and covered it outright under 480px. -->
          <div class="shrink-0">
            <UtilityMapPicker :map-name="mapName" />
          </div>
          <!-- Sat with the map name because it is about the gap between that
               name and the one the server is on. Desktop only, for the same
               reason the practice button is: it ends in a click that moves a
               game server, which is not a thing to offer on a phone. -->
          <UtilityPracticeMapBanner
            v-if="!isMobile"
            class="min-w-0 flex-1"
            :map-name="mapName"
          />
          <!-- Starting a server is the one thing the practice header cannot
               offer, because it only appears once a server exists. This is
               where that loop is broken. Desktop only: it ends in "join this
               address in CS2", which a phone cannot do. -->
          <div v-if="!isMobile" class="ml-auto shrink-0">
            <!-- Collapsed to its icon on a narrow board, so the label cannot
                 be what explains it -- and even at full width "Practice
                 Server" is a noun, not an offer. The bubble is the offer. -->
            <FiveStackToolTip as-child :delay-duration="120">
              <template #trigger>
                <Button
                  size="sm"
                  variant="outline"
                  class="utility-board-practice-btn border-white/10 bg-background/80 [backdrop-filter:blur(10px)]"
                  @click="practiceOpen = true"
                >
                  <Server class="h-4 w-4" />
                  <span class="utility-board-practice-label ml-1">
                    {{ $t("pages.utility.practice.title") }}
                  </span>
                </Button>
              </template>
              <div class="flex max-w-[17rem] flex-col gap-1">
                <span class="text-xs font-medium">
                  {{ $t("pages.utility.practice.title") }}
                </span>
                <span class="text-xs leading-relaxed text-muted-foreground">
                  {{ $t("pages.utility.practice.what_is") }}
                </span>
              </div>
            </FiveStackToolTip>
          </div>
        </div>
        <!-- The card chrome lives on the wrapper now, so the radar sheds its
             own frame entirely: the band and the map are one surface, not two
             stacked boxes. -->
        <UtilityRadarBoard
          class="!rounded-none !border-0 !bg-transparent"
          :map-name="mapName"
          :lineups="panelBoard?.lineups ?? lineups"
          :selected-id="
            panelBoard ? (panelBoard.selectedId ?? null) : selectedId
          "
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
          @select-segment="(key) => panelBoard?.onSelectSegment?.(key)"
        />
        <!-- The band's colour bled into the top of the radar. Without it the
             map starts on a hard edge an inch under the name, which reads as
             two stacked panels; with it the strip is the top of the map rather
             than a lid on it. It is a gradient, not a bar, so nothing on the
             board is hidden -- only dimmed where it meets the chrome. -->
        <div
          class="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background via-background/55 to-transparent"
        ></div>

        <!-- Legend and filter in one: the chips carry the same colours the
             board draws with, so the thing that explains the markers is the
             thing that hides them. On the board they read as map layers,
             which is what they are. -->
        <div
          v-if="boardFiltersApply"
          class="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-2"
        >
          <!-- No wrap, and the chips shrink instead. Wrapping put them on a
               line ABOVE the meta column, and once that column stands its
               threshold pills up as a ladder it is ~150px tall -- so the chips
               were lifted clean off the top of a short board and clipped by its
               overflow-hidden. Shrinking keeps them on the bottom line beside
               the ladder, where they wrap among themselves and stay on screen
               at any board height. min-w-0 is what actually lets them: a flex
               item will not shrink below its content without it. -->
          <div
            class="utility-board-chips pointer-events-auto flex min-w-0 flex-1 flex-col gap-1.5"
          >
            <span
              class="utility-board-key font-mono text-[0.55rem] uppercase tracking-[0.16em] text-white/45 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]"
            >
              {{ $t("pages.utility.board.key") }}
            </span>
            <UtilityFilters
              v-model="filters"
              :signed-in="!!mySteamId"
              :has-team="myTeamIds.length > 0"
              :parts="['types']"
              bare
            />
          </div>
          <!-- The mirror of the key column on the left: a caption over its
               controls. Turning the overlay on used to grow the button
               leftwards by the width of an n/total, which slid the glyph out
               from under the cursor that had just pressed it. The button is now
               a fixed square anchored to the corner and the count reads above
               it, so the only thing toggling changes is what is on the map. -->
          <div
            class="utility-meta-cluster pointer-events-auto ml-auto flex shrink-0 flex-col items-end gap-1.5"
          >
            <!-- Both halves of the meta chrome arrive rather than appear. They
                 sit over a map that is itself fading rings in underneath, so a
                 hard cut here is the one frame that reads as a redraw. The
                 count drops in from the button it reports on; the strip
                 unfolds out of it, origin-right, so it looks like it came from
                 under the toggle and not from off-screen. Neither can move the
                 button: both are anchored to the same right edge. -->
            <Transition
              enter-active-class="transition-[opacity,transform] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
              leave-active-class="transition-[opacity,transform] [transition-duration:110ms] ease-in motion-reduce:![transition-duration:1ms]"
              enter-from-class="translate-y-1 opacity-0"
              leave-to-class="translate-y-1 opacity-0"
            >
              <span
                v-if="showMeta && metaControlsHeld && !showMetaPanel"
                class="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-[hsl(var(--tac-amber)/0.8)] [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]"
              >
                {{ $t("pages.utility.meta.title") }}
                <!-- The count waits for the query rather than printing 0/0 at
                     it: the label holds the spot so nothing moves, and the
                     numbers arrive when there are numbers. -->
                <span v-if="metaLoaded" class="tabular-nums text-white/55">
                  {{ visibleMetaSpots.length }}/{{ metaSpots.length }}
                </span>
              </span>
            </Transition>
            <div class="utility-meta-controls flex items-end gap-2">
              <!-- Only worth offering once the overlay is on: it is the knob
                   that decides how much of the mined tail lands on the board.
                   It opens to the left of the button, and on a narrow board it
                   stands up as a ladder directly above the toggle -- so the
                   whole meta control reads as one column pinned to the corner
                   and the chips get the entire row back.

                   The frosting goes on the strip itself. A wrapper carrying it
                   put a bordered box around an already-bordered one and pushed
                   the strip to 38px beside a 32px button; square AnimatedFilters
                   is built to measure exactly 2rem for this reason. -->
              <Transition
                enter-active-class="transition-[opacity,transform] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
                leave-active-class="transition-[opacity,transform] [transition-duration:110ms] ease-in motion-reduce:![transition-duration:1ms]"
                enter-from-class="scale-95 opacity-0"
                leave-to-class="scale-95 opacity-0"
              >
                <AnimatedFilters
                  v-if="showMeta && !showMetaPanel && metaControlsHeld"
                  v-model="metaThresholdModel"
                  :options="metaThresholdOptions"
                  square
                  class="utility-meta-threshold origin-bottom-right !border-white/10 !bg-background/80 [backdrop-filter:blur(10px)]"
                />
              </Transition>
              <!-- No label at any width. The glyph is a miniature of the
                   dashed rings the overlay paints, so the words were saying a
                   second time what the icon already showed -- and they were the
                   thing crowding the chips off this row on a narrow board. On,
                   it wears the amber in the frame and not just in the glyph: an
                   icon-only toggle needs somewhere to carry its state. -->
              <Button
                v-if="metaControlsHeld && !showMetaPanel"
                size="icon-sm"
                variant="outline"
                class="shrink-0 [backdrop-filter:blur(10px)]"
                :class="
                  showMeta
                    ? 'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))] hover:!bg-[hsl(var(--tac-amber)/0.18)]'
                    : 'border-white/10 bg-background/80'
                "
                :title="$t('pages.utility.meta.overlay')"
                :aria-label="$t('pages.utility.meta.overlay')"
                :aria-pressed="showMeta"
                @click="showMeta = !showMeta"
              >
                <UtilityMetaIcon class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-2 lg:min-w-[22rem]">
        <!-- Which tab, whose lineups, and the search over them: all three are
             how you steer the column, so they stay put while it scrolls.
             top-0 with the page padding pulled inside rather than top-4 --
             the bar has to paint that padding too, or scrolled cards show
             through the strip of page above it. -->
        <div
          class="sticky top-0 z-20 -mt-1 flex flex-col gap-2 bg-background/95 pb-2 pt-1 [backdrop-filter:blur(12px)] sm:-mt-4 sm:pt-4"
        >
          <!-- The toolbar sits over the column, not the map. Two boxes, not three:
             AnimatedFilters draws its own bordered strip, so this is the single
             wrapper around it -- an outer shell on top of that made the chrome
             read as a box in a box in a box. -->
          <div
            class="utility-board-tabs mx-auto w-max max-w-full rounded-lg border border-white/10 bg-background/80 p-1 shadow-[0_8px_28px_-12px_rgba(0,0,0,0.9)] [backdrop-filter:blur(10px)]"
          >
            <AnimatedFilters v-model="listTab" :options="listTabs" square />
          </div>

          <!-- Whose lineups, and which of them -- a property of the list, not of
             the page, so it lives with the list. It leaves on the same clock
             as the panel below it, and folds rather than vanishing: chrome
             that pops out from under a sticky bar drags everything below it up
             by 70px in one frame, which is the jolt that made a tab click feel
             like a page load. -->
          <HeightSwap>
            <div
              v-if="listTab === LIST_TAB"
              key="list-controls"
              class="flex w-0 min-w-full flex-col gap-2"
            >
              <UtilityFilters
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
                  bare
                  class="min-w-0 flex-1 flex-nowrap [&>div:first-child]:max-w-none [&>div:first-child]:flex-1"
                />
                <!-- Cards read one lineup; rows read down a list of them. Which one
                 you want depends on whether you are choosing or comparing. -->
                <AnimatedFilters
                  v-model="listDensity"
                  :options="densityOptions"
                  square
                  class="shrink-0"
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
          <!-- Above whichever tab is open, because the ring you picked is a
             question you asked of the map and not of the list -- it should not
             cost you the view you were in to read the answer. It rides in from
             the board's side rather than fading, which is the direction the
             click came from. -->
          <Transition
            enter-active-class="transition-[opacity,transform] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
            leave-active-class="transition-[opacity,transform] [transition-duration:110ms] ease-in motion-reduce:![transition-duration:1ms]"
            enter-from-class="-translate-x-3 opacity-0"
            leave-to-class="-translate-x-3 opacity-0"
          >
            <UtilityMetaSelection
              v-if="metaSelectionMode && selectedMetaSpot"
              :spot="selectedMetaSpot"
              :map-name="mapName"
              :lineups="selectedMetaLineups"
              :busiest="Math.max(1, metaBusiest)"
              :can-author="!!mySteamId"
              :can-practice="!!mySteamId"
              :compact="metaSelectionMode === 'action'"
              @close="selectedMetaKey = null"
              @open="openLineup"
              @write-up="writeUpMetaSpot"
              @practice="practiceOpen = true"
            />
          </Transition>

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
          <HeightSwap>
            <UtilityPracticePlanPanel
              v-if="showPlan"
              key="plan"
              :map-name="mapName"
              @select="selectLineup"
              @hover="(id) => (hoveredId = id)"
            />

            <UtilityCollectionsPanel
              v-else-if="listTab === COLLECTIONS_TAB"
              key="collections"
              ref="collectionsPanel"
              :map-name="mapName"
              @empty="(value) => (panelEmpty = value)"
            />

            <UtilityPlaybooksPanel
              v-else-if="showPlaybooks"
              key="playbooks"
              ref="playbooksPanel"
              :map-name="mapName"
              :hide-create="!!mySteamId"
              @board="(state) => (panelBoard = state)"
              @empty="(value) => (panelEmpty = value)"
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
              v-model:selected-key="selectedMetaKey"
              v-model:hovered-key="hoveredMetaKey"
              v-model:threshold="metaThresholdModel"
              :map-name="mapName"
              :threshold-options="metaThresholdOptions"
              :spots="visibleMetaSpots"
              :lineups="lineups"
              :types="filters.types"
              :sides="filters.sides"
              :can-author="!!mySteamId"
              @open="openLineup"
              @write-up="writeUpMetaSpot"
            />

            <!-- Shaped like the rows they stand in for, in whichever density is
               on: a short placeholder replaced by a tall card makes the whole
               list jump, which reads as jank even though nothing moved twice. -->
            <UtilitySkeletonList
              v-else-if="listSkeleton"
              key="loading"
              :count="3"
              :shape="listDensity === 'rows' ? 'row' : 'card'"
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
              <div v-for="lineup of lineups" :key="lineup.id" class="lrow">
                <div class="min-h-0 overflow-hidden">
                  <div :id="`utility-card-${lineup.id}`" class="pt-2">
                    <!-- In row mode the selected lineup opens back into a full card in
                 place, so picking one on the board still shows you everything
                 about it without leaving the list you were reading. -->
                    <UtilityLineupCard
                      :lineup="lineup"
                      :mode="
                        listDensity === 'rows' && selectedId !== lineup.id
                          ? 'row'
                          : 'card'
                      "
                      :selected="selectedId === lineup.id"
                      :hovered="hoveredId === lineup.id"
                      :meta-throwers="
                        metaSpotByLineup[lineup.id]?.throwers ?? null
                      "
                      :meta-throws="metaSpotByLineup[lineup.id]?.throws ?? null"
                      :meta-busiest="metaBusiest"
                      :show-fork="!!mySteamId"
                      :show-archive="!!mySteamId"
                      :can-review="canReview"
                      @select="selectLineup"
                      @hover="(id) => (hoveredId = id)"
                      :can-react="!!mySteamId"
                      open-in-place
                      @open="openLineup"
                      @fork="startFork"
                      @archive="startArchive"
                      @restore="restoreLineup"
                      @delete="startDelete"
                      @request-public="requestPublic"
                      @review-public="reviewPublic"
                      @rerender-preview="rerenderPreview"
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
    </div>
  </PageTransition>

  <UtilityForkDialog
    v-model:open="forkOpen"
    :lineup-id="forkLineup?.id ?? null"
    :source-name="forkLineup?.name ?? null"
    :map-name="mapName"
  />

  <UtilityLineupDialog
    v-model:open="detailOpen"
    v-model:lineup-id="detailId"
    :lineups="lineups"
    :can-react="!!mySteamId"
    @practice="practiceFromDetail"
    @vote="onVote"
    @favorite="onFavorite"
    @fork="forkFromDetail"
    @archive="archiveFromDetail"
    @updated="patchLineup"
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

  <StartPracticeDialog
    v-model:open="practiceOpen"
    :map-name="mapName"
    :join-invite-code="joinInviteCode"
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

@media (prefers-reduced-motion: reduce) {
  .lrow-enter-active,
  .lrow-leave-active,
  .lrow-move {
    transition-duration: 1ms;
  }
}
</style>
