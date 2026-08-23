<script setup lang="ts">
/**
 * What you can type once you are standing on the server.
 *
 * The panel hands over a connect string and stops there, so everything the
 * practice plugin can do -- drills, executes, the throw you just made -- was
 * reachable only by already knowing to type `.help` in chat. This is that same
 * list, in the same order the plugin prints it, on the surface that put you on
 * the server in the first place.
 *
 * Closed by default: the dialog has no scroller of its own, and twenty rows
 * unfolding under the join button would push the way out of the session off the
 * bottom of the screen.
 */
import { ref } from "vue";
import { ChevronDown, Terminal } from "lucide-vue-next";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";

const open = ref(false);

const base = "pages.utility.practice.commands";

// Grouped the way a session is actually used -- find a throw, drill it, then
// the conveniences -- rather than alphabetically, which puts `.bloom` first and
// `.save` two thirds of the way down.
const groups = [
  {
    label: `${base}.group_lineups`,
    items: [
      { command: ".save <name>", desc: `${base}.save` },
      { command: ".load <query>", desc: `${base}.load` },
      { command: ".next / .prev", desc: `${base}.next` },
      { command: ".jump", desc: `${base}.jump` },
      { command: ".rethrow", desc: `${base}.rethrow` },
      { command: ".last / .back <n>", desc: `${base}.last` },
      { command: ".list / .reload / .delete", desc: `${base}.list` },
    ],
  },
  {
    label: `${base}.group_drills`,
    items: [
      { command: ".drill [count] [worst]", desc: `${base}.drill` },
      { command: ".skip", desc: `${base}.skip` },
      { command: ".drill / .cancel", desc: `${base}.cancel` },
      { command: ".playbook / .run", desc: `${base}.playbook` },
      { command: ".playbook stop", desc: `${base}.playbook_stop` },
    ],
  },
  {
    label: `${base}.group_tools`,
    items: [
      { command: ".bloom", desc: `${base}.bloom` },
      { command: ".solve [name]", desc: `${base}.solve` },
      { command: ".pos save <name> / .pos <name>", desc: `${base}.pos` },
      { command: ".spawn <n>", desc: `${base}.spawn` },
      { command: ".noclip / .god", desc: `${base}.noclip` },
      { command: ".timer", desc: `${base}.timer` },
      { command: ".solo", desc: `${base}.solo` },
      { command: ".clear", desc: `${base}.clear` },
      { command: ".help", desc: `${base}.help` },
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
        <Terminal class="h-3 w-3" />
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
              :key="item.command"
              class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
            >
              <code
                class="font-mono text-[0.68rem] text-[hsl(var(--tac-amber))]"
              >
                {{ item.command }}
              </code>
              <span class="text-[0.7rem] text-muted-foreground">
                {{ $t(item.desc) }}
              </span>
            </div>
          </div>
        </div>

        <!-- The commands are chat text, so any of them binds to a key -- the
             one thing the in-game .help output never says. -->
        <p class="text-[0.7rem] leading-relaxed text-muted-foreground/70">
          {{ $t(`${base}.bind_hint`) }}
          <code class="font-mono text-[0.68rem] text-muted-foreground">
            bind n "say .next"
          </code>
        </p>
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>
