<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Clapperboard, RotateCw } from "lucide-vue-next";
import { useNuxtApp } from "#app";
import {
  renderUtilityLineupPreviewMutation,
  renderUtilityLineupPreviewsMutation,
} from "~/graphql/utilityRenderGraphql";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import AnimatedStat from "~/components/AnimatedStat.vue";
import UtilityRenderVersion from "~/components/utility/UtilityRenderVersion.vue";
import UtilityRenderWarn from "~/components/utility/UtilityRenderWarn.vue";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Fold } from "~/components/ui/transitions";
import { toast } from "~/components/ui/toast";
import { useUtilityMaps } from "~/composables/useUtilityMaps";
import cleanMapName from "~/utilities/cleanMapName";
import {
  UTILITY_TYPE_COLORS,
  utilityLineupRoute,
} from "~/utilities/utilityDisplay";
import type {
  UtilityRenderCoverage,
  UtilityRenderGap,
  UtilityRenderGapState,
} from "~/types/utility";

type BulkScope = "missing" | "outdated";

const props = defineProps<{
  coverage: UtilityRenderCoverage | null;
  failed?: boolean;
}>();

const emit = defineEmits<{ (e: "enqueued"): void }>();

// Scopes the counts, the list and both buttons.
const map = defineModel<string | null>("map", { default: null });

const { t } = useI18n();
const nuxtApp = useNuxtApp();
const { tiles, loadMaps } = useUtilityMaps();

onMounted(() => void loadMaps());

// reka refuses an item whose value is the empty string.
const ALL_MAPS = "__all__";

function pickMap(value: unknown) {
  map.value = value === ALL_MAPS || !value ? null : String(value);
}

const mapLabel = computed(() =>
  map.value
    ? (tiles.value.find((tile) => tile.name === map.value)?.label ??
      cleanMapName(map.value))
    : null,
);

// The pod in use films an older version than the api expects: filming an
// outdated preview again would write another outdated one. The api refuses
// it too.
const behind = computed(
  () =>
    !!props.coverage &&
    props.coverage.pipeline_version !== null &&
    props.coverage.pipeline_version < props.coverage.version,
);

const stats = computed(() =>
  (["current", "missing", "outdated", "unrenderable", "queued"] as const).map(
    (key) => ({
      key,
      label: t(`pages.utility.render_queue.coverage.${key}`),
      value: props.coverage ? props.coverage[key] : null,
    }),
  ),
);

type StateFilter = "all" | UtilityRenderGapState;

const state = ref<StateFilter>("all");

const gapCount = computed(() =>
  props.coverage
    ? props.coverage.missing +
      props.coverage.outdated +
      props.coverage.unrenderable
    : 0,
);

const stateOptions = computed(() => [
  {
    key: "all",
    label: t("pages.utility.render_queue.gaps.all"),
    count: gapCount.value,
  },
  ...(["missing", "outdated", "unrenderable"] as const).map((key) => ({
    key,
    label: t(`pages.utility.render_queue.coverage.${key}`),
    count: props.coverage?.[key] ?? 0,
  })),
]);

const listed = computed(() => props.coverage?.lineups ?? []);

const shown = computed(() =>
  state.value === "all"
    ? listed.value
    : listed.value.filter((gap) => gap.state === state.value),
);

// A state the filter is on can empty out from under it: the last missing
// lineup gets its render.
watch(
  () => [state.value, props.coverage] as const,
  ([picked, coverage]) => {
    if (picked !== "all" && coverage && coverage[picked] === 0) {
      state.value = "all";
    }
  },
);

function gapName(gap: UtilityRenderGap) {
  return gap.name || t("pages.utility.repair.unnamed");
}

function failure(error: any): string | undefined {
  return error?.graphQLErrors?.[0]?.message ?? error?.message;
}

async function render(gap: UtilityRenderGap) {
  try {
    const { data } = await nuxtApp.$apollo.defaultClient.mutate({
      mutation: renderUtilityLineupPreviewMutation,
      variables: { utility_lineup_id: gap.id },
    });
    const result = (data as any)?.renderUtilityLineupPreview;
    toast({
      title: result?.success
        ? t("pages.utility.render_queue.requeued")
        : t("pages.utility.render_queue.not_requeued"),
      description: result?.reason ?? undefined,
      variant: result?.success ? undefined : "destructive",
    });
  } catch (error) {
    toast({
      title: t("pages.utility.render_queue.not_requeued"),
      description: failure(error),
      variant: "destructive",
    });
  } finally {
    emit("enqueued");
  }
}

