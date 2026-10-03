<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { clipKillTier } from "~/utilities/clipDisplay";

const props = withDefaults(
  defineProps<{
    kills: number | null | undefined;
    round: number | null | undefined;
    size?: "sm" | "lg";
  }>(),
  { size: "sm" },
);

const { t } = useI18n();
const tier = computed(() =>
  clipKillTier(
    { kills_count: props.kills ?? null, round: props.round ?? null },
    t,
  ),
);
const isAce = computed(() => tier.value?.marks && tier.value.filled === 5);
</script>

<template>
  <!-- Same height as the tile's corner chips at each size, so the corners
       line up; the label is trimmed to cap height to sit optically centred. -->
  <span
    v-if="tier"
    class="inline-flex shrink-0 items-center rounded-md bg-black/60 backdrop-blur-sm"
    :class="
      size === 'lg'
        ? 'h-[30px] gap-1 px-2.5 sm:h-9 sm:px-3'
        : 'h-[26px] gap-[3px] px-[9px]'
    "
  >
    <template v-if="tier.marks">
      <span
        v-for="i in 5"
        :key="i"
        aria-hidden="true"
        class="block -skew-x-[16deg]"
        :class="[
          size === 'lg'
            ? 'h-4 w-1.5 rounded-[1.5px] sm:h-5 sm:w-[7px]'
            : 'h-3.5 w-[5px] rounded-[1px]',
          i <= tier.filled ? 'bg-[hsl(var(--tac-amber))]' : 'bg-white/20',
        ]"
      />
    </template>
    <span
      class="clip-cap-trim whitespace-nowrap font-extrabold tracking-[0.01em]"
      :class="[
        size === 'lg' ? 'text-base sm:text-[19px]' : 'text-[13px]',
        tier.marks ? (size === 'lg' ? 'ml-2 sm:ml-[9px]' : 'ml-[7px]') : '',
        isAce ? 'text-[hsl(var(--tac-amber))]' : 'text-white',
      ]"
    >
      {{ tier.label }}
    </span>
  </span>
</template>

<style scoped>
.clip-cap-trim {
  display: block;
  line-height: 1;
  text-box: trim-both cap alphabetic;
}

@supports not (text-box: trim-both cap alphabetic) {
  .clip-cap-trim {
    padding-top: 0.11em;
  }
}
</style>
