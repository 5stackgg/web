<script setup lang="ts">
import { computed } from "vue";
import UtilityTechniqueIcon from "~/components/utility/UtilityTechniqueIcon.vue";
import UtilityThrowIcon from "~/components/utility/UtilityThrowIcon.vue";
import { utilityThrowButtonsKey } from "~/utilities/utilityDisplay";
import type { UtilityTechnique, UtilityThrowStrength } from "~/types/utility";

// How to throw it, first and large: how you move and which buttons you press.
// This is the part you glance at mid-match, so it is the same two cells
// wherever a throw is shown -- a lineup, a meta spot, your step in an execute.
const props = withDefaults(
  defineProps<{
    technique: UtilityTechnique | null | undefined;
    strength: UtilityThrowStrength | null | undefined;
    /** One quiet line under the technique: how much of the data agrees. */
    techniqueNote?: string | null;
  }>(),
  { techniqueNote: null },
);

const throwKey = computed(() => utilityThrowButtonsKey(props.strength));
</script>

<template>
  <dl class="grid grid-cols-2 gap-2">
    <div
      class="min-w-0 rounded-md border border-border bg-background/50 px-3 pb-3 pt-2.5"
    >
      <dt
        class="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground/70"
      >
        {{ $t("pages.utility.filters.technique") }}
      </dt>
      <dd class="mt-2 flex items-center gap-2.5">
        <UtilityTechniqueIcon
          :technique="technique ?? 'Stationary'"
          class="size-9 shrink-0"
        />
        <span class="min-w-0">
          <span class="block text-xl font-bold leading-[1.1]">
            {{ $t(`pages.utility.techniques.${technique ?? "Stationary"}`) }}
          </span>
          <span
            v-if="techniqueNote"
            class="block truncate text-[0.68rem] text-muted-foreground"
          >
            {{ techniqueNote }}
          </span>
        </span>
      </dd>
    </div>
    <div
      class="min-w-0 rounded-md border border-border bg-background/50 px-3 pb-3 pt-2.5"
    >
      <dt
        class="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground/70"
      >
        {{ $t("pages.utility.filters.throw_strength") }}
      </dt>
      <dd class="mt-2 flex items-center gap-2.5">
        <UtilityThrowIcon
          :strength="strength"
          class="h-[1.625rem] w-[1.125rem] shrink-0"
        />
        <span class="min-w-0">
          <span class="block text-xl font-bold leading-[1.1]">
            {{ $t(`pages.utility.throw_buttons.${throwKey}_short`) }}
          </span>
          <span class="block truncate text-[0.68rem] text-muted-foreground">
            {{ $t(`pages.utility.throw_buttons.${throwKey}`) }}
          </span>
        </span>
      </dd>
    </div>
  </dl>
</template>
