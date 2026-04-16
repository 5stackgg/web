<script setup lang="ts">
import {
  tacticalTabIndicatorClasses,
  tacticalTabIndicatorFinishedClasses,
  tacticalTabIndicatorLiveClasses,
  tacticalTabIndicatorUpcomingClasses,
  tacticalTabsListClasses,
  tacticalTabsTriggerClasses,
} from "~/utilities/tacticalClasses";

defineProps<{
  corners?: "both" | "tl" | "br" | "none";
}>();

const tacticalTabs = {
  listClass: tacticalTabsListClasses,
  triggerClass: tacticalTabsTriggerClasses,
  indicatorClass: tacticalTabIndicatorClasses,
  indicatorLiveClass: tacticalTabIndicatorLiveClasses,
  indicatorUpcomingClass: tacticalTabIndicatorUpcomingClasses,
  indicatorFinishedClass: tacticalTabIndicatorFinishedClasses,
};
</script>

<template>
  <header
    class="relative overflow-hidden rounded-lg border border-border bg-[linear-gradient(180deg,hsl(var(--card)/0.55)_0%,hsl(var(--card)/0.25)_100%)] px-4 py-4 sm:px-6 sm:py-5 [backdrop-filter:blur(6px)]"
  >
    <span
      aria-hidden="true"
      class="pointer-events-none absolute left-2 top-2 h-[14px] w-[14px] border-l-2 border-t-2 border-[hsl(var(--tac-amber))]"
    ></span>
    <span
      aria-hidden="true"
      class="pointer-events-none absolute bottom-2 right-2 h-[14px] w-[14px] border-b-2 border-r-2 border-[hsl(var(--tac-amber))]"
    ></span>

    <div
      class="flex flex-wrap items-end justify-between gap-6 max-sm:items-start"
    >
      <div class="flex min-w-0 flex-col gap-[0.35rem]">
        <span
          v-if="$slots.description"
          class="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground"
        >
          <span
            class="translate-y-[-1px] text-[0.7rem] text-[hsl(var(--tac-amber))]"
            >◢</span
          >
          <slot name="description"></slot>
        </span>

        <h1
          class="relative m-0 font-sans text-[clamp(1.75rem,4.2vw,3rem)] font-bold uppercase leading-[0.9] tracking-[0.02em] [font-stretch:80%]"
        >
          <span
            aria-hidden="true"
            class="pointer-events-none absolute left-[6px] right-[-6px] top-[6px] select-none overflow-hidden whitespace-nowrap text-transparent [-webkit-text-stroke:1px_hsl(var(--tac-amber)/0.35)]"
          >
            <slot name="title"></slot>
          </span>
          <span
            class="relative bg-[linear-gradient(180deg,hsl(var(--foreground))_0%,hsl(var(--foreground)/0.75)_100%)] bg-clip-text text-transparent [-webkit-text-fill-color:transparent]"
          >
            <slot name="title"></slot>
          </span>
        </h1>
      </div>

      <div
        v-if="$slots.actions"
        class="ml-auto flex shrink-0 items-center gap-3 max-sm:w-full max-sm:justify-start"
      >
        <slot name="actions" :tabs="tacticalTabs"></slot>
      </div>
    </div>
  </header>
</template>
