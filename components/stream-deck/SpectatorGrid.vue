<script setup lang="ts">
import { computed } from "vue";
import { useStreamerGsi } from "~/composables/useStreamerGsi";
import SpectatorSlots from "~/components/stream-deck/SpectatorSlots.vue";

// Thin wrapper around SpectatorSlots that owns the GSI subscription.
// Kept around so existing call sites (stream-deck/index.vue) don't
// have to wire useStreamerGsi themselves; presentational concerns
// live in SpectatorSlots so the demo and live surfaces share visuals.

const props = defineProps<{
  matchId: string;
  isLive: boolean;
  matchType: string | null | undefined;
  controlsActive: boolean;
  flashKey?: string | null;
  // Already-resolved slot number, for call sites that track the flash as a slot
  // rather than a keypress. Takes precedence over flashKey.
  flashSlot?: number | null;
  compact?: boolean;
  // Optional: pass true to render the autodirector "AI piloting" wash
  // on non-active slots. Stream-deck index card surfaces it via the
  // `is_game_streamer + autodirector` row state.
  autodirectorOn?: boolean;
  // Render each player's live camera behind their slot. Off by default -- a
  // tile is a peer connection and a video decode, so only a surface showing one
  // match at a time (the focus popout) is worth them. Everywhere else the slots
  // still carry the player's avatar and the camera health indicator, which is
  // all an 88px tile could show anyway.
  cameras?: boolean;
  // When false, skip the GSI poll entirely. Do NOT use this to dedupe against
  // another window polling the same match: without GSI every slot falls back to
  // a placeholder with no steam id, which costs the card its player names and
  // its cameras. useStreamerGsi already stops polling a backgrounded tab, which
  // is where the real waste was.
  gsiEnabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "press-slot", slot: number): void;
}>();

const matchIdRef = computed(() => props.matchId);
const isLiveRef = computed(() => props.isLive);
const gsiEnabledRef = computed(() => props.gsiEnabled !== false);

const {
  ctSlots,
  tSlots,
  spectatedSteamId,
  teamCtName,
  teamTName,
  teamCtScore,
  teamTScore,
} = useStreamerGsi(matchIdRef, isLiveRef, 1000, gsiEnabledRef);

// flashKey arrives as a digit string ("1".."9","0") from keyboard
// handlers; SpectatorSlots wants the slot integer. Empty string and
// non-digit values map to null (no flash).
const flashSlotNum = computed<number | null>(() => {
  if (props.flashSlot != null) {
    return props.flashSlot;
  }

  const k = props.flashKey;
  if (!k) return null;
  if (k === "0") return 10;
  const n = Number(k);
  return Number.isInteger(n) && n >= 1 && n <= 9 ? n : null;
});
</script>

<template>
  <SpectatorSlots
    :ct-slots="ctSlots"
    :t-slots="tSlots"
    :team-ct-name="teamCtName"
    :team-t-name="teamTName"
    :active-steam-id="spectatedSteamId"
    :flash-slot="flashSlotNum"
    :controls-active="controlsActive"
    :match-type="matchType ?? undefined"
    :compact="!!compact"
    :autodirector-on="!!autodirectorOn"
    :camera-match-id="matchId"
    :camera-video="!!cameras"
    layout="grid"
    @press-slot="(slot: number) => emit('press-slot', slot)"
  />
</template>
