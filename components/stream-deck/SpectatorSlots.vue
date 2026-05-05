<script setup lang="ts">
import { computed } from "vue";
import { Bot } from "lucide-vue-next";
import {
  keyForSlot,
  teamSizeForMatchType,
} from "~/utilities/streamerSpecSlots";

// Pure presentational slot row used by every spec-target surface:
// DemoPlaybackControls, LiveStreamPlayer (match page), the stream-deck
// focus popout, and the stream-deck index card. Data + mutation
// wiring lives at each call site — this component just renders.
//
// Two layouts:
//   - "grid"   — chunky broadcast tiles, teamSize-wide grid. The
//     primary affordance everywhere: demo controls, live player on
//     the match page, focus popout, deck index cards. The bigger
//     blocks carry a slot-key chip top-left, health number top-
//     right, the player name as the headline, and a beefy health
//     rail along the bottom.
//   - "inline" — slim h-9 pills, team label on the left and slot
//     pills wrapping right. Reserved for tight horizontal contexts
//     where a player card grid would overflow.
//
// Health bars surface real GSI signal that was previously dropped on
// the floor; the operator can now see at a glance who is bleeding
// before deciding who to spectate. Active spec target gets a small
// caret on the top edge so the eye finds it instantly across rows.

export type SpecSlotData = {
  slot: number;
  steam_id: string;
  name: string | null;
  team: "T" | "CT" | null;
  alive: boolean;
  health: number;
};

const props = withDefaults(
  defineProps<{
    ctSlots: SpecSlotData[];
    tSlots: SpecSlotData[];
    teamCtName?: string | null;
    teamTName?: string | null;
    teamCtScore?: number;
    teamTScore?: number;
    activeSteamId?: string | null;
    flashSlot?: number | null;
    controlsActive?: boolean;
    layout?: "grid" | "inline";
    compact?: boolean;
    matchType?: string | null;
    // When true the row reads as "AI piloting" — non-active slots get
    // a saturate-50 wash, the autodirector-picked slot is tagged AUTO
    // in place of its keybind. Hover restores full color as a preview
    // of the takeover. Wired only on live surfaces; the demo never
    // sets this since there's no AI driver in playback.
    autodirectorOn?: boolean;
    // Hides "Waiting for cs2 game state…" placeholder. The demo
    // controls already render their own message.
    hideEmptyMessage?: boolean;
  }>(),
  {
    teamCtName: null,
    teamTName: null,
    teamCtScore: 0,
    teamTScore: 0,
    activeSteamId: null,
    flashSlot: null,
    controlsActive: true,
    layout: "grid",
    compact: false,
    matchType: null,
    autodirectorOn: false,
    hideEmptyMessage: false,
  },
);

const emit = defineEmits<{
  (e: "press-slot", slot: number): void;
}>();

const hasGsi = computed(
  () => props.ctSlots.length > 0 || props.tSlots.length > 0,
);
const teamSize = computed(() => teamSizeForMatchType(props.matchType));

function ctTeamLabel(): string {
  return props.teamCtName || "Counter-Terrorists";
}
function tTeamLabel(): string {
  return props.teamTName || "Terrorists";
}

function slotIsActive(s: SpecSlotData): boolean {
  if (!props.activeSteamId) return false;
  return s.steam_id === props.activeSteamId;
}

