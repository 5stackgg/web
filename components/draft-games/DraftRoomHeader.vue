<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useSlots, watch } from "vue";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Spinner } from "~/components/ui/spinner";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import Fold from "~/components/ui/transitions/Fold.vue";
import { useElementSize } from "@vueuse/core";
import { useCountdown } from "~/composables/useCountdown";
import type {
  DraftHeaderSide,
  DraftHeaderState,
} from "~/components/draft-games/draftRoomHeader";

const props = defineProps<{
  state: DraftHeaderState;
  seats: { filled: number; capacity: number };
  sides: [DraftHeaderSide, DraftHeaderSide];
  winsNeeded: number;
  track: boolean;
}>();

const slots = useSlots();

// The menu holds whatever MatchActions shows (cameras, pause, the menu), so the
// scorebug keeps clear of its measured width rather than a guess.
const menuEl = ref<HTMLElement | null>(null);
const { width: menuWidth } = useElementSize(menuEl);
const menuRoom = computed(() =>
  menuWidth.value ? `${Math.ceil(menuWidth.value) + 12}px` : "0px",
);

const SLOTS = [1, 2] as const;

const open = computed(() => props.state.phase !== "lobby");

const TONES = {
  amber: "var(--tac-amber)",
  muted: "var(--muted-foreground)",
  success: "var(--foreground)",
};

const sideVar = (side: 1 | 2 | null) =>
  side === 2 ? "var(--tac-blue)" : "var(--tac-amber)";

const RING = 2 * Math.PI * 19;
const ringOffset = computed(() => {
  const { filled, capacity } = props.seats;
  if (!capacity) {
    return RING;
  }
  return RING * (1 - Math.min(1, filled / capacity));
});

const box = computed(() => props.state.box);
const { seconds, urgent, meter } = useCountdown(
  computed(() => (box.value.kind === "clock" ? box.value.deadline : null)),
  computed(() => (box.value.kind === "clock" ? box.value.total : 0)),
);
const clock = computed(
  () =>
    `${Math.floor(seconds.value / 60)}:${String(seconds.value % 60).padStart(2, "0")}`,
);

// The room's own call to action takes the box's place once the scorebug is up.
const boxKey = computed(() => `${box.value.kind}${slots.cta ? "-cta" : ""}`);
const ctaCaption = computed(() =>
  box.value.kind === "count"
    ? `${box.value.value}/${box.value.of} ${box.value.caption}`
    : "caption" in box.value
      ? box.value.caption
      : "",
);

const crestRing = (side: 1 | 2) => {
  if (props.state.onClock === side) {
    return {
      boxShadow: `0 0 0 2px hsl(${sideVar(side)}), 0 0 22px hsl(${sideVar(side)} / 0.35)`,
    };
  }
  if (props.sides[side - 1].mine) {
    return {
      boxShadow:
        "0 0 0 2px hsl(var(--tac-amber)), 0 8px 24px -8px rgb(0 0 0 / 0.8)",
    };
  }
  return undefined;
};

const emptySeats = (side: DraftHeaderSide) =>
  Math.max(0, side.seats - side.players.length);

// The scorebug unfolds out of the bar when the draft starts; a page opened
// mid-draft just shows it.
const opening = ref(false);
let openingTimer: ReturnType<typeof setTimeout> | undefined;
watch(open, (now, was) => {
  if (!now || was) {
    return;
  }
  opening.value = true;
  clearTimeout(openingTimer);
  openingTimer = setTimeout(() => {
    opening.value = false;
  }, 900);
});
onBeforeUnmount(() => clearTimeout(openingTimer));
</script>

