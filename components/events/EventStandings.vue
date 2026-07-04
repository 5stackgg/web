<script setup lang="ts">
import gql from "graphql-tag";
import { computed, ref, watch, onMounted } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { Users } from "lucide-vue-next";
import TrophyBadge from "~/components/trophy/TrophyBadge.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import { tacticalSectionLabelClasses, tacticalSectionTickClasses } from "~/utilities/tacticalClasses";

const props = defineProps<{ eventId: string }>();

// Selects only the trophy fields this component renders (badge config,
// tournament context, and the team/player identity per row); the `player`
// relation exists so the medal table can show a name/avatar without a second
// round-trip. Written as a raw `gql`
// document (rather than `typedGql`) to avoid a zeus `ExtractVariables`
// inference conflict when a nested `$(...)` argument sits alongside sibling
// selector fields; see EventLeaderboard.vue for the same pattern.
const EVENT_STANDINGS_QUERY = gql`
  query GetEventStandings($eventId: uuid!) {
    events_by_pk(id: $eventId) {
      tournaments {
        tournament {
          id
          name
          trophies {
            id
            tournament_team_id
            player_steam_id
            placement
            tournament {
              name
              start
              stages(order_by: { order: desc }, limit: 1) {
                type
              }
            }
            tournament_team {
              name
              team {
                id
                name
              }
            }
            trophy_config {
              custom_name
              silhouette
              image_url
            }
            team {
              id
              name
            }
            player {
              name
              avatar_url
            }
          }
        }
      }
    }
  }
`;

const { client: apolloClient } = useApolloClient();

const tournamentCards = ref<any[]>([]);
const loading = ref(true);

