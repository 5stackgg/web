<script setup lang="ts">
import TimeAgo from "~/components/TimeAgo.vue";
import ClipBoard from "~/components/ClipBoard.vue";

defineProps<{
  currentVersion: {
    build_id: number;
    version: string | null;
    updated_at: string | null;
  };
}>();
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
    <span v-if="currentVersion.version" class="font-semibold text-foreground">
      {{ currentVersion.version }}
    </span>
    <span class="inline-flex items-center gap-1">
      <code
        class="inline-flex h-6 select-all items-center rounded border border-border bg-muted/30 px-1.5 font-mono text-foreground/80"
      >
        {{ currentVersion.build_id }}
      </code>
      <ClipBoard
        :data="String(currentVersion.build_id)"
        class="h-6 w-6 [&_svg]:size-3.5"
      />
    </span>
    <span
      v-if="currentVersion.updated_at"
      class="inline-flex items-center gap-1 text-muted-foreground"
    >
      {{ $t("pages.game_server_nodes.cs2_build.released") }}
      <TimeAgo :date="currentVersion.updated_at" hide-icon />
    </span>
  </div>
</template>
