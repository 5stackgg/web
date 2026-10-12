<script setup lang="ts">
import { tacticalCtaButtonClasses } from "~/utilities/tacticalClasses";

defineProps<{
  canJoin: boolean;
  hasRequested: boolean;
  isWaitlisted: boolean;
  isInvited: boolean;
  lobbyFull: boolean;
  requireApproval: boolean;
  inline?: boolean;
}>();

const emit = defineEmits<{
  (event: "join"): void;
  (event: "leave"): void;
  (event: "respond", accept: boolean): void;
}>();
</script>

<template>
  <div>
    <Transition name="banner">
      <div
        v-if="canJoin || hasRequested || isWaitlisted"
        class="self-banner flex flex-col items-start gap-2 rounded-xl border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.06)] p-3"
        :class="inline ? '' : 'mb-3'"
      >
        <span
          class="font-mono text-[0.62rem] uppercase leading-relaxed tracking-[0.18em] text-[hsl(var(--tac-amber))]"
        >
          {{
            hasRequested
              ? $t("draft_games.room.request_pending")
              : isWaitlisted
                ? $t("draft_games.room.waitlist_pending")
                : lobbyFull
                  ? $t("draft_games.room.waitlist_prompt")
                  : requireApproval
                    ? $t("draft_games.room.request_prompt")
                    : $t("draft_games.room.join_prompt")
          }}
        </span>
        <button
          v-if="canJoin"
          type="button"
          :class="tacticalCtaButtonClasses"
          @click="emit('join')"
        >
          {{
            requireApproval
              ? $t("draft_games.card.request")
              : lobbyFull
                ? $t("draft_games.room.join_waitlist")
                : $t("draft_games.card.join")
          }}
        </button>
        <button
          v-else-if="isWaitlisted"
          type="button"
          class="rounded-md border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
          @click="emit('leave')"
        >
          {{ $t("draft_games.room.leave_waitlist") }}
        </button>
        <span
          v-else
          class="flex items-center gap-1.5 font-mono text-xs text-muted-foreground"
        >
          {{ $t("draft_games.card.requested") }}
        </span>
      </div>
    </Transition>

    <Transition name="banner">
      <div
        v-if="isInvited"
        class="self-banner flex flex-col items-start gap-2 rounded-xl border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.06)] p-3"
        :class="inline ? '' : 'mb-3'"
      >
        <span
          class="font-mono text-[0.62rem] uppercase leading-relaxed tracking-[0.18em] text-[hsl(var(--tac-amber))]"
        >
          {{ $t("draft_games.room.invite_pending") }}
        </span>
        <div class="flex gap-2">
          <button
            type="button"
            :class="tacticalCtaButtonClasses"
            @click="emit('respond', true)"
          >
            {{ $t("draft_games.room.accept_invite") }}
          </button>
          <button
            type="button"
            class="rounded-md border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
            @click="emit('respond', false)"
          >
            {{ $t("draft_games.room.decline_invite") }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.self-banner {
  max-height: 16rem;
}
.banner-enter-active,
.banner-leave-active {
  overflow: hidden;
  transition:
    max-height 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    margin-bottom 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.2s ease,
    transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.banner-enter-from,
.banner-leave-to {
  max-height: 0;
  margin-bottom: 0;
  padding-top: 0;
  padding-bottom: 0;
  border-width: 0;
  opacity: 0;
  transform: translateY(-4px);
}
@media (prefers-reduced-motion: reduce) {
  .banner-enter-active,
  .banner-leave-active {
    transition-duration: 1ms;
  }
}
</style>
