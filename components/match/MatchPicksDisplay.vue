<script lang="ts" setup>
import { Spinner } from "~/components/ui/spinner";
import cleanMapName from "~/utilities/cleanMapName";
</script>

<template>
  <div
    v-if="loading"
    class="flex w-full items-center justify-center gap-2 py-6 text-muted-foreground"
  >
    <Spinner class="w-4 h-4" />
    <span class="text-xs uppercase tracking-[0.18em] font-mono">{{
      $t("common.loading")
    }}</span>
  </div>
  <div
    v-else-if="!visiblePicks || visiblePicks.length === 0"
    class="flex w-full items-center justify-center py-6 text-muted-foreground text-xs uppercase tracking-[0.18em] font-mono"
  >
    {{ $t("match.picks.empty") }}
  </div>
  <div v-else class="picks-grid">
    <template v-for="(pick, index) of visiblePicks" :key="pick.id">
      <Tooltip>
        <TooltipTrigger class="pick-card text-left">
          <!-- map poster area, MapDisplay-style -->
          <div class="relative overflow-hidden rounded-t-[12px]">
            <NuxtImg
              :src="pick.map?.poster ?? '/img/maps/screenshots/random.webp'"
              class="w-full h-24 sm:h-28 object-cover brightness-50"
              sizes="320px"
            />
            <div class="absolute inset-0 bg-black/45" />

            <!-- top row: order + map name -->
            <div
              class="absolute top-1.5 left-2 right-2 flex items-center justify-between gap-2"
            >
              <span
                class="font-mono text-[0.6rem] font-bold tracking-[0.2em] text-[hsl(var(--tac-amber))] drop-shadow"
              >
                {{ index + 1 }}
              </span>
              <span
                class="truncate font-sans text-xs font-bold uppercase tracking-[0.06em] text-white drop-shadow"
              >
                {{
                  pick.map?.label ||
                  (pick.map?.name && cleanMapName(pick.map.name))
                }}
              </span>
            </div>

            <!-- centered patch + type pill -->
            <div
              class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 pt-3"
            >
              <img
                v-if="pick.map?.patch"
                :src="pick.map.patch"
                class="max-w-[44px] w-full h-auto max-h-[48%] object-contain drop-shadow-xl"
              />
              <span
                class="type-pill"
                :class="{
                  'pill-pick': pick.type === 'Pick',
                  'pill-ban': pick.type === 'Ban',
                  'pill-decider': pick.type === 'Decider',
                }"
              >
                {{
                  pick.type === "Decider"
                    ? $t("match.picks.decider")
                    : pick.type
                }}
              </span>
            </div>
          </div>

          <!-- info strip below: just team patch (+ optional side icon). Names live in the tooltip. -->
          <div class="info-strip">
            <div class="info-row">
              <img
                v-if="teamAvatarSrc(pick.match_lineup)"
                :src="teamAvatarSrc(pick.match_lineup)!"
                :alt="pick.match_lineup.name"
                class="team-avatar"
              />
              <span v-else class="info-name">{{ pick.match_lineup.name }}</span>
              <img
                v-if="startingSideFor(pick)"
                :src="
                  startingSideFor(pick) === 'CT'
                    ? '/img/teams/ct_logo.svg'
                    : '/img/teams/t_logo.svg'
                "
                class="side-icon"
              />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent class="max-w-xs">
          <div class="text-xs font-medium">
            {{ pickActionDescription(pick) }}
          </div>
          <div
            v-if="sidePickerDescription(pick)"
            class="text-[0.7rem] text-muted-foreground mt-0.5"
          >
            {{ sidePickerDescription(pick) }}
          </div>
          <div
            v-if="startingActionDescription(pick)"
            class="text-[0.7rem] text-muted-foreground mt-0.5"
          >
            {{ startingActionDescription(pick) }}
          </div>
        </TooltipContent>
      </Tooltip>
    </template>
  </div>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";

