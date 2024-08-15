<script lang="ts" setup>
import formatStatValue from "~/utilities/formatStatValue";
</script>
<template>
  <TableRow>
    <TableCell>
      <LineupMember :member="member"></LineupMember>
    </TableCell>
    <TableCell class="hidden sm:table-cell">
      {{ member.player?.kills_aggregate.aggregate.count }}
    </TableCell>
    <TableCell class="hidden sm:table-cell">
      {{ member.player?.assists_aggregate.aggregate.count }}
    </TableCell>
    <TableCell class="hidden md:table-cell">
      {{ member.player?.deaths_aggregate.aggregate.count }}
    </TableCell>
    <TableCell>
      {{ kd }}
    </TableCell>
    <TableCell>
      {{ hs }}
    </TableCell>
    <TableCell>
      {{ member.player?.damage_dealt_aggregate.aggregate.sum.damage || 0 }}
      <Badge class="text-xs" variant="outline">
        {{
          formatStatValue(
            member.player?.damage_dealt_aggregate.aggregate.sum.damage /
              totalRounds,
          )
        }}
        ADR
      </Badge>
    </TableCell>
    <TableCell>
      {{ member.player?.team_damage_aggregate.aggregate.sum.damage || 0 }}
    </TableCell>
    <TableCell>
      {{ twoKills }}
    </TableCell>
    <TableCell>
      {{ threeKills }}
    </TableCell>
    <TableCell>
      {{ fourKills }}
    </TableCell>
    <TableCell>
      {{ fiveKills }}
    </TableCell>
    <TableCell>
      {{ member.player?.knife_kills_aggregate.aggregate.count }}
    </TableCell>
    <TableCell>
      {{ member.player?.zeus_kills_aggregate.aggregate.count }}
    </TableCell>
    <TableCell v-if="lineup.can_update_lineup">
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline" size="icon">
            <PaginationEllipsis></PaginationEllipsis>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-56">
          <DropdownMenuItem @click="makeCaptain" :disabled="member.captain">
            <span>Promote to Captain</span>
          </DropdownMenuItem>
          <DropdownMenuItem @click="removeFromLineup">
            <span>Remove from Lineup</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TableCell>
  </TableRow>
</template>

<script lang="ts">
import LineupMember from "~/components/match/LineupMember.vue";
import { generateMutation } from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";

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
  },
  methods: {
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
          this.member.player?.hs_kills_aggregate.aggregate.count /
            this.member.player?.kills_aggregate.aggregate.count,
        ) *
          100 +
        "%"
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
