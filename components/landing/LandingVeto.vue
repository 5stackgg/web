<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref } from "vue";
import { RotateCcw } from "lucide-vue-next";
import DraftRoom from "~/components/draft-games/DraftRoom.vue";
import { Button } from "~/components/ui/button";
import {
  DEMO_DRAFT_BANS,
  DEMO_DRAFT_PICKS,
  demoDraftMatch,
  demoDraftPicks,
  demoDraftRoom,
} from "~/utilities/demoDraft";
import { useDemoFaces } from "~/utilities/landing/demoFaces";
import { DEMO_SCOUTS } from "~/utilities/landing/demoScouting";

// The FAQ draft demo's veto step: everyone is in, and the captains ban in the
// draft room until one map is left. The last ban holds before it starts over.
const BAN_MS = 1600;
const HOLD_MS = 5000;

const bans = ref(2);
const turnAt = ref(Date.now());
const startedAt = Date.now();
const root = ref<HTMLElement | null>(null);

const { dress, dressMatch, team } = useDemoFaces();

provide("veto-silent", true);

// Kestrel against Ironside: a teams room, so each side wears its name and
// crest.
const room = computed(() => {
  const base = demoDraftRoom(null, startedAt, { picked: DEMO_DRAFT_PICKS });
  return {
    ...base,
    mode: "Teams",
    team_1: team(1),
    team_2: team(2),
    host: dress(base.host),
    players: base.players.map((p) => ({ ...p, player: dress(p.player) })),
  };
});
const match = computed(() =>
  dressMatch(
    demoDraftMatch({
      step: "veto",
      everyoneIn: true,
      bans: Math.min(bans.value, DEMO_DRAFT_BANS - 1),
      turnAt: turnAt.value,
      startedAt,
      viewer: null,
    }),
  ),
);
const picks = computed(() =>
  demoDraftPicks(Math.min(bans.value, DEMO_DRAFT_BANS - 1)),
);
const done = computed(() => bans.value >= DEMO_DRAFT_BANS - 1);

let timer: ReturnType<typeof setTimeout> | undefined;
let observer: IntersectionObserver | undefined;

function next() {
  if (done.value) return;
  bans.value++;
  turnAt.value = Date.now();
  timer = setTimeout(next, done.value ? HOLD_MS : BAN_MS);
}

function play() {
  clearTimeout(timer);
  bans.value = 0;
  turnAt.value = Date.now();
  timer = setTimeout(next, BAN_MS);
}

onMounted(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      observer?.disconnect();
      play();
    },
    { threshold: 0.3 },
  );
  if (root.value) observer.observe(root.value);
});

onBeforeUnmount(() => {
  clearTimeout(timer);
  observer?.disconnect();
});
</script>

<template>
  <div ref="root" class="grid gap-3">
    <div inert>
      <DraftRoom
        :room="room"
        :match="match"
        :veto-picks="picks"
        :veto-scouts="DEMO_SCOUTS"
        hide-rail
      />
    </div>
    <div class="flex justify-end">
      <Button
        variant="ghost"
        size="sm"
        class="gap-1.5 text-muted-foreground"
        :disabled="!done"
        @click="play"
      >
        <RotateCcw class="size-3.5" />
        {{ $t("pages.welcome.match.replay_veto") }}
      </Button>
    </div>
  </div>
</template>
