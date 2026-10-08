<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  Copy,
  Link2,
  Lock,
  PencilLine,
  Play,
  Plus,
} from "lucide-vue-next";
import HeightSwap from "~/components/ui/transitions/HeightSwap.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { Button } from "~/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import { toast } from "~/components/ui/toast";
import UtilityCardView from "~/components/utility/UtilityCardView.vue";
import UtilityDockButton from "~/components/utility/UtilityDockButton.vue";
import UtilityDockMenu from "~/components/utility/UtilityDockMenu.vue";
import UtilityExecuteView from "~/components/utility/UtilityExecuteView.vue";
import UtilityPlaybookEditor from "~/components/utility/UtilityPlaybookEditor.vue";
import UtilityRow from "~/components/utility/UtilityRow.vue";
import UtilitySetThumb from "~/components/utility/UtilitySetThumb.vue";
import UtilitySkeletonList from "~/components/utility/UtilitySkeletonList.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { useDeferredLoading } from "~/composables/useDeferredLoading";
import { useRouteTab } from "~/composables/useRouteTab";
import { useUtilityLoad } from "~/composables/useUtilityLoad";
import { useUtilityPracticeSession } from "~/composables/useUtilityPracticeSession";
import {
  deleteUtilityPlaybookMutation,
  loadUtilityPlaybookIntoSessionMutation,
  saveUtilityPlaybookMutation,
  teamRosterQuery,
  utilityLineupsQuery,
  utilityPlaybookStepsQuery,
  utilityPlaybooksQuery,
} from "~/graphql/utilityGraphql";
import { order_by } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import cleanMapName from "~/utilities/cleanMapName";
import { hasMeshForMap } from "~/utilities/mapAssets";
import {
  UTILITY_TYPE_COLORS,
  executeFlightSeconds,
  formatUtilityOffset,
  utilityLanding,
  utilityOrigin,
} from "~/utilities/utilityDisplay";
import type {
  UtilityBarOffer,
  UtilityBoardMarker,
  UtilityLineupContext,
  UtilityPanelBoard,
  UtilityPracticeTarget,
} from "~/utilities/utilityDisplay";
import type { UtilityExecuteBeat } from "~/components/utility/UtilityExecuteView.vue";
import type {
  UtilityAuthorRef,
  UtilityLineup,
  UtilityPlaybook,
  UtilityPlaybookStep,
  UtilityPlaybookStepInput,
  UtilityType,
} from "~/types/utility";

/**
 * The Executes tab. A list of executes with no buttons on its rows: a click
 * opens one to be read -- the timeline, who throws what and how -- and
 * everything you can do to it sits in that view's header; practising it is
 * offered in the bar at the foot of the card. Editing, and picking
 * the throws, open over the read view in the same card; nothing here is a
 * dialog.
 */
const props = defineProps<{
  mapName: string;
  /** The page's one type filter. */
  types: UtilityType[];
  /** The lineup the page has open over the card, if any. */
  openLineupId: string | null;
  /** Off on a phone: practice ends in "join this server in CS2". */
  canPractice: boolean;
}>();

const emit = defineEmits<{
  (e: "board", state: UtilityPanelBoard | null): void;
  // True while one of this tab's views is open over the list.
  (e: "cover", value: boolean): void;
  // What the bar at the foot of the card should offer while an execute is
  // open: practising it, once there is a server to practise on.
  (e: "bar", offer: UtilityBarOffer | null): void;
  (e: "toggle-type", type: UtilityType): void;
  (e: "open-lineup", id: string, context?: UtilityLineupContext): void;
  (e: "practice", target: UtilityPracticeTarget): void;
}>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const auth = useAuthStore();
const mySteamId = computed(() =>
  auth.me?.steam_id ? String(auth.me.steam_id) : null,
);
const myTeams = computed(
  () => (auth.me?.teams ?? []) as Array<{ id: string; name: string }>,
);

const playbooks = ref<UtilityPlaybook[]>([]);
const steps = ref<UtilityPlaybookStep[]>([]);
const lineupsById = ref<Record<string, UtilityLineup>>({});
const loading = ref(true);
// Steps arrive before the lineups they point at. Until that round trip lands a
// missing lineup is one that has not loaded, not one you cannot see.
const lineupsLoading = ref(false);

// Saving or deleting an execute reloads the list. That is a refetch over
// something you are still looking at, so it dims rather than emptying out. A
// change of map is not: none of those executes belong to the map you are now
// on, so that one goes back to shapes.
const { skeleton, refreshing, reset } = useDeferredLoading(() => loading.value);

const stepsByPlaybook = computed(() => {
  const grouped: Record<string, UtilityPlaybookStep[]> = {};
  for (const step of steps.value) {
    (grouped[step.playbook_id] ??= []).push(step);
  }
  for (const list of Object.values(grouped)) {
    list.sort((a, b) => a.step_order - b.step_order);
  }
  return grouped;
});

