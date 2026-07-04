<script setup lang="ts">
import { ref, computed } from "vue";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { Button } from "~/components/ui/button";
import { Layers, ChevronDown, ChevronUp } from "lucide-vue-next";
import LeagueScheduleNotification from "~/components/notification/LeagueScheduleNotification.vue";
import type { LeagueScheduleTask } from "~/stores/NotificationStore";

// A peek-card deck of the viewer's scheduling tasks (nearest week on top),
// mirroring NotificationStack: collapsed shows the top card with the rest
// peeking behind + a "+N" expander; expanded lists every card.
const props = defineProps<{ tasks: LeagueScheduleTask[] }>();

const isOpen = ref(false);
const top = computed(() => props.tasks[0]);
const extra = computed(() => props.tasks.length - 1);

const cardClass =
  "rounded-md border border-[hsl(var(--tac-amber)/0.35)] bg-card/70 p-3";
const peekClass =
  "absolute inset-0 rounded-md border border-[hsl(var(--tac-amber)/0.25)] bg-card/40";
</script>

<template>
  <div v-if="!tasks.length" />

  <!-- Single task: a plain card -->
  <div v-else-if="tasks.length === 1" :class="cardClass">
    <LeagueScheduleNotification :task="tasks[0]" />
  </div>

  <!-- Multiple: a collapsible peek-stack -->
  <Collapsible v-else v-model:open="isOpen" class="block">
    <div v-if="!isOpen" class="relative">
      <div
        v-if="tasks.length >= 3"
        :class="peekClass"
        class="translate-y-3 scale-[0.92] opacity-70"
        aria-hidden="true"
      />
      <div
        v-if="tasks.length >= 2"
        :class="peekClass"
        class="translate-y-1.5 scale-[0.96] opacity-85"
        aria-hidden="true"
      />

      <div :class="['relative', cardClass]">
        <LeagueScheduleNotification :task="top" />
        <button
          type="button"
          class="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-md border border-border/60 bg-muted/20 py-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          @click="isOpen = true"
        >
          <Layers class="h-3 w-3" />
          {{ $t("league.schedule_task.more", { count: extra }) }}
          <ChevronDown class="h-3 w-3" />
        </button>
      </div>
    </div>

    <CollapsibleContent>
      <div class="space-y-2">
        <CollapsibleTrigger as-child>
          <Button
            size="sm"
            variant="ghost"
            class="h-6 gap-1 px-1 text-muted-foreground"
          >
            <ChevronUp class="h-3.5 w-3.5" />
            {{ tasks.length }}
          </Button>
        </CollapsibleTrigger>
        <div v-for="task in tasks" :key="task.id" :class="cardClass">
          <LeagueScheduleNotification :task="task" />
        </div>
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>
