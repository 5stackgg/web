<script lang="ts" setup>
// The check-in surfaces all speak the same three-word vocabulary — confirmed /
// waiting / removed — across the participant panel, the organizer review and
// the free-agent pool. One chip so a tone can never drift between them.
withDefaults(
  defineProps<{
    tone?: "muted" | "amber" | "ok" | "warn" | "bad";
  }>(),
  {
    tone: "muted",
  },
);

// Mirrors the hero status-pill tiers in TournamentDetail so a chip and the
// status pill next to it read as the same instrument.
const chipToneClasses: Record<string, string> = {
  muted: "border-border bg-muted/40 text-muted-foreground",
  amber:
    "border-[hsl(var(--tac-amber)_/_0.45)] bg-[hsl(var(--tac-amber)_/_0.12)] text-[hsl(var(--tac-amber))]",
  ok: "border-success/55 bg-success/15 text-success",
  warn: "border-warning/55 bg-warning/15 text-warning",
  bad: "border-destructive/55 bg-destructive/15 text-destructive",
};
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-[0.45rem] py-[0.2rem] font-mono text-[0.62rem] font-bold uppercase leading-none tracking-[0.14em]"
    :class="chipToneClasses[tone]"
  >
    <slot />
  </span>
</template>
