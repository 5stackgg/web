<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  toRef,
  watch,
} from "vue";
import { useI18n } from "vue-i18n";
import { Ban, Check } from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
import VetoCrest from "~/components/match/VetoCrest.vue";
import VetoRail from "~/components/match/VetoRail.vue";
import VetoPlates from "~/components/match/VetoPlates.vue";
import { useCountdown } from "~/composables/useCountdown";
import {
  SCOUT_EVEN_POINTS,
  SCOUT_MIN_GAMES,
  scoutEdge,
  scoutHabit,
  scoutLikely,
  scoutRate,
  type ScoutLineup,
} from "~/utilities/vetoScouting";
import type {
  VetoBoardItem,
  VetoBoardLineup,
  VetoBoardStep,
} from "~/utilities/vetoOrder";
import type { VetoStart, VetoStartSide } from "~/utilities/vetoStage";

// The veto as one fixed-size stage: every map (or region) is a slice of it.
// The one in play opens wide, bans thin to slivers, picks tuck in and dim, so
// full colour always means still available. Nothing here changes height
// between turns -- slices only trade width inside the stage.
const props = withDefaults(
  defineProps<{
    kind: "map" | "region";
    items: VetoBoardItem[];
    steps: VetoBoardStep[];
    lineups: [VetoBoardLineup, VetoBoardLineup];
    // The api's word on whose turn it is; the order is only a port of it.
    pickingLineup?: 1 | 2 | null;
    isPicking?: boolean;
    submitting?: boolean;
    deadline?: string | null;
    total?: number;
    bestOf?: number;
    // The lineup the viewer plays on; their moves sit a step brighter.
    viewer?: 1 | 2 | null;
    // Each lineup's history and which lineup is yours, when veto scouting is
    // on for this match's mode.
    scouting?: {
      lineups: [ScoutLineup | null, ScoutLineup | null];
      viewer: 1 | 2 | null;
    } | null;
    // Once the veto is done and the server boots, the series grows over the
    // pool: each map to be played, large, with the side each team starts on.
    start?: VetoStart | null;
    // When the server is ready, hand the maps and the order of play over to
    // the page around the board.
    handOff?: boolean;
    // The decider's sides are won in a knife round.
    knifeRound?: boolean;
    // The server's state over the start's maps (the page may show it
    // elsewhere).
    bootStatus?: boolean;
    // Whose move it is and its clock, for a page that doesn't say so above
    // the board.
    statusLine?: boolean;
  }>(),
  {
    pickingLineup: null,
    isPicking: false,
    submitting: false,
    deadline: null,
    total: 0,
    bestOf: 1,
    viewer: null,
    scouting: null,
    start: null,
    handOff: false,
    knifeRound: false,
    bootStatus: true,
    statusLine: true,
  },
);

const emit = defineEmits<{
  confirm: [choice: { itemId?: string; side?: string }];
  handoff: [];
}>();

const { t } = useI18n();

const REPLAY_MS = 2600;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const DEFAULT_POSTER = "/img/maps/screenshots/default.webp";

const isRegion = computed(() => props.kind === "region");

const cursor = computed(() => props.steps.findIndex((step) => !step.record));
const step = computed(() =>
  cursor.value === -1 ? null : props.steps[cursor.value],
);
const done = computed(() => cursor.value === -1 && props.steps.length > 0);
const actingLineup = computed<1 | 2 | null>(() => {
  if (!step.value || step.value.type === "Decider") return null;
  return props.pickingLineup ?? step.value.lineup;
});
const mine = computed(
  () => props.isPicking && !!step.value && step.value.type !== "Decider",
);
const live = computed(() => mine.value && !props.submitting);

const label = (id: string | null | undefined) =>
  props.items.find((item) => item.id === id)?.label ?? "";
const lineupName = (lineup: 1 | 2 | null | undefined) =>
  lineup ? props.lineups[lineup - 1].name : "";
const sideShort = (side: string | null | undefined) =>
  side === "CT" ? "CT" : "T";
const sideIcon = (side: string | null | undefined) =>
  side === "CT" ? "/img/teams/ct_logo.svg" : "/img/teams/t_logo.svg";
const otherSide = (side: string) => (side === "CT" ? "TERRORIST" : "CT");

type ItemState = {
  status: "open" | "Ban" | "Pick" | "Decider";
  lineup: 1 | 2 | null;
  auto: boolean;
  banNumber: number | null;
  mapNumber: number | null;
  side: { lineup: 1 | 2 | null; side: string } | null;
};
const OPEN: ItemState = {
  status: "open",
  lineup: null,
  auto: false,
  banNumber: null,
  mapNumber: null,
  side: null,
};

const states = computed(() => {
  const map = new Map<string, ItemState>();
  let bans = 0;
  let maps = 0;
  for (const s of props.steps) {
    const record = s.record;
    if (!record) continue;
    if (s.type === "Side") {
      const picked = map.get(record.itemId);
      if (picked && record.side) {
        picked.side = { lineup: record.lineup, side: record.side };
      }
      continue;
    }
    map.set(record.itemId, {
      status: s.type,
      lineup: s.type === "Decider" ? null : record.lineup,
      auto: !!record.auto,
      banNumber: s.type === "Ban" ? ++bans : null,
      mapNumber: s.type === "Ban" ? null : ++maps,
      side: null,
    });
  }
  return map;
});
const stateOf = (id: string) => states.value.get(id) ?? OPEN;

const available = computed(() =>
  props.items.map((item) => item.id).filter((id) => !states.value.has(id)),
);

const sideMapId = computed(() => {
  if (step.value?.type !== "Side") return null;
  for (let i = cursor.value - 1; i >= 0; i--) {
    if (props.steps[i].type === "Pick") return props.steps[i].record?.itemId;
  }
  return null;
});

/* ---------- viewer state ---------- */
const selected = ref<string | null>(null);
const hover = ref<string | null>(null);
const echo = ref<string | null>(null);
const replayId = ref<string | null>(null);
// The open map last under the pointer: banned and played maps, and the gaps
// between maps, leave it as it is.
let pointerItem: string | null = null;
let replayTimer: ReturnType<typeof setTimeout> | undefined;

const recordCount = computed(
  () => props.steps.filter((s) => !!s.record).length,
);

// A move landing clears any half-made choice, and the map it touched opens for
// a moment -- yours too -- until the pointer moves onto another map.
watch(recordCount, (now, prev) => {
  selected.value = null;
  // A live move adds one (two when the decider lands with the last ban); a
  // bigger jump is the picks arriving on page load, not a move to replay.
  if (prev === undefined || now <= prev || now - prev > 2) return;
  const newest = props.steps[now - 1];
  if (!newest?.record || newest.type === "Side") return;
  hover.value = null;
  replayId.value = newest.record.itemId;
  clearTimeout(replayTimer);
  // The decider landing ends the veto: it stays open, the last word.
  if (newest.type === "Decider") return;
  replayTimer = setTimeout(() => {
    replayId.value = null;
    hover.value = pointerItem;
  }, REPLAY_MS);
});
// The turn passing clears a choice, except the one being sent: the turn can
// pass a moment before the move itself lands.
watch(
  () => props.isPicking,
  () => {
    if (!props.submitting) selected.value = null;
  },
);
const chosen = computed(() =>
  mine.value || props.submitting ? selected.value : null,
);

onBeforeUnmount(() => {
  clearTimeout(replayTimer);
});

const focus = computed(() => {
  const s = step.value;
  if (!s) return null;
  if (s.type === "Side") return sideMapId.value;
  if (s.type === "Decider") return available.value[0] ?? null;
  // The map under the pointer opens, your turn or not, so anyone can read its
  // records; the chosen one (still outlined) opens again when it leaves.
  if (hover.value && available.value.includes(hover.value)) {
    return hover.value;
  }
  return replayId.value ?? chosen.value;
});

// On your turn the open map shows the mark of the move it would get, so a
// hover already says ban or pick; choosing the map lights the mark into a
// button. It sits in the room the map's words leave it, below its records
// and above its name, and shrinks where that room is tight.
const markId = computed(() => {
  const id = focus.value;
  if (!id) return null;
  if (isLive(id)) return id;
  return props.submitting && id === chosen.value ? id : null;
});
const armRoom = ref<{ y: number; d: number } | null>(null);
function placeArm() {
  const id = markId.value;
  const slice = id
    ? stageEl.value?.querySelector<HTMLElement>(`[data-item="${id}"]`)
    : null;
  if (!slice) return;
  const box = slice.getBoundingClientRect();
  const bottomOf = (selector: string) =>
    slice.querySelector(selector)?.getBoundingClientRect().bottom ?? box.top;
  const top = Math.max(bottomOf(".vb-top"), bottomOf(".vb-scout")) - box.top;
  const bottom =
    (slice.querySelector(".vb-namerow")?.getBoundingClientRect().top ??
      box.bottom) - box.top;
  const room = bottom - top;
  armRoom.value = {
    y: top + room / 2,
    d: Math.max(40, Math.min(84, room - 20)),
  };
}
watch(markId, () => nextTick(placeArm));

// A map that is out of play -- banned, or picked while the veto runs -- is one
// fixed sliver (36px across, a little less tall on a phone's rows) whatever
// else is open: it never trades width with the map that opens, so nothing
// about it suggests it can be opened or chosen. Only its replay opens it, and
// then it is weighted like any open map; once the veto is done the picked
// maps open up as the series.
const THIN_W = 36;
const isOut = (id: string) => {
  const status = stateOf(id).status;
  return status === "Ban" || (status === "Pick" && !done.value);
};
const isThin = (id: string) =>
  isOut(id) && !isWide(id) && sideMapId.value !== id;

function weight(id: string) {
  const status = stateOf(id).status;
  if (sideMapId.value) {
    return sideMapId.value === id ? 9 : status === "Ban" ? 0.42 : 0.8;
  }
  // The last move lands with the decider: it opens big for a moment.
  if (done.value) {
    return status === "Ban" ? 0.42 : replayId.value === id ? 3.2 : 2.2;
  }
  if (focus.value === id) return 4.2;
  if (status === "Ban") return 0.42;
  if (status === "Pick") return 0.68;
  return 1;
}
const isWide = (id: string) =>
  !sideMapId.value &&
  (focus.value === id || (done.value && stateOf(id).status !== "Ban"));
// A wide map lays out its words at the width it opens to, from the first
// frame: the map grows over them instead of squeezing them as it widens.
const stageW = ref(0);
const stageH = ref(0);
const stageRow = ref(true);
// Each map's picture keeps one size whatever its slice's width (its height,
// on a phone's rows), so a slice opening uncovers more of it instead of
// zooming it.
const stageVars = computed(() =>
  stageRow.value
    ? {
        "--pw": stageW.value
          ? `${Math.round(stageW.value * 0.52)}px`
          : undefined,
        "--vb-thin-w": `${THIN_W}px`,
      }
    : {
        "--ph": stageH.value
          ? `${Math.round(stageH.value * 0.5)}px`
          : undefined,
      },
);
let stageObserver: ResizeObserver | undefined;
// The width a map opens to: its share with it open and the rest at rest.
// The same whether or not it is open right now, so its words keep their
// layout while it closes too.
const openWidth = (id: string) => {
  if (!stageRow.value || !stageW.value || sideMapId.value) return null;
  // Banned maps hold their own width (a banned map that opens for its replay
  // is the one that isn't held).
  const held = props.items.filter(
    (item) => item.id !== id && isOut(item.id),
  ).length;
  const free = stageW.value - 4 * (props.items.length - 1) - held * THIN_W;
  if (done.value) {
    const total = props.items.reduce(
      (sum, item) =>
        sum + (item.id !== id && isOut(item.id) ? 0 : weight(item.id)),
      0,
    );
    return Math.max(0, (free * weight(id)) / total);
  }
  const rest = props.items.reduce(
    (sum, item) =>
      sum +
      (item.id === id || isOut(item.id)
        ? 0
        : stateOf(item.id).status === "Pick"
          ? 0.68
          : 1),
    0,
  );
  return Math.max(0, (free * 4.2) / (rest + 4.2));
};
// A map that opens narrow keeps its words closer to its edges. Judged by the
// width it opens to, so they never jump as it grows past the line.
const isCramped = (id: string) => {
  const width = openWidth(id);
  return !!width && width < 240;
};

// A declaration, not a const: the open map's mark reads it during setup.
function isLive(id: string) {
  return (
    live.value &&
    (step.value?.type === "Ban" || step.value?.type === "Pick") &&
    available.value.includes(id)
  );
}

/* ---------- actions ---------- */
function confirm() {
  if (!mine.value || props.submitting || !selected.value) return;
  if (step.value?.type === "Side") {
    emit("confirm", { side: selected.value });
  } else {
    emit("confirm", { itemId: selected.value });
  }
}

// A click (or Enter) chooses a map and a second one on it bans or picks it,
// so a double click does it at once. Esc or a click off the maps lets it go.
function choose(id: string) {
  if (!isLive(id)) return;
  if (selected.value === id) confirm();
  else selected.value = id;
}
function onDocPointerDown(event: PointerEvent) {
  if (selected.value && !stageEl.value?.contains(event.target as Node)) {
    selected.value = null;
  }
}

function chooseSide(side: string) {
  if (!mine.value || props.submitting || step.value?.type !== "Side") return;
  if (selected.value === side) confirm();
  else selected.value = side;
}

function onKey(event: KeyboardEvent, id: string) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  choose(id);
}

// Keys: the arrows walk the open maps (or the two sides), Enter chooses and
// then confirms, Esc lets go. The hint shows while you steer by keys.
const stageEl = ref<HTMLElement | null>(null);
const keys = ref(false);
// A map opened by the arrow keys snaps open: no motion on keyboard moves.
const keyMove = ref(false);

