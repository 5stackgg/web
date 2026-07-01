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
  }>(),
  {
    accent: "neutral",
    isCaptain: false,
    isHost: false,
    showPickOrder: false,
    dim: false,
    matchType: null,
    checkedIn: null,
  },
);

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
    :class="{ 'opacity-40 grayscale': dim }"
    :style="{ '--accent': accentVar }"
  >
    <span class="accent-rail" aria-hidden="true"></span>

    <span
      v-if="showPickOrder && member.pick_order"
      class="pick-numeral select-none"
      aria-hidden="true"
    >
      {{ member.pick_order }}
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

    <FiveStackToolTip v-if="checkedIn !== null" as-child side="top">
      <template #trigger>
        <span class="shrink-0 self-center">
          <CheckCircle2 v-if="checkedIn" class="h-4 w-4 text-green-500" />
          <span v-else class="relative grid h-2.5 w-2.5 place-items-center">
            <span
              class="absolute inset-0 rounded-full bg-yellow-500/40 animate-ping"
            ></span>
            <span class="h-2 w-2 rounded-full bg-yellow-500"></span>
          </span>
        </span>
      </template>
      {{
        checkedIn
          ? $t("match.check_in.checked_in")
          : $t("match.player.status.online_not_ready")
      }}
    </FiveStackToolTip>

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
/* PlayerDisplay's grid row top-anchors inside its own min-height, so the
   leftover space falls to the bottom of the fixed-height card (uneven top/bottom
   padding). Center both the row and each column so content sits centered
   regardless of the name/elo block height. */
.draft-player-card :deep(.min-h-12) {
  align-items: center;
  align-content: center;
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
