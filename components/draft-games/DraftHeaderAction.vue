<script setup lang="ts">
import type { Component } from "vue";
import { Lock } from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { useMinLoading } from "~/composables/useMinLoading";

const props = withDefaults(
  defineProps<{
    label: string;
    icon?: Component;
    variant?: "primary" | "secondary";
    locked?: boolean;
    reason?: string;
    action: () => unknown;
  }>(),
  {
    icon: undefined,
    variant: "primary",
    locked: false,
    reason: undefined,
  },
);

const { loading, run } = useMinLoading();

const click = () => {
  if (props.locked) {
    return;
  }
  return run(async () => {
    await props.action();
  });
};
</script>

<template>
  <FiveStackToolTip
    as-child
    side="bottom"
    :disabled="!locked || !reason"
    :tap-toggle="false"
  >
    <template #trigger>
      <button
        type="button"
        class="draft-action relative isolate inline-flex h-10 items-center justify-center overflow-hidden whitespace-nowrap rounded-md border px-4 font-sans text-xs font-bold uppercase leading-none tracking-[0.16em]"
        :class="[
          variant === 'secondary'
            ? 'is-secondary'
            : locked
              ? 'is-locked'
              : 'is-primary',
        ]"
        :aria-disabled="locked ? 'true' : undefined"
        :aria-busy="loading ? 'true' : undefined"
        @click="click"
      >
        <span
          v-if="variant === 'primary'"
          class="draft-action-fill"
          aria-hidden="true"
        ></span>
        <span
          class="inline-flex items-center gap-2"
          :class="{ invisible: loading }"
        >
          <Lock v-if="locked" class="size-3.5" />
          <component :is="icon" v-else-if="icon" class="size-4" />
          {{ label }}
        </span>
        <span v-if="loading" class="absolute inset-0 grid place-items-center">
          <Spinner class="size-4" />
        </span>
      </button>
    </template>
    {{ reason }}
  </FiveStackToolTip>
</template>

<style scoped>
.draft-action {
  transition:
    color 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    background-color 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.11s ease-out,
    transform 0.11s ease-out;
}
/* The amber is its own layer so a locked button sits on the muted surface and
   lights up by fading the gradient in, not as a dimmed amber that reads brown. */
.draft-action-fill {
  position: absolute;
  inset: -1px;
  z-index: -1;
  border-radius: inherit;
  background: linear-gradient(
    135deg,
    var(--tac-amber-cta-from) 0%,
    hsl(var(--tac-amber)) 50%,
    var(--tac-amber-cta-to) 100%
  );
  transition: opacity 0.24s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
}
.is-primary {
  color: hsl(var(--tac-amber-foreground));
  border-color: hsl(var(--tac-amber));
  box-shadow:
    0 0 0 1px hsl(var(--tac-amber) / 0.35),
    0 4px 14px -4px hsl(var(--tac-amber) / 0.5);
}
.is-primary:active {
  transform: scale(0.97);
}
.is-locked {
  color: hsl(var(--muted-foreground));
  border-color: hsl(var(--border));
  background-color: hsl(var(--muted) / 0.35);
  cursor: not-allowed;
}
.is-locked .draft-action-fill {
  opacity: 0;
}
.is-secondary {
  color: hsl(var(--muted-foreground));
  border-color: hsl(var(--border));
  background-color: hsl(var(--card) / 0.6);
}
.is-secondary:active {
  transform: scale(0.97);
}
@media (hover: hover) and (pointer: fine) {
  .is-primary:hover {
    transform: translateY(-1px);
    box-shadow:
      0 0 0 1px hsl(var(--tac-amber) / 0.55),
      0 8px 22px -4px hsl(var(--tac-amber) / 0.7);
  }
  .is-secondary:hover {
    color: hsl(var(--destructive));
    border-color: hsl(var(--destructive) / 0.4);
  }
}
.draft-action:focus-visible {
  outline: 2px solid hsl(var(--foreground) / 0.8);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .draft-action,
  .draft-action-fill {
    transition: none;
  }
}
</style>