function onStageKey(event: KeyboardEvent) {
  const s = step.value;
  if (!mine.value || props.submitting || !s) return;
  const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
  const back = event.key === "ArrowLeft" || event.key === "ArrowUp";

  if (s.type === "Side") {
    if (forward || back) {
      event.preventDefault();
      keys.value = true;
      selected.value = forward ? "TERRORIST" : "CT";
    } else if (event.key === "Enter" && selected.value) {
      event.preventDefault();
      confirm();
    }
    return;
  }
  if (s.type !== "Ban" && s.type !== "Pick") return;

  if (forward || back) {
    event.preventDefault();
    keys.value = true;
    keyMove.value = true;
    const open = available.value;
    if (!open.length) return;
    const at = open.indexOf(selected.value ?? hover.value ?? "");
    const next =
      at === -1
        ? forward
          ? 0
          : open.length - 1
        : (at + (forward ? 1 : -1) + open.length) % open.length;
    selected.value = null;
    hover.value = open[next];
    stageEl.value
      ?.querySelector<HTMLElement>(`[data-item="${open[next]}"]`)
      ?.focus();
  } else if (event.key === "Escape") {
    event.preventDefault();
    selected.value = null;
    hover.value = null;
  }
}

function onStageFocusIn(event: FocusEvent) {
  if ((event.target as HTMLElement).matches(":focus-visible")) {
    keys.value = true;
  }
}

function onStageFocusOut(event: FocusEvent) {
  if (!stageEl.value?.contains(event.relatedTarget as Node | null)) {
    keys.value = false;
  }
}

// The map under the pointer opens at once, so a sweep ripples through every
// map it crosses and turning back never waits. A banned or played map (or the
// gap between two maps) can't open, so crossing it changes nothing: the map
// that is open stays open.
function onPointerMove(event: PointerEvent) {
  if (event.pointerType === "touch") return;
  keyMove.value = false;
  const el = (event.target as HTMLElement).closest<HTMLElement>("[data-item]");
  const id = el?.dataset.item;
  if (!id || id === pointerItem || !available.value.includes(id)) return;
  pointerItem = id;
  hover.value = id;
}
function onPointerLeave() {
  pointerItem = null;
  hover.value = null;
}

/* ---------- countdown ---------- */
const {
  seconds,
  urgent,
  meter: countdownMeter,
} = useCountdown(toRef(props, "deadline"), toRef(props, "total"));
const timed = computed(() => !!props.deadline && !!actingLineup.value);

/* ---------- copy ---------- */
const lead = computed(() => {
  const s = step.value;
  if (!s) {
    return isRegion.value
      ? t("match.veto.region_set")
      : t("match.veto.complete");
  }
  if (s.type === "Decider") {
    return isRegion.value
      ? t("match.veto.last_region")
      : t("match.veto.decider");
  }
  return mine.value
    ? t("match.veto.your_turn")
    : lineupName(actingLineup.value);
});

const line = computed(() => {
  const s = step.value;
  if (!s) return isRegion.value ? "" : t("match.veto.complete_line");
  if (s.type === "Decider") {
    return isRegion.value
      ? t("match.veto.last_region_line")
      : t("match.veto.decider_line");
  }
  if (s.type === "Side") {
    const map = label(sideMapId.value);
    if (!mine.value) return t("match.veto.picking_side", { map });
    if (selected.value) {
      return t("match.veto.again_side", { side: sideShort(selected.value) });
    }
    return t("match.veto.pick_side", { map });
  }
  if (mine.value) {
    const pick = s.type === "Pick";
    const chosen = label(selected.value);
    if (chosen) {
      return t(pick ? "match.veto.again_pick" : "match.veto.again_ban", {
        map: chosen,
      });
    }
    const ask = pick
      ? t("match.veto.pick_map")
      : isRegion.value
        ? t("match.veto.ban_region")
        : t("match.veto.ban_map");
    return `${ask} · ${t(pick ? "match.veto.twice_pick" : "match.veto.twice_ban")}`;
  }
  if (s.type === "Pick") return t("match.veto.picking_map");
  return isRegion.value
    ? t("match.veto.banning_region")
    : t("match.veto.banning_map");
});

const stepCount = computed(() =>
  step.value ? `${cursor.value + 1} / ${props.steps.length}` : "",
);

function badge(id: string) {
  const st = stateOf(id);
  let text = "";
  if (st.status === "Ban") text = t("match.veto.ban_n", { n: st.banNumber });
  if (st.status === "Pick") text = t("match.veto.map_n", { n: st.mapNumber });
  if (st.status === "Decider") {
    text = isRegion.value
      ? t("match.veto.server_region")
      : props.bestOf === 1
        ? t("match.veto.the_map")
        : t("match.veto.decider_map_n", { n: st.mapNumber });
  }
  return st.auto && text ? `${text} · ${t("match.picks.auto_picked")}` : text;
}

const pickerStarts = (st: ItemState) =>
  st.side ? sideShort(otherSide(st.side.side)) : null;

// The line over a wide slice's name: the move that just landed, the decider,
// a region's ping, or where a picked map stands once the veto is done.
function wideCopy(id: string): { sub: string; tone: string } {
  const st = stateOf(id);
  const item = props.items.find((entry) => entry.id === id);
  const s = step.value;
  if (s && focus.value === id) {
    if (s.type === "Decider") {
      return {
        tone: "Decider",
        sub: isRegion.value
          ? t("match.veto.last_region_line")
          : props.bestOf === 1
            ? t("match.veto.bo1_last")
            : t("match.veto.decider_last", { n: props.bestOf }),
      };
    }
    if (st.status === "open") {
      return {
        tone: "",
        sub:
          isRegion.value && item?.ping != null
            ? t("match.veto.your_ping", { ping: item.ping })
            : "",
      };
    }
    if (st.status === "Ban") {
      return {
        tone: "Ban",
        sub: t("match.veto.banned_it", { team: lineupName(st.lineup) }),
      };
    }
    if (st.status === "Pick") {
      return {
        tone: "Pick",
        sub: t("match.veto.picked_it", {
          team: lineupName(st.lineup),
          n: st.mapNumber,
        }),
      };
    }
  }
  if (st.status === "Decider") {
    return {
      tone: "Decider",
      sub: isRegion.value
        ? t("match.veto.server_region")
        : t("match.veto.decider"),
    };
  }
  if (st.status === "Pick") {
    const starts = pickerStarts(st);
    return {
      tone: "Pick",
      sub: starts
        ? t("match.veto.map_n_starts", {
            n: st.mapNumber,
            team: props.lineups[(st.lineup ?? 1) - 1].monogram,
            side: starts,
          })
        : t("match.veto.picked_by", { team: lineupName(st.lineup) }),
    };
  }
  return { tone: "", sub: "" };
}

function sliceTitle(id: string) {
  const chip = scoutView.value.get(id)?.chip;
  if (chip) return `${label(id)} · ${chip.title}`;
  const st = stateOf(id);
  if (st.status === "open") return label(id);
  const who = st.lineup ? ` · ${lineupName(st.lineup)}` : "";
  return `${label(id)} · ${badge(id)}${who}`;
}

const sideItem = computed(() =>
  props.items.find((entry) => entry.id === sideMapId.value),
);
const sidePoster = computed(
  () => `url("${sideItem.value?.poster || DEFAULT_POSTER}")`,
);

/* ---------- scouting ---------- */
const scoutOn = computed(() => !!props.scouting && !isRegion.value);
// Scouting can be on before its history arrives: the key line holds its place
// from the first frame, and the numbers fill in under it.
const scoutLoaded = computed(
  () => !!props.scouting?.lineups.some((lineup) => lineup),
);
const viewerLineup = computed(
  () => props.viewer ?? props.scouting?.viewer ?? null,
);
const scoutOf = (lineup: 1 | 2) => props.scouting?.lineups[lineup - 1] ?? null;
// Whose habits you see: the other side's; watching, both.
const habitLineups = computed<(1 | 2)[]>(() =>
  viewerLineup.value ? [viewerLineup.value === 1 ? 2 : 1] : [1, 2],
);

function habitOf(id: string) {
  for (const lineup of habitLineups.value) {
    const habit = scoutHabit(scoutOf(lineup), id);
    if (habit) return { ...habit, lineup };
  }
  return null;
}

function habitText(lineup: 1 | 2, kind: "ban" | "pick", n: number, of: number) {
  const scout = scoutOf(lineup);
  if (!scout) return "";
  if (scout.source === "players") {
    return kind === "ban"
      ? t("match.veto.scout.captain_bans", { captain: scout.owner, n, of })
      : t("match.veto.scout.captain_picks", { captain: scout.owner, n, of });
  }
  return kind === "ban"
    ? t("match.veto.scout.team_bans", { team: scout.owner, n, of })
    : t("match.veto.scout.team_picks", { team: scout.owner, n, of });
}

// Their most likely move while they are on the clock.
const likely = computed(() => {
  const s = step.value;
  const acting = actingLineup.value;
  if (!scoutOn.value || mine.value || !acting || !s) return null;
  if (s.type !== "Ban" && s.type !== "Pick") return null;
  const guess = scoutLikely(scoutOf(acting), s.type, available.value);
  return guess ? { ...guess, lineup: acting, type: s.type } : null;
});

function record(lineup: 1 | 2, id: string) {
  const map = scoutOf(lineup)?.maps[id];
  const played = map?.played ?? 0;
  const wins = map?.wins ?? 0;
  return { played, wins, losses: played - wins, pct: scoutRate(map) };
}

const scoutName = (lineup: 1 | 2) =>
  viewerLineup.value === lineup
    ? t("match.veto.scout.you")
    : lineupName(lineup);

// The numbers behind an edge, for its tooltip.
function rateDetail(id: string) {
  const order: (1 | 2)[] = viewerLineup.value === 2 ? [2, 1] : [1, 2];
  return order
    .map((lineup) => {
      const rec = record(lineup, id);
      return rec.pct == null
        ? t("match.veto.scout.games_line", {
            team: scoutName(lineup),
            n: rec.played,
          })
        : t("match.veto.scout.rate_line", {
            team: scoutName(lineup),
            rate: rec.pct,
          });
    })
    .join(" · ");
}

type EdgeView = {
  tone: "you" | "them" | "side" | "even" | "few";
  lineup: 1 | 2 | null;
  text: string;
  title: string;
};

function edgeOf(id: string): EdgeView {
  const edge = scoutEdge(props.scouting!.lineups, id);
  const detail = rateDetail(id);
  if (edge.kind === "few") {
    return {
      tone: "few",
      lineup: null,
      text: "—",
      title: `${t("match.veto.scout.edge_few")} · ${detail}`,
    };
  }
  if (edge.kind === "even") {
    return {
      tone: "even",
      lineup: null,
      text: "+0",
      title: `${t("match.veto.scout.edge_even", { points: SCOUT_EVEN_POINTS })} · ${detail}`,
    };
  }
  const title = `${t("match.veto.scout.edge_ahead", {
    team: scoutName(edge.lineup),
    points: edge.points,
  })} · ${detail}`;
  // Watching, there is no "you" to measure from, so the stronger side's
  // crest says whose lead it is.
  if (!viewerLineup.value) {
    return {
      tone: "side",
      lineup: edge.lineup,
      text: `+${edge.points}`,
      title,
    };
  }
  const yours = edge.lineup === viewerLineup.value;
  return {
    tone: yours ? "you" : "them",
    lineup: null,
    text: `${yours ? "+" : "−"}${edge.points}`,
    title,
  };
}

type ScoutRecord = ReturnType<typeof record>;
type ScoutChip = { kind: string; lineup: 1 | 2; text: string; title: string };
type ScoutRow = ScoutRecord & { lineup: 1 | 2; name: string; ahead: boolean };

const scoutView = computed(() => {
  const view = new Map<
    string,
    {
      edge: EdgeView | null;
      chip: ScoutChip | null;
      likely: boolean;
      rows: ScoutRow[];
      line: { kind: string; text: string } | null;
    }
  >();
  if (!scoutOn.value || !scoutLoaded.value) return view;

  for (const item of props.items) {
    const id = item.id;
    const status = stateOf(id).status;
    const wide = isWide(id);
    const open = status === "open";

    // Who is stronger here, at the top of every open map, and still on the
    // maps that will be played once they are picked (the edge alone there).
    // An open map keeps its edge and its records while it opens and closes;
    // the page only fades one into the other.
    const played = status === "Pick" || status === "Decider";
    const edge = open || played ? edgeOf(id) : null;

    // On an open map: their likely move now, or a habit.
    let chip: ScoutChip | null = null;
    const guess = likely.value;
    const isLikely = !!guess && guess.mapId === id && !wide;
    if (open) {
      if (guess && guess.mapId === id) {
        const kind = guess.type === "Ban" ? "ban" : "pick";
        chip = {
          kind: `likely-${kind}`,
          lineup: guess.lineup,
          text:
            kind === "ban"
              ? t("match.veto.scout.likely_ban")
              : t("match.veto.scout.likely_pick"),
          title: habitText(guess.lineup, kind, guess.n, guess.of),
        };
      } else {
        const habit = habitOf(id);
        if (habit) {
          chip = {
            kind: habit.kind,
            lineup: habit.lineup,
            text:
              habit.kind === "ban"
                ? t("match.veto.scout.usually_bans")
                : t("match.veto.scout.usually_picks"),
            title: habitText(habit.lineup, habit.kind, habit.n, habit.of),
          };
        }
      }
    }

    // Both sides' records and the habit spelled out, shown on the open map.
    let rows: ScoutRow[] = [];
    let line: { kind: string; text: string } | null = null;
    if (open) {
      const order: (1 | 2)[] = viewerLineup.value === 2 ? [2, 1] : [1, 2];
      rows = order
        .filter((lineup) => scoutOf(lineup))
        .map((lineup) => ({
          lineup,
          name: scoutName(lineup),
          ...record(lineup, id),
          ahead: false,
        }));
      const best = Math.max(...rows.map((row) => row.pct ?? -1));
      if (best >= 0 && rows.filter((row) => row.pct === best).length === 1) {
        rows.forEach((row) => {
          row.ahead = row.pct === best;
        });
      }
      const habit = habitOf(id);
      line = habit
        ? {
            kind: habit.kind,
            text: habitText(habit.lineup, habit.kind, habit.n, habit.of),
          }
        : null;
    }

    view.set(id, { edge, chip, likely: isLikely, rows, line });
  }
  return view;
});
const scoutPlayersNote = computed(() =>
  ([1, 2] as const).some((lineup) => scoutOf(lineup)?.source === "players"),
);

