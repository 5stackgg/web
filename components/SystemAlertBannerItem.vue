<script setup lang="ts">
import type { Component } from "vue";
import { Info, TriangleAlert, OctagonAlert, X } from "lucide-vue-next";

defineProps<{
  type: "info" | "warning" | "critical";
  title?: string | null;
  message: string;
  dismissible?: boolean;
  /** Render the dismiss affordance but disable interaction (used in the editor preview). */
  preview?: boolean;
}>();

const emit = defineEmits<{ (e: "dismiss"): void }>();

const severity: Record<
  "info" | "warning" | "critical",
  {
    icon: Component;
    accent: string;
    color: string;
    tint: string;
    border: string;
  }
> = {
  info: {
    icon: Info,
    accent: "bg-info",
    color: "text-info",
    tint: "bg-info/10",
    border: "border-info/30",
  },
  warning: {
    icon: TriangleAlert,
    accent: "bg-warning",
    color: "text-warning",
    tint: "bg-warning/10",
    border: "border-warning/30",
  },
  critical: {
    icon: OctagonAlert,
    accent: "bg-destructive",
    color: "text-destructive",
    tint: "bg-destructive/10",
    border: "border-destructive/40",
  },
};
</script>

<template>
  <div
    :class="[
      'relative flex items-start gap-3 border-b py-2.5 pl-5 pr-4 [backdrop-filter:blur(6px)]',
      severity[type].tint,
      severity[type].border,
    ]"
    role="alert"
  >
    <span
      aria-hidden="true"
      :class="[
        'pointer-events-none absolute inset-y-0 left-0 w-[3px]',
        severity[type].accent,
      ]"
    />
    <component
      :is="severity[type].icon"
      :class="['mt-0.5 size-4 shrink-0', severity[type].color]"
    />
    <div class="min-w-0 flex-1 space-y-0.5" :class="{ 'pr-6': dismissible }">
      <p
        v-if="title"
        :class="[
          'text-[0.78rem] font-bold uppercase tracking-[0.14em]',
          severity[type].color,
        ]"
      >
        {{ title }}
      </p>
      <p
        class="whitespace-pre-line break-words text-sm leading-snug text-foreground/85"
      >
        {{ message }}
      </p>
    </div>
    <!-- Absolutely positioned so toggling dismissible never changes row height. -->
    <button
      v-if="dismissible"
      type="button"
      :class="[
        'absolute right-3 top-2 rounded p-1 text-muted-foreground transition-colors',
        preview ? 'pointer-events-none' : 'hover:text-foreground',
      ]"
      :tabindex="preview ? -1 : 0"
      :aria-label="$t('system_alerts.dismiss')"
      @click="!preview && emit('dismiss')"
    >
      <X class="size-4" />
    </button>
  </div>
</template>
