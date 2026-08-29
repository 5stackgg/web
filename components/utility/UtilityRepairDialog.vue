<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Rocket, Signal, Square, Wrench } from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import QuickServerConnect from "~/components/match/QuickServerConnect.vue";
import UtilityCalibrationGate from "~/components/utility/UtilityCalibrationGate.vue";
import { toast } from "~/components/ui/toast";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { useUtilitySolverCalibration } from "~/composables/useUtilitySolverCalibration";
import {
  utilityPracticeSessionSubscription,
  repairUtilityLineupMutation,
  startUtilityPracticeMutation,
  stopUtilityPracticeMutation,
} from "~/graphql/utilityGraphql";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { readUtilityPracticeSession, readUtilityRepairOutput } from "~/types/utility";
import type {
  UtilityPracticeSession,
  UtilityPracticeSessionOutput,
  UtilityRepairView,
  UtilitySolveOutput,
} from "~/types/utility";
import cleanMapName from "~/utilities/cleanMapName";

const props = defineProps<{
  lineupId: string | null;
  lineupName: string | null;
  mapName: string;
  /** How far the scan says the landing moved, when it measured one. */
  distance: number | null;
}>();

const emit = defineEmits<{
  (e: "queued", lineupId: string): void;
}>();

const open = defineModel<boolean>("open", { default: false });

const { t } = useI18n();

// Reka Select rejects an empty-string value, so "unset" rides a sentinel.
const ANY_REGION = "any";

// Under an ON DEMAND heading, so only the regions that can actually boot one.
// A region with no node is not a slower answer, it is no answer -- the API
// refuses it outright.
const regions = computed(() =>
  useApplicationSettingsStore().availableRegions.filter(
    (entry: { has_node: boolean }) => entry.has_node,
  ),
);
const region = ref<string>(ANY_REGION);
const sessionId = ref<string | null>(null);
const session = ref<UtilityPracticeSession | null>(null);
const started = ref<UtilityPracticeSessionOutput | null>(null);
const output = ref<UtilityRepairView | null>(null);

// Column names stop here: everything below reads the mapped view.
const practice = computed(() =>
  readUtilityPracticeSession(session.value, started.value),
);

// Gated on the session being live rather than merely created: a booting server
// answers nothing useful, and an "unknown" from a server that has not come up
// yet reads as a broken solver instead of one nobody has asked.
const calibratableSessionId = computed(() =>
  practice.value.isLive ? sessionId.value : null,
);

const { calibration, checking, refresh: refreshCalibration } =
  useUtilitySolverCalibration(calibratableSessionId, {
    onError: (error: any) => {
      toast({
        title: t("pages.utility.solve.calibration_failed"),
        description: error?.message,
        variant: "destructive",
      });
    },
  });

let sessionSub: { unsubscribe: () => void } | null = null;

function unsubscribeSession() {
  sessionSub?.unsubscribe();
  sessionSub = null;
}

function subscribeSession(id: string) {
  unsubscribeSession();
  sessionId.value = id;
  sessionSub = getGraphqlClient()
    .subscribe({
      query: utilityPracticeSessionSubscription,
      variables: { id },
    })
    .subscribe({
      next: ({ data }: { data: any }) => {
        session.value = data?.utility_practice_sessions_by_pk ?? null;
      },
      error: (error: unknown) => {
        console.error("[utility] repair session subscription error:", error);
      },
    });
}

onBeforeUnmount(unsubscribeSession);

// The session outlives the row it was opened on — a scan usually has more than
// one moved lineup, and tearing the server down between them would cost two
// minutes of boot each time. Only the last answer is per-lineup.
watch(
  () => props.lineupId,
  () => {
    output.value = null;
  },
);

// Not "has a connect string": that is derived from the match's server row, so
// it resolves the moment a server is assigned -- for an on-demand session, the
// instant the pod is scheduled and minutes before cs2 is listening. Offering
// the connect then hands somebody an address that refuses them.
const isBooting = computed(() => !!sessionId.value && !practice.value.isLive);

