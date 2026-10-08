<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Lock,
  MapPin,
  Plus,
  Repeat2,
  Trash2,
  TriangleAlert,
  User,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { DropdownMenuItem } from "~/components/ui/dropdown-menu";
import Fold from "~/components/ui/transitions/Fold.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import UtilityCardView from "~/components/utility/UtilityCardView.vue";
import UtilityDockButton from "~/components/utility/UtilityDockButton.vue";
import UtilityDockMenu from "~/components/utility/UtilityDockMenu.vue";
import UtilityExecutePicker from "~/components/utility/UtilityExecutePicker.vue";
import UtilitySectionHead from "~/components/utility/UtilitySectionHead.vue";
import UtilitySegmented from "~/components/utility/UtilitySegmented.vue";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { toast } from "~/components/ui/toast";
import UtilityPlaybookCoveragePanel from "~/components/utility/UtilityPlaybookCoveragePanel.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  deleteUtilityPlaybookMutation,
  utilityLineupsQuery,
  saveUtilityPlaybookMutation,
  teamRosterQuery,
} from "~/graphql/utilityGraphql";
import { order_by } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import {
  UTILITY_CARRY_LIMITS,
  UTILITY_CARRY_TOTAL,
  UTILITY_EXECUTE_FOLLOW_UP_SECONDS,
  UTILITY_PLAYBOOK_MAX_STEPS,
  UTILITY_PLAYBOOK_MIN_OFFSET_SECONDS,
  UTILITY_PLAYBOOK_OFFSET_STEP_SECONDS,
  UTILITY_SIDES,
  UTILITY_TYPE_COLORS,
  formatUtilityOffset,
  parseUtilityOffset,
  utilityLandingOffsets,
  utilityLanding,
  utilityOrigin,
} from "~/utilities/utilityDisplay";
import type {
  UtilityBoardMarker,
  UtilityPanelBoard,
} from "~/utilities/utilityDisplay";
import type {
  UtilityAuthorRef,
  UtilityLineup,
  UtilityPlaybook,
  UtilityPlaybookStep,
  UtilityPlaybookStepInput,
  UtilitySide,
  UtilityType,
  UtilityVisibility,
} from "~/types/utility";

/**
 * An execute being written or changed, as a view of its own over the one you
 * were reading: Cancel is the way out, the form is the body, and Save and
 * delete live in the dock. Adding a throw opens the lineups over this, in the
 * same card, rather than in a dialog over the page.
 */
const props = withDefaults(
  defineProps<{
    open: boolean;
    mapName: string;
    playbook?: UtilityPlaybook | null;
    steps?: UtilityPlaybookStep[];
    /** The page's one type filter, for the list throws are picked from. */
    types?: UtilityType[];
  }>(),
  {
    playbook: null,
    steps: () => [],
    types: () => [],
  },
);

const emit = defineEmits<{
  (e: "saved", id: string): void;
  (e: "deleted", id: string): void;
  (e: "cancel"): void;
  (e: "board", state: UtilityPanelBoard): void;
  (e: "toggle-type", type: UtilityType): void;
}>();

const { t } = useI18n();

// Reka Select rejects an empty-string value, so "unset" rides a sentinel —
// same shape as the practice dialog's region/collection pickers.
const NO_TEAM = "none";
const NO_ASSIGNEE = "none";

const VISIBILITIES: UtilityVisibility[] = ["Private", "Team", "Public"];

// Side and visibility are two words each. A <Select> spends a label, a shell
// and a round trip to hide two words; shown open they cost one row together.
const sideOptions = computed(() =>
  UTILITY_SIDES.map((entry) => ({
    key: entry,
    label: t(`pages.utility.sides.${entry}`),
  })),
);
const visibilityOptions = computed(() =>
  VISIBILITIES.map((entry) => ({
    key: entry,
    label: t(`pages.utility.visibility.${entry}`),
  })),
);

type StepRow = {
  key: string;
  lineupId: string;
  offsetSeconds: string;
  assignedSteamId: string;
  note: string;
  // Set by hand: how long after the smokes land it is thrown. Null while the
  // editor times it.
  lockOffset: number | null;
};

const auth = useAuthStore();
const myTeams = computed(
  () =>
    (auth.me?.teams ?? []) as Array<{
      id: string;
      name: string;
      short_name?: string | null;
    }>,
);

const name = ref("");
const description = ref("");
const side = ref<UtilitySide>("TERRORIST");
const teamId = ref<string>(NO_TEAM);
const visibility = ref<UtilityVisibility>("Private");
const rows = ref<StepRow[]>([]);
const selectedKey = ref<string | null>(null);
const pickerOpen = ref(false);
const confirmDelete = ref(false);
// Coverage draws sightlines on the same board rather than a third copy of the
// map, so while it is open it owns what the page draws and the editor stands
// down instead of fighting it for the surface.
const coverageBoard = ref<UtilityPanelBoard | null>(null);
const saving = ref(false);

const lineupsById = ref<Record<string, UtilityLineup>>({});
// Steps arrive before the lineups they point at. Until that round trip lands,
// every row is "unavailable" and the editor is shouting that the execute is
// broken -- for about 200ms, at the exact moment it opens.
const lineupsLoading = ref(false);
const roster = ref<UtilityAuthorRef[]>([]);

/**
 * Reordering by hand, the way icons move on a phone's home screen. The row you
 * pick up by its grip comes off the list and stays under the pointer; the rows
 * it passes slide into the room it left as it passes them; let go, and it
 * glides into the slot that has opened. Only then is the order written.
 *
 * Until that moment the list itself has not changed -- every row is where it
 * always was, moved by a transform -- which is what lets a drop be cancelled
 * by simply letting the transforms go.
 */
const dragKey = ref<string | null>(null);
const dragFrom = ref(-1);
const dragTo = ref(-1);
// The picked-up row's height: how far the rows it passes have to slide.
const dragHeight = ref(0);
// "held" while it is under the pointer; "landing" while it glides to its slot
// (or back, when the drag was called off) and nothing else can be picked up.
const dragPhase = ref<"held" | "landing" | null>(null);
// For the one flush that writes the new order. The list's own move animation
// measures rows with whatever transform they are wearing, so it has to sit
// that flush out: the rows are already where they are going.
const committing = ref(false);

const LAND_MS = 200;
// How close to the scrolling body's edge a held row starts to scroll it, and
// the most it scrolls per frame.
const SCROLL_EDGE_PX = 56;
const SCROLL_MAX_PX = 14;

type StepDrag = {
  pointerId: number;
  handle: HTMLElement;
  row: HTMLElement;
  scroller: HTMLElement | null;
  startY: number;
  lastY: number;
  scrollStart: number;
  // Every row as it stood when the drag began. Rows are different heights --
  // a note line, a step open for editing -- so nothing here assumes one.
  rects: Array<{ top: number; height: number }>;
  minDy: number;
  maxDy: number;
  dy: number;
  frame: number;
  timer: ReturnType<typeof setTimeout> | null;
  onEnd: ((event: TransitionEvent) => void) | null;
};

// Not reactive: it changes on every pointer move, and the only thing that
// reads it is the code that moves the row.
let stepDrag: StepDrag | null = null;

// UtilitySegmented speaks plain strings; these keep the typed refs honest.
const sideModel = computed<string>({
  get: () => side.value,
  set: (value) => (side.value = value as UtilitySide),
});
const visibilityModel = computed<string>({
  get: () => visibility.value,
  set: (value) => (visibility.value = value as UtilityVisibility),
});

let rowSeed = 0;
function nextKey() {
  rowSeed += 1;
  return `step-${rowSeed}`;
}

function secondsOf(row: StepRow) {
  return Number(row.offsetSeconds) || 0;
}

function offsetText(seconds: number) {
  return formatUtilityOffset(parseUtilityOffset(seconds));
}

/**
 * The order IS the clock: a step never sits above one that lands before it.
 * Everything that changes a time or a place puts the two back in agreement, so
 * "this step lands before the one above it" is not a state the list can be in
 * and nothing has to complain about it. Stable, because two throws on the same
 * call are one moment -- that is allowed -- and keep the order they were given.
 */
function inTimeOrder(list: StepRow[]) {
  return list
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) => secondsOf(a.row) - secondsOf(b.row) || a.index - b.index,
    )
    .map((entry) => entry.row);
}