// Side palette resolved per-state. Active and flash share the
// "highlighted" state — flashing simulates the active selection
// landing for ~220ms after a click before GSI confirms.
function sideClasses(side: "T" | "CT", isActive: boolean, isFlash: boolean) {
  const wantHighlight = isActive || isFlash;
  if (side === "CT") {
    return wantHighlight
      ? "border-blue-400 bg-blue-500/20 text-blue-100 [box-shadow:0_0_0_1px_rgb(96_165_250_/_0.55),0_0_18px_-2px_rgb(96_165_250_/_0.45)]"
      : "border-blue-500/40 bg-blue-500/5 text-foreground/85 hover:border-blue-400/70 hover:bg-blue-500/12 hover:text-blue-100";
  }
  return wantHighlight
    ? "border-amber-400 bg-amber-500/20 text-amber-100 [box-shadow:0_0_0_1px_rgb(251_191_36_/_0.55),0_0_18px_-2px_rgb(251_191_36_/_0.45)]"
    : "border-amber-500/40 bg-amber-500/5 text-foreground/85 hover:border-amber-400/70 hover:bg-amber-500/12 hover:text-amber-100";
}
// Health → bar color. Tracks cs2's own HUD breakpoints so the
// operator's mental model from the in-game tally matches the deck.
function healthColor(h: number): string {
  if (h <= 0) return "bg-zinc-700";
  if (h < 25) return "bg-red-500";
  if (h < 60) return "bg-amber-400";
  return "bg-emerald-400";
}
function healthWidth(h: number): string {
  if (!Number.isFinite(h)) return "0%";
  return `${Math.max(0, Math.min(100, h))}%`;
}

function gridColsClass(): string {
  if (teamSize.value === 5) return "grid-cols-5";
  if (teamSize.value === 2) return "grid-cols-2 max-w-[16rem]";
  if (teamSize.value === 1) return "grid-cols-1 max-w-[8rem]";
  return "grid-cols-5";
}

// Health → readable label for the corner numeric. cs2 reports raw 0-100.
function healthLabel(h: number): string {
  if (!Number.isFinite(h) || h <= 0) return "0";
  return String(Math.round(Math.max(0, Math.min(100, h))));
}

function press(s: SpecSlotData) {
  emit("press-slot", s.slot);
}
</script>

