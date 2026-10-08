<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import HeightSwap from "~/components/ui/transitions/HeightSwap.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import UtilityPlanProgress from "~/components/utility/UtilityPlanProgress.vue";
import UtilityPlanStreak from "~/components/utility/UtilityPlanStreak.vue";
import UtilityRadarThumb from "~/components/utility/UtilityRadarThumb.vue";
import UtilityRow from "~/components/utility/UtilityRow.vue";
import UtilitySkeletonList from "~/components/utility/UtilitySkeletonList.vue";
import UtilityTypeSections from "~/components/utility/UtilityTypeSections.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { useDeferredLoading } from "~/composables/useDeferredLoading";
import { useRouteTab } from "~/composables/useRouteTab";
import { useUtilityMaps } from "~/composables/useUtilityMaps";
import {
  utilityLineupsQuery,
  utilityPracticePlanQuery,
} from "~/graphql/utilityGraphql";
import { order_by } from "~/generated/zeus";
import cleanMapName from "~/utilities/cleanMapName";
import {
  UTILITY_MASTERY_STREAK,
  UTILITY_TYPE_COLORS,
  humanizeUtilityToken,
  utilityLanding,
  utilityOrigin,
  utilityPlanReasonKey,
  utilityPlanReasonTone,
} from "~/utilities/utilityDisplay";
import type {
  UtilityLineupContext,
  UtilityPanelBoard,
} from "~/utilities/utilityDisplay";
import { readUtilityPracticePlan } from "~/types/utility";
import type {
  UtilityLineup,
  UtilityLineupProgress,
  UtilityPlanOrder,
  UtilityPracticePlanEntryView,
  UtilityPracticePlanOutput,
  UtilityPracticePlanView,
  UtilityTrajectoryPoint,
  UtilityType,
} from "~/types/utility";

const props = defineProps<{
  mapName: string;
  // The page's one type filter. Its strip sits above this panel, fed by the
  // counts emitted below, and the section headings here are the same switch.
  types: UtilityType[];
  // The lineup the page has open over the card.
  openLineupId: string | null;
  // Your drill record on this map, live. Every throw in a practice server
  // writes to it, so the streaks and the progress line move while you play.
  progress: Map<string, UtilityLineupProgress>;
}>();

type PlanNext = {
  id: string;
  lineup: UtilityLineup;
  context: UtilityLineupContext;
};

const emit = defineEmits<{
  (e: "board", state: UtilityPanelBoard | null): void;
  (e: "toggle-type", type: UtilityType): void;
  (e: "open-lineup", id: string, context?: UtilityLineupContext): void;
  // The queue by type before the type filter, for the strip. Null without one.
  (e: "type-counts", counts: Partial<Record<UtilityType, number>> | null): void;
  // What the practice bar offers to load: the top of the queue on screen.
  (e: "next", payload: PlanNext | null): void;
}>();

const { t } = useI18n();

const ANY_SIDE = "any";
const PLAN_LIMIT = 12;

const PUBLIC_SOURCE = "public";
const PRIVATE_SOURCE = "private";

/**
 * The one order worth fetching. The server's other two sort the same set by
 * difficulty, which is a question nobody opening "what to learn next" is
 * asking -- and on a map with a dozen lineups all three returned the same
 * handful anyway. Priority stays because it decides *which* lineups get
 * ranked at all; how they are ordered on screen is popularity, below.
 */
const PLAN_ORDER: UtilityPlanOrder = "priority";

// Both live in the URL: the plan is a queue you work through over several
// sittings, and coming back to it filtered the way you left it is the whole
// point. `planSide`/`planSource` rather than `side`/`source` -- the page's own
// lineup filters already own those two names.
const side = useRouteTab({
  param: "planSide",
  defaultTab: ANY_SIDE,
  tabs: [ANY_SIDE, "CT", "TERRORIST"],
});
const source = useRouteTab({
  param: "planSource",
  defaultTab: PUBLIC_SOURCE,
  tabs: [PUBLIC_SOURCE, PRIVATE_SOURCE],
});
const plan = ref<UtilityPracticePlanView | null>(null);
const lineupsById = ref<Record<string, UtilityLineup>>({});
const loading = ref(true);
// Told apart from "no plan yet": a request that failed has nothing to say
// about whether there is anything left to learn.
const failed = ref(false);