/**
 * Timed to land together. Every flight time is known, so instead of asking
 * for a second per throw the editor works them back from the landings: the
 * smokes land at once, the rest a few seconds after. Adding, repeating or
 * removing a step works the whole thing out again.
 *
 * A time you set yourself -- typed, or a step dragged or moved -- is locked:
 * kept when steps come and go, as its distance from the moment the smokes
 * land, so if everything moves it moves with it. The lock on a step gives it
 * back; Re-time all gives every step back.
 */
// When the smokes land, on the clock. Everything is placed against it.
const smokesLand = ref(UTILITY_PLAYBOOK_MIN_OFFSET_SECONDS);
// A stored execute is not worked out again until it is known which of its
// times it would give and which were set by hand.
const timingReady = ref(true);

function landingOffsets() {
  return utilityLandingOffsets(
    rows.value.map((row) => ({
      lineup: lineupsById.value[row.lineupId] ?? null,
    })),
  );
}

/**
 * Puts every step on its time. Worked out from scratch, the first throw goes
 * on the first second; otherwise the smokes stay where they land, and only
 * move later if something would be thrown before the clock starts.
 */
function retime(fromScratch: boolean) {
  if (!timingReady.value || !rows.value.length) {
    return;
  }
  const auto = landingOffsets();
  const offsets = rows.value.map(
    (row, index) =>
      row.lockOffset ?? auto[index] ?? secondsOf(row) - smokesLand.value,
  );
  const earliest = UTILITY_PLAYBOOK_MIN_OFFSET_SECONDS - Math.min(...offsets);
  smokesLand.value = fromScratch
    ? earliest
    : Math.max(smokesLand.value, earliest);
  rows.value.forEach((row, index) => {
    const seconds = Math.round((smokesLand.value + offsets[index]) * 10) / 10;
    if (secondsOf(row) !== seconds) {
      row.offsetSeconds = offsetText(seconds);
    }
  });
  sortByTime();
}

function lockTime(row: StepRow) {
  row.lockOffset = secondsOf(row) - smokesLand.value;
}

function unlockTime(row: StepRow) {
  row.lockOffset = null;
  retime(true);
}

function retimeAll() {
  for (const row of rows.value) {
    row.lockOffset = null;
  }
  retime(true);
}

const lockedSteps = computed(
  () =>
    rows.value.filter(
      (row) => row.lockOffset !== null && lineupsById.value[row.lineupId],
    ).length,
);

// Anything that changes what is thrown -- a step added, repeated or taken
// away, or a lineup's flight arriving -- is worked out again. The order is not
// part of it: putting the steps in time order is not a change to what is in it.
watch(
  [
    () =>
      rows.value
        .map((row) => `${row.key}:${row.lineupId}`)
        .sort()
        .join(","),
    lineupsById,
  ],
  () => retime(true),
);

/**
 * A stored execute, once its flights are known: the times that agree on one
 * moment for the smokes are the worked-out ones, and every other time was set
 * by hand. An execute timed before any of this agrees on nothing, so it opens
 * with every step locked, as it was written -- and Re-time all works it out.
 */
function readTiming() {
  const auto = landingOffsets();
  const moments = rows.value.map((row, index) =>
    auto[index] === null ? null : secondsOf(row) - (auto[index] as number),
  );
  const near = (a: number, b: number) => Math.abs(a - b) < 0.051;
  let moment: number | null = null;
  let agree = 0;
  for (const candidate of moments) {
    if (candidate === null) {
      continue;
    }
    const count = moments.filter(
      (other) => other !== null && near(other, candidate),
    ).length;
    if (count > agree) {
      agree = count;
      moment = candidate;
    }
  }
  const worked = moment !== null && (agree >= 2 || rows.value.length === 1);
  smokesLand.value = worked
    ? (moment as number)
    : UTILITY_PLAYBOOK_MIN_OFFSET_SECONDS;
  rows.value.forEach((row, index) => {
    const own = moments[index];
    row.lockOffset =
      worked && own !== null && near(own, moment as number)
        ? null
        : secondsOf(row) - smokesLand.value;
  });
  timingReady.value = true;
}

/** Puts the steps in time order; says whether anything had to move. */
function sortByTime() {
  const sorted = inTimeOrder(rows.value);
  if (sorted.every((row, index) => row === rows.value[index])) {
    return false;
  }
  rows.value = sorted;
  return true;
}

async function loadLineups(ids: string[]) {
  const missing = ids.filter((id) => !lineupsById.value[id]);
  if (!missing.length) {
    return;
  }
  lineupsLoading.value = true;
  try {
    const { data } = await getGraphqlClient().query({
      query: utilityLineupsQuery(),
      variables: {
        where: { id: { _in: missing }, can_view: { _eq: true } },
        order_by: [{ created_at: order_by.desc }],
        limit: missing.length,
        offset: 0,
      },
      fetchPolicy: "network-only",
    });
    const next = { ...lineupsById.value };
    for (const lineup of ((data as any)?.utility_lineups ?? []) as UtilityLineup[]) {
      next[lineup.id] = lineup;
    }
    lineupsById.value = next;
  } catch (error) {
    console.error("[utility] playbook lineup load error:", error);
  } finally {
    lineupsLoading.value = false;
  }
}

async function loadRoster(id: string | null) {
  if (!id) {
    roster.value = [];
    return;
  }
  try {
    const { data } = await getGraphqlClient().query({
      query: teamRosterQuery,
      variables: { id },
      fetchPolicy: "cache-first",
    });
    roster.value = (((data as any)?.teams_by_pk?.roster ?? []) as Array<{
      player: UtilityAuthorRef | null;
    }>)
      .map((entry) => entry.player)
      .filter((player): player is UtilityAuthorRef => !!player);
  } catch (error) {
    console.error("[utility] playbook roster load error:", error);
    roster.value = [];
  }
}

function resetForm() {
  const playbook = props.playbook;
  name.value = playbook?.name ?? "";
  description.value = playbook?.description ?? "";
  side.value = playbook?.side ?? "TERRORIST";
  teamId.value = playbook?.team_id ?? NO_TEAM;
  // A new execute is yours until you say otherwise.
  visibility.value = playbook?.visibility ?? "Private";
  timingReady.value = !playbook;
  smokesLand.value = UTILITY_PLAYBOOK_MIN_OFFSET_SECONDS;
  rows.value = inTimeOrder(
    [...(props.steps ?? [])]
      .sort((a, b) => a.step_order - b.step_order)
      .map((step) => ({
        key: nextKey(),
        lineupId: step.utility_lineup_id,
        offsetSeconds: formatUtilityOffset(step.offset_ms),
        assignedSteamId: step.assigned_steam_id ?? NO_ASSIGNEE,
        note: step.note ?? "",
        lockOffset: null,
      })),
  );
  selectedKey.value = null;
  pickerOpen.value = false;
  confirmDelete.value = false;
  coverageBoard.value = null;
  const token = ++resetToken;
  void loadLineups(rows.value.map((row) => row.lineupId)).then(() => {
    if (token === resetToken && playbook) {
      readTiming();
    }
  });
}

let resetToken = 0;

// Each opening starts from what is stored: a draft you cancelled out of is
// not what you meant to come back to.
watch(
  () => [props.open, props.playbook?.id ?? null] as const,
  ([isOpen]) => {
    if (isOpen) {
      resetForm();
    } else {
      dropDrag();
      pickerOpen.value = false;
      confirmDelete.value = false;
    }
  },
  { immediate: true },
);

watch(
  teamId,
  (id) => {
    void loadRoster(id === NO_TEAM ? null : id);
  },
  { immediate: true },
);

const orderedLineups = computed(() =>
  rows.value
    .map((row) => lineupsById.value[row.lineupId])
    .filter((lineup): lineup is UtilityLineup => !!lineup),
);

const selectedLineupId = computed(() => {
  const row = rows.value.find((entry) => entry.key === selectedKey.value);
  return row?.lineupId ?? null;
});

const atStepLimit = computed(
  () => rows.value.length >= UTILITY_PLAYBOOK_MAX_STEPS,
);

const rosterBySteamId = computed(() => {
  const map: Record<string, UtilityAuthorRef> = {};
  for (const player of roster.value) {
    map[player.steam_id] = player;
  }
  return map;
});

// Up and down trade places with the neighbour, and trade times with it too:
// the step you moved takes over the moment it moved into.
function move(index: number, delta: number) {
  const to = index + delta;
  if (to < 0 || to >= rows.value.length) {
    return;
  }
  const next = [...rows.value];
  const moved = next[index];
  const other = next[to];
  [moved.offsetSeconds, other.offsetSeconds] = [
    other.offsetSeconds,
    moved.offsetSeconds,
  ];
  lockTime(moved);
  lockTime(other);
  next[index] = other;
  next[to] = moved;
  rows.value = next;
}

