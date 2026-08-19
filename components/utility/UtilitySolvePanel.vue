<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  ArrowLeft,
  Ban,
  CircleCheck,
  Crosshair,
  Wand2,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Progress } from "~/components/ui/progress";
import { Spinner } from "~/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { toast } from "~/components/ui/toast";
import UtilityRadarBoard from "~/components/utility/UtilityRadarBoard.vue";
import UtilityLineupCard from "~/components/utility/UtilityLineupCard.vue";
import UtilityCalibrationGate from "~/components/utility/UtilityCalibrationGate.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { useUtilitySolverCalibration } from "~/composables/useUtilitySolverCalibration";
import {
  utilityLineupsQuery,
  solveUtilityLineupMutation,
} from "~/graphql/utilityGraphql";
import { order_by } from "~/generated/zeus";
import { normalizeMapName } from "~/utilities/mapAssets";
import {
  UTILITY_EYE_HEIGHT_UNITS,
  UTILITY_SOLVE_TIMEOUT_MS,
  UTILITY_TYPES,
  UTILITY_TYPE_COLORS,
  utilitySolveMatches,
} from "~/utilities/utilityDisplay";
import type {
  UtilityBoardMarker,
  UtilityBoardSegment,
} from "~/utilities/utilityDisplay";
import type {
  UtilityLineup,
  UtilitySightlinePoint,
  UtilitySolveOutput,
  UtilityType,
} from "~/types/utility";

const props = defineProps<{
  sessionId: string;
  mapName: string;
}>();

const emit = defineEmits<{
  (e: "back"): void;
}>();

const { t } = useI18n();

const LINEUP_POLL_MS = 3000;

const mapName = computed(() => normalizeMapName(props.mapName));

const { calibration, checking, refresh: refreshCalibration } =
  useUtilitySolverCalibration(() => props.sessionId, {
    onError: (error: any) => {
      toast({
        title: t("pages.utility.solve.calibration_failed"),
        description: error?.message,
        variant: "destructive",
      });
    },
  });

const target = ref<UtilitySightlinePoint | null>(null);
const throwFrom = ref<UtilitySightlinePoint | null>(null);
const pickMode = ref<"target" | "from">("target");
const utilityType = ref<UtilityType>("Smoke");
const lineupName = ref("");
const toleranceInput = ref("");
const heightInput = ref(String(UTILITY_EYE_HEIGHT_UNITS));

const submitting = ref(false);
const solveOutput = ref<UtilitySolveOutput | null>(null);
const waiting = ref(false);
const waitedMs = ref(0);
const timedOut = ref(false);
const cancelled = ref(false);
const solved = ref<UtilityLineup | null>(null);

let lineupTimer: ReturnType<typeof setTimeout> | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;

const pickHeight = computed(() => {
  const value = Number(heightInput.value);
  return Number.isFinite(value) ? value : 0;
});

function stopWatching() {
  if (lineupTimer) {
    clearTimeout(lineupTimer);
    lineupTimer = null;
  }
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  waiting.value = false;
}

onBeforeUnmount(stopWatching);

function onPick(point: UtilitySightlinePoint) {
  if (pickMode.value === "from") {
    throwFrom.value = point;
    pickMode.value = "target";
    return;
  }
  target.value = point;
}

const markers = computed<UtilityBoardMarker[]>(() => {
  const out: UtilityBoardMarker[] = [];
  if (throwFrom.value) {
    out.push({
      key: "from",
      point: throwFrom.value,
      color: "#e6ebf5",
      shape: "cross" as const,
      label: t("pages.utility.solve.from_short"),
    });
  }
  if (target.value) {
    out.push({
      key: "target",
      point: target.value,
      color: UTILITY_TYPE_COLORS[utilityType.value],
      label: t("pages.utility.solve.target_short"),
    });
  }
  return out;
});

const segments = computed<UtilityBoardSegment[]>(() => {
  if (!throwFrom.value || !target.value) {
    return [];
  }
  return [
    {
      key: "solve",
      from: throwFrom.value,
      to: target.value,
      color: UTILITY_TYPE_COLORS[utilityType.value],
      dashed: true,
    },
  ];
});

const boardLineups = computed(() => (solved.value ? [solved.value] : []));

