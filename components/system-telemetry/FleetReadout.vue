<template>
  <div class="flex h-full flex-col">
    <!-- flex-1, not a min-height: these sit in a row and their labels wrap to
         different line counts, so the label takes the slack and every value
         starts at the same baseline no matter how many lines it took. -->
    <div
      class="flex flex-1 items-start gap-1 font-sans text-[0.6rem] uppercase leading-[1.35] tracking-[0.18em] text-muted-foreground"
    >
      <span
        v-if="live"
        class="relative mt-[0.3em] flex h-1.5 w-1.5 shrink-0"
        :title="$t('pages.system_telemetry.installs.live')"
      >
        <span
          class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--tac-amber))] opacity-60"
        />
        <span
          class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(var(--tac-amber))]"
        />
      </span>
      <span>{{ label }}</span>
      <FiveStackToolTip v-if="hint">{{ hint }}</FiveStackToolTip>
    </div>

    <!-- Proportional figures, not tabular: these do not sit in a column, and
         equal-width digits make a short number look gappy at this size. -->
    <div
      class="mt-1 font-semibold leading-none"
      :class="[
        large ? 'text-2xl' : 'text-xl',
        unavailable
          ? 'text-muted-foreground'
          : live
            ? 'text-[hsl(var(--tac-amber))]'
            : '',
      ]"
    >
      {{ unavailable ? "—" : format(value) }}
    </div>

    <div v-if="caption" class="mt-1 text-[0.68rem] text-muted-foreground">
      {{ caption }}
    </div>
  </div>
</template>

<script setup lang="ts">
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
</script>

<script lang="ts">
export default {
  props: {
    label: { type: String, required: true },
    value: { type: Number, default: 0 },
    caption: { type: String, default: "" },
    hint: { type: String, default: "" },
    live: { type: Boolean, default: false },
    large: { type: Boolean, default: false },
    unavailable: { type: Boolean, default: false },
  },
  methods: {
    format(value: number) {
      return (value ?? 0).toLocaleString();
    },
  },
};
</script>
