<script setup lang="ts">
import { computed } from "vue";
import { Crown, CheckCircle2 } from "lucide-vue-next";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import PlayerRanks from "~/components/draft-games/PlayerRanks.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";

const props = withDefaults(
  defineProps<{
    member: any;
    accent?: "amber" | "blue" | "neutral";
    isCaptain?: boolean;
    isHost?: boolean;
    showPickOrder?: boolean;
    dim?: boolean;
    matchType?: string | null;
    checkedIn?: boolean | null;
    draggable?: boolean;
    dragging?: boolean;
  }>(),
  {
    accent: "neutral",
    isCaptain: false,
    isHost: false,
    showPickOrder: false,
    dim: false,
    matchType: null,
    checkedIn: null,
    draggable: false,
    dragging: false,
  },
);

const emit = defineEmits<{
  (event: "dragstart", steamId: string): void;
  (event: "dragend"): void;
}>();

const onDragStart = (event: DragEvent) => {
  if (!props.draggable) {
    return;
  }
  // Firefox refuses to start a drag unless the transfer carries a payload.
  event.dataTransfer?.setData("text/plain", String(props.member.steam_id));
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
  emit("dragstart", String(props.member.steam_id));
};

const accentVar = computed(() => {
  if (props.accent === "amber") {
    return "var(--tac-amber)";
  }
  if (props.accent === "blue") {
    return "200 90% 62%";
  }
  return "var(--muted-foreground)";
});
</script>

<template>
  <div
    class="draft-player-card group relative flex h-14 items-center gap-2.5 rounded-lg border bg-card/60 pl-3 pr-2.5 transition-colors duration-200"
    :class="{
      'opacity-40 grayscale': dim,
      'is-draggable': draggable,
      'is-dragging': dragging,
    }"
    :style="{ '--accent': accentVar }"
    :draggable="draggable"
    @dragstart="onDragStart"
    @dragend="emit('dragend')"
  >
    <span class="accent-rail" aria-hidden="true"></span>

    <!-- Rendered even without a pick order so every row in a lineup keeps the
         same gutter and the avatars stay on one vertical line. -->
    <span v-if="showPickOrder" class="pick-numeral select-none" aria-hidden="true">
      {{ member.pick_order || "" }}
    </span>

    <FiveStackToolTip as-child side="top" :delay-duration="120">
      <template #trigger>
        <div class="min-w-0 flex-1 cursor-default">
          <PlayerDisplay
            :player="member.player"
            :show-online="false"
            :show-flag="true"
            :show-role="false"
            :show-add-friend="false"
            :show-elo="true"
            :truncate-name="true"
            :match-type="matchType"
            size="sm"
          >
            <template v-if="isCaptain" #avatar-corner>
              <span
                :title="$t('draft_games.room.captain')"
                class="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-[hsl(var(--tac-amber))] text-black shadow ring-1 ring-background"
              >
                <Crown class="h-2.5 w-2.5" />
              </span>
            </template>
          </PlayerDisplay>
        </div>
      </template>
      <PlayerRanks :player="member.player" />
    </FiveStackToolTip>

    <!-- Two separate transitions: the slot itself widens in when the match
         reaches check-in, and the pending dot swaps to the tick once the
         player is ready. Both used to appear with no animation at all. -->
    <Transition name="checkin-slot">
      <FiveStackToolTip v-if="checkedIn !== null" as-child side="top">
        <template #trigger>
          <span class="checkin-slot shrink-0 self-center">
            <Transition name="checkin-state" mode="out-in">
              <CheckCircle2
                v-if="checkedIn"
                key="ready"
                class="h-4 w-4 text-green-500"
              />
              <span
                v-else
                key="waiting"
                class="relative grid h-2.5 w-2.5 place-items-center"
              >
                <span
                  class="absolute inset-0 rounded-full bg-yellow-500/40 animate-ping"
                ></span>
                <span class="h-2 w-2 rounded-full bg-yellow-500"></span>
              </span>
            </Transition>
          </span>
        </template>
        {{
          checkedIn
            ? $t("match.check_in.checked_in")
            : $t("match.player.status.online_not_ready")
        }}
      </FiveStackToolTip>
    </Transition>

    <div class="flex shrink-0 items-center self-stretch">
      <slot name="action"></slot>
    </div>
  </div>
</template>

<style scoped>
.draft-player-card {
  border-color: hsl(var(--border));
}
.draft-player-card:hover {
  border-color: hsl(var(--accent) / 0.5);
}
.draft-player-card.is-draggable {
  cursor: grab;
}
.draft-player-card.is-draggable:active {
  cursor: grabbing;
}
.draft-player-card.is-dragging {
  opacity: 0.35;
  border-style: dashed;
}
/* The avatar root is inline-flex, so it sits on the parent's text baseline — and
   an inline-flex box's synthesized baseline differs between an <img> (bottom
   edge) and the text fallback (text baseline), shifting the avatar vertically
   and unbalancing the card. Make it block-level flex so both render identically. */
.draft-player-card :deep(.h-10.w-10) {
  display: flex;
}
.accent-rail {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: 2px 0 0 2px;
  background: hsl(var(--accent) / 0.85);
  opacity: 0.7;
}
.checkin-slot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  max-width: 1.25rem;
}
.checkin-slot-enter-active {
  transition:
    opacity 0.3s ease,
    transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
    max-width 0.4s cubic-bezier(0.16, 1, 0.3, 1),
    margin-left 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.checkin-slot-enter-from {
  opacity: 0;
  transform: scale(0.5);
  max-width: 0;
  /* Cancels the card's gap so the name does not shift before the slot opens. */
  margin-left: -0.625rem;
}
.checkin-state-enter-active,
.checkin-state-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.checkin-state-enter-from,
.checkin-state-leave-to {
  opacity: 0;
  transform: scale(0.4);
}
.pick-numeral {
  font-family: var(--font-mono, monospace);
  font-size: 0.85rem;
  font-weight: 800;
  line-height: 1;
  width: 1rem;
  flex-shrink: 0;
  text-align: center;
  color: hsl(var(--accent) / 0.55);
}
</style>
