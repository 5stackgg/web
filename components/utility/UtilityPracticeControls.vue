<script setup lang="ts">
/**
 * What you do once you are standing on the server.
 *
 * Nothing is typed there any more: a handful of keys and the menu behind TAB
 * do it all. The labels are left in English because that is what the menu
 * says in game -- a translated name would not match anything on screen.
 *
 * Closed by default: the dialog has no scroller of its own, and two dozen rows
 * unfolding under the join button would push the way out of the session off the
 * bottom of the screen.
 */
import { ref } from "vue";
import { ChevronDown, Keyboard } from "lucide-vue-next";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";

const open = ref(false);

const base = "pages.utility.practice.controls";

// In the order a session uses them: the keys under your hand, then the first
// wheel, then the Practice wheel behind it.
const groups = [
  {
    label: `${base}.group_keys`,
    keys: true,
    items: [
      { name: "TAB", desc: `${base}.tab` },
      { name: "E", desc: `${base}.e` },
      { name: "R", desc: `${base}.r` },
      { name: "2× CTRL", desc: `${base}.ctrl` },
      { name: "2× SHIFT", desc: `${base}.shift` },
      { name: "DEL", desc: `${base}.del` },
    ],
  },
  {
    label: `${base}.group_menu`,
    keys: false,
    items: [
      { name: "Rethrow", desc: `${base}.rethrow` },
      { name: "Clear Utility", desc: `${base}.clear` },
      { name: "Last Throw", desc: `${base}.last` },
      { name: "Save Throw", desc: `${base}.save` },
      { name: "Lineups", desc: `${base}.lineups` },
      { name: "Filters", desc: `${base}.filters` },
      { name: "Settings", desc: `${base}.settings` },
    ],
  },
  {
    label: `${base}.group_practice`,
    keys: false,
    items: [
      { name: "Repeat Lineup", desc: `${base}.repeat` },
      { name: "Drill Unmastered", desc: `${base}.drill` },
      { name: "Execute", desc: `${base}.execute` },
      { name: "Smoke Outline", desc: `${base}.outline` },
      { name: "Change Map", desc: `${base}.map` },
      { name: "Place A Bot", desc: `${base}.bots` },
      { name: "Spawn Points", desc: `${base}.spawns` },
    ],
  },
];

const sectionLabel =
  "flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground";
</script>

<template>
  <Collapsible v-model:open="open" class="space-y-2">
    <CollapsibleTrigger as-child>
      <button
        type="button"
        :class="[
          sectionLabel,
          'w-full cursor-pointer border-0 bg-transparent p-0 text-left transition-colors hover:text-foreground',
        ]"
      >
        <Keyboard class="h-3 w-3" />
        {{ $t(`${base}.title`) }}
        <ChevronDown
          class="ml-auto h-3.5 w-3.5 transition-transform duration-150"
          :class="open ? 'rotate-180' : ''"
        />
      </button>
    </CollapsibleTrigger>

    <CollapsibleContent>
      <div class="space-y-2 pt-1">
        <p class="text-xs leading-relaxed text-muted-foreground/80">
          {{ $t(`${base}.hint`) }}
        </p>

        <!-- Its own scroller, capped: the dialog it sits in is a fixed panel
             with no scroll of its own, so an open list has to keep its height
             rather than growing past the viewport. -->
        <div class="max-h-60 space-y-3 overflow-y-auto overscroll-contain pr-1">
          <div v-for="group of groups" :key="group.label" class="space-y-1">
            <div
              class="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground/60"
            >
              {{ $t(group.label) }}
            </div>
            <div
              v-for="item of group.items"
              :key="item.name"
              class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
            >
              <kbd
                v-if="group.keys"
                class="rounded-sm border border-border bg-muted/40 px-1 font-mono text-[0.62rem] text-foreground"
              >
                {{ item.name }}
              </kbd>
              <span
                v-else
                class="text-[0.7rem] font-semibold text-[hsl(var(--tac-amber))]"
              >
                {{ item.name }}
              </span>
              <span class="text-[0.7rem] text-muted-foreground">
                {{ $t(item.desc) }}
              </span>
            </div>
          </div>
        </div>

        <p class="text-[0.7rem] leading-relaxed text-muted-foreground/70">
          {{ $t(`${base}.mastered`) }}
        </p>
        <p class="text-[0.65rem] leading-snug text-muted-foreground/60">
          {{ $t(`${base}.fallback`) }}
        </p>
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>
