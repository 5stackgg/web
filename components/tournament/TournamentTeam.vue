<script setup lang="ts">
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import TournamentTeamMemberRow from "~/components/tournament/TournamentTeamMemberRow.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";
import PlayerDisplay from "../PlayerDisplay.vue";
import TournamentTeamInvite from "./TournamentTeamInvite.vue";
import Badge from "../ui/badge/Badge.vue";
</script>

<template>
  <div v-if="team && e_team_roles" class="grid gap-4">
    <div
      class="flex flex-col md:flex-row justify-between items-center mb-4 p-4 shadow rounded-lg"
    >
      <div>
        <h2 class="text-2xl font-bold mb-2">
          {{ $t("tournament.team.manage_roster") }}
          <small>
            ({{ team.roster.length }} / {{ tournament.max_players_per_lineup }})
          </small>
        </h2>
        <template v-if="team.eligible_at">
          <Badge>{{ $t("tournament.team.eligible") }}</Badge>
        </template>
        <template v-else>
          <div class="text-sm text-red-600">
            {{
              $t("tournament.team.not_eligible", {
                count: tournament.min_players_per_lineup - team.roster.length,
              })
            }}
          </div>
        </template>
      </div>
      <div class="flex gap-4">
        <Button
          @click="leaveTournament"
          variant="destructive"
          class="mt-4 md:mt-0"
          v-if="canLeaveTournament"
        >
          {{ $t("tournament.team.leave_tournament") }}
        </Button>
        <Button @click="leaveTeam" variant="destructive" class="mt-4 md:mt-0">
          {{ $t("tournament.team.leave_team") }}
        </Button>
      </div>
    </div>

    <div v-if="team.roster">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{{ $t("tournament.team.player") }}</TableHead>
            <TableHead>{{ $t("tournament.team.role") }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TournamentTeamMemberRow
            v-for="member in team.roster"
            :key="member.id"
            :member="member"
            :team="team"
            :roles="e_team_roles"
          />
          <TableRow
            v-for="slot of Math.max(
              0,
              tournament.max_players_per_lineup - team.roster.length,
            )"
          >
            <TableCell colspan="100%">
              <div class="flex space-x-3">
                <PlayerDisplay
                  :show-flag="false"
                  :show-steam-id="false"
                  :player="{
                    name: $t('tournament.team.slot', {
                      number: slot + team.roster.length,
                    }),
                  }"
                />
                <template v-if="slot === 1 && team.can_manage">
                  <player-search
                    :label="$t('tournament.team.add_player')"
                    :exclude="
                      team.roster?.map((member) => member.player.steam_id) || []
                    "
                    :team-id="team.team_id"
                    @selected="addMember"
                  />
                </template>
              </div>
            </TableCell>
          </TableRow>

          <TableRow v-if="team.invites && team.invites.length > 0">
            <TableCell colspan="100%">
              <div class="text-sm font-semibold text-gray-500 my-2">
                {{ $t("tournament.team.pending_invites") }}
              </div>
            </TableCell>
          </TableRow>
          <TournamentTeamInvite
            :invite="invite"
            v-for="invite in team.invites"
            :key="invite.id"
          ></TournamentTeamInvite>
        </TableBody>
      </Table>
    </div>
  </div>
</template>

<script lang="ts">
import { e_team_roles_enum } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  props: {
    team: {
      type: Object,
      required: true,
    },
    tournament: {
      type: Object,
      required: true,
    },
  },
  apollo: {
    e_team_roles: {
      query: typedGql("query")({
        e_team_roles: [
          {
            where: {
              value: {
                _nin: [e_team_roles_enum.Invite],
              },
            },
          },
          {
            value: true,
            description: true,
          },
        ],
      }),
    },
  },
  computed: {
    canLeaveTournament() {
      return this.team.can_manage;
    },
  },
  methods: {
    async cancelInvite() {},
    async leaveTournament() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_tournament_teams_by_pk: [
            {
              id: this.team.id,
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    async leaveTeam() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_tournament_team_roster: [
            {
              where: {
                player_steam_id: {
                  _eq: useAuthStore().me.steam_id,
                },
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    async addMember(member) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_tournament_team_roster_one: [
            {
              object: {
                player_steam_id: member.steam_id,
                tournament_team_id: this.team.id,
                tournament_id:
                  this.$route.params.tournamentId || this.$route.params.id,
              },
            },
            {
              player_steam_id: true,
            },
          ],
        }),
      });
    },
  },
};
</script>