import { $, order_by } from "~/generated/zeus/index";
import cleanMapName from "~/utilities/cleanMapName";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  emits: ["update:count"],
  apollo: {
    match_map_veto_picks: {
      variables() {
        return {
          order_by: order_by.asc,
          matchId: this.$route.params.id,
        };
      },
      query: typedGql("query")({
        match_map_veto_picks: [
          {
            where: {
              match_id: {
                _eq: $("matchId", "uuid!"),
              },
            },
            order_by: [
              {},
              {
                created_at: $("order_by", "order_by"),
              },
            ],
          },
          {
            id: true,
            map: {
              id: true,
              name: true,
              patch: true,
              poster: true,
            },
            side: true,
            type: true,
            match_lineup_id: true,
            match_lineup: [
              {},
              {
                name: true,
                team: {
                  avatar_url: true,
                },
              },
            ],
          },
        ],
      }),
      result({ data }: { data: any }) {
        this.picks = data?.match_map_veto_picks ?? [];
        this.$emit(
          "update:count",
          this.picks.filter((p: any) => p.type !== "Side").length,
        );
      },
    },
  },
  data() {
    return {
      picks: undefined as any[] | undefined,
    };
  },
  computed: {
    loading() {
      return this.picks === undefined;
    },
    apiDomain() {
      return useRuntimeConfig().public.apiDomain;
    },
    visiblePicks(): any[] {
      return (this.picks ?? []).filter((p: any) => p.type !== "Side");
    },
  },
  methods: {
    oppositeSide(side: string) {
      return side === "CT" ? "T" : "CT";
    },
    sideFullName(side: string): string {
      return side === "CT"
        ? (this.$t("match.picks.counter_terrorist") as string)
        : (this.$t("match.picks.terrorist") as string);
    },
    sidePickForMap(mapId: string | undefined | null) {
      if (!mapId) return null;
      return (
        this.picks?.find(
          (p: any) => p.type === "Side" && p.map?.id === mapId,
        ) ?? null
      );
    },
    teamAvatarSrc(lineup: any): string | null {
      const url = lineup?.team?.avatar_url;
      if (!url) return null;
      return `https://${this.apiDomain}/${url}`;
    },
    // For a map pick/decider: the map picker starts on the OPPOSITE of
    // the side the other team picked.
    startingSideFor(pick: any): "CT" | "T" | null {
      if (pick.type === "Ban" || pick.type === "Side") return null;
      const sidePick = this.sidePickForMap(pick?.map?.id);
      if (!sidePick) return null;
      return this.oppositeSide(sidePick.side) as "CT" | "T";
    },
    pickActionDescription(pick: any): string {
      const team = pick.match_lineup?.name ?? "";
      const map = pick.map?.label || cleanMapName(pick.map?.name ?? "");
      switch (pick.type) {
        case "Pick":
          return this.$t("match.picks.action_pick", { team, map }) as string;
        case "Ban":
          return this.$t("match.picks.action_ban", { team, map }) as string;
        case "Side":
          return this.$t("match.picks.action_side", {
            team,
            side: this.sideFullName(pick.side),
            map,
          }) as string;
        case "Decider":
          return this.$t("match.picks.action_decider", { map }) as string;
        default:
          return "";
      }
    },
    startingActionDescription(pick: any): string | null {
      const side = this.startingSideFor(pick);
      if (!side) return null;
      return this.$t("match.picks.starts_on", {
        team: pick.match_lineup?.name ?? "",
        side: this.sideFullName(side),
      }) as string;
    },
    sidePickerDescription(pick: any): string | null {
      if (pick.type !== "Pick" && pick.type !== "Decider") return null;
      const sidePick = this.sidePickForMap(pick?.map?.id);
      if (!sidePick) return null;
      return this.$t("match.picks.side_picked_by", {
        team: sidePick.match_lineup?.name ?? "",
        side: this.sideFullName(sidePick.side),
      }) as string;
    },
  },
};
</script>

<style scoped>
.picks-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
  width: 100%;
}
@media (min-width: 1280px) {
  .picks-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.pick-card {
  display: block;
  width: 100%;
  min-width: 0;
  padding: 0;
  border-radius: 12px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border) / 0.6);
  overflow: hidden;
  font: inherit;
  color: inherit;
  cursor: default;
  transition:
    border-color 200ms ease,
    box-shadow 200ms ease;
}
.pick-card:hover {
  border-color: hsl(var(--tac-amber) / 0.45);
  box-shadow: 0 0 0 1px hsl(var(--tac-amber) / 0.15);
}
.pick-card:focus-visible {
  outline: none;
  border-color: hsl(var(--tac-amber) / 0.7);
  box-shadow: 0 0 0 2px hsl(var(--tac-amber) / 0.35);
}

.type-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.12rem 0.5rem;
  border-radius: 9999px;
  font-family: "Oxanium", ui-sans-serif, system-ui, sans-serif;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  line-height: 1;
  text-transform: uppercase;
  background: hsl(0 0% 0% / 0.55);
  backdrop-filter: blur(2px);
  text-shadow: 0 1px 2px hsl(0 0% 0% / 0.7);
}
.pill-pick {
  color: hsl(142 76% 58%);
  border: 1px solid hsl(142 76% 58% / 0.55);
}
.pill-ban {
  color: hsl(0 84% 64%);
  border: 1px solid hsl(0 84% 64% / 0.55);
}
.pill-decider {
  color: hsl(48 96% 62%);
  border: 1px solid hsl(48 96% 62% / 0.55);
}

.info-strip {
  padding: 0.5rem 0.65rem;
}
.info-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.team-avatar {
  flex: 0 0 auto;
  width: 1.6rem;
  height: 1.6rem;
  object-fit: cover;
  border-radius: 4px;
}

.side-icon {
  flex: 0 0 auto;
  width: 1.15rem;
  height: 1.15rem;
  object-fit: contain;
  margin-left: auto;
}

.info-name {
  font-family: "Oxanium", ui-sans-serif, system-ui, sans-serif;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1.1;
  color: hsl(var(--foreground));
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.info-name-sub {
  font-size: 0.7rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
}
</style>
