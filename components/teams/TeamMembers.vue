<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamMember } from "~/components/teams";
import { Separator } from "~/components/ui/separator";
import PlayerSearch from "~/components/PlayerSearch.vue";
</script>

<template>
  <Card v-if="team">
    <CardHeader>
      <CardTitle>Team Members</CardTitle>
    </CardHeader>
    <CardContent class="grid gap-6">
      <div
        class="flex items-center justify-between space-x-4"
        v-for="member of team?.roster"
      >
        <team-member
          :team="team"
          :member="member"
          :roles="roles"
          :is-invite="false"
        ></team-member>
      </div>

      <template v-if="team.can_invite">
        <Separator class="my-3" />

        <player-search
          label="Invite Player to Team ..."
          :exclude="team?.roster.map((member) => member.player.steam_id) || []"
          @selected="addMember"
        ></player-search>

        <template v-if="team?.invites.length > 0">
          <h1>Pending Invites</h1>

          <div
            class="flex items-center justify-between space-x-4"
            v-for="member of team?.invites"
          >
            <team-member :member="member" :is-invite="true"></team-member>
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
                  player: {
                    name: true,
                    country: true,
                    steam_id: true,
                    avatar_url: true,
                  },
                },
              ],
              invites: [
                {},
                {
                  id: true,
                  player: {
                    name: true,
                    country: true,
                    steam_id: true,
                    avatar_url: true,
                  },
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
                  _nin: [e_team_roles_enum.Invite, e_team_roles_enum.Pending],
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
  methods: {
    async addMember(member) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_team_invites_one: [
            {
              object: {
                steam_id: member.steam_id,
                team_id: this.$route.params.id,
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
