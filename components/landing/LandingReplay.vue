<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue";
import { Loader2 } from "lucide-vue-next";
import ReplayViewer from "~/components/match/ReplayViewer.vue";
import {
  fetchReplayBlob,
  normalizeBlobGrenades,
  type ReplayBlob,
} from "~/composables/useReplayBlob";
import { DEMO_PLAYER_NAMES } from "~/utilities/demoMatch";
import { useDemoFaces } from "~/utilities/landing/demoFaces";
import { normalizeRoundInventory } from "~/utilities/demoWeaponNames";

// One real round of Anubis (a B take, planted and run down), cut from a
// 5stack.gg demo with the players swapped for the welcome page's cast. It is
// the replay page's own viewer, so it plays in 2D and 3D like the real thing.
const SRC = "/landing/replay/anubis.bin";

const { dressMatch } = useDemoFaces();

const blob = shallowRef<ReplayBlob | null>(null);
const failed = shallowRef(false);

onMounted(async () => {
  try {
    blob.value = await fetchReplayBlob(SRC);
  } catch (error) {
    console.warn("[landing-replay] failed to load the demo round", error);
  } finally {
    failed.value = !blob.value;
  }
});

const lineup = (slot: 1 | 2) => ({
  lineup_players: DEMO_PLAYER_NAMES[slot].map((name) => ({
    player: { steam_id: `demo-${name.toLowerCase()}`, name, avatar_url: null },
  })),
});

const match = computed(() => ({
  ...dressMatch({ lineup_1: lineup(1), lineup_2: lineup(2) }),
  match_maps: [
    {
      id: "demo-replay",
      map: { name: "de_anubis", label: "Anubis" },
    },
  ],
}));

const grenades = computed(() =>
  normalizeBlobGrenades(blob.value?.grenade_throws ?? []),
);
const inventory = computed(() =>
  normalizeRoundInventory(blob.value?.round_inventory ?? []),
);
</script>

<template>
  <div
    class="relative flex aspect-video w-full overflow-hidden rounded-lg border border-border bg-black max-sm:aspect-[4/5]"
  >
    <ReplayViewer
      v-if="blob"
      embedded
      initial-view="3d"
      :match="match"
      :positions="blob.positions ?? []"
      :grenades="grenades"
      :grenade-trajectories="blob.grenade_trajectories ?? []"
      :smoke-volumes="blob.smoke_volumes ?? []"
      :infernos="blob.infernos ?? []"
      :smoke-voxels="blob.smoke_voxels ?? []"
      :flashes="blob.flashes"
      :shots="blob.shots_fired ?? []"
      :damages="blob.damages ?? []"
      :demo-players="blob.players ?? []"
      :demo-kills="blob.kills ?? []"
      :demo-bombs="blob.bombs ?? []"
      :demo-kit-drops="blob.kit_drops ?? []"
      :demo-round-ticks="blob.round_ticks ?? []"
      :round-inventory="inventory"
      :round-economy="[]"
      :tick-rate="blob.tick_rate || 64"
      map-name="de_anubis"
      map-title="Anubis"
    />
    <div
      v-else-if="!failed"
      class="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"
    >
      <Loader2 class="size-4 animate-spin" />
      {{ $t("match.replay.loading") }}
    </div>
  </div>
</template>
