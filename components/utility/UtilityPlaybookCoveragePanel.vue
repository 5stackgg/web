<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Crosshair, Eye, PlugZap, Shield, Trash2 } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { toast } from "~/components/ui/toast";
import UtilityRadarBoard from "~/components/utility/UtilityRadarBoard.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { analyseUtilityPlaybookCoverageQuery } from "~/graphql/utilityGraphql";
import { normalizeMapName } from "~/utilities/mapAssets";
import {
  UTILITY_COVERAGE_COLORS,
  UTILITY_COVERAGE_TONES,
  UTILITY_EYE_HEIGHT_UNITS,
  UTILITY_SIGHTLINE_MAX_PAIRS,
  UTILITY_SIGHTLINE_UNCHECKED_COLOR,
  readUtilityPlaybookCoverage,
} from "~/utilities/utilityDisplay";
import type {
  UtilityBoardMarker,
  UtilityBoardSegment,
  UtilityCoverageView,
} from "~/utilities/utilityDisplay";
import { readUtilityAnalysisNotice } from "~/types/utility";
import type {
  UtilityAnalysisNotice,
  UtilityLineup,
  UtilityPlaybookCoverageOutput,
  UtilityPlaybookCoverageResult,
  UtilityPlaybookStep,
  UtilitySightlinePair,
  UtilitySightlinePoint,
} from "~/types/utility";

const props = withDefaults(
  defineProps<{
    playbookId: string;
    mapName: string;
    steps?: UtilityPlaybookStep[];
    lineupsById?: Record<string, UtilityLineup>;
  }>(),
  {
    steps: () => [],
    lineupsById: () => ({}),
  },
);

const { t } = useI18n();

const mapName = computed(() => normalizeMapName(props.mapName));

const open = ref(false);
const pairs = ref<UtilitySightlinePair[]>([]);
const pending = ref<UtilitySightlinePoint | null>(null);
const selectedPairId = ref<string | null>(null);
const coverageByPair = ref<Record<string, UtilityPlaybookCoverageResult>>({});
// Which pairs the last run actually asked about. A line drawn after the check
// has no answer and no verdict — without this it would inherit the run's
// degraded state and render as unknown, which is a claim about a line nobody
// ever sent.
const checkedIds = ref<Set<string>>(new Set());
const notice = ref<UtilityAnalysisNotice | null>(null);
const checking = ref(false);

let pairCounter = 0;

const orderedSteps = computed(() =>
  [...(props.steps ?? [])].sort((a, b) => a.step_order - b.step_order),
);

const boardLineups = computed(() =>
  orderedSteps.value
    .map((step) => props.lineupsById?.[step.utility_lineup_id])
    .filter((lineup): lineup is UtilityLineup => !!lineup),
);

// Eyes, not feet: a sightline runs between where two players are looking from.
const heightInput = ref(String(UTILITY_EYE_HEIGHT_UNITS));

const pickHeight = computed(() => {
  const value = Number(heightInput.value);
  return Number.isFinite(value) ? value : 0;
});

function viewOf(pairId: string): UtilityCoverageView | null {
  if (!notice.value || !checkedIds.value.has(pairId)) {
    return null;
  }
  return readUtilityPlaybookCoverage(
    coverageByPair.value[pairId] ?? null,
    notice.value.degraded,
  );
}

function pairColor(pairId: string) {
  const view = viewOf(pairId);
  return view
    ? UTILITY_COVERAGE_COLORS[view.verdict]
    : UTILITY_SIGHTLINE_UNCHECKED_COLOR;
}

const segments = computed<UtilityBoardSegment[]>(() =>
  pairs.value.map((pair, index) => ({
    key: pair.id,
    from: pair.from,
    to: pair.to,
    color: pairColor(pair.id),
    label: String(index + 1),
    dashed: !viewOf(pair.id),
  })),
);

const markers = computed<UtilityBoardMarker[]>(() =>
  pending.value
    ? [
        {
          key: "pending",
          point: pending.value,
          color: UTILITY_SIGHTLINE_UNCHECKED_COLOR,
          shape: "cross" as const,
        },
      ]
    : [],
);

function onPick(point: UtilitySightlinePoint) {
  if (!pending.value) {
    if (pairs.value.length >= UTILITY_SIGHTLINE_MAX_PAIRS) {
      toast({
        title: t("pages.utility.sightline.max_pairs", {
          count: UTILITY_SIGHTLINE_MAX_PAIRS,
        }),
      });
      return;
    }
    pending.value = point;
    return;
  }
  const pair: UtilitySightlinePair = {
    id: `coverage-${++pairCounter}`,
    from: pending.value,
    to: point,
  };
  pending.value = null;
  pairs.value = [...pairs.value, pair];
  selectedPairId.value = pair.id;
}

function removePair(id: string) {
  pairs.value = pairs.value.filter((pair) => pair.id !== id);
  const next = { ...coverageByPair.value };
  delete next[id];
  coverageByPair.value = next;
  const checked = new Set(checkedIds.value);
  checked.delete(id);
  checkedIds.value = checked;
  if (selectedPairId.value === id) {
    selectedPairId.value = null;
  }
}