// The open map's panel: whose win rates these are, and the edge on it.
function panelEdge(id: string) {
  const edge = scoutEdge(props.scouting!.lineups, id);
  if (edge.kind === "few") return t("match.veto.scout.edge_few");
  if (edge.kind === "even") return t("match.veto.scout.even");
  if (viewerLineup.value && edge.lineup !== viewerLineup.value) {
    return t("match.veto.scout.edge_short_behind", {
      team: scoutName(viewerLineup.value),
      points: edge.points,
    });
  }
  return t("match.veto.scout.edge_short", {
    team: scoutName(edge.lineup),
    points: edge.points,
  });
}

/* ---------- series ---------- */
const series = computed(() => {
  const played = props.steps.filter(
    (s) => s.record && (s.type === "Pick" || s.type === "Decider"),
  );
  return Array.from({ length: props.bestOf }, (_, i) => {
    const n = i + 1;
    const s = played[i];
    const item = s
      ? props.items.find((entry) => entry.id === s.record!.itemId)
      : null;
    const st = item ? stateOf(item.id) : null;
    return {
      n,
      label:
        props.bestOf === 1
          ? t("match.veto.the_map")
          : n === props.bestOf
            ? t("match.veto.decider_map_n", { n })
            : t("match.veto.map_n", { n }),
      item,
      picker: st?.lineup ?? null,
      starts: st ? pickerStarts(st) : null,
    };
  });
});
const pingQ = (ping: number) => Math.max(0.12, 1 - ping / 170).toFixed(3);

/* ---------- the start ---------- */
const item = (id: string) => props.items.find((entry) => entry.id === id);

const startMaps = computed(() =>
  (props.start?.maps ?? []).map((map, i) => ({
    ...map,
    n: i + 1,
    item: item(map.itemId),
    label:
      props.bestOf === 1
        ? t("match.veto.the_map")
        : map.decider
          ? t("match.veto.decider_map_n", { n: i + 1 })
          : t("match.veto.map_n", { n: i + 1 }),
  })),
);
const knife = computed(() => startMaps.value.some((map) => !map.sides));
// Each map's edge on its panel, when scouting has something to say about it.
function startEdge(itemId: string) {
  if (!scoutOn.value || !scoutLoaded.value) return null;
  const edge = edgeOf(itemId);
  return edge.tone === "few" ? null : edge;
}

// The server's state over the maps until it is ready; then they fold up.
const bootPhase = computed(() =>
  props.start?.phase === "waiting" ? "waiting" : "booting",
);

// A played map's number, big in the middle of it (on a phone's rows it
// joins the edge's box instead).
function bigNumber(id: string) {
  // Wide only once the veto is done (a pick opening for its replay keeps
  // the full read).
  // One map has no order to number.
  if (props.bestOf === 1 || (isWide(id) && !done.value)) return null;
  const st = stateOf(id);
  if (st.status !== "Pick" && st.status !== "Decider") return null;
  const word =
    st.status === "Decider" ? t("match.veto.decider") : t("match.veto.map");
  return { n: st.mapNumber, word };
}

// On a narrow picked map the map's number joins its edge in one box, as a
// habit does on an open map (shown there on a phone's rows).
function kickInBox(id: string) {
  const status = stateOf(id).status;
  return (
    !isWide(id) &&
    (status === "Pick" || status === "Decider") &&
    !!scoutView.value.get(id)?.edge
  );
}

// On the finished board each map to be played shows its teams the way the
// start will: who starts on which side, or a knife round for the decider.
// Undefined where there is nothing to show.
function doneSides(
  id: string,
): { 1: VetoStartSide; 2: VetoStartSide } | null | undefined {
  if (!done.value || isRegion.value) return undefined;
  const st = stateOf(id);
  if (st.status === "Decider") {
    return props.knifeRound ? null : { 1: "CT", 2: "T" };
  }
  if (st.status !== "Pick" || !st.side?.lineup) return undefined;
  const chooser: VetoStartSide = st.side.side === "CT" ? "CT" : "T";
  const picker: VetoStartSide = chooser === "CT" ? "T" : "CT";
  return st.side.lineup === 1
    ? { 1: chooser, 2: picker }
    : { 1: picker, 2: chooser };
}

// The panels sit over the stage and the series, across the board (down it
// on a phone).
type Box = { left: number; top: number; width: number; height: number };
const areaEl = ref<HTMLElement | null>(null);
const railRef = ref<InstanceType<typeof VetoRail> | null>(null);
const boxes = ref<Box[]>([]);
const shown = ref<number[]>([]);
const px = (rect: Box) => ({
  left: `${rect.left}px`,
  top: `${rect.top}px`,
  width: `${rect.width}px`,
  height: `${rect.height}px`,
});
const panels = () =>
  Array.from(areaEl.value?.querySelectorAll<HTMLElement>(".st-panel") ?? []);

function fit() {
  const area = areaEl.value;
  const n = startMaps.value.length;
  if (!area || !n) return;
  const w = area.clientWidth;
  const h = area.clientHeight;
  const gap = 4;
  const across = w > 560;
  boxes.value = Array.from({ length: n }, (_, i) => {
    if (across) {
      const width = (w - gap * (n - 1)) / n;
      return { left: i * (width + gap), top: 0, width, height: h };
    }
    const height = (h - gap * (n - 1)) / n;
    return { left: 0, top: i * (height + gap), width: w, height };
  });
}

const settle = (animations: Animation[]) =>
  Promise.all(
    animations.map((animation) => animation.finished.catch(() => {})),
  );

async function grow(animate: boolean) {
  fit();
  await nextTick();
  const area = areaEl.value;
  if (!area) return;
  const reduced = !!window.matchMedia?.("(prefers-reduced-motion: reduce)")
    ?.matches;
  // The words come up with their map, not after it lands.
  shown.value = startMaps.value.map((_, i) => i);
  if (!animate || reduced || typeof area.animate !== "function") return;
  panels().forEach((panel, i) => {
    panel
      .animate(
        [
          { opacity: 0, transform: "translateY(22px) scale(0.97)" },
          { opacity: 1, transform: "none" },
        ],
        {
          duration: 620,
          delay: 160 + i * 100,
          easing: EASE,
          fill: "backwards",
        },
      )
      .finished.catch(() => {});
  });
}

let resize: ResizeObserver | undefined;
onMounted(() => {
  document.addEventListener("pointerdown", onDocPointerDown);
  if (typeof ResizeObserver !== "undefined" && stageEl.value) {
    stageObserver = new ResizeObserver(() => {
      const stage = stageEl.value;
      if (!stage) return;
      stageW.value = stage.clientWidth;
      stageH.value = stage.clientHeight;
      stageRow.value = getComputedStyle(stage).flexDirection === "row";
      placeArm();
    });
    stageObserver.observe(stageEl.value);
  }
  if (props.start) void grow(false);
  if (typeof ResizeObserver === "undefined" || !areaEl.value) return;
  resize = new ResizeObserver(() => {
    if (props.start) fit();
  });
  resize.observe(areaEl.value);
});

// The veto finishing on screen raises the maps; a page opened mid-boot just
// shows them.
watch(
  () => !!props.start,
  (on) => {
    shown.value = [];
    if (on) void grow(true);
  },
);

// Server ready: the maps hand over to the page.
let handTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => props.start?.phase === "ready" && props.handOff,
  (go) => {
    clearTimeout(handTimer);
    if (!go) return;
    handTimer = setTimeout(() => void handOffNow(), 260);
  },
  { immediate: true },
);

// The maps fold up where they stand, words and all; the page unfolds its own
// cards for them.
async function handOffNow() {
  if (typeof areaEl.value?.animate === "function") {
    await settle(
      panels().map((panel, i) =>
        panel.animate(
          [
            { clipPath: "inset(0 0 0% 0 round 12px)", opacity: 1 },
            { clipPath: "inset(0 0 100% 0 round 12px)", opacity: 0.3 },
          ],
          {
            duration: 420,
            delay: i * 70,
            easing: "cubic-bezier(0.55, 0, 0.75, 0)",
            fill: "forwards",
          },
        ),
      ),
    );
  }
  emit("handoff");
}

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocPointerDown);
  clearTimeout(handTimer);
  resize?.disconnect();
  stageObserver?.disconnect();
});
</script>