let loadGen = 0;
async function load() {
  const gen = ++loadGen;
  loading.value = true;
  try {
    const client = getGraphqlClient();
    const { data } = await client.query({
      query: utilityPlaybooksQuery,
      variables: {
        where: {
          map_name: { _eq: props.mapName },
          can_view: { _eq: true },
        },
        order_by: [{ updated_at: order_by.desc }],
        limit: 100,
      },
      fetchPolicy: "network-only",
    });
    if (gen !== loadGen) {
      return;
    }
    playbooks.value = ((data as any)?.utility_playbooks ?? []) as UtilityPlaybook[];

    const ids = playbooks.value.map((entry) => entry.id);
    if (!ids.length) {
      steps.value = [];
      return;
    }

    // Every listed execute's steps in one round trip, then the lineups they
    // point at in a second -- a per-execute fetch would be N+1 for a list that
    // only wants to draw a strip of colours.
    const stepResult = await client.query({
      query: utilityPlaybookStepsQuery,
      variables: {
        where: { playbook_id: { _in: ids } },
        order_by: [{ step_order: order_by.asc }],
      },
      fetchPolicy: "network-only",
    });
    if (gen !== loadGen) {
      return;
    }
    steps.value = ((stepResult.data as any)?.utility_playbook_steps ??
      []) as UtilityPlaybookStep[];

    const lineupIds = [
      ...new Set(steps.value.map((step) => step.utility_lineup_id)),
    ];
    if (!lineupIds.length) {
      return;
    }
    lineupsLoading.value = true;
    const lineupResult = await client.query({
      query: utilityLineupsQuery(),
      variables: {
        where: { id: { _in: lineupIds }, can_view: { _eq: true } },
        order_by: [{ created_at: order_by.desc }],
        limit: lineupIds.length,
        offset: 0,
      },
      fetchPolicy: "network-only",
    });
    if (gen !== loadGen) {
      return;
    }
    const next: Record<string, UtilityLineup> = {};
    for (const lineup of ((lineupResult.data as any)?.utility_lineups ??
      []) as UtilityLineup[]) {
      next[lineup.id] = lineup;
    }
    lineupsById.value = next;
  } catch (error) {
    if (gen === loadGen) {
      console.error("[utility] execute load error:", error);
      playbooks.value = [];
      steps.value = [];
    }
  } finally {
    if (gen === loadGen) {
      loading.value = false;
      lineupsLoading.value = false;
    }
  }
}

// Which side's executes the list shows. In the URL like the plan's side: a
// refresh should land on the list you were reading.
const ANY_SIDE = "any";
const side = useRouteTab({
  param: "executeSide",
  defaultTab: ANY_SIDE,
  tabs: [ANY_SIDE, "TERRORIST", "CT"],
});
const sideOptions = computed(() => [
  { key: ANY_SIDE, label: t("common.any") },
  { key: "TERRORIST", label: t("pages.utility.sides.TERRORIST") },
  { key: "CT", label: t("pages.utility.sides.CT") },
]);

/**
 * An execute has a shape -- four smokes on one call is not the same thing as a
 * staggered eight-second push -- and the shape is what tells two of them apart
 * in a list. Each step becomes a tick placed at its real offset along the
 * execute's own span and coloured by what it throws, so the strip reads as a
 * fingerprint rather than a row of identical chips.
 */
const cards = computed(() =>
  playbooks.value
    .filter(
      (playbook) => side.value === ANY_SIDE || playbook.side === side.value,
    )
    .map((playbook) => {
      const own = stepsByPlaybook.value[playbook.id] ?? [];
      const span = Math.max(...own.map((step) => step.offset_ms ?? 0), 0);
      const seen = new Set<string>();
      const lineups: UtilityLineup[] = [];
      for (const step of own) {
        const lineup = lineupsById.value[step.utility_lineup_id];
        if (lineup && !seen.has(lineup.id)) {
          seen.add(lineup.id);
          lineups.push(lineup);
        }
      }
      return {
        playbook,
        count: own.length,
        duration: formatUtilityOffset(span),
        lineups,
        beats: own.map((step, index) => {
          const lineup = lineupsById.value[step.utility_lineup_id];
          return {
            key: `${step.id}-${index}`,
            color: lineup
              ? (UTILITY_TYPE_COLORS[lineup.utility_type] ?? "#ffffff")
              : "#52525b",
            // A single-beat execute has no span to place anything along, so it
            // sits at the start rather than dividing by zero into the middle.
            left: span > 0 ? ((step.offset_ms ?? 0) / span) * 100 : 0,
          };
        }),
      };
    }),
);

