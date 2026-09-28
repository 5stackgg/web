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

const props = defineProps<{
  state: EdgeStatusState;
  summary: string;
  endpoint?: string;
  docsUrl: string;
  checkedAt?: Date | null;
}>();

defineEmits<{ (e: "check"): void }>();

const { locale } = useI18n();

const tones: Record<
  EdgeStatusState,
  { rail: string; text: string; tint: string; bar: string; lit: number }
> = {
  online: {
    rail: "bg-success",
    text: "text-success",
    tint: "text-success",
    bar: "bg-success",
    lit: 3,
  },
  attention: {
    rail: "bg-warning",
    text: "text-warning",
    tint: "text-warning",
    bar: "bg-warning",
    lit: 2,
  },
  offline: {
    rail: "bg-destructive",
    text: "text-destructive",
    tint: "text-destructive",
    bar: "bg-destructive",
    lit: 1,
  },
  checking: {
    rail: "bg-muted-foreground/30",
    text: "text-muted-foreground",
    tint: "text-muted-foreground/60",
    bar: "bg-[hsl(var(--tac-amber))] motion-safe:animate-pulse",
    lit: 3,
  },
  idle: {
    rail: "bg-muted-foreground/30",
    text: "text-muted-foreground",
    tint: "text-muted-foreground/60",
    bar: "",
    lit: 0,
  },
};

const BAR_HEIGHTS = ["h-[5px]", "h-[8px]", "h-[11px]"];

const tone = computed(() => tones[props.state]);

const checkedTime = computed(() =>
  props.checkedAt ? props.checkedAt.toLocaleTimeString(locale.value) : "",
);
</script>

<template>
  <div
    class="relative overflow-hidden rounded-md border border-border/70"
    data-test="edge-status"
    :data-state="state"
  >
    <!-- currentColor, because a gradient can't be transitioned but a color can. -->
    <span
      class="pointer-events-none absolute inset-0 bg-gradient-to-r from-current to-transparent opacity-[0.08] transition-colors duration-500 motion-reduce:transition-none"
      :class="tone.tint"
    />
    <span
      class="absolute inset-y-0 left-0 w-[3px] transition-colors duration-500 motion-reduce:transition-none"
      :class="tone.rail"
    />
    <Transition
      enter-active-class="transition-opacity duration-300 motion-reduce:transition-none"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-300 motion-reduce:transition-none"
      leave-to-class="opacity-0"
    >
      <div
        v-if="state === 'checking'"
        class="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden text-[hsl(var(--tac-amber)/0.9)]"
      >
        <div class="tac-scan-sweep h-full" />
      </div>
    </Transition>

    <div class="relative grid gap-1 py-3 pl-5 pr-3">
      <div class="flex items-center gap-3">
        <span
          class="flex h-[11px] shrink-0 items-end gap-[2px]"
          aria-hidden="true"
        >
          <span
            v-for="(height, bar) in BAR_HEIGHTS"
            :key="bar"
            class="w-[3px] rounded-[1px] transition-colors duration-300 motion-reduce:transition-none"
            :class="[
              height,
              bar < tone.lit ? tone.bar : 'bg-muted-foreground/25',
            ]"
            :style="{
              transitionDelay: `${bar * 90}ms`,
              animationDelay: state === 'checking' ? `${bar * 180}ms` : undefined,
            }"
          />
        </span>
        <Transition
          mode="out-in"
          enter-active-class="transition duration-200 ease-out motion-reduce:transition-none"
          enter-from-class="translate-y-0.5 opacity-0"
          leave-active-class="transition duration-100 ease-in motion-reduce:transition-none"
          leave-to-class="opacity-0"
        >
          <span
            :key="state"
            class="shrink-0 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.22em]"
            :class="tone.text"
            data-test="edge-status-state"
          >
            {{ $t(`edge_status.${state}`) }}
          </span>
        </Transition>
        <span
          v-if="endpoint"
          class="min-w-0 truncate font-mono text-sm"
          data-test="edge-status-endpoint"
        >
          {{ endpoint }}
        </span>
        <span
          v-if="checkedTime && state !== 'checking'"
          class="ml-auto hidden shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground/60 sm:inline"
        >
          {{ checkedTime }}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="size-7 shrink-0"
          :class="{ 'ml-auto': !checkedTime || state === 'checking' }"
          :title="$t('edge_status.check_again')"
          :aria-label="$t('edge_status.check_again')"
          :loading="state === 'checking'"
          data-test="edge-status-check"
          @click="$emit('check')"
        >
          <RefreshCw class="size-3.5" />
        </Button>
      </div>

      <Transition
        mode="out-in"
        enter-active-class="transition duration-200 ease-out motion-reduce:transition-none"
        enter-from-class="translate-y-0.5 opacity-0"
        leave-active-class="transition duration-100 ease-in motion-reduce:transition-none"
        leave-to-class="opacity-0"
      >
        <p
          :key="`${state}:${summary}`"
          class="text-sm text-muted-foreground"
          data-test="edge-status-summary"
        >
          {{ summary }}
          <a
            v-if="
              state === 'idle' || state === 'offline' || state === 'attention'
            "
            :href="docsUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="ml-1 inline-flex items-center gap-1 whitespace-nowrap text-primary transition-colors hover:text-primary/80"
            data-test="edge-status-guide"
          >
            {{ $t("edge_status.setup_guide") }}
            <ExternalLink class="size-3.5" />
          </a>
        </p>
      </Transition>
    </div>
  </div>
</template>
