<script setup lang="ts">
import { useAttrs } from "vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import TweenNumber from "~/components/game-server-nodes/TweenNumber.vue";
import { TONE_BORDER, TONE_TEXT } from "~/components/admin/tone";

// The admin KPI tile: label, one big value, an optional line under it.
// A numeric value glides to its next reading; null reads "—". Bind @click and
// the tile becomes a button.
const props = withDefaults(
  defineProps<{
    label?: string;
    /** Explains a cryptic label: dotted underline + tooltip. */
    tip?: string;
    value?: number | string | null;
    decimals?: number;
    suffix?: string;
    sub?: string;
    tone?: "warn" | "bad";
  }>(),
  { decimals: 0, suffix: "" },
);

const attrs = useAttrs();
// attrs aren't reactive; read them at render.
const interactive = () => !!attrs.onClick;
</script>

<template>
  <component
    :is="interactive() ? 'button' : 'div'"
    :type="interactive() ? 'button' : undefined"
    class="grid min-w-0 content-start gap-1.5 rounded-md border bg-card/40 px-3.5 py-3 text-left"
    :class="[
      props.tone ? TONE_BORDER[props.tone] : 'border-border',
      interactive() &&
        'transition-colors duration-150 hover:bg-card/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
    ]"
  >
    <span class="min-w-0 truncate text-xs text-muted-foreground">
      <slot name="label">
        <FiveStackToolTip v-if="props.tip" as-child :delay-duration="120">
          <template #trigger>
            <span
              :tabindex="interactive() ? undefined : 0"
              class="cursor-help underline decoration-muted-foreground/70 decoration-dotted underline-offset-[3px]"
              >{{ props.label }}</span
            >
          </template>
          <span class="block max-w-[18rem]">{{ props.tip }}</span>
        </FiveStackToolTip>
        <template v-else>{{ props.label }}</template>
      </slot>
    </span>
    <span
      class="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-1 text-[21px] font-bold leading-none tabular-nums"
      :class="props.tone && TONE_TEXT[props.tone]"
    >
      <slot>
        <TweenNumber
          v-if="typeof props.value === 'number'"
          :value="props.value"
          :decimals="props.decimals"
          :suffix="props.suffix"
        />
        <span v-else-if="props.value == null" class="text-muted-foreground"
          >—</span
        >
        <template v-else>{{ props.value }}</template>
      </slot>
      <!-- e.g. "of 8" after the value -->
      <small
        v-if="$slots.aside"
        class="text-sm font-semibold text-muted-foreground"
      >
        <slot name="aside" />
      </small>
    </span>
    <span
      v-if="props.sub || $slots.sub"
      class="min-w-0 text-xs text-muted-foreground"
    >
      <slot name="sub">{{ props.sub }}</slot>
    </span>
  </component>
</template>
