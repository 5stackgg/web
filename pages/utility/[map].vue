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
  Users,
  X,
} from "lucide-vue-next";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import Pagination from "~/components/Pagination.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import UtilityFilters from "~/components/utility/UtilityFilters.vue";
import UtilityBlockPanel from "~/components/utility/UtilityBlockPanel.vue";
import UtilityPlaybooksPanel from "~/components/utility/UtilityPlaybooksPanel.vue";
import UtilityCreatePanel from "~/components/utility/UtilityCreatePanel.vue";
import UtilityMapPicker from "~/components/utility/UtilityMapPicker.vue";
import UtilityMetaPanel from "~/components/utility/UtilityMetaPanel.vue";
import UtilityPracticePlanPanel from "~/components/utility/UtilityPracticePlanPanel.vue";
import UtilityRadarBoard from "~/components/utility/UtilityRadarBoard.vue";
import UtilityCollectionsPanel from "~/components/utility/UtilityCollectionsPanel.vue";
import UtilityLineupCard from "~/components/utility/UtilityLineupCard.vue";
import UtilityForkDialog from "~/components/utility/UtilityForkDialog.vue";
import UtilityArchiveDialog from "~/components/utility/UtilityArchiveDialog.vue";
import UtilityDeleteDialog from "~/components/utility/UtilityDeleteDialog.vue";
import UtilityLineupDialog from "~/components/utility/UtilityLineupDialog.vue";
import StartPracticeDialog from "~/components/utility/StartPracticeDialog.vue";
import { useUtilityPracticeSession } from "~/composables/useUtilityPracticeSession";
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
const listTab = ref<string>(LIST_TAB);
const selectedMetaKey = ref<string | null>(null);
const hoveredMetaKey = ref<string | null>(null);
const createSeed = ref<UtilityMetaSpot | null>(null);

// The board belongs to the page and outlives every tab. A panel that needs to
// draw on it publishes `UtilityPanelBoard` instead of mounting a second board --
// inside a 400px rail a second map does not fit beside anything, it lands on
// top of it.
const panelBoard = ref<UtilityPanelBoard | null>(null);

const metaSpots = ref<UtilityMetaSpot[]>([]);
const showMeta = ref(false);

// Distinct players, not throws, so the floor cannot be met by one person
// repeating a spot. Ten is enough to mean "people do this here" while cutting
// the long tail of one- and two-player habits that made the overlay unreadable.
const metaMinThrowers = ref(10);

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