const progress = computed(() =>
  Math.min(100, Math.round((waitedMs.value / UTILITY_SOLVE_TIMEOUT_MS) * 100)),
);

const waitedSeconds = computed(() => Math.floor(waitedMs.value / 1000));

const timeoutSeconds = Math.round(UTILITY_SOLVE_TIMEOUT_MS / 1000);

/**
 * The solved lineup arrives through normal ingest, so it is found rather than
 * returned: anything new on this map whose landing sits on the requested target
 * is the answer. `since` is nudged backwards because the browser clock and the
 * database clock are not the same clock, and the proximity check is what
 * actually stops an unrelated lineup being claimed.
 */
async function lookForSolvedLineup(since: string) {
  const wanted = target.value;
  if (!wanted) {
    return;
  }
  try {
    const { data } = await getGraphqlClient().query({
      query: utilityLineupsQuery,
      variables: {
        where: {
          map_name: { _eq: mapName.value },
          can_view: { _eq: true },
          created_at: { _gt: since },
        },
        order_by: [{ created_at: order_by.desc }],
        limit: 10,
        offset: 0,
      },
      fetchPolicy: "no-cache",
    });
    const rows = ((data as any)?.utility_lineups ?? []) as UtilityLineup[];
    const match = rows.find((lineup) => utilitySolveMatches(lineup, wanted));
    if (match) {
      solved.value = match;
      stopWatching();
    }
  } catch (error) {
    console.error("[utility] solve watch error:", error);
  }
}

function watchForLineup(since: string, startedAt: number) {
  stopWatching();
  waiting.value = true;
  waitedMs.value = 0;
  tickTimer = setInterval(() => {
    waitedMs.value = Date.now() - startedAt;
  }, 1000);
  const tick = () => {
    lineupTimer = setTimeout(async () => {
      await lookForSolvedLineup(since);
      if (!waiting.value) {
        return;
      }
      if (Date.now() - startedAt >= UTILITY_SOLVE_TIMEOUT_MS) {
        timedOut.value = true;
        stopWatching();
        return;
      }
      tick();
    }, LINEUP_POLL_MS);
  };
  tick();
}