/**
 * Each throw wears its step number where it LANDS: several throws leave from
 * one spot, so numbers on the origin would pile up. A lineup thrown twice
 * wears both. Anything whose time has not come yet is drawn grey.
 */
function landingMarkers(
  list: Array<{ lineup: UtilityLineup | null; seconds: number }>,
  now: number | null = null,
): UtilityBoardMarker[] {
  const grouped = new Map<
    string,
    { lineup: UtilityLineup; numbers: number[]; seconds: number }
  >();
  list.forEach((entry, index) => {
    if (!entry.lineup) {
      return;
    }
    const group = grouped.get(entry.lineup.id) ?? {
      lineup: entry.lineup,
      numbers: [],
      seconds: entry.seconds,
    };
    group.numbers.push(index + 1);
    grouped.set(entry.lineup.id, group);
  });
  return [...grouped.values()].map((group) => ({
    key: group.lineup.id,
    point: utilityLanding(group.lineup) ?? utilityOrigin(group.lineup),
    color:
      now !== null && group.seconds > now
        ? "#52525b"
        : (UTILITY_TYPE_COLORS[group.lineup.utility_type] ?? "#ffffff"),
    label: group.numbers.join("·"),
    shape: "badge" as const,
  }));
}

// The open execute is an address: `?execute=<id>` is what a link to one looks
// like, and Back closes it.
const openId = computed(() =>
  typeof route.query.execute === "string" && route.query.execute
    ? route.query.execute
    : null,
);

function setOpen(id: string | null, mode: "push" | "replace") {
  const query = { ...route.query } as Record<string, unknown>;
  if (id) {
    query.execute = id;
  } else {
    delete query.execute;
  }
  const to = { path: route.path, query: query as any, hash: route.hash };
  if (mode === "push") {
    void router.push(to);
  } else {
    void router.replace(to);
  }
}

const current = computed(
  () => playbooks.value.find((entry) => entry.id === openId.value) ?? null,
);

// A link to an execute that is gone, or that was never on this map.
watch([loading, openId], ([isLoading, id]) => {
  if (!isLoading && id && !current.value) {
    setOpen(null, "replace");
  }
});

const creating = ref(false);
const editing = ref(false);
const mine = ref(false);
const confirming = ref(false);
const busy = ref(false);
const hoveredLineupId = ref<string | null>(null);
const previewId = ref<string | null>(null);
const rootHoveredId = ref<string | null>(null);
const editorBoard = ref<UtilityPanelBoard | null>(null);

// The views are drawn into the page's card, outside this panel, so they would
// outlive the tab by the length of its fade. They leave with the tab instead.
const onTab = computed(() => route.query.tab === "playbooks");

const viewOpen = computed(() => onTab.value && !!current.value);
const editorOpen = computed(
  () => onTab.value && (creating.value || (editing.value && !!current.value)),
);

watch(
  () => viewOpen.value || editorOpen.value,
  (value) => emit("cover", value),
  { immediate: true },
);

// Who is on the execute's team, so a step can say who throws it by name.
const roster = ref<Record<string, UtilityAuthorRef>>({});

let rosterGen = 0;
async function loadRoster(teamId: string | null) {
  const gen = ++rosterGen;
  if (!teamId) {
    roster.value = {};
    return;
  }
  try {
    const { data } = await getGraphqlClient().query({
      query: teamRosterQuery,
      variables: { id: teamId },
      fetchPolicy: "cache-first",
    });
    if (gen !== rosterGen) {
      return;
    }
    const next: Record<string, UtilityAuthorRef> = {};
    for (const entry of ((data as any)?.teams_by_pk?.roster ?? []) as Array<{
      player: UtilityAuthorRef | null;
    }>) {
      if (entry.player) {
        next[String(entry.player.steam_id)] = entry.player;
      }
    }
    roster.value = next;
  } catch (error) {
    if (gen === rosterGen) {
      console.error("[utility] execute roster load error:", error);
      roster.value = {};
    }
  }
}

watch(() => current.value?.team_id ?? null, loadRoster, { immediate: true });

function playerName(steamId: string | null | undefined) {
  if (!steamId) {
    return null;
  }
  const id = String(steamId);
  if (id === mySteamId.value) {
    return t("pages.utility.playbooks.you");
  }
  return roster.value[id]?.name ?? id;
}