<template>
  <section
    class="draft-header relative overflow-hidden rounded-xl border border-border bg-card/40 bg-[linear-gradient(180deg,rgb(255_255_255/0.035),transparent_70%)] [backdrop-filter:blur(8px)]"
    :class="{ 'is-hot': state.hot, 'is-opening': opening }"
    :style="{ '--tone': TONES[state.tone] }"
    :aria-label="$t('draft_games.header.label')"
  >
    <p class="sr-only" aria-live="polite">
      {{ state.title }} {{ state.detail }}
    </p>

    <!-- The bar is the lobby's whole header; once the draft starts the
         scorebug says all of it, so the bar folds away as it opens. -->
    <Fold :open="!open">
      <div class="draft-header-row">
        <span
          class="relative grid size-11 place-items-center"
          :class="
            seats.filled >= seats.capacity
              ? 'text-[hsl(var(--tac-amber))]'
              : 'text-muted-foreground'
          "
        >
          <svg
            viewBox="0 0 44 44"
            class="absolute inset-0 size-11 -rotate-90"
            aria-hidden="true"
          >
            <circle
              cx="22"
              cy="22"
              r="19"
              fill="none"
              stroke="hsl(var(--border))"
              stroke-width="3"
            />
            <circle
              cx="22"
              cy="22"
              r="19"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              class="transition-[stroke-dashoffset] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
              :stroke-dasharray="RING"
              :stroke-dashoffset="ringOffset"
            />
          </svg>
          <span
            class="relative font-mono text-[11px] font-bold tabular-nums text-foreground"
          >
            {{ seats.filled }}/{{ seats.capacity }}
          </span>
        </span>

        <div class="grid min-w-0" aria-hidden="true">
          <FadeSwap class="min-w-0">
            <p
              :key="state.title"
              class="truncate text-[15px] font-bold leading-[22px]"
              :class="state.hot && 'text-[hsl(var(--tone))]'"
              :title="state.title"
            >
              {{ state.title }}
            </p>
          </FadeSwap>
          <FadeSwap class="min-w-0">
            <p
              :key="state.detail"
              class="draft-header-detail text-[13px] leading-[18px] text-muted-foreground"
              :title="state.detail"
            >
              {{ state.detail }}
            </p>
          </FadeSwap>
        </div>

        <div class="flex shrink-0 items-center justify-end gap-2">
          <slot name="actions" />
        </div>
      </div>
    </Fold>

    <Fold :open="open">
      <div class="draft-header-body">
        <div ref="menuEl" class="draft-header-menu">
          <slot name="menu" />
        </div>
        <div class="draft-bug" :style="{ '--menu-room': menuRoom }">
          <div
            v-for="slot in SLOTS"
            :key="slot"
            class="draft-bug-side"
            :class="slot === 1 ? 'is-left' : 'is-right'"
          >
            <span
              aria-hidden="true"
              class="draft-bug-crest grid shrink-0 place-items-center overflow-hidden rounded-[10px] bg-muted text-sm font-extrabold tracking-wide text-foreground/85 shadow-[0_8px_24px_-8px_rgb(0_0_0/0.8)] ring-1 ring-inset ring-white/10 transition-shadow duration-200"
              :style="crestRing(slot)"
            >
              <img
                v-if="sides[slot - 1].crest"
                :src="sides[slot - 1].crest ?? undefined"
                alt=""
                class="size-full object-cover"
              />
              <template v-else>{{ sides[slot - 1].monogram }}</template>
            </span>
            <div class="draft-bug-id grid min-w-0 gap-1.5">
              <h2
                class="draft-bug-name font-bold leading-[1.12] [text-wrap:balance]"
                :title="sides[slot - 1].name"
              >
                {{ sides[slot - 1].name }}
              </h2>
              <div class="draft-bug-roster flex items-center gap-2">
                <div class="flex items-center">
                  <div class="flex -space-x-[5px]">
                    <Avatar
                      v-for="player in sides[slot - 1].players"
                      :key="player.steamId"
                      class="size-5 text-[9px] ring-2 ring-black/50"
                      :title="player.name"
                    >
                      <AvatarImage v-if="player.src" :src="player.src" alt="" />
                      <AvatarFallback>{{
                        player.name?.slice(0, 1)
                      }}</AvatarFallback>
                    </Avatar>
                  </div>
                  <span
                    v-if="emptySeats(sides[slot - 1])"
                    class="flex gap-[3px]"
                    :class="sides[slot - 1].players.length ? 'ml-[3px]' : ''"
                  >
                    <i
                      v-for="seat in emptySeats(sides[slot - 1])"
                      :key="seat"
                      class="size-5 rounded-full border border-dashed border-muted-foreground/35 bg-background"
                    ></i>
                  </span>
                </div>
                <span
                  class="font-mono text-[11px] tabular-nums text-muted-foreground"
                >
                  {{ sides[slot - 1].players.length }}/{{
                    sides[slot - 1].seats
                  }}
                </span>
                <span v-if="winsNeeded" class="inline-flex gap-[3px]">
                  <i
                    v-for="pip in winsNeeded"
                    :key="pip"
                    class="size-1.5 rounded-[1px] bg-muted-foreground/30"
                  ></i>
                </span>
              </div>
            </div>
          </div>

          <div
            class="draft-bug-box relative flex min-h-[72px] items-stretch overflow-hidden rounded-[10px] bg-black/40 ring-1 ring-inset ring-white/[0.09]"
            :style="{
              '--side': sideVar(box.kind === 'clock' ? box.side : null),
            }"
          >
            <span
              v-if="state.onClock"
              class="draft-bug-caret"
              :class="state.onClock === 1 ? 'is-left' : 'is-right'"
              aria-hidden="true"
            ></span>
            <div class="grid flex-1">
              <Transition
                mode="out-in"
                enter-active-class="transition-opacity [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
                leave-active-class="transition-opacity [transition-duration:110ms] ease-in motion-reduce:![transition-duration:1ms]"
                enter-from-class="opacity-0"
                leave-to-class="opacity-0"
              >
                <div
                  :key="boxKey"
                  class="grid place-content-center justify-items-center gap-1 px-4 py-2 text-center"
                >
                  <template v-if="$slots.cta">
                    <div class="flex items-center gap-2">
                      <slot name="cta" />
                    </div>
                    <span
                      class="whitespace-nowrap text-xs tabular-nums text-muted-foreground"
                    >
                      {{ ctaCaption }}
                    </span>
                  </template>
                  <template v-else-if="box.kind === 'clock'">
                    <span
                      class="text-[30px] font-extrabold leading-none tabular-nums"
                      :class="
                        urgent ? 'text-destructive' : 'text-[hsl(var(--side))]'
                      "
                    >
                      {{ box.deadline ? clock : "—" }}
                    </span>
                    <span
                      class="whitespace-nowrap text-xs tabular-nums text-muted-foreground"
                    >
                      {{ box.caption }}
                    </span>
                  </template>
                  <template v-else-if="box.kind === 'count'">
                    <span
                      class="inline-flex items-baseline text-[30px] font-extrabold leading-none tabular-nums"
                    >
                      {{ box.value
                      }}<span class="text-base text-muted-foreground/60"
                        >/{{ box.of }}</span
                      >
                    </span>
                    <span
                      class="whitespace-nowrap text-xs text-muted-foreground"
                    >
                      {{ box.caption }}
                    </span>
                  </template>
                  <template v-else-if="box.kind === 'map'">
                    <span
                      class="inline-flex items-center gap-2 text-base font-bold"
                    >
                      <img
                        v-if="box.patch"
                        :src="box.patch"
                        alt=""
                        class="size-5 object-contain"
                      />
                      {{ box.label }}
                    </span>
                    <span
                      class="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground"
                    >
                      <Spinner class="size-3 text-[hsl(var(--tac-amber))]" />
                      {{ box.caption }}
                    </span>
                  </template>
                  <span v-else class="text-lg font-bold text-muted-foreground">
                    {{ $t("common.vs") }}
                  </span>
                </div>
              </Transition>
            </div>
            <span
              v-if="box.kind === 'clock' && box.deadline"
              ref="meter"
              class="draft-bug-bar"
              aria-hidden="true"
            ></span>
          </div>
        </div>

        <Fold :open="track">
          <div class="draft-header-track">
            <slot name="track" />
          </div>
        </Fold>
      </div>
    </Fold>
  </section>