async function solve() {
  const wanted = target.value;
  if (!wanted || submitting.value) {
    return;
  }
  submitting.value = true;
  solveOutput.value = null;
  solved.value = null;
  timedOut.value = false;
  cancelled.value = false;
  try {
    const tolerance = Number(toleranceInput.value);
    const { data } = await getGraphqlClient().mutate({
      mutation: solveUtilityLineupMutation,
      variables: {
        session_id: props.sessionId,
        target_x: wanted.x,
        target_y: wanted.y,
        target_z: wanted.z,
        from_x: throwFrom.value?.x ?? null,
        from_y: throwFrom.value?.y ?? null,
        from_z: throwFrom.value?.z ?? null,
        utility_type: utilityType.value,
        name: lineupName.value.trim() || null,
        tolerance:
          toleranceInput.value && Number.isFinite(tolerance) ? tolerance : null,
      },
    });
    const output = (data as any)?.solveUtilityLineup as
      | UtilitySolveOutput
      | undefined;
    solveOutput.value = output ?? null;
    if (!output?.accepted) {
      return;
    }
    const startedAt = Date.now();
    watchForLineup(new Date(startedAt - 30000).toISOString(), startedAt);
  } catch (error: any) {
    toast({
      title: t("pages.utility.solve.failed"),
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    submitting.value = false;
  }
}

function cancelWaiting() {
  stopWatching();
  cancelled.value = true;
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-2">
      <Button variant="ghost" size="sm" @click="emit('back')">
        <ArrowLeft class="mr-1 h-4 w-4" />
        {{ $t("pages.utility.solve.back") }}
      </Button>
      <span class="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">
        {{ $t("pages.utility.solve.title") }}
      </span>
    </div>

    <UtilityCalibrationGate
      v-if="!calibration?.ready"
      :calibration="calibration"
      :checking="checking"
      @refresh="refreshCalibration()"
    />

    <template v-else>
      <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
        <div class="flex flex-col gap-2">
          <UtilityRadarBoard
            :map-name="mapName"
            :lineups="boardLineups"
            :selected-id="solved?.id ?? null"
            picking
            :pick-z="pickHeight"
            :markers="markers"
            :segments="segments"
            @pick="onPick"
          />
          <p class="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Crosshair class="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {{
              pickMode === "from"
                ? $t("pages.utility.solve.pick_from_hint")
                : $t("pages.utility.solve.pick_target_hint")
            }}
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <span
            class="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            {{ $t("pages.utility.solve.utility") }}
          </span>
          <Select v-model="utilityType">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="entry of UTILITY_TYPES" :key="entry" :value="entry">
                {{ $t(`pages.utility.types.${entry}`) }}
              </SelectItem>
            </SelectContent>
          </Select>

          <span
            class="pt-1 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            {{ $t("pages.utility.solve.name") }}
          </span>
          <Input
            v-model="lineupName"
            :placeholder="$t('pages.utility.solve.name_placeholder')"
            class="h-8 text-xs"
          />

          <span
            class="pt-1 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            {{ $t("pages.utility.solve.height") }}
          </span>
          <Input v-model="heightInput" type="number" class="h-8 text-xs" />

          <span
            class="pt-1 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            {{ $t("pages.utility.solve.tolerance") }}
          </span>
          <Input
            v-model="toleranceInput"
            type="number"
            :placeholder="$t('pages.utility.solve.tolerance_placeholder')"
            class="h-8 text-xs"
          />

          <Button
            size="sm"
            variant="outline"
            class="mt-1"
            :class="pickMode === 'from' ? 'text-[hsl(var(--tac-amber))]' : ''"
            @click="pickMode = pickMode === 'from' ? 'target' : 'from'"
          >
            {{
              throwFrom
                ? $t("pages.utility.solve.repick_from")
                : $t("pages.utility.solve.pick_from")
            }}
          </Button>

          <Button
            class="tac-amber-cta"
            :disabled="!target || waiting"
            :loading="submitting"
            @click="solve()"
          >
            <Wand2 class="mr-1 h-4 w-4" />
            {{ $t("pages.utility.solve.submit") }}
          </Button>
        </div>
      </div>

      <div
        v-if="solveOutput && !solveOutput.accepted"
        class="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-3"
      >
        <div class="text-sm font-medium">
          {{ $t("pages.utility.solve.rejected") }}
        </div>
        <p class="font-mono text-[0.62rem] uppercase tracking-[0.14em]">
          {{ solveOutput.status }}
        </p>
        <p
          v-if="solveOutput.message"
          class="whitespace-pre-wrap break-words text-xs text-muted-foreground"
        >
          {{ solveOutput.message }}
        </p>
      </div>

      <div
        v-if="waiting"
        class="space-y-2 rounded-md border border-border bg-foreground/5 p-3"
      >
        <div class="flex items-center justify-between gap-2 text-sm">
          <span class="flex items-center gap-2">
            <Spinner class="h-4 w-4" />
            {{ $t("pages.utility.solve.working") }}
          </span>
          <span class="font-mono text-xs tabular-nums text-muted-foreground">
            {{ waitedSeconds }}s / {{ timeoutSeconds }}s
          </span>
        </div>
        <Progress :model-value="progress" />
        <p class="text-xs text-muted-foreground">
          {{ $t("pages.utility.solve.working_note") }}
        </p>
        <Button size="sm" variant="outline" @click="cancelWaiting()">
          <Ban class="mr-1 h-4 w-4" />
          {{ $t("pages.utility.solve.cancel") }}
        </Button>
      </div>

      <p
        v-else-if="cancelled"
        class="rounded-md border border-border bg-foreground/5 p-3 text-xs text-muted-foreground"
      >
        {{ $t("pages.utility.solve.cancelled_note") }}
      </p>

      <p
        v-else-if="timedOut"
        class="rounded-md border border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.1)] p-3 text-xs text-muted-foreground"
      >
        {{ $t("pages.utility.solve.timed_out") }}
      </p>

      <div v-if="solved" class="space-y-2">
        <div
          class="flex items-center gap-2 text-sm font-medium text-[hsl(var(--tac-amber))]"
        >
          <CircleCheck class="h-4 w-4" />
          {{ $t("pages.utility.solve.solved") }}
        </div>
        <UtilityLineupCard :lineup="solved" />
      </div>
    </template>
  </div>
</template>
