<script setup lang="ts">
import { ChevronRight } from "lucide-vue-next";
import { faqHotClasses } from "~/utilities/faqClasses";
import type { FixProblemItem } from "~/utilities/fixProblem";

defineProps<{
  stepLabel: string;
  now: FixProblemItem[];
  anytime: FixProblemItem[];
  later?: string;
  hot?: string;
}>();

const emit = defineEmits<{ select: [string] }>();

const groupLabel =
  "px-2 pb-1 pt-2 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground";
</script>

<template>
  <div class="flex w-full flex-col">
    <div class="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
      <span
        class="font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]"
      >
        {{ $t("match.recovery.fix.title") }}
      </span>
      <span
        class="rounded border border-border px-1.5 py-0.5 font-mono text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
      >
        {{ stepLabel }}
      </span>
      <span class="flex-1" />
      <slot name="aside" />
    </div>
    <div class="flex flex-col gap-0.5 p-1.5">
      <template
        v-for="group in [
          { id: 'now', items: now },
          { id: 'anytime', items: anytime },
        ]"
        :key="group.id"
      >
        <template v-if="group.items.length">
          <span :class="groupLabel">
            {{
              group.id === "now"
                ? $t("match.fix_menu.right_now")
                : $t("match.fix_menu.any_time")
            }}
          </span>
          <button
            v-for="item in group.items"
            :key="item.key"
            type="button"
            class="group flex w-full items-start gap-3 rounded-md px-2 py-2 text-left outline-none transition-colors duration-150 hover:bg-muted/50 focus-visible:bg-muted/50"
            :class="hot === item.key && faqHotClasses"
            @click="emit('select', item.key)"
          >
            <span
              class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border"
              :class="
                item.tone === 'danger'
                  ? 'border-destructive/40 bg-destructive/10 text-destructive'
                  : group.id === 'now'
                    ? 'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]'
                    : 'border-border bg-muted/40 text-muted-foreground'
              "
            >
              <component :is="item.icon" class="size-3.5" />
            </span>
            <span class="flex min-w-0 flex-1 flex-col gap-0.5">
              <span
                class="text-sm font-semibold leading-snug"
                :class="item.tone === 'danger' && 'text-destructive'"
              >
                {{ item.title }}
              </span>
              <span class="text-xs leading-snug text-muted-foreground">
                {{ item.description }}
              </span>
            </span>
            <ChevronRight
              class="mt-1.5 size-3.5 shrink-0 text-muted-foreground/50 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
            />
          </button>
        </template>
      </template>
    </div>
    <p
      v-if="later"
      class="border-t border-border/60 px-3 py-2 text-[0.7rem] leading-snug text-muted-foreground"
    >
      {{ later }}
    </p>
  </div>
</template>
