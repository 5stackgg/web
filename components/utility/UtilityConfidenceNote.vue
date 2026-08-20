<script setup lang="ts">
import { computed } from "vue";
import { BadgeCheck, Film, TriangleAlert } from "lucide-vue-next";
import {
  UTILITY_AIM_DELTA_WARN_DEGREES,
  utilityAimDelta,
} from "~/utilities/utilityDisplay";
import type { UtilityLineup } from "~/types/utility";

const props = withDefaults(
  defineProps<{
    lineup: Pick<
      UtilityLineup,
      | "confidence"
      | "origin_source"
      | "verified_at"
      | "view_yaw_delta"
      | "view_pitch_delta"
    >;
    compact?: boolean;
  }>(),
  {
    compact: false,
  },
);

const isDerived = computed(() => props.lineup.confidence === "derived");

const delta = computed(() => utilityAimDelta(props.lineup));

// Only a mined lineup has an aim to disagree with itself about, so the warning
// stays off an exact lineup even if the columns are somehow populated.
const deltaIsLarge = computed(
  () =>
    isDerived.value &&
    delta.value !== null &&
    delta.value >= UTILITY_AIM_DELTA_WARN_DEGREES,
);

function degrees(value: number | null | undefined) {
  return `${Number(value ?? 0) >= 0 ? "+" : ""}${Number(value ?? 0).toFixed(1)}`;
}

// A `derived` lineup was reconstructed from a demo: the stance and the view
// angles are inferred, not recorded. Saying "verified" about it would be a lie,
// so the note names where it came from and what the player has to do about it.
const tone = computed(() => {
  if (props.lineup.confidence === "exact") {
    return {
      icon: BadgeCheck,
      classes: "border-success/40 bg-success/10 text-success",
      key: "exact",
    };
  }
  if (isDerived.value) {
    if (deltaIsLarge.value) {
      return {
        icon: TriangleAlert,
        classes:
          "border-[hsl(var(--tac-amber)/0.7)] bg-[hsl(var(--tac-amber)/0.16)] text-[hsl(var(--tac-amber))]",
        key: "derived_off",
      };
    }
    return {
      icon: Film,
      classes:
        "border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]",
      key: "derived",
    };
  }
  return {
    icon: TriangleAlert,
    classes: "border-destructive/40 bg-destructive/10 text-destructive",
    key: "low",
  };
});
</script>

<template>
  <div
    class="flex items-start gap-1.5 rounded-sm border px-2 py-1"
    :class="tone.classes"
  >
    <component :is="tone.icon" class="mt-[1px] h-3 w-3 shrink-0" />
    <div class="min-w-0 flex-1">
      <span
        class="font-mono uppercase leading-snug tracking-[0.1em]"
        :class="compact ? 'text-[0.55rem]' : 'text-[0.62rem]'"
      >
        {{ $t(`pages.utility.confidence.${tone.key}`) }}
      </span>
      <span
        v-if="compact && deltaIsLarge"
        class="ml-1 font-mono text-[0.55rem] tabular-nums"
      >
        {{
          $t("pages.utility.confidence.delta_short", {
            degrees: delta == null ? null : Number(delta).toFixed(1),
          })
        }}
      </span>
      <span
        v-if="!compact"
        class="ml-1 text-[0.7rem] normal-case leading-snug tracking-normal opacity-80"
      >
        {{ $t(`pages.utility.confidence.${tone.key}_note`) }}
      </span>
      <p
        v-if="!compact && isDerived && deltaIsLarge"
        class="mt-1 font-mono text-[0.6rem] tabular-nums leading-snug tracking-[0.06em]"
      >
        {{
          $t("pages.utility.confidence.delta_detail", {
            yaw: degrees(lineup.view_yaw_delta),
            pitch: degrees(lineup.view_pitch_delta),
          })
        }}
      </p>
    </div>
  </div>
</template>