async function fetchStandings() {
  loading.value = true;
  try {
    const { data } = await apolloClient.query({
      query: EVENT_STANDINGS_QUERY,
      variables: { eventId: props.eventId },
      fetchPolicy: "network-only",
    });
    const entries = (data as any)?.events_by_pk?.tournaments || [];
    tournamentCards.value = entries
      .map((entry: any) => entry.tournament)
      .filter((tournament: any) => !!tournament);
  } catch (error) {
    console.error("Error fetching event standings:", error);
    tournamentCards.value = [];
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.eventId,
  () => fetchStandings(),
);
onMounted(fetchStandings);

const PLACEMENT_SLOTS = [
  { placement: 1, labelKey: "event.standings.champion" },
  { placement: 2, labelKey: "event.standings.runner_up" },
  { placement: 3, labelKey: "event.standings.third" },
  { placement: 0, labelKey: "event.standings.mvp" },
] as const;

// Placement trophies (1-3) are awarded as one canonical team row
// (player_steam_id null, only inserted when a global team is linked) plus one
// row per roster player, so a placement slot must collapse them to a single
// entry per team: prefer the canonical row, and for ad-hoc teams (no linked
// global team, hence no canonical row) keep one roster row per
// tournament_team. MVP (placement 0) rows are player-scoped.
function trophiesForPlacement(tournament: any, placement: number): any[] {
  const rows = (tournament?.trophies || []).filter(
    (trophy: any) => trophy.placement === placement,
  );
  if (placement === 0) {
    return rows;
  }

  const byTeam = new Map<string, any>();
  for (const trophy of rows) {
    const key = String(
      trophy.tournament_team_id ?? trophy.team?.id ?? trophy.id,
    );
    const existing = byTeam.get(key);
    if (!existing || (existing.player_steam_id && !trophy.player_steam_id)) {
      byTeam.set(key, trophy);
    }
  }
  return [...byTeam.values()];
}

function entityName(trophy: any): string {
  // MVP rows also carry the winning team's tournament_team_id, so the player
  // must win over the team relations here.
  if (trophy.placement === 0) {
    return trophy.player?.name || "";
  }
  return (
    trophy.team?.name ||
    trophy.tournament_team?.team?.name ||
    trophy.tournament_team?.name ||
    trophy.player?.name ||
    ""
  );
}

function entityLinkTo(trophy: any): { name: string; params: Record<string, string> } | null {
  if (trophy.placement === 0) {
    return trophy.player_steam_id
      ? { name: "players-id", params: { id: trophy.player_steam_id } }
      : null;
  }
  const teamId = trophy.team?.id || trophy.tournament_team?.team?.id;
  if (teamId) {
    return { name: "teams-id", params: { id: teamId } };
  }
  // A placement row with a player but no tournament_team is a manually
  // awarded player-scoped trophy; link the player directly.
  if (!trophy.tournament_team_id && trophy.player_steam_id) {
    return { name: "players-id", params: { id: trophy.player_steam_id } };
  }
  // Remaining rows without a linked global team represent an ad-hoc
  // tournament team; there is no team page to link, and linking the roster
  // player behind the row would be misleading.
  return null;
}

const TIER_COLORS = {
  mvp: "hsl(195 85% 60%)",
  gold: "hsl(45 95% 60%)",
  silver: "hsl(0 0% 78%)",
  bronze: "hsl(28 70% 52%)",
} as const;

interface MedalRow {
  key: string;
  name: string;
  isTeam: boolean;
  teamId: string | null;
  steamId: string | null;
  avatarUrl: string | null;
  mvp: number;
  gold: number;
  silver: number;
  bronze: number;
}

const medalTable = computed<MedalRow[]>(() => {
  const rows = new Map<string, MedalRow>();
  // A placement is awarded as one canonical team row plus one row per roster
  // player (all sharing tournament_team_id), so count exactly one team medal
  // per (tournament, team, placement); without this a 5-player team would
  // show 6 golds for a single tournament win. MVP (placement 0) stays
  // player-scoped.
  const seenTeamPlacements = new Set<string>();

  for (const tournament of tournamentCards.value) {
    for (const trophy of tournament.trophies || []) {
      const realTeamId =
        trophy.team?.id || trophy.tournament_team?.team?.id || null;
      const tournamentTeamId = trophy.tournament_team_id || null;
      const playerSteamId = trophy.player_steam_id || null;

      let key: string;
      let isTeam: boolean;
      let linkTeamId: string | null;
      if (trophy.placement === 0) {
        if (!playerSteamId) {
          continue;
        }
        isTeam = false;
        linkTeamId = null;
        key = `player:${playerSteamId}`;
      } else if (realTeamId || tournamentTeamId) {
        const dedupeKey = `${tournament.id}:${tournamentTeamId ?? realTeamId}:${trophy.placement}`;
        if (seenTeamPlacements.has(dedupeKey)) {
          continue;
        }
        seenTeamPlacements.add(dedupeKey);
        isTeam = true;
        linkTeamId = realTeamId;
        key = realTeamId ? `team:${realTeamId}` : `tteam:${tournamentTeamId}`;
      } else if (playerSteamId) {
        // Manually awarded placement trophy scoped to a player directly.
        isTeam = false;
        linkTeamId = null;
        key = `player:${playerSteamId}`;
      } else {
        continue;
      }

      if (!rows.has(key)) {
        rows.set(key, {
          key,
          name: entityName(trophy),
          isTeam,
          teamId: linkTeamId,
          steamId: isTeam ? null : playerSteamId,
          avatarUrl: isTeam ? null : (trophy.player?.avatar_url ?? null),
          mvp: 0,
          gold: 0,
          silver: 0,
          bronze: 0,
        });
      }

      const row = rows.get(key)!;
      if (trophy.placement === 0) row.mvp++;
      else if (trophy.placement === 1) row.gold++;
      else if (trophy.placement === 2) row.silver++;
      else if (trophy.placement === 3) row.bronze++;
    }
  }

  return Array.from(rows.values())
    .filter((row) => row.mvp + row.gold + row.silver + row.bronze > 0)
    .sort((a, b) => {
      if (a.gold !== b.gold) return b.gold - a.gold;
      if (a.silver !== b.silver) return b.silver - a.silver;
      if (a.bronze !== b.bronze) return b.bronze - a.bronze;
      return b.mvp - a.mvp;
    });
});
</script>

<template>
  <div class="space-y-8">
    <div v-if="loading" class="space-y-4">
      <Skeleton v-for="i in 2" :key="i" class="h-52 w-full rounded-md" />
    </div>

    <Empty v-else-if="tournamentCards.length === 0" class="min-h-[160px]">
      <p class="text-muted-foreground">{{ $t("event.standings.none") }}</p>
    </Empty>

    <template v-else>
      <div class="grid gap-4 lg:grid-cols-2">
        <div
          v-for="tournament in tournamentCards"
          :key="tournament.id"
          class="rounded-md border border-border/70 bg-card/40 p-4"
        >
          <NuxtLink
            :to="{ name: 'tournaments-tournamentId', params: { tournamentId: tournament.id } }"
            class="mb-3 block truncate font-sans text-base font-bold text-foreground hover:text-[hsl(var(--tac-amber))]"
          >
            {{ tournament.name }}
          </NuxtLink>

          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div
              v-for="slot in PLACEMENT_SLOTS"
              :key="slot.placement"
              class="flex flex-col items-center gap-1.5 text-center"
            >
              <span class="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                {{ $t(slot.labelKey) }}
              </span>

              <template v-if="trophiesForPlacement(tournament, slot.placement).length > 0">
                <div
                  v-for="trophy in trophiesForPlacement(tournament, slot.placement)"
                  :key="trophy.id"
                  class="flex flex-col items-center gap-1"
                >
                  <TrophyBadge
                    :tournament-id="tournament.id"
                    :placement="trophy.placement"
                    :tournament-name="tournament.name"
                    :tournament-start="trophy.tournament?.start"
                    :tournament-type="trophy.tournament?.stages?.[0]?.type"
                    :custom-name="trophy.trophy_config?.custom_name"
                    :silhouette-override="trophy.trophy_config?.silhouette"
                    :image-url="trophy.trophy_config?.image_url"
                    size="sm"
                  />
                  <component
                    :is="entityLinkTo(trophy) ? 'NuxtLink' : 'span'"
                    :to="entityLinkTo(trophy) ?? undefined"
                    class="max-w-[6rem] truncate text-xs font-medium text-foreground"
                    :class="{ 'hover:text-[hsl(var(--tac-amber))]': entityLinkTo(trophy) }"
                  >
                    {{ entityName(trophy) }}
                  </component>
                </div>
              </template>
              <span v-else class="text-xs text-muted-foreground/60">-</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="medalTable.length > 0">
        <div :class="[tacticalSectionLabelClasses]">
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("event.standings.medal_table") }}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-12">#</TableHead>
              <TableHead>{{ $t("common.player") }}</TableHead>
              <TableHead class="text-right">{{ $t("event.standings.mvp") }}</TableHead>
              <TableHead class="text-right">{{ $t("event.standings.gold") }}</TableHead>
              <TableHead class="text-right">{{ $t("event.standings.silver") }}</TableHead>
              <TableHead class="text-right">{{ $t("event.standings.bronze") }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(row, index) in medalTable" :key="row.key">
              <TableCell class="text-muted-foreground">{{ index + 1 }}</TableCell>
              <TableCell>
                <PlayerDisplay
                  v-if="!row.isTeam"
                  :player="{
                    steam_id: row.steamId,
                    name: row.name,
                    avatar_url: row.avatarUrl,
                  }"
                  size="xs"
                  :show-elo="false"
                  :show-online="false"
                  :show-role="false"
                  linkable
                />
                <component
                  :is="row.teamId ? 'NuxtLink' : 'span'"
                  v-else
                  :to="row.teamId ? { name: 'teams-id', params: { id: row.teamId } } : undefined"
                  class="flex items-center gap-1.5 text-sm"
                >
                  <Users class="h-3.5 w-3.5 text-muted-foreground" />
                  {{ row.name }}
                </component>
              </TableCell>
              <TableCell class="text-right font-mono tabular-nums" :style="{ color: TIER_COLORS.mvp }">
                {{ row.mvp || "-" }}
              </TableCell>
              <TableCell class="text-right font-mono tabular-nums" :style="{ color: TIER_COLORS.gold }">
                {{ row.gold || "-" }}
              </TableCell>
              <TableCell class="text-right font-mono tabular-nums" :style="{ color: TIER_COLORS.silver }">
                {{ row.silver || "-" }}
              </TableCell>
              <TableCell class="text-right font-mono tabular-nums" :style="{ color: TIER_COLORS.bronze }">
                {{ row.bronze || "-" }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </template>
  </div>
</template>
