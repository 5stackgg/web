<script lang="ts" setup>
import { computed, toRef } from "vue";
import { Badge } from "~/components/ui/badge";
import { useCountdown } from "~/composables/useCountdown";

const props = withDefaults(
  defineProps<{
    lineupName: string;
    action: string;
    pickLabel: string;
    pickVariant?: "secondary" | "destructive";
    active?: boolean;
    deadline?: string | null;
    total?: number;
    // When it is the viewer's own turn the banner drops the third-person
    // sentence for an instruction: a lead strip, what to do, and the context
    // it applies to. Without a headline it stays in the third-person layout.
    headline?: string | null;
    subline?: string | null;
    youLabel?: string | null;
  }>(),
  {
    pickVariant: "secondary",
    active: false,
    deadline: null,
    total: 0,
    headline: null,
    subline: null,
    youLabel: null,
  },
);

const { remaining, fraction, urgent } = useCountdown(
  toRef(props, "deadline"),
  toRef(props, "total"),
);

const seconds = computed(() => Math.ceil(remaining.value));

const instructing = computed(() => props.active && !!props.headline);
</script>

<template>
  <div
    class="mx-auto w-full max-w-lg overflow-hidden rounded-md border backdrop-blur-[6px] transition-colors duration-300"
    :class="
      active
        ? 'border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.08)] ring-1 ring-[hsl(var(--tac-amber)/0.25)]'
        : 'border-border bg-card/40'
    "
  >
    <!-- Your own turn: an instruction, not a scoreboard line. -->
    <template v-if="instructing">
      <div
        class="flex items-center justify-center gap-2 px-4 py-1 font-mono text-[0.66rem] font-bold uppercase tracking-[0.24em]"
        :class="
          urgent
            ? 'bg-destructive text-destructive-foreground'
            : 'bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))]'
        "
      >
        <span>{{ youLabel }}</span>
        <template v-if="deadline">
          <span aria-hidden="true">&middot;</span>
          <span class="tabular-nums">{{ seconds }}s</span>
        </template>
      </div>

      <div
        class="px-4 pb-1 pt-2.5 text-center font-sans text-lg font-extrabold uppercase tracking-wide"
      >
        {{ headline }}
      </div>
      <!-- Truncates for the same reason the third-person row never wraps: a
           long team name must not change the banner's height mid-veto. -->
      <div
        v-if="subline"
        class="truncate px-4 pb-2.5 text-center font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground"
        :title="subline"
      >
        {{ subline }}
      </div>
    </template>

    <!-- Never wraps: the two lineups alternate turns, so a long team name
         wrapping this row made the banner grow and shrink on every pick. The
         name truncates instead and keeps the full text in its tooltip. -->
    <div v-else class="flex min-w-0 flex-nowrap items-center gap-3 px-4 py-3">
      <!-- Mirrors the clock's width so the turn text stays optically centered
           in the banner instead of being pushed off by the countdown. -->
      <span v-if="deadline" class="w-9 shrink-0" />

      <div
        class="flex min-w-0 flex-1 flex-nowrap items-center justify-center gap-2 text-center"
      >
        <span
          class="min-w-0 truncate font-sans text-lg font-bold uppercase tracking-wide"
          :class="active ? 'text-[hsl(var(--tac-amber))]' : 'text-foreground'"
          :title="lineupName"
        >
          {{ lineupName }}
        </span>
        <span
          class="shrink-0 font-sans text-xs uppercase tracking-[0.18em] text-muted-foreground"
          >{{ action }}</span
        >
        <Badge
          :variant="pickVariant"
          class="shrink-0 font-sans uppercase tracking-[0.14em]"
          >{{ pickLabel }}</Badge
        >
      </div>

      <!-- Fixed width so the banner does not resize as the clock drops from
           two digits to one. -->
      <span
        v-if="deadline"
        class="w-9 shrink-0 text-right font-mono text-lg font-bold leading-none tabular-nums transition-colors"
        :class="urgent ? 'text-destructive' : 'text-muted-foreground'"
      >
        {{ seconds }}
      </span>
    </div>

    <div v-if="deadline" class="h-[3px] w-full bg-border/60">
      <div
        class="h-full origin-left transition-colors"
        :class="urgent ? 'bg-destructive' : 'bg-[hsl(var(--tac-amber))]'"
        :style="{ transform: `scaleX(${fraction})` }"
      />
    </div>
  </div>
</template>
