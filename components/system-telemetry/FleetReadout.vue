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
        unavailable ? 'text-muted-foreground' : '',
      ]"
    >
      <span
        v-if="live && !unavailable && value > 0"
        class="relative flex h-2 w-2 shrink-0"
        :title="$t('pages.system_telemetry.installs.live')"
      >
        <span
          class="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden"
        />
        <span class="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      {{ unavailable ? "—" : format(shown) }}
    </div>

    <div v-if="caption" class="mt-1 text-[0.72rem] text-muted-foreground/80">
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
  data() {
    return {
      shown: this.value ?? 0,
      frame: 0,
    };
  },
  watch: {
    // A new answer (the minute poll, or the fleet toggle) glides from the old
    // number instead of snapping, so the eye can follow what moved.
    value(to: number) {
      cancelAnimationFrame(this.frame);
      const from = this.shown;
      if (
        from === to ||
        document.hidden ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        this.shown = to ?? 0;
        return;
      }
      const start = performance.now();
      const step = () => {
        const p = Math.min(1, Math.max(0, (performance.now() - start) / 600));
        const eased = 1 - Math.pow(1 - p, 3);
        this.shown = Math.round(from + (to - from) * eased);
        if (p < 1) {
          this.frame = requestAnimationFrame(step);
        }
      };
      this.frame = requestAnimationFrame(step);
    },
  },
  beforeUnmount() {
    cancelAnimationFrame(this.frame);
  },
  methods: {
    format(value: number) {
      return (value ?? 0).toLocaleString();
    },
  },
};
</script>
