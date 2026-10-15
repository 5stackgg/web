<script setup lang="ts">
import { computed, onBeforeUnmount, ref, toRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Spinner } from "~/components/ui/spinner";
import { useCountdown } from "~/composables/useCountdown";
import type {
  VetoBoardItem,
  VetoBoardLineup,
  VetoBoardStep,
} from "~/utilities/vetoOrder";

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
  }>(),
  {
    pickingLineup: null,
    isPicking: false,
    submitting: false,
    deadline: null,
    total: 0,
    bestOf: 1,
  },
);

const emit = defineEmits<{
  confirm: [choice: { itemId?: string; side?: string }];
}>();

const { t } = useI18n();

const REPLAY_MS = 2600;
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
let hoverTimer: ReturnType<typeof setTimeout> | undefined;
let pendingHover: string | null = null;
let replayTimer: ReturnType<typeof setTimeout> | undefined;

const recordCount = computed(
  () => props.steps.filter((s) => !!s.record).length,
);

// A move landing clears any half-made choice, and the map it touched opens for
// a moment for anyone not choosing right now.
watch(recordCount, (now, prev) => {
  selected.value = null;
  // A live move adds one (two when the decider lands with the last ban); a
  // bigger jump is the picks arriving on page load, not a move to replay.
  if (prev === undefined || now <= prev || now - prev > 2) return;
  const newest = props.steps[now - 1];
  if (!newest?.record || newest.type === "Side") return;
  replayId.value = newest.record.itemId;
  clearTimeout(replayTimer);
  replayTimer = setTimeout(() => {
    replayId.value = null;
  }, REPLAY_MS);
});
watch(
  () => props.isPicking,
  () => {
    selected.value = null;
  },
);

onBeforeUnmount(() => {
  clearTimeout(hoverTimer);
  clearTimeout(replayTimer);
});

const focus = computed(() => {
  const s = step.value;
  if (!s) return null;
  if (s.type === "Side") return sideMapId.value;
  if (s.type === "Decider") return available.value[0] ?? null;
  if (mine.value) {
    if (selected.value) return selected.value;
    return hover.value && available.value.includes(hover.value)
      ? hover.value
      : null;
  }
  return replayId.value;
});

function weight(id: string) {
  const status = stateOf(id).status;
  if (sideMapId.value) {
    return sideMapId.value === id ? 9 : status === "Ban" ? 0.42 : 0.8;
  }
  if (done.value) return status === "Ban" ? 0.42 : 2.2;
  if (focus.value === id) return 4.2;
  if (status === "Ban") return 0.42;
  if (status === "Pick") return 0.68;
  return 1;
}
const isWide = (id: string) =>
  !sideMapId.value &&
  (focus.value === id || (done.value && stateOf(id).status !== "Ban"));
const isLive = (id: string) =>
  live.value &&
  (step.value?.type === "Ban" || step.value?.type === "Pick") &&
  available.value.includes(id);

/* ---------- actions ---------- */
function confirm() {
  if (!mine.value || props.submitting || !selected.value) return;
  if (step.value?.type === "Side") {
    emit("confirm", { side: selected.value });
  } else {
    emit("confirm", { itemId: selected.value });
  }
}

function choose(id: string) {
  if (!isLive(id)) return;
  if (selected.value === id) confirm();
  else selected.value = id;
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

// Hover intent: a slice opens once the pointer settles on it, so sweeping
// across the stage does not ripple every slice open in turn.
function onPointerMove(event: PointerEvent) {
  if (event.pointerType === "touch") return;
  const el = (event.target as HTMLElement).closest<HTMLElement>("[data-item]");
  const id = el?.dataset.item ?? null;
  if (id === pendingHover) return;
  pendingHover = id;
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => {
    hover.value = id;
  }, 90);
}
function onPointerLeave() {
  clearTimeout(hoverTimer);
  pendingHover = null;
  hover.value = null;
}