const canRepair = computed(
  () =>
    !!props.lineupId &&
    !!sessionId.value &&
    practice.value.isLive &&
    practice.value.canManage &&
    calibration.value?.ready === true,
);

const connectServer = computed(() => ({
  connection_string: practice.value.connectionString,
  connection_link: practice.value.connectionLink,
}));

async function start() {
  try {
    const { data } = await getGraphqlClient().mutate({
      mutation: startUtilityPracticeMutation,
      variables: {
        map_name: props.mapName,
        region: region.value === ANY_REGION ? null : region.value,
        collection_id: null,
        is_open: false,
      },
    });
    const result = (data as any)?.startUtilityPractice as
      | UtilityPracticeSessionOutput
      | undefined;
    if (!result?.id) {
      throw new Error("no session");
    }
    started.value = result;
    subscribeSession(result.id);
  } catch (error: any) {
    toast({
      title: t("pages.utility.practice.start_failed"),
      description: error?.message,
      variant: "destructive",
    });
  }
}

async function stop() {
  const id = sessionId.value;
  if (!id) {
    return;
  }
  try {
    await getGraphqlClient().mutate({
      mutation: stopUtilityPracticeMutation,
      variables: { session_id: id },
    });
    unsubscribeSession();
    sessionId.value = null;
    session.value = null;
    started.value = null;
  } catch (error: any) {
    toast({
      title: t("pages.utility.practice.stop_failed"),
      description: error?.message,
      variant: "destructive",
    });
  }
}