// Only the first open draws shapes. Flipping the side re-ranks a queue you are
// already reading, so that one keeps the queue and dims it -- a 12-row list
// replaced by four grey boxes and then by a 2-row list is three layouts to
// watch for one click.
const { skeleton, refreshing, reset } = useDeferredLoading(() => loading.value);

const sideOptions = computed(() => [
  { key: ANY_SIDE, label: t("common.any") },
  { key: "TERRORIST", label: t("pages.utility.sides.TERRORIST") },
  { key: "CT", label: t("pages.utility.sides.CT") },
]);

/**
 * Which half of the library a lineup came out of. One the plan ranked but this
 * viewer cannot resolve belongs to neither -- it is not something you can go
 * and learn -- so it is dropped from both counts and both queues, silently.
 */
function sourceOf(lineup: UtilityLineup) {
  return lineup.visibility === "Public" ? PUBLIC_SOURCE : PRIVATE_SOURCE;
}

const resolved = computed(() => {
  const out: Array<{ entry: UtilityPracticePlanEntryView; lineup: UtilityLineup }> =
    [];
  for (const entry of plan.value?.entries ?? []) {
    const lineup = lineupsById.value[entry.lineupId];
    if (lineup) {
      out.push({ entry, lineup });
    }
  }
  return out;
});

const sourceCounts = computed(() => {
  const counts: Record<string, number> = {
    [PUBLIC_SOURCE]: 0,
    [PRIVATE_SOURCE]: 0,
  };
  for (const row of resolved.value) {
    counts[sourceOf(row.lineup)] += 1;
  }
  return counts;
});

const sourceOptions = computed(() => [
  {
    key: PUBLIC_SOURCE,
    label: t("pages.utility.visibility.Public"),
    count: sourceCounts.value[PUBLIC_SOURCE],
  },
  {
    key: PRIVATE_SOURCE,
    label: t("pages.utility.visibility.Private"),
    count: sourceCounts.value[PRIVATE_SOURCE],
  },
]);

type QueueItem = {
  id: string;
  entry: UtilityPracticePlanEntryView;
  lineup: UtilityLineup;
  // Where it stands in the queue, whatever the list is grouped by.
  rank: number;
  color: string;
  origin: UtilityTrajectoryPoint;
  landing: UtilityTrajectoryPoint | null;
  attempts: number;
  successes: number;
  // Null when you have never thrown it.
  streak: number | null;
};

/**
 * Ordered by how many players throw it on this map. The server's priority
 * score decides which lineups are worth ranking; what puts one above another
 * on screen is how many people actually run it, which is the only ordering a
 * reader can check against the map in front of them.
 */
const queue = computed<QueueItem[]>(() =>
  resolved.value
    .filter((row) => sourceOf(row.lineup) === source.value)
    .sort((a, b) => b.entry.metaThrowers - a.entry.metaThrowers)
    .map(({ entry, lineup }, index) => {
      // The live record wins over the one the plan was ranked with: the plan
      // is a snapshot, and you may have thrown since.
      const record = props.progress.get(lineup.id);
      const attempts = Number(record?.attempts ?? entry.attempts ?? 0);
      const successes = Number(record?.successes ?? entry.successes ?? 0);
      return {
        id: lineup.id,
        entry,
        lineup,
        rank: index + 1,
        color: UTILITY_TYPE_COLORS[lineup.utility_type] ?? "#ffffff",
        origin: utilityOrigin(lineup),
        landing: utilityLanding(lineup),
        attempts,
        successes,
        streak: attempts > 0 ? Number(record?.current_streak ?? 0) : null,
      };
    }),
);

// How the type sections read an entry. Named rather than written inline, so
// the list is not handed two new functions on every render.
const typeOf = (item: QueueItem) => item.lineup.utility_type;
const keyOf = (item: QueueItem) => item.id;

// What the type filter leaves standing, still in queue order.
const shown = computed(() =>
  props.types.length
    ? queue.value.filter((item) =>
        props.types.includes(item.lineup.utility_type),
      )
    : queue.value,
);

// The top of what is on screen. With a type picked that is not rank one, and
// offering to load a lineup the list is not showing would be the wrong one.
const nextItem = computed(() => shown.value[0] ?? null);