</template>

<style scoped>
.draft-header {
  container: draft-header / inline-size;
  transition:
    border-color 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}
.draft-header.is-hot {
  border-color: hsl(var(--tone) / 0.55);
  box-shadow: 0 0 26px -10px hsl(var(--tone) / 0.4);
}
.draft-header-row {
  display: grid;
  grid-template-columns: 2.75rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.875rem;
  height: 4.5rem;
  padding: 0 0.875rem 0 1rem;
}
.draft-header-detail {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.draft-header-body {
  position: relative;
  padding: 1.125rem 1.5rem 1.25rem;
}
.draft-header-menu {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 1;
}
/* The track scrolls inside the header's width; without containment its cells
   would widen the folds around it and push the scorebug off the card. */
.draft-header-track {
  padding-top: 1.125rem;
  contain: inline-size;
}
.draft-bug {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  grid-template-areas: "left box right";
  align-items: center;
  gap: 1.25rem;
  padding-inline: var(--menu-room);
}
.draft-bug-side {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 1rem;
}
.draft-bug-side.is-left {
  grid-area: left;
  flex-direction: row-reverse;
  text-align: right;
}
.draft-bug-side.is-left .draft-bug-id {
  justify-items: end;
}
.draft-bug-side.is-left .draft-bug-roster {
  flex-direction: row-reverse;
}
.draft-bug-side.is-right {
  grid-area: right;
}
.draft-bug-crest {
  width: 3.5rem;
  height: 3.5rem;
}
.draft-bug-name {
  font-size: clamp(1.125rem, 3cqi, 1.625rem);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.draft-bug-box {
  grid-area: box;
  min-width: 10.5rem;
}
.draft-bug-bar {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  height: 2px;
  transform-origin: left;
  transform: scaleX(var(--countdown, 1));
  background: hsl(var(--side));
  pointer-events: none;
}
.draft-bug-caret {
  position: absolute;
  top: 50%;
  width: 0;
  height: 0;
  border: 6px solid transparent;
  transform: translateY(-50%);
  pointer-events: none;
}
.draft-bug-caret.is-left {
  left: 7px;
  border-left-width: 0;
  border-right-color: hsl(var(--side));
}
.draft-bug-caret.is-right {
  right: 7px;
  border-right-width: 0;
  border-left-color: hsl(var(--side));
}

.is-opening .draft-bug-box {
  animation: draft-box-in 0.24s cubic-bezier(0.16, 1, 0.3, 1) 0.06s both;
}
.is-opening .draft-bug-side.is-left {
  animation: draft-left-in 0.24s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
}
.is-opening .draft-bug-side.is-right {
  animation: draft-right-in 0.24s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
}
.is-opening .draft-header-track :deep(.pick-cell) {
  animation: draft-cell-in 0.24s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(0.14s + var(--i, 0) * 35ms);
}
@keyframes draft-box-in {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
}
@keyframes draft-left-in {
  from {
    opacity: 0;
    transform: translateX(24px);
  }
}
@keyframes draft-right-in {
  from {
    opacity: 0;
    transform: translateX(-24px);
  }
}
@keyframes draft-cell-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}

@container draft-header (max-width: 619px) {
  .draft-header-row {
    grid-template-columns: 2.5rem minmax(0, 1fr) auto;
    gap: 0.625rem;
    height: 5.25rem;
    padding: 0 0.625rem 0 0.75rem;
  }
  .draft-header-detail {
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .draft-header-body {
    padding: 0.875rem 0.75rem 1rem;
  }
  .draft-header-menu {
    top: 0.5rem;
    right: 0.5rem;
  }
  .draft-bug {
    padding-inline: 0 var(--menu-room);
  }
  .draft-header-track {
    padding-top: 0.875rem;
  }
  .draft-bug {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "left box"
      "right box";
    gap: 0.625rem 0.75rem;
  }
  .draft-bug-side {
    gap: 0.625rem;
  }
  .draft-bug-side.is-left {
    flex-direction: row;
    text-align: left;
  }
  .draft-bug-side.is-left .draft-bug-id {
    justify-items: start;
  }
  .draft-bug-side.is-left .draft-bug-roster {
    flex-direction: row;
  }
  .draft-bug-crest {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.5rem;
    font-size: 0.75rem;
  }
  .draft-bug-name {
    font-size: 0.9375rem;
    -webkit-line-clamp: 1;
  }
  .draft-bug-box {
    min-width: 6.5rem;
    align-self: stretch;
  }
  .draft-bug-caret.is-left,
  .draft-bug-caret.is-right {
    left: 6px;
    right: auto;
    border-left-width: 0;
    border-right-width: 6px;
    border-left-color: transparent;
    border-right-color: hsl(var(--side));
  }
  .draft-bug-caret.is-left {
    top: 27%;
  }
  .draft-bug-caret.is-right {
    top: 73%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .draft-header,
  .is-opening .draft-bug-box,
  .is-opening .draft-bug-side.is-left,
  .is-opening .draft-bug-side.is-right,
  .is-opening .draft-header-track :deep(.pick-cell) {
    animation: none;
    transition: none;
  }
}
</style>
