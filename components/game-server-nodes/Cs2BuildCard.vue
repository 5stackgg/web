<script setup lang="ts">
import { computed, ref } from "vue";
import { useNow } from "@vueuse/core";
import { ChevronDown, History } from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { Button } from "~/components/ui/button";
import { Fold } from "~/components/ui/transitions";
import StatusDot from "~/components/admin/StatusDot.vue";
import type { Tone } from "~/components/admin/tone";
import Cs2BuildVersion from "~/components/game-server-nodes/Cs2BuildVersion.vue";
import Cs2GamedataPanel from "~/components/game-server-nodes/Cs2GamedataPanel.vue";
import Cs2MapAssetsPanel from "~/components/game-server-nodes/Cs2MapAssetsPanel.vue";
import {
  useCs2BuildNodes,
  useCs2BuildRuns,
} from "~/composables/useCs2BuildRuns";
import {
  TONE_BY_GAMEDATA_STATUS,
  TONE_BY_MAP_ASSETS_STATUS,
  gamedataRunStatus,
  mapAssetsRunStatus,
  type Cs2BuildTone,
} from "~/types/cs2Build";
import { tacticalSectionTickClasses } from "~/utilities/tacticalClasses";

const props = defineProps<{
  currentVersion: {
    build_id: number;
    version: string | null;
    updated_at: string | null;
  };
}>();

// Build jobs only run on the public instance (the api refuses elsewhere), so
// everyone else keeps the plain version line.
const isTestInstance = computed(
  () => useRuntimeConfig().public.webDomain === "5stack.gg",
);

const buildId = computed(() =>
  isTestInstance.value ? props.currentVersion.build_id : null,
);

const { gamedata, mapAssets } = useCs2BuildRuns(buildId);
const { nodes } = useCs2BuildNodes(isTestInstance);

const now = useNow({ interval: 60_000 });
const open = ref(false);

// Folded, the card is one line: the worst of the two jobs (the dot pings
// while either is still going), the build, and each job's own state.
const SEVERITY: Array<Cs2BuildTone> = [
  "destructive",
  "warning",
  "running",
  "success",
  "idle",
];

const gamedataStatus = computed(() =>
  gamedataRunStatus(gamedata.value, now.value.getTime()),
);
const mapAssetsStatus = computed(() =>
  mapAssetsRunStatus(mapAssets.value, now.value.getTime()),
);

const tones = computed(() => [
  TONE_BY_GAMEDATA_STATUS[gamedataStatus.value],
  TONE_BY_MAP_ASSETS_STATUS[mapAssetsStatus.value],
]);

const tone = computed(
  () => SEVERITY.find((severity) => tones.value.includes(severity)) ?? "idle",
);

const running = computed(() => tones.value.includes("running"));

const DOT_TONES: Record<Cs2BuildTone, Tone> = {
  success: "ok",
  warning: "warn",
  destructive: "bad",
  running: "info",
  idle: "off",
};

const TEXT_TONES: Record<Cs2BuildTone, string> = {
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  running: "text-info",
  idle: "text-muted-foreground",
};
</script>

<template>
  <section
    class="rounded-md border bg-card/40 [backdrop-filter:blur(6px)] transition-colors duration-300"
    :class="
      isTestInstance && tone === 'destructive'
        ? 'border-destructive/40'
        : 'border-border'
    "
    :aria-label="$t('pages.game_server_nodes.cs2_build.title')"
  >
    <div
      v-if="!isTestInstance"
      class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs"
    >
      <span
        class="inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.16em] text-muted-foreground"
      >
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("pages.game_server_nodes.cs2_build.title") }}
      </span>
      <Cs2BuildVersion :current-version="currentVersion" />
    </div>

    <template v-else>
      <div class="flex items-center gap-1 p-1">
        <button
          type="button"
          class="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 rounded px-2.5 py-1.5 text-left text-xs transition-colors duration-150 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          :aria-expanded="open"
          aria-controls="cs2-build-details"
          @click="open = !open"
        >
          <span
            class="inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.16em] text-muted-foreground"
          >
            <span :class="tacticalSectionTickClasses"></span>
            {{ $t("pages.game_server_nodes.cs2_build.title") }}
          </span>
          <span class="inline-flex items-center gap-2">
            <StatusDot :tone="DOT_TONES[tone]" :live="running" size="sm" />
            <span class="font-semibold" :class="TEXT_TONES[tone]">
              {{
                $t(`pages.game_server_nodes.cs2_build.summary.status.${tone}`)
              }}
            </span>
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span v-if="currentVersion.version" class="font-semibold">{{
              currentVersion.version
            }}</span>
            <code class="font-mono text-muted-foreground">{{
              currentVersion.build_id
            }}</code>
          </span>
          <span class="inline-flex items-center gap-1.5 text-muted-foreground">
            {{ $t("pages.game_server_nodes.cs2_build.gamedata") }}
            <span class="font-semibold" :class="TEXT_TONES[tones[0]]">{{
              $t(
                `pages.game_server_nodes.cs2_build.gamedata_status.${gamedataStatus}`,
              )
            }}</span>
          </span>
          <span class="inline-flex items-center gap-1.5 text-muted-foreground">
            {{ $t("pages.game_server_nodes.cs2_build.map_assets") }}
            <span class="font-semibold" :class="TEXT_TONES[tones[1]]">{{
              $t(
                `pages.game_server_nodes.cs2_build.map_assets_status.${mapAssetsStatus}`,
              )
            }}</span>
          </span>
          <ChevronDown
            class="build-chev ml-auto h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </button>

        <FiveStackToolTip as-child :tap-toggle="false">
          <template #trigger>
            <Button
              as-child
              variant="ghost"
              size="icon-sm"
              class="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <NuxtLink
                :to="{
                  path: '/game-server-nodes/builds',
                  query: { build: String(currentVersion.build_id) },
                }"
                :aria-label="$t('pages.game_server_nodes.cs2_build.history')"
              >
                <History />
              </NuxtLink>
            </Button>
          </template>
          {{ $t("pages.game_server_nodes.cs2_build.history") }}
        </FiveStackToolTip>
      </div>

      <Fold :open="open">
        <div id="cs2-build-details" class="border-t border-border">
          <Cs2BuildVersion
            :current-version="currentVersion"
            class="border-b border-border px-3 py-2"
          />
          <div
            class="grid divide-y divide-border lg:grid-cols-2 lg:divide-x lg:divide-y-0"
          >
            <Cs2GamedataPanel
              :build-id="currentVersion.build_id"
              :row="gamedata"
              :nodes="nodes"
              can-run
            />
            <Cs2MapAssetsPanel
              :build-id="currentVersion.build_id"
              :row="mapAssets"
              :nodes="nodes"
              can-run
            />
          </div>
        </div>
      </Fold>
    </template>
  </section>
</template>

<style scoped>
.build-chev {
  transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
[aria-expanded="true"] > .build-chev {
  transform: rotate(180deg);
}
@media (prefers-reduced-motion: reduce) {
  .build-chev {
    transition: none;
  }
}
</style>
