<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useNow } from "@vueuse/core";
import { ArrowLeft } from "lucide-vue-next";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
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

definePageMeta({
  middleware: "admin",
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
  () =>
    !!current.value && selectedBuildId.value === current.value.build_id,
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
      date:
        gamedata.value?.validated_at ?? gamedata.value?.started_at ?? null,
      tone: build?.gamedataTone ?? ("idle" as Cs2BuildTone),
      status: build
        ? `pages.game_server_nodes.cs2_build.gamedata_status.${build.gamedataStatus}`
        : null,
    },
    {
      key: "map_assets",
      date:
        mapAssets.value?.finished_at ?? mapAssets.value?.started_at ?? null,
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
  const { subscribe } = useSubscriptionManager();
  for (const { key, query, next } of SUBSCRIPTIONS) {
    subscribe(
      key,
      getGraphqlClient()
        .subscribe({ query, context: CS2_BUILD_OPTIONAL })
        .subscribe({ next: ({ data }) => next(data) }),
    );
  }
});

onUnmounted(() => {
  const { unsubscribe } = useSubscriptionManager();
  for (const { key } of SUBSCRIPTIONS) {
    unsubscribe(key);
  }
});
</script>

<template>
  <PageTransition :delay="0">
    <TacticalPageHeader inline-actions>
      <template #title>{{
        $t("pages.game_server_nodes.builds.title")
      }}</template>
      <template #subtitle>{{
        $t("pages.game_server_nodes.builds.description")
      }}</template>
      <template #actions>
        <NuxtLink
          to="/game-server-nodes"
          class="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft class="h-4 w-4" />
          {{ $t("pages.game_server_nodes.builds.back") }}
        </NuxtLink>
      </template>
    </TacticalPageHeader>
  </PageTransition>

  <PageTransition :delay="100" class="mt-6">
    <div class="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div class="flex flex-col gap-2">
        <span
          class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.game_server_nodes.builds.builds") }}
        </span>

        <template v-if="!loaded">
          <Skeleton v-for="i in 4" :key="i" class="h-20 w-full rounded-md" />
        </template>

        <p v-else-if="!builds.length" class="text-xs text-muted-foreground">
          {{ $t("pages.game_server_nodes.builds.no_builds") }}
        </p>

        <template v-else>
          <button
            v-for="build of builds"
            :key="build.buildId"
            type="button"
            class="flex flex-col gap-1.5 rounded-md border p-3 text-left transition-colors"
            :class="
              selectedBuildId === build.buildId
                ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.08)]'
                : 'border-border hover:border-[hsl(var(--tac-amber)/0.35)]'
            "
            @click="select(build.buildId)"
          >
            <span class="flex w-full items-center gap-2">
              <span v-if="build.version?.version" class="text-sm font-semibold">
                {{ build.version.version }}
              </span>
              <span class="font-mono text-xs text-foreground/80">
                {{ build.buildId }}
              </span>
              <span
                v-if="build.current"
                class="ml-auto rounded bg-[hsl(var(--tac-amber)/0.12)] px-1.5 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))]"
              >
                {{ $t("pages.game_server_nodes.builds.current") }}
              </span>
            </span>
            <span
              v-if="build.lastActivity"
              class="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
            >
              <TimeAgo :date="build.lastActivity" hide-icon />
            </span>
            <span class="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
              <span class="inline-flex items-center gap-1.5 text-muted-foreground">
                {{ $t("pages.game_server_nodes.cs2_build.gamedata") }}
                <span
                  class="inline-block h-1.5 w-1.5 rotate-45"
                  :class="DOT_TONES[build.gamedataTone]"
                />
                <span :class="TEXT_TONES[build.gamedataTone]">
                  {{
                    $t(
                      `pages.game_server_nodes.cs2_build.gamedata_status.${build.gamedataStatus}`,
                    )
                  }}
                </span>
              </span>
              <span class="inline-flex items-center gap-1.5 text-muted-foreground">
                {{ $t("pages.game_server_nodes.cs2_build.map_assets") }}
                <span
                  class="inline-block h-1.5 w-1.5 rotate-45"
                  :class="DOT_TONES[build.mapAssetsTone]"
                />
                <span :class="TEXT_TONES[build.mapAssetsTone]">
                  {{
                    $t(
                      `pages.game_server_nodes.cs2_build.map_assets_status.${build.mapAssetsStatus}`,
                    )
                  }}
                </span>
              </span>
            </span>
          </button>
          <p class="px-1 text-[0.7rem] leading-snug text-muted-foreground">
            {{ $t("pages.game_server_nodes.builds.history_note") }}
          </p>
        </template>
      </div>

      <div
        v-if="selectedBuildId"
        class="flex min-w-0 flex-col rounded-md border border-border bg-card/40 [backdrop-filter:blur(6px)]"
      >
        <div class="flex flex-col gap-1 border-b border-border px-4 py-3">
          <div class="flex flex-wrap items-center gap-2">
            <span
              v-if="selected?.version?.version"
              class="text-xl font-semibold"
            >
              {{ selected.version.version }}
            </span>
            <span
              class="rounded border border-border bg-muted/30 px-1.5 font-mono text-sm text-foreground/80"
            >
              {{ selectedBuildId }}
            </span>
            <span
              v-if="selectedIsCurrent"
              class="rounded bg-[hsl(var(--tac-amber)/0.12)] px-1.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))]"
            >
              {{ $t("pages.game_server_nodes.builds.current") }}
            </span>
          </div>
          <span v-if="previousBuild" class="text-xs text-muted-foreground">
            <i18n-t keypath="pages.game_server_nodes.builds.compared_with">
              <template #build>
                <NuxtLink
                  :to="{ query: { ...route.query, build: String(previousBuild) } }"
                  class="font-mono underline-offset-2 hover:text-foreground hover:underline"
                >
                  {{ previousBuild }}
                </NuxtLink>
              </template>
            </i18n-t>
          </span>
        </div>

        <div
          class="grid gap-3 border-b border-border px-4 py-3 sm:grid-cols-3"
        >
          <div
            v-for="step of timeline"
            :key="step.key"
            class="flex flex-col gap-0.5"
          >
            <span
              class="inline-flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
            >
              <span
                class="inline-block h-2 w-2 rotate-45"
                :class="DOT_TONES[step.tone]"
              />
              {{ $t(`pages.game_server_nodes.builds.timeline.${step.key}`) }}
            </span>
            <span class="text-sm font-semibold">
              <TimeAgo v-if="step.date" :date="step.date" hide-icon />
              <template v-else>{{ $t("common.na") }}</template>
            </span>
            <span
              v-if="step.status || step.detail"
              class="text-xs text-muted-foreground"
            >
              {{ step.status ? $t(step.status) : step.detail }}
            </span>
          </div>
        </div>

        <div
          class="grid divide-y divide-border xl:grid-cols-2 xl:divide-x xl:divide-y-0"
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
    </div>
  </PageTransition>
</template>