function clearAll() {
  pairs.value = [];
  pending.value = null;
  selectedPairId.value = null;
  coverageByPair.value = {};
  checkedIds.value = new Set();
  notice.value = null;
}

// Answers come back keyed by their position in the request, so the ids that
// were sent are held onto and re-keyed by pair — editing the list afterwards
// then drops stale answers instead of mislabelling them.
async function check() {
  if (!pairs.value.length) {
    return;
  }
  const sent = pairs.value.map((pair) => pair.id);
  checking.value = true;
  try {
    const { data } = await getGraphqlClient().query({
      query: analyseUtilityPlaybookCoverageQuery,
      variables: {
        playbook_id: props.playbookId,
        pairs: pairs.value.map((pair) => ({
          from_x: pair.from.x,
          from_y: pair.from.y,
          from_z: pair.from.z,
          to_x: pair.to.x,
          to_y: pair.to.y,
          to_z: pair.to.z,
        })),
      },
      fetchPolicy: "no-cache",
    });
    const output = (data as any)?.analyseUtilityPlaybookCoverage as
      | UtilityPlaybookCoverageOutput
      | undefined;
    notice.value = readUtilityAnalysisNotice(output);
    const next: Record<string, UtilityPlaybookCoverageResult> = {};
    for (const result of output?.results ?? []) {
      const id = sent[result.index];
      if (id) {
        next[id] = result;
      }
    }
    coverageByPair.value = next;
    checkedIds.value = new Set(sent);
  } catch (error: any) {
    notice.value = { degraded: true, message: error?.message ?? null };
    coverageByPair.value = {};
    checkedIds.value = new Set(sent);
    toast({
      title: t("pages.utility.coverage.failed"),
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    checking.value = false;
  }
}

type CoverageRow = {
  pair: UtilitySightlinePair;
  index: number;
  color: string;
  view: UtilityCoverageView | null;
  stepPosition: number | null;
  stepName: string | null;
};

/**
 * `by_step` is the step's own order, which is written from the array index —
 * so the same number resolves either way round. The index is the fallback for a
 * playbook whose orders are not contiguous.
 */
function resolveStep(byStep: number | null) {
  if (byStep == null) {
    return { stepPosition: null, stepName: null };
  }
  const steps = orderedSteps.value;
  const index = steps.findIndex((step) => step.step_order === byStep);
  const resolved = index >= 0 ? index : byStep;
  const step = steps[resolved];
  if (!step) {
    return { stepPosition: byStep, stepName: null };
  }
  return {
    stepPosition: resolved + 1,
    stepName: props.lineupsById?.[step.utility_lineup_id]?.name ?? null,
  };
}

const rows = computed<CoverageRow[]>(() =>
  pairs.value.map((pair, index) => {
    const view = viewOf(pair.id);
    const step = resolveStep(view?.byStep ?? null);
    return {
      pair,
      index,
      color: pairColor(pair.id),
      view,
      stepPosition: step.stepPosition,
      stepName: step.stepName,
    };
  }),
);

const openCount = computed(
  () => rows.value.filter((row) => row.view?.verdict === "open").length,
);

const unknownCount = computed(
  () => rows.value.filter((row) => row.view?.verdict === "unknown").length,
);

function coordinate(point: UtilitySightlinePoint) {
  return `${Math.round(point.x)}, ${Math.round(point.y)}, ${Math.round(point.z)}`;
}
</script>

<template>
  <div
    class="rounded-md border border-border bg-card/40 p-3 [backdrop-filter:blur(6px)]"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <div
          class="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
        >
          {{ $t("pages.utility.coverage.eyebrow") }}
        </div>
        <h2 class="text-sm font-semibold">
          {{ $t("pages.utility.coverage.title") }}
        </h2>
        <p class="mt-0.5 text-xs text-muted-foreground">
          {{ $t("pages.utility.coverage.description") }}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        class="shrink-0"
        @click="open = !open"
      >
        <Shield class="mr-1 h-4 w-4" />
        {{
          open ? $t("pages.utility.coverage.hide") : $t("pages.utility.coverage.open")
        }}
      </Button>
    </div>

    <div
      v-if="open"
      class="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]"
    >
      <div class="flex flex-col gap-2">
        <UtilityRadarBoard
          :map-name="mapName"
          :lineups="boardLineups"
          show-all-lines
          picking
          :pick-z="pickHeight"
          :segments="segments"
          :markers="markers"
          :selected-segment-key="selectedPairId"
          @pick="onPick"
          @select-segment="(key) => (selectedPairId = key)"
        />

        <p class="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Crosshair class="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {{
            pending
              ? $t("pages.utility.coverage.pending_hint")
              : $t("pages.utility.coverage.hint")
          }}
        </p>

        <div class="flex flex-wrap items-center gap-2">
          <label
            class="flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("pages.utility.sightline.height_label") }}
            <Input v-model="heightInput" type="number" class="h-8 w-24 text-xs" />
          </label>
          <span class="text-xs text-muted-foreground">
            {{ $t("pages.utility.sightline.height_hint") }}
          </span>
        </div>
      </div>

      <div class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            class="tac-amber-cta"
            :disabled="!pairs.length"
            :loading="checking"
            @click="check()"
          >
            <Eye class="mr-1 h-4 w-4" />
            {{ $t("pages.utility.coverage.check") }}
          </Button>
          <Button
            v-if="pairs.length || pending"
            size="sm"
            variant="ghost"
            @click="clearAll()"
          >
            <Trash2 class="mr-1 h-4 w-4" />
            {{ $t("pages.utility.sightline.clear") }}
          </Button>
        </div>

        <p class="text-[0.7rem] leading-snug text-muted-foreground">
          {{ $t("pages.utility.coverage.saved_only") }}
        </p>

        <!-- An unreachable parser is not an open angle. Nothing under a
             degraded answer is allowed to read as "the execute leaves this
             open" — telling a team an angle is free when the check never ran is
             the one thing this panel must never do. -->
        <div
          v-if="notice?.degraded"
          class="flex items-start gap-1.5 rounded-sm border border-destructive/40 bg-destructive/10 px-2 py-1.5"
        >
          <PlugZap class="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          <div class="min-w-0 flex-1">
            <div
              class="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-destructive"
            >
              {{ $t("pages.utility.coverage.degraded") }}
            </div>
            <p class="mt-0.5 text-[0.7rem] leading-snug text-muted-foreground">
              {{ $t("pages.utility.coverage.degraded_note") }}
            </p>
            <p
              v-if="notice.message"
              class="mt-0.5 whitespace-pre-wrap break-words font-mono text-[0.6rem] text-muted-foreground"
            >
              {{ notice.message }}
            </p>
          </div>
        </div>

        <p v-if="!pairs.length" class="text-xs text-muted-foreground">
          {{ $t("pages.utility.coverage.empty") }}
        </p>

        <div
          v-else-if="notice"
          class="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground"
        >
          <span>
            {{ $t("pages.utility.coverage.open_count", { count: openCount }) }}
          </span>
          <span v-if="unknownCount">
            {{
              $t("pages.utility.coverage.unknown_count", { count: unknownCount })
            }}
          </span>
        </div>

        <div
          v-for="row of rows"
          :key="row.pair.id"
          role="button"
          tabindex="0"
          class="flex cursor-pointer flex-col gap-2 rounded-md border bg-card/40 p-3 [backdrop-filter:blur(6px)]"
          :class="
            selectedPairId === row.pair.id
              ? 'border-[hsl(var(--tac-amber)/0.6)]'
              : 'border-border'
          "
          @click="selectedPairId = row.pair.id"
          @keydown.enter="selectedPairId = row.pair.id"
        >
          <div class="flex items-center gap-2">
            <span
              aria-hidden="true"
              class="h-3 w-3 shrink-0 rounded-[2px]"
              :style="{ backgroundColor: row.color }"
            />
            <span
              class="font-mono text-xs font-bold uppercase tracking-[0.14em]"
            >
              {{ $t("pages.utility.sightline.pair", { index: row.index + 1 }) }}
            </span>
            <button
              type="button"
              class="ml-auto shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              :title="$t('pages.utility.sightline.remove')"
              @click.stop="removePair(row.pair.id)"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </button>
          </div>

          <div
            class="font-mono text-[0.6rem] tabular-nums leading-relaxed text-muted-foreground"
          >
            {{ coordinate(row.pair.from) }} → {{ coordinate(row.pair.to) }}
          </div>

          <template v-if="row.view">
            <div
              class="rounded-sm border px-2 py-1.5"
              :class="UTILITY_COVERAGE_TONES[row.view.verdict]"
            >
              <div class="font-mono text-[0.62rem] uppercase tracking-[0.12em]">
                {{ $t(`pages.utility.coverage.verdict.${row.view.verdict}`) }}
              </div>
              <p class="mt-0.5 text-[0.7rem] leading-snug opacity-90">
                {{ $t(`pages.utility.coverage.verdict_note.${row.view.verdict}`) }}
              </p>
              <p
                v-if="row.view.verdict === 'covered' && row.stepPosition"
                class="mt-1 text-[0.7rem] leading-snug opacity-90"
              >
                {{
                  row.stepName
                    ? $t("pages.utility.coverage.by_step_named", {
                        step: row.stepPosition,
                        name: row.stepName,
                      })
                    : $t("pages.utility.coverage.by_step", {
                        step: row.stepPosition,
                      })
                }}
              </p>
            </div>

            <div
              v-if="row.view.depth !== null || row.view.visiblePercent !== null"
              class="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[0.6rem] tabular-nums text-muted-foreground"
            >
              <span v-if="row.view.depth !== null">
                {{ $t("pages.utility.sightline.depth", { units: row.view.depth }) }}
              </span>
              <span v-if="row.view.visiblePercent !== null">
                {{
                  $t("pages.utility.sightline.visible", {
                    percent: row.view.visiblePercent,
                  })
                }}
              </span>
            </div>
          </template>

          <p v-else class="text-xs text-muted-foreground">
            {{ $t("pages.utility.sightline.not_checked") }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
