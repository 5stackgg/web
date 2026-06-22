<script lang="ts" setup>
import { computed } from "vue";
import { Radar } from "lucide-vue-next";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";

const myDraftGame = computed(() => useDraftGamesStore().myDraftGame);

const accepted = computed(
  () =>
    (myDraftGame.value?.players || []).filter(
      (p: any) => p.status === "Accepted",
    ).length,
);
</script>

<template>
  <NuxtLink
    v-if="myDraftGame"
    :to="`/draft-room/${myDraftGame.id}`"
    :title="$t('draft_games.room.current_draft')"
    class="group/draft relative inline-flex h-12 items-center gap-2.5 rounded-md border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.08)] px-3 no-underline transition-colors hover:bg-[hsl(var(--tac-amber)/0.16)]"
  >
    <span class="relative grid place-items-center">
      <Radar class="h-5 w-5 text-[hsl(var(--tac-amber))]" />
      <span
        class="absolute -inset-1 rounded-full border border-[hsl(var(--tac-amber)/0.4)] opacity-70 [animation:draftnav-pulse_1.8s_ease-out_infinite]"
        aria-hidden="true"
      ></span>
    </span>
    <span class="hidden flex-col leading-tight sm:flex">
      <span
        class="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-[hsl(var(--tac-amber))]"
      >
        {{ $t("draft_games.nav_label") }}
      </span>
      <span class="font-mono text-xs font-bold tabular-nums text-foreground">
        {{ accepted }}/{{ myDraftGame.capacity }}
      </span>
    </span>
  </NuxtLink>
</template>

<style scoped>
@keyframes draftnav-pulse {
  0% {
    transform: scale(0.85);
    opacity: 0.7;
  }
  100% {
    transform: scale(1.25);
    opacity: 0;
  }
}
</style>