const beats = computed<UtilityExecuteBeat[]>(() => {
  const playbook = current.value;
  if (!playbook) {
    return [];
  }
  const own = stepsByPlaybook.value[playbook.id] ?? [];
  // Where each lineup was first used, so a second helping can point at it.
  const firstUse = new Map<string, number>();
  let previous: number | null = null;
  return own.map((step, index) => {
    const lineup = lineupsById.value[step.utility_lineup_id] ?? null;
    const seconds = Number(formatUtilityOffset(step.offset_ms));
    const first = firstUse.get(step.utility_lineup_id);
    if (first === undefined) {
      firstUse.set(step.utility_lineup_id, index);
    }
    const showTime = previous !== seconds;
    previous = seconds;
    return {
      key: step.id,
      index,
      step,
      lineup,
      seconds,
      color: lineup
        ? (UTILITY_TYPE_COLORS[lineup.utility_type] ?? "#ffffff")
        : "#52525b",
      showTime,
      repeatOf: first === undefined ? null : first + 1,
      who: playerName(step.assigned_steam_id),
      mine:
        !!mySteamId.value &&
        String(step.assigned_steam_id ?? "") === mySteamId.value,
    };
  });
});

const duration = computed(() =>
  Math.max(0, ...beats.value.map((beat) => beat.seconds)),
);

const ownerName = computed(() => playerName(current.value?.owner_steam_id));
const teamName = computed(
  () =>
    myTeams.value.find((team) => team.id === current.value?.team_id)?.name ??
    null,
);

// Whether this map has a mesh to throw an execute in. Without one Play runs
// on the flat board alone, the way it always did.
const meshCdn = useRuntimeConfig().public.mapMeshCdn as string;
const hasMesh = ref(false);

watch(
  () => props.mapName,
  async (name) => {
    hasMesh.value = false;
    if (!name || !import.meta.client) {
      return;
    }
    const answer = await hasMeshForMap(meshCdn, name);
    if (props.mapName === name) {
      hasMesh.value = answer;
    }
  },
  { immediate: true },
);

/**
 * Play: the execute's own clock. On a map with a mesh it is thrown in 3D, in
 * the same scene a single lineup is replayed in, and the card's timeline and
 * the flat board light up along with it; on one without, those two are the
 * whole show. A step lights when its time comes -- the states change on the
 * tick -- so that part is the same with reduced motion.
 *
 * The clock lives here and the scene is handed it, so the dock's label, the
 * timeline and the grenades in the air are one run.
 */
const clock = ref<number | null>(null);
// The `performance.now()` the run started at. The clock moves in tenths; the
// scene reads the same run off this between its ticks.
const startedAt = ref<number | null>(null);
let timer: ReturnType<typeof setInterval> | null = null;

// The scene is asked for the first time Play is pressed and stays up after,
// showing the run it last played. Its camera has to arrive before anything is
// thrown, so the first Play waits for it; later ones start at once.
const scene = ref(false);
const awaitingScene = ref(false);
let sceneFramed = false;

const playing = computed(() => clock.value !== null || awaitingScene.value);

// In the scene a run lasts until the last grenade is down. On the flat board
// nothing flies, so it ends with the last throw.
const runEnd = computed(() => {
  if (!scene.value) {
    return duration.value;
  }
  return Math.max(
    duration.value,
    ...beats.value.map((beat) =>
      beat.lineup ? beat.seconds + executeFlightSeconds(beat.lineup) : 0,
    ),
  );
});

function stopClock() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  awaitingScene.value = false;
  clock.value = null;
  startedAt.value = null;
}

function startClock() {
  const epoch = performance.now();
  startedAt.value = epoch;
  clock.value = 0;
  timer = setInterval(() => {
    const now = (performance.now() - epoch) / 1000;
    // A beat held after the end, so the end reads as an end.
    if (now > runEnd.value + 1) {
      stopClock();
      return;
    }
    clock.value = Math.round(now * 10) / 10;
  }, 100);
}

function play() {
  stopClock();
  mine.value = false;
  confirming.value = false;
  if (!hasMesh.value) {
    startClock();
    return;
  }
  scene.value = true;
  if (sceneFramed) {
    startClock();
    return;
  }
  awaitingScene.value = true;
}

// The scene says so every time its camera settles; only the first Play is
// waiting on it.
function onSceneFramed() {
  sceneFramed = true;
  if (awaitingScene.value) {
    awaitingScene.value = false;
    startClock();
  }
}

// The scene goes when the view it is in does: it is rebuilt, and flown into
// again, the next time Play is pressed.
function dropScene() {
  scene.value = false;
  sceneFramed = false;
}

// A clock nobody is watching is a clock that has drifted by the time they
// come back to it.
function onVisibility() {
  if (document.hidden) {
    stopClock();
  }
}

onMounted(() => document.addEventListener("visibilitychange", onVisibility));
onBeforeUnmount(() => {
  document.removeEventListener("visibilitychange", onVisibility);
  stopClock();
  // The address goes with the tab: an execute left in the URL would reopen
  // the next time this tab did.
  if (route.query.execute) {
    setOpen(null, "replace");
  }
});

// How many steps the clock has reached. The board is redrawn on this rather
// than on the clock, which moves ten times a second.
const reached = computed(() =>
  clock.value === null
    ? null
    : beats.value.filter((beat) => beat.seconds <= clock.value!).length,
);

