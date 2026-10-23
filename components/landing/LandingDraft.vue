<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import DraftTeamPanel from "~/components/draft-games/DraftTeamPanel.vue";
import { DEMO_LINEUPS } from "~/utilities/demoMatch";
import { DEMO_DRAFT_PICKS, demoDraftRoom } from "~/utilities/demoDraft";
import { useDemoFaces } from "~/utilities/landing/demoFaces";

const PICK_MS = 2400;
const HOLD_MS = 4000;

const picked = ref(2);
const turnAt = ref(Date.now());
const startedAt = Date.now();
const root = ref<HTMLElement | null>(null);

const { dress } = useDemoFaces();

const room = computed(() =>
  demoDraftRoom(null, startedAt, {
    picked: picked.value,
    turnAt: turnAt.value,
  }),
);

const startersFor = (lineup: 1 | 2) =>
  room.value.players
    .filter((p) => p.lineup === lineup)
    .map((p) => ({ ...p, player: dress(p.player) }))
    .sort(
      (a, b) =>
        Number(b.is_captain) - Number(a.is_captain) ||
        (a.pick_order ?? 99) - (b.pick_order ?? 99),
    );

const drafting = computed(() => room.value.status === "Drafting");

let timer: ReturnType<typeof setTimeout> | undefined;
let observer: IntersectionObserver | undefined;

function next() {
  if (picked.value >= DEMO_DRAFT_PICKS) {
    picked.value = 0;
  } else {
    picked.value++;
  }
  turnAt.value = Date.now();
  timer = setTimeout(
    next,
    picked.value >= DEMO_DRAFT_PICKS ? HOLD_MS : PICK_MS,
  );
}

onMounted(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  observer = new IntersectionObserver(
    ([entry]) => {
      clearTimeout(timer);
      if (entry.isIntersecting) timer = setTimeout(next, PICK_MS);
    },
    { threshold: 0.4 },
  );
  if (root.value) observer.observe(root.value);
});

onBeforeUnmount(() => {
  clearTimeout(timer);
  observer?.disconnect();
});
</script>

<template>
  <div
    ref="root"
    inert
    class="grid items-start gap-3 sm:grid-cols-2"
  >
    <DraftTeamPanel
      v-for="lineup in [1, 2] as const"
      :key="lineup"
      :title="DEMO_LINEUPS[lineup].name"
      :players="startersFor(lineup)"
      :per-team="room.capacity / 2"
      :accent="lineup === 1 ? 'amber' : 'blue'"
      :host-steam-id="room.host_steam_id"
      :active="drafting && room.current_pick_lineup === lineup"
    />
  </div>
</template>
