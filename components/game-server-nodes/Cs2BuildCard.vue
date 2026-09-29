<script setup lang="ts">
import { computed, ref } from "vue";
import { useNow } from "@vueuse/core";
import { ChevronDown, History } from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { Button } from "~/components/ui/button";
import { Fold } from "~/components/ui/transitions";
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

// Folded, the card reads as one status: the worst of the two jobs, with the
// dot pinging while either is still going.
const SEVERITY: Array<Cs2BuildTone> = [
  "destructive",
  "warning",
  "running",
  "success",
  "idle",
];

const tones = computed(() => [
  TONE_BY_GAMEDATA_STATUS[
    gamedataRunStatus(gamedata.value, now.value.getTime())
  ],
  TONE_BY_MAP_ASSETS_STATUS[
    mapAssetsRunStatus(mapAssets.value, now.value.getTime())
  ],
]);

const tone = computed(
  () => SEVERITY.find((severity) => tones.value.includes(severity)) ?? "idle",
);

const running = computed(() => tones.value.includes("running"));

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
</script>

<template>
  <section
    class="rounded-md border border-border bg-card/40 [backdrop-filter:blur(6px)]"
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
      <div class="relative">
        <button
          type="button"
          class="absolute inset-0 transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          :class="open ? 'rounded-t-md' : 'rounded-md'"
          :aria-expanded="open"
          aria-controls="cs2-build-details"
          :aria-label="$t('pages.game_server_nodes.cs2_build.summary.expand')"
          @click="open = !open"
        />

        <div
          class="pointer-events-none relative flex items-center gap-3 px-3 py-1.5 text-xs"
        >
          <span
            class="inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.16em] text-muted-foreground"
          >
            <span :class="tacticalSectionTickClasses"></span>
            {{ $t("pages.game_server_nodes.cs2_build.title") }}
          </span>
          <span class="inline-flex items-center gap-2">
            <span class="relative flex h-1.5 w-1.5 shrink-0">
              <span
                v-if="running"
                class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                :class="DOT_TONES[tone]"
              />
              <span
                class="relative inline-flex h-1.5 w-1.5 rounded-full"
                :class="DOT_TONES[tone]"
              />
            </span>
            <span class="font-semibold" :class="TEXT_TONES[tone]">
              {{
                $t(`pages.game_server_nodes.cs2_build.summary.status.${tone}`)
              }}
            </span>
          </span>

          <span class="ml-auto inline-flex items-center gap-1">
            <FiveStackToolTip as-child :tap-toggle="false">
              <template #trigger>
                <Button
                  as-child
                  variant="ghost"
                  size="icon-sm"
                  class="pointer-events-auto h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  <NuxtLink
                    :to="{
                      path: '/game-server-nodes/builds',
                      query: { build: String(currentVersion.build_id) },
                    }"
                    :aria-label="
                      $t('pages.game_server_nodes.cs2_build.history')
                    "
                  >
                    <History />
                  </NuxtLink>
                </Button>
              </template>
              {{ $t("pages.game_server_nodes.cs2_build.history") }}
            </FiveStackToolTip>
            <ChevronDown
              class="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
              :class="{ 'rotate-180': open }"
              aria-hidden="true"
            />
          </span>
        </div>
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