const clockLabel = computed(() =>
  t("pages.utility.playbooks.clock_of", {
    now: Math.min(clock.value ?? 0, runEnd.value).toFixed(1),
    total: runEnd.value.toFixed(1),
  }),
);

// Leaving an execute, or opening another, starts it from the top.
watch(openId, () => {
  stopClock();
  dropScene();
  mine.value = false;
  confirming.value = false;
  editing.value = false;
  hoveredLineupId.value = null;
});

watch(onTab, (value) => {
  if (!value) {
    stopClock();
  }
});

watch(viewOpen, (value) => {
  if (!value) {
    dropScene();
  }
});

watch(
  () => props.mapName,
  () => {
    playbooks.value = [];
    steps.value = [];
    lineupsById.value = {};
    creating.value = false;
    editing.value = false;
    editorBoard.value = null;
    previewId.value = null;
    stopClock();
    dropScene();
    reset();
    if (route.query.execute) {
      setOpen(null, "replace");
    }
  },
);

watch(() => props.mapName, load, { immediate: true });

const preview = computed(
  () => cards.value.find((card) => card.playbook.id === previewId.value) ?? null,
);

// Every lineup the listed executes use, once each.
const usedLineups = computed(() => {
  const seen = new Set<string>();
  const out: UtilityLineup[] = [];
  for (const card of cards.value) {
    for (const lineup of card.lineups) {
      if (!seen.has(lineup.id)) {
        seen.add(lineup.id);
        out.push(lineup);
      }
    }
  }
  return out;
});

function previewMarkers(playbookId: string) {
  return landingMarkers(
    (stepsByPlaybook.value[playbookId] ?? []).map((step) => ({
      lineup: lineupsById.value[step.utility_lineup_id] ?? null,
      seconds: (step.offset_ms ?? 0) / 1000,
    })),
  );
}

// The page already owns a map. Rather than draw a second one, whatever this
// tab is showing is what the map is showing: the draft while one is being
// written, the open execute numbered in throw order, the row under the
// pointer, or every lineup the executes here are built from.
//
// Deliberately no hand-back on unmount: the panel leaves through a crossfade,
// so its unmount lands AFTER the next tab's panel has published its own board
// -- clearing on the way out would wipe it.
watch(
  [
    editorOpen,
    editorBoard,
    current,
    beats,
    reached,
    hoveredLineupId,
    () => props.openLineupId,
    preview,
    usedLineups,
    rootHoveredId,
  ],
  () => {
    if (editorOpen.value) {
      emit("board", editorBoard.value);
      return;
    }

    if (current.value) {
      const now = clock.value;
      const seen = new Set<string>();
      const drawn: UtilityLineup[] = [];
      for (const beat of beats.value) {
        // While the clock runs, a throw's line arrives with the throw.
        if (
          beat.lineup &&
          !seen.has(beat.lineup.id) &&
          (now === null || beat.seconds <= now)
        ) {
          seen.add(beat.lineup.id);
          drawn.push(beat.lineup);
        }
      }
      emit("board", {
        lineups: drawn,
        markers: landingMarkers(beats.value, now),
        showAllLines: true,
        selectedId: props.openLineupId,
        hoveredId: hoveredLineupId.value,
        onSelect: (id: string | null) => {
          const index = beats.value.findIndex((beat) => beat.lineup?.id === id);
          if (index >= 0) {
            openStep(index);
          }
        },
        onHover: (id: string | null) => {
          hoveredLineupId.value = id;
        },
      });
      return;
    }

    if (preview.value) {
      emit("board", {
        lineups: preview.value.lineups,
        markers: previewMarkers(preview.value.playbook.id),
        showAllLines: true,
      });
      return;
    }

    emit("board", {
      lineups: usedLineups.value,
      hoveredId: rootHoveredId.value,
      onSelect: (id: string | null) => {
        if (id) {
          emit("open-lineup", id);
        }
      },
      onHover: (id: string | null) => {
        rootHoveredId.value = id;
      },
    });
  },
  { immediate: true },
);

function open(id: string) {
  previewId.value = null;
  setOpen(id, openId.value ? "replace" : "push");
}

function close() {
  setOpen(null, "replace");
}

// A step opens its lineup in the page's own lineup view, with one line saying
// where in the execute it sits. Back from there lands here again.
function openStep(index: number) {
  const playbook = current.value;
  const beat = beats.value[index];
  if (!playbook || !beat?.lineup) {
    return;
  }
  stopClock();
  // The lineup's panel sets this as text and splits it on the ** marks for
  // emphasis, so what a player typed is never read as markup.
  const values = {
    step: index + 1,
    count: beats.value.length,
    name: `**${playbook.name}**`,
    seconds: beat.seconds.toFixed(1),
    player: beat.who ?? "",
  };
  emit("open-lineup", beat.lineup.id, {
    text: beat.mine
      ? t("pages.utility.playbooks.step_context_you", values)
      : beat.who
        ? t("pages.utility.playbooks.step_context_by", values)
        : t("pages.utility.playbooks.step_context", values),
  });
}