const typeCounts = computed(() => {
  if (!queue.value.length) {
    return null;
  }
  const tally: Partial<Record<UtilityType, number>> = {};
  for (const item of queue.value) {
    const type = item.lineup.utility_type;
    tally[type] = (tally[type] ?? 0) + 1;
  }
  return tally;
});

watch(typeCounts, (counts) => emit("type-counts", counts), { immediate: true });

function reasonLabel(entry: UtilityPracticePlanEntryView) {
  const key = utilityPlanReasonKey(entry.reason);
  if (key) {
    return t(`pages.utility.plan.reasons.${key}`);
  }
  return humanizeUtilityToken(entry.reason) || t("pages.utility.plan.reasons.other");
}

// Why it is queued, then the record behind it: yours, and everyone's. The
// lineup's panel prints these under the reason when it is opened from here.
function whyLines(item: QueueItem) {
  const lines: string[] = [];
  const streak = item.streak ?? 0;
  switch (utilityPlanReasonKey(item.entry.reason)) {
    case "never_attempted":
      lines.push(t("pages.utility.plan.why.never_attempted"));
      break;
    case "popular_unmastered":
      if (item.entry.metaThrowers > 0) {
        lines.push(
          t(
            "pages.utility.plan.why.popular_unmastered",
            { count: item.entry.metaThrowers },
            item.entry.metaThrowers,
          ),
        );
      }
      break;
    case "unmastered":
      lines.push(
        t("pages.utility.plan.why.unmastered", {
          streak,
          count: UTILITY_MASTERY_STREAK,
        }),
      );
      break;
    case "mastered_slipping":
      lines.push(t("pages.utility.plan.why.mastered_slipping", { streak }));
      break;
  }

  const record: string[] = [];
  if (item.attempts > 0) {
    record.push(
      t("pages.utility.plan.why.record", {
        successes: item.successes,
        attempts: item.attempts,
      }),
    );
  }
  // Null landing rate means the grade is unmeasured, and no rate is printed
  // rather than a zero.
  record.push(
    item.entry.globalLandingRate !== null
      ? t("pages.utility.plan.why.rate", {
          percent: item.entry.globalLandingRate,
        })
      : t("pages.utility.plan.why.no_rate"),
  );
  lines.push(record.join(" "));
  return lines;
}

function contextFor(item: QueueItem): UtilityLineupContext {
  return {
    kicker: t("pages.utility.plan.kicker", {
      rank: item.rank,
      total: queue.value.length,
    }),
    reason: {
      label: reasonLabel(item.entry),
      tone: utilityPlanReasonTone(item.entry.reason),
      lines: whyLines(item),
    },
    skippable: queue.value.length > 1,
  };
}

function open(item: QueueItem) {
  emit("open-lineup", item.id, contextFor(item));
}

watch(
  nextItem,
  (item) =>
    emit(
      "next",
      item ? { id: item.id, lineup: item.lineup, context: contextFor(item) } : null,
    ),
  { immediate: true },
);

/**
 * The entry after this one, for the lineup panel's Skip. It walks what is on
 * screen and wraps, so skipping the last one comes back round to the first.
 */
function after(id: string) {
  const list = shown.value.some((item) => item.id === id)
    ? shown.value
    : queue.value;
  if (list.length < 2) {
    return null;
  }
  const next = list[(list.findIndex((item) => item.id === id) + 1) % list.length];
  if (!next || next.id === id) {
    return null;
  }
  return { id: next.id, context: contextFor(next) };
}

defineExpose({ after });

// The board draws the queue and nothing else. At rest the next lineup has its
// line drawn, so the map answers "what is next" without a hover.
const hoveredId = ref<string | null>(null);

watch(
  [shown, () => props.openLineupId, hoveredId, nextItem],
  () => {
    emit("board", {
      lineups: shown.value.map((item) => item.lineup),
      selectedId: props.openLineupId,
      hoveredId:
        hoveredId.value ??
        (props.openLineupId ? null : (nextItem.value?.id ?? null)),
      onSelect: (id: string | null) => {
        const item = id ? queue.value.find((entry) => entry.id === id) : null;
        if (item) {
          open(item);
        }
      },
      onHover: (id: string | null) => {
        hoveredId.value = id;
      },
    });
  },
  { immediate: true },
);

