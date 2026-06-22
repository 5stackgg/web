<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";

const props = defineProps<{
  room: any;
}>();

const emit = defineEmits<{ (e: "done"): void }>();

const captains = computed(() =>
  (props.room.players || [])
    .filter((p: any) => p.is_captain)
    .sort((a: any, b: any) => (a.lineup || 0) - (b.lineup || 0)),
);

const firstLineup = computed(() => props.room.current_pick_lineup || 1);
const firstCaptain = computed(() =>
  captains.value.find((c: any) => c.lineup === firstLineup.value),
);

const phase = ref<"flip" | "reveal">("flip");

let revealTimer: ReturnType<typeof setTimeout> | undefined;
let doneTimer: ReturnType<typeof setTimeout> | undefined;

onMounted(() => {
  revealTimer = setTimeout(() => {
    phase.value = "reveal";
  }, 1600);
  doneTimer = setTimeout(() => {
    emit("done");
  }, 4200);
});

onUnmounted(() => {
  if (revealTimer) {
    clearTimeout(revealTimer);
  }
  if (doneTimer) {
    clearTimeout(doneTimer);
  }
});
</script>

<template>
  <div class="coin-overlay" @click="emit('done')">
    <div class="coin-stage" @click.stop>
      <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
        <div
          class="cap cap-alpha"
          :class="{ winner: phase === 'reveal' && firstLineup === 1, dim: phase === 'reveal' && firstLineup !== 1 }"
        >
          <PlayerDisplay
            v-if="captains[0]"
            :player="captains[0].player"
            :show-online="false"
            :show-flag="false"
            :show-role="false"
            :show-add-friend="false"
            :show-elo="false"
          />
          <span class="cap-label alpha-label">{{ $t("draft_games.room.team_alpha") }}</span>
        </div>

        <div class="coin" :class="phase">
          <div class="coin-face coin-front">VS</div>
          <div class="coin-face coin-back">VS</div>
        </div>

        <div
          class="cap cap-bravo"
          :class="{ winner: phase === 'reveal' && firstLineup === 2, dim: phase === 'reveal' && firstLineup !== 2 }"
        >
          <PlayerDisplay
            v-if="captains[1]"
            :player="captains[1].player"
            :show-online="false"
            :show-flag="false"
            :show-role="false"
            :show-add-friend="false"
            :show-elo="false"
          />
          <span class="cap-label bravo-label">{{ $t("draft_games.room.team_bravo") }}</span>
        </div>
      </div>

      <div class="mt-6 flex min-h-[1.75rem] items-center justify-center text-center">
        <Transition name="reveal-text">
          <div
            v-if="phase === 'reveal'"
            class="font-sans text-lg font-bold uppercase tracking-[0.18em] text-foreground"
          >
            {{ $t("draft_games.room.picks_first", { name: firstCaptain?.player?.name || "" }) }}
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.coin-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  background: hsl(var(--background) / 0.82);
  backdrop-filter: blur(8px);
  animation: overlay-in 0.25s ease;
}
@keyframes overlay-in {
  from {
    opacity: 0;
  }
}
.coin-stage {
  width: min(90vw, 520px);
  border: 1px solid hsl(var(--tac-amber) / 0.3);
  border-radius: 1rem;
  background: linear-gradient(180deg, hsl(var(--card) / 0.95), hsl(var(--card) / 0.85));
  box-shadow:
    0 0 0 1px hsl(var(--tac-amber) / 0.2),
    0 0 60px hsl(var(--tac-amber) / 0.2);
  padding: 2rem;
}
.cap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.4s ease;
}
.cap-label {
  font-family: var(--font-mono, monospace);
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.16em;
}
.alpha-label {
  color: hsl(var(--tac-amber));
}
.bravo-label {
  color: hsl(200 90% 62%);
}
.cap.dim {
  opacity: 0.35;
  filter: grayscale(0.6);
}
.cap.winner {
  transform: scale(1.08);
}
.coin {
  position: relative;
  height: 56px;
  width: 56px;
  transform-style: preserve-3d;
}
.coin.flip {
  animation: coin-spin 1.6s cubic-bezier(0.5, 0, 0.3, 1);
}
.coin-face {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border-radius: 9999px;
  border: 2px solid hsl(var(--tac-amber));
  background: linear-gradient(135deg, var(--tac-amber-cta-from) 0%, hsl(var(--tac-amber)) 100%);
  color: hsl(var(--tac-amber-foreground));
  font-family: var(--font-sans);
  font-weight: 800;
  letter-spacing: 0.1em;
  backface-visibility: hidden;
}
.coin-back {
  transform: rotateY(180deg);
}
@keyframes coin-spin {
  0% {
    transform: rotateY(0) scale(0.9);
  }
  100% {
    transform: rotateY(1980deg) scale(1);
  }
}
.reveal-text-enter-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.reveal-text-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
@media (prefers-reduced-motion: reduce) {
  .coin.flip {
    animation: none;
  }
}
</style>
