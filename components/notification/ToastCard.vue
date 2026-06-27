<script setup lang="ts">
import { Check, X } from "lucide-vue-next";
import { Button } from "~/components/ui/button";

withDefaults(
  defineProps<{
    item: {
      id: string;
      kind: string;
      who: string;
      action: string;
      detail: string;
    };
    count?: number;
    pending?: "accept" | "decline" | null;
    elevated?: boolean;
  }>(),
  { count: 1, pending: null, elevated: false },
);

defineEmits<{ accept: []; decline: []; dismiss: [] }>();
</script>

<template>
  <div class="toast-card" :class="{ 'toast-card--elevated': elevated }">
    <span class="toast-accent" aria-hidden="true" />
    <div class="flex items-start justify-between gap-2">
      <span class="toast-kind">
        {{ item.kind }}
        <span v-if="count > 1" class="toast-count">{{ count }}</span>
      </span>
      <button
        type="button"
        class="toast-dismiss"
        :title="$t('layouts.notifications.dismiss')"
        @click="$emit('dismiss')"
      >
        <X class="h-3.5 w-3.5" />
      </button>
    </div>
    <div
      class="mt-1 text-sm font-semibold leading-snug text-[hsl(var(--tac-amber))]"
    >
      {{ item.who }}
    </div>
    <div class="mt-0.5 text-xs leading-snug text-muted-foreground">
      {{ item.action }}{{ item.detail ? " " + item.detail : "" }}
    </div>
    <div class="mt-2.5 flex gap-2">
      <Button
        size="sm"
        variant="tactical"
        class="toast-accept-button h-7 flex-1 rounded-[0.4rem] px-2 text-[0.7rem] font-semibold normal-case tracking-normal"
        :loading="pending === 'accept'"
        :disabled="pending === 'decline'"
        @click="$emit('accept')"
      >
        <Check class="h-3.5 w-3.5" />
        {{ $t("draft_games.room.accept_invite") }}
      </Button>
      <Button
        size="sm"
        variant="outline"
        class="h-7 flex-1 rounded-[0.4rem] border-border bg-transparent px-2 text-[0.7rem] font-semibold text-muted-foreground hover:border-[hsl(var(--destructive)/0.5)] hover:text-[hsl(var(--destructive))]"
        :loading="pending === 'decline'"
        :disabled="pending === 'accept'"
        @click="$emit('decline')"
      >
        <X class="h-3.5 w-3.5" />
        {{ $t("draft_games.room.decline_invite") }}
      </Button>
    </div>
  </div>
</template>

<style scoped>
.toast-card {
  pointer-events: auto;
  position: relative;
  overflow: hidden;
  border-radius: 0.55rem;
  border: 1px solid hsl(var(--tac-amber) / 0.32);
  background: hsl(var(--card) / 0.96);
  backdrop-filter: blur(10px);
  padding: 0.7rem 0.85rem 0.7rem 1rem;
  box-shadow:
    0 0 0 1px hsl(var(--tac-amber) / 0.12),
    0 14px 34px -10px rgba(0, 0, 0, 0.75);
  transition:
    box-shadow 0.22s ease,
    border-color 0.22s ease;
}
.toast-card--elevated {
  border-color: hsl(var(--tac-amber) / 0.6);
  background: hsl(var(--card) / 0.99);
  box-shadow:
    0 0 0 1px hsl(var(--tac-amber) / 0.35),
    0 0 22px -4px hsl(var(--tac-amber) / 0.35),
    0 26px 54px -12px rgba(0, 0, 0, 0.92);
}
.toast-accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: hsl(var(--tac-amber));
  box-shadow: 0 0 10px hsl(var(--tac-amber) / 0.7);
}
.toast-count {
  margin-left: 0.35rem;
  display: inline-flex;
  min-width: 1.05rem;
  justify-content: center;
  border-radius: 999px;
  background: hsl(var(--tac-amber) / 0.18);
  padding: 0 0.3rem;
  font-size: 0.56rem;
  color: hsl(var(--tac-amber));
}
.toast-dismiss {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
  transition: color 0.15s ease;
}
.toast-dismiss:hover {
  color: hsl(var(--foreground));
}
.toast-kind {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.56rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: hsl(var(--tac-amber));
}
.toast-accept-button {
  isolation: isolate;
  overflow: hidden;
  border: 1px solid hsl(var(--tac-amber) / 0.72);
  background: linear-gradient(
    180deg,
    hsl(var(--tac-amber) / 1) 0%,
    hsl(var(--tac-amber) / 0.9) 100%
  );
  box-shadow:
    0 0 0 1px hsl(var(--tac-amber) / 0.32),
    0 8px 18px -8px hsl(var(--tac-amber) / 0.75);
  transition:
    transform 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    filter 0.16s ease;
}
.toast-accept-button::before {
  content: "";
  position: absolute;
  inset: -40% -20%;
  z-index: 0;
  background: linear-gradient(
    110deg,
    transparent 30%,
    hsl(var(--tac-amber-foreground) / 0.22) 48%,
    transparent 66%
  );
  transform: translateX(-75%) rotate(8deg);
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-accept-button :deep(> span) {
  position: relative;
  z-index: 1;
}
.toast-accept-button:hover {
  transform: translateY(-1px);
  border-color: hsl(var(--tac-amber));
  filter: brightness(1.08) saturate(1.08);
  box-shadow:
    0 0 0 1px hsl(var(--tac-amber) / 0.5),
    0 0 18px -4px hsl(var(--tac-amber) / 0.95),
    0 12px 24px -10px hsl(var(--tac-amber) / 0.9);
}
.toast-accept-button:hover::before {
  transform: translateX(75%) rotate(8deg);
}
.toast-accept-button:active {
  transform: translateY(0);
}
.toast-accept-button:disabled {
  transform: none;
  filter: none;
}
</style>