/* ---------- countdown ---------- */
const { remaining, fraction, urgent } = useCountdown(
  toRef(props, "deadline"),
  toRef(props, "total"),
);
const timed = computed(() => !!props.deadline && !!actingLineup.value);
const seconds = computed(() => Math.ceil(remaining.value));

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
    return mine.value
      ? t("match.veto.pick_side", { map })
      : t("match.veto.picking_side", { map });
  }
  if (mine.value) {
    if (s.type === "Pick") return t("match.veto.pick_map");
    return isRegion.value
      ? t("match.veto.ban_region")
      : t("match.veto.ban_map");
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

// The read on a wide slice: an action on your turn, the move that just
// landed, the decider, or where a picked map stands once the veto is done.
function wideCopy(id: string): { sub: string; tone: string; cta?: string } {
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
    if (mine.value) {
      if (selected.value === id) {
        return {
          tone: "",
          sub: "",
          cta:
            s.type === "Ban"
              ? t("match.veto.cta_ban", { map: item?.label ?? "" })
              : t("match.veto.cta_pick", { map: item?.label ?? "" }),
        };
      }
      return {
        tone: "",
        sub:
          isRegion.value && item?.ping != null
            ? t("match.veto.choose_with_ping", { ping: item.ping })
            : t("match.veto.choose"),
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
  const st = stateOf(id);
  if (st.status === "open") return label(id);
  const who = st.lineup ? ` · ${lineupName(st.lineup)}` : "";
  return `${label(id)} · ${badge(id)}${who}`;
}

const sideSeam = computed(() => {
  const map = label(sideMapId.value);
  return mine.value
    ? t("match.veto.your_side_on", { map })
    : t("match.veto.their_side_on", {
        team: lineupName(actingLineup.value),
        map,
      });
});
const sidePoster = computed(() => {
  const item = props.items.find((entry) => entry.id === sideMapId.value);
  return `url("${item?.poster || DEFAULT_POSTER}")`;
});

/* ---------- order of play ---------- */
const railSteps = computed(() =>
  props.steps.map((s, index) => {
    const state = s.record ? "done" : index === cursor.value ? "now" : "next";
    const lineup = s.type === "Decider" ? null : (s.record?.lineup ?? s.lineup);
    const typeLabel =
      s.type === "Decider" && isRegion.value
        ? t("match.veto.steps.Region")
        : t(`match.veto.steps.${s.type}`);
    let what = typeLabel;
    let side: string | null = null;
    if (s.record) {
      if (s.type === "Side") {
        side = s.record.side ?? null;
        what = sideShort(side);
      } else {
        what = label(s.record.itemId);
      }
    }
    const detail = s.record
      ? s.type === "Side"
        ? `${sideShort(side)} · ${label(s.record.itemId)}`
        : label(s.record.itemId)
      : "";
    return {
      key: index,
      type: s.type,
      state,
      you: state === "now" && mine.value,
      tag: lineup ? props.lineups[lineup - 1].monogram : "",
      what,
      side,
      itemId: s.record?.itemId ?? null,
      title: [
        `${index + 1}. ${typeLabel}`,
        lineupName(lineup),
        detail,
        s.record?.auto ? t("match.picks.auto_picked") : "",
      ]
        .filter(Boolean)
        .join(" · "),
    };
  }),
);

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
      tag: st?.lineup ? props.lineups[st.lineup - 1].monogram : "",
      starts: st ? pickerStarts(st) : null,
    };
  });
});
const pingQ = (ping: number) => Math.max(0.12, 1 - ping / 170).toFixed(3);
</script>

