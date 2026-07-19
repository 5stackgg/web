<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { MapPin } from "lucide-vue-next";

const props = defineProps<{
  prizePool?: string | null;
  teamsCount?: number | null;
  format?: string | null;
  start?: string | number | Date | null;
  location?: string | null;
}>();

const { t } = useI18n();

const startLabel = computed(() => {
  if (!props.start) {
    return null;
  }
  const date = new Date(props.start);
  if (isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
});

// Only render cells that actually have a value; the grid sizes itself to the
// number of live cells so it never leaves an empty slot.
const cells = computed(() => {
  const list: Array<{
    key: string;
    label: string;
    value: string;
    accent?: boolean;
    kind?: "stat" | "location";
  }> = [];
  if (props.prizePool) {
    list.push({
      key: "pool",
      label: t("tournament.stats.prize_pool"),
      value: props.prizePool,
      accent: true,
    });
  }
  if (props.teamsCount != null) {
    list.push({
      key: "teams",
      label: t("tournament.stats.teams"),
      value: String(props.teamsCount),
    });
  }
  if (props.format) {
    list.push({
      key: "format",
      label: t("tournament.stats.format"),
      value: props.format,
    });
  }
  if (startLabel.value) {
    list.push({
      key: "starts",
      label: t("tournament.stats.starts"),
      value: startLabel.value,
    });
  }
  if (props.location) {
    list.push({
      key: "location",
      label: t("tournament.stats.location"),
      value: props.location,
      kind: "location",
    });
  }
  return list;
});
</script>

<template>
  <div
    v-if="cells.length > 0"
    class="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border/70 sm:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]"
    :style="{ '--cols': cells.length }"
  >
    <div
      v-for="cell in cells"
      :key="cell.key"
      class="min-w-0 bg-card/60 px-5 py-3.5 [backdrop-filter:blur(6px)]"
    >
      <div
        class="font-mono text-[0.56rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70"
      >
        {{ cell.label }}
      </div>

      <!-- Location is text, sized down from the big stats, wrapping to show the
           full place rather than a single truncated line. -->
      <div
        v-if="cell.kind === 'location'"
        class="mt-1 flex items-start gap-1.5 text-sm font-semibold leading-snug text-foreground"
        :title="cell.value"
      >
        <MapPin class="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]" />
        <span class="line-clamp-2">{{ cell.value }}</span>
      </div>

      <div
        v-else
        class="mt-1 truncate font-sans text-xl font-bold leading-tight tabular-nums"
        :class="cell.accent ? 'text-[hsl(var(--tac-amber))]' : 'text-foreground'"
        :title="cell.value"
      >
        {{ cell.value }}
      </div>
    </div>
  </div>
</template>