// What the editor starts from: the open execute's steps, or nothing.
const editorSteps = computed(() =>
  creating.value || !current.value
    ? []
    : (stepsByPlaybook.value[current.value.id] ?? []),
);

function startCreate() {
  stopClock();
  editing.value = false;
  creating.value = true;
}

function startEdit() {
  stopClock();
  // The editor draws on the map, so the scene gives the square back.
  dropScene();
  confirming.value = false;
  creating.value = false;
  editing.value = true;
}

function closeEditor() {
  creating.value = false;
  editing.value = false;
  editorBoard.value = null;
}

async function onSaved(id: string) {
  const wasNew = creating.value;
  closeEditor();
  await load();
  if (id !== openId.value) {
    setOpen(id, wasNew ? "push" : "replace");
  }
}

async function onDeleted() {
  closeEditor();
  close();
  await load();
}

// Already standing on a practice server for this map? Then practising an
// execute is one call away, with no booking form in between. Otherwise the
// page opens its server panel with this execute chosen.
const practiceLoad = useUtilityLoad();
const practiceSession = useUtilityPracticeSession();

onMounted(() => void practiceLoad.check());

// Only on offer while there is a server on this map to load it into; until
// then the bar is where one is started, with this execute chosen.
const barOffer = computed<UtilityBarOffer | null>(() => {
  const playbook = current.value;
  if (!playbook || !props.canPractice || editorOpen.value) {
    return null;
  }
  const reachable =
    practiceLoad.canLoad(props.mapName) && !!practiceSession.session.value?.id;
  return {
    target: { playbookId: playbook.id },
    actions:
      reachable && beats.value.length
        ? [
            {
              kind: "run",
              key: "execute",
              label: t("pages.utility.practice.start"),
              run: practice,
              disabled: busy.value,
            },
          ]
        : [],
  };
});

watch(barOffer, (offer) => emit("bar", offer), { immediate: true });