<template>
  <div class="vb" :class="{ 'is-live': live }" :data-act="step?.type">
    <!-- One line through the veto: your turn changes its colour and words,
         never its height. Once the veto is done it folds away. -->
    <Transition v-if="statusLine" name="vb-status">
      <div v-if="!done && !start" class="vb-status" aria-live="polite">
        <VetoCrest
          v-if="actingLineup"
          :lineup="lineups[actingLineup - 1]"
          :size="24"
          :title="lineupName(actingLineup)"
        />
        <span class="vb-lead" :class="{ 'is-you': mine }" :title="lead">{{
          lead
        }}</span>
        <span class="vb-line" :title="line">{{ line }}</span>
        <span v-if="keys && mine" class="vb-keys"
          ><kbd>←</kbd><kbd>→</kbd> {{ t("match.veto.keys.browse") }} ·
          <kbd>Enter</kbd> {{ t("match.veto.keys.choose") }} · <kbd>Esc</kbd>
          {{ t("match.veto.keys.clear") }}</span
        >
        <span v-else class="vb-step tabular-nums">{{ stepCount }}</span>
        <span
          class="vb-clock tabular-nums"
          :class="{ 'is-urgent': timed && urgent }"
          >{{ timed ? `${seconds}s` : "" }}</span
        >
        <span
          ref="countdownMeter"
          class="vb-bar"
          :class="{
            'is-timed': timed,
            'is-other': timed && !mine,
            'is-urgent': timed && urgent,
          }"
        >
          <i />
        </span>
      </div>
    </Transition>

    <!-- A page opened on the start has the maps before the veto's moves
         arrive; the order of play fades in with them. -->
    <VetoRail
      ref="railRef"
      :class="{ 'vb-rail-hold': !!start && !recordCount }"
      :kind="kind"
      :items="items"
      :steps="steps"
      :lineups="lineups"
      :viewer="viewerLineup"
      :your-turn="mine"
      @echo="echo = $event"
    />

    <!-- The start's key takes the scouting key's line, never a new one: a
         line added here would push the maps down as they come in. -->
    <div v-if="start && scoutOn" class="vb-scoutkey">
      <span class="lead"
        ><b>{{ t("match.veto.start.sides_title") }}</b> ·
        {{ t("match.veto.start.sides_key") }}</span
      >
      <span v-if="knife" class="fine">{{
        t("match.veto.start.knife_key")
      }}</span>
    </div>
    <div v-else-if="scoutOn" class="vb-scoutkey">
      <span class="lead"
        ><b>{{ t("match.veto.scout.edge") }}</b> ·
        {{
          viewerLineup
            ? t("match.veto.scout.edge_key_you")
            : t("match.veto.scout.edge_key")
        }}</span
      >
      <span class="fine"
        ><template v-if="scoutPlayersNote"
          >{{ t("match.veto.scout.players_games") }} · </template
        >{{ t("match.veto.scout.too_few", { n: SCOUT_MIN_GAMES }) }}</span
      >
    </div>

    <div ref="areaEl" class="st-area" :class="{ 'is-starting': !!start }">
      <div
        ref="stageEl"
        class="vb-stage"
        :class="{
          'is-region': isRegion,
          'is-yours': mine,
          'is-keyed': keyMove,
        }"
        :style="stageVars"
        :tabindex="live ? 0 : undefined"
        @pointermove="onPointerMove"
        @pointerleave="onPointerLeave"
        @pointerdown="keys = false"
        @keydown="onStageKey"
        @focusin="onStageFocusIn"
        @focusout="onStageFocusOut"
      >
        <div
          v-for="item in items"
          :key="item.id"
          class="vb-slice"
          :data-item="item.id"
          :data-status="stateOf(item.id).status"
          :class="{
            'is-wide': isWide(item.id),
            'is-mid': isWide(item.id) && done && replayId !== item.id,
            'is-thin': isThin(item.id),
            'is-live': isLive(item.id),
            'is-selected': chosen === item.id,
            'is-siding': sideMapId === item.id,
            'is-echo': echo === item.id,
            'is-sized': !!openWidth(item.id),
            'is-cramped': isCramped(item.id),
            'is-landing': done && replayId === item.id,
          }"
          :style="{
            '--g': weight(item.id),
            '--fw': openWidth(item.id) ? `${openWidth(item.id)}px` : undefined,
          }"
          :tabindex="isLive(item.id) ? 0 : -1"
          :role="isLive(item.id) ? 'button' : undefined"
          :aria-label="sliceTitle(item.id)"
          @click="choose(item.id)"
          @keydown="onKey($event, item.id)"
        >
          <template v-if="!isRegion">
            <NuxtImg
              class="vb-poster"
              :src="item.poster || DEFAULT_POSTER"
              sizes="400px md:900px"
              alt=""
            />
            <div class="vb-shade" />
            <div
              v-if="done && stateOf(item.id).status === 'Decider'"
              class="vb-shine"
              aria-hidden="true"
            />
          </template>
          <template v-else>
            <div class="vb-regionbg" />
            <div
              v-if="item.ping != null"
              class="vb-pingfill"
              :style="{ '--q': pingQ(item.ping) }"
            />
          </template>

          <div
            v-if="scoutView.get(item.id)?.likely"
            class="vb-likely"
            aria-hidden="true"
          />

          <!-- Chosen: the map takes the move's colour and mark; a second
               click on it makes the move. -->
          <div v-if="chosen === item.id" class="vb-arm" aria-hidden="true" />
          <div
            v-if="markId === item.id"
            class="vb-mark"
            :class="{
              'is-armed': chosen === item.id,
              'is-sending': submitting,
            }"
            :style="
              armRoom
                ? { '--arm-y': `${armRoom.y}px`, '--arm-d': `${armRoom.d}px` }
                : undefined
            "
            aria-hidden="true"
          >
            <span class="vb-arm-ping" />
            <span class="vb-arm-btn">
              <Spinner v-if="submitting" />
              <Check v-else-if="step?.type === 'Pick'" />
              <Ban v-else />
              <span class="vb-arm-word">{{ t("match.veto.confirm") }}</span>
            </span>
          </div>

          <div class="vb-top">
            <span class="vb-id">
              <VetoCrest
                v-if="stateOf(item.id).lineup"
                :lineup="lineups[stateOf(item.id).lineup! - 1]"
                :size="28"
              />
            </span>
            <span
              v-if="
                badge(item.id) &&
                stateOf(item.id).status !== 'Ban' &&
                !kickInBox(item.id)
              "
              class="vb-kick"
              :class="{ 'has-num': !!bigNumber(item.id) }"
            >
              <VetoCrest
                v-if="stateOf(item.id).lineup"
                :lineup="lineups[stateOf(item.id).lineup! - 1]"
                :size="24"
              />
              <span>{{ badge(item.id) }}</span>
              <span v-if="stateOf(item.id).lineup" class="by-t"
                >·
                {{
                  t("match.veto.picked_by", {
                    team: lineupName(stateOf(item.id).lineup),
                  })
                }}</span
              >
            </span>

            <template v-if="scoutView.get(item.id)">
              <div
                v-if="
                  scoutView.get(item.id)!.edge || scoutView.get(item.id)!.chip
                "
                class="vb-tag"
                :class="{
                  'is-bare':
                    stateOf(item.id).status !== 'open' && !kickInBox(item.id),
                  'is-away':
                    stateOf(item.id).status === 'open' && isWide(item.id),
                }"
              >
                <span
                  v-if="scoutView.get(item.id)!.edge"
                  class="vb-edge tabular-nums"
                  :data-tone="scoutView.get(item.id)!.edge!.tone"
                  :title="scoutView.get(item.id)!.edge!.title"
                >
                  <VetoCrest
                    v-if="scoutView.get(item.id)!.edge!.lineup"
                    :lineup="lineups[scoutView.get(item.id)!.edge!.lineup! - 1]"
                    :size="22"
                  />
                  {{ scoutView.get(item.id)!.edge!.text }}
                </span>
                <span
                  v-if="scoutView.get(item.id)!.chip"
                  class="vb-habit"
                  :data-kind="scoutView.get(item.id)!.chip!.kind"
                  :title="scoutView.get(item.id)!.chip!.title"
                >
                  <VetoCrest
                    :lineup="lineups[scoutView.get(item.id)!.chip!.lineup - 1]"
                    :size="18"
                  />
                  <span class="txt">{{
                    scoutView.get(item.id)!.chip!.text
                  }}</span>
                </span>
                <span v-if="kickInBox(item.id)" class="vb-krow"
                  ><VetoCrest
                    v-if="stateOf(item.id).lineup"
                    :lineup="lineups[stateOf(item.id).lineup! - 1]"
                    :size="24"
                  />{{ badge(item.id) }}</span
                >
              </div>
              <div
                v-if="scoutView.get(item.id)!.rows.length"
                class="vb-scout"
                :class="{ 'is-shown': isWide(item.id) }"
              >
                <div class="vb-scouthead">
                  <b>{{
                    t("match.veto.scout.win_rate_on", { map: item.label })
                  }}</b>
                  <span>{{ panelEdge(item.id) }}</span>
                </div>
                <div
                  v-for="row in scoutView.get(item.id)!.rows"
                  :key="row.lineup"
                  class="vb-rec"
                  :class="{ 'is-ahead': row.ahead, 'is-none': row.pct == null }"
                  :title="
                    t('match.veto.scout.record', {
                      team: lineupName(row.lineup),
                      wins: row.wins,
                      losses: row.losses,
                    })
                  "
                >
                  <VetoCrest :lineup="lineups[row.lineup - 1]" :size="18" />
                  <span class="nm">{{ row.name }}</span>
                  <template v-if="row.pct != null">
                    <span class="wl tabular-nums"
                      >{{ row.wins }}–{{ row.losses }}</span
                    >
                    <span class="trk"
                      ><i :style="{ width: `${row.pct}%` }"
                    /></span>
                    <span class="pct tabular-nums">{{ row.pct }}%</span>
                  </template>
                  <template v-else-if="row.played">
                    <span class="wl tabular-nums"
                      >{{ row.wins }}–{{ row.losses }}</span
                    >
                    <span />
                    <span class="pct">—</span>
                  </template>
                  <template v-else>
                    <span class="wl">{{ t("match.veto.scout.no_games") }}</span>
                    <span />
                    <span class="pct">—</span>
                  </template>
                </div>
                <div
                  v-if="scoutView.get(item.id)!.line"
                  class="vb-habitline"
                  :data-kind="scoutView.get(item.id)!.line!.kind"
                >
                  {{ scoutView.get(item.id)!.line!.text }}
                </div>
                <div v-if="scoutPlayersNote" class="vb-scoutnote">
                  {{ t("match.veto.scout.players_note") }}
                </div>
              </div>
            </template>
          </div>

          <!-- a played map's number, big -->
          <div v-if="bigNumber(item.id)" class="vb-num" aria-hidden="true">
            <span class="k">{{ bigNumber(item.id)!.word }}</span>
            <b class="tabular-nums">{{ bigNumber(item.id)!.n }}</b>
          </div>

          <!-- narrow: emblem over a vertical name -->
          <div class="vb-v">
            <span
              v-if="isRegion"
              class="vb-dot"
              :data-status="item.serverStatus"
            />
            <img
              v-else-if="item.patch"
              class="vb-vpatch"
              :src="item.patch"
              alt=""
            />
            <span class="vb-vname">{{ item.label }}</span>
            <span v-if="isRegion && item.ping != null" class="vb-vping"
              ><b class="tabular-nums">{{ item.ping }}</b> ms</span
            >
          </div>

          <!-- wide: the full read -->
          <!-- The name sits at the foot; what happened to the map goes over
               it, so the name never moves. -->
          <div class="vb-open">
            <div v-if="doneSides(item.id) === undefined" class="vb-act">
              <span class="vb-sub" :data-tone="wideCopy(item.id).tone">{{
                wideCopy(item.id).sub
              }}</span>
            </div>
            <div class="vb-namerow">
              <img v-if="!isRegion && item.patch" :src="item.patch" alt="" />
              <span class="vb-name">{{ item.label }}</span>
            </div>
            <VetoPlates
              v-if="doneSides(item.id) !== undefined"
              :sides="doneSides(item.id)!"
              :lineups="lineups"
              :viewer="viewerLineup"
            />
          </div>

          <!-- side: the picked map opens across the stage and splits CT / T -->
          <div
            v-if="!isRegion && sideMapId === item.id"
            class="vb-split"
            :class="{
              'sel-CT': chosen === 'CT',
              'sel-T': chosen === 'TERRORIST',
              'is-sending': submitting,
            }"
            @click.stop
          >
            <div
              v-for="side in ['CT', 'TERRORIST']"
              :key="side"
              class="vb-lift"
              :data-side="sideShort(side)"
              :class="{
                'is-up': chosen === side,
                'is-down': !!chosen && chosen !== side,
              }"
            >
              <button
                type="button"
                class="vb-half"
                :data-side="sideShort(side)"
                :class="{ 'is-selected': chosen === side }"
                :style="{ backgroundImage: sidePoster }"
                :disabled="!mine || submitting"
                @click="chooseSide(side)"
              >
                <span class="vb-half-in">
                  <span class="vb-side-mark">
                    <Spinner v-if="submitting && chosen === side" />
                    <img v-else :src="sideIcon(side)" alt="" />
                    <span class="vb-side-word">{{
                      t("match.veto.confirm")
                    }}</span>
                  </span>
                  <b>{{
                    t("match.veto.start_side", { side: sideShort(side) })
                  }}</b>
                  <small>{{
                    side === "CT"
                      ? t("match.veto.defend_first")
                      : t("match.veto.attack_first")
                  }}</small>
                </span>
              </button>
            </div>
            <span class="vb-sidehead">
              <img v-if="sideItem?.patch" :src="sideItem.patch" alt="" />
              {{ sideItem?.label }}
            </span>
            <!-- Both teams see the same split, so it says whose call it is. -->
            <span class="vb-sideby" :class="{ 'is-you': mine }">
              <VetoCrest
                v-if="actingLineup"
                :lineup="lineups[actingLineup - 1]"
                :size="22"
              />
              {{
                mine
                  ? t("match.veto.side_by_you")
                  : t("match.veto.side_by_them", {
                      team: lineupName(actingLineup),
                    })
              }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="!isRegion && bestOf > 1" class="vb-series">
        <div
          v-for="slot in series"
          :key="slot.n"
          class="vb-chip"
          :class="{ 'is-set': !!slot.item }"
        >
          <img
            v-if="slot.item"
            class="th"
            :src="slot.item.poster || DEFAULT_POSTER"
            alt=""
          />
          <span v-else class="th is-empty" />
          <span class="tx">
            <span class="n"
              >{{ slot.label
              }}<template v-if="slot.picker">
                ·
                {{
                  t("match.veto.picked_by", { team: lineupName(slot.picker) })
                }}</template
              ></span
            >
            <span class="m">{{
              slot.item ? slot.item.label : t("match.veto.not_set")
            }}</span>
          </span>
          <span v-if="slot.picker" class="end">
            <VetoCrest :lineup="lineups[slot.picker - 1]" :size="22" />
            <img
              v-if="slot.starts"
              class="sd"
              :src="sideIcon(slot.starts === 'CT' ? 'CT' : 'TERRORIST')"
              :alt="slot.starts"
            />
          </span>
        </div>
      </div>

      <div v-if="start" class="st-layer">
        <div
          v-for="(map, i) in startMaps"
          :key="map.itemId"
          class="st-panel"
          :class="{ 'is-shown': shown.includes(i), 'is-decider': map.decider }"
          :style="{
            '--i': i,
            ...(boxes[i] ? px(boxes[i]) : {}),
            backgroundImage: `url('${map.item?.poster || DEFAULT_POSTER}')`,
          }"
        >
          <div class="shade" />
          <!-- The edge first, where it sits on the board; who picked the map
               on the right (its number and picker together on a phone's
               short panels). -->
          <div class="top reveal">
            <span
              v-if="startEdge(map.itemId)"
              class="vb-edge tabular-nums"
              :data-tone="startEdge(map.itemId)!.tone"
              :title="startEdge(map.itemId)!.title"
            >
              <VetoCrest
                v-if="startEdge(map.itemId)!.lineup"
                :lineup="lineups[startEdge(map.itemId)!.lineup! - 1]"
                :size="22"
              />
              {{ startEdge(map.itemId)!.text }}
            </span>
            <VetoCrest
              v-if="map.pickedBy"
              class="by-b"
              :lineup="lineups[map.pickedBy - 1]"
              :size="28"
            />
            <span class="st-kick">
              <VetoCrest
                v-if="map.pickedBy"
                :lineup="lineups[map.pickedBy - 1]"
                :size="24"
              />
              <span>{{ map.label }}</span>
              <span v-if="map.pickedBy" class="by-t"
                >·
                {{
                  t("match.veto.picked_by", { team: lineupName(map.pickedBy) })
                }}</span
              >
            </span>
          </div>
          <div class="reveal">
            <div class="nm up">
              <img v-if="map.item?.patch" :src="map.item.patch" alt="" />
              <span>{{ map.item?.label }}</span>
            </div>
          </div>
          <div
            v-if="bestOf > 1"
            class="vb-num st-num reveal"
            aria-hidden="true"
          >
            <span class="k">{{
              map.decider ? t("match.veto.decider") : t("match.veto.map")
            }}</span>
            <b class="tabular-nums">{{ map.n }}</b>
          </div>
          <div class="bottom reveal">
            <div class="nm">
              <img v-if="map.item?.patch" :src="map.item.patch" alt="" />
              <span>{{ map.item?.label }}</span>
            </div>
            <VetoPlates
              :sides="map.sides"
              :lineups="lineups"
              :viewer="viewerLineup"
            />
          </div>
        </div>
        <!-- The server's state sits over the maps, where the eye already is
             (above their numbers in a series). -->
        <div
          class="st-boot"
          :class="{
            'is-shown':
              bootStatus && shown.length > 0 && start.phase !== 'ready',
            'is-series': startMaps.length > 1,
          }"
          :style="{ '--n': startMaps.length }"
          role="status"
          aria-live="polite"
        >
          <Spinner class="st-boot-icon" />
          <span class="st-boot-text">
            <b>{{ t(`match.veto.start.${bootPhase}`) }}</b>
            <span>{{ t(`match.veto.start.${bootPhase}_line`) }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vb {
  --vb-surface: hsl(var(--popover));
  --vb-surface-2: hsl(240 4% 13%);
  --vb-line: hsl(var(--border));
  --vb-line-2: hsl(var(--muted-foreground) / 0.28);
  --vb-muted: hsl(var(--muted-foreground));
  --vb-faint: hsl(var(--muted-foreground) / 0.65);
  --vb-amber: hsl(var(--tac-amber));
  --vb-ban: hsl(var(--destructive));
  --vb-pick: hsl(var(--success));
  --vb-decider: hsl(48 96% 62%);
  --vb-ct: hsl(212 70% 70%);
  --vb-t: hsl(38 85% 62%);
  --vb-ease: cubic-bezier(0.16, 1, 0.3, 1);
  container: vb / inline-size;
  display: grid;
  /* minmax(0, …): an auto column grows to the rail's min-content, and a best
     of five's eleven steps pushed the board past its column. */
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
}

/* ---------- status line ---------- */
.vb-status {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 46px;
  padding: 0 4px 2px;
  min-width: 0;
}
.vb > .vr {
  transition: opacity 200ms ease;
}
.vb > .vr.vb-rail-hold {
  opacity: 0;
}
.vb-status-leave-active {
  overflow: hidden;
  transition:
    height 420ms cubic-bezier(0.16, 1, 0.3, 1),
    margin 420ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 200ms ease;
}
.vb-status-leave-to {
  height: 0;
  margin-bottom: -10px;
  opacity: 0;
}
.vb-lead {
  flex: none;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
  font-size: 15px;
}
.vb-lead.is-you {
  color: var(--vb-amber);
}
.vb-line {
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--vb-muted);
}
.vb-step {
  flex: none;
  font-size: 12px;
  color: var(--vb-faint);
}
.vb-clock {
  flex: none;
  width: 3.4ch;
  text-align: right;
  font-weight: 700;
  font-size: 15px;
}
.vb-clock.is-urgent {
  color: var(--vb-ban);
}
.vb-bar {
  position: absolute;
  inset: auto 0 0 0;
  height: 2px;
  border-radius: 2px;
  overflow: hidden;
  background: var(--vb-line);
}
.vb-bar i {
  display: block;
  height: 100%;
  background: var(--vb-amber);
  transform-origin: left;
  transform: scaleX(0);
}
.vb-bar.is-timed i {
  transform: scaleX(var(--countdown, 0));
}
.vb-bar.is-other i {
  background: var(--vb-muted);
}
.vb-bar.is-urgent i {
  background: var(--vb-ban);
}

