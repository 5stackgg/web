<script lang="ts" setup>
import ReplayViewer from "~/components/match/ReplayViewer.vue";
</script>

<template>
  <div>
    <!-- If the match has exactly one map we fall back to it so single-
         map matches don't show "select a map" with nothing to click. -->
    <div v-if="!effectiveMap" class="py-6 text-center">
      <p
        class="font-mono text-[0.7rem] tracking-[0.2em] uppercase text-muted-foreground"
      >
        {{ $t("match.replay.select_map") }}
      </p>
    </div>

    <!-- Explicit Load gate so position fetches don't auto-fire — the
         dataset is large and pulls from S3 which we don't want hitting
         every time the tab opens. -->
    <div
      v-else-if="!loadRequested"
      class="py-10 flex flex-col items-center gap-3 text-center"
    >
      <p
        class="font-mono text-[0.65rem] tracking-[0.22em] uppercase text-muted-foreground max-w-sm"
      >
        {{
          $t("match.replay.positions_large", {
            map: effectiveMap?.map?.name ?? "",
          })
        }}
      </p>
      <button
        type="button"
        class="px-4 py-2 font-mono text-[0.7rem] font-bold tracking-[0.22em] uppercase border border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.2)] transition-colors"
        @click="loadBlob"
      >
        {{ $t("match.replay.load") }}
      </button>
    </div>

    <div
      v-else-if="loading && positions === null"
      class="py-8 text-center font-mono text-xs tracking-[0.2em] uppercase text-muted-foreground"
    >
      {{ $t("common.loading") }}…
    </div>
    <div
      v-else-if="positions !== null && positions.length === 0"
      class="py-8 text-center font-mono text-xs tracking-[0.2em] uppercase text-muted-foreground"
    >
      {{ $t("match.replay.no_position_data") }}
    </div>
    <ReplayViewer
      v-else-if="positions"
      :match="match"
      :positions="positions"
      :grenades="grenades || []"
      :shots="shots || []"
      :damages="damages || []"
      :demo-players="demoPlayers"
      :demo-kills="demoKills"
      :demo-bombs="demoBombs"
      :demo-kit-drops="demoKitDrops"
      :demo-round-ticks="demoRoundTicks"
      :tick-rate="tickRate"
      :map-name="effectiveMap?.map?.name"
    />
  </div>
</template>

<script lang="ts">
import { $ } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import {
  fetchReplayBlob,
  normalizeBlobGrenades,
} from "~/composables/useReplayBlob";

const playbackUrlQuery = typedGql("query")({
  match_map_demos: [
    {
      where: { match_map_id: { _eq: $("matchMapId", "uuid!") } },
      limit: 1,
    },
    {
      playback_url: true,
    },
  ],
});

export default {
  props: {
    match: {
      required: true,
      type: Object,
    },
    activeMap: {
      type: Object as () => any,
      default: null,
    },
  },
  data() {
    return {
      positions: null as null | any[],
      grenades: null as null | any[],
      shots: null as null | any[],
      damages: null as null | any[],
      demoPlayers: [] as any[],
      demoKills: [] as any[],
      demoBombs: [] as any[],
      demoKitDrops: [] as any[],
      demoRoundTicks: [] as any[],
      tickRate: 64 as number,
      loadRequested: false as boolean,
      loading: false as boolean,
    };
  },
  watch: {
    // Switching maps (or clearing the active map) resets the gate so
    // we never accidentally fire a fetch for a map the user didn't
    // explicitly pick to load.
    "effectiveMap.id"() {
      this.resetState();
    },
  },
  methods: {
    resetState() {
      this.loadRequested = false;
      this.loading = false;
      this.positions = null;
      this.grenades = null;
      this.shots = null;
      this.damages = null;
      this.demoPlayers = [];
      this.demoKills = [];
      this.demoBombs = [];
      this.demoKitDrops = [];
      this.demoRoundTicks = [];
    },
    async loadBlob() {
      const map = (this as any).effectiveMap;
      if (!map?.id || !this.match?.id) return;
      this.loadRequested = true;
      this.loading = true;
      try {
        const { data } = await (this.$apollo as any).query({
          query: playbackUrlQuery,
          variables: { matchMapId: map.id },
          fetchPolicy: "network-only",
        });
        const url: string | null =
          data?.match_map_demos?.[0]?.playback_url ?? null;
        if (!url) {
          this.positions = [];
          return;
        }
        const blob = await fetchReplayBlob(url);
        if (!blob) {
          this.positions = [];
          return;
        }
        this.positions = blob.positions ?? [];
        this.grenades = normalizeBlobGrenades(blob.grenade_throws ?? []);
        this.shots = blob.shots_fired ?? [];
        this.damages = blob.damages ?? [];
        this.demoPlayers = blob.players ?? [];
        this.demoKills = blob.kills ?? [];
        this.demoBombs = blob.bombs ?? [];
        this.demoKitDrops = blob.kit_drops ?? [];
        this.demoRoundTicks = blob.round_ticks ?? [];
        this.tickRate = blob.tick_rate || 64;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn("[replay] failed to load playback blob", error);
        this.positions = [];
      } finally {
        this.loading = false;
      }
    },
  },
  computed: {
    // Single-map matches: no map selector above, so fall back to the
    // sole match_map. Otherwise honor whatever the user picked above.
    effectiveMap(): any {
      if (this.activeMap) return this.activeMap;
      const maps = this.match?.match_maps ?? [];
      if (maps.length === 1) return maps[0];
      return null;
    },
  },
};
</script>