const confirming = ref<BulkScope | null>(null);
// The dialog keeps its words while it closes.
const asked = ref<BulkScope>("missing");

function ask(scope: BulkScope) {
  asked.value = scope;
  confirming.value = scope;
}

const confirmText = computed(() => {
  const count = props.coverage?.[asked.value] ?? 0;
  const what = t(
    `pages.utility.render_queue.coverage.confirm_${asked.value}`,
    { count },
  );
  return mapLabel.value
    ? `${what} ${t("pages.utility.render_queue.coverage.confirm_map", {
        map: mapLabel.value,
      })}`
    : what;
});

async function renderAll() {
  const scope = confirming.value;
  if (!scope) {
    return;
  }
  try {
    const { data } = await nuxtApp.$apollo.defaultClient.mutate({
      mutation: renderUtilityLineupPreviewsMutation,
      variables: { scope, map_name: map.value },
    });
    const result = (data as any)?.renderUtilityLineupPreviews;
    const queued = Number(result?.queued ?? 0);
    const skipped = Number(result?.skipped ?? 0);
    toast({
      title:
        queued > 0
          ? t("pages.utility.render_queue.coverage.queued_toast", {
              count: queued,
            })
          : t("pages.utility.render_queue.coverage.none_toast"),
      description:
        skipped > 0
          ? t("pages.utility.render_queue.coverage.left_toast", {
              count: skipped,
            })
          : undefined,
    });
  } catch (error) {
    toast({
      title: t("pages.utility.render_queue.coverage.failed_toast"),
      description: failure(error),
      variant: "destructive",
    });
  } finally {
    confirming.value = null;
    emit("enqueued");
  }
}
</script>

