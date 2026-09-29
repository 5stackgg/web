<script setup lang="ts">
import { computed } from "vue";
import { ArrowRight } from "lucide-vue-next";
import TimeAgo from "~/components/TimeAgo.vue";
import Cs2GamedataPanel from "~/components/game-server-nodes/Cs2GamedataPanel.vue";
import Cs2MapAssetsPanel from "~/components/game-server-nodes/Cs2MapAssetsPanel.vue";
import {
  useCs2BuildNodes,
  useCs2BuildRuns,
} from "~/composables/useCs2BuildRuns";
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
</script>

<template>
  <section
    class="rounded-md border border-border bg-card/40 [backdrop-filter:blur(6px)]"
    :aria-label="$t('pages.game_server_nodes.cs2_build.title')"
  >
    <div
      class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs"
      :class="{ 'border-b border-border': isTestInstance }"
    >
      <span
        class="inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.16em] text-muted-foreground"
      >
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("pages.game_server_nodes.cs2_build.title") }}
      </span>
      <span class="font-semibold text-foreground">
        {{ currentVersion.version }}
      </span>
      <span
        class="rounded border border-border bg-muted/30 px-1.5 font-mono text-foreground/80"
      >
        {{ currentVersion.build_id }}
      </span>
      <span
        v-if="currentVersion.updated_at"
        class="inline-flex items-center gap-1 text-muted-foreground"
      >
        {{ $t("pages.game_server_nodes.cs2_build.released") }}
        <TimeAgo :date="currentVersion.updated_at" hide-icon />
      </span>
      <NuxtLink
        v-if="isTestInstance"
        :to="{
          path: '/game-server-nodes/builds',
          query: { build: String(currentVersion.build_id) },
        }"
        class="ml-auto inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        {{ $t("pages.game_server_nodes.cs2_build.history") }}
        <ArrowRight class="h-3.5 w-3.5" />
      </NuxtLink>
    </div>

    <div
      v-if="isTestInstance"
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
  </section>
</template>
