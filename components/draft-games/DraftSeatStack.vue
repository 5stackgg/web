<script setup lang="ts">
import { Crown } from "lucide-vue-next";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import type { DraftHeaderSeat } from "~/components/draft-games/draftRoomHeader";

// A side's avatar stack in the draft room's scorebug, one seat per player, so
// it keeps one width as the side fills. In a captains draft it is the pick
// order: the captain under a crown, each pick under its number, the seat the
// captain on the clock is filling dashed in the side's colour, and the picks
// still to come numbered faintly.
defineProps<{
  seats: DraftHeaderSeat[];
  ordered: boolean;
}>();
</script>

<template>
  <span class="seat-stack" aria-hidden="true">
    <span
      v-for="seat in seats"
      :key="seat.key"
      class="seat"
      :class="{ 'is-current': seat.current }"
    >
      <Transition
        enter-active-class="seat-land"
        enter-from-class="seat-land-from"
        leave-active-class="seat-lift"
        leave-to-class="seat-lift-to"
      >
        <span v-if="seat.player" :key="seat.player.steamId" class="seat-fill">
          <Avatar class="seat-face size-5 text-[9px]" :title="seat.player.name">
            <AvatarImage v-if="seat.player.src" :src="seat.player.src" alt="" />
            <AvatarFallback>{{ seat.player.name?.slice(0, 1) }}</AvatarFallback>
          </Avatar>
          <i
            v-if="ordered && (seat.captain || seat.no)"
            class="seat-mark font-mono"
            :class="{ 'is-captain': seat.captain }"
          >
            <Crown v-if="seat.captain" class="size-[7px]" :stroke-width="2.8" />
            <template v-else>{{ seat.no }}</template>
          </i>
        </span>
        <span v-else key="open" class="seat-slot font-mono">{{
          seat.no ?? ""
        }}</span>
      </Transition>
    </span>
  </span>
</template>

<style scoped>
.seat-stack {
  display: flex;
  align-items: center;
}
.seat {
  position: relative;
  display: grid;
  flex: none;
  width: 1.25rem;
  height: 1.25rem;
}
/* Open seats overlap like faces, so the stack is one width however full. */
.seat + .seat {
  margin-left: -5px;
}
.seat > * {
  grid-area: 1 / 1;
}
.seat-fill {
  position: relative;
  display: grid;
}
.seat-face {
  box-shadow: 0 0 0 2px rgb(0 0 0 / 0.5);
}
.seat-slot {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  border-radius: 9999px;
  border: 1px dashed hsl(var(--muted-foreground) / 0.35);
  background: hsl(var(--background));
  font-size: 8.5px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--muted-foreground) / 0.7);
}
.seat.is-current .seat-slot {
  border: 1.5px dashed hsl(var(--team));
  color: hsl(var(--team));
  background:
    linear-gradient(hsl(var(--team) / 0.14), hsl(var(--team) / 0.14)),
    hsl(var(--background));
}
/* Bottom right of the face, in the side's colour; the captain's is a crown,
   outlined. */
.seat-mark {
  position: absolute;
  right: -4px;
  bottom: -4px;
  z-index: 1;
  display: grid;
  place-items: center;
  min-width: 11px;
  height: 11px;
  padding: 0 2px;
  border-radius: 6px;
  font-size: 7.5px;
  font-weight: 700;
  font-style: normal;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  background: hsl(var(--team));
  color: hsl(240 10% 4%);
  box-shadow: 0 0 0 1.5px hsl(var(--background));
}
.seat-mark.is-captain {
  background: hsl(var(--background));
  color: hsl(var(--team));
  box-shadow:
    0 0 0 1.5px hsl(var(--background)),
    inset 0 0 0 1px hsl(var(--team) / 0.55);
}
.seat-land {
  transition:
    opacity 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}
.seat-land-from {
  opacity: 0;
  transform: scale(0.6);
}
.seat-lift {
  transition: opacity 0.11s ease-in;
}
.seat-lift-to {
  opacity: 0;
}
@container draft-header (max-width: 619px) {
  .seat {
    width: 1.125rem;
    height: 1.125rem;
  }
  .seat + .seat {
    margin-left: -4px;
  }
  .seat-face {
    width: 1.125rem;
    height: 1.125rem;
    font-size: 8px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .seat-land,
  .seat-lift {
    transition-duration: 1ms;
  }
}
</style>