async function repair() {
  const lineupId = props.lineupId;
  const id = sessionId.value;
  if (!lineupId || !id) {
    return;
  }
  output.value = null;
  try {
    const { data } = await getGraphqlClient().mutate({
      mutation: repairUtilityLineupMutation,
      variables: {
        utility_lineup_id: lineupId,
        session_id: id,
      },
    });
    output.value = readUtilityRepairOutput(
      (data as any)?.repairUtilityLineup as UtilitySolveOutput | undefined,
    );
    // The row this was opened from will never change — the repair lands as a
    // separate lineup — so the page is told, or the operator fires it twice
    // waiting for a fix that was never coming to that row.
    if (output.value.accepted) {
      emit("queued", lineupId);
    }
  } catch (error: any) {
    toast({
      title: t("pages.utility.repair.failed"),
      description: error?.message,
      variant: "destructive",
    });
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Wrench class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
          {{ $t("pages.utility.repair.title") }}
        </DialogTitle>
        <DialogDescription>
          {{ $t("pages.utility.repair.description") }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div class="rounded-md border border-border bg-foreground/5 p-3">
          <div class="truncate text-sm font-semibold">
            {{ lineupName || $t("pages.utility.repair.unnamed") }}
          </div>
          <div
            class="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
          >
            {{ cleanMapName(mapName) }}
            <template v-if="distance !== null">
              ·
              {{ $t("pages.utility.drift.moved", { units: Math.round(distance) }) }}
            </template>
          </div>
          <p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {{ $t("pages.utility.repair.target_note") }}
          </p>
        </div>

        <div v-if="!sessionId" class="space-y-2">
          <p class="text-xs leading-relaxed text-muted-foreground">
            {{ $t("pages.utility.repair.needs_session") }}
          </p>
          <span
            class="flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            <Signal class="h-3.5 w-3.5" />
            {{ $t("pages.utility.practice.region") }}
          </span>
          <Select v-model="region">
            <SelectTrigger>
              <SelectValue
                :placeholder="$t('pages.utility.practice.select_region')"
              />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem :value="ANY_REGION">
                  {{ $t("pages.utility.practice.any_region") }}
                </SelectItem>
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>{{ $t("match.server.on_demand") }}</SelectLabel>
                <SelectItem
                  v-for="entry of regions"
                  :key="entry.value"
                  :value="entry.value"
                >
                  {{ entry.description || entry.value }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <p v-if="!regions.length" class="text-xs text-muted-foreground">
            {{ $t("pages.utility.practice.no_regions") }}
          </p>
        </div>

        <div
          v-else-if="isBooting"
          class="flex items-center gap-3 rounded-md border border-border bg-foreground/5 p-4"
        >
          <Spinner class="shrink-0" />
          <div class="min-w-0">
            <div class="text-sm font-medium">
              {{ $t("pages.utility.practice.booting") }}
            </div>
            <p
              v-if="practice.failureReason"
              class="mt-1 whitespace-pre-wrap break-words text-xs text-[hsl(var(--tac-amber))]"
            >
              {{ practice.failureReason }}
            </p>
          </div>
        </div>

        <template v-else>
          <div class="rounded-md border border-border bg-foreground/5 p-4">
            <QuickServerConnect :server="connectServer" highlight />
          </div>

          <UtilityCalibrationGate
            :calibration="calibration"
            :checking="checking"
            @refresh="refreshCalibration()"
          />

          <Button
            class="tac-amber-cta w-full"
            :disabled="!canRepair"
            @click="repair()"
          >
            <Wrench class="mr-1 h-4 w-4" />
            {{ $t("pages.utility.repair.submit") }}
          </Button>
        </template>

        <!-- Four refusals, four different things to do about them: run a scan,
             stop trying to fix a lineup that has nothing to aim at, or move to a
             session on the right map. Collapsing them into one red box throws
             away the only actionable part of the answer. -->
        <div
          v-if="output && !output.accepted"
          class="space-y-1 rounded-md border p-3"
          :class="
            output.refusal === 'not_moved'
              ? 'border-border bg-muted/30'
              : 'border-destructive/40 bg-destructive/10'
          "
        >
          <div class="text-sm font-medium">
            {{
              output.refusal
                ? $t(`pages.utility.repair.refusals.${output.refusal}`)
                : $t("pages.utility.solve.rejected")
            }}
          </div>
          <p
            v-if="output.refusal"
            class="text-xs leading-relaxed text-muted-foreground"
          >
            {{ $t(`pages.utility.repair.refusal_notes.${output.refusal}`) }}
          </p>
          <p
            v-else-if="output.status"
            class="font-mono text-[0.62rem] uppercase tracking-[0.14em]"
          >
            {{ output.status }}
          </p>
          <!-- NotMoved carries the verdict that disqualified the lineup, which
               is the specific half of the answer. -->
          <p
            v-if="output.message"
            class="whitespace-pre-wrap break-words text-xs text-muted-foreground"
          >
            {{ output.message }}
          </p>
        </div>

        <!-- `accepted` is the server taking the job and nothing more. Saying
             "repaired" here would be reporting an outcome nobody has seen. -->
        <div
          v-else-if="output"
          class="space-y-1 rounded-md border border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.1)] p-3"
        >
          <div class="text-sm font-medium text-[hsl(var(--tac-amber))]">
            {{ $t("pages.utility.repair.accepted") }}
          </div>
          <p class="text-xs leading-relaxed text-muted-foreground">
            {{ $t("pages.utility.repair.accepted_note") }}
          </p>
          <p
            v-if="output.message"
            class="whitespace-pre-wrap break-words text-xs text-muted-foreground"
          >
            {{ output.message }}
          </p>
        </div>
      </div>

      <DialogFooter class="gap-2 sm:justify-between">
        <Button
          v-if="sessionId && practice.canManage"
          variant="destructive"
          @click="stop()"
        >
          <Square class="mr-1 h-4 w-4" />
          {{ $t("pages.utility.practice.stop") }}
        </Button>
        <Button v-else-if="!sessionId" class="tac-amber-cta" @click="start()">
          <Rocket class="mr-1 h-4 w-4" />
          {{ $t("pages.utility.practice.start") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
