<script setup lang="ts">
import {
  absoluteTime,
  durationText,
  relativeTime,
} from "~/utilities/alertTimeFormat";
import { computed, ref, watch, type Component } from "vue";
import { useI18n } from "vue-i18n";
import { Info, TriangleAlert, OctagonAlert, Lock } from "lucide-vue-next";
import { Switch } from "~/components/ui/switch";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { dateLocale } from "~/utilities/dateLocale";
import { useListKeyboard } from "~/composables/useListKeyboard";
import {
  alertLabel,
  alertState,
  groupActivations,
  inWindowOf,
  laneBarsOf,
  sortAlerts,
  startOf,
  ticksOf,
  toMs,
  windowOf,
  type AlertActivation,
  type AlertType,
  type Bars,
  type HistoryBars,
  type Period,
  type RangeKey,
  type Segment,
  type TimelineAlert,
} from "~/utilities/alertTimeline";

// One lane per alert: a label column (severity, title, state line and the
// Showing switch) and its bars. With on/off history every period it was on
// is a segment with its own tooltip, estimated ones hatched; without it, one
// bar from when it went up to when it ends. Either way a showing alert runs
// on past Now to its end time, fading on when it has no end, and the alert
// open in the editor draws that part in amber, with a dashed marker on the
// end time being picked.
const props = defineProps<{
  alerts: TimelineAlert[];
  // null: the api doesn't serve on/off history yet.
  activations: AlertActivation[] | null;
  now: number;
  range: RangeKey;
  includeOlder: boolean;
  editing: { id: string; alert: TimelineAlert; dirty: boolean } | null;
  draft: TimelineAlert | null;
}>();

const emit = defineEmits<{
  (e: "open", id: string): void;
  (e: "toggle", id: string): void;
  (e: "widen"): void;
}>();

const { t } = useI18n();

const severity: Record<
  AlertType,
  { icon: Component; color: string; bar: string }
> = {
  info: { icon: Info, color: "text-info", bar: "var(--info)" },
  warning: {
    icon: TriangleAlert,
    color: "text-warning",
    bar: "var(--warning)",
  },
  critical: {
    icon: OctagonAlert,
    color: "text-destructive",
    bar: "var(--destructive)",
  },
};

const win = computed(() => windowOf(props.range, props.now));
const pct = (t: number) => {
  const [t0, t1] = win.value;
  return `${(((t - t0) / (t1 - t0)) * 100).toFixed(2)}%`;
};