/* ---------- stage ---------- */
/* 16:7 of the board's width, but never taller than the maps need: a wide
   column (the match page's) would otherwise stand them half a screen tall. */
.vb-stage {
  display: flex;
  gap: 4px;
  height: min(43.75cqw, 380px);
  max-width: 100%;
  border-radius: 12px;
  overflow: hidden;
}
.vb-stage.is-region {
  height: min(34.375cqw, 300px);
}
/* Each slice is a container, as each start panel is, so the team plates fit
   the map they sit on. */
.vb-slice {
  container: panel / size;
  position: relative;
  flex: var(--g) 1 0;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--vb-surface);
  outline: none;
  /* Quick and retargetable: a map opening under a fast sweep is overtaken by
     the next one mid-way instead of finishing first. */
  transition: flex 240ms cubic-bezier(0.32, 0.72, 0, 1);
}
.vb-slice.is-thin {
  flex: 0 0 var(--vb-thin-w, 30px);
}
.vb-stage.is-keyed .vb-slice,
.vb-stage.is-keyed .vb-slice::before {
  transition: none;
}
/* Each map has softly rounded corners of its own, so the outline on the
   one you choose (or focus) is rounded too; the stage's outer corners stay
   at 12px. */
.vb-slice {
  border-radius: 6px;
}
.vb-slice:first-child {
  border-radius: 12px 6px 6px 12px;
}
.vb-slice:last-child {
  border-radius: 6px 12px 12px 6px;
}
.vb-slice::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px hsl(0 0% 100% / 0.06);
  transition: box-shadow 240ms var(--vb-ease);
}
.vb-poster {
  position: absolute;
  top: 50%;
  left: 50%;
  width: max(100%, var(--pw, 100%));
  height: max(100%, var(--ph, 100%));
  max-width: none;
  translate: -50% -50%;
  object-fit: cover;
  transition:
    filter 360ms var(--vb-ease),
    transform 900ms var(--vb-ease);
}
.vb-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    0deg,
    hsl(240 10% 4% / 0.92) 0%,
    hsl(240 10% 4% / 0.45) 45%,
    hsl(240 10% 4% / 0.25) 100%
  );
}
.vb-regionbg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(140% 80% at 50% 0%, hsl(240 5% 22% / 0.7), transparent 70%),
    var(--vb-surface);
}
/* your ping as a fill: the taller it stands, the better the region is for you */
.vb-pingfill {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: calc(var(--q) * 100%);
  background: linear-gradient(
    0deg,
    hsl(0 0% 100% / 0.08),
    hsl(0 0% 100% / 0.02)
  );
  border-top: 1px solid hsl(0 0% 100% / 0.16);
  transition: opacity 360ms var(--vb-ease);
}

/* Narrow slices stack the crest over its chip, centred, so a long chip never
   wraps against the edge; wide slices lay them out in a row. */
.vb-top {
  position: absolute;
  z-index: 2;
  top: 10px;
  left: 6px;
  right: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.vb-slice.is-thin .vb-top {
  left: 4px;
  right: 4px;
}
.vb-slice.is-wide .vb-top {
  left: 12px;
  right: 12px;
  flex-direction: row;
  justify-content: flex-start;
}

.vb-v {
  position: absolute;
  z-index: 1;
  left: 0;
  right: 0;
  bottom: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  transition: opacity 180ms var(--vb-ease) 60ms;
}
.vb-vpatch {
  width: min(30px, 66%);
  height: auto;
  filter: drop-shadow(0 3px 8px rgb(0 0 0 / 0.5));
  transition:
    filter 360ms,
    opacity 360ms;
}
.vb-vname,
.vb-vping {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  white-space: nowrap;
}
/* Map names read as they do on the match page's map cards: capitals,
   spaced wide. */
.vb-vname {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}
.vb-vping {
  font-size: 12px;
  color: var(--vb-muted);
}
.vb-vping b {
  color: hsl(var(--foreground));
}
.vb-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--vb-ban);
}
.vb-dot[data-status="Online"] {
  background: var(--vb-pick);
}
.vb-dot[data-status="Partial"] {
  background: hsl(45 93% 52%);
}

.vb-open {
  position: absolute;
  z-index: 2;
  left: 20px;
  right: 20px;
  bottom: 18px;
  display: grid;
  gap: 4px;
  min-width: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms var(--vb-ease);
}
.vb-namerow {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 48px;
  min-width: 0;
}
.vb-namerow img {
  width: 42px;
  height: 42px;
  flex: none;
  object-fit: contain;
  filter: drop-shadow(0 4px 10px rgb(0 0 0 / 0.5));
}
.vb-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 28px;
  font-weight: 800;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.vb-act {
  height: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.vb-sub {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: hsl(0 0% 100% / 0.75);
}
.vb-sub[data-tone="Ban"] {
  color: var(--vb-ban);
}
.vb-sub[data-tone="Pick"] {
  color: var(--vb-pick);
}
.vb-sub[data-tone="Decider"] {
  color: var(--vb-decider);
}
/* In as the map opens, at the width it opens to (so nothing reflows while
   it grows, it is only uncovered); gone at once when it closes. */
.vb-slice.is-wide .vb-open {
  opacity: 1;
  pointer-events: auto;
  transition: opacity 140ms var(--vb-ease) 40ms;
}
.vb-slice.is-sized .vb-open {
  right: auto;
  width: calc(var(--fw) - 40px);
}
.vb-slice.is-wide.is-sized .vb-top {
  right: auto;
  width: calc(var(--fw) - 24px);
}
.vb-slice.is-wide .vb-v {
  opacity: 0;
  transition: none;
}
.vb-slice.is-mid .vb-name {
  font-size: 16px;
}
.vb-slice.is-mid .vb-namerow {
  height: 36px;
  gap: 8px;
}
.vb-slice.is-mid .vb-namerow img {
  width: 24px;
  height: 24px;
}
.vb-slice.is-mid .vb-act {
  height: 22px;
  font-size: 12px;
}

/* Full colour means still available: bans go dark and thin, picks tuck in and
   dim until the veto ends (or their replay plays). */
.vb-slice[data-status="Ban"] .vb-poster {
  filter: grayscale(1) brightness(0.3);
}
.vb-slice[data-status="Ban"] .vb-vpatch {
  filter: grayscale(1);
  opacity: 0.4;
}
.vb-slice[data-status="Ban"] .vb-vname {
  color: var(--vb-faint);
}
.vb-slice[data-status="Ban"] .vb-regionbg {
  filter: grayscale(1) brightness(0.6);
}
.vb-slice[data-status="Ban"] .vb-pingfill {
  opacity: 0.3;
}
.vb-slice[data-status="Pick"]:not(.is-wide) .vb-poster {
  filter: grayscale(0.75) brightness(0.48);
}
.vb-slice[data-status="Pick"]:not(.is-wide) .vb-vpatch {
  opacity: 0.75;
}
.vb-slice[data-status="Pick"]:not(.is-wide) .vb-vname {
  color: hsl(0 0% 100% / 0.7);
}
/* What a map became is a short tick of colour at its foot, clear of the
   stage's rounded corners (before the name on a phone's rows). */
.vb-slice::before {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 7px;
  z-index: 4;
  width: var(--vb-foot-w, 24px);
  height: 3px;
  border-radius: 2px;
  translate: -50% 0;
  pointer-events: none;
  background: var(--vb-foot, transparent);
  transition: width 240ms cubic-bezier(0.32, 0.72, 0, 1);
}
/* An open map's mark runs the width of its words, and draws back to a tick
   as the map closes. */
.vb-slice.is-wide {
  --vb-foot-w: calc(100% - 40px);
}
.vb-slice[data-status="Ban"] {
  --vb-foot: var(--vb-ban);
}
.vb-slice[data-status="Pick"] {
  --vb-foot: var(--vb-pick);
}
.vb-slice[data-status="Decider"] {
  --vb-foot: var(--vb-decider);
}
.vb-slice[data-status="Ban"]::after {
  box-shadow: inset 0 0 0 1px hsl(0 0% 100% / 0.04);
}
.vb-slice.is-live {
  cursor: pointer;
  user-select: none;
}
/* On your turn a banned or played map says it can't be taken: the cursor,
   and a slight lift of its name and emblem under the pointer, nothing that
   moves. */
.vb.is-live
  .vb-slice:is([data-status="Ban"], [data-status="Pick"]):not(.is-wide):not(
    .is-siding
  ) {
  cursor: not-allowed;
}
.vb-slice.is-thin :is(.vb-vname, .vb-vpatch) {
  transition:
    color 150ms ease-out,
    opacity 150ms ease-out;
}
@media (hover: hover) and (pointer: fine) {
  .vb-slice.is-thin:hover .vb-vname {
    color: hsl(0 0% 100% / 0.85);
  }
  .vb-slice.is-thin[data-status="Ban"]:hover .vb-vpatch {
    opacity: 0.7;
  }
  .vb-slice.is-thin[data-status="Pick"]:hover .vb-vpatch {
    opacity: 1;
  }
}
.vb-slice.is-live.is-wide .vb-poster {
  transform: scale(1.03);
}
.vb-slice:focus-visible::after {
  box-shadow: inset 0 0 0 2px var(--vb-amber);
}
/* The chosen map takes the colour of the move it is about to get, with its
   mark in the middle while it is open. */
.vb {
  --vb-arm: var(--vb-ban);
  --vb-arm-hsl: var(--destructive);
  --vb-arm-deep: color-mix(in oklab, var(--vb-arm) 74%, black);
}
.vb[data-act="Pick"] {
  --vb-arm: var(--vb-pick);
  --vb-arm-hsl: var(--success);
  --vb-arm-deep: color-mix(in oklab, var(--vb-arm) 74%, black);
}
.vb-slice.is-selected::after {
  box-shadow: inset 0 0 0 2px var(--vb-arm);
}
.vb-arm {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: linear-gradient(
    0deg,
    hsl(var(--vb-arm-hsl) / 0.4),
    hsl(var(--vb-arm-hsl) / 0.06) 70%
  );
  animation: vb-arm-in 160ms var(--vb-ease);
}
/* The open map's mark; chosen, a disc springs in behind it and it pings
   until pressed, lifts under the pointer and sinks when clicked. */
.vb-mark {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}
/* Chosen, the rest of the map steps back so the button leads: the picture
   darkens around it and the records dim. */
.vb-mark.is-armed::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  background: radial-gradient(
    circle at 50% var(--arm-y, 50%),
    transparent 0,
    transparent 60px,
    rgb(0 0 0 / 0.5) 240px
  );
  animation: vb-arm-in 360ms ease both;
}
.vb-slice.is-selected .vb-scout.is-shown {
  opacity: 0.35;
}
/* The open map's mark sits on a circle. Chosen, the circle turns solid in
   the move's colour and stretches evenly into a pill: the mark, full size,
   moves left and a small Confirm comes up on its right, and it pings until
   pressed. Sent, the word goes and the pill folds back into the circle
   around the spinner. */