<template>
  <div class="vb" :class="{ 'is-live': live }">
    <!-- One line in every state: your turn changes its colour and words, never
         its height. -->
    <div class="vb-status" aria-live="polite">
      <span
        v-if="actingLineup"
        class="vb-crest"
        style="--s: 24px"
        :title="lineupName(actingLineup)"
      >
        <img
          v-if="lineups[actingLineup - 1].crest"
          :src="lineups[actingLineup - 1].crest!"
          alt=""
        />
        <template v-else>{{ lineups[actingLineup - 1].monogram }}</template>
      </span>
      <span class="vb-lead" :class="{ 'is-you': mine }" :title="lead">{{
        lead
      }}</span>
      <span class="vb-line" :title="line">{{ line }}</span>
      <span class="vb-step tabular-nums">{{ stepCount }}</span>
      <span
        class="vb-clock tabular-nums"
        :class="{ 'is-urgent': timed && urgent }"
        >{{ timed ? `${seconds}s` : "" }}</span
      >
      <span
        class="vb-bar"
        :class="{ 'is-other': timed && !mine, 'is-urgent': timed && urgent }"
      >
        <i :style="{ transform: `scaleX(${timed ? fraction : 0})` }" />
      </span>
    </div>

    <ol
      class="vb-rail"
      :aria-label="t('match.veto.order')"
      @pointerleave="echo = null"
    >
      <li
        v-for="s in railSteps"
        :key="s.key"
        class="vb-railstep"
        :data-type="s.type"
        :data-state="s.state"
        :class="{ 'is-you': s.you }"
        :title="s.title"
        @pointerenter="echo = s.itemId"
      >
        <img v-if="s.side" class="sd" :src="sideIcon(s.side)" alt="" />
        <span class="what">{{ s.what }}</span>
        <span v-if="s.tag" class="who">{{ s.tag }}</span>
      </li>
    </ol>

    <div
      class="vb-stage"
      :class="{ 'is-region': isRegion }"
      @pointermove="onPointerMove"
      @pointerleave="onPointerLeave"
    >
      <div
        v-for="item in items"
        :key="item.id"
        class="vb-slice"
        :data-item="item.id"
        :data-status="stateOf(item.id).status"
        :class="{
          'is-wide': isWide(item.id),
          'is-mid': isWide(item.id) && done,
          'is-thin': weight(item.id) < 0.5,
          'is-live': isLive(item.id),
          'is-selected': mine && selected === item.id,
          'is-siding': sideMapId === item.id,
          'is-echo': echo === item.id,
        }"
        :style="{ '--g': weight(item.id) }"
        :tabindex="isLive(item.id) ? 0 : -1"
        :role="isLive(item.id) ? 'button' : undefined"
        :aria-label="sliceTitle(item.id)"
        :title="sliceTitle(item.id)"
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
        </template>
        <template v-else>
          <div class="vb-regionbg" />
          <div
            v-if="item.ping != null"
            class="vb-pingfill"
            :style="{ '--q': pingQ(item.ping) }"
          />
        </template>

        <div class="vb-top">
          <span
            v-if="stateOf(item.id).lineup"
            class="vb-crest"
            style="--s: 20px"
          >
            <img
              v-if="lineups[stateOf(item.id).lineup! - 1].crest"
              :src="lineups[stateOf(item.id).lineup! - 1].crest!"
              alt=""
            />
            <template v-else>{{
              lineups[stateOf(item.id).lineup! - 1].monogram
            }}</template>
          </span>
          <span v-if="badge(item.id)" class="vb-badge">{{
            badge(item.id)
          }}</span>
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
        <div class="vb-open">
          <div class="vb-namerow">
            <img v-if="!isRegion && item.patch" :src="item.patch" alt="" />
            <span class="vb-name">{{ item.label }}</span>
          </div>
          <div v-if="isWide(item.id)" class="vb-act">
            <button
              v-if="wideCopy(item.id).cta"
              type="button"
              class="vb-cta tac-amber-cta"
              :disabled="submitting"
              @click.stop="confirm"
            >
              <Spinner v-if="submitting" class="h-4 w-4" />
              {{ wideCopy(item.id).cta }}
            </button>
            <span v-else class="vb-sub" :data-tone="wideCopy(item.id).tone">{{
              wideCopy(item.id).sub
            }}</span>
          </div>
        </div>

        <!-- side: the picked map opens across the stage and splits CT / T -->
        <div
          v-if="!isRegion && sideMapId === item.id"
          class="vb-split"
          :class="{
            'sel-CT': mine && selected === 'CT',
            'sel-T': mine && selected === 'TERRORIST',
          }"
          @click.stop
        >
          <button
            v-for="side in ['CT', 'TERRORIST']"
            :key="side"
            type="button"
            class="vb-half"
            :data-side="sideShort(side)"
            :class="{ 'is-selected': mine && selected === side }"
            :style="{ backgroundImage: sidePoster }"
            :disabled="!mine || submitting"
            @click="chooseSide(side)"
          >
            <span class="vb-half-in">
              <img :src="sideIcon(side)" alt="" />
              <b>{{ t("match.veto.start_side", { side: sideShort(side) }) }}</b>
              <small>{{
                side === "CT"
                  ? t("match.veto.defend_first")
                  : t("match.veto.attack_first")
              }}</small>
              <span class="vb-cta tac-amber-cta">
                <Spinner
                  v-if="submitting && selected === side"
                  class="h-4 w-4"
                />
                {{ t("match.veto.confirm_side", { side: sideShort(side) }) }}
              </span>
            </span>
          </button>
          <span class="vb-seam">{{ sideSeam }}</span>
        </div>
      </div>
    </div>

    <div v-if="!isRegion" class="vb-series">
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
            }}<template v-if="slot.tag"> · {{ slot.tag }}</template></span
          >
          <span class="m">{{
            slot.item ? slot.item.label : t("match.veto.not_set")
          }}</span>
        </span>
        <img
          v-if="slot.starts"
          class="sd"
          :src="sideIcon(slot.starts === 'CT' ? 'CT' : 'TERRORIST')"
          :alt="slot.starts"
        />
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
  --vb-ease: cubic-bezier(0.16, 1, 0.3, 1);
  container-type: inline-size;
  display: grid;
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
.vb-bar.is-other i {
  background: var(--vb-muted);
}
.vb-bar.is-urgent i {
  background: var(--vb-ban);
}