<template>
  <div>
    <section
      data-render-coverage
      class="overflow-hidden rounded-md border border-border bg-card/40"
    >
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
        <span
          class="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-foreground"
        >
          {{ $t("pages.utility.render_queue.coverage.title") }}
        </span>
        <span
          v-if="coverage"
          data-coverage-version
          class="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
        >
          {{ $t("pages.utility.render_queue.coverage.version") }}
          <span class="normal-case tracking-normal text-foreground">
            v{{ coverage.version }}
          </span>
        </span>
        <UtilityRenderWarn
          v-if="behind && coverage"
          data-coverage-behind
          :title="$t('pages.utility.render_queue.coverage.pipeline_behind')"
          :note="
            $t('pages.utility.render_queue.coverage.pipeline_behind_hint', {
              pipeline: coverage.pipeline_version,
              version: coverage.version,
            })
          "
        />
        <UtilityRenderWarn
          v-if="failed"
          data-coverage-failed
          :title="$t('pages.utility.render_queue.coverage.load_failed')"
        />

        <Select :model-value="map ?? ALL_MAPS" @update:model-value="pickMap">
          <SelectTrigger
            class="ml-auto h-8 w-40 font-mono text-[0.64rem] uppercase tracking-[0.14em]"
            :aria-label="$t('pages.utility.render_queue.coverage.map_filter')"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="ALL_MAPS">
              {{ $t("pages.utility.picker.all_maps") }}
            </SelectItem>
            <SelectItem
              v-for="tile of tiles"
              :key="tile.name"
              :value="tile.name"
            >
              {{ tile.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <dl
        class="grid grid-cols-2 gap-px border-t border-border/40 bg-border/40 sm:grid-cols-5"
      >
        <div
          v-for="stat of stats"
          :key="stat.key"
          :data-coverage-stat="stat.key"
          class="flex flex-col-reverse bg-card px-3 py-2"
        >
          <dt
            class="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground"
          >
            {{ stat.label }}
          </dt>
          <dd
            class="font-mono text-lg tabular-nums leading-tight transition-colors duration-200 motion-reduce:transition-none"
            :class="stat.value ? 'text-foreground' : 'text-muted-foreground/50'"
          >
            <AnimatedStat :value="stat.value ?? '–'" />
          </dd>
        </div>
      </dl>

      <div
        class="flex flex-wrap items-center justify-end gap-2 border-t border-border/40 p-3"
      >
        <Button
          size="sm"
          variant="outline"
          data-bulk="missing"
          class="h-8 font-mono text-[0.62rem] uppercase tracking-[0.14em]"
          :disabled="!coverage?.missing"
          @click="ask('missing')"
        >
          {{
            $t("pages.utility.render_queue.coverage.render_missing", {
              total: coverage?.missing ?? "–",
            })
          }}
        </Button>
        <Button
          size="sm"
          variant="outline"
          data-bulk="outdated"
          class="h-8 font-mono text-[0.62rem] uppercase tracking-[0.14em]"
          :disabled="!coverage?.outdated || behind"
          @click="ask('outdated')"
        >
          {{
            $t("pages.utility.render_queue.coverage.rerender_outdated", {
              total: coverage?.outdated ?? "–",
            })
          }}
        </Button>
      </div>
    </section>

    <Fold :open="!!coverage">
      <section
        v-if="coverage"
        data-render-gaps
        class="mt-3 rounded-md border border-border"
      >
        <header class="flex flex-wrap items-center justify-between gap-2 p-3">
          <span
            class="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-foreground"
          >
            {{ $t("pages.utility.render_queue.gaps.title") }}
          </span>
          <AnimatedFilters v-model="state" square :options="stateOptions" />
        </header>

        <p
          v-if="listed.length < gapCount"
          data-gaps-capped
          class="border-t border-border/40 px-3 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
        >
          {{
            $t("pages.utility.render_queue.gaps.capped", {
              shown: listed.length,
              total: gapCount,
            })
          }}
        </p>

        <p
          v-if="!shown.length"
          class="border-t border-border/40 px-3 py-3 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
        >
          {{
            gapCount
              ? $t("pages.utility.render_queue.gaps.empty_filtered")
              : $t("pages.utility.render_queue.gaps.empty")
          }}
        </p>

        <ul
          v-else
          class="max-h-[26rem] divide-y divide-border/40 overflow-y-auto border-t border-border/40"
        >
          <li
            v-for="gap of shown"
            :key="gap.id"
            :data-gap="gap.state"
            class="flex items-center gap-2 px-3 py-1.5"
          >
            <span
              aria-hidden="true"
              class="h-2 w-2 shrink-0 rounded-[1px]"
              :style="{
                backgroundColor: UTILITY_TYPE_COLORS[gap.utility_type],
              }"
            />
            <NuxtLink
              :to="utilityLineupRoute(gap.map_name, gap.id)"
              class="min-w-0 flex-1 truncate text-xs transition-colors hover:text-[hsl(var(--tac-amber))]"
            >
              {{ gapName(gap) }}
            </NuxtLink>
            <span
              class="flex shrink-0 items-center gap-1 font-mono text-[0.6rem] uppercase tabular-nums tracking-[0.14em] text-muted-foreground"
            >
              {{ cleanMapName(gap.map_name) }}
              <span aria-hidden="true" class="text-border">/</span>
              {{ $t(`pages.utility.types.${gap.utility_type}`) }}
              <span aria-hidden="true" class="text-border">/</span>
              <UtilityRenderWarn
                v-if="gap.state === 'unrenderable'"
                :title="$t('pages.utility.render_queue.coverage.unrenderable')"
                :note="gap.reason"
              />
              <span :class="gap.state === 'missing' ? 'text-foreground' : ''">
                {{ $t(`pages.utility.render_queue.coverage.${gap.state}`) }}
              </span>
              <UtilityRenderVersion
                v-if="gap.state === 'outdated'"
                :version="gap.preview_version"
                :expected="coverage.version"
              />
            </span>
            <span class="inline-flex w-7 shrink-0 justify-end">
              <Button
                v-if="gap.state !== 'unrenderable'"
                size="sm"
                variant="ghost"
                class="h-6 px-1.5 [&_svg]:size-3.5"
                :title="
                  gap.state === 'outdated'
                    ? $t('pages.utility.render_queue.rerender')
                    : $t('pages.utility.render_queue.gaps.render')
                "
                :aria-label="
                  gap.state === 'outdated'
                    ? $t('pages.utility.render_queue.rerender')
                    : $t('pages.utility.render_queue.gaps.render')
                "
                @click="render(gap)"
              >
                <RotateCw v-if="gap.state === 'outdated'" />
                <Clapperboard v-else />
              </Button>
            </span>
          </li>
        </ul>
      </section>
    </Fold>

    <AlertDialog
      :open="confirming !== null"
      @update:open="(open) => !open && (confirming = null)"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{
              $t(`pages.utility.render_queue.coverage.confirm_${asked}_title`)
            }}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {{ confirmText }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {{ $t("common.cancel") }}
          </AlertDialogCancel>
          <!-- Not AlertDialogAction, which closes the dialog before the
               mutation has run. -->
          <Button data-bulk-confirm @click="renderAll">
            {{ $t("pages.utility.render_queue.coverage.confirm_queue") }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