<template>
  <div
    :class="[
      'space-y-2',
      autodirectorOn
        ? 'rounded-md border-t border-dashed border-[hsl(var(--tac-amber)/0.5)] pt-2 transition-[border-color] duration-300'
        : '',
    ]"
  >
    <template v-if="hasGsi">
      <!-- ============== CT side ============== -->
      <div :class="layout === 'inline' ? 'flex items-center gap-3' : ''">
        <div
          :class="[
            'flex items-center gap-2',
            layout === 'inline' ? 'min-w-[8rem]' : 'mb-1.5',
          ]"
        >
          <!-- Side chip — solid-filled tactical tag. Replaces the
               redundant dot+pill combo with a single broadcast-style
               jersey letter. -->
          <span
            class="inline-flex items-center justify-center h-[18px] w-[22px] rounded-[3px] bg-blue-500 font-mono text-[0.62rem] font-black tabular-nums leading-none text-blue-50 [box-shadow:inset_0_-1px_0_0_hsl(0_0%_0%_/_0.25)]"
          >
            CT
          </span>
          <span
            class="truncate font-mono text-[0.68rem] uppercase tracking-[0.18em] text-foreground/80"
          >
            {{ ctTeamLabel() }}
          </span>
          <span
            v-if="teamCtScore || teamTScore"
            class="ml-auto font-mono text-sm font-bold tabular-nums text-foreground"
          >
            {{ teamCtScore }}
          </span>
        </div>

        <div
          :class="
            layout === 'inline'
              ? 'flex flex-wrap items-center gap-1.5'
              : ['grid gap-1.5', gridColsClass()]
          "
        >
          <button
            v-for="s in ctSlots"
            :key="`ct-${s.slot}-${s.steam_id}`"
            type="button"
            :disabled="!controlsActive"
            :class="[
              'spec-slot group relative font-mono select-none transition-[filter,opacity,box-shadow,border-color,background-color,color] duration-150 cursor-pointer overflow-hidden',
              layout === 'inline'
                ? 'inline-flex h-9 items-center gap-1.5 rounded-md border px-2 text-xs'
                : [
                    'aspect-[5/4] rounded-md border flex flex-col items-center justify-center gap-0.5 px-1',
                    compact ? 'text-base' : 'text-2xl',
                  ],
              sideClasses('CT', slotIsActive(s), flashSlot === s.slot),
              !s.alive && !slotIsActive(s) ? 'opacity-50' : '',
              !controlsActive ? 'cursor-not-allowed opacity-60' : '',
              autodirectorOn && !slotIsActive(s) && flashSlot !== s.slot
                ? 'is-auto-passive'
                : '',
            ]"
            :title="
              autodirectorOn
                ? 'Click to take manual control'
                : (s.name ?? `Slot ${s.slot}`)
            "
            @click="press(s)"
          >
            <!-- ============================================
                 INLINE pill body — h-9 row of slot-key + name.
                 ============================================ -->
            <template v-if="layout === 'inline'">
              <span
                :class="[
                  'inline-flex h-5 items-center justify-center rounded text-[0.6rem] font-bold tabular-nums leading-none',
                  autodirectorOn && slotIsActive(s)
                    ? 'gap-1 px-1.5 bg-[hsl(var(--tac-amber)/0.25)] text-[hsl(var(--tac-amber))]'
                    : 'w-5 bg-foreground/10',
                ]"
                :title="`Slot ${s.slot} · key ${keyForSlot(s.slot)}`"
              >
                <Bot
                  v-if="autodirectorOn && slotIsActive(s)"
                  class="size-3"
                  aria-hidden="true"
                />
                <span>{{
                  autodirectorOn && slotIsActive(s)
                    ? "AUTO"
                    : keyForSlot(s.slot)
                }}</span>
              </span>
              <span
                :class="[
                  'truncate max-w-[8rem] font-medium',
                  !s.alive ? 'line-through' : '',
                ]"
              >
                {{ s.name ?? `Slot ${s.slot}` }}
              </span>
              <!-- Inline pills get the same health bar as a thin sliver
                   at the bottom edge of the pill. -->
              <span
                v-if="s.alive"
                class="absolute inset-x-0 bottom-0 h-[2px] bg-foreground/10 overflow-hidden"
                aria-hidden="true"
              >
                <span
                  :class="[
                    'block h-full transition-[width] duration-300 ease-out',
                    healthColor(s.health),
                  ]"
                  :style="{ width: healthWidth(s.health) }"
                />
              </span>
            </template>

            <!-- ============================================
                 GRID tile body — full broadcast player card.
                 Slot-key chip pinned top-left, health number top-
                 right, name as the headline, health bar as a thick
                 footer rail. The block reads at a glance even from
                 the back row of an op booth. The deck-index "compact"
                 variant tightens text/spacing but keeps the same
                 anatomy.
                 ============================================ -->
            <template v-else>
              <!-- Top-left slot key chip / AUTO badge -->
              <span
                :class="[
                  'absolute top-1 left-1 inline-flex items-center justify-center rounded font-bold tabular-nums leading-none',
                  compact
                    ? 'h-4 min-w-[1rem] px-1 text-[0.55rem]'
                    : 'h-5 min-w-[1.25rem] px-1.5 text-[0.65rem]',
                  autodirectorOn && slotIsActive(s)
                    ? 'gap-0.5 bg-[hsl(var(--tac-amber)/0.25)] text-[hsl(var(--tac-amber))]'
                    : s.team === 'CT'
                      ? 'bg-blue-500/30 text-blue-100'
                      : 'bg-amber-500/30 text-amber-100',
                ]"
                :title="`Slot ${s.slot} · key ${keyForSlot(s.slot)}`"
              >
                <Bot
                  v-if="autodirectorOn && slotIsActive(s)"
                  :class="compact ? 'size-2.5' : 'size-3'"
                  aria-hidden="true"
                />
                <span>{{
                  autodirectorOn && slotIsActive(s) ? "AI" : keyForSlot(s.slot)
                }}</span>
              </span>

              <!-- Top-right health number — surfaces real GSI signal
                   at glance speed. Hidden when dead (the line-through
                   on the name carries that state instead). -->
              <span
                v-if="s.alive"
                :class="[
                  'absolute top-1 right-1.5 font-mono tabular-nums leading-none',
                  compact ? 'text-[0.55rem]' : 'text-[0.65rem]',
                  s.health < 25
                    ? 'text-red-300'
                    : s.health < 60
                      ? 'text-amber-200'
                      : 'text-foreground/65',
                ]"
                aria-hidden="true"
              >
                {{ healthLabel(s.health) }}
              </span>

              <!-- Player name — the centerpiece. Larger than the
                   inline pill since the tile has the room. -->
              <span
                :class="[
                  'mt-3 truncate max-w-full px-1 text-center font-semibold',
                  compact ? 'text-[0.6rem]' : 'text-[0.78rem]',
                  !s.alive ? 'line-through opacity-70' : '',
                ]"
              >
                {{ s.name ?? `Slot ${s.slot}` }}
              </span>

              <!-- Footer health rail — thicker than inline so the bar
                   reads as a chunk of UI, not a hairline. Shrinks
                   smoothly on damage. -->
              <span
                v-if="s.alive"
                :class="[
                  'absolute inset-x-0 bottom-0 overflow-hidden bg-foreground/10',
                  compact ? 'h-[5px]' : 'h-[8px]',
                ]"
                aria-hidden="true"
              >
                <span
                  :class="[
                    'block h-full transition-[width] duration-300 ease-out',
                    healthColor(s.health),
                  ]"
                  :style="{ width: healthWidth(s.health) }"
                />
              </span>
            </template>
          </button>
        </div>
      </div>

      <!-- ============== T side ============== -->
      <div :class="layout === 'inline' ? 'flex items-center gap-3' : ''">
        <div
          :class="[
            'flex items-center gap-2',
            layout === 'inline' ? 'min-w-[8rem]' : 'mb-1.5 mt-3',
          ]"
        >
          <span
            class="inline-flex items-center justify-center h-[18px] w-[22px] rounded-[3px] bg-amber-500 font-mono text-[0.62rem] font-black tabular-nums leading-none text-amber-50 [box-shadow:inset_0_-1px_0_0_hsl(0_0%_0%_/_0.25)]"
          >
            T
          </span>
          <span
            class="truncate font-mono text-[0.68rem] uppercase tracking-[0.18em] text-foreground/80"
          >
            {{ tTeamLabel() }}
          </span>
          <span
            v-if="teamCtScore || teamTScore"
            class="ml-auto font-mono text-sm font-bold tabular-nums text-foreground"
          >
            {{ teamTScore }}
          </span>
        </div>

        <div
          :class="
            layout === 'inline'
              ? 'flex flex-wrap items-center gap-1.5'
              : ['grid gap-1.5', gridColsClass()]
          "
        >
          <button
            v-for="s in tSlots"
            :key="`t-${s.slot}-${s.steam_id}`"
            type="button"
            :disabled="!controlsActive"
            :class="[
              'spec-slot group relative font-mono select-none transition-[filter,opacity,box-shadow,border-color,background-color,color] duration-150 cursor-pointer overflow-hidden',
              layout === 'inline'
                ? 'inline-flex h-9 items-center gap-1.5 rounded-md border px-2 text-xs'
                : [
                    'aspect-[5/4] rounded-md border flex flex-col items-center justify-center gap-0.5 px-1',
                    compact ? 'text-base' : 'text-2xl',
                  ],
              sideClasses('T', slotIsActive(s), flashSlot === s.slot),
              !s.alive && !slotIsActive(s) ? 'opacity-50' : '',
              !controlsActive ? 'cursor-not-allowed opacity-60' : '',
              autodirectorOn && !slotIsActive(s) && flashSlot !== s.slot
                ? 'is-auto-passive'
                : '',
            ]"
            :title="
              autodirectorOn
                ? 'Click to take manual control'
                : (s.name ?? `Slot ${s.slot}`)
            "
            @click="press(s)"
          >
            <!-- ============================================
                 INLINE pill body — h-9 row of slot-key + name.
                 ============================================ -->
            <template v-if="layout === 'inline'">
              <span
                :class="[
                  'inline-flex h-5 items-center justify-center rounded text-[0.6rem] font-bold tabular-nums leading-none',
                  autodirectorOn && slotIsActive(s)
                    ? 'gap-1 px-1.5 bg-[hsl(var(--tac-amber)/0.25)] text-[hsl(var(--tac-amber))]'
                    : 'w-5 bg-foreground/10',
                ]"
                :title="`Slot ${s.slot} · key ${keyForSlot(s.slot)}`"
              >
                <Bot
                  v-if="autodirectorOn && slotIsActive(s)"
                  class="size-3"
                  aria-hidden="true"
                />
                <span>{{
                  autodirectorOn && slotIsActive(s)
                    ? "AUTO"
                    : keyForSlot(s.slot)
                }}</span>
              </span>
              <span
                :class="[
                  'truncate max-w-[8rem] font-medium',
                  !s.alive ? 'line-through' : '',
                ]"
              >
                {{ s.name ?? `Slot ${s.slot}` }}
              </span>
              <span
                v-if="s.alive"
                class="absolute inset-x-0 bottom-0 h-[2px] bg-foreground/10 overflow-hidden"
                aria-hidden="true"
              >
                <span
                  :class="[
                    'block h-full transition-[width] duration-300 ease-out',
                    healthColor(s.health),
                  ]"
                  :style="{ width: healthWidth(s.health) }"
                />
              </span>
            </template>

            <!-- ============================================
                 GRID tile body — full broadcast player card.
                 ============================================ -->
            <template v-else>
              <span
                :class="[
                  'absolute top-1 left-1 inline-flex items-center justify-center rounded font-bold tabular-nums leading-none',
                  compact
                    ? 'h-4 min-w-[1rem] px-1 text-[0.55rem]'
                    : 'h-5 min-w-[1.25rem] px-1.5 text-[0.65rem]',
                  autodirectorOn && slotIsActive(s)
                    ? 'gap-0.5 bg-[hsl(var(--tac-amber)/0.25)] text-[hsl(var(--tac-amber))]'
                    : s.team === 'CT'
                      ? 'bg-blue-500/30 text-blue-100'
                      : 'bg-amber-500/30 text-amber-100',
                ]"
                :title="`Slot ${s.slot} · key ${keyForSlot(s.slot)}`"
              >
                <Bot
                  v-if="autodirectorOn && slotIsActive(s)"
                  :class="compact ? 'size-2.5' : 'size-3'"
                  aria-hidden="true"
                />
                <span>{{
                  autodirectorOn && slotIsActive(s) ? "AI" : keyForSlot(s.slot)
                }}</span>
              </span>

              <span
                v-if="s.alive"
                :class="[
                  'absolute top-1 right-1.5 font-mono tabular-nums leading-none',
                  compact ? 'text-[0.55rem]' : 'text-[0.65rem]',
                  s.health < 25
                    ? 'text-red-300'
                    : s.health < 60
                      ? 'text-amber-200'
                      : 'text-foreground/65',
                ]"
                aria-hidden="true"
              >
                {{ healthLabel(s.health) }}
              </span>

              <span
                :class="[
                  'mt-3 truncate max-w-full px-1 text-center font-semibold',
                  compact ? 'text-[0.6rem]' : 'text-[0.78rem]',
                  !s.alive ? 'line-through opacity-70' : '',
                ]"
              >
                {{ s.name ?? `Slot ${s.slot}` }}
              </span>

              <span
                v-if="s.alive"
                :class="[
                  'absolute inset-x-0 bottom-0 overflow-hidden bg-foreground/10',
                  compact ? 'h-[5px]' : 'h-[8px]',
                ]"
                aria-hidden="true"
              >
                <span
                  :class="[
                    'block h-full transition-[width] duration-300 ease-out',
                    healthColor(s.health),
                  ]"
                  :style="{ width: healthWidth(s.health) }"
                />
              </span>
            </template>
          </button>
        </div>
      </div>
    </template>

    <p
      v-else-if="!hideEmptyMessage"
      class="text-[0.6rem] uppercase tracking-wider text-muted-foreground/60 font-mono"
    >
      Waiting for cs2 game state…
    </p>
  </div>
</template>

<style scoped>
/* Autodirector "passive" state on non-active slots: AI is choosing,
   we're observing. Hover/focus restore full color as a preview of
   the manual takeover the click is about to trigger. */
.spec-slot.is-auto-passive {
  filter: saturate(0.55);
  opacity: 0.85;
}
.spec-slot.is-auto-passive:hover,
.spec-slot.is-auto-passive:focus-visible {
  filter: saturate(1);
  opacity: 1;
}
</style>
