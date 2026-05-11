<script lang="ts" setup>
import formatStatValue from "~/utilities/formatStatValue";
import { kdrColor } from "~/utilities/kdrColor";
import EloChangeBadge from "~/components/EloChangeBadge.vue";
import PlayerMatchClipsButton from "~/components/match/PlayerMatchClipsButton.vue";
import MultiKillDrilldown from "~/components/match/MultiKillDrilldown.vue";

// Placeholder shown while the lineup-stats subscription is still loading
// (the shell match sub doesn't carry per-player aggregates anymore).
const DASH = "—";
</script>
<template>
  <TableRow>
    <TableCell class="overflow-hidden">
      <LineupMember :match="match" :member="member">
        <template v-if="member.player?.steam_id" #avatar-badge>
          <PlayerMatchClipsButton :steam-id="member.player.steam_id" />
        </template>
        <template v-if="memberEloChange" #elo-postfix>
          <EloChangeBadge :elo-change="memberEloChange" size="xs" />
        </template>
      </LineupMember>
    </TableCell>
    <template v-if="showStats">
      <TableCell class="text-center">{{ stats?.kills ?? DASH }}</TableCell>
      <TableCell class="hidden md:table-cell text-center">
        {{ stats?.assists ?? DASH }}
      </TableCell>
      <TableCell class="text-center">{{ stats?.deaths ?? DASH }}</TableCell>
      <TableCell class="hidden md:table-cell text-center">
        <span :class="kdrColor(kd)">{{ kd }}</span>
      </TableCell>
      <TableCell class="hidden lg:table-cell text-center">{{ hs }}</TableCell>
      <TableCell class="hidden 2xl:table-cell text-center">
        {{ stats?.team_damage ?? DASH }}
      </TableCell>
      <TableCell class="hidden xl:table-cell text-center">
        {{ totalMultiKills ?? DASH }}
      </TableCell>
      <TableCell
        class="hidden 2xl:table-cell text-center"
        :class="{ 'cursor-pointer hover:underline': hasMultiKillsToShow(2) }"
        @click="hasMultiKillsToShow(2) && openMultiKillDrilldown(2)"
      >
        {{ twoKills }}
      </TableCell>
      <TableCell
        class="hidden 2xl:table-cell text-center"
        :class="{ 'cursor-pointer hover:underline': hasMultiKillsToShow(3) }"
        @click="hasMultiKillsToShow(3) && openMultiKillDrilldown(3)"
      >
        {{ threeKills }}
      </TableCell>
      <TableCell
        class="hidden 2xl:table-cell text-center"
        :class="{ 'cursor-pointer hover:underline': hasMultiKillsToShow(4) }"
        @click="hasMultiKillsToShow(4) && openMultiKillDrilldown(4)"
      >
        {{ fourKills }}
      </TableCell>
      <TableCell
        class="hidden 2xl:table-cell text-center"
        :class="{ 'cursor-pointer hover:underline': hasMultiKillsToShow(5) }"
        @click="hasMultiKillsToShow(5) && openMultiKillDrilldown(5)"
      >
        {{ fiveKills }}
      </TableCell>
      <TableCell class="hidden 2xl:table-cell text-center">
        {{ stats?.knife_kills ?? DASH }}
      </TableCell>
      <TableCell class="hidden 2xl:table-cell text-center">
        {{ stats?.zeus_kills ?? DASH }}
      </TableCell>
      <TableCell class="hidden table-cell text-center">
        <div class="flex items-center justify-center gap-2">
          <span>{{ stats?.damage ?? DASH }}</span>
          <Badge
            v-if="hasStats"
            class="text-xs whitespace-nowrap"
            variant="outline"
          >
            <span
              :class="{
                'text-red-500': adr >= 0 && adr < 50,
                'text-orange-500': adr >= 50 && adr < 75,
                'text-white': adr >= 75 && adr < 95,
                'text-green-400': adr >= 95 && adr < 115,
                'text-green-600': adr >= 115,
              }"
            >
              {{ adr }}
            </span>
            &nbsp; ADR
          </Badge>
        </div>
      </TableCell>
    </template>
    <MultiKillDrilldown
      v-if="drilldownKillCount !== null"
      :open="drilldownKillCount !== null"
      :match-id="match.id"
      :steam-id="member.steam_id"
      :player-name="member.player?.name ?? member.placeholder_name"
      :kills="drilldownKillCount"
      @close="drilldownKillCount = null"
    />
    <TableCell v-if="canDoActions">
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="secondary" size="icon">
            <PaginationEllipsis></PaginationEllipsis>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-56">
          <template v-if="lineup.can_update_lineup">
            <DropdownMenuItem @click="makeCaptain" :disabled="member.captain">
              <span>{{ $t("match.overview.promote_captain") }}</span>
            </DropdownMenuItem>

            <DropdownMenuItem @click="switchTeams" v-if="canSwitchTeams">
              <span>{{ $t("match.overview.switch_teams") }}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator vp />

            <DropdownMenuItem
              class="text-destructive"
              @click="removeFromLineup"
              v-if="lineup.can_update_lineup"
            >
              <span>{{ $t("match.overview.remove_from_lineup") }}</span>
            </DropdownMenuItem>
          </template>

          <DropdownMenuItem
            @click="switchTeams"
            v-if="!lineup.can_update_lineup && canSwitchTeams"
          >
            <span>{{ $t("match.overview.switch_teams") }}</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            class="text-destructive"
            @click="removeFromLineup"
            v-if="canLeaveLineup"
          >
            <span>{{ $t("match.overview.leave_lineup") }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TableCell>
  </TableRow>
</template>

<script lang="ts">
import LineupMember from "~/components/match/LineupMember.vue";
import { generateMutation } from "~/graphql/graphqlGen";
import { $, e_lobby_access_enum, e_match_status_enum } from "~/generated/zeus";

export default {
  components: {
    LineupMember,
  },
  data() {
    return {
      drilldownKillCount: null as null | number,
    };
  },
  props: {
    match: {
      required: true,
      type: Object,
    },
    member: {
      required: true,
      type: Object,
    },
    lineup: {
      required: true,
      type: Object,
    },
    showStats: {
      type: Boolean,
      default: true,
    },
  },
  methods: {
    hasMultiKillsToShow(kills: number): boolean {
      if (!this.stats) return false;
      const key = (
        {
          2: "two_kill_rounds",
          3: "three_kill_rounds",
          4: "four_kill_rounds",
          5: "five_kill_rounds",
        } as const
      )[kills];
      return key ? (this.stats[key] ?? 0) > 0 : false;
    },
    openMultiKillDrilldown(kills: number) {
      this.drilldownKillCount = kills;
    },
    async switchTeams() {
      if (!this.lineup.can_update_lineup) {
        return await this.$apollo.mutate({
          mutation: generateMutation({
            switchLineup: [
              {
                match_id: $("match_id", "String!"),
              },
              {
                success: true,
              },
            ],
          }),
          variables: {
            match_id: this.match.id,
          },
        });
      }

      await this.$apollo.mutate({
        mutation: generateMutation({
          update_match_lineup_players: [
            {
              where: {
                steam_id: {
                  _eq: $("steam_id", "bigint"),
                },
                match_lineup_id: {
                  _eq: $("match_lineup_id", "uuid"),
                },
              },
              _set: {
                match_lineup_id: $("new_match_lineup_id", "uuid"),
              },
            },
            {
              __typename: true,
            },
          ],
        }),
        variables: {
          steam_id: this.member.steam_id,
          match_lineup_id: this.lineup.id,
          new_match_lineup_id:
            this.lineup.id === this.match.lineup_1_id
              ? this.match.lineup_2_id
              : this.match.lineup_1_id,
        },
      });
    },
    async makeCaptain() {
      if (this.member.captain) {
        return;
      }
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_match_lineup_players: [
            {
              where: {
                steam_id: {
                  _eq: $("steam_id", "bigint"),
                },
                match_lineup_id: {
                  _eq: $("match_lineup_id", "uuid"),
                },
              },
              _set: {
                captain: true,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
        variables: {
          steam_id: this.member.steam_id,
          match_lineup_id: this.lineup.id,
        },
      });
    },
    async removeFromLineup() {
      if (!this.lineup.can_update_lineup) {
        return await this.$apollo.mutate({
          mutation: generateMutation({
            leaveLineup: [
              {
                match_id: $("match_id", "String!"),
              },
              {
                success: true,
              },
            ],
          }),
          variables: {
            match_id: this.match.id,
          },
        });
      }

      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_match_lineup_players: [
            {
              where: {
                steam_id: {
                  _eq: $("steam_id", "bigint"),
                },
                match_lineup_id: {
                  _eq: $("match_lineup_id", "uuid"),
                },
              },
            },
            {
              __typename: true,
            },
          ],
        }),
        variables: {
          steam_id: this.member.steam_id,
          match_lineup_id: this.lineup.id,
        },
      });
    },
  },
  computed: {
    canDoActions() {
      return (
        this.lineup.can_update_lineup ||
        this.canLeaveLineup ||
        this.canSwitchTeams
      );
    },
    canLeaveLineup() {
      return (
        this.match.status === e_match_status_enum.PickingPlayers &&
        this.member.steam_id === this.me.steam_id
      );
    },
    canSwitchTeams() {
      const currentPlayerCount =
        this.lineup.id === this.match.lineup_1_id
          ? this.match.lineup_2.lineup_players.length
          : this.match.lineup_1.lineup_players.length;

      if (currentPlayerCount >= this.match.max_players_per_lineup) {
        return false;
      }

      return (
        this.lineup.can_update_lineup ||
        (this.match.status === e_match_status_enum.PickingPlayers &&
          this.member.steam_id === this.me.steam_id &&
          this.match.options.lobby_access !== e_lobby_access_enum.Private)
      );
    },
    me() {
      return useAuthStore().me;
    },
    // The Overview tab now reads from player_match_stats_v (all maps) and
    // player_match_map_stats (per map) via array_relationships. Both return
    // a one-row array; we resolve whichever the parent passed us here.
    stats() {
      const arr =
        this.member?.player?.match_map_stats ??
        this.member?.player?.match_stats ??
        null;
      return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
    },
    // True once the lineup-stats subscription has hydrated this player.
    // Used by stat computeds and template cells to fall back to a dash
    // placeholder while the shell-only sub is the source of truth.
    hasStats() {
      return !!this.stats;
    },
    kd() {
      if (!this.hasStats) return "—";
      const kills = this.stats.kills ?? 0;
      const deaths = this.stats.deaths ?? 0;
      if (deaths === 0) return kills;
      return formatStatValue(kills / deaths);
    },
    hs() {
      if (!this.hasStats) return "—";
      const kills = this.stats.kills ?? 0;
      if (kills === 0) return 0;
      const hsKills = this.stats.hs_kills ?? 0;
      return formatStatValue((hsKills / kills) * 100) + "%";
    },
    adr() {
      if (!this.hasStats || this.totalRounds === 0) return 0;
      const damage = this.stats.damage ?? 0;
      return formatStatValue(damage / this.totalRounds);
    },
    twoKills() {
      return this.stats?.two_kill_rounds ?? "—";
    },
    threeKills() {
      return this.stats?.three_kill_rounds ?? "—";
    },
    fourKills() {
      return this.stats?.four_kill_rounds ?? "—";
    },
    fiveKills() {
      return this.stats?.five_kill_rounds ?? "—";
    },
    // For the "M" multi-kills column (xl:table-cell): total rounds where the
    // player had >=2 kills. Sum of the four counter columns.
    totalMultiKills() {
      if (!this.stats) return null;
      return (
        (this.stats.two_kill_rounds ?? 0) +
        (this.stats.three_kill_rounds ?? 0) +
        (this.stats.four_kill_rounds ?? 0) +
        (this.stats.five_kill_rounds ?? 0)
      );
    },
    totalRounds() {
      let rounds = 0;
      for (const match_map of this.match.match_maps) {
        rounds += match_map.lineup_1_score + match_map.lineup_2_score;
      }
      return rounds;
    },
    memberEloChange() {
      const steamId = this.member?.steam_id ?? this.member?.player?.steam_id;
      if (!steamId) {
        return null;
      }
      return (
        this.match.elo_changes?.find?.(
          (ec: any) => String(ec.player_steam_id) === String(steamId),
        ) ?? null
      );
    },
  },
};
</script>
