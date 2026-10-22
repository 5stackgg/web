<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useSlots, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Crown } from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import DraftSeatStack from "~/components/draft-games/DraftSeatStack.vue";
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
}>();

const slots = useSlots();
const { t } = useI18n();

// The menu holds whatever MatchActions shows. A lone menu button fits in the
// corner with a little room kept clear on both sides of the scorebug; anything
// wider (cameras, pause) gets a row of its own, as clearing it on both sides
// would squeeze the team names away.
const menuEl = ref<HTMLElement | null>(null);
const { width: menuWidth } = useElementSize(menuEl);
const menuInRow = computed(() => menuWidth.value > 56);
const menuRoom = computed(() =>
  menuWidth.value && !menuInRow.value
    ? `${Math.ceil(menuWidth.value) + 12}px`
    : "0px",
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
  "caption" in box.value ? box.value.caption : "",
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

// The pick order opens on hover with a mouse, and on a tap or a key press
// otherwise. A click on a stack the mouse already opened leaves it open.
const stackOpen = ref<1 | 2 | null>(null);
let hovered: 1 | 2 | null = null;
const hoverStack = (slot: 1 | 2, event: PointerEvent) => {
  if (event.pointerType === "mouse") {
    hovered = slot;
    stackOpen.value = slot;
  }
};
const leaveStack = (slot: 1 | 2, event: PointerEvent) => {
  if (event.pointerType === "mouse" && hovered === slot) {
    hovered = null;
    stackOpen.value = null;
  }
};
const onStackOpen = (slot: 1 | 2, value: boolean) => {
  if (value) {
    stackOpen.value = slot;
  } else if (hovered !== slot && stackOpen.value === slot) {
    stackOpen.value = null;
  }
};
const stackLabel = (slot: 1 | 2) =>
  `${props.sides[slot - 1].name} · ${t("draft_games.room.pick_order")}`;

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
          class="draft-header-ring relative grid size-11 place-items-center"
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
              class="text-[15px] font-bold leading-[22px] [text-wrap:balance]"
              :class="state.hot && 'text-[hsl(var(--tone))]'"
            >
              {{ state.title }}
            </p>
          </FadeSwap>
          <FadeSwap class="min-w-0">
            <p
              :key="state.detail"
              class="text-[13px] leading-[18px] text-muted-foreground [text-wrap:pretty]"
            >
              {{ state.detail }}
            </p>
          </FadeSwap>
        </div>

        <div
          class="draft-header-actions flex shrink-0 items-center justify-end gap-2"
        >
          <slot name="actions" />
        </div>
      </div>
      <slot name="lobby" />
    </Fold>

    <Fold :open="open">
      <div class="draft-header-body">
        <div class="draft-header-menu" :class="{ 'is-row': menuInRow }">
          <span ref="menuEl" class="inline-flex items-center gap-2">
            <slot name="menu" />
          </span>
        </div>
        <div class="draft-bug" :style="{ '--menu-room': menuRoom }">
          <div
            v-for="slot in SLOTS"
            :key="slot"
            class="draft-bug-side"
            :class="slot === 1 ? 'is-left' : 'is-right'"
            :style="{ '--team': sideVar(slot) }"
          >
            <span
              aria-hidden="true"
              :data-scorebug="`crest-${slot}`"
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
            <div
              class="draft-bug-id grid min-w-0 gap-1.5"
              :data-scorebug="`team-${slot}`"
            >
              <h2
                class="draft-bug-name font-bold leading-[1.12] [text-wrap:balance]"
                :title="sides[slot - 1].name"
              >
                {{ sides[slot - 1].name }}
              </h2>
              <div class="draft-bug-roster flex items-center gap-2">
                <!-- In a captains draft the stack is the pick order; hovered
                     or tapped, it names everyone in it. -->
                <Popover
                  v-if="sides[slot - 1].ordered"
                  :open="stackOpen === slot"
                  @update:open="(value: boolean) => onStackOpen(slot, value)"
                >
                  <PopoverTrigger as-child>
                    <button
                      type="button"
                      class="draft-bug-stack"
                      :aria-label="stackLabel(slot)"
                      @pointerenter="hoverStack(slot, $event)"
                      @pointerleave="leaveStack(slot, $event)"
                    >
                      <DraftSeatStack :seats="sides[slot - 1].seats" ordered />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom"
                    :align="slot === 1 ? 'end' : 'start'"
                    class="w-auto p-2"
                    @open-auto-focus.prevent
                    @close-auto-focus.prevent
                  >
                    <div
                      class="draft-stack-pop"
                      :style="{ '--team': sideVar(slot) }"
                    >
                      <p class="draft-stack-pop-head">
                        {{ sides[slot - 1].name }} ·
                        {{ $t("draft_games.room.pick_order") }}
                      </p>
                      <ol>
                        <li
                          v-for="seat in sides[slot - 1].seats"
                          :key="seat.key"
                          :class="{
                            'is-current': seat.current,
                            'is-open': !seat.player && !seat.current,
                          }"
                        >
                          <i
                            class="draft-stack-pop-mark font-mono"
                            :class="{ 'is-captain': seat.captain }"
                          >
                            <Crown
                              v-if="seat.captain"
                              class="size-2"
                              :stroke-width="2.8"
                            />
                            <template v-else>{{ seat.no }}</template>
                          </i>
                          <template v-if="seat.player">
                            <span class="draft-stack-pop-name">{{
                              seat.player.name
                            }}</span>
                            <span
                              v-if="seat.mine"
                              class="draft-stack-pop-you"
                              >{{
                                $t("pages.play.draft_rooms.intro.you")
                              }}</span
                            >
                            <span
                              v-if="seat.captain"
                              class="text-muted-foreground"
                              >{{ $t("draft_games.room.captain") }}</span
                            >
                            <span
                              v-if="seat.auto"
                              class="text-muted-foreground"
                              :title="$t('draft_games.room.auto_picked_hint')"
                              >{{ $t("draft_games.room.auto_picked") }}</span
                            >
                          </template>
                          <span v-else class="draft-stack-pop-name">{{
                            seat.current
                              ? $t("draft_games.room.is_picking", {
                                  name: sides[slot - 1].captainName,
                                })
                              : $t("draft_games.room.not_picked")
                          }}</span>
                        </li>
                      </ol>
                    </div>
                  </PopoverContent>
                </Popover>
                <DraftSeatStack
                  v-else
                  :seats="sides[slot - 1].seats"
                  :ordered="false"
                />
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
            data-scorebug="box"
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
                <!-- Contained so the check-in box fills the box without sizing
                     it: its label changes as you check in and its clock drops
                     a digit under ten minutes, and neither should nudge the
                     teams. The box's min-width is what holds it open. -->
                <div
                  v-if="box.kind === 'checkin'"
                  :key="boxKey"
                  class="flex [contain:inline-size]"
                >
                  <slot name="checkin" />
                </div>
                <div
                  v-else
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
  gap: 0.75rem 0.875rem;
  min-height: 4.5rem;
  padding: 0.875rem 0.875rem 0.875rem 1rem;
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
.draft-header-menu.is-row {
  position: static;
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.75rem;
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
/* One column the name can't outgrow, so a long name wraps or clamps instead
   of sliding the roster under the crest. */
.draft-bug-id {
  grid-template-columns: minmax(0, 1fr);
}
.draft-bug-stack {
  position: relative;
  display: flex;
  margin: -2px -6px -5px -2px;
  padding: 2px 6px 5px 2px;
  border-radius: 6px;
  cursor: default;
}
.draft-bug-stack:focus-visible {
  outline: 2px solid hsl(var(--tac-amber) / 0.55);
}
@media (pointer: coarse) {
  .draft-bug-stack::after {
    content: "";
    position: absolute;
    inset: -6px -4px;
  }
}
.draft-stack-pop {
  display: grid;
  gap: 6px;
  min-width: 11rem;
}
.draft-stack-pop-head {
  padding: 0 2px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  white-space: nowrap;
  color: hsl(var(--muted-foreground));
}
.draft-stack-pop ol {
  display: grid;
  gap: 2px;
}
.draft-stack-pop li {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 24px;
  padding: 0 2px;
  font-size: 12.5px;
  white-space: nowrap;
}
.draft-stack-pop-mark {
  display: grid;
  flex: none;
  place-items: center;
  min-width: 14px;
  height: 14px;
  padding: 0 2px;
  border-radius: 7px;
  font-size: 8.5px;
  font-weight: 700;
  font-style: normal;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  background: hsl(var(--team));
  color: hsl(240 10% 4%);
}
.draft-stack-pop-mark.is-captain {
  background: transparent;
  color: hsl(var(--team));
  box-shadow: inset 0 0 0 1px hsl(var(--team) / 0.55);
}
.draft-stack-pop-name {
  font-weight: 600;
  color: hsl(var(--foreground));
}
.draft-stack-pop li.is-current .draft-stack-pop-name {
  color: hsl(var(--team));
}
.draft-stack-pop li.is-open .draft-stack-pop-name {
  font-weight: 500;
  color: hsl(var(--muted-foreground));
}
.draft-stack-pop li.is-open .draft-stack-pop-mark {
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  box-shadow: inset 0 0 0 1px hsl(var(--border));
}
.draft-stack-pop-you {
  display: inline-flex;
  align-items: center;
  height: 15px;
  padding: 0 4px;
  border-radius: 3px;
  background: hsl(var(--tac-amber) / 0.14);
  color: hsl(var(--tac-amber));
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
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
/* Sized to the check-in box -- "Checking in" beside a two-digit-minute clock,
   the widest thing the box holds -- and shared by every phase, so the scorebug
   doesn't widen under the teams as the room moves into check-in. */
.draft-bug-box {
  grid-area: box;
  min-width: 16rem;
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

@container draft-header (max-width: 619px) {
  /* The call to action goes under the text at full width, so the text keeps
     the whole card to wrap in. */
  .draft-header-row {
    grid-template-columns: 2.75rem minmax(0, 1fr);
    gap: 0.75rem;
    min-height: 0;
    padding: 0.75rem;
  }
  .draft-header-ring {
    align-self: start;
  }
  .draft-header-actions {
    grid-column: 1 / -1;
  }
  .draft-header-actions:not(:has(button)) {
    display: none;
  }
  .draft-header-actions :deep(.draft-header-buttons) {
    flex: 1 1 auto;
    min-width: 0;
  }
  .draft-header-actions :deep(.draft-action) {
    flex: 1 1 0%;
  }
  .draft-header-body {
    padding: 0.875rem 0.75rem 1rem;
  }
  .draft-header-menu {
    top: 0.5rem;
    right: 0.5rem;
  }
}

/* Below this the stacks no longer fit beside the crests, so the sides stack
   on the left of the box. */
@container draft-header (max-width: 749px) {
  .draft-bug {
    padding-inline: 0 var(--menu-room);
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
    min-width: 8.75rem;
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
  .is-opening .draft-bug-side.is-right {
    animation: none;
    transition: none;
  }
}
</style>