// The strip and the bar's offer belong to this tab alone, so they are handed
// back on the way out. The board is not: the panel leaves through a crossfade,
// so its unmount lands after the next tab has published a board of its own.
onBeforeUnmount(() => {
  emit("type-counts", null);
  emit("next", null);
});

// How far along you are on this map, counted off the live record.
const tally = computed(() => {
  let mastered = 0;
  let going = 0;
  for (const row of props.progress.values()) {
    if (row.mastered_at) {
      mastered += 1;
    } else if (Number(row.attempts ?? 0) > 0) {
      going += 1;
    }
  }
  return { mastered, going };
});

const { counts, privateCounts, loadCounts } = useUtilityMaps();

watch(
  () => props.mapName,
  (name) => {
    if (!(name in counts.value)) {
      void loadCounts();
    }
  },
  { immediate: true },
);

// Every lineup you can see here. Never less than what you have thrown: a
// lineup archived since still has your record against it, and a bar that
// overran its own total would be a bar that is wrong.
const total = computed(() => {
  if (!(props.mapName in counts.value)) {
    return null;
  }
  return Math.max(
    (counts.value[props.mapName] ?? 0) + (privateCounts.value[props.mapName] ?? 0),
    tally.value.mastered + tally.value.going,
  );
});

let loadGen = 0;

async function load() {
  const gen = ++loadGen;
  loading.value = true;
  try {
    const client = getGraphqlClient();
    const { data } = await client.query({
      query: utilityPracticePlanQuery,
      variables: {
        map_name: props.mapName,
        side: side.value === ANY_SIDE ? null : side.value,
        limit: PLAN_LIMIT,
        order: PLAN_ORDER,
      },
      fetchPolicy: "no-cache",
    });
    if (gen !== loadGen) {
      return;
    }
    const view = readUtilityPracticePlan(
      (data as any)?.utilityPracticePlan as UtilityPracticePlanOutput | undefined,
    );
    const byId: Record<string, UtilityLineup> = {};
    const ids = [...new Set(view.entries.map((entry) => entry.lineupId))];
    if (ids.length) {
      const { data: lineupRows } = await client.query({
        query: utilityLineupsQuery(),
        variables: {
          where: { id: { _in: ids } },
          order_by: [{ created_at: order_by.desc }],
          limit: ids.length,
          offset: 0,
        },
        fetchPolicy: "network-only",
      });
      if (gen !== loadGen) {
        return;
      }
      for (const lineup of ((lineupRows as any)?.utility_lineups ??
        []) as UtilityLineup[]) {
        byId[lineup.id] = lineup;
      }
    }
    // Swapped in together: the plan landing a round trip before its lineups
    // is a queue that empties out and fills back in.
    plan.value = view;
    lineupsById.value = byId;
    failed.value = false;
  } catch (error) {
    if (gen === loadGen) {
      console.error("[utility] practice plan load error:", error);
      plan.value = null;
      lineupsById.value = {};
      failed.value = true;
    }
  } finally {
    if (gen === loadGen) {
      loading.value = false;
    }
  }
}

// None of the last map's queue belongs to this one, so it goes back to shapes
// rather than dimming rows that are about to be replaced wholesale.
watch(
  () => props.mapName,
  () => {
    plan.value = null;
    lineupsById.value = {};
    failed.value = false;
    hoveredId.value = null;
    reset();
  },
);

watch(() => [props.mapName, side.value], () => void load(), {
  immediate: true,
});

// One sentence for an empty queue, and it names the control to blame: the
// other library has something, this side has nothing, or the map does not.
const emptyLine = computed(() => {
  const other =
    source.value === PUBLIC_SOURCE ? PRIVATE_SOURCE : PUBLIC_SOURCE;
  if (sourceCounts.value[other] > 0) {
    return t(`pages.utility.plan.empty_${source.value}`);
  }
  if (side.value !== ANY_SIDE) {
    return t("pages.utility.plan.empty_side", {
      side: t(`pages.utility.sides.${side.value}`),
    });
  }
  return t("pages.utility.plan.empty_map", {
    map: cleanMapName(props.mapName),
  });
});