// The same move from the grip with the arrow keys. Moving a row in the list
// can drop its focus, so the grip takes it back.
async function nudge(index: number, delta: number) {
  const key = rows.value[index]?.key;
  move(index, delta);
  await nextTick();
  document
    .getElementById(`utility-step-${key}`)
    ?.querySelector<HTMLElement>("[data-step-grip]")
    ?.focus();
}

// A time typed by hand is settled when the field is left or Enter is pressed,
// not on every keystroke: the step then carries itself to where its time puts
// it, on the list's ordinary move.
async function commitTime(row: StepRow, event?: KeyboardEvent) {
  row.offsetSeconds = offsetText(Number(row.offsetSeconds));
  lockTime(row);
  if (!sortByTime() || !event) {
    return;
  }
  // Enter keeps you in the field, and the row moving would take that away.
  const field = event.target as HTMLElement;
  await nextTick();
  field.focus();
}

/**
 * A step dropped into a slot takes a time that belongs there. Already between
 * its new neighbours -- level with either is fine -- it keeps its own.
 * Otherwise it lands a second after the step now above it, never later than
 * the one now below; dropped at the top, on the first step's own second.
 */
function slotSeconds(list: StepRow[], at: number) {
  const own = secondsOf(list[at]);
  const above = at > 0 ? secondsOf(list[at - 1]) : null;
  const below = at < list.length - 1 ? secondsOf(list[at + 1]) : null;
  if ((above === null || own >= above) && (below === null || own <= below)) {
    return own;
  }
  const fit =
    above === null ? (below ?? own) : Math.min(above + 1, below ?? Infinity);
  // On the editor's half-second grid, where the slot has room for that.
  const snapped =
    Math.round(fit / UTILITY_PLAYBOOK_OFFSET_STEP_SECONDS) *
    UTILITY_PLAYBOOK_OFFSET_STEP_SECONDS;
  return (above === null || snapped >= above) &&
    (below === null || snapped <= below)
    ? snapped
    : fit;
}

function scrollParent(el: HTMLElement) {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === "auto" || overflow === "scroll") {
      return node;
    }
  }
  return null;
}

function onGripDown(index: number, event: PointerEvent) {
  if (
    stepDrag ||
    dragKey.value !== null ||
    (event.pointerType === "mouse" && event.button !== 0)
  ) {
    return;
  }
  const handle = event.currentTarget as HTMLElement;
  const row = handle.closest("li");
  const list = row?.parentElement;
  if (!row || !list) {
    return;
  }
  // Keeps the press from selecting text or dragging the page.
  event.preventDefault();

  // A time still being typed has not been sorted in yet. Settle it first; if
  // that moved a row, the list is mid-move and this press does not start one.
  const order = rows.value.map((entry) => entry.key).join();
  const active = document.activeElement;
  if (active instanceof HTMLElement && list.contains(active)) {
    active.blur();
  }
  sortByTime();
  if (rows.value.map((entry) => entry.key).join() !== order) {
    return;
  }

  const items = Array.from(list.children) as HTMLElement[];
  // A row still folding away is in the list but not in the steps.
  if (items.length !== rows.value.length || items[index] !== row) {
    return;
  }

  const rects = items.map((item) => {
    const rect = item.getBoundingClientRect();
    return { top: rect.top, height: rect.height };
  });
  const own = rects[index];
  const last = rects[rects.length - 1];
  const scroller = scrollParent(row);

  handle.setPointerCapture(event.pointerId);
  stepDrag = {
    pointerId: event.pointerId,
    handle,
    row,
    scroller,
    startY: event.clientY,
    lastY: event.clientY,
    scrollStart: scroller?.scrollTop ?? 0,
    rects,
    // The row stays in its list, give or take a little.
    minDy: rects[0].top - own.top - 12,
    maxDy: last.top + last.height - (own.top + own.height) + 12,
    dy: 0,
    frame: 0,
    timer: null,
    onEnd: null,
  };
  dragKey.value = rows.value[index].key;
  dragFrom.value = index;
  dragTo.value = index;
  dragHeight.value = own.height;
  dragPhase.value = "held";
  window.addEventListener("keydown", onDragKey, true);
  stepDrag.frame = requestAnimationFrame(edgeScroll);
}

// Where the held row would land: past every row whose middle its own middle
// has crossed.
function slotFor(drag: StepDrag) {
  const from = dragFrom.value;
  const own = drag.rects[from];
  const centre = own.top + own.height / 2 + drag.dy;
  let to = from;
  drag.rects.forEach((rect, index) => {
    const middle = rect.top + rect.height / 2;
    if (index < from && centre < middle) {
      to = Math.min(to, index);
    } else if (index > from && centre > middle) {
      to = Math.max(to, index);
    }
  });
  return to;
}

// Straight onto the element, with nothing easing it: this is the one thing
// in the list that has to be exactly where the pointer is.
function track(drag: StepDrag) {
  const scrolled = (drag.scroller?.scrollTop ?? 0) - drag.scrollStart;
  drag.dy = Math.min(
    drag.maxDy,
    Math.max(drag.minDy, drag.lastY - drag.startY + scrolled),
  );
  drag.row.style.transform = `translate3d(0, ${drag.dy}px, 0)`;
  const to = slotFor(drag);
  if (to !== dragTo.value) {
    dragTo.value = to;
  }
}

function onGripMove(event: PointerEvent) {
  const drag = stepDrag;
  if (
    !drag ||
    dragPhase.value !== "held" ||
    event.pointerId !== drag.pointerId
  ) {
    return;
  }
  drag.lastY = event.clientY;
  track(drag);
}

// Held near the top or bottom of the scrolling body, the body scrolls and the
// row stays under the pointer while it does.
function edgeScroll() {
  const drag = stepDrag;
  if (!drag || dragPhase.value !== "held") {
    return;
  }
  const scroller = drag.scroller;
  if (scroller) {
    const box = scroller.getBoundingClientRect();
    const past =
      drag.lastY < box.top + SCROLL_EDGE_PX
        ? drag.lastY - (box.top + SCROLL_EDGE_PX)
        : drag.lastY > box.bottom - SCROLL_EDGE_PX
          ? drag.lastY - (box.bottom - SCROLL_EDGE_PX)
          : 0;
    if (past) {
      const before = scroller.scrollTop;
      scroller.scrollTop +=
        Math.sign(past) * Math.min(SCROLL_MAX_PX, Math.abs(past) / 4 + 1);
      if (scroller.scrollTop !== before) {
        track(drag);
      }
    }
  }
  drag.frame = requestAnimationFrame(edgeScroll);
}

function onGripUp(event: PointerEvent) {
  if (
    stepDrag &&
    dragPhase.value === "held" &&
    event.pointerId === stepDrag.pointerId
  ) {
    land(dragTo.value);
  }
}

// The pointer was taken away -- a cancelled touch, capture lost to something
// else -- so the drag is off and everything goes back.
function onGripLost(event: PointerEvent) {
  if (
    stepDrag &&
    dragPhase.value === "held" &&
    event.pointerId === stepDrag.pointerId
  ) {
    land(dragFrom.value);
  }
}

