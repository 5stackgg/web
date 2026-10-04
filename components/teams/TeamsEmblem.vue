<script setup lang="ts">
import { computed } from "vue";
import teamAvatar from "~/utilities/teamAvatar";
import { teamMonogram } from "~/components/watch/watchTicker";

const props = withDefaults(
  defineProps<{
    team: {
      name?: string | null;
      short_name?: string | null;
      avatar_url?: string | null;
    } | null;
    size?: number;
  }>(),
  { size: 40 },
);

const src = computed(() => teamAvatar(props.team));
const monogram = computed(() =>
  teamMonogram(props.team?.name ?? "?", props.team?.short_name),
);
</script>

<template>
  <span
    aria-hidden="true"
    class="inline-grid shrink-0 place-items-center overflow-hidden rounded-md border border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.1)] font-bold tracking-[0.06em] text-[hsl(var(--tac-amber))]"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      fontSize: `${Math.round(size * 0.3)}px`,
    }"
  >
    <img
      v-if="src"
      :src="src"
      alt=""
      class="h-full w-full object-cover"
      loading="lazy"
    />
    <template v-else>{{ monogram }}</template>
  </span>
</template>