.vb-crest {
  width: var(--s);
  height: var(--s);
  flex: none;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 6px;
  background: hsl(var(--secondary));
  color: hsl(var(--foreground));
  font-size: calc(var(--s) * 0.4);
  font-weight: 700;
  line-height: 1;
}
.vb-crest img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ---------- order of play ---------- */
.vb-rail {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 4px;
}
.vb-railstep {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  height: 32px;
  padding: 0 9px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  background: var(--vb-surface);
  color: var(--vb-faint);
  overflow: hidden;
  transition:
    color 240ms var(--vb-ease),
    background-color 240ms var(--vb-ease),
    box-shadow 240ms var(--vb-ease);
}
.vb-railstep .what {
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vb-railstep .who {
  flex: none;
  font-size: 11px;
  opacity: 0.8;
}
.vb-railstep .sd {
  width: 14px;
  height: 14px;
  flex: none;
}
.vb-railstep::after {
  content: "";
  position: absolute;
  inset: auto 0 0 0;
  height: 2px;
  background: var(--vb-line-2);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 240ms var(--vb-ease);
}
.vb-railstep[data-type="Ban"]::after {
  background: var(--vb-ban);
}
.vb-railstep[data-type="Pick"]::after {
  background: var(--vb-pick);
}
.vb-railstep[data-type="Side"]::after {
  background: var(--vb-muted);
}
.vb-railstep[data-type="Decider"]::after {
  background: var(--vb-decider);
}
.vb-railstep[data-state="done"] {
  color: hsl(var(--foreground));
  background: var(--vb-surface-2);
}
.vb-railstep[data-state="done"]::after {
  transform: none;
}
.vb-railstep[data-state="done"][data-type="Ban"] .what {
  color: var(--vb-muted);
}
.vb-railstep[data-state="now"] {
  color: hsl(var(--foreground));
  box-shadow: inset 0 0 0 1px var(--vb-muted);
}
.vb-railstep[data-state="now"].is-you {
  box-shadow: inset 0 0 0 1px var(--vb-amber);
}
.vb-railstep[data-state="now"].is-you .what {
  color: var(--vb-amber);
  font-weight: 600;
}

/* ---------- stage ---------- */
.vb-stage {
  display: flex;
  gap: 4px;
  aspect-ratio: 16 / 7;
  max-width: 100%;
  border-radius: 16px;
  overflow: hidden;
}
.vb-stage.is-region {
  aspect-ratio: 16 / 5.5;
}
.vb-slice {
  position: relative;
  flex: var(--g) 1 0;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--vb-surface);
  outline: none;
  transition: flex-grow 460ms var(--vb-ease);
}
.vb-slice:first-child {
  border-radius: 16px 0 0 16px;
}
.vb-slice:last-child {
  border-radius: 0 16px 16px 0;
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
  inset: 0;
  width: 100%;
  height: 100%;
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
.vb-slice.is-wide .vb-top {
  left: 12px;
  right: 12px;
  flex-direction: row;
  justify-content: flex-start;
}
.vb-badge {
  max-width: 100%;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgb(0 0 0 / 0.6);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.vb-slice[data-status="Ban"] .vb-badge {
  color: var(--vb-ban);
}
.vb-slice[data-status="Pick"] .vb-badge {
  color: var(--vb-pick);
}
.vb-slice[data-status="Decider"] .vb-badge {
  color: var(--vb-decider);
}
.vb-slice.is-thin .vb-badge {
  display: none;
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
  transition: opacity 200ms var(--vb-ease);
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
.vb-vname {
  font-size: 15px;
  font-weight: 700;
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
  transition: opacity 160ms var(--vb-ease);
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
  font-size: 34px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
}
.vb-act {
  height: 36px;
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
.vb-cta {
  height: 36px;
  padding: 0 16px;
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 8px;
  border-width: 1px;
  border-radius: calc(var(--radius) - 2px);
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}
.vb-slice.is-wide .vb-open {
  opacity: 1;
  pointer-events: auto;
  transition-delay: 140ms;
}
.vb-slice.is-wide .vb-v {
  opacity: 0;
}
.vb-slice.is-mid .vb-name {
  font-size: 24px;
}
.vb-slice.is-mid .vb-namerow {
  height: 36px;
}
.vb-slice.is-mid .vb-namerow img {
  width: 30px;
  height: 30px;
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
.vb-slice[data-status="Ban"]::after {
  box-shadow:
    inset 0 -3px 0 var(--vb-ban),
    inset 0 0 0 1px hsl(0 0% 100% / 0.04);
}
.vb-slice[data-status="Pick"]::after {
  box-shadow:
    inset 0 -3px 0 var(--vb-pick),
    inset 0 0 0 1px hsl(0 0% 100% / 0.06);
}
.vb-slice[data-status="Decider"]::after {
  box-shadow:
    inset 0 -3px 0 var(--vb-decider),
    inset 0 0 0 1px hsl(0 0% 100% / 0.06);
}
.vb-slice.is-live {
  cursor: pointer;
}
.vb-slice.is-live.is-wide .vb-poster {
  transform: scale(1.03);
}
.vb-slice.is-selected::after,
.vb-slice:focus-visible::after {
  box-shadow: inset 0 0 0 2px var(--vb-amber);
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
.vb-half-in {
  position: absolute;
  top: 50%;
  translate: 0 -50%;
  width: 36%;
  display: grid;
  justify-items: center;
  gap: 4px;
  text-align: center;
}
.vb-half[data-side="CT"] .vb-half-in {
  left: 4%;
}
.vb-half[data-side="T"] .vb-half-in {
  right: 4%;
}
.vb-half-in img {
  width: 56px;
  height: 56px;
  filter: drop-shadow(0 6px 14px rgb(0 0 0 / 0.5));
}
.vb-half-in b {
  font-size: 20px;
  font-weight: 800;
}
.vb-half-in small {
  font-size: 13px;
  color: hsl(0 0% 100% / 0.75);
}
.vb-half-in .vb-cta {
  margin-top: 6px;
  height: 34px;
  padding: 0 14px;
  visibility: hidden;
}
.vb-half.is-selected .vb-half-in .vb-cta {
  visibility: visible;
}
.vb-seam {
  position: absolute;
  left: 50%;
  bottom: 18px;
  translate: -50% 0;
  max-width: 80%;
  padding: 4px 12px;
  border-radius: 999px;
  background: hsl(240 10% 4% / 0.82);
  box-shadow: 0 0 0 1px hsl(0 0% 100% / 0.12);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
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
  font-size: 11px;
}
.vb-chip .m {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
  color: var(--vb-muted);
}
.vb-chip .sd {
  width: 18px;
  height: 18px;
  flex: none;
  margin-left: auto;
}
.vb-chip.is-set {
  background: var(--vb-surface);
  box-shadow: inset 0 0 0 1px var(--vb-line-2);
}
.vb-chip.is-set .m {
  font-weight: 700;
  color: hsl(var(--foreground));
}

/* ---------- phones: the stage turns on its side ---------- */
@container (max-width: 560px) {
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
  .vb-rail {
    gap: 3px;
  }
  .vb-railstep {
    height: 6px;
    padding: 0;
    border-radius: 3px;
  }
  .vb-railstep > * {
    display: none;
  }
  .vb-railstep::after {
    height: 100%;
  }
  .vb-railstep[data-state="now"] {
    box-shadow: none;
    background: var(--vb-muted);
  }
  .vb-railstep[data-state="now"].is-you {
    background: var(--vb-amber);
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
    border-radius: 14px 14px 0 0;
  }
  .vb-slice:last-child {
    border-radius: 0 0 14px 14px;
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
    font-size: 13px;
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
    font-size: 26px;
  }
  .vb-namerow {
    height: 38px;
  }
  .vb-namerow img {
    width: 32px;
    height: 32px;
  }
  .vb-slice.is-mid .vb-name {
    font-size: 18px;
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
  .vb-half-in img {
    width: 36px;
    height: 36px;
  }
  .vb-half-in b {
    font-size: 15px;
  }
  .vb-half-in small {
    display: none;
  }
  .vb-half-in .vb-cta {
    height: 30px;
    padding: 0 10px;
    font-size: 12px;
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
}

@media (prefers-reduced-motion: reduce) {
  .vb *,
  .vb *::before,
  .vb *::after {
    transition-duration: 1ms !important;
    animation-duration: 1ms !important;
  }
}
</style>
