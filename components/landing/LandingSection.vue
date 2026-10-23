<script setup lang="ts">
import { Check, ArrowRight } from "lucide-vue-next";
import type { RouteLocationRaw } from "vue-router";

defineProps<{
  id: string;
  eyebrow: string;
  title: string;
  lede: string;
  points: { title: string; body: string }[];
  link?: { to: RouteLocationRaw; label: string } | null;
  // Visual on the left, copy on the right.
  flip?: boolean;
  // The copy runs across the top and the visual takes the full width.
  wide?: boolean;
  // The visual takes two thirds of the row instead of seven twelfths.
  broad?: boolean;
}>();
</script>

<template>
  <section
    :id="id"
    class="scroll-mt-20 border-t border-border/70 py-24 max-sm:py-16"
  >
    <div
      class="mx-auto grid max-w-[1320px] px-8 max-sm:px-4"
      :class="
        wide
          ? 'gap-10'
          : [
              'items-start gap-16 max-lg:gap-10',
              flip
                ? broad
                  ? 'lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]'
                  : 'lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]'
                : broad
                  ? 'lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]'
                  : 'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]',
            ]
      "
    >
      <div
        class="min-w-0"
        :class="[
          flip && !wide && 'lg:order-2',
          wide &&
            'grid gap-x-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start',
        ]"
      >
        <div class="min-w-0">
          <span
            class="inline-flex items-center gap-2 text-[13px] font-semibold text-[hsl(var(--tac-amber))]"
          >
            <span
              class="inline-block h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"
              aria-hidden="true"
            ></span>
            {{ eyebrow }}
          </span>
          <h2
            class="mt-3.5 text-[38px] font-bold leading-[1.1] tracking-[-0.01em] [text-wrap:balance] max-sm:text-3xl"
          >
            {{ title }}
          </h2>
          <p
            class="mt-4 max-w-[520px] text-[17px] leading-relaxed text-foreground/70"
          >
            {{ lede }}
          </p>
        </div>
        <ul
          class="mt-6 grid gap-3.5"
          :class="wide && 'lg:row-span-2 lg:mt-12 lg:grid-cols-2 lg:gap-x-8'"
        >
          <li
            v-for="point in points"
            :key="point.title"
            class="grid grid-cols-[18px_1fr] gap-2.5 text-[14.5px] leading-normal text-foreground/70"
          >
            <Check
              class="mt-[3px] size-[18px] text-[hsl(var(--tac-amber))]"
              :stroke-width="2.4"
            />
            <span>
              <b class="font-semibold text-foreground">{{ point.title }}</b>
              {{ point.body }}
            </span>
          </li>
        </ul>
        <NuxtLink
          v-if="link"
          :to="link.to"
          class="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--tac-amber))] hover:underline"
        >
          {{ link.label }}
          <ArrowRight class="size-3.5" />
        </NuxtLink>
      </div>
      <div class="min-w-0">
        <slot />
      </div>
    </div>
  </section>
</template>