function onRowHover(id: string, on: boolean) {
  if (on) {
    hoveredId.value = id;
  } else if (hoveredId.value === id) {
    hoveredId.value = null;
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <UtilityPlanProgress
      :map-name="mapName"
      :mastered="tally.mastered"
      :going="tally.going"
      :total="total"
    />

    <!-- Which library you are learning out of, and which side: two short
         switches, so they share a row instead of taking two before the first
         entry. -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <AnimatedFilters v-model="source" :options="sourceOptions" square />
      <AnimatedFilters v-model="side" :options="sideOptions" square />
    </div>

    <!-- One shell for every answer this panel can give, measured so that a
         twelve-row queue turning into a one-line notice eases instead of
         snapping the column shut. Every answer that is not a queue is one
         quiet sentence: no box, no icon. -->
    <HeightSwap>
      <UtilitySkeletonList
        v-if="skeleton"
        key="loading"
        :count="3"
        shape="row"
      />

      <p
        v-else-if="failed"
        key="failed"
        class="px-0.5 text-xs leading-relaxed text-muted-foreground"
      >
        {{ $t("pages.utility.plan.failed_line") }}
      </p>

      <!-- Never a zero and never an empty list: an unanalysed plan is the
           server saying it could not rank anything, which is a different
           sentence from "you have nothing left to learn". -->
      <p
        v-else-if="plan && !plan.analysed"
        key="not-analysed"
        class="whitespace-pre-wrap break-words px-0.5 text-xs leading-relaxed text-muted-foreground"
      >
        {{ plan.message || $t("pages.utility.plan.not_analysed_line") }}
      </p>

      <p
        v-else-if="!queue.length"
        key="empty"
        class="px-0.5 text-xs leading-relaxed text-muted-foreground"
      >
        {{ emptyLine }}
      </p>

      <p
        v-else-if="!shown.length"
        key="filtered"
        class="px-0.5 text-xs leading-relaxed text-muted-foreground"
      >
        {{ $t("pages.utility.plan.empty_type") }}
      </p>

      <!-- Plain rows in the library's own type sections. The rank stays on
           the row, because grouping by type takes the queue's order off the
           page. -->
      <div
        v-else
        key="queue"
        class="-mt-2 transition-opacity [transition-duration:180ms]"
        :class="refreshing ? 'pointer-events-none opacity-50' : ''"
      >
        <UtilityTypeSections
          :items="queue"
          :type-of="typeOf"
          :key-of="keyOf"
          :types="types"
          @toggle-type="(type) => emit('toggle-type', type)"
        >
          <template #default="{ item }">
            <UtilityRow
              :color="item.color"
              :selected="openLineupId === item.id"
              :hovered="hoveredId === item.id"
              @select="open(item)"
              @hover="(on) => onRowHover(item.id, on)"
            >
              <template #thumb>
                <UtilityRadarThumb
                  :map-name="item.lineup.map_name"
                  :origin="item.origin"
                  :landing="item.landing"
                  :color="item.color"
                  :size="40"
                />
              </template>

              {{ item.lineup.name }}

              <template v-if="nextItem?.id === item.id" #badges>
                <span
                  class="inline-flex h-4 shrink-0 items-center rounded-sm bg-[hsl(var(--tac-amber))] px-1 font-mono text-[0.55rem] font-bold uppercase leading-none tracking-[0.1em] text-black"
                >
                  {{ $t("pages.utility.plan.next") }}
                </span>
              </template>

              <!-- Only what the plan knows and the lineup does not: why it is
                   here, where it stands, and how everyone else does on it. -->
              <template #line2>
                <span
                  class="inline-flex h-4 shrink-0 items-center rounded-sm border px-1 text-[0.55rem] font-bold leading-none"
                  :class="utilityPlanReasonTone(item.entry.reason)"
                >
                  {{ reasonLabel(item.entry) }}
                </span>
                <span class="min-w-0 truncate">
                  #{{ item.rank }}
                  <span aria-hidden="true" class="mx-1 text-border">/</span>
                  {{
                    item.entry.globalLandingRate !== null
                      ? $t("pages.utility.plan.global_landing_rate", {
                          percent: item.entry.globalLandingRate,
                        })
                      : $t("pages.utility.plan.no_data")
                  }}
                </span>
              </template>

              <template #right>
                <UtilityPlanStreak :streak="item.streak" />
              </template>
            </UtilityRow>
          </template>
        </UtilityTypeSections>
      </div>
    </HeightSwap>
  </div>
</template>
