<template>
  <!-- No h-full. Grid and flex parents already stretch a readout to its own
       row, and `height: 100%` measures the whole container instead: in a
       flex-wrap row it resolves to every line's height, so a readout on the
       second line runs a full line past the bottom of the card and drops its
       value into whatever section follows. -->
  <div class="flex min-w-0 flex-col">
    <!-- flex-1, not a min-height: these sit in a row and their labels wrap to
         different line counts, so the label takes the slack and every value
         starts at the same baseline no matter how many lines it took. -->
    <div
      class="flex flex-1 items-start gap-1 text-xs leading-snug text-muted-foreground"
    >
      <span>{{ label }}</span>
      <FiveStackToolTip v-if="hint" class="mt-[0.2em] shrink-0">
        <span class="block max-w-[18rem]">{{ hint }}</span>
      </FiveStackToolTip>
    </div>

    <!-- Proportional figures, not tabular: these do not sit in a column, and
         equal-width digits make a short number look gappy at this size. -->
    <div
      class="mt-1 flex items-center gap-2 font-bold leading-none"
      :class="[
        large ? 'text-3xl' : 'text-xl',
        unavailable ? 'text-muted-foreground' : 'text-foreground',
      ]"
    >
      <!-- Reporting within the hour is a state, not something happening
           this second: a still dot. -->
      <StatusDot
        v-if="live && !unavailable && value > 0"
        tone="ok"
        :label="$t('pages.system_telemetry.installs.live')"
      />
      <template v-if="unavailable">—</template>
      <FleetCount v-else :value="value" />
    </div>

    <div v-if="caption" class="mt-1 text-[0.72rem] text-muted-foreground/80">
      {{ caption }}
    </div>
  </div>
</template>

<script setup lang="ts">
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import StatusDot from "~/components/admin/StatusDot.vue";
import FleetCount from "./FleetCount.vue";

withDefaults(
  defineProps<{
    label: string;
    value?: number;
    caption?: string;
    hint?: string;
    live?: boolean;
    large?: boolean;
    unavailable?: boolean;
  }>(),
  {
    value: 0,
    caption: "",
    hint: "",
    live: false,
    large: false,
    unavailable: false,
  },
);
</script>
