<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useNow } from "@vueuse/core";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import { Skeleton } from "~/components/ui/skeleton";
import TimeAgo from "~/components/TimeAgo.vue";
import Cs2GamedataPanel from "~/components/game-server-nodes/Cs2GamedataPanel.vue";
import Cs2MapAssetsPanel from "~/components/game-server-nodes/Cs2MapAssetsPanel.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { useSubscriptionManager } from "~/composables/useSubscriptionManager";
import {
  useCs2BuildNodes,
  useCs2BuildRuns,
} from "~/composables/useCs2BuildRuns";
import {
  CS2_BUILD_GAMEDATA_HISTORY_SUBSCRIPTION,
  CS2_BUILD_MAP_ASSETS_HISTORY_SUBSCRIPTION,
  CS2_BUILD_OPTIONAL,
  CS2_BUILD_VERSIONS_SUBSCRIPTION,
} from "~/graphql/cs2BuildGraphql";
import {
  TONE_BY_GAMEDATA_STATUS,
  TONE_BY_MAP_ASSETS_STATUS,
  gamedataRunStatus,
  mapAssetsRunStatus,
  type Cs2BuildTone,
  type GamedataRunRow,
  type MapAssetsRunRow,
} from "~/types/cs2Build";

// Picking a build swaps the detail in place; any other query key would
// remount the page (utilities/pageKey.ts).
definePageMeta({
  middleware: "admin",
  persistQueryKeys: ["build"],
});

type GameVersion = {
  build_id: number;
  version: string | null;
  current: boolean | null;
  updated_at: string | null;
};

const route = useRoute();
const router = useRouter();
const now = useNow({ interval: 60_000 });

const isTestInstance = computed(
  () => useRuntimeConfig().public.webDomain === "5stack.gg",
);

const versions = ref<Array<GameVersion>>([]);
const gamedataRuns = ref<Array<GamedataRunRow>>([]);
const mapAssetRuns = ref<Array<MapAssetsRunRow>>([]);
const loaded = ref(false);

const current = computed(() =>
  versions.value.find((version) => version.current),
);

// A build's dot is its worse half: a failure anywhere is red, and a build
// with one half not run yet is not finished.
const TONE_RANK: Record<Cs2BuildTone, number> = {
  success: 0,
  idle: 1,
  running: 2,
  warning: 3,
  destructive: 4,
};
const worseTone = (a: Cs2BuildTone, b: Cs2BuildTone) =>
  TONE_RANK[a] >= TONE_RANK[b] ? a : b;

const DOT_TONES: Record<Cs2BuildTone, string> = {
  success: "bg-success",
  warning: "bg-[hsl(var(--tac-amber))]",
  destructive: "bg-destructive",
  running: "bg-info",
  idle: "bg-muted-foreground/40",
};

const TEXT_TONES: Record<Cs2BuildTone, string> = {
  success: "text-success",
  warning: "text-[hsl(var(--tac-amber))]",
  destructive: "text-destructive",
  running: "text-info",
  idle: "text-muted-foreground",
};

const builds = computed(() => {
  const byBuild = new Map<
    number,
    {
      buildId: number;
      version: GameVersion | null;
      gamedata: GamedataRunRow | null;
      mapAssets: MapAssetsRunRow | null;
    }
  >();

  const entry = (buildId: number) => {
    if (!byBuild.has(buildId)) {
      byBuild.set(buildId, {
        buildId,
        version: versions.value.find((v) => v.build_id === buildId) ?? null,
        gamedata: null,
        mapAssets: null,
      });
    }
    return byBuild.get(buildId)!;
  };

  if (current.value) {
    entry(current.value.build_id);
  }
  for (const run of gamedataRuns.value) {
    entry(run.build_id).gamedata = run;
  }
  for (const run of mapAssetRuns.value) {
    const buildId = Number(run.build_id);
    if (Number.isFinite(buildId)) {
      entry(buildId).mapAssets = run;
    }
  }

  return [...byBuild.values()]
    .sort((a, b) => b.buildId - a.buildId)
    .map((build) => {
      const gamedataStatus = gamedataRunStatus(
        build.gamedata,
        now.value.getTime(),
      );
      const mapAssetsStatus = mapAssetsRunStatus(
        build.mapAssets,
        now.value.getTime(),
      );
      const activity = [
        build.gamedata?.validated_at,
        build.gamedata?.started_at,
        build.mapAssets?.finished_at,
        build.mapAssets?.started_at,
        build.version?.updated_at,
      ].filter(Boolean) as Array<string>;
      return {
        ...build,
        current: build.buildId === current.value?.build_id,
        gamedataStatus,
        mapAssetsStatus,
        gamedataTone: TONE_BY_GAMEDATA_STATUS[gamedataStatus],
        mapAssetsTone: TONE_BY_MAP_ASSETS_STATUS[mapAssetsStatus],
        tone: worseTone(
          TONE_BY_GAMEDATA_STATUS[gamedataStatus],
          TONE_BY_MAP_ASSETS_STATUS[mapAssetsStatus],
        ),
        lastActivity: activity.sort().at(-1) ?? null,
      };
    });
});

