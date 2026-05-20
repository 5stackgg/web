<script lang="ts" setup>
import ReplayViewer from "~/components/match/ReplayViewer.vue";
import cleanMapName from "~/utilities/cleanMapName";
</script>

<template>
  <div>
    <div v-if="selectableMaps.length > 1" class="mb-4">
      <p
        v-if="!effectiveMap"
        class="mb-2 font-mono text-[0.7rem] tracking-[0.22em] uppercase text-[hsl(var(--tac-amber))]"
      >
        {{ $t("match.replay.select_map") }}
      </p>
      <div
        class="grid gap-3"
        style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))"
        role="tablist"
      >
        <button
          v-for="m in selectableMaps"
          :key="m.id"
          type="button"
          role="tab"
          :aria-selected="effectiveMap?.id === m.id"
          class="group relative overflow-hidden border-2 transition-all text-left"
          :class="
            effectiveMap?.id === m.id
              ? 'border-[hsl(var(--tac-amber))] shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.6),_0_8px_24px_-8px_hsl(var(--tac-amber)/0.45)]'
              : 'border-border/60 hover:border-[hsl(var(--tac-amber)/0.7)] hover:-translate-y-0.5'
          "
          @click="selectMap(m.id)"
        >
          <img
            :src="`/radars/${m.map.name
              .toLowerCase()
              .replace(/_night$/, '')}.png`"
            :alt="m.map.name"
            class="aspect-[4/3] w-full object-cover transition-opacity"
            :class="
              effectiveMap?.id === m.id
                ? 'opacity-100'
                : 'opacity-60 group-hover:opacity-90'
            "
            @error="
              ($event.target as HTMLImageElement).style.visibility = 'hidden'
            "
          />
          <div
            class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent p-2 flex items-end justify-between gap-2"
          >
            <div class="min-w-0">
              <div
                class="font-mono text-sm font-bold tracking-[0.18em] uppercase text-white truncate"
              >
                {{ cleanMapName(m.map.name) }}
              </div>
              <div
                v-if="typeof m.lineup_1_score === 'number'"
                class="font-mono text-[0.7rem] tabular-nums text-white/75"
              >
                {{ m.lineup_1_score }} : {{ m.lineup_2_score }}
              </div>
            </div>
            <span
              class="font-mono text-[0.55rem] tracking-[0.2em] uppercase shrink-0 px-1.5 py-0.5 border"
              :class="
                effectiveMap?.id === m.id
                  ? 'border-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber))]'
                  : 'border-white/40 text-white/70 group-hover:text-white group-hover:border-white'
              "
            >
              {{
                effectiveMap?.id === m.id
                  ? $t("match.replay.selected")
                  : $t("match.replay.select")
              }}
            </span>
          </div>
        </button>
      </div>
    </div>

    <div
      v-if="!effectiveMap && selectableMaps.length <= 1"
      class="py-6 text-center"
    >
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
      :round-inventory="roundInventory"
      :tick-rate="tickRate"
      :map-name="effectiveMap?.map?.name"
    />
  </div>
</template>

<script lang="ts">
import { $ } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { e_match_status_enum } from "~/generated/zeus";
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
      roundInventory: [] as any[],
      tickRate: 64 as number,
      loadRequested: false as boolean,
      loading: false as boolean,
      // Tab-local map override — independent of the parent's match-wide
      // map filter so picking a 2D Replay map doesn't reach across and
      // scope the other tabs.
      localSelectedMapId: null as string | null,
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
    selectMap(id: string) {
      this.localSelectedMapId = id;
    },
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
      this.roundInventory = [];
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
        this.roundInventory = blob.round_inventory ?? [];
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
    // Maps the user can actually replay — scheduled maps have no demo
    // yet, so don't surface them as selectable.
    selectableMaps(): any[] {
      return (this.match?.match_maps ?? []).filter(
        (m: any) => m.status !== e_match_status_enum.Scheduled,
      );
    },
    // Priority: tab-local pick > match-wide active filter > sole map.
    effectiveMap(): any {
      if (this.localSelectedMapId) {
        const local = this.selectableMaps.find(
          (m: any) => m.id === this.localSelectedMapId,
        );
        if (local) return local;
      }
      if (this.activeMap) return this.activeMap;
      const maps = this.selectableMaps;
      if (maps.length === 1) return maps[0];
      return null;
    },
  },
};
</script>
