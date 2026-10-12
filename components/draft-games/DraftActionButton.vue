<script setup lang="ts">
import { ref } from "vue";
import { ArrowUp, Crown, UserPlus, X } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";

const props = withDefaults(
  defineProps<{
    label: string;
    icon: "add" | "captain" | "start" | "remove";
    tone?: "amber" | "blue" | "neutral";
    side?: number | null;
    disabled?: boolean;
    action: () => unknown;
  }>(),
  {
    tone: "neutral",
    side: null,
    disabled: false,
  },
);

// The tooltip trigger stamps data-state on the Button, which turns off its own
// promise tracking, so the pending state is held here instead.
const busy = ref(false);

const run = async () => {
  const result = props.action();
  if (!result || typeof (result as Promise<unknown>).then !== "function") {
    return;
  }
  busy.value = true;
  try {
    await result;
  } finally {
    busy.value = false;
  }
};
</script>

<template>
  <FiveStackToolTip
    as-child
    side="top"
    :delay-duration="120"
    :tap-toggle="false"
  >
    <template #trigger>
      <Button
        variant="ghost"
        type="button"
        class="draft-action relative [&_svg]:size-3.5"
        :class="[`tone-${tone}`, icon === 'remove' ? 'is-remove' : '']"
        :aria-label="label"
        :disabled="disabled"
        :loading="busy"
        @click="run"
      >
        <UserPlus v-if="icon === 'add'" />
        <Crown v-else-if="icon === 'captain'" />
        <ArrowUp v-else-if="icon === 'start'" />
        <X v-else />
        <span v-if="side" class="side-badge" aria-hidden="true">
          {{ side }}
        </span>
      </Button>
    </template>
    {{ label }}
  </FiveStackToolTip>
</template>

<style scoped>
.draft-action {
  display: grid;
  place-items: center;
  height: 1.75rem;
  width: 1.75rem;
  padding: 0;
  border-radius: 0.375rem;
  border: 1px solid;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease;
}
.side-badge {
  position: absolute;
  right: 1px;
  bottom: 0;
  font-family: var(--font-mono, monospace);
  font-size: 0.5rem;
  font-weight: 800;
  line-height: 1;
}
.draft-action:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.tone-amber,
.tone-blue {
  color: hsl(var(--tone));
  border-color: hsl(var(--tone) / 0.4);
  background: hsl(var(--tone) / 0.1);
}
.tone-amber {
  --tone: var(--tac-amber);
}
.tone-blue {
  --tone: var(--tac-blue);
}
.tone-amber:hover:not(:disabled),
.tone-blue:hover:not(:disabled) {
  color: hsl(var(--tone));
  background: hsl(var(--tone) / 0.25);
}
.tone-neutral {
  color: hsl(var(--muted-foreground));
  border-color: hsl(var(--border));
  background: transparent;
}
.tone-neutral:hover:not(:disabled) {
  color: hsl(var(--tac-amber));
  border-color: hsl(var(--tac-amber) / 0.5);
  background: hsl(var(--tac-amber) / 0.12);
}
.tone-neutral.is-remove:hover:not(:disabled) {
  color: hsl(var(--destructive));
  border-color: hsl(var(--destructive) / 0.4);
  background: hsl(var(--destructive) / 0.12);
}
</style>