const tickFormat = computed(() => {
  if (props.range === "day") {
    return new Intl.DateTimeFormat(dateLocale(), {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return new Intl.DateTimeFormat(
    dateLocale(),
    props.range === "week"
      ? { weekday: "short", day: "numeric" }
      : { day: "numeric", month: "short" },
  );
});

const ticks = computed(() =>
  ticksOf(props.range, win.value[0], win.value[1], props.now).map((t) => ({
    t,
    left: pct(t),
    label: tickFormat.value.format(new Date(t)),
  })),
);

// Rows are sorted when the list itself changes (an alert added or removed,
// another range), not when one is switched: a row never slides out from
// under the switch you just flipped.
const order = ref<string[]>([]);
watch(
  () => [
    props.alerts.map((a) => a.id).join(","),
    props.range,
    props.includeOlder,
  ],
  () => {
    order.value = sortAlerts(props.alerts, props.now).map((a) => a.id);
  },
  { immediate: true },
);
// A saved edit can move a row too: settle the order once the editor closes.
watch(
  () => !!props.editing,
  (open, was) => {
    if (was && !open) {
      order.value = sortAlerts(props.alerts, props.now).map((a) => a.id);
    }
  },
);

const rowsById = computed(() =>
  props.activations ? groupActivations(props.activations) : null,
);
const rowsOf = (id: string) =>
  rowsById.value ? (rowsById.value.get(id) ?? []) : null;

const visible = computed(() => {
  const byId = new Map(props.alerts.map((a) => [a.id, a]));
  const sorted = order.value
    .map((id) => byId.get(id))
    .filter((a): a is TimelineAlert => !!a);
  return props.includeOlder
    ? sorted
    : sorted.filter((a) => inWindowOf(a, rowsOf(a.id), win.value, props.now));
});
const hasOlder = computed(() => visible.value.length < props.alerts.length);

type Lane = {
  id: string;
  alert: TimelineAlert;
  isDraft: boolean;
  isEditing: boolean;
  title: string;
  sub: string;
  showing: boolean;
  tip: string;
  // One of the two: the created/updated estimate, or on/off history.
  bars: Bars | null;
  history: HistoryBars | null;
};

function rel(ms: number) {
  return relativeTime(ms, props.now);
}
function abs(ms: number) {
  return absoluteTime(ms);
}

function subFor(view: TimelineAlert, dirty: boolean): string {
  if (dirty) return t("pages.system_alerts.lane.unsaved");
  const state = alertState(view, props.now);
  const exp = toMs(view.expires_at);
  if (state === "live") {
    return exp
      ? t("pages.system_alerts.lane.showing_ends", { time: rel(exp) })
      : t("pages.system_alerts.lane.showing_no_end");
  }
  if (state === "expired") {
    return t("pages.system_alerts.lane.expired", { time: rel(exp!) });
  }
  const created = toMs(view.created_at) ?? props.now;
  const off = toMs(view.updated_at);
  return off !== null && off - created > 60_000
    ? t("pages.system_alerts.lane.turned_off", { time: rel(off) })
    : t("pages.system_alerts.lane.off_created", { time: rel(created) });
}

function tipFor(view: TimelineAlert): string {
  const state = alertState(view, props.now);
  const start = startOf(view);
  const exp = toMs(view.expires_at);
  if (state === "live") {
    return [
      t("pages.system_alerts.tip.up_since", { time: abs(start) }),
      exp
        ? t("pages.system_alerts.tip.ends", { time: abs(exp) })
        : t("pages.system_alerts.tip.until_off"),
    ].join(" · ");
  }
  if (state === "expired") {
    return [
      t("pages.system_alerts.tip.up_since", { time: abs(start) }),
      t("pages.system_alerts.tip.ended", { time: abs(exp!) }),
    ].join(" · ");
  }
  const created = toMs(view.created_at) ?? props.now;
  const off = toMs(view.updated_at);
  return [
    t("pages.system_alerts.tip.created", { time: abs(created) }),
    off !== null && off - created > 60_000
      ? t("pages.system_alerts.tip.turned_off", { time: abs(off) })
      : t("pages.system_alerts.tip.off_now"),
  ].join(" · ");
}

function drawn(lane: ReturnType<typeof laneBarsOf>) {
  return lane.kind === "history"
    ? { bars: null, history: lane.bars }
    : { bars: lane.bars, history: null };
}

const lanes = computed<Lane[]>(() => {
  const out: Lane[] = [];
  if (props.draft) {
    const d = props.draft;
    out.push({
      id: d.id,
      alert: d,
      isDraft: true,
      isEditing: true,
      title: alertLabel(d) || t("pages.system_alerts.new_alert"),
      sub: t("pages.system_alerts.lane.draft"),
      showing: false,
      tip: t("pages.system_alerts.tip.draft"),
      ...drawn(laneBarsOf(d, null, win.value, props.now, { draft: true })),
    });
  }
  for (const a of visible.value) {
    const editing = props.editing?.id === a.id;
    const view = editing ? props.editing!.alert : a;
    out.push({
      id: a.id,
      alert: view,
      isDraft: false,
      isEditing: editing,
      title: alertLabel(view) || t("common.untitled"),
      sub: subFor(view, editing && props.editing!.dirty),
      // The switch follows the saved row, not the form.
      showing: alertState(a, props.now) === "live",
      tip: tipFor(view),
      ...drawn(
        laneBarsOf(view, rowsOf(a.id), win.value, props.now, { editing }),
      ),
    });
  }
  return out;
});

function segStyle(seg: { x: number; w: number }, type: AlertType) {
  return {
    "--c": `hsl(${severity[type].bar})`,
    transform: `translateX(${(seg.x * 100).toFixed(3)}%) scaleX(${seg.w.toFixed(4)})`,
  };
}

// The hatch tile is divided by the bar's own scaleX so its stripes keep
// their size at any length.
function periodStyle(seg: Segment, type: AlertType) {
  return { ...segStyle(seg, type), "--w": Math.max(seg.w, 0.001).toFixed(4) };
}

// Start, end (or Showing now), how long, and who turned it on and off.
function periodLines(period: Period, view: TimelineAlert): string[] {
  const start = abs(period.start);
  const end = abs(period.end);
  const on = period.startedBy?.name
    ? t("pages.system_alerts.period.on_by", {
        time: start,
        name: period.startedBy.name,
      })
    : t("pages.system_alerts.period.on", { time: start });
  let off: string;
  if (!period.open || alertState(view, props.now) === "off") {
    off = period.endedBy?.name
      ? t("pages.system_alerts.period.off_by", {
          time: end,
          name: period.endedBy.name,
        })
      : t("pages.system_alerts.period.off", { time: end });
  } else if (period.expired) {
    off = t("pages.system_alerts.lane.expired", { time: end });
  } else {
    off = t("pages.system_alerts.period.showing_now");
  }
  return [
    on,
    off,
    t("pages.system_alerts.period.duration", {
      duration: durationText(period.end - period.start),
    }),
  ];
}

function capStyle(end: { x: number; open: boolean }) {
  return {
    transform: end.open
      ? "translateX(calc(100% - 8px))"
      : `translateX(${(end.x * 100).toFixed(3)}%)`,
  };
}

function endLabel(view: TimelineAlert) {
  const exp = toMs(view.expires_at);
  return exp
    ? t("pages.system_alerts.ends_at", { time: abs(exp) })
    : t("pages.system_alerts.no_end");
}

// ↑/↓ walk the lanes, Enter opens one in the editor.
const activeLane = ref<string | null>(null);
const laneKeys = useListKeyboard({
  items: () => lanes.value.filter((lane) => !lane.isDraft),
  getId: (lane) => lane.id,
  activeId: activeLane,
  onOpen: (id) => emit("open", id),
});

function laneProps(lane: Lane) {
  if (lane.isDraft) {
    return {};
  }
  // A lane is a button: it says which alert is open with aria-current.
  const { "aria-selected": _selected, ...rest } = laneKeys.rowProps(lane.id);
  return rest;
}

function onLaneKey(event: KeyboardEvent, lane: Lane) {
  if (event.target !== event.currentTarget || lane.isDraft) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    emit("open", lane.id);
  }
}
</script>

<template>
  <div class="tl-wrap scrollbar-thin">
    <div class="tl">
      <div class="tl-ticks" aria-hidden="true">
        <i v-for="tick in ticks" :key="tick.t" :style="{ left: tick.left }" />
        <i class="now" :style="{ left: pct(now) }" />
      </div>

      <div class="tl-row tl-head">
        <div class="tl-lab">{{ $t("pages.system_alerts.alert") }}</div>
        <div class="tl-track" aria-hidden="true">
          <span
            v-for="tick in ticks"
            :key="tick.t"
            class="tl-tl"
            :style="{ left: tick.left }"
            >{{ tick.label }}</span
          >
          <span class="tl-tl now" :style="{ left: pct(now) }">{{
            $t("pages.system_alerts.now")
          }}</span>
        </div>
      </div>

      <TransitionGroup name="tl-lane" tag="div">
        <div
          v-for="lane in lanes"
          :key="lane.id"
          class="tl-row tl-lane"
          :class="{
            off: !lane.isDraft && alertState(lane.alert, now) !== 'live',
            draft: lane.isDraft,
          }"
          v-bind="laneProps(lane)"
          :aria-current="lane.isEditing ? 'true' : undefined"
          :role="lane.isDraft ? undefined : 'button'"
          @click="!lane.isDraft && emit('open', lane.id)"
          @keydown="onLaneKey($event, lane)"
        >
          <div class="tl-lab">
            <component
              :is="severity[lane.alert.type].icon"
              class="size-4 shrink-0"
              :class="severity[lane.alert.type].color"
            />
            <div class="grid min-w-0 flex-1 gap-px">
              <span class="tl-title flex min-w-0 items-center gap-1.5">
                <span class="truncate">{{ lane.title }}</span>
                <FiveStackToolTip
                  v-if="!lane.alert.dismissible"
                  as-child
                  :delay-duration="200"
                >
                  <template #trigger>
                    <span class="inline-flex shrink-0 text-muted-foreground">
                      <Lock
                        class="size-3"
                        :aria-label="$t('pages.system_alerts.locked')"
                      />
                    </span>
                  </template>
                  {{ $t("pages.system_alerts.locked") }}
                </FiveStackToolTip>
              </span>
              <span class="tl-sub truncate">{{ lane.sub }}</span>
            </div>
            <span v-if="!lane.isDraft" class="inline-flex shrink-0" @click.stop>
              <FiveStackToolTip
                as-child
                :delay-duration="300"
                :tap-toggle="false"
              >
                <template #trigger>
                  <span class="inline-flex">
                    <Switch
                      @click.stop
                      :model-value="lane.showing"
                      :aria-label="
                        $t('pages.system_alerts.showing_named', {
                          name: lane.title,
                        })
                      "
                      @update:model-value="emit('toggle', lane.id)"
                      @keydown.stop
                    />
                  </span>
                </template>
                {{
                  lane.showing
                    ? $t("pages.system_alerts.turn_off")
                    : $t("pages.system_alerts.show_now")
                }}
              </FiveStackToolTip>
            </span>
          </div>

          <FiveStackToolTip
            v-if="lane.bars"
            as-child
            :delay-duration="250"
            :tap-toggle="false"
          >
            <template #trigger>
              <div class="tl-track">
                <div class="tl-layer">
                  <i
                    v-for="(seg, i) in lane.bars.segments"
                    :key="i"
                    class="tl-bar"
                    :class="[seg.tone, { nil: seg.w === 0, open: seg.open }]"
                    :style="segStyle(seg, lane.alert.type)"
                  />
                </div>
                <div
                  v-if="lane.bars.end"
                  class="tl-cap"
                  :style="capStyle(lane.bars.end)"
                >
                  <i class="tl-capl" />
                  <span
                    class="tl-capt"
                    :class="{ l: lane.bars.end.open || lane.bars.end.x > 0.72 }"
                    >{{ endLabel(lane.alert) }}</span
                  >
                </div>
              </div>
            </template>
            {{ lane.tip }}
          </FiveStackToolTip>

          <div v-else-if="lane.history" class="tl-track tl-hist">
            <div class="tl-layer">
              <FiveStackToolTip
                v-for="seg in lane.history.periods"
                :key="seg.key"
                as-child
                :delay-duration="120"
              >
                <template #trigger>
                  <i
                    class="tl-bar"
                    :class="[
                      seg.tone,
                      { est: seg.period.estimated, nil: seg.w === 0 },
                    ]"
                    :style="periodStyle(seg, lane.alert.type)"
                  />
                </template>
                <span class="grid gap-0.5 tabular-nums">
                  <span
                    v-if="seg.period.estimated"
                    class="text-muted-foreground"
                    >{{ $t("pages.system_alerts.period.estimated") }}</span
                  >
                  <span
                    v-for="(line, i) in periodLines(seg.period, lane.alert)"
                    :key="i"
                    >{{ line }}</span
                  >
                </span>
              </FiveStackToolTip>
              <FiveStackToolTip
                as-child
                :delay-duration="120"
                :disabled="lane.history.ahead.w === 0"
              >
                <template #trigger>
                  <i
                    class="tl-bar"
                    :class="[
                      lane.history.ahead.tone,
                      {
                        nil: lane.history.ahead.w === 0,
                        open: lane.history.ahead.open,
                      },
                    ]"
                    :style="segStyle(lane.history.ahead, lane.alert.type)"
                  />
                </template>
                <span class="tabular-nums">{{ endLabel(lane.alert) }}</span>
              </FiveStackToolTip>
            </div>
            <div
              v-if="lane.history.end"
              class="tl-cap"
              :style="capStyle(lane.history.end)"
            >
              <i class="tl-capl" />
              <span
                class="tl-capt"
                :class="{
                  l: lane.history.end.open || lane.history.end.x > 0.72,
                }"
                >{{ endLabel(lane.alert) }}</span
              >
            </div>
            <i class="tl-now" :style="{ left: pct(now) }" aria-hidden="true" />
          </div>
        </div>
      </TransitionGroup>

      <div v-if="hasOlder" class="tl-more">
        <span>{{ $t("pages.system_alerts.older") }}</span>
        <button
          v-if="range !== 'quarter' || !includeOlder"
          type="button"
          class="text-[hsl(var(--tac-amber))] underline-offset-2 transition-colors hover:underline"
          @click="emit('widen')"
        >
          {{
            range !== "quarter"
              ? $t("pages.system_alerts.show_quarter")
              : $t("pages.system_alerts.show_older")
          }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tl-wrap {
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  background: hsl(var(--card));
  overflow: hidden;
}
@media (max-width: 1100px) {
  .tl-wrap {
    overflow-x: auto;
  }
}
.tl {
  position: relative;
  min-width: 680px;
}
.tl-row {
  display: grid;
  grid-template-columns: 232px minmax(0, 1fr);
  min-height: 46px;
  border-bottom: 1px solid hsl(var(--border) / 0.6);
}
.tl-row:last-child {
  border-bottom: 0;
}
.tl-head {
  min-height: 34px;
  border-bottom-color: hsl(var(--border));
}
.tl-lab {
  position: sticky;
  left: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 6px 12px;
  background: hsl(var(--card));
  border-right: 1px solid hsl(var(--border) / 0.6);
  transition: background-color 120ms ease;
}
.tl-head .tl-lab {
  font-size: 11.5px;
  color: hsl(var(--muted-foreground));
}
.tl-title {
  font-size: 13px;
  font-weight: 600;
}
.tl-sub {
  font-size: 11.5px;
  color: hsl(var(--muted-foreground));
}
.tl-lane {
  position: relative;
  cursor: pointer;
  outline: none;
  transition: background-color 120ms ease;
}
.tl-lane:focus-visible {
  box-shadow: inset 0 0 0 1px hsl(var(--ring));
}
.tl-lane:hover,
.tl-lane[data-active="true"],
.tl-lane[aria-current="true"] {
  background-color: hsl(var(--muted) / 0.35);
}
/* The sticky label stays opaque so the bars never show through it. */
.tl-lane:hover .tl-lab,
.tl-lane[data-active="true"] .tl-lab,
.tl-lane[aria-current="true"] .tl-lab {
  background:
    linear-gradient(hsl(var(--muted) / 0.35), hsl(var(--muted) / 0.35)),
    hsl(var(--card));
}
.tl-lane[aria-current="true"] .tl-lab::before {
  content: "";
  position: absolute;
  left: 0;
  top: 9px;
  bottom: 9px;
  width: 2px;
  border-radius: 2px;
  background: hsl(var(--tac-amber));
}
.tl-lane.off .tl-title {
  color: hsl(var(--muted-foreground));
  font-weight: 500;
}
.tl-lane.draft {
  cursor: default;
}
.tl-lane.draft .tl-title,
.tl-lane.draft .tl-sub {
  color: hsl(var(--tac-amber));
}
.tl-track {
  position: relative;
  min-width: 0;
}
.tl-layer {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.tl-ticks {
  position: absolute;
  inset: 0 0 0 232px;
  pointer-events: none;
  z-index: 1;
}
.tl-ticks i {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: hsl(var(--border) / 0.6);
}
.tl-ticks i.now {
  background: hsl(var(--tac-amber) / 0.85);
}
.tl-tl {
  position: absolute;
  top: 50%;
  translate: -50% -50%;
  font-size: 11px;
  white-space: nowrap;
  color: hsl(var(--muted-foreground) / 0.75);
  font-variant-numeric: tabular-nums;
}
.tl-tl.now {
  color: hsl(var(--tac-amber));
  font-weight: 600;
}
.tl-bar {
  position: absolute;
  left: 0;
  top: 50%;
  width: 100%;
  height: 14px;
  margin-top: -7px;
  border-radius: 3px;
  transform-origin: 0 50%;
  background: color-mix(in hsl, var(--c) 62%, transparent);
  transition:
    transform 240ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 150ms ease;
  z-index: 1;
}
.tl-bar.future {
  background: color-mix(in hsl, var(--c) 24%, transparent);
}
.tl-bar.gone {
  background: color-mix(in hsl, var(--c) 28%, transparent);
}
.tl-bar.off {
  background: hsl(var(--muted-foreground) / 0.3);
}
.tl-bar.ghost {
  background: hsl(var(--tac-amber) / 0.24);
  box-shadow:
    inset 0 1px 0 hsl(var(--tac-amber) / 0.5),
    inset 0 -1px 0 hsl(var(--tac-amber) / 0.5);
}
.tl-bar.open {
  -webkit-mask-image: linear-gradient(90deg, #000 80%, transparent);
  mask-image: linear-gradient(90deg, #000 80%, transparent);
}
.tl-bar.nil {
  opacity: 0;
}
/* Periods are hoverable: a taller hit area than the 14px bar. */
.tl-hist .tl-bar::before {
  content: "";
  position: absolute;
  inset: -8px 0;
}
/* Estimated periods (backfilled from before on/off history was kept) are
   hatched over a fainter fill. */
.tl-bar.est {
  --hatch: color-mix(in hsl, var(--c) 50%, transparent);
  background-color: color-mix(in hsl, var(--c) 10%, transparent);
  background-image: linear-gradient(
    to top right,
    var(--hatch) 25%,
    transparent 25% 50%,
    var(--hatch) 50% 75%,
    transparent 75%
  );
  background-size: calc(6px / var(--w)) 6px;
}
.tl-bar.est.off {
  --hatch: hsl(var(--muted-foreground) / 0.4);
  background-color: hsl(var(--muted-foreground) / 0.08);
}
/* Phones hide the shared Now line with the axis; each slim track marks its
   own. */
.tl-now {
  display: none;
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: hsl(var(--tac-amber) / 0.85);
  pointer-events: none;
  z-index: 2;
}
.tl-cap {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
  transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.tl-capl {
  position: absolute;
  left: -1px;
  top: 50%;
  margin-top: -12px;
  width: 2px;
  height: 24px;
  background: repeating-linear-gradient(
    180deg,
    hsl(var(--tac-amber)) 0 3px,
    transparent 3px 6px
  );
}
.tl-capt {
  position: absolute;
  left: 10px;
  top: 2px;
  font-size: 10.5px;
  white-space: nowrap;
  color: hsl(var(--tac-amber));
  font-variant-numeric: tabular-nums;
}
.tl-capt.l {
  left: auto;
  right: calc(100% + 10px);
}
.tl-more {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  border-top: 1px solid hsl(var(--border) / 0.6);
}
.tl-lane-enter-active {
  transition:
    opacity 240ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.tl-lane-leave-active {
  transition: opacity 110ms ease-in;
}
.tl-lane-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.tl-lane-leave-to {
  opacity: 0;
}
.tl-lane-move {
  transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
/* Phones: no room for a readable axis, so the lanes read as a list. */
@media (max-width: 639px) {
  .tl {
    min-width: 0;
  }
  .tl-row {
    grid-template-columns: minmax(0, 1fr);
  }
  .tl-track,
  .tl-ticks {
    display: none;
  }
  .tl-lab {
    border-right: 0;
  }
  /* With on/off history a lane keeps a slim track under its label, Now
     marked on it. */
  .tl-track.tl-hist {
    display: block;
    height: 16px;
    margin: -2px 12px 8px;
  }
  .tl-hist .tl-bar {
    height: 8px;
    margin-top: -4px;
  }
  .tl-hist .tl-now {
    display: block;
  }
  .tl-hist .tl-cap {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .tl-bar,
  .tl-cap,
  .tl-lane-enter-active,
  .tl-lane-leave-active,
  .tl-lane-move {
    transition: none;
  }
}
</style>