const visibleMetaSpots = computed(() =>
  metaSpots.value.filter((spot) => spot.throwers >= metaMinThrowers.value),
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
  if (metaSpots.value.length) {
    tabs.push({
      key: META_TAB,
      label: t("pages.utility.views.meta_tab"),
      title: t("pages.utility.views.meta_tab"),
      desc: t("pages.utility.views.meta_hint"),
      icon: Users,
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
const showMetaPanel = computed(
  () => listTab.value === META_TAB && metaSpots.value.length > 0,
);
const showCreatePanel = computed(
  () => listTab.value === CREATE_TAB && !!mySteamId.value,
);
const showBlockPanel = computed(() => listTab.value === BLOCK_TAB);

const showPlaybooks = computed(() => listTab.value === PLAYBOOKS_TAB);

const playbooksPanel = ref<{ startCreate: () => void } | null>(null);

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

// The overlay toggle is for reading the meta *against* the library; the Meta
// tab is the meta itself, so it draws the clusters whatever the toggle says.
const metaOnBoard = computed(() =>
  showMetaPanel.value || showMeta.value ? visibleMetaSpots.value : [],
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
      class="mx-auto grid w-full gap-4 [--board:min(1000px,calc(100vh-7rem))] lg:max-w-[1900px] lg:grid-cols-[minmax(0,var(--board))_fit-content(60rem)] lg:justify-center"
    >
      <!-- The map is the page. Everything that used to sit in a band above it
           floats on it, so the board gets the room and the chrome stops
           competing with the list's own controls. `utility-board` makes this a
           query container, because what crowds these overlays is the board's
           width, not the viewport's -- collapsing the left nav or opening the
           right hub narrows it on a desktop, so a viewport breakpoint would
           fire at all the wrong times. -->
      <div
        class="utility-board relative mx-auto w-full max-w-[var(--board)] lg:sticky lg:top-4 lg:self-start"
      >
        <UtilityRadarBoard
          :map-name="mapName"
          :lineups="panelBoard?.lineups ?? lineups"
          :selected-id="panelBoard ? (panelBoard.selectedId ?? null) : selectedId"
          :hovered-id="panelBoard ? (panelBoard.hoveredId ?? null) : hoveredId"
          :meta-spots="metaOnBoard"
          :selected-meta-key="selectedMetaKey"
          :hovered-meta-key="hoveredMetaKey"
          :meta-interactive="showMetaPanel"
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
        <!-- The map names itself, the way a map does everywhere else in the
             app. A separate header band above it was mostly empty height. -->
        <div class="pointer-events-none absolute inset-x-3 top-3 flex items-start">
          <!-- The name IS the switcher, so there is no index page to go back
               to and no "All Maps" link taking up a line under it. It is also
               the page's identity, so it is the one thing here that never
               yields its width: the strip used to be shrink-0 against a
               min-w-0 name, which crushed the title to nothing under a 560px
               board and covered it outright under 480px. -->
          <div class="pointer-events-auto shrink-0">
            <UtilityMapPicker :map-name="mapName" />
          </div>
          <!-- Starting a server is the one thing the practice header cannot
               offer, because it only appears once a server exists. This is
               where that loop is broken. Desktop only: it ends in "join this
               address in CS2", which a phone cannot do. -->
          <div v-if="!isMobile" class="pointer-events-auto ml-auto shrink-0">
            <Button
              size="sm"
              variant="outline"
              class="border-white/10 bg-background/80 [backdrop-filter:blur(10px)]"
              :title="$t('pages.utility.practice.description')"
              @click="practiceOpen = true"
            >
              <Server class="h-4 w-4" />
              <span class="utility-board-overlay-label ml-1">
                {{ $t("pages.utility.practice.title") }}
              </span>
            </Button>
          </div>
        </div>

        <!-- Legend and filter in one: the chips carry the same colours the
             board draws with, so the thing that explains the markers is the
             thing that hides them. On the board they read as map layers,
             which is what they are. -->
        <div
          v-if="boardFiltersApply"
          class="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap items-end justify-between gap-2"
        >
          <div class="pointer-events-auto flex max-w-full flex-col gap-1.5">
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
          <div class="pointer-events-auto flex shrink-0 items-center gap-2">
            <!-- Only worth offering once the overlay is on: it is the knob that
                 decides how much of the mined tail lands on the board. -->
            <div
              v-if="showMeta && !showMetaPanel && metaSpots.length"
              class="rounded-md border border-white/10 bg-background/80 p-0.5 [backdrop-filter:blur(10px)]"
            >
              <AnimatedFilters
                v-model="metaThresholdModel"
                :options="metaThresholdOptions"
                square
              />
            </div>
            <Button
              v-if="metaSpots.length && !showMetaPanel"
              size="sm"
              variant="outline"
              class="shrink-0 border-white/10 bg-background/80 [backdrop-filter:blur(10px)]"
              :class="showMeta ? 'text-[hsl(var(--tac-amber))]' : ''"
              :title="$t('pages.utility.meta.overlay')"
              @click="showMeta = !showMeta"
            >
              <Users class="h-4 w-4" />
              <span class="utility-board-overlay-label ml-1">
                {{ $t("pages.utility.meta.overlay") }}
              </span>
              <span
                v-if="showMeta"
                class="ml-1 font-mono text-[0.6rem] tabular-nums opacity-70"
              >
                {{ visibleMetaSpots.length }}/{{ metaSpots.length }}
              </span>
            </Button>
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
             the page, so it lives with the list. It fades on the same clock as
             the panel below it: chrome that snaps in over a panel still fading
             out is the one frame where two tabs are on screen at once. -->
        <PageTransition swap>
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
        </PageTransition>
        </div>

        <!-- w-0 + min-w-full: this contributes NOTHING to the column's
             max-content width, so the track above sizes to the tab strip
             alone, then this fills whatever that came out as. Without it a
             single long lineup name would set the column width. -->
        <div class="flex w-0 min-w-full flex-col gap-2">

        <!-- Every tab lands in the same slot, so switching tabs is a swap,
             not a navigation. `swap` is out-in on purpose: two tabs hold
             completely different content, and crossfading them prints one over
             the other for 200ms. Out-in fades the old one away, changes the
             column's height while nothing is visible, then fades the new one
             in. Opacity only -- a tab change mounts a whole panel and fires its
             queries, and a size tween would freeze mid-flight under that. -->
        <PageTransition swap>
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
            :map-name="mapName"
          />

          <UtilityPlaybooksPanel
            v-else-if="showPlaybooks"
            key="playbooks"
            ref="playbooksPanel"
            :map-name="mapName"
            :hide-create="!!mySteamId"
            @board="(state) => (panelBoard = state)"
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

          <UtilityCreatePanel
            v-else-if="showCreatePanel"
            key="create"
            :map-name="mapName"
            :seed="createSeed"
            @board="(state) => (panelBoard = state)"
            @created="onLineupCreated"
          />

          <UtilityMetaPanel
            v-else-if="showMetaPanel"
            key="meta"
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

          <!-- Shaped like the cards they stand in for. A short placeholder
               that is replaced by a tall card makes the whole list jump, which
               reads as jank even though nothing moved twice. The stagger keeps
               them from strobing as one block. -->
          <div v-else-if="loading" key="loading" class="flex flex-col gap-2">
            <div
              v-for="i in 4"
              :key="`skeleton-${i}`"
              class="animate-in fade-in rounded-md border border-l-2 border-border bg-card/40 [animation-duration:240ms] [animation-fill-mode:backwards]"
              :class="listDensity === 'rows' ? 'py-2 pl-3 pr-2' : 'p-3 pl-3.5'"
              :style="{ animationDelay: `${(i - 1) * 60}ms` }"
            >
              <div class="flex items-start justify-between gap-2">
                <Skeleton class="h-4 w-2/5" />
                <Skeleton class="h-4 w-4 rounded" />
              </div>
              <Skeleton class="mt-2 h-2.5 w-4/5" />
              <template v-if="listDensity === 'cards'">
                <Skeleton class="mt-2.5 h-[3px] w-full rounded-sm" />
                <div class="mt-2.5 flex items-center justify-between">
                  <Skeleton class="h-5 w-24 rounded-full" />
                  <Skeleton class="h-5 w-16" />
                </div>
              </template>
            </div>
          </div>

          <div
            v-else-if="!lineups.length"
            key="no-lineups"
            class="rounded-md border border-dashed border-border px-4 py-6 text-center"
          >
          <p class="text-sm font-semibold">
            {{ $t("pages.utility.empty.no_lineups") }}
          </p>
          <p class="mx-auto mt-1 max-w-[36ch] text-xs leading-relaxed text-muted-foreground">
            {{ $t("pages.utility.empty.no_lineups_description") }}
          </p>
          <Button
            v-if="mySteamId"
            size="sm"
            variant="outline"
            class="mt-3 border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.08)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.14)]"
            @click="
              createSeed = null;
              listTab = CREATE_TAB;
            "
          >
            <Plus class="mr-1 h-4 w-4" />
            {{ $t("pages.utility.create.action") }}
          </Button>

          <!-- Telling someone the library is empty while three lineups sit one
               tab away is how the counts stop being believed. -->
          <div
            v-if="populatedElsewhere.length"
            class="mt-3 flex flex-wrap justify-center gap-1.5 border-t border-border/60 pt-3"
          >
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
          </div>
          </div>

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
            class="-mt-2 flex flex-col"
          >
          <div
            v-for="lineup of lineups"
            :key="lineup.id"
            class="lrow"
          >
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
              :meta-throwers="metaSpotByLineup[lineup.id]?.throwers ?? null"
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
        </PageTransition>

        <!-- At the foot of the column, under whatever the tab is showing: an
             add button belongs after the thing you are adding to, not above
             it competing with the tab strip for the same corner. -->
        <button
          v-if="mySteamId && secondaryAction"
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