const selectedBuildId = computed<number | null>(() => {
  const requested = Number(route.query.build);
  if (Number.isFinite(requested) && requested > 0) {
    return requested;
  }
  return builds.value[0]?.buildId ?? null;
});

const selected = computed(
  () =>
    builds.value.find((build) => build.buildId === selectedBuildId.value) ??
    null,
);

const selectedIsCurrent = computed(
  () => !!current.value && selectedBuildId.value === current.value.build_id,
);

const canRun = computed(() => isTestInstance.value && selectedIsCurrent.value);

const { gamedata, mapAssets } = useCs2BuildRuns(selectedBuildId);
const { nodes } = useCs2BuildNodes(canRun);

const previousBuild = computed(
  () =>
    gamedata.value?.previous_build_id ??
    (mapAssets.value?.previous_build_id
      ? Number(mapAssets.value.previous_build_id)
      : null),
);

const timeline = computed(() => {
  const build = selected.value;
  return [
    {
      key: "detected",
      date: build?.version?.updated_at ?? null,
      tone: "warning" as Cs2BuildTone,
      detail: build?.version?.version ?? null,
    },
    {
      key: "gamedata",
      date: gamedata.value?.validated_at ?? gamedata.value?.started_at ?? null,
      tone: build?.gamedataTone ?? ("idle" as Cs2BuildTone),
      status: build
        ? `pages.game_server_nodes.cs2_build.gamedata_status.${build.gamedataStatus}`
        : null,
    },
    {
      key: "map_assets",
      date: mapAssets.value?.finished_at ?? mapAssets.value?.started_at ?? null,
      tone: build?.mapAssetsTone ?? ("idle" as Cs2BuildTone),
      status: build
        ? `pages.game_server_nodes.cs2_build.map_assets_status.${build.mapAssetsStatus}`
        : null,
    },
  ];
});

function select(buildId: number) {
  void router.replace({ query: { ...route.query, build: String(buildId) } });
}

// The rail's indicator: an amber bar on its hairline that glides to the
// picked build (RegionList's), jumping on first placement and on resize.
const railRef = ref<HTMLElement | null>(null);
const indicatorY = ref(0);
const indicatorHeight = ref(0);
const indicatorShown = ref(false);
const indicatorGlides = ref(false);

async function placeIndicator(glide: boolean) {
  const active = railRef.value?.querySelector<HTMLElement>(
    "[aria-current='true']",
  );
  if (!active) {
    indicatorShown.value = false;
    indicatorGlides.value = false;
    return;
  }
  if (!glide || !indicatorShown.value) {
    indicatorGlides.value = false;
  }
  indicatorY.value = active.offsetTop;
  indicatorHeight.value = active.offsetHeight;
  indicatorShown.value = true;
  if (indicatorGlides.value) {
    return;
  }
  await nextTick();
  indicatorGlides.value = true;
}

const buildsKey = computed(() =>
  builds.value.map((build) => build.buildId).join("|"),
);
watch(selectedBuildId, () => nextTick(() => placeIndicator(true)));
watch(buildsKey, () => nextTick(() => placeIndicator(false)));
const jumpIndicator = () => placeIndicator(false);

const SUBSCRIPTIONS = [
  {
    key: "cs2-builds:versions",
    query: CS2_BUILD_VERSIONS_SUBSCRIPTION,
    next: (data: any) => {
      versions.value = data?.game_versions ?? [];
    },
  },
  {
    key: "cs2-builds:gamedata",
    query: CS2_BUILD_GAMEDATA_HISTORY_SUBSCRIPTION,
    next: (data: any) => {
      gamedataRuns.value = data?.gamedata_signature_validations ?? [];
      loaded.value = true;
    },
  },
  {
    key: "cs2-builds:map-assets",
    query: CS2_BUILD_MAP_ASSETS_HISTORY_SUBSCRIPTION,
    next: (data: any) => {
      mapAssetRuns.value = data?.map_asset_builds ?? [];
    },
  },
];