.vb-arm-ping,
.vb-arm-btn {
  position: absolute;
  left: 50%;
  top: var(--arm-y, 50%);
  width: var(--arm-d, 84px);
  height: var(--arm-d, 84px);
  border-radius: calc(var(--arm-d, 84px) / 2);
  translate: -50% -50%;
  transition:
    width 240ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 140ms ease-out 40ms,
    scale 150ms ease-out,
    filter 150ms ease-out;
}
.vb-mark.is-armed .vb-arm-ping,
.vb-mark.is-armed .vb-arm-btn {
  width: calc(var(--arm-d, 84px) + 76px);
}
.vb-mark.is-armed.is-sending .vb-arm-ping,
.vb-mark.is-armed.is-sending .vb-arm-btn {
  width: var(--arm-d, 84px);
  transition-delay: 60ms, 40ms, 0ms, 0ms;
}
.vb-arm-ping {
  background: var(--vb-arm-deep);
  opacity: 0;
}
.vb-slice.is-wide .vb-mark.is-armed:not(.is-sending) .vb-arm-ping {
  animation: vb-ping-pill 1.8s cubic-bezier(0, 0, 0.2, 1) 500ms infinite;
}
@keyframes vb-ping-pill {
  0% {
    opacity: 0.5;
    transform: scale(1);
  }
  75%,
  100% {
    opacity: 0;
    transform: scale(1.14);
  }
}
.vb-arm-btn {
  isolation: isolate;
  display: grid;
  place-items: center;
  color: white;
  opacity: 0;
}
.vb-arm-btn::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  background: var(--vb-arm-deep);
  box-shadow:
    inset 0 0 0 3px hsl(0 0% 100% / 0.85),
    0 12px 30px rgb(0 0 0 / 0.5);
  opacity: 0;
  scale: 0.55;
  transition:
    opacity 160ms var(--vb-ease),
    scale 380ms cubic-bezier(0.34, 1.56, 0.64, 1),
    background-color 200ms ease,
    box-shadow 200ms ease;
}
/* The pointer on the mark itself, not yet chosen: a pale glass circle, so
   it reads as the button to press. */
@media (hover: hover) and (pointer: fine) {
  .vb-slice.is-wide .vb-mark:not(.is-armed) .vb-arm-btn:hover::before {
    opacity: 1;
    scale: 1;
    background: hsl(0 0% 100% / 0.14);
    box-shadow:
      inset 0 0 0 2px hsl(0 0% 100% / 0.4),
      0 12px 30px rgb(0 0 0 / 0.35);
    backdrop-filter: blur(4px);
  }
}
.vb-arm-btn > svg {
  width: calc(var(--arm-d, 84px) * 0.48);
  height: calc(var(--arm-d, 84px) * 0.48);
  filter: drop-shadow(0 4px 12px rgb(0 0 0 / 0.55));
  transition: translate 240ms cubic-bezier(0.32, 0.72, 0, 1);
}
.vb-mark.is-armed .vb-arm-btn > svg {
  translate: -38px 0;
}
.vb-mark.is-armed.is-sending .vb-arm-btn > svg {
  translate: none;
}
.vb-arm-word {
  position: absolute;
  top: 50%;
  left: calc(var(--arm-d, 84px) * 0.9);
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  white-space: nowrap;
  opacity: 0;
  translate: -6px -50%;
  transition:
    opacity 140ms ease,
    translate 260ms var(--vb-ease);
}
.vb-mark.is-armed:not(.is-sending) .vb-arm-word {
  opacity: 1;
  translate: 0 -50%;
  transition-delay: 120ms;
}
.vb-mark.is-armed.is-sending .vb-arm-word {
  transition-duration: 100ms;
}
.vb-slice.is-wide .vb-arm-btn {
  opacity: 0.9;
  pointer-events: auto;
}
.vb-slice.is-wide .vb-mark.is-armed .vb-arm-btn {
  opacity: 1;
}
.vb-mark.is-armed .vb-arm-btn::before {
  opacity: 1;
  scale: 1;
}
@media (hover: hover) and (pointer: fine) {
  .vb-slice.is-wide .vb-mark.is-armed .vb-arm-btn:hover {
    scale: 1.03;
    filter: brightness(1.1);
  }
}
.vb-slice.is-wide .vb-mark.is-armed .vb-arm-btn:active {
  scale: 0.96;
  transition-duration: 80ms;
}
@keyframes vb-arm-in {
  from {
    opacity: 0;
  }
}
.vb-slice.is-echo::after {
  box-shadow: inset 0 0 0 2px hsl(0 0% 100% / 0.55);
}

/* ---------- side split ---------- */
.vb-split {
  position: absolute;
  inset: 0;
  z-index: 3;
  animation: vb-split-in 260ms var(--vb-ease) 120ms both;
}
@keyframes vb-split-in {
  from {
    opacity: 0;
  }
}
.vb-half {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 0;
  border: 0;
  color: hsl(var(--foreground));
  background-size: cover;
  background-position: center;
  cursor: pointer;
  transition: clip-path 420ms var(--vb-ease);
}
.vb-half::before {
  content: "";
  position: absolute;
  inset: 0;
}
.vb-half:disabled {
  cursor: default;
}
.vb-half[data-side="CT"] {
  clip-path: polygon(0 0, 57% 0, 43% 100%, 0 100%);
}
.vb-half[data-side="T"] {
  clip-path: polygon(57% 0, 100% 0, 100% 100%, 43% 100%);
}
.vb-half[data-side="CT"]::before {
  background: linear-gradient(
    100deg,
    hsl(216 55% 22% / 0.9),
    hsl(214 50% 30% / 0.55)
  );
}
.vb-half[data-side="T"]::before {
  background: linear-gradient(
    260deg,
    hsl(30 55% 18% / 0.9),
    hsl(38 55% 30% / 0.55)
  );
}
.vb-split.sel-CT .vb-half[data-side="CT"],
.vb-split:has(.vb-half[data-side="CT"]:not(:disabled):hover)
  .vb-half[data-side="CT"] {
  clip-path: polygon(0 0, 63% 0, 49% 100%, 0 100%);
}
.vb-split.sel-CT .vb-half[data-side="T"],
.vb-split:has(.vb-half[data-side="CT"]:not(:disabled):hover)
  .vb-half[data-side="T"] {
  clip-path: polygon(63% 0, 100% 0, 100% 100%, 49% 100%);
}
.vb-split.sel-T .vb-half[data-side="CT"],
.vb-split:has(.vb-half[data-side="T"]:not(:disabled):hover)
  .vb-half[data-side="CT"] {
  clip-path: polygon(0 0, 51% 0, 37% 100%, 0 100%);
}
.vb-split.sel-T .vb-half[data-side="T"],
.vb-split:has(.vb-half[data-side="T"]:not(:disabled):hover)
  .vb-half[data-side="T"] {
  clip-path: polygon(51% 0, 100% 0, 100% 100%, 37% 100%);
}
/* A little below the middle: a chosen side's tile grows upward, clear of
   the map's name. */
.vb-half-in {
  position: absolute;
  top: calc(50% + 10px);
  translate: 0 -50%;
  width: 36%;
  display: grid;
  justify-items: center;
  gap: 4px;
  text-align: center;
}
/* Centred in each side's half of the diagonal. */
.vb-half[data-side="CT"] .vb-half-in {
  left: 7%;
}
.vb-half[data-side="T"] .vb-half-in {
  right: 7%;
}
/* The chosen side's logo becomes a round button, as a chosen map's mark
   does: a second click on the side starts there. */
/* A side's logo sits on a circle. Chosen, it gets a map mark's treatment:
   the circle turns solid in the side's colour and stretches evenly into a
   pill, the logo (full size) moving left and Confirm coming up on its right,
   pinging until pressed. Sent, it folds back around the spinner. */
.vb-side-mark {
  --sm: 84px;
  --grow: 70px;
  position: relative;
  isolation: isolate;
  display: grid;
  place-items: center;
  width: var(--sm);
  height: var(--sm);
  margin: -14px 0 4px;
  border-radius: 50%;
  transition: scale 240ms var(--vb-ease);
}
.vb-side-mark > img,
.vb-side-mark > svg {
  position: relative;
  width: calc(var(--sm) * 0.667);
  height: calc(var(--sm) * 0.667);
  filter: drop-shadow(0 6px 14px rgb(0 0 0 / 0.5));
  transition: translate 240ms cubic-bezier(0.32, 0.72, 0, 1);
}
.vb-side-mark > svg {
  color: white;
}
.vb-split:not(.is-sending) .vb-half.is-selected .vb-side-mark > img {
  translate: calc(var(--grow) / -2) 0;
}
.vb-side-word {
  position: absolute;
  top: 50%;
  left: calc(var(--grow) / -2 + var(--sm) * 0.9 + 4px);
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  white-space: nowrap;
  color: white;
  opacity: 0;
  translate: -6px -50%;
  transition:
    opacity 100ms ease-out,
    translate 220ms cubic-bezier(0.32, 0.72, 0, 1);
}
.vb-split:not(.is-sending) .vb-half.is-selected .vb-side-word {
  opacity: 1;
  translate: 0 -50%;
  transition-delay: 120ms;
}
.vb-side-mark::before,
.vb-side-mark::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--sm);
  height: var(--sm);
  translate: -50% -50%;
  border-radius: calc(var(--sm) / 2);
  background: var(--vb-side-deep);
  opacity: 0;
  transition: width 240ms cubic-bezier(0.32, 0.72, 0, 1);
}
.vb-split:not(.is-sending) .vb-half.is-selected .vb-side-mark::before,
.vb-split:not(.is-sending) .vb-half.is-selected .vb-side-mark::after {
  width: calc(var(--sm) + var(--grow));
}
.vb-side-mark::before {
  box-shadow:
    inset 0 0 0 3px hsl(0 0% 100% / 0.85),
    0 12px 30px rgb(0 0 0 / 0.5);
  scale: 0.55;
  transition:
    opacity 160ms var(--vb-ease),
    scale 380ms cubic-bezier(0.34, 1.56, 0.64, 1),
    background-color 200ms ease,
    box-shadow 200ms ease,
    width 240ms cubic-bezier(0.32, 0.72, 0, 1);
}
/* The pointer on a side's logo gets the same pale circle a map's mark does. */
@media (hover: hover) and (pointer: fine) {
  .vb-split:not(.is-sending)
    .vb-half:not(.is-selected):not(:disabled)
    .vb-side-mark:hover::before {
    opacity: 1;
    scale: 1;
    background: hsl(0 0% 100% / 0.14);
    box-shadow:
      inset 0 0 0 2px hsl(0 0% 100% / 0.4),
      0 12px 30px rgb(0 0 0 / 0.35);
    backdrop-filter: blur(4px);
  }
}
.vb-side-mark::after {
  z-index: -1;
}
.vb-half[data-side="CT"] {
  --vb-side-deep: color-mix(in oklab, var(--vb-ct) 52%, black);
}
.vb-half[data-side="T"] {
  --vb-side-deep: color-mix(in oklab, var(--vb-t) 52%, black);
}
.vb-half.is-selected .vb-side-mark::before {
  opacity: 1;
  scale: 1;
}
/* Short maps (a narrower board) keep the side's words clear of the map's
   name and of whose call it is. */
@container panel (max-height: 320px) {
  .vb-side-mark {
    --sm: 68px;
    margin: -10px 0 2px;
  }
  .vb-half-in {
    top: calc(50% + 14px);
  }
}
@container panel (max-height: 290px) {
  .vb-side-mark {
    --sm: 60px;
    margin: -8px 0 2px;
  }
  .vb-half-in {
    top: calc(50% + 12px);
  }
  .vb-half-in small {
    display: none;
  }
}
.vb-split:not(.is-sending) .vb-half.is-selected .vb-side-mark::after {
  animation: vb-ping-side 1.8s cubic-bezier(0, 0, 0.2, 1) 500ms infinite;
}
@keyframes vb-ping-side {
  0% {
    opacity: 0.55;
    transform: scale(1);
  }
  75%,
  100% {
    opacity: 0;
    transform: scale(1.12, 1.2);
  }
}
@media (hover: hover) and (pointer: fine) {
  .vb-split:not(.is-sending) .vb-half.is-selected .vb-side-mark:hover {
    scale: 1.07;
  }
}
.vb-split:not(.is-sending) .vb-half.is-selected .vb-side-mark:active {
  scale: 0.96;
  transition-duration: 80ms;
}
/* The chosen side lifts out of the stage as one button: it scales up from
   where it sits, with a 2px border in the turn's gold that follows the
   diagonal (four hard offsets of its shape) and a drop shadow, while the
   other side steps back under a dark layer. */
.vb-stage:has(.vb-slice.is-siding),
.vb-slice.is-siding {
  overflow: visible;
}
.vb-slice.is-siding {
  z-index: 3;
}
.vb-lift {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 10px;
  pointer-events: none;
  transform-origin: 28% 50%;
  transition:
    transform 320ms cubic-bezier(0.34, 1.36, 0.64, 1),
    filter 320ms ease-out;
  will-change: transform;
}
.vb-lift[data-side="T"] {
  transform-origin: 72% 50%;
}
.vb-lift > .vb-half {
  pointer-events: auto;
}
.vb-lift.is-up {
  z-index: 2;
  transform: scale(1.08);
  filter: drop-shadow(2px 0 0 var(--vb-amber))
    drop-shadow(-2px 0 0 var(--vb-amber)) drop-shadow(0 2px 0 var(--vb-amber))
    drop-shadow(0 -2px 0 var(--vb-amber))
    drop-shadow(0 4px 6px rgb(0 0 0 / 0.39))
    drop-shadow(0 18px 20px rgb(0 0 0 / 0.65));
}
.vb-split:not(.is-sending) .vb-lift.is-up:active,
.vb-split.is-sending .vb-lift.is-up {
  transform: scale(1.06);
}
.vb-split:not(.is-sending) .vb-lift.is-up:active {
  transition-duration: 100ms;
}
.vb-half::after {
  content: "";
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 0.42);
  opacity: 0;
  pointer-events: none;
  transition: opacity 320ms ease-out;
}
.vb-lift.is-down .vb-half::after {
  opacity: 1;
}
.vb-sidehead,
.vb-sideby {
  z-index: 4;
}
/* The chosen side carries the turn's colour itself, so the gold frame
   around the maps fades out rather than being half covered. */