async function practice() {
  const playbook = current.value;
  if (!playbook || busy.value) {
    return;
  }
  stopClock();
  const sessionId = practiceSession.session.value?.id;
  if (!practiceLoad.canLoad(props.mapName) || !sessionId) {
    emit("practice", { playbookId: playbook.id });
    return;
  }
  busy.value = true;
  try {
    await getGraphqlClient().mutate({
      mutation: loadUtilityPlaybookIntoSessionMutation,
      variables: { session_id: sessionId, playbook_id: playbook.id },
    });
    toast({
      title: t("pages.utility.playbooks.loaded", { name: playbook.name }),
    });
  } catch (error: any) {
    toast({
      title: t("pages.utility.playbooks.load_failed"),
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    busy.value = false;
  }
}

// A copy is yours and private: the team and who throws what belong to the
// execute it was copied from.
async function duplicate() {
  const playbook = current.value;
  if (!playbook || busy.value) {
    return;
  }
  stopClock();
  busy.value = true;
  try {
    const copied: UtilityPlaybookStepInput[] = (
      stepsByPlaybook.value[playbook.id] ?? []
    ).map((step) => ({
      utility_lineup_id: step.utility_lineup_id,
      offset_ms: step.offset_ms ?? 0,
      assigned_steam_id: null,
      note: step.note,
    }));
    const { data } = await getGraphqlClient().mutate({
      mutation: saveUtilityPlaybookMutation,
      variables: {
        playbook_id: null,
        name: t("pages.utility.playbooks.copy_name", {
          name: playbook.name,
        }).slice(0, 120),
        description: playbook.description,
        map_name: playbook.map_name,
        side: playbook.side,
        team_id: null,
        visibility: "Private",
        steps: copied,
      },
    });
    const id = (data as any)?.saveUtilityPlaybook?.id;
    if (!id) {
      throw new Error("no playbook");
    }
    toast({ title: t("pages.utility.playbooks.copied") });
    await load();
    setOpen(id, "replace");
  } catch (error: any) {
    toast({
      title: t("pages.utility.playbooks.copy_failed"),
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    busy.value = false;
  }
}

async function copyLink() {
  const playbook = current.value;
  if (!playbook || typeof window === "undefined") {
    return;
  }
  const href = router.resolve({
    path: route.path,
    query: { tab: "playbooks", execute: playbook.id },
  }).href;
  try {
    await navigator.clipboard.writeText(`${window.location.origin}${href}`);
    toast({ title: t("toasts.link_copied") });
  } catch {
    toast({ title: t("toasts.copy_failed"), variant: "destructive" });
  }
}

async function destroy() {
  const playbook = current.value;
  if (!playbook || busy.value) {
    return;
  }
  busy.value = true;
  try {
    await getGraphqlClient().mutate({
      mutation: deleteUtilityPlaybookMutation,
      variables: { playbook_id: playbook.id },
    });
    toast({ title: t("pages.utility.playbooks.deleted") });
    confirming.value = false;
    close();
    await load();
  } catch (error: any) {
    confirming.value = false;
    toast({
      title: t("pages.utility.playbooks.delete_failed"),
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <!-- Which side, and the way to start a new one. The switch only appears
         once there is something to switch between. -->
    <div class="flex min-h-8 items-center gap-2">
      <AnimatedFilters
        v-if="playbooks.length"
        v-model="side"
        :options="sideOptions"
        square
      />
      <span class="flex-1" />
      <Button
        variant="outline"
        size="sm"
        class="h-8 border-white/10 px-2.5 font-mono text-[0.64rem] font-bold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        @click="startCreate()"
      >
        <Plus class="mr-1 h-3.5 w-3.5" />
        {{ $t("pages.utility.playbooks.new_short") }}
      </Button>
    </div>

    <!-- One dissolve for every state this column can be in, and it measures:
         the leaver fades where it stands and the shell eases to the entering
         side's height, so nothing below it moves twice. -->
    <HeightSwap>
      <UtilitySkeletonList
        v-if="skeleton"
        key="loading"
        :count="3"
        shape="block"
      />

      <p
        v-else-if="!playbooks.length"
        key="empty"
        class="px-0.5 text-xs leading-relaxed text-muted-foreground"
      >
        {{
          $t("pages.utility.playbooks.empty_line", {
            map: cleanMapName(mapName),
          })
        }}
      </p>

      <p
        v-else-if="!cards.length"
        key="empty-side"
        class="px-0.5 text-xs leading-relaxed text-muted-foreground"
      >
        {{
          $t("pages.utility.playbooks.empty_side", {
            side: $t(`pages.utility.sides.${side}`),
            map: cleanMapName(mapName),
          })
        }}
      </p>

      <div
        v-else
        key="list"
        class="flex flex-col gap-2 transition-opacity [transition-duration:180ms]"
        :class="refreshing ? 'pointer-events-none opacity-50' : ''"
      >
        <!-- One execute per row, and the row is the only button: reading it,
             practising it and changing it all start from opening it. -->
        <UtilityRow
          v-for="card of cards"
          :key="card.playbook.id"
          :hovered="previewId === card.playbook.id"
          @select="open(card.playbook.id)"
          @hover="
            (on) =>
              (previewId = on
                ? card.playbook.id
                : previewId === card.playbook.id
                  ? null
                  : previewId)
          "
        >
          <template #thumb>
            <UtilitySetThumb :map-name="mapName" :lineups="card.lineups" />
          </template>

          {{ card.playbook.name }}

          <template v-if="!card.playbook.can_edit" #badges>
            <FiveStackToolTip as-child :delay-duration="120">
              <template #trigger>
                <span class="inline-flex shrink-0 text-muted-foreground">
                  <Lock class="h-3 w-3" />
                  <span class="sr-only">
                    {{ $t("pages.utility.playbooks.view_only") }}
                  </span>
                </span>
              </template>
              {{ $t("pages.utility.playbooks.view_only") }}
            </FiveStackToolTip>
          </template>

          <template #line2>
            <span class="truncate">
              <span class="text-foreground">
                {{ $t(`pages.utility.sides.${card.playbook.side}`) }}
              </span>
              <span aria-hidden="true" class="mx-1.5 text-border">/</span>
              {{
                $t("pages.utility.playbooks.duration", {
                  seconds: card.duration,
                })
              }}
              <span aria-hidden="true" class="mx-1.5 text-border">/</span>
              {{ $t(`pages.utility.visibility.${card.playbook.visibility}`) }}
            </span>
          </template>

          <template #right>
            <span class="flex w-10 shrink-0 flex-col items-end">
              <span class="text-lg font-bold leading-none tabular-nums">
                {{ card.count }}
              </span>
              <span
                class="mt-1 font-mono text-[0.53rem] font-medium uppercase leading-none tracking-[0.1em] text-muted-foreground"
              >
                {{ $t("pages.utility.playbooks.step_word", card.count) }}
              </span>
            </span>
          </template>

          <!-- The execute's own clock, drawn to scale: where the ticks bunch
               is where the calls bunch. -->
          <template v-if="card.beats.length" #under>
            <span
              aria-hidden="true"
              class="relative ml-[3.125rem] mr-12 mt-1 block h-3.5"
            >
              <span
                class="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/10"
              />
              <span
                v-for="beat of card.beats"
                :key="beat.key"
                class="absolute top-1/2 h-3 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                :style="{
                  left: `calc(${beat.left}% * 0.96 + 2%)`,
                  backgroundColor: beat.color,
                }"
              />
            </span>
          </template>
        </UtilityRow>
      </div>
    </HeightSwap>

    <!-- The execute, read. Everything you can do with it is the dock. -->
    <UtilityCardView
      :open="viewOpen"
      :label="current?.name ?? null"
      @back="close()"
    >
      <template v-if="current" #kicker>
        <span class="truncate">
          {{
            $t("pages.utility.playbooks.kicker", {
              map: cleanMapName(current.map_name),
            })
          }}
        </span>
        <!-- Which side runs it, as the side's own mark. -->
        <FiveStackToolTip as-child :delay-duration="120">
          <template #trigger>
            <img
              :src="
                current.side === 'CT'
                  ? '/img/teams/ct_logo.svg'
                  : '/img/teams/t_logo.svg'
              "
              :alt="$t(`pages.utility.sides.${current.side}`)"
              class="-my-1 size-[1.125rem] shrink-0 -translate-y-px"
            />
          </template>
          {{ $t(`pages.utility.sides.${current.side}`) }}
        </FiveStackToolTip>
      </template>

      <UtilityExecuteView
        v-if="current"
        v-model:mine="mine"
        :playbook="current"
        :beats="beats"
        :owner="ownerName"
        :team="teamName"
        :clock="clock"
        :started-at="startedAt"
        :scene="scene"
        :hovered-lineup-id="hoveredLineupId"
        :lineups-loading="lineupsLoading"
        @step="openStep"
        @hover="(id) => (hoveredLineupId = id)"
        @framed="onSceneFramed"
        @close-scene="
          stopClock();
          dropScene();
        "
      />

      <template v-if="current" #dock>
        <!-- While it plays -- or the scene is still flying in to play it --
             the row is the clock and the way to stop it. -->
        <template v-if="playing">
          <span class="pr-1 text-xs tabular-nums text-muted-foreground">
            {{ clockLabel }}
          </span>
          <Button
            size="sm"
            class="tac-amber-cta h-8 px-3.5 text-[13px] font-semibold"
            @click="stopClock()"
          >
            {{ $t("pages.utility.playbooks.stop") }}
          </Button>
        </template>

        <!-- Deleting is confirmed where it was asked for. -->
        <template v-else-if="confirming">
          <span class="min-w-0 truncate text-xs text-muted-foreground">
            {{ $t("pages.utility.playbooks.delete_ask") }}
          </span>
          <UtilityDockButton wide @click="confirming = false">
            {{ $t("common.cancel") }}
          </UtilityDockButton>
          <UtilityDockButton wide danger :disabled="busy" @click="destroy()">
            {{ $t("common.delete") }}
          </UtilityDockButton>
        </template>

        <template v-else>
          <UtilityDockButton wide :disabled="!beats.length" @click="play()">
            <Play class="h-3.5 w-3.5" />
            {{ $t("pages.utility.playbooks.play") }}
          </UtilityDockButton>
          <template v-if="current.can_edit">
            <UtilityDockButton wide @click="startEdit()">
              <PencilLine class="h-3.5 w-3.5" />
              {{ $t("common.edit") }}
            </UtilityDockButton>
            <UtilityDockMenu>
              <DropdownMenuItem :disabled="busy" @click="duplicate()">
                {{ $t("pages.utility.playbooks.duplicate") }}
              </DropdownMenuItem>
              <DropdownMenuItem @click="copyLink()">
                {{ $t("pages.utility.playbooks.copy_link") }}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                class="text-destructive focus:text-destructive"
                @click="confirming = true"
              >
                {{ $t("pages.utility.playbooks.delete") }}
              </DropdownMenuItem>
            </UtilityDockMenu>
          </template>
          <!-- Somebody else's: you can read it and take a copy of your own. -->
          <template v-else>
            <UtilityDockButton wide :disabled="busy" @click="duplicate()">
              <Copy class="h-3.5 w-3.5" />
              {{ $t("pages.utility.playbooks.save_copy") }}
            </UtilityDockButton>
            <UtilityDockButton
              :tip="$t('pages.utility.playbooks.copy_link')"
              @click="copyLink()"
            >
              <Link2 class="h-4 w-4" />
            </UtilityDockButton>
          </template>
        </template>
      </template>
    </UtilityCardView>

    <!-- Writing one, or changing the one that is open: over the read view,
         in the same card. -->
    <UtilityPlaybookEditor
      :open="editorOpen"
      :map-name="mapName"
      :playbook="creating ? null : current"
      :steps="editorSteps"
      :types="types"
      @board="(state) => (editorBoard = state)"
      @saved="onSaved"
      @deleted="onDeleted"
      @cancel="closeEditor"
      @toggle-type="(type) => emit('toggle-type', type)"
    />
  </div>
</template>