onMounted(() => {
  window.addEventListener("resize", jumpIndicator);
  const { subscribe } = useSubscriptionManager();
  for (const { key, query, next } of SUBSCRIPTIONS) {
    subscribe(
      key,
      getGraphqlClient()
        .subscribe({ query, context: CS2_BUILD_OPTIONAL })
        .subscribe({
          next: ({ data }) => next(data),
          error: () => {
            loaded.value = true;
          },
        }),
    );
  }
});

onUnmounted(() => {
  window.removeEventListener("resize", jumpIndicator);
  const { unsubscribe } = useSubscriptionManager();
  for (const { key } of SUBSCRIPTIONS) {
    unsubscribe(key);
  }
});
</script>

<template>
  <h1 class="sr-only">{{ $t("pages.game_server_nodes.cs2_build.history") }}</h1>

  <PageTransition :delay="0">
    <div class="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-0">
      <div class="grid min-w-0 content-start gap-3">
        <div :class="[tacticalSectionLabelClasses, 'mb-0']">
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("pages.game_server_nodes.builds.builds") }}
        </div>

        <div v-if="!loaded" class="grid gap-1 lg:pr-2">
          <Skeleton
            v-for="i in 4"
            :key="i"
            class="h-[58px] w-full rounded-md"
          />
        </div>

        <SectionEmpty
          v-else-if="!builds.length"
          class="min-h-[160px] lg:mr-2"
          :title="$t('pages.game_server_nodes.builds.empty_title')"
          :description="$t('pages.game_server_nodes.builds.no_builds')"
        />

        <template v-else>
          <nav
            ref="railRef"
            :aria-label="$t('pages.game_server_nodes.builds.builds')"
            class="relative flex min-w-0 flex-col gap-0.5 max-lg:max-h-72 max-lg:overflow-y-auto lg:border-r lg:border-border/70 lg:pr-2"
          >
            <div
              class="pointer-events-none absolute right-[-1px] top-0 z-10 hidden w-0.5 rounded-full bg-[hsl(var(--tac-amber))] transition-opacity duration-150 motion-reduce:transition-none lg:block"
              :class="[
                indicatorShown ? 'opacity-100' : 'opacity-0',
                indicatorGlides &&
                  '[transition-duration:240ms] [transition-property:transform,height,opacity] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]',
              ]"
              :style="{
                transform: `translateY(${indicatorY}px)`,
                height: `${indicatorHeight}px`,
              }"
            />
            <button
              v-for="build of builds"
              :key="build.buildId"
              type="button"
              :aria-current="selectedBuildId === build.buildId"
              class="relative z-[1] grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2.5 rounded-md px-3 py-2 text-left transition-colors duration-150"
              :class="
                selectedBuildId === build.buildId
                  ? 'bg-[hsl(var(--tac-amber)/0.06)] text-foreground hover:bg-[hsl(var(--tac-amber)/0.08)]'
                  : 'text-muted-foreground hover:bg-[hsl(var(--tac-amber)/0.08)] hover:text-foreground'
              "
              @click="select(build.buildId)"
            >
              <span class="relative mt-[0.4rem] flex size-2 shrink-0">
                <span
                  v-if="build.tone === 'running'"
                  class="absolute inset-0 animate-ping rounded-full opacity-75 motion-reduce:hidden"
                  :class="DOT_TONES[build.tone]"
                />
                <span
                  class="relative size-2 rounded-full"
                  :class="DOT_TONES[build.tone]"
                />
              </span>
              <span class="grid min-w-0 gap-0.5">
                <span class="flex min-w-0 items-baseline gap-1.5">
                  <span
                    v-if="build.version?.version"
                    class="truncate text-[13px] font-medium"
                    >{{ build.version.version }}</span
                  >
                  <span
                    class="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground"
                    >{{ build.buildId }}</span
                  >
                </span>
                <span
                  class="flex min-w-0 flex-wrap gap-x-2 text-[11.5px] text-muted-foreground/80"
                >
                  <span class="whitespace-nowrap">
                    {{ $t("pages.game_server_nodes.cs2_build.gamedata") }}
                    <span :class="TEXT_TONES[build.gamedataTone]">{{
                      $t(
                        `pages.game_server_nodes.cs2_build.gamedata_status.${build.gamedataStatus}`,
                      )
                    }}</span>
                  </span>
                  <span class="whitespace-nowrap">
                    {{ $t("pages.game_server_nodes.cs2_build.map_assets") }}
                    <span :class="TEXT_TONES[build.mapAssetsTone]">{{
                      $t(
                        `pages.game_server_nodes.cs2_build.map_assets_status.${build.mapAssetsStatus}`,
                      )
                    }}</span>
                  </span>
                </span>
              </span>
              <span class="grid justify-items-end gap-1">
                <span
                  v-if="build.current"
                  class="rounded-md bg-[hsl(var(--tac-amber)/0.12)] px-1.5 py-px text-[11px] font-medium text-[hsl(var(--tac-amber))]"
                >
                  {{ $t("pages.game_server_nodes.builds.current") }}
                </span>
                <span
                  v-if="build.lastActivity"
                  class="whitespace-nowrap text-[11px] tabular-nums text-muted-foreground/70"
                >
                  <TimeAgo :date="build.lastActivity" hide-icon />
                </span>
              </span>
            </button>
          </nav>
          <p
            class="px-3 text-[11.5px] leading-snug text-muted-foreground/70 lg:pr-5"
          >
            {{ $t("pages.game_server_nodes.builds.history_note") }}
          </p>
        </template>
      </div>

      <div v-if="selectedBuildId" class="build-swap min-w-0 lg:pl-6">
        <Transition name="build-swap" mode="out-in">
          <div :key="selectedBuildId" class="grid min-w-0 gap-4">
            <div class="grid gap-1">
              <div class="flex min-w-0 flex-wrap items-center gap-2">
                <h2
                  v-if="selected?.version?.version"
                  class="text-xl font-semibold leading-tight tracking-tight"
                >
                  {{ selected.version.version }}
                </h2>
                <span
                  class="inline-flex h-5 items-center rounded-md border border-border bg-muted/40 px-1.5 font-mono text-xs tabular-nums text-muted-foreground"
                >
                  {{ selectedBuildId }}
                </span>
                <span
                  v-if="selectedIsCurrent"
                  class="rounded-md bg-[hsl(var(--tac-amber)/0.12)] px-1.5 py-px text-[11px] font-medium text-[hsl(var(--tac-amber))]"
                >
                  {{ $t("pages.game_server_nodes.builds.current") }}
                </span>
              </div>
              <span v-if="previousBuild" class="text-xs text-muted-foreground">
                <i18n-t keypath="pages.game_server_nodes.builds.compared_with">
                  <template #build>
                    <NuxtLink
                      :to="{
                        query: { ...route.query, build: String(previousBuild) },
                      }"
                      class="font-mono tabular-nums underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground"
                    >
                      {{ previousBuild }}
                    </NuxtLink>
                  </template>
                </i18n-t>
              </span>
            </div>

            <ol
              class="grid gap-3 border-y border-border/60 py-3 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border/60"
            >
              <li
                v-for="step of timeline"
                :key="step.key"
                class="grid content-start gap-0.5 sm:px-4 sm:first:pl-0"
              >
                <span
                  class="inline-flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <span
                    class="size-2 shrink-0 rounded-full"
                    :class="DOT_TONES[step.tone]"
                  />
                  {{
                    $t(`pages.game_server_nodes.builds.timeline.${step.key}`)
                  }}
                </span>
                <span class="text-sm font-semibold tabular-nums">
                  <TimeAgo v-if="step.date" :date="step.date" hide-icon />
                  <template v-else>{{ $t("common.na") }}</template>
                </span>
                <span
                  v-if="step.status || step.detail"
                  class="text-xs"
                  :class="
                    step.status
                      ? TEXT_TONES[step.tone]
                      : 'text-muted-foreground'
                  "
                >
                  {{ step.status ? $t(step.status) : step.detail }}
                </span>
              </li>
            </ol>

            <div
              class="grid divide-y divide-border/60 border-b border-border/60 xl:grid-cols-2 xl:divide-x xl:divide-y-0"
            >
              <Cs2GamedataPanel
                :build-id="selectedBuildId"
                :row="gamedata"
                :nodes="nodes"
                :can-run="canRun"
                detailed
                list-class="h-[360px]"
              />
              <Cs2MapAssetsPanel
                :build-id="selectedBuildId"
                :row="mapAssets"
                :nodes="nodes"
                :can-run="canRun"
                detailed
                list-class="h-[360px]"
              />
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </PageTransition>
</template>

<style scoped>
.build-swap-enter-active {
  transition:
    opacity 240ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.build-swap-leave-active {
  transition: opacity 110ms ease-in;
}
.build-swap-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.build-swap-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .build-swap-enter-active,
  .build-swap-leave-active {
    transition: none;
  }
}
</style>