.vb-stage.is-yours:has(.vb-split:is(.sel-CT, .sel-T)) {
  outline-color: transparent;
}
@media (hover: hover) and (pointer: fine) {
  /* A hint of the lift before choosing. */
  .vb-split:not(.sel-CT):not(.sel-T)
    .vb-lift:has(.vb-half:not(:disabled):hover) {
    transform: scale(1.012);
  }
  /* The pointer on the other side: the chosen one settles halfway and its
     border goes neutral, and the side under the pointer lights back up. */
  .vb-split:not(.is-sending):has(.vb-lift.is-down .vb-half:not(:disabled):hover)
    .vb-lift.is-up {
    transform: scale(1.04);
    filter: drop-shadow(2px 0 0 hsl(0 0% 100% / 0.3))
      drop-shadow(-2px 0 0 hsl(0 0% 100% / 0.3))
      drop-shadow(0 2px 0 hsl(0 0% 100% / 0.3))
      drop-shadow(0 -2px 0 hsl(0 0% 100% / 0.3))
      drop-shadow(0 4px 6px rgb(0 0 0 / 0.2))
      drop-shadow(0 18px 20px rgb(0 0 0 / 0.33));
    transition:
      transform 200ms ease-out,
      filter 200ms ease-out;
  }
  .vb-split:not(.is-sending)
    .vb-lift.is-down
    .vb-half:not(:disabled):hover::after {
    opacity: 0.25;
    transition-duration: 200ms;
  }
}
.vb-half-in b {
  position: relative;
  font-size: 20px;
  font-weight: 800;
}
.vb-half-in small {
  position: relative;
  font-size: 13px;
  color: hsl(0 0% 100% / 0.75);
}
/* The map being decided, over the seam at the top. */
.vb-sidehead {
  position: absolute;
  left: 50%;
  top: 14px;
  translate: -50% 0;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 80%;
  padding: 6px 16px 6px 8px;
  border-radius: 999px;
  background: hsl(240 10% 4% / 0.78);
  box-shadow: 0 0 0 1px hsl(0 0% 100% / 0.12);
  font-size: 17px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}
.vb-sidehead img {
  width: 30px;
  height: 30px;
  flex: none;
  object-fit: contain;
}
.vb-sideby {
  position: absolute;
  left: 50%;
  bottom: 16px;
  translate: -50% 0;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 80%;
  height: 32px;
  padding: 0 14px 0 5px;
  border-radius: 999px;
  background: hsl(240 10% 4% / 0.82);
  box-shadow: 0 0 0 1px hsl(0 0% 100% / 0.12);
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}
.vb-sideby.is-you {
  color: var(--vb-amber);
  box-shadow: 0 0 0 1px hsl(var(--tac-amber) / 0.45);
}
/* Its colour tick would sit under the split. */
.vb-slice.is-siding::before {
  display: none;
}

