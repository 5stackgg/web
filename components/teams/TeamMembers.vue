<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamMember } from "~/components/teams";
import { Separator } from "~/components/ui/separator";
import PlayerSearch from "~/components/PlayerSearch.vue";
</script>

<template>
  <Card v-if="team">
    <CardHeader>
      <CardTitle>{{ $t("team.members.title") }}</CardTitle>
    </CardHeader>
    <CardContent class="grid gap-6">
      <div
        class="flex items-center justify-between space-x-4"
        v-for="member of members"
      >
        <TeamMember
          :key="member.player.steam_id"
          :team="team"
          :member="member"
          :roles="roles"
          :is-invite="false"
        ></TeamMember>
      </div>

      <template v-if="team.can_invite">
        <Separator class="my-3" />

        <PlayerSearch
          :label="$t('team.members.invite_player')"
          :exclude="team?.roster.map((member) => member.player.steam_id) || []"
          @selected="addMember"
        ></PlayerSearch>

        <template v-if="team?.invites.length > 0">
          <h1>{{ $t("team.members.pending_invites") }}</h1>

          <div
            class="flex items-center justify-between space-x-4"
            v-for="member of team?.invites"
          >
            <TeamMember
              :team="team"
              :member="member"
              :is-invite="true"
            ></TeamMember>
          </div>
        </template>
      </template>
    </CardContent>
  </Card>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, e_team_roles_enum, order_by } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { playerFields } from "~/graphql/playerFields";
export default {
  props: {
    teamId: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      team: undefined,
      roles: undefined,
    };
  },
  apollo: {
    $subscribe: {
      teams_by_pk: {
        query: typedGql("subscription")({
          teams_by_pk: [
            {
              id: $("teamId", "uuid!"),
            },
            {
              can_invite: true,
              can_remove: true,
              can_change_role: true,
              roster: [
                {
                  order_by: {
                    player: {
                      name: order_by.asc,
                    },
                  },
                },
                {
                  role: true,
                  team_id: true,
                  player: playerFields,
                },
              ],
              invites: [
                {},
                {
                  id: true,
                  player: playerFields,
                },
              ],
            },
          ],
        }),
        variables: function () {
          return {
            teamId: this.teamId,
          };
        },
        result: function ({ data }) {
          this.team = data.teams_by_pk;
        },
      },
      e_team_roles: {
        query: typedGql("subscription")({
          e_team_roles: [
            {
              where: {
                value: {
                  _neq: e_team_roles_enum.Admin,
                },
              },
            },
            {
              value: true,
              description: true,
            },
          ],
        }),
        result: function ({ data }) {
          this.roles = data.e_team_roles;
        },
      },
    },
  },
  computed: {
    members() {
      return (this.team?.roster || []).sort((a, b) => {
        const roleOrder = { Admin: 1, Invite: 2, Member: 3 };
        return (roleOrder[a.role] || 4) - (roleOrder[b.role] || 4);
      });
    },
  },
  methods: {
    async addMember(member) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_team_roster_one: [
            {
              object: {
                team_id: this.$route.params.id,
                player_steam_id: member.steam_id,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
  },
};
</script>