// Escape calls a drag off. Caught before the card sees it, or the same key
// would also close the editor the drag is happening in.
function onDragKey(event: KeyboardEvent) {
  if (event.key !== "Escape" || dragPhase.value !== "held") {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  land(dragFrom.value);
}

// Lets go of the row: it glides to the slot (its own, when the drag was called
// off, and the rows that made room close up again), and the order is written
// when it gets there.
function land(to: number) {
  const drag = stepDrag;
  if (!drag) {
    return;
  }
  cancelAnimationFrame(drag.frame);
  window.removeEventListener("keydown", onDragKey, true);
  if (drag.handle.hasPointerCapture(drag.pointerId)) {
    drag.handle.releasePointerCapture(drag.pointerId);
  }
  dragPhase.value = "landing";
  dragTo.value = to;

  const from = dragFrom.value;
  let offset = 0;
  for (let index = from + 1; index <= to; index++) {
    offset += drag.rects[index].height;
  }
  for (let index = to; index < from; index++) {
    offset -= drag.rects[index].height;
  }

  let done = false;
  const finish = () => {
    if (!done) {
      done = true;
      void commit(to);
    }
  };
  // Already there: nothing will ease, so nothing will say it has finished.
  if (Math.abs(drag.dy - offset) < 0.5) {
    finish();
    return;
  }
  drag.onEnd = (event: TransitionEvent) => {
    if (event.target === drag.row && event.propertyName === "transform") {
      finish();
    }
  };
  drag.row.addEventListener("transitionend", drag.onEnd);
  // The floor under that: a hidden tab, or reduced motion, ends no transition.
  drag.timer = setTimeout(finish, LAND_MS + 80);
  // After the flush that puts the landing class on the row, so the move to
  // the slot has something to ease it.
  void nextTick(() => {
    if (stepDrag === drag) {
      drag.row.style.transform = `translate3d(0, ${offset}px, 0)`;
    }
  });
}

/**
 * The drop itself. The new order and the end of the drag go out in ONE flush,
 * with the list's move animation switched off for it: the rows that made room
 * lose their transforms in the same patch that moves them in the document, so
 * they do not move on screen, and the list's FLIP -- which would measure them
 * mid-transform and animate from the wrong place -- has nothing to do. The
 * dropped row's own transform was set by hand, so it is taken off by hand in
 * the same tick, before anything is painted.
 */
async function commit(to: number) {
  const drag = stepDrag;
  if (!drag) {
    return;
  }
  stepDrag = null;
  if (drag.timer) {
    clearTimeout(drag.timer);
  }
  if (drag.onEnd) {
    drag.row.removeEventListener("transitionend", drag.onEnd);
  }

  const from = dragFrom.value;
  if (to !== from && rows.value[from]?.key === dragKey.value) {
    const next = [...rows.value];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    moved.offsetSeconds = offsetText(slotSeconds(next, to));
    lockTime(moved);
    committing.value = true;
    rows.value = next;
  }
  dragKey.value = null;
  dragFrom.value = -1;
  dragTo.value = -1;
  dragPhase.value = null;

  await nextTick();
  drag.row.style.transform = "";
  committing.value = false;
}

// The editor closing, or going away, with a row still in the air.
function dropDrag() {
  const drag = stepDrag;
  if (!drag) {
    return;
  }
  stepDrag = null;
  cancelAnimationFrame(drag.frame);
  window.removeEventListener("keydown", onDragKey, true);
  if (drag.timer) {
    clearTimeout(drag.timer);
  }
  if (drag.onEnd) {
    drag.row.removeEventListener("transitionend", drag.onEnd);
  }
  drag.row.style.transform = "";
  dragKey.value = null;
  dragFrom.value = -1;
  dragTo.value = -1;
  dragPhase.value = null;
}

onBeforeUnmount(dropDrag);

function rowMotion(key: string) {
  if (dragKey.value === null) {
    return "";
  }
  if (key !== dragKey.value) {
    return "step-shift";
  }
  return dragPhase.value === "held" ? "step-held" : "step-landing";
}

// How far a row has stepped aside for the one being held: its height, up or
// down, for every row between where it came from and where it would land.
function rowShift(index: number) {
  const from = dragFrom.value;
  if (dragKey.value === null || index === from) {
    return undefined;
  }
  const to = dragTo.value;
  const shift =
    from < index && index <= to
      ? -dragHeight.value
      : to <= index && index < from
        ? dragHeight.value
        : 0;
  return shift ? { transform: `translate3d(0, ${shift}px, 0)` } : undefined;
}

function addLineup(lineup: UtilityLineup) {
  if (atStepLimit.value) {
    toast({
      title: t("pages.utility.playbooks.step_limit", {
        count: UTILITY_PLAYBOOK_MAX_STEPS,
      }),
      variant: "destructive",
    });
    return;
  }
  lineupsById.value = { ...lineupsById.value, [lineup.id]: lineup };
  const row: StepRow = {
    key: nextKey(),
    lineupId: lineup.id,
    // A new beat lands after the last one rather than on top of it, and the
    // first one lands on the clock rather than at zero.
    offsetSeconds: formatUtilityOffset(
      parseUtilityOffset(
        rows.value.length
          ? lastOffsetSeconds() + 1
          : UTILITY_PLAYBOOK_MIN_OFFSET_SECONDS,
      ),
    ),
    assignedSteamId: NO_ASSIGNEE,
    note: "",
    lockOffset: null,
  };
  rows.value = [...rows.value, row];
  selectedKey.value = row.key;
}

// Unticking a lineup in the picker takes every step that throws it.
function dropLineup(id: string) {
  const gone = rows.value.filter((row) => row.lineupId === id);
  rows.value = rows.value.filter((row) => row.lineupId !== id);
  if (gone.some((row) => row.key === selectedKey.value)) {
    selectedKey.value = null;
  }
}

// The same throw a second time -- a re-smoke -- lands a few seconds after the
// one it repeats.
function repeatRow(key: string) {
  const at = rows.value.findIndex((row) => row.key === key);
  if (at < 0) {
    return;
  }
  if (atStepLimit.value) {
    toast({
      title: t("pages.utility.playbooks.step_limit", {
        count: UTILITY_PLAYBOOK_MAX_STEPS,
      }),
      variant: "destructive",
    });
    return;
  }
  const source = rows.value[at];
  const copy: StepRow = {
    ...source,
    key: nextKey(),
    offsetSeconds: formatUtilityOffset(
      parseUtilityOffset((Number(source.offsetSeconds) || 0) + 1),
    ),
    note: "",
    lockOffset: null,
  };
  const next = [...rows.value];
  next.splice(at + 1, 0, copy);
  rows.value = inTimeOrder(next);
  selectedKey.value = copy.key;
}

function lastOffsetSeconds() {
  const last = rows.value[rows.value.length - 1];
  return Number(last?.offsetSeconds ?? 0) || 0;
}

function removeRow(key: string) {
  rows.value = rows.value.filter((row) => row.key !== key);
  if (selectedKey.value === key) {
    selectedKey.value = null;
  }
}

// Resolved once per render rather than through a helper called from the
// template, so the markup never has to assert that a lineup is loaded.
const rowViews = computed(() =>
  rows.value.map((row) => {
    const lineup = lineupsById.value[row.lineupId] ?? null;
    return {
      row,
      lineup,
      color: lineup
        ? (UTILITY_TYPE_COLORS[lineup.utility_type] ?? "#ffffff")
        : "#8a8a8a",
      typeKey: lineup ? `pages.utility.types.${lineup.utility_type}` : "",
      techniqueKey: lineup
        ? `pages.utility.techniques.${lineup.technique}`
        : "",
    };
  }),
);

// A step can point at a lineup this viewer cannot see. The save action rejects
// the whole playbook in that case, so the warning has to be visible before the
// button is pressed rather than only in the failure toast.
const unresolvedSteps = computed(() =>
  lineupsLoading.value
    ? 0
    : rowViews.value.filter((view) => !view.lineup).length,
);

function selectByLineupId(id: string | null) {
  if (!id) {
    selectedKey.value = null;
    return;
  }
  const row = rows.value.find((entry) => entry.lineupId === id);
  if (!row) {
    return;
  }
  selectedKey.value = row.key;
  // The map is a column away from the list it drives, so a step picked out
  // there has to bring its row over rather than expect it to be found.
  if (typeof document !== "undefined") {
    document
      .getElementById(`utility-step-${row.key}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

const hoveredKey = ref<string | null>(null);

const hoveredLineupId = computed(() => {
  const row = rows.value.find((entry) => entry.key === hoveredKey.value);
  return row?.lineupId ?? null;
});

// The order is the point, and a colour is not an order. Each throw wears its
// step number where it LANDS: several throws leave from one spot, so numbers
// on the origin would pile up. A lineup thrown twice wears both.
const stepNumbers = computed(() => {
  const numbers: Record<string, number[]> = {};
  rows.value.forEach((row, index) => {
    (numbers[row.lineupId] ??= []).push(index + 1);
  });
  return numbers;
});

const stepMarkers = computed<UtilityBoardMarker[]>(() => {
  const out: UtilityBoardMarker[] = [];
  const seen = new Set<string>();
  for (const view of rowViews.value) {
    if (!view.lineup || seen.has(view.lineup.id)) {
      continue;
    }
    seen.add(view.lineup.id);
    out.push({
      key: view.lineup.id,
      point: utilityLanding(view.lineup) ?? utilityOrigin(view.lineup),
      color: view.color,
      label: (stepNumbers.value[view.lineup.id] ?? []).join("\u00b7"),
      shape: "badge",
    });
  }
  return out;
});

// What the picker is offering, and which of it the pointer is over, so the
// map can show the shelf you are choosing from.
const pickerLineups = ref<UtilityLineup[]>([]);
const pickerHoveredId = ref<string | null>(null);

const pickerBoardLineups = computed(() => {
  const seen = new Set<string>();
  const out: UtilityLineup[] = [];
  const offered = pickerLineups.value.filter(
    (lineup) =>
      !props.types.length || props.types.includes(lineup.utility_type),
  );
  for (const lineup of [...orderedLineups.value, ...offered]) {
    if (!seen.has(lineup.id)) {
      seen.add(lineup.id);
      out.push(lineup);
    }
  }
  return out;
});

const boardLineups = computed(() => {
  const seen = new Set<string>();
  return orderedLineups.value.filter((lineup) => {
    if (seen.has(lineup.id)) {
      return false;
    }
    seen.add(lineup.id);
    return true;
  });
});

watch(
  [
    () => props.open,
    coverageBoard,
    boardLineups,
    stepMarkers,
    selectedLineupId,
    hoveredLineupId,
    pickerOpen,
    pickerBoardLineups,
    pickerHoveredId,
  ],
  () => {
    if (!props.open) {
      return;
    }
    if (pickerOpen.value) {
      emit("board", {
        lineups: pickerBoardLineups.value,
        markers: stepMarkers.value,
        hoveredId: pickerHoveredId.value,
        onSelect: (id: string | null) => {
          const lineup = pickerLineups.value.find((entry) => entry.id === id);
          if (lineup) {
            addLineup(lineup);
          }
        },
        onHover: (id: string | null) => {
          pickerHoveredId.value = id;
        },
      });
      return;
    }
    if (coverageBoard.value) {
      emit("board", coverageBoard.value);
      return;
    }
    emit("board", {
      lineups: boardLineups.value,
      showAllLines: true,
      markers: stepMarkers.value,
      selectedId: selectedLineupId.value,
      hoveredId: hoveredLineupId.value,
      onSelect: selectByLineupId,
      onHover: (id: string | null) => {
        hoveredKey.value =
          rows.value.find((entry) => entry.lineupId === id)?.key ?? null;
      },
    });
  },
  { immediate: true },
);

/**
 * The carry limit is a player's belt, not the execute's budget, so this only
 * has anything to say once steps are assigned. Two counts per player: one per
 * grenade type, and the four-grenade total that catches a loadout which is
 * legal type by type and still cannot be bought.
 */
const loadoutOverloads = computed(() => {
  type Tally = { total: number; byType: Map<UtilityType, number> };
  const tallies = new Map<string, Tally>();

  for (const view of rowViews.value) {
    const steamId = view.row.assignedSteamId;
    if (steamId === NO_ASSIGNEE || !view.lineup) {
      continue;
    }
    const tally = tallies.get(steamId) ?? { total: 0, byType: new Map() };
    const type = view.lineup.utility_type as UtilityType;
    tally.total += 1;
    tally.byType.set(type, (tally.byType.get(type) ?? 0) + 1);
    tallies.set(steamId, tally);
  }

  const out: Array<{
    key: string;
    steamId: string;
    name: string;
    type: UtilityType | null;
    count: number;
    limit: number;
  }> = [];

  for (const [steamId, tally] of tallies) {
    const name = rosterBySteamId.value[steamId]?.name ?? steamId;
    for (const [type, count] of tally.byType) {
      const limit = UTILITY_CARRY_LIMITS[type] ?? 1;
      if (count > limit) {
        out.push({ key: `${steamId}-${type}`, steamId, name, type, count, limit });
      }
    }
    if (tally.total > UTILITY_CARRY_TOTAL) {
      out.push({
        key: `${steamId}-total`,
        steamId,
        name,
        type: null,
        count: tally.total,
        limit: UTILITY_CARRY_TOTAL,
      });
    }
  }

  return out;
});

const overloadedSteamIds = computed(
  () => new Set(loadoutOverloads.value.map((entry) => entry.steamId)),
);

// Seconds are the spine of an execute, so the gutter shows elapsed time rather
// than a row number: the gap between two beats is the thing being designed.
const timeline = computed(() => {
  const beats = rowViews.value.map((view) => ({
    ...view,
    seconds: Number(view.row.offsetSeconds) || 0,
  }));
  // Where each lineup was first used, so a second helping can point at it. A
  // re-smoke is legal, so this names the earlier step rather than calling the
  // later one wrong.
  const firstUse = new Map<string, number>();
  beats.forEach((beat, index) => {
    if (!firstUse.has(beat.row.lineupId)) {
      firstUse.set(beat.row.lineupId, index);
    }
  });
  return beats.map((beat, index) => {
    const first = firstUse.get(beat.row.lineupId);
    const overload = overloadedSteamIds.value.has(beat.row.assignedSteamId);
    return {
      ...beat,
      // Only the first beat at a given second prints it. Four smokes on the
      // same call are one moment, and printing "0.0" four times says otherwise.
      showTime: index === 0 || beats[index - 1].seconds !== beat.seconds,
      // 1-based, because that is the number this step wears on the map.
      repeatOf: first !== undefined && first !== index ? first + 1 : null,
      overloaded: overload,
    };
  });
});

const repeatCount = computed(
  () => timeline.value.filter((beat) => beat.repeatOf !== null).length,
);


const lastBeatSeconds = computed(() =>
  rows.value.length ? Math.max(...timeline.value.map((b) => b.seconds)) : 0,
);

const named = computed(() => name.value.trim().length > 0);

/**
 * Every complaint the execute has, in one list. Five separately-framed amber
 * paragraphs stacked under the timeline read as five alarms; one framed list
 * reads as a checklist, which is what it is.
 */
const notices = computed(() => {
  const out: Array<{ key: string; text: string }> = [];
  // The two complaints that actually block Save. Its placeholder reads like a
  // real name, so an empty field looks filled in -- without these the button
  // is simply dead and says nothing.
  if (!named.value) {
    out.push({
      key: "name",
      text: t("pages.utility.playbooks.name_required"),
    });
  }
  if (!rows.value.length) {
    out.push({
      key: "steps",
      text: t("pages.utility.playbooks.steps_required"),
    });
  }
  if (unresolvedSteps.value) {
    out.push({
      key: "unresolved",
      text: t("pages.utility.playbooks.unresolved", {
        count: unresolvedSteps.value,
      }),
    });
  }
  for (const entry of loadoutOverloads.value) {
    out.push({
      key: entry.key,
      text: entry.type
        ? t("pages.utility.playbooks.carry_over_type", {
            player: entry.name,
            count: entry.count,
            type: t(`pages.utility.types.${entry.type}`),
            limit: entry.limit,
          })
        : t("pages.utility.playbooks.carry_over_total", {
            player: entry.name,
            count: entry.count,
            limit: entry.limit,
          }),
    });
  }
  if (repeatCount.value) {
    out.push({
      key: "repeats",
      text: t(
        "pages.utility.playbooks.repeats",
        { count: repeatCount.value },
        repeatCount.value,
      ),
    });
  }
  return out;
});

// An instruction for something you have not done yet. Once a step has been
// picked the hint has been obeyed, so it stops taking a line forever.
const showBoardHint = computed(
  () => rowViews.value.length > 0 && !selectedKey.value,
);

const canSave = computed(
  () => named.value && rows.value.length > 0 && !saving.value,
);

async function save() {
  if (!canSave.value) {
    return;
  }
  // A time still being typed has not been sorted in yet.
  sortByTime();
  saving.value = true;
  try {
    const steps: UtilityPlaybookStepInput[] = rows.value.map((row) => ({
      utility_lineup_id: row.lineupId,
      offset_ms: parseUtilityOffset(row.offsetSeconds),
      assigned_steam_id:
        row.assignedSteamId === NO_ASSIGNEE ? null : row.assignedSteamId,
      note: row.note.trim() ? row.note.trim() : null,
    }));
    // The editor owns the whole step list, so it always sends one. Leaving
    // `steps` out of the variables is what preserves the stored order; an empty
    // array is a deliberate "clear the execute", never a shorthand for "no
    // change".
    const { data } = await getGraphqlClient().mutate({
      mutation: saveUtilityPlaybookMutation,
      variables: {
        playbook_id: props.playbook?.id ?? null,
        name: name.value.trim(),
        description: description.value.trim() || null,
        map_name: props.mapName,
        side: side.value,
        team_id: teamId.value === NO_TEAM ? null : teamId.value,
        visibility: visibility.value,
        steps,
      },
    });
    const id = (data as any)?.saveUtilityPlaybook?.id;
    if (!id) {
      throw new Error("no playbook");
    }
    toast({ title: t("pages.utility.playbooks.saved") });
    emit("saved", id);
  } catch (error: any) {
    toast({
      title: t("pages.utility.playbooks.save_failed"),
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    saving.value = false;
  }
}

async function destroy() {
  const playbook = props.playbook;
  if (!playbook) {
    return;
  }
  try {
    await getGraphqlClient().mutate({
      mutation: deleteUtilityPlaybookMutation,
      variables: { playbook_id: playbook.id },
    });
    toast({ title: t("pages.utility.playbooks.deleted") });
    emit("deleted", playbook.id);
  } catch (error: any) {
    confirmDelete.value = false;
    toast({
      title: t("pages.utility.playbooks.delete_failed"),
      description: error?.message,
      variant: "destructive",
    });
  }
}
</script>

<template>
  <UtilityCardView
    :open="open"
    :label="
      playbook
        ? $t('pages.utility.playbooks.editing')
        : $t('pages.utility.playbooks.creating')
    "
    @back="emit('cancel')"
  >
    <template #kicker>
      <span class="truncate">
        {{
          playbook
            ? $t("pages.utility.playbooks.editing")
            : $t("pages.utility.playbooks.creating")
        }}
      </span>
      <FiveStackToolTip as-child :delay-duration="120">
        <template #trigger>
          <img
            :src="
              side === 'CT' ? '/img/teams/ct_logo.svg' : '/img/teams/t_logo.svg'
            "
            :alt="$t(`pages.utility.sides.${side}`)"
            class="-my-1 size-[1.125rem] shrink-0 -translate-y-px"
          />
        </template>
        {{ $t(`pages.utility.sides.${side}`) }}
      </FiveStackToolTip>
    </template>

    <!-- One column. space-y, not the view's flex gap: a folding section can
         animate its own margin-top to nothing, but nothing can animate a flex
         container's gap, so a closing Fold would leave a hole behind and snap
         it shut on unmount. -->
    <form
      id="utility-execute-form"
      class="space-y-3"
      autocomplete="off"
      @submit.prevent="save()"
    >
      <div class="flex flex-col gap-1">
        <label
          for="utility-execute-name"
          class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("common.name") }}
        </label>
        <Input
          id="utility-execute-name"
          v-model="name"
          maxlength="120"
          autocomplete="off"
          spellcheck="false"
          class="h-9 text-sm font-semibold"
          :placeholder="$t('pages.utility.playbooks.name_placeholder')"
        />
      </div>

      <div class="flex flex-col gap-1">
        <label
          for="utility-execute-description"
          class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("common.description") }}
        </label>
        <Textarea
          id="utility-execute-description"
          v-model="description"
          rows="2"
          maxlength="1000"
          autocomplete="off"
          class="resize-none text-xs leading-snug"
          :placeholder="$t('pages.utility.playbooks.description_placeholder')"
          @keydown.meta.enter.prevent="save()"
          @keydown.ctrl.enter.prevent="save()"
        />
      </div>

      <div class="space-y-1.5">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <UtilitySegmented v-model="sideModel" :options="sideOptions" />
          <span aria-hidden="true" class="h-3.5 w-px shrink-0 bg-border" />
          <UtilitySegmented
            v-model="visibilityModel"
            :options="visibilityOptions"
          />
        </div>

        <!-- The team picker is only a question once the answer above it is
             "Team". Asked unconditionally it is a row of "None" on every
             private execute anyone ever writes. -->
        <Fold :open="visibility === 'Team'">
          <div class="flex flex-col gap-1 pt-1.5">
            <label
              for="utility-execute-team"
              class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
            >
              {{ $t("pages.utility.playbooks.team") }}
            </label>
            <Select v-model="teamId">
              <SelectTrigger id="utility-execute-team" class="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="NO_TEAM">{{ $t("common.none") }}</SelectItem>
                <SelectItem
                  v-for="team of myTeams"
                  :key="team.id"
                  :value="team.id"
                >
                  {{ team.name }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p
              v-if="teamId === NO_TEAM"
              class="text-[0.65rem] leading-snug text-[hsl(var(--tac-amber))]"
            >
              {{ $t("pages.utility.playbooks.team_required") }}
            </p>
          </div>
        </Fold>
      </div>

      <!-- One frame, one list. Five separately-boxed amber paragraphs read as
           five alarms; this reads as the checklist it is. -->
      <Fold :open="notices.length > 0">
        <div
          class="rounded-md border border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.1)] px-2.5 pb-2 pt-1"
        >
          <!-- Each line folds, and the gap between lines rides inside the clip
               (pt inside each cell) -- a flex gap left outside would be the one
               pixel that snaps. -->
          <TransitionGroup name="notice">
            <div
              v-for="notice of notices"
              :key="notice.key"
              class="notice-row"
            >
              <div class="min-h-0 overflow-hidden">
                <p
                  class="flex items-start gap-1.5 pt-1 text-xs leading-snug text-[hsl(var(--tac-amber))]"
                >
                  <TriangleAlert class="mt-0.5 h-3 w-3 shrink-0" />
                  <span class="min-w-0">{{ notice.text }}</span>
                </p>
              </div>
            </div>
          </TransitionGroup>
        </div>
      </Fold>

      <div>
        <UtilitySectionHead
          :label="$t('pages.utility.playbooks.steps')"
          :count="
            $t('pages.utility.playbooks.steps_of', {
              count: rows.length,
              max: UTILITY_PLAYBOOK_MAX_STEPS,
            })
          "
        >
          <span
            v-if="lastBeatSeconds > 0"
            class="font-mono text-[0.66rem] tabular-nums text-muted-foreground"
          >
            {{
              $t("pages.utility.playbooks.duration", {
                seconds: lastBeatSeconds.toFixed(1),
              })
            }}
          </span>
          <!-- Steps are timed to land together; once any has a time of its
               own, this is how every step is handed back. -->
          <FiveStackToolTip
            v-if="rows.length > 1"
            as-child
            side="bottom"
            :delay-duration="120"
          >
            <template #trigger>
              <button
                v-if="lockedSteps"
                type="button"
                class="inline-flex h-6 shrink-0 items-center rounded-md border border-white/10 px-2 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                @click="retimeAll()"
              >
                {{ $t("pages.utility.playbooks.retime_all") }}
              </button>
              <span
                v-else
                tabindex="0"
                class="inline-flex h-6 shrink-0 items-center rounded-md px-1 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--tac-amber))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                {{ $t("pages.utility.playbooks.land_together") }}
              </span>
            </template>
            <span class="block max-w-[16rem] text-xs leading-relaxed">
              {{
                $t("pages.utility.playbooks.land_together_hint", {
                  seconds: UTILITY_EXECUTE_FOLLOW_UP_SECONDS,
                })
              }}
            </span>
          </FiveStackToolTip>
        </UtilitySectionHead>

        <!-- Time runs down the gutter, because an execute is a clock: what a
             reader needs first is when a beat lands, not which index it holds.
             Repeated seconds print once, so four throws on one call read as one
             moment instead of four identical rows.

             Rows fold rather than pop: a step you just added should arrive
             where it belongs, and one you removed should take its space with
             it. The fold is why `move` behaves -- when the list changes the
             leaver has not shrunk yet, so FLIP measures no movement and stays
             out of the way, then the collapse carries the rows below it. -->
        <!-- The list's own move animation sits out the one flush a drop is
             written in: see commit(). -->
        <TransitionGroup
          v-if="rowViews.length"
          tag="ol"
          class="flex flex-col pt-1"
          name="step"
          :move-class="committing ? 'step-move-off' : undefined"
        >
          <li
            v-for="(beat, index) of timeline"
            :id="`utility-step-${beat.row.key}`"
            :key="beat.row.key"
            class="step-row group"
            :class="rowMotion(beat.row.key)"
            :style="rowShift(index)"
            @mouseenter="hoveredKey = beat.row.key"
            @mouseleave="hoveredKey = null"
          >
            <!-- Bare cell: any padding or border here would floor the fold.
                 Picked up, it is the part that lifts: its own ground, so the
                 rows passing under it do not show through. -->
            <div
              class="step-cell min-h-0 overflow-hidden"
              :class="
                dragKey === beat.row.key && dragPhase === 'held'
                  ? 'bg-sidebar max-md:bg-background'
                  : ''
              "
            >
              <!-- A pixel above and a few to the left, inside the clip: the
                   time field starts where the heading over the list starts
                   and never sits against the edge that cuts the row. -->
              <div
                class="grid grid-cols-[3.35rem_1.375rem_minmax(0,1fr)] items-start gap-x-2 pt-px"
              >
                <div class="relative flex justify-end pl-1">
                  <!-- A time set by hand. The lock gives it back to the
                       rest of the execute to be timed. -->
                  <FiveStackToolTip
                    v-if="beat.row.lockOffset !== null && beat.lineup"
                    as-child
                    :delay-duration="120"
                    :tap-toggle="false"
                  >
                    <template #trigger>
                      <button
                        type="button"
                        class="absolute left-1 top-0 z-10 grid h-[1.375rem] w-4 place-items-center rounded-sm text-[hsl(var(--tac-amber))]/80 transition-colors hover:text-[hsl(var(--tac-amber))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                        :aria-label="$t('pages.utility.playbooks.unlock_step')"
                        @click.stop="unlockTime(beat.row)"
                      >
                        <Lock class="h-3 w-3" />
                      </button>
                    </template>
                    {{ $t("pages.utility.playbooks.unlock_step") }}
                  </FiveStackToolTip>
                  <Input
                    v-model="beat.row.offsetSeconds"
                    type="number"
                    :min="UTILITY_PLAYBOOK_MIN_OFFSET_SECONDS"
                    max="600"
                    :step="UTILITY_PLAYBOOK_OFFSET_STEP_SECONDS"
                    autocomplete="off"
                    class="tac-quiet-field h-[1.375rem] w-full px-1 text-right font-mono text-[0.74rem] font-semibold tabular-nums shadow-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    :class="beat.showTime ? '' : 'text-muted-foreground/40'"
                    :aria-label="
                      $t('pages.utility.playbooks.offset_label', {
                        step: index + 1,
                      })
                    "
                    @click.stop
                    @change="commitTime(beat.row)"
                    @keydown.enter.prevent="commitTime(beat.row, $event)"
                  />
                </div>

                <!-- The rail is the sequence made visible. Each stop wears the
                     number it wears on the map, in the colour of what it
                     throws, so the strip down the gutter is also the loadout. -->
                <div class="relative flex h-full justify-center self-stretch">
                  <button
                    type="button"
                    class="relative z-10 grid size-[1.375rem] shrink-0 place-items-center rounded-full text-[0.69rem] font-bold leading-none tabular-nums ring-2 ring-sidebar [transition:transform_180ms_cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-white/70 max-md:ring-background"
                    :class="[
                      beat.lineup ? 'text-[#05070b]' : 'text-foreground',
                      selectedKey === beat.row.key
                        ? 'scale-[1.15]'
                        : 'hover:scale-110',
                    ]"
                    :style="{ backgroundColor: beat.color }"
                    :aria-label="
                      $t('pages.utility.playbooks.step_number', {
                        step: index + 1,
                      })
                    "
                    :aria-expanded="selectedKey === beat.row.key"
                    @click.stop="
                      selectedKey =
                        selectedKey === beat.row.key ? null : beat.row.key
                    "
                  >
                    {{ index + 1 }}
                  </button>
                  <!-- A row in the air is not on the rail. -->
                  <span
                    v-if="index < timeline.length - 1"
                    aria-hidden="true"
                    class="absolute inset-x-0 -bottom-1 top-6 mx-auto w-px bg-white/15 transition-opacity [transition-duration:160ms]"
                    :class="dragKey === beat.row.key ? 'opacity-0' : ''"
                  />
                </div>

                <div
                  class="relative min-w-0 rounded-md pb-3 transition-colors"
                  :class="
                    selectedKey === beat.row.key
                      ? 'bg-[hsl(var(--tac-amber))]/[0.07]'
                      : hoveredKey === beat.row.key
                        ? 'bg-white/[0.025]'
                        : ''
                  "
                >
                  <!-- The grip is the one place a row is picked up from, and
                       the only place a touch does not scroll the list. It
                       sits over the gap the row's heading leaves for it,
                       because a control inside that heading's own button
                       would be a button in a button. Its reach is wider than
                       its dots. -->
                  <button
                    type="button"
                    data-step-grip
                    aria-keyshortcuts="ArrowUp ArrowDown"
                    class="absolute -left-0.5 top-0 z-10 grid h-[1.375rem] w-5 cursor-grab touch-none select-none place-items-center rounded-md text-muted-foreground/25 transition-colors before:absolute before:-inset-2 before:content-[''] hover:text-muted-foreground/80 focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 group-hover:text-muted-foreground/60"
                    :class="
                      dragKey === beat.row.key
                        ? '!cursor-grabbing !text-foreground'
                        : ''
                    "
                    :aria-label="
                      $t('pages.utility.playbooks.reorder_label', {
                        step: index + 1,
                      })
                    "
                    @pointerdown="onGripDown(index, $event)"
                    @pointermove="onGripMove"
                    @pointerup="onGripUp"
                    @pointercancel="onGripLost"
                    @lostpointercapture="onGripLost"
                    @keydown.up.prevent="nudge(index, -1)"
                    @keydown.down.prevent="nudge(index, 1)"
                  >
                    <GripVertical class="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    class="block w-full min-w-0 rounded-md px-1.5 pt-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
                    @click="
                      selectedKey =
                        selectedKey === beat.row.key ? null : beat.row.key
                    "
                  >
                    <span class="flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        class="-ml-1 h-3.5 w-3.5 shrink-0"
                      />
                      <span
                        v-if="beat.lineup"
                        class="truncate text-[0.8rem] font-semibold leading-tight"
                      >
                        {{ beat.lineup.name }}
                      </span>
                      <!-- Held open at the size a name lands at, so the row
                           does not jump when the lineup arrives. -->
                      <span
                        v-else-if="lineupsLoading"
                        aria-hidden="true"
                        class="inline-block h-3 w-28 rounded-md bg-primary/10"
                      />
                      <span
                        v-else
                        class="truncate text-[0.8rem] font-semibold leading-tight text-muted-foreground"
                      >
                        {{ $t("pages.utility.playbooks.unknown_lineup") }}
                      </span>
                    </span>

                    <span
                      v-if="beat.lineup"
                      class="mt-0.5 block truncate font-mono text-[0.57rem] uppercase tracking-[0.13em] text-muted-foreground"
                    >
                      {{ $t(beat.typeKey) }} · {{ $t(beat.techniqueKey) }}
                      <!-- Named, not scolded: throwing the same smoke twice is
                           a re-smoke, and the only thing the row owes you is
                           which step you already spent it on. -->
                      <span
                        v-if="beat.repeatOf"
                        class="text-[hsl(var(--tac-amber))]"
                      >
                        ·
                        {{
                          $t("pages.utility.playbooks.repeat_of", {
                            step: beat.repeatOf,
                          })
                        }}
                      </span>
                    </span>

                    <!-- Collapsed, the call and the caller are read, not
                         edited. -->
                    <span
                      v-if="
                        selectedKey !== beat.row.key &&
                        (beat.row.note ||
                          beat.row.assignedSteamId !== NO_ASSIGNEE)
                      "
                      class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1"
                    >
                      <span
                        v-if="beat.row.assignedSteamId !== NO_ASSIGNEE"
                        class="inline-flex max-w-full items-center gap-1 rounded-full border px-1.5 py-px font-mono text-[0.55rem] uppercase tracking-[0.1em]"
                        :class="
                          beat.overloaded
                            ? 'border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]'
                            : 'border-border text-muted-foreground'
                        "
                      >
                        <User class="h-2.5 w-2.5 shrink-0" />
                        <span class="truncate">
                          {{
                            rosterBySteamId[beat.row.assignedSteamId]?.name ??
                            beat.row.assignedSteamId
                          }}
                        </span>
                      </span>
                      <span
                        v-if="beat.row.note"
                        class="truncate text-[0.68rem] italic text-muted-foreground"
                      >
                        “{{ beat.row.note }}”
                      </span>
                    </span>
                  </button>

                  <!-- Expanded is where a step is edited, so eight collapsed
                       rows stay a list you can read down instead of eight rows
                       of form. A sibling of the header rather than a child of
                       it: form controls inside a <button> are invalid, and the
                       fold needs a block it is allowed to own. -->
                  <Fold :open="selectedKey === beat.row.key">
                    <div class="flex flex-col gap-1.5 px-1.5 pt-2">
                      <Select
                        v-if="roster.length"
                        v-model="beat.row.assignedSteamId"
                      >
                        <SelectTrigger
                          class="h-7 w-full text-xs"
                          :aria-label="
                            $t('pages.utility.playbooks.who_label', {
                              step: index + 1,
                            })
                          "
                          @click.stop
                        >
                          <SelectValue
                            :placeholder="
                              $t('pages.utility.playbooks.unassigned')
                            "
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem :value="NO_ASSIGNEE">
                            {{ $t("pages.utility.playbooks.unassigned") }}
                          </SelectItem>
                          <SelectItem
                            v-for="player of roster"
                            :key="player.steam_id"
                            :value="player.steam_id"
                          >
                            {{ player.name }}
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      <!-- Asked where the question comes up, not as a standing
                           note under the whole editor. -->
                      <p
                        v-else
                        class="text-[0.62rem] leading-snug text-muted-foreground"
                      >
                        {{
                          teamId === NO_TEAM
                            ? $t("pages.utility.playbooks.assign_needs_team")
                            : $t("pages.utility.playbooks.no_roster")
                        }}
                      </p>

                      <Badge
                        v-if="
                          beat.row.assignedSteamId !== NO_ASSIGNEE &&
                          !rosterBySteamId[beat.row.assignedSteamId]
                        "
                        variant="outline"
                        class="w-fit font-mono text-[0.58rem]"
                      >
                        {{ beat.row.assignedSteamId }}
                      </Badge>

                      <Input
                        v-model="beat.row.note"
                        maxlength="160"
                        autocomplete="off"
                        class="h-7 w-full text-xs"
                        :placeholder="
                          $t('pages.utility.playbooks.note_placeholder')
                        "
                        :aria-label="
                          $t('pages.utility.playbooks.note_label', {
                            step: index + 1,
                          })
                        "
                        @click.stop
                        @keydown.enter.prevent
                      />

                      <div class="flex items-center gap-1 pt-0.5">
                        <button
                          type="button"
                          class="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-25"
                          :disabled="index === 0"
                          :aria-label="$t('pages.utility.playbooks.move_up')"
                          @click.stop="move(index, -1)"
                        >
                          <ChevronUp class="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          class="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-25"
                          :disabled="index === rows.length - 1"
                          :aria-label="$t('pages.utility.playbooks.move_down')"
                          @click.stop="move(index, 1)"
                        >
                          <ChevronDown class="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          class="ml-auto flex h-6 items-center gap-1 rounded-md px-1.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-25"
                          :disabled="atStepLimit"
                          @click.stop="repeatRow(beat.row.key)"
                        >
                          <Repeat2 class="h-3.5 w-3.5" />
                          {{ $t("pages.utility.playbooks.throw_again") }}
                        </button>
                        <button
                          type="button"
                          class="flex h-6 items-center gap-1 rounded-md px-1.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-destructive"
                          @click.stop="removeRow(beat.row.key)"
                        >
                          <Trash2 class="h-3.5 w-3.5" />
                          {{ $t("common.remove") }}
                        </button>
                      </div>
                    </div>
                  </Fold>
                </div>
              </div>
            </div>
          </li>
        </TransitionGroup>

        <p v-else class="px-1 pt-1 text-xs leading-relaxed text-muted-foreground">
          {{ $t("pages.utility.playbooks.no_steps") }}
        </p>

        <!-- Throws are added from the map's own lineups, opened over this in
             the same card. -->
        <button
          type="button"
          class="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border/70 font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-[hsl(var(--tac-amber))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:pointer-events-none disabled:opacity-50"
          :disabled="atStepLimit"
          @click="pickerOpen = true"
        >
          <Plus class="h-3.5 w-3.5" />
          {{ $t("pages.utility.playbooks.add_throw") }}
        </button>
      </div>

      <Fold :open="showBoardHint">
        <p
          class="flex items-start gap-1.5 text-[0.68rem] leading-snug text-muted-foreground"
        >
          <MapPin class="mt-px h-3 w-3 shrink-0" />
          {{ $t("pages.utility.playbooks.board_hint") }}
        </p>
      </Fold>

      <!-- Coverage is asked of the stored execute, so there is nothing to ask
           about until one exists. -->
      <UtilityPlaybookCoveragePanel
        v-if="playbook?.id"
        :playbook-id="playbook.id"
        :steps="steps"
        :lineups-by-id="lineupsById"
        @board="(state) => (coverageBoard = state)"
      />
    </form>

    <template #dock>
      <!-- Deleting is confirmed where it was asked for, in the row the
           button sat in. -->
      <template v-if="confirmDelete">
        <span class="min-w-0 truncate text-xs text-muted-foreground">
          {{ $t("pages.utility.playbooks.delete_ask") }}
        </span>
        <UtilityDockButton wide @click="confirmDelete = false">
          {{ $t("common.cancel") }}
        </UtilityDockButton>
        <UtilityDockButton wide danger @click="destroy()">
          {{ $t("common.delete") }}
        </UtilityDockButton>
      </template>
      <template v-else>
        <UtilityDockButton wide @click="emit('cancel')">
          {{ $t("common.cancel") }}
        </UtilityDockButton>
        <!-- The form's own submit, so Enter in the name saves too. -->
        <Button
          type="submit"
          form="utility-execute-form"
          size="sm"
          class="tac-amber-cta h-8 px-3.5 text-[13px] font-semibold"
          :loading="saving"
          :disabled="!canSave"
        >
          {{ $t("common.save") }}
        </Button>
        <UtilityDockMenu v-if="playbook">
          <DropdownMenuItem
            class="text-destructive focus:text-destructive"
            @click="confirmDelete = true"
          >
            {{ $t("pages.utility.playbooks.delete") }}
          </DropdownMenuItem>
        </UtilityDockMenu>
      </template>
    </template>
  </UtilityCardView>

  <UtilityExecutePicker
    :open="open && pickerOpen"
    :map-name="mapName"
    :side="side"
    :types="types"
    :numbers="stepNumbers"
    :count="rows.length"
    :max="UTILITY_PLAYBOOK_MAX_STEPS"
    :hovered-id="pickerHoveredId"
    @back="pickerOpen = false"
    @pick="addLineup"
    @drop="dropLineup"
    @toggle-type="(type) => emit('toggle-type', type)"
    @hover="(id) => (pickerHoveredId = id)"
    @lineups="(list) => (pickerLineups = list)"
  />
</template>

<style scoped>
/* The row is its own fold: one grid row that tweens 1fr <-> 0fr. Declared here
   rather than as Tailwind classes so the enter/leave overrides land later in
   the same stylesheet and win on order instead of on !important. */
.step-row {
  display: grid;
  grid-template-rows: 1fr;
}
.step-enter-active {
  transition:
    grid-template-rows 240ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 200ms ease-out;
}
.step-leave-active {
  transition:
    grid-template-rows 200ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 110ms ease-in;
}
.step-enter-from,
.step-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}
/* Reordering is the one change FLIP can measure honestly, and the only one
   this needs to animate. */
.step-move {
  transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* Reordering by hand. The row in the air follows the pointer with nothing
   easing it; the lift -- a little larger, a shadow under it -- is on the cell
   inside, so it can ease without the row lagging behind the hand. */
.step-cell {
  border-radius: 0.375rem;
  transition:
    transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1),
    box-shadow 160ms ease-out,
    background-color 160ms ease-out;
}
.step-held,
.step-landing {
  position: relative;
  z-index: 20;
}
.step-held > .step-cell {
  transform: scale(1.02);
  box-shadow:
    0 14px 28px -10px rgb(0 0 0 / 0.85),
    0 0 0 1px rgb(255 255 255 / 0.08);
}
/* The rows it passes step aside, eased and without a bounce. */
.step-shift {
  transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
/* Let go, it glides to its slot and settles by a hair. */
.step-landing {
  transition: transform 200ms cubic-bezier(0.25, 1.15, 0.4, 1);
}

.notice-row {
  display: grid;
  grid-template-rows: 1fr;
}
.notice-enter-active,
.notice-leave-active {
  transition:
    grid-template-rows 200ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 160ms ease;
}
.notice-enter-from,
.notice-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .step-enter-active,
  .step-leave-active,
  .step-move,
  .step-cell,
  .step-shift,
  .step-landing,
  .notice-enter-active,
  .notice-leave-active,
  .notice-move {
    transition-duration: 1ms;
  }
}
</style>