/* ---------- series ---------- */
.vb-series {
  display: flex;
  gap: 6px;
  min-width: 0;
}
.vb-chip {
  flex: 1 1 0;
  min-width: 0;
  height: 40px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px 0 5px;
  border-radius: 8px;
  font-size: 12px;
  color: var(--vb-faint);
  box-shadow: inset 0 0 0 1px var(--vb-line);
  white-space: nowrap;
  overflow: hidden;
}
.vb-chip .th {
  width: 40px;
  height: 28px;
  flex: none;
  border-radius: 5px;
  object-fit: cover;
}
.vb-chip .th.is-empty {
  box-shadow: inset 0 0 0 1px var(--vb-line-2);
  background: repeating-linear-gradient(
    135deg,
    transparent 0 5px,
    hsl(0 0% 100% / 0.04) 5px 6px
  );
}
.vb-chip .tx {
  display: grid;
  min-width: 0;
  line-height: 1.2;
}
.vb-chip .n {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
}
.vb-chip.is-set .n {
  color: hsl(0 0% 100% / 0.72);
}
.vb-chip .m {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
  color: var(--vb-muted);
}
.vb-chip.is-set .m {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
/* Who picked the map, and the side they start on. */
.vb-chip .end {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
.vb-chip .sd {
  width: 18px;
  height: 18px;
  flex: none;
}
.vb-chip.is-set {
  background: var(--vb-surface);
  box-shadow: inset 0 0 0 1px var(--vb-line-2);
}
.vb-chip.is-set .m {
  font-weight: 700;
  color: hsl(var(--foreground));
}

/* ---------- scouting ---------- */
/* The key: one fixed line between the order of play and the stage. */
.vb-scoutkey {
  height: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 0 4px;
  font-size: 12px;
  color: var(--vb-muted);
  white-space: nowrap;
}
.vb-scoutkey .lead {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.vb-scoutkey b {
  font-weight: 600;
  color: hsl(var(--foreground));
}
.vb-scoutkey .fine {
  flex: none;
  margin-left: auto;
  color: var(--vb-faint);
}
/* The edge on a map: the stronger side's crest and its lead in points. */
.vb-edge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px 1px 2px;
  border-radius: 4px;
  background: rgb(0 0 0 / 0.62);
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}
.vb-edge[data-tone="you"],
.vb-edge[data-tone="them"] {
  padding-left: 6px;
}
.vb-edge[data-tone="you"] {
  color: var(--vb-pick);
  box-shadow: inset 0 0 0 1px hsl(var(--success) / 0.45);
}
.vb-edge[data-tone="them"] {
  color: var(--vb-ban);
  box-shadow: inset 0 0 0 1px hsl(var(--destructive) / 0.45);
}
.vb-edge[data-tone="side"] {
  color: hsl(var(--foreground));
  box-shadow: inset 0 0 0 1px hsl(0 0% 100% / 0.35);
}
.vb-edge[data-tone="even"],
.vb-edge[data-tone="few"] {
  padding-left: 6px;
  font-weight: 600;
  color: hsl(0 0% 100% / 0.7);
}
/* Edge and habit on one map share one box, the same width on every map, so
   they line up across the pool. */
/* On a picked map the edge stands alone, first, where it sits on an open
   map. */
.vb-tag.is-bare {
  display: contents;
}
.vb-tag.is-bare > .vb-edge {
  order: -1;
}
.vb-id {
  display: contents;
}
.vb-slice.is-wide .vb-id > .veto-crest {
  order: 2;
}
/* An edge on its own (a picked map, a start panel) is a chip of its own,
   as tall as the crests and labels beside it. */
.vb-tag.is-bare > .vb-edge,
.st-panel .top .vb-edge {
  height: 28px;
  padding: 0 10px;
  gap: 5px;
  border-radius: 6px;
  font-size: 15px;
  line-height: 1;
}
.vb-tag.is-bare > .vb-edge[data-tone="side"],
.st-panel .top .vb-edge[data-tone="side"] {
  padding-left: 3px;
  gap: 6px;
}
.vb-tag:not(.is-bare) {
  display: flex;
  flex-direction: column;
  width: min(100%, 132px);
  padding: 0 2px;
  border-radius: 6px;
  background: rgb(0 0 0 / 0.62);
  transition: opacity 180ms var(--vb-ease) 60ms;
}
/* On the map you open the edge gives way to the records, and comes back as
   they fade out. */
.vb-tag.is-away {
  opacity: 0;
  pointer-events: none;
  transition: opacity 100ms var(--vb-ease);
}
.vb-tag:not(.is-bare) > .vb-edge,
.vb-tag:not(.is-bare) > .vb-habit {
  justify-content: center;
  max-width: none;
  padding: 2px 4px;
  background: none;
  box-shadow: none;
}
/* Everything at the top of a map is one height: the edge (in its box or on
   its own), the crests, the map's label. */
.vb-tag:not(.is-bare) > .vb-edge {
  height: 28px;
  padding: 0 4px;
  font-size: 15px;
}
.vb-tag:not(.is-bare) > .vb-habit,
.vb-tag:not(.is-bare) > .vb-krow {
  padding: 4px 4px 5px;
  border-top: 1px solid hsl(0 0% 100% / 0.18);
}
.vb-krow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}
.vb-scouthead {
  display: flex;
  gap: 6px;
  font-size: 11px;
  color: hsl(0 0% 100% / 0.6);
}
.vb-scouthead b {
  font-weight: 600;
  color: hsl(var(--foreground));
}
/* A habit is quieter than the edge above it: neutral words, and the ban or
   pick colour only as a dot, so green and red there keep meaning you and
   them. */
.vb-habit {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 1px 6px 1px 2px;
  border-radius: 4px;
  background: rgb(0 0 0 / 0.6);
  font-size: 10px;
  font-weight: 600;
  color: hsl(0 0% 100% / 0.82);
}
/* On a narrow slice the words wrap under each other rather than cut off. */
.vb-habit .txt {
  order: 2;
  min-width: 0;
  padding-block: 1px;
  line-height: 1.15;
  text-align: center;
}
.vb-habit[data-kind="ban"]::after,
.vb-habit[data-kind="pick"]::after {
  content: "";
  width: 6px;
  height: 6px;
  flex: none;
  order: 1;
  border-radius: 50%;
}
.vb-habit[data-kind="ban"]::after {
  background: var(--vb-ban);
}
.vb-habit[data-kind="pick"]::after {
  background: var(--vb-pick);
}
.vb-habit[data-kind^="likely"] {
  color: hsl(var(--foreground));
  box-shadow: inset 0 0 0 1px hsl(0 0% 100% / 0.5);
}
/* Their likely move while they are on the clock. */
.vb-likely {
  position: absolute;
  inset: 3px;
  z-index: 4;
  border: 1.5px dashed hsl(0 0% 100% / 0.55);
  border-radius: 4px;
  pointer-events: none;
}
.vb-slice:first-child .vb-likely {
  border-radius: 9px 4px 4px 9px;
}
.vb-slice:last-child .vb-likely {
  border-radius: 4px 9px 9px 4px;
}
/* Both sides' records sit at the top of the open map, above its name. */
.vb-slice.is-wide .vb-top {
  flex-wrap: wrap;
}
.vb-scout {
  position: absolute;
  top: 0;
  left: 0;
  width: min(300px, calc(var(--fw, 324px) - 24px));
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms var(--vb-ease);
  display: grid;
  gap: 5px;
  padding: 7px 9px;
  border-radius: 8px;
  background: hsl(240 10% 4% / 0.55);
  backdrop-filter: blur(4px);
}
.vb-scout.is-shown {
  opacity: 1;
  pointer-events: auto;
  transition: opacity 140ms var(--vb-ease) 40ms;
}
.vb-slice:not(.is-wide) .vb-scout {
  left: 6px;
}
.vb-rec {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto 64px 3.2em;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: hsl(0 0% 100% / 0.72);
}
.vb-rec .nm {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vb-rec .wl {
  font-weight: 600;
  color: hsl(var(--foreground));
}
.vb-rec .pct {
  text-align: right;
  font-weight: 700;
  color: hsl(var(--foreground));
}
.vb-rec .trk {
  height: 4px;
  overflow: hidden;
  border-radius: 2px;
  background: hsl(0 0% 100% / 0.12);
}
.vb-rec .trk i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: hsl(0 0% 100% / 0.45);
}
.vb-rec.is-ahead .trk i {
  background: hsl(var(--foreground));
}
.vb-rec.is-none .wl,
.vb-rec.is-none .pct {
  font-weight: 500;
  color: var(--vb-muted);
}
.vb-habitline {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: hsl(0 0% 100% / 0.78);
}
.vb-habitline::before {
  content: "";
  width: 6px;
  height: 6px;
  flex: none;
  border-radius: 50%;
  background: currentColor;
}
.vb-habitline[data-kind="ban"] {
  color: var(--vb-ban);
}
.vb-habitline[data-kind="pick"] {
  color: var(--vb-pick);
}
.vb-scoutnote {
  font-size: 11px;
  color: hsl(0 0% 100% / 0.5);
}

/* The key hint takes the step counter's place while you steer by keys. */
.vb-keys {
  flex: none;
  font-size: 12px;
  color: var(--vb-muted);
  white-space: nowrap;
}
.vb-keys kbd {
  margin: 0 1px;
  padding: 0 5px;
  border-radius: 4px;
  font: inherit;
  font-size: 11px;
  color: hsl(var(--foreground));
  box-shadow: inset 0 0 0 1px hsl(var(--muted-foreground) / 0.4);
}
/* Your turn: the maps themselves are outlined in gold, where your eyes
   already are. */
.vb-stage {
  outline: 2px solid transparent;
  outline-offset: 3px;
  transition: outline-color 240ms var(--vb-ease);
}
.vb-stage.is-yours,
.vb-stage:focus-visible {
  outline-color: var(--vb-amber);
}

/* ---------- the start: the series grows into the maps ---------- */
.st-area {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
}
.st-area > .vb-stage,
.st-area > .vb-series {
  transition: opacity 280ms ease;
}
.st-area.is-starting > .vb-stage,
.st-area.is-starting > .vb-series {
  opacity: 0;
  pointer-events: none;
}
.st-area.is-starting > .vb-series {
  transition-duration: 160ms;
}
.st-layer {
  position: absolute;
  inset: 0;
}
.st-boot {
  position: absolute;
  z-index: 3;
  left: 50%;
  top: 44%;
  display: flex;
  align-items: center;
  gap: 14px;
  max-width: calc(100% - 32px);
  padding: 14px 22px 14px 18px;
  border-radius: 12px;
  background: hsl(240 10% 4% / 0.72);
  backdrop-filter: blur(10px);
  box-shadow:
    inset 0 0 0 1px hsl(0 0% 100% / 0.12),
    0 12px 32px rgb(0 0 0 / 0.45);
  pointer-events: none;
  opacity: 0;
  translate: -50% calc(-50% + 8px);
  transition:
    opacity 320ms var(--vb-ease),
    translate 420ms var(--vb-ease);
}
.st-boot.is-shown {
  opacity: 1;
  translate: -50% -50%;
}
/* A series puts it on one line, between the maps' edges and their numbers. */
.st-boot.is-series {
  top: 22%;
  padding: 10px 18px 10px 14px;
}
.st-boot.is-series .st-boot-text {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.st-boot.is-series .st-boot-text b {
  font-size: 16px;
}
.st-boot-icon {
  flex: none;
  width: 22px;
  height: 22px;
  color: var(--vb-amber);
}
.st-boot-text {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.st-boot-text > * {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.st-boot-text b {
  font-size: 18px;
  font-weight: 700;
}
.st-boot-text span {
  font-size: 13px;
  color: hsl(0 0% 100% / 0.72);
}
/* A phone's rows: just the state, in the middle of the first map. */
@container vb (max-width: 560px) {
  .st-boot,
  .st-boot.is-series {
    top: calc(45% / var(--n));
    padding: 10px 16px 10px 12px;
  }
  .st-boot-text span {
    display: none;
  }
}
.st-panel {
  container: panel / size;
  position: absolute;
  overflow: hidden;
  border-radius: 12px;
  background-color: var(--vb-surface);
  background-size: cover;
  background-position: center;
}
.st-panel::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px hsl(0 0% 100% / 0.1);
  pointer-events: none;
}
/* The map stays the picture: only the edges darken, for the words. */
.st-panel .shade {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      0deg,
      hsl(240 10% 4% / 0.88) 0%,
      hsl(240 10% 4% / 0.35) 34%,
      transparent 52%
    ),
    linear-gradient(180deg, hsl(240 10% 4% / 0.5) 0%, transparent 20%);
}
.st-panel .reveal {
  opacity: 0;
  translate: 0 8px;
  transition:
    opacity 320ms var(--vb-ease) calc(var(--i) * 70ms),
    translate 420ms var(--vb-ease) calc(var(--i) * 70ms);
}
.st-panel.is-shown .reveal {
  opacity: 1;
  translate: none;
}
.st-panel .top {
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  display: flex;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
}
.st-panel .bottom {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 10px;
  display: grid;
  gap: 8px;
}
.st-panel .nm {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding-left: 2px;
}
.st-panel .nm img {
  width: 32px;
  height: 32px;
  flex: none;
  object-fit: contain;
  filter: drop-shadow(0 4px 10px rgb(0 0 0 / 0.5));
}
.st-panel .nm span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 20px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.st-panel .nm.up {
  display: none;
}
/* A narrow map's words sit closer to its edges, so the team plates fit. */
.vb-slice.is-cramped .vb-open {
  left: 10px;
  bottom: 12px;
  width: calc(var(--fw) - 20px);
}
/* Narrow panels (best of five). */
@container panel (max-width: 200px) {
  .st-panel .nm span {
    font-size: 14px;
  }
  .st-panel .nm img {
    width: 22px;
    height: 22px;
  }
}
/* Short panels (rows on a phone): the name moves up beside the label. */
@container panel (max-height: 170px) {
  .st-panel .top {
    right: 45%;
  }
  .st-panel .bottom .nm {
    display: none;
  }
  .st-panel .nm.up {
    position: absolute;
    top: 10px;
    right: 10px;
    display: flex;
    padding: 0;
  }
  .st-panel .nm.up span {
    font-size: 17px;
  }
  .st-panel .nm.up img {
    width: 22px;
    height: 22px;
  }
}

/* ---------- the top of each map ---------- */
/* The edge on the left. On the right: the picker's crest, or on a wide map
   still in play its number and picker; a played map's number sits big in
   its middle. */
.vb-slice:not([data-status="Ban"]) .vb-id {
  display: none;
}
.vb-slice:not(.is-wide)[data-status="Pick"] .vb-id,
.vb-slice.is-mid[data-status="Pick"] .vb-id {
  display: contents;
}
.vb-slice.is-mid .vb-id > .veto-crest {
  margin-left: auto;
}
.vb-slice.is-mid .vb-top {
  flex-wrap: nowrap;
}
.vb-kick,
.st-kick {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
  height: 28px;
  padding: 0 9px 0 2px;
  overflow: hidden;
  border-radius: 6px;
  background: rgb(0 0 0 / 0.6);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}
.vb-kick:not(:has(.veto-crest)),
.st-kick:not(:has(.veto-crest)) {
  padding-left: 9px;
}
.vb-kick .by-t,
.st-kick .by-t {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  color: hsl(0 0% 100% / 0.7);
}
.vb-slice.is-wide .vb-kick {
  margin-left: auto;
}
.vb-kick.has-num,
.vb-krow {
  display: none;
}
@container panel (max-width: 240px) {
  .vb-kick .by-t,
  .st-kick .by-t {
    display: none;
  }
}
.vb-num {
  position: absolute;
  left: 0;
  right: 0;
  top: 46%;
  translate: 0 -50%;
  z-index: 2;
  display: grid;
  justify-items: center;
  gap: 4px;
  pointer-events: none;
  text-shadow:
    0 1px 3px rgb(0 0 0 / 0.8),
    0 2px 14px rgb(0 0 0 / 0.7);
}
/* A soft shade behind the number, so it reads on bright map art too. */
.vb-num::before {
  content: "";
  position: absolute;
  inset: -28px -12px;
  z-index: -1;
  background: radial-gradient(
    closest-side,
    rgb(0 0 0 / 0.5),
    rgb(0 0 0 / 0.25) 60%,
    transparent
  );
}
.vb-num .k {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: hsl(0 0% 100% / 0.85);
}
.vb-num b {
  font-size: 48px;
  font-weight: 800;
  line-height: 0.9;
  color: hsl(0 0% 100% / 0.95);
}
.vb-slice.is-thin .vb-num {
  display: none;
}
/* The decider is the map the veto leaves: framed and labelled in its gold,
   with one sweep of light as it lands. */
.vb-slice[data-status="Decider"].is-wide::after,
.st-panel.is-decider::after {
  box-shadow: inset 0 0 0 2px hsl(48 96% 62% / 0.85);
}
.vb-slice[data-status="Decider"] .vb-kick,
.st-panel.is-decider .st-kick {
  background: var(--vb-decider);
  color: hsl(240 10% 6%);
}
.vb-slice[data-status="Decider"] .vb-num .k,
.st-panel.is-decider .vb-num .k {
  color: var(--vb-decider);
}
.vb-shine {
  position: absolute;
  inset: 0;
  z-index: 3;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;
}
.vb-shine::before {
  content: "";
  position: absolute;
  inset: -10% -60%;
  background: linear-gradient(
    105deg,
    transparent 42%,
    hsl(48 96% 72% / 0.32) 50%,
    transparent 58%
  );
  translate: -70% 0;
}
.vb-slice.is-landing .vb-shine::before {
  animation: vb-shine 1.4s cubic-bezier(0.22, 1, 0.36, 1) 300ms 1 both;
}
@keyframes vb-shine {
  to {
    translate: 70% 0;
  }
}
/* The start's panels read the same as the finished board's maps. */
.st-panel .top .by-b {
  margin-left: auto;
}
.st-panel .top .st-kick {
  display: none;
}
.st-num {
  top: 44%;
}
.st-num.reveal {
  translate: 0 calc(-50% + 8px);
}
.st-panel.is-shown .st-num.reveal {
  translate: 0 -50%;
}
@container panel (max-height: 170px) {
  .st-num,
  .st-panel .top .by-b {
    display: none;
  }
  .st-panel .top .st-kick {
    display: inline-flex;
  }
  .st-panel .top .st-kick .by-t {
    display: none;
  }
}
/* A phone's rows are short: the edge and the map's number sit side by side
   in the box, the crests stay on the right, and the tick stands before the
   name. */
@container vb (max-width: 560px) {
  .vb-num,
  .vb-slice:not(.is-wide)[data-status="Pick"] .vb-id,
  .vb-slice.is-mid[data-status="Pick"] .vb-id {
    display: none;
  }
  .vb-kick.has-num {
    display: inline-flex;
  }
  .vb-krow {
    display: flex;
  }
  .vb-tag:not(.is-bare):has(.vb-krow) {
    flex-direction: row;
    width: auto;
  }
  .vb-tag:not(.is-bare) > .vb-krow {
    padding: 0 8px;
    border-top: 0;
    border-left: 1px solid hsl(0 0% 100% / 0.18);
  }
  .vb-tag:not(.is-bare):has(.vb-krow) > .vb-edge {
    padding: 0 8px;
  }
  .vb-slice.is-thin .vb-top {
    left: auto;
    right: 10px;
  }
  .vb-slice::before {
    left: 5px;
    top: 50%;
    bottom: auto;
    width: 3px;
    height: 14px;
    translate: 0 -50%;
  }
}

/* ---------- phones: the stage turns on its side ---------- */
@container vb (max-width: 560px) {
  .vb-status {
    height: 42px;
    gap: 8px;
  }
  .vb-lead {
    max-width: 55%;
    font-size: 13px;
  }
  .vb-line {
    font-size: 13px;
  }
  .vb-step {
    display: none;
  }
  .vb-stage {
    flex-direction: column;
    aspect-ratio: auto;
    height: 470px;
  }
  .vb-stage.is-region {
    height: 340px;
  }
  .vb-slice:first-child {
    border-radius: 12px 12px 6px 6px;
  }
  .vb-slice:last-child {
    border-radius: 6px 6px 12px 12px;
  }
  .vb-pingfill {
    top: 0;
    right: auto;
    height: auto;
    width: calc(var(--q) * 100%);
    border-top: 0;
    border-right: 1px solid hsl(0 0% 100% / 0.16);
    background: linear-gradient(
      90deg,
      hsl(0 0% 100% / 0.02),
      hsl(0 0% 100% / 0.08)
    );
  }
  .vb-v {
    top: 50%;
    bottom: auto;
    left: 12px;
    right: 90px;
    translate: 0 -50%;
    flex-direction: row;
    gap: 8px;
  }
  .vb-vpatch {
    width: 22px;
  }
  .vb-vname,
  .vb-vping {
    writing-mode: horizontal-tb;
    transform: none;
    font-size: 12px;
  }
  .vb-slice.is-thin .vb-vpatch {
    display: none;
  }
  .vb-slice.is-thin .vb-vname {
    font-size: 11px;
  }
  .vb-top,
  .vb-slice.is-wide .vb-top {
    top: 50%;
    left: auto;
    right: 10px;
    translate: 0 -50%;
    flex-direction: row;
  }
  .vb-slice.is-wide .vb-top {
    top: 10px;
    translate: none;
  }
  .vb-open {
    left: 14px;
    right: 14px;
    bottom: 12px;
  }
  .vb-name {
    font-size: 21px;
  }
  .vb-namerow {
    height: 38px;
  }
  .vb-namerow img {
    width: 32px;
    height: 32px;
  }
  .vb-slice.is-mid .vb-name {
    font-size: 15px;
  }
  .vb-slice.is-mid .vb-namerow {
    height: 28px;
  }
  .vb-slice.is-mid .vb-namerow img {
    width: 22px;
    height: 22px;
  }
  .vb-half-in {
    width: 42%;
  }
  .vb-side-mark {
    --sm: 56px;
    margin: -10px 0 4px;
  }
  .vb-side-word {
    bottom: 7px;
    font-size: 9px;
  }
  .vb-sidehead {
    top: 10px;
    font-size: 15px;
  }
  .vb-sidehead img {
    width: 22px;
    height: 22px;
  }
  .vb-half-in b {
    font-size: 15px;
  }
  .vb-half-in small {
    display: none;
  }
  .vb-chip {
    height: 38px;
    gap: 6px;
    padding: 0 7px 0 4px;
  }
  .vb-chip .th {
    width: 30px;
    height: 22px;
  }
  .vb-chip .sd {
    display: none;
  }
  .vb-keys {
    display: none;
  }
  .vb-scoutkey {
    font-size: 11px;
  }
  .vb-scoutkey .fine {
    display: none;
  }
  .vb-slice.is-wide .vb-top {
    left: 14px;
    right: 14px;
  }
  .vb-slice:not(.is-wide) .vb-scout {
    transition: none;
  }
  .vb-scout {
    gap: 3px;
    padding: 5px 7px;
  }
  .vb-rec {
    grid-template-columns: 16px minmax(0, 1fr) auto 40px 3em;
    gap: 6px;
    font-size: 11px;
  }
  .vb-slice:first-child .vb-likely {
    border-radius: 9px 9px 4px 4px;
  }
  .vb-slice:last-child .vb-likely {
    border-radius: 4px 4px 9px 9px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .vb *,
  .vb *::before,
  .vb *::after {
    transition-duration: 1ms !important;
    animation-duration: 1ms !important;
  }
  .vb-arm-ping,
  .vb-side-mark::after {
    display: none;
  }
  .vb-arm-btn,
  .vb-arm-btn > svg {
    transition-duration: 1ms !important;
  }
}
</style>
