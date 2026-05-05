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
  compact?: boolean;
  // Optional: pass true to render the autodirector "AI piloting" wash
  // on non-active slots. Stream-deck index card surfaces it via the
  // `is_game_streamer + autodirector` row state.
  autodirectorOn?: boolean;
}>();

const emit = defineEmits<{
  (e: "press-slot", slot: number): void;
}>();

const matchIdRef = computed(() => props.matchId);
const isLiveRef = computed(() => props.isLive);

const {
  ctSlots,
  tSlots,
  spectatedSteamId,
  teamCtName,
  teamTName,
  teamCtScore,
  teamTScore,
} = useStreamerGsi(matchIdRef, isLiveRef);

// flashKey arrives as a digit string ("1".."9","0") from keyboard
// handlers; SpectatorSlots wants the slot integer. Empty string and
// non-digit values map to null (no flash).
const flashSlotNum = computed<number | null>(() => {
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
    :team-ct-score="teamCtScore"
    :team-t-score="teamTScore"
    :active-steam-id="spectatedSteamId"
    :flash-slot="flashSlotNum"
    :controls-active="controlsActive"
    :match-type="matchType ?? undefined"
    :compact="!!compact"
    :autodirector-on="!!autodirectorOn"
    layout="grid"
    @press-slot="(slot: number) => emit('press-slot', slot)"
  />
</template>
