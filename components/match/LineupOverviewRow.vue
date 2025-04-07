<script lang="ts" setup>
import formatStatValue from "~/utilities/formatStatValue";
</script>
<template>
  <TableRow>
    <TableCell>
      <LineupMember :match="match" :member="member"></LineupMember>
    </TableCell>
    <template v-if="showStats">
      <TableCell class="text-center">
        {{ member.player?.kills_aggregate.aggregate.count }}
      </TableCell>
      <TableCell class="hidden md:table-cell text-center">
        {{ member.player?.assists_aggregate.aggregate.count }}
      </TableCell>
      <TableCell class="text-center">
        {{ member.player?.deaths_aggregate.aggregate.count }}
      </TableCell>
      <TableCell class="hidden md:table-cell text-center">
        <span
          :class="{
            'text-red-500': kd < 0.9,
            'text-orange-500': kd >= 0.9 && kd < 1,
            'text-green-400': kd >= 1 && kd < 1.1,
            'text-green-600': kd >= 1.1,
          }"
        >
          {{ kd }}
        </span>
      </TableCell>
      <TableCell class="hidden lg:table-cell text-center">
        {{ hs }}
      </TableCell>
      <TableCell class="hidden 2xl:table-cell text-center">
        {{ member.player?.team_damage_aggregate.aggregate.sum.damage || 0 }}
      </TableCell>
      <TableCell class="hidden xl:table-cell text-center">
        {{ member.player?.multi_kills.length }}
      </TableCell>
      <TableCell class="hidden 2xl:table-cell text-center">
        {{ twoKills }}
      </TableCell>
      <TableCell class="hidden 2xl:table-cell text-center">
        {{ threeKills }}
      </TableCell>
      <TableCell class="hidden 2xl:table-cell text-center">
        {{ fourKills }}
      </TableCell>
      <TableCell class="hidden 2xl:table-cell text-center">
        {{ fiveKills }}
      </TableCell>
      <TableCell class="hidden 2xl:table-cell text-center">
        {{ member.player?.knife_kills_aggregate.aggregate.count }}
      </TableCell>
      <TableCell class="hidden 2xl:table-cell text-center">
        {{ member.player?.zeus_kills_aggregate.aggregate.count }}
      </TableCell>
      <TableCell class="hidden table-cell text-center">
        <div class="flex flex-col flex-auto items-center">
          <div>
            {{
              member.player?.damage_dealt_aggregate.aggregate.sum.damage || 0
            }}
          </div>
          <div>
            <Badge class="text-xs my-3" variant="outline">
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
        </div>
      </TableCell>
    </template>
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
    kd() {
      if (this.member.player?.deaths_aggregate.aggregate.count === 0) {
        return this.member.player?.kills_aggregate.aggregate.count;
      }
      return formatStatValue(
        this.member.player?.kills_aggregate.aggregate.count /
          this.member.player?.deaths_aggregate.aggregate.count,
      );
    },
    hs() {
      if (this.member.player?.kills_aggregate.aggregate.count === 0) {
        return 0;
      }
      return (
        formatStatValue(
          (this.member.player?.hs_kills_aggregate.aggregate.count /
            this.member.player?.kills_aggregate.aggregate.count) *
            100,
        ) + "%"
      );
    },
    adr() {
      if (
        !this.member?.player?.damage_dealt_aggregate ||
        this.totalRounds === 0
      ) {
        return 0;
      }

      return formatStatValue(
        this.member.player.damage_dealt_aggregate.aggregate.sum.damage /
          this.totalRounds,
      );
    },
    twoKills() {
      return this.member.player?.multi_kills.filter(({ kills }) => {
        return kills == 2;
      }).length;
    },
    threeKills() {
      return this.member.player?.multi_kills.filter(({ kills }) => {
        return kills == 3;
      }).length;
    },
    fourKills() {
      return this.member.player?.multi_kills.filter(({ kills }) => {
        return kills == 4;
      }).length;
    },
    fiveKills() {
      return this.member.player?.multi_kills.filter(({ kills }) => {
        return kills == 5;
      }).length;
    },
    totalRounds() {
      let rounds = 0;
      for (const match_map of this.match.match_maps) {
        rounds += match_map.lineup_1_score + match_map.lineup_2_score;
      }
      return rounds;
    },
  },
};
</script>
