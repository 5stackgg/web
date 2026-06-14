<script lang="ts">
import { $ } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import {
  fetchReplayBlob,
  normalizeBlobGrenades,
} from "~/composables/useReplayBlob";
import ReplayViewer from "~/components/match/ReplayViewer.vue";

const matchMapForPopoutQuery = typedGql("query")({
  match_maps_by_pk: [
    { id: $("matchMapId", "uuid!") },
    {
      id: true,
      match_id: true,
      map: { name: true },
      demos: [{ limit: 1 }, { playback_url: true }],
      // Per-round team money — drives full-buy detection for the
      // buy-round overlay. The replay blob carries loadout but no money.
      rounds: [
        {},
        {
          round: true,
          lineup_1_money: true,
          lineup_2_money: true,
          lineup_1_side: true,
          lineup_2_side: true,
        },
      ],
      match: {
        id: true,
        lineup_1: {
          name: true,
          lineup_players: [
            {},
            {
              player: {
                steam_id: true,
                name: true,
                avatar_url: true,
              },
            },
          ],
        },
        lineup_2: {
          name: true,
          lineup_players: [
            {},
            {
              player: {
                steam_id: true,
                name: true,
                avatar_url: true,
              },
            },
          ],
        },
      },
    },
  ],
});

export default {
  components: { ReplayViewer },
  props: {
    matchMapId: { type: String, required: true },
    initialView: { type: String, default: "2d" },
  },
  data() {
    return {
      matchMap: null as any,
      positions: null as null | any[],
      grenades: null as null | any[],
      grenadeTrajectories: [] as any[],
      shots: null as null | any[],
      damages: null as null | any[],
      demoPlayers: [] as any[],
      demoKills: [] as any[],
      demoBombs: [] as any[],
      demoKitDrops: [] as any[],
      demoRoundTicks: [] as any[],
      roundInventory: [] as any[],
      roundEconomy: [] as any[],
      tickRate: 64 as number,
      blobLoading: false as boolean,
      blobLoaded: false as boolean,
      // Set true when we successfully consume handoff data from the
      // opener window — skips the Apollo query entirely.
      hydratedFromOpener: false,
      handoffMatch: null as any,
      handoffMapName: null as null | string,
    };
  },
  created() {
    const self = this as any;
    if (typeof window === "undefined") return;
    try {
      const opener: any = window.opener;
      const data = opener?.__replayHandoff?.[self.matchMapId];
      if (!data) return;
      self.handoffMatch = data.match ?? null;
      self.handoffMapName = data.mapName ?? null;
      self.positions = data.positions ?? [];
      self.grenades = data.grenades ?? [];
      self.grenadeTrajectories = data.grenadeTrajectories ?? [];
      self.shots = data.shots ?? [];
      self.damages = data.damages ?? [];
      self.demoPlayers = data.demoPlayers ?? [];
      self.demoKills = data.demoKills ?? [];
      self.demoBombs = data.demoBombs ?? [];
      self.demoKitDrops = data.demoKitDrops ?? [];
      self.demoRoundTicks = data.demoRoundTicks ?? [];
      self.roundInventory = data.roundInventory ?? [];
      self.roundEconomy = data.roundEconomy ?? [];
      self.tickRate = data.tickRate ?? 64;
      self.hydratedFromOpener = true;
      self.blobLoaded = true;
    } catch {
      // Opener may be closed or unavailable — fall through to Apollo.
    }
  },
  apollo: {
    matchMap: {
      query: matchMapForPopoutQuery,
      variables(): any {
        return { matchMapId: (this as any).matchMapId };
      },
      skip(): boolean {
        return (this as any).hydratedFromOpener;
      },
      manual: true,
      async result({ data }: { data: any }) {
        const self = this as any;
        const matchMap = data?.match_maps_by_pk ?? null;
        self.matchMap = matchMap;
        self.roundEconomy = matchMap?.rounds ?? [];
        if (!matchMap?.id || self.blobLoaded) return;
        const url: string | null = matchMap?.demos?.[0]?.playback_url ?? null;
        if (!url) {
          self.positions = [];
          self.blobLoaded = true;
          return;
        }
        self.blobLoading = true;
        try {
          const blob = await fetchReplayBlob(url);
          if (!blob) {
            self.positions = [];
            return;
          }
          self.positions = blob.positions ?? [];
          self.grenades = normalizeBlobGrenades(blob.grenade_throws ?? []);
          self.grenadeTrajectories = blob.grenade_trajectories ?? [];
          self.shots = blob.shots_fired ?? [];
          self.damages = blob.damages ?? [];
          self.demoPlayers = blob.players ?? [];
          self.demoKills = blob.kills ?? [];
          self.demoBombs = blob.bombs ?? [];
          self.demoKitDrops = blob.kit_drops ?? [];
          self.demoRoundTicks = blob.round_ticks ?? [];
          self.roundInventory = blob.round_inventory ?? [];
          self.tickRate = blob.tick_rate || 64;
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn("[replay-popout] failed to load playback blob", error);
          self.positions = [];
        } finally {
          self.blobLoading = false;
          self.blobLoaded = true;
        }
      },
    },
  },
  computed: {
    match(): any {
      // Prefer the handoff payload from the opener — it already has
      // the full match object with lineup_1/lineup_2 + match_maps.
      if (this.handoffMatch) return this.handoffMatch;
      const m = this.matchMap?.match ?? null;
      const maps = this.matchMap ? [this.matchMap] : [];
      return m ? { ...m, match_maps: maps } : { match_maps: maps };
    },
    mapName(): string | null {
      return this.handoffMapName ?? this.matchMap?.map?.name ?? null;
    },
    loading(): boolean {
      if (this.hydratedFromOpener) return false;
      return this.blobLoading || (!this.blobLoaded && this.positions === null);
    },
  },
};
</script>

<template>
  <div class="flex h-full w-full flex-col overflow-hidden">
    <div
      v-if="loading"
      class="py-10 text-center font-mono text-xs tracking-[0.2em] uppercase text-muted-foreground"
    >
      {{ $t("match.replay.loading") }}
    </div>
    <div
      v-else-if="positions !== null && positions.length === 0"
      class="py-10 text-center font-mono text-xs tracking-[0.2em] uppercase text-muted-foreground"
    >
      {{ $t("match.replay.no_position_data") }}
    </div>
    <ReplayViewer
      v-else-if="positions"
      :match="match"
      :positions="positions"
      :grenades="grenades || []"
      :grenade-trajectories="grenadeTrajectories || []"
      :shots="shots || []"
      :damages="damages || []"
      :demo-players="demoPlayers"
      :demo-kills="demoKills"
      :demo-bombs="demoBombs"
      :demo-kit-drops="demoKitDrops"
      :is-popout="true"
      :demo-round-ticks="demoRoundTicks"
      :round-inventory="roundInventory"
      :round-economy="roundEconomy"
      :tick-rate="tickRate"
      :map-name="mapName"
      :initial-view="initialView as '2d' | '3d'"
    />
  </div>
</template>
