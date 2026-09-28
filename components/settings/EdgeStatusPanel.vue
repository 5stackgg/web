<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { ExternalLink, RefreshCw } from "lucide-vue-next";
import { Button } from "~/components/ui/button";

export type EdgeStatusState =
  | "checking"
  | "online"
  | "attention"
  | "offline"
  | "idle";

export type EdgeStatusRow = {
  label: string;
  value: string;
  tone?: "good" | "bad";
};

const props = defineProps<{
  state: EdgeStatusState;
  summary: string;
  endpoint?: string;
  rows?: EdgeStatusRow[];
  docsUrl: string;
  checkedAt?: Date | null;
}>();

defineEmits<{ (e: "check"): void }>();

const { locale } = useI18n();

const tones: Record<
  EdgeStatusState,
  { rail: string; text: string; tint: string; dot: string }
> = {
  online: {
    rail: "bg-success",
    text: "text-success",
    tint: "from-[hsl(var(--success)/0.08)]",
    dot: "bg-success",
  },
  attention: {
    rail: "bg-warning",
    text: "text-warning",
    tint: "from-[hsl(var(--warning)/0.08)]",
    dot: "bg-warning",
  },
  offline: {
    rail: "bg-destructive",
    text: "text-destructive",
    tint: "from-[hsl(var(--destructive)/0.08)]",
    dot: "bg-destructive",
  },
  checking: {
    rail: "bg-muted-foreground/30",
    text: "text-muted-foreground",
    tint: "from-muted/40",
    dot: "bg-[hsl(var(--tac-amber))] motion-safe:animate-pulse",
  },
  idle: {
    rail: "bg-muted-foreground/30",
    text: "text-muted-foreground",
    tint: "from-muted/40",
    dot: "border border-muted-foreground/70",
  },
};

const tone = computed(() => tones[props.state]);

const checkedTime = computed(() =>
  props.checkedAt ? props.checkedAt.toLocaleTimeString(locale.value) : "",
);
</script>

<template>
  <div
    class="relative overflow-hidden rounded-md border border-border/70 bg-gradient-to-r to-transparent"
    :class="tone.tint"
    data-test="edge-status"
    :data-state="state"
  >
    <span class="absolute inset-y-0 left-0 w-[3px]" :class="tone.rail" />
    <div
      v-if="state === 'checking'"
      class="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden text-[hsl(var(--tac-amber)/0.9)]"
    >
      <div class="tac-scan-sweep h-full" />
    </div>

    <div class="grid gap-3 py-4 pl-6 pr-4">
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div class="flex min-w-0 items-center gap-3">
          <span class="relative inline-flex size-2 shrink-0">
            <span
              v-if="state === 'online'"
              class="absolute inset-0 rotate-45 bg-success/50 motion-safe:animate-ping"
            />
            <span class="relative size-2 rotate-45" :class="tone.dot" />
          </span>
          <span
            class="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.22em]"
            :class="tone.text"
            data-test="edge-status-state"
          >
            {{ $t(`edge_status.${state}`) }}
          </span>
        </div>
        <div class="flex items-center gap-3">
          <span
            v-if="checkedTime && state !== 'checking'"
            class="hidden font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground/70 sm:inline"
          >
            {{ $t("edge_status.checked_at", { time: checkedTime }) }}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            :loading="state === 'checking'"
            @click="$emit('check')"
          >
            <RefreshCw class="size-3.5" />
            {{ $t("edge_status.check_again") }}
          </Button>
        </div>
      </div>

      <div class="grid gap-1">
        <span
          v-if="endpoint"
          class="break-all font-mono text-lg leading-tight tracking-tight"
          data-test="edge-status-endpoint"
        >
          {{ endpoint }}
        </span>
        <p class="text-sm text-muted-foreground" data-test="edge-status-summary">
          {{ summary }}
        </p>
      </div>

      <dl
        v-if="rows?.length"
        class="grid gap-x-6 gap-y-1.5 border-t border-dashed border-border/70 pt-3 sm:grid-cols-[max-content_1fr]"
      >
        <template v-for="row in rows" :key="row.label">
          <dt
            class="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground/70 sm:pt-[0.2rem]"
          >
            {{ row.label }}
          </dt>
          <dd
            class="text-sm"
            :class="{
              'text-success': row.tone === 'good',
              'text-destructive': row.tone === 'bad',
            }"
          >
            {{ row.value }}
          </dd>
        </template>
      </dl>

      <a
        :href="docsUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex w-fit items-center gap-1.5 text-sm text-primary transition-colors hover:text-primary/80"
        data-test="edge-status-guide"
      >
        {{ $t("edge_status.setup_guide") }}
        <ExternalLink class="size-3.5" />
      </a>
    </div>
  </div>
</template>
