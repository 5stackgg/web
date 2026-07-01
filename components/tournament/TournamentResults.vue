<script lang="ts" setup>
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import MatchTableRow from "~/components/MatchTableRow.vue";
import TrophyBadge from "~/components/trophy/TrophyBadge.vue";
import StageStandings from "~/components/tournament/StageStandings.vue";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "~/components/ui/hover-card";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import { kdColor } from "~/utils/statTiers";

const apiDomain = useRuntimeConfig().public.apiDomain;

function playerAvatarSrc(player: {
  custom_avatar_url?: string | null;
  avatar_url?: string | null;
}) {
  return resolveAvatarUrl(
    player.custom_avatar_url || player.avatar_url,
    apiDomain,
  );
}
</script>

<template>
  <div class="space-y-6">
    <section
      v-if="showStandings && podium.length && !isLive"
      class="relative rounded-lg border border-border px-6 py-7 [background:radial-gradient(ellipse_at_top,hsl(var(--tac-amber)_/_0.08)_0%,transparent_60%),linear-gradient(180deg,hsl(var(--card)_/_0.6)_0%,hsl(var(--card)_/_0.25)_100%)] before:pointer-events-none before:absolute before:left-2 before:top-2 before:h-[14px] before:w-[14px] before:border-l-2 before:border-t-2 before:border-[hsl(var(--tac-amber))] before:content-[''] after:pointer-events-none after:absolute after:bottom-2 after:right-2 after:h-[14px] after:w-[14px] after:border-b-2 after:border-r-2 after:border-[hsl(var(--tac-amber))] after:content-['']"
    >
      <div
        class="pointer-events-none absolute inset-0 [background-image:repeating-linear-gradient(3deg,transparent_0,transparent_3px,hsl(var(--tac-amber)_/_0.025)_3px,hsl(var(--tac-amber)_/_0.025)_4px)]"
        aria-hidden="true"
      ></div>

      <header class="relative mb-6 flex flex-col gap-1">
        <div
          class="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground"
        >
          <span
            class="translate-y-[-1px] text-[0.7rem] text-[hsl(var(--tac-amber))]"
            >◢</span
          >
          {{ $t("trophies.title") }}
        </div>
        <div
          class="font-mono text-[0.62rem] uppercase tracking-[0.3em] text-muted-foreground/70"
        >
          {{ $t("tournament.final_standings_podium") }}
        </div>
      </header>

      <div
        class="relative flex flex-col items-center justify-center gap-6 sm:flex-row sm:items-end sm:gap-4 md:gap-6"
      >
        <HoverCard
          v-for="entry in podium"
          :key="entry.placement + '-' + entry.teamId"
          :open-delay="120"
          :close-delay="80"
        >
          <HoverCardTrigger as-child>
            <div
              class="group/step relative flex w-full max-w-xs cursor-default flex-col items-center gap-3 sm:w-auto sm:flex-1"
              :class="{
                'order-1 sm:order-2': entry.placement === 1,
                'order-2 sm:order-1': entry.placement === 2,
                'order-3': entry.placement === 3,
              }"
            >
              <div
                class="rounded-sm border px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.22em]"
                :style="{
                  borderColor: tierColor(entry.placement) + '66',
                  background: tierColor(entry.placement) + '14',
                  color: tierColor(entry.placement),
                }"
              >
                {{ placementLabel(entry.placement) }}
              </div>

              <div class="relative">
                <div
                  class="pointer-events-none absolute inset-0 blur-2xl transition-opacity duration-300 group-hover/step:opacity-100"
                  :class="entry.placement === 1 ? 'opacity-60' : 'opacity-30'"
                  :style="{
                    background: `radial-gradient(ellipse at center, ${tierColor(entry.placement)} 0%, transparent 65%)`,
                  }"
                  aria-hidden="true"
                ></div>
                <TrophyBadge
                  :tournament-id="tournament.id"
                  :placement="entry.placement"
                  :tournament-name="tournament.name"
                  :tournament-start="tournament.start"
                  :tournament-type="entry.tournamentType"
                  :custom-name="trophyConfigFor(entry.placement)?.custom_name"
                  :silhouette-override="
                    trophyConfigFor(entry.placement)?.silhouette
                  "
                  :image-url="trophyConfigFor(entry.placement)?.image_url"
                  :size="entry.placement === 1 ? 'lg' : 'md'"
                  :interactive="false"
                  class="relative z-[1]"
                />
              </div>

              <div
                class="relative w-full border border-border/80 bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--muted)_/_0.4)_100%)] px-4 pb-4 pt-3 transition-colors duration-150 group-hover/step:border-[hsl(var(--tac-amber)_/_0.6)]"
                :class="
                  entry.placement === 1
                    ? 'min-h-[130px] sm:min-h-[150px]'
                    : entry.placement === 2
                      ? 'min-h-[110px] sm:min-h-[125px]'
                      : 'min-h-[95px] sm:min-h-[110px]'
                "
                :style="{
                  clipPath:
                    'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%, 0 8px)',
                }"
              >
                <span
                  class="pointer-events-none absolute inset-x-4 top-0 h-[2px]"
                  :style="{
                    background: `linear-gradient(90deg, transparent, ${tierColor(entry.placement)}, transparent)`,
                  }"
                ></span>

                <div class="flex flex-col items-center gap-1">
                  <div
                    class="font-mono text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground"
                  >
                    #{{ String(entry.placement).padStart(2, "0") }}
                  </div>
                  <NuxtLink
                    v-if="entry.realTeamId"
                    :to="`/teams/${entry.realTeamId}`"
                    class="text-center text-base font-bold uppercase leading-tight tracking-[0.02em] hover:underline sm:text-lg"
                    @click.stop
                  >
                    {{ entry.teamName }}
                  </NuxtLink>
                  <div
                    v-else
                    class="text-center text-base font-bold uppercase leading-tight tracking-[0.02em] sm:text-lg"
                  >
                    {{ entry.teamName }}
                  </div>
                  <div class="mt-1.5 flex -space-x-2">
                    <NuxtLink
                      v-for="p in entry.players.slice(0, 5)"
                      :key="p.steam_id"
                      :to="p.steam_id ? `/players/${p.steam_id}` : undefined"
                      class="relative h-6 w-6 overflow-hidden rounded-sm border border-border/80 bg-muted/40 transition-transform hover:scale-110 hover:border-[hsl(var(--tac-amber))] hover:z-10"
                      :title="p.name"
                    >
                      <img
                        v-if="playerAvatarSrc(p)"
                        :src="playerAvatarSrc(p)"
                        :alt="p.name"
                        class="h-full w-full object-cover"
                      />
                      <span
                        v-else
                        class="flex h-full w-full items-center justify-center text-[0.6rem] font-bold uppercase text-muted-foreground"
                      >
                        {{ (p.name || "?").slice(0, 1) }}
                      </span>
                    </NuxtLink>
                    <div
                      v-if="entry.players.length > 5"
                      class="flex h-6 min-w-6 items-center justify-center rounded-sm border border-border/80 bg-muted/40 px-1 text-[0.55rem] font-bold text-muted-foreground"
                    >
                      +{{ entry.players.length - 5 }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </HoverCardTrigger>
          <HoverCardContent
            class="z-[100] w-[320px] border-[hsl(var(--tac-amber)_/_0.5)] bg-background/95 p-0 [backdrop-filter:blur(8px)]"
            side="bottom"
            :side-offset="8"
            :avoid-collisions="false"
          >
            <div class="border-b border-border/60 px-3 py-2">
              <div
                class="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
              >
                ▚ TOURNAMENT STATS · {{ placementLabel(entry.placement) }}
              </div>
              <NuxtLink
                v-if="entry.realTeamId"
                :to="`/teams/${entry.realTeamId}`"
                class="text-sm font-bold uppercase tracking-[0.04em] hover:underline"
              >
                {{ entry.teamName }}
              </NuxtLink>
              <div v-else class="text-sm font-bold uppercase tracking-[0.04em]">
                {{ entry.teamName }}
              </div>
            </div>
            <div class="divide-y divide-border/40">
              <div
                v-for="p in entry.players"
                :key="p.steam_id"
                class="grid items-center gap-2 px-3 py-2 text-xs"
                :class="
                  seasonsEnabled
                    ? 'grid-cols-[1fr_auto_auto_auto_auto_auto]'
                    : 'grid-cols-[1fr_auto_auto_auto_auto]'
                "
              >
                <PlayerDisplay
                  :player="p"
                  :show-flag="true"
                  :show-role="false"
                  :show-elo="false"
                  :linkable="true"
                  size="xs"
                />
                <template v-if="playerStatFor(p.steam_id)">
                  <div class="flex flex-col items-end">
                    <span
                      class="font-mono font-bold tabular-nums text-foreground"
                    >
                      {{ playerStatFor(p.steam_id).kills }}
                    </span>
                    <span
                      class="font-mono text-[0.55rem] uppercase tracking-[0.15em] text-muted-foreground"
                      >K</span
                    >
                  </div>
                  <div class="flex flex-col items-end">
                    <span
                      class="font-mono font-bold tabular-nums text-foreground"
                    >
                      {{ playerStatFor(p.steam_id).assists }}
                    </span>
                    <span
                      class="font-mono text-[0.55rem] uppercase tracking-[0.15em] text-muted-foreground"
                      >A</span
                    >
                  </div>
                  <div class="flex flex-col items-end">
                    <span
                      class="font-mono font-bold tabular-nums text-foreground"
                    >
                      {{ playerStatFor(p.steam_id).deaths }}
                    </span>
                    <span
                      class="font-mono text-[0.55rem] uppercase tracking-[0.15em] text-muted-foreground"
                      >D</span
                    >
                  </div>
                  <div class="flex flex-col items-end">
                    <span
                      class="font-mono font-bold tabular-nums"
                      :style="{
                        color: kdColor(playerStatFor(p.steam_id).kdr),
                      }"
                    >
                      {{ playerStatFor(p.steam_id).kdr.toFixed(2) }}
                    </span>
                    <span
                      class="font-mono text-[0.55rem] uppercase tracking-[0.15em] text-muted-foreground"
                      >K/D</span
                    >
                  </div>
                  <div v-if="seasonsEnabled" class="flex flex-col items-end">
                    <span
                      class="font-mono font-bold tabular-nums text-[hsl(var(--tac-amber))]"
                    >
                      {{ tournamentEloFor(p.steam_id) ?? "—" }}
                    </span>
                    <span
                      class="font-mono text-[0.55rem] uppercase tracking-[0.15em] text-muted-foreground"
                      >{{ $t("pages.players.table.elo_track_tournament") }}</span
                    >
                  </div>
                </template>
                <template v-else>
                  <div
                    class="text-right font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/60"
                    :class="seasonsEnabled ? 'col-span-5' : 'col-span-4'"
                  >
                    {{ $t("tournament.results_section.no_data") }}
                  </div>
                </template>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      </div>

      <div
        v-if="mvp"
        class="relative mt-7 flex flex-col gap-4 border-t border-dashed border-border pt-6 sm:flex-row sm:items-center"
      >
        <div class="flex items-center gap-4 sm:flex-1">
          <div class="relative shrink-0">
            <div
              class="pointer-events-none absolute inset-0 blur-2xl"
              :style="{
                background:
                  'radial-gradient(ellipse at center, hsl(195 85% 60%) 0%, transparent 65%)',
                opacity: 0.45,
              }"
              aria-hidden="true"
            ></div>
            <TrophyBadge
              :tournament-id="tournament.id"
              :placement="0"
              :tournament-name="tournament.name"
              :tournament-start="tournament.start"
              :tournament-type="finalStageType"
              :custom-name="trophyConfigFor(0)?.custom_name"
              :silhouette-override="trophyConfigFor(0)?.silhouette"
              :image-url="trophyConfigFor(0)?.image_url"
              size="md"
              :interactive="false"
              class="relative z-[1]"
            />
          </div>

          <div class="flex min-w-0 flex-1 flex-col gap-1.5">
            <div
              class="inline-flex w-fit items-center gap-2 rounded-sm border px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-[0.24em]"
              style="
                border-color: hsl(195 85% 60% / 0.55);
                background: hsl(195 85% 60% / 0.12);
                color: hsl(195 85% 60%);
              "
            >
              <span
                class="inline-block h-1.5 w-1.5 rounded-full"
                style="
                  background: hsl(195 85% 60%);
                  box-shadow: 0 0 6px hsl(195 85% 60%);
                "
              ></span>
              {{ $t("tournament.results_section.mvp") }}
            </div>
            <PlayerDisplay
              v-if="mvp.player"
              :player="mvp.player"
              :show-flag="true"
              :show-role="false"
              :show-elo="true"
              :linkable="true"
              size="sm"
            />
            <div
              v-if="mvpTeamName"
              class="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground"
            >
              ↳ {{ mvpTeamName }}
            </div>
          </div>
        </div>

        <div
          v-if="mvpStats"
          class="grid grid-cols-4 gap-0 overflow-hidden rounded-sm border border-border/80 bg-background/60 [backdrop-filter:blur(4px)] sm:w-auto"
        >
          <div
            class="flex flex-col items-center border-r border-border/60 px-4 py-2"
          >
            <span class="font-mono text-base font-bold tabular-nums">{{
              mvpStats.kills
            }}</span>
            <span
              class="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground"
              >{{ $t("common.stats.kills") }}</span
            >
          </div>
          <div
            class="flex flex-col items-center border-r border-border/60 px-4 py-2"
          >
            <span class="font-mono text-base font-bold tabular-nums">{{
              mvpStats.assists
            }}</span>
            <span
              class="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground"
              >{{ $t("common.stats.assists") }}</span
            >
          </div>
          <div
            class="flex flex-col items-center border-r border-border/60 px-4 py-2"
          >
            <span class="font-mono text-base font-bold tabular-nums">{{
              mvpStats.deaths
            }}</span>
            <span
              class="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground"
              >{{ $t("common.stats.deaths") }}</span
            >
          </div>
          <div class="flex flex-col items-center px-4 py-2">
            <span
              class="font-mono text-base font-bold tabular-nums"
              :style="{
                color: kdColor(mvpStats.kdr),
              }"
            >
              {{ mvpStats.kdr.toFixed(2) }}
            </span>
            <span
              class="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground"
              >K/D</span
            >
          </div>
        </div>
      </div>
    </section>

    <template v-if="showStandings">
      <Card v-for="stage in stagesWithStandings" :key="stage.id">
        <CardHeader>
          <div class="flex items-center justify-between gap-3">
            <CardTitle>
              <template v-if="stagesWithStandings.length > 1">
                {{ $t("tournament.stage.stage_tab", { stage: stage.order }) }}
                ·
                {{ stage.e_tournament_stage_type?.description || "" }}
              </template>
              <template v-else>
                {{ $t("tournament.standings.title") }}
              </template>
            </CardTitle>
            <span
              v-if="isLive"
              class="inline-flex items-center gap-2 rounded-sm border border-destructive/55 bg-destructive/15 px-2.5 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-[0.22em] text-destructive"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-current"></span>
              LIVE · PROVISIONAL
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <StageStandings
            :stage="stage"
            :player-stats="tournamentPlayerStats"
          />
        </CardContent>
      </Card>
      <div
        v-if="stagesWithStandings.length === 0"
        class="rounded-md border border-dashed border-border p-10 text-center text-muted-foreground"
      >
        {{ $t("tournament.stage.no_standings") }}
      </div>
    </template>

    <Card v-if="showMatches">
      <CardHeader>
        <CardTitle>{{ $t("tournament.results.title") }}</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="space-y-4">
          <MatchTableRow
            v-for="match in allMatches"
            :key="match.id"
            :match="match"
          />
          <div
            v-if="allMatches.length === 0"
            class="text-center text-muted-foreground py-8"
          >
            {{ $t("tournament.results_section.no_matches_played") }}
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script lang="ts">
import { $, e_tournament_status_enum, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { mapFields } from "~/graphql/mapGraphql";
import { playerFields } from "~/graphql/playerFields";

export default {
  props: {
    tournament: {
      type: Object,
      required: true,
    },
    showStandings: {
      type: Boolean,
      default: true,
    },
    showMatches: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      tournamentMatches: [] as any[],
      tournamentPlayerStats: [] as any[],
      tournamentPlayerElo: [] as any[],
    };
  },
  apollo: {
    tournamentPlayerElo: {
      query: typedGql("query")({
        players: [
          {
            where: {
              steam_id: { _in: $("steamIds", "[bigint!]!") },
            },
          },
          {
            steam_id: true,
            elo: true,
          },
        ],
      }),
      variables: function () {
        return {
          steamIds: ((this as any).tournamentPlayerStats || []).map(
            (s: any) => s.player_steam_id,
          ),
        };
      },
      skip: function () {
        const self = this as any;
        return !self.seasonsEnabled || !self.tournamentPlayerStats?.length;
      },
      update: function (data: { players: any[] }) {
        return data?.players || [];
      },
    },
    $subscribe: {
      tournamentMatches: {
        query: typedGql("subscription")({
          matches: [
            {
              where: {
                tournament_brackets: {
                  stage: {
                    tournament_id: {
                      _eq: $("tournamentId", "uuid!"),
                    },
                  },
                },
              },
              order_by: [{ created_at: order_by.desc }],
            },
            {
              id: true,
              status: true,
              ended_at: true,
              e_match_status: { description: true },
              winning_lineup_id: true,
              lineup_1_id: true,
              lineup_2_id: true,
              created_at: true,
              started_at: true,
              scheduled_at: true,
              options: {
                mr: true,
                best_of: true,
                type: true,
              },
              match_maps: [
                { order_by: [{ order: order_by.asc }] },
                {
                  map: mapFields,
                  lineup_1_score: true,
                  lineup_2_score: true,
                  winning_lineup_id: true,
                  order: true,
                  status: true,
                  vetos: {
                    side: true,
                    type: true,
                    match_lineup_id: true,
                  },
                },
              ],
              lineup_1: {
                id: true,
                name: true,
                is_on_lineup: true,
                team_id: true,
                lineup_players: [
                  {},
                  {
                    checked_in: true,
                    placeholder_name: true,
                    player: playerFields,
                  },
                ],
              },
              lineup_2: {
                id: true,
                name: true,
                is_on_lineup: true,
                team_id: true,
                lineup_players: [
                  {},
                  {
                    checked_in: true,
                    placeholder_name: true,
                    player: playerFields,
                  },
                ],
              },
              max_players_per_lineup: true,
              min_players_per_lineup: true,
              lineup_counts: [{}, true],
              is_in_lineup: true,
              is_coach: true,
              streams: [
                { order_by: [{ priority: order_by.asc }] },
                {
                  id: true,
                  link: true,
                  title: true,
                  priority: true,
                  is_game_streamer: true,
                },
              ],
              elo_changes: [
                {},
                {
                  player_steam_id: true,
                  elo_change: true,
                },
              ],
            },
          ],
        }),
        variables: function () {
          return {
            tournamentId: (this as any).tournament?.id,
          };
        },
        skip: function () {
          return !(this as any).showMatches || !(this as any).tournament?.id;
        },
        result: function ({ data }: { data: { matches: any[] } }) {
          (this as any).tournamentMatches = data?.matches || [];
        },
      },
      tournamentPlayerStats: {
        query: typedGql("subscription")({
          v_tournament_player_stats: [
            {
              where: {
                tournament_id: {
                  _eq: $("tournamentId", "uuid!"),
                },
              },
            },
            {
              player_steam_id: true,
              kills: true,
              deaths: true,
              assists: true,
              headshots: true,
              kdr: true,
              headshot_percentage: true,
              matches_played: true,
            },
          ],
        }),
        variables: function () {
          return {
            tournamentId: (this as any).tournament?.id,
          };
        },
        skip: function () {
          const self = this as any;
          if (!self.tournament?.id) return true;
          return !self.showMatches && !self.showStandings;
        },
        result: function ({
          data,
        }: {
          data: { v_tournament_player_stats: any[] };
        }) {
          (this as any).tournamentPlayerStats =
            data?.v_tournament_player_stats || [];
        },
      },
    },
  },
  methods: {
    tierColor(placement: number) {
      if (placement === 0) return "hsl(195 85% 60%)";
      if (placement === 1) return "hsl(45 95% 60%)";
      if (placement === 2) return "hsl(0 0% 78%)";
      return "hsl(28 70% 52%)";
    },
    placementLabel(placement: number) {
      if (placement === 0) return this.$t("trophies.mvp");
      if (placement === 1) return this.$t("trophies.first_place");
      if (placement === 2) return this.$t("trophies.second_place");
      return this.$t("trophies.third_place");
    },
    trophyConfigFor(placement: number) {
      const configs = (this.tournament as any)?.trophy_configs || [];
      return configs.find((c: any) => c.placement === placement) || null;
    },
    displayTeamName(tournamentTeam: any, fallbackId?: string) {
      const underlying = tournamentTeam?.team?.name;
      if (underlying) return underlying;
      const ownName = tournamentTeam?.name;
      if (ownName) return ownName;
      return fallbackId ? `Team ${fallbackId}` : "";
    },
    tournamentEloFor(steamId: string | number): number | null {
      if (!steamId) return null;
      const row = (this as any).tournamentPlayerElo?.find(
        (p: any) => String(p.steam_id) === String(steamId),
      );
      const value = row?.elo?.tournament_competitive;
      return value != null ? Math.round(Number(value)) : null;
    },
    playerStatFor(steamId: string | number) {
      if (!steamId) return null;
      const stats = (this as any).tournamentPlayerStats || [];
      const raw = stats.find(
        (s: any) => String(s.player_steam_id) === String(steamId),
      );
      if (!raw) return null;
      return {
        ...raw,
        kills: Number(raw.kills ?? 0),
        deaths: Number(raw.deaths ?? 0),
        assists: Number(raw.assists ?? 0),
        headshots: Number(raw.headshots ?? 0),
        matches_played: Number(raw.matches_played ?? 0),
        kdr: Number(raw.kdr ?? 0),
        headshot_percentage: Number(raw.headshot_percentage ?? 0),
      };
    },
  },
  computed: {
    seasonsEnabled() {
      return useApplicationSettingsStore().seasonsEnabled;
    },
    isLive() {
      return (this.tournament as any)?.status === e_tournament_status_enum.Live;
    },
    finalStageType() {
      const stages = (this.tournament as any)?.stages || [];
      return stages.length ? stages[stages.length - 1]?.type || null : null;
    },
    podium() {
      const trophies = (this.tournament as any)?.trophies || [];
      if (trophies.length === 0) return [];
      const byPlacement = new Map();
      for (const t of trophies) {
        if (t.placement === 0) continue;
        const existing = byPlacement.get(t.placement);
        if (existing) {
          if (
            t.player &&
            !existing.players.some(
              (p: any) => String(p.steam_id) === String(t.player.steam_id),
            )
          ) {
            existing.players.push(t.player);
          }
          continue;
        }
        const rosterPlayers = (t.tournament_team?.roster || [])
          .map((r: any) => r.player)
          .filter(Boolean);
        const players = rosterPlayers.length
          ? rosterPlayers
          : t.player
            ? [t.player]
            : [];
        byPlacement.set(t.placement, {
          placement: t.placement,
          teamId: t.tournament_team_id,
          realTeamId: t.tournament_team?.team?.id || null,
          teamName: this.displayTeamName(
            t.tournament_team,
            t.tournament_team_id,
          ),
          tournamentType: this.finalStageType,
          players,
        });
      }
      return Array.from(byPlacement.values()).sort(
        (a: any, b: any) => a.placement - b.placement,
      );
    },
    mvp() {
      const trophies = (this.tournament as any)?.trophies || [];
      return trophies.find((t: any) => t.placement === 0) || null;
    },
    mvpTeamName() {
      if (!this.mvp?.tournament_team) return "";
      return this.displayTeamName(
        this.mvp.tournament_team,
        this.mvp.tournament_team_id,
      );
    },
    mvpStats() {
      if (!this.mvp?.player_steam_id) return null;
      return this.playerStatFor(this.mvp.player_steam_id);
    },
    stagesWithStandings() {
      const stages = ((this.tournament as any)?.stages || []) as any[];
      return stages
        .filter(
          (stage: any) =>
            Array.isArray(stage?.results) && stage.results.length > 0,
        )
        .slice()
        .sort(
          (a: any, b: any) => (Number(a.order) || 0) - (Number(b.order) || 0),
        );
    },
    allMatches() {
      return (this as any).tournamentMatches || [];
    },
  },
};
</script>
