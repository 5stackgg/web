<script setup lang="ts">
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TeamMember } from "~/components/teams";
import { Separator } from "~/components/ui/separator";
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Team Members</CardTitle>
      <CardDescription>
        Invite your team members to collaborate.
      </CardDescription>
    </CardHeader>
    <CardContent class="grid gap-6">
      <div
        class="flex items-center justify-between space-x-4"
        v-for="member of team?.roster"
      >
        <team-member
          :member="member"
          :roles="roles"
          :is-invite="false"
        ></team-member>
      </div>

      <template v-if="team?.invites.length > 0">
        <Separator class="my-3" />
        <h1>Pending Invites</h1>

        <div
          class="flex items-center justify-between space-x-4"
          v-for="member of team?.invites"
        >
          <team-member :member="member" :is-invite="true"></team-member>
        </div>
      </template>
    </CardContent>
  </Card>
</template>

<!--<form @submit.prevent>-->
<!--&lt;!&ndash;            <five-stack-search-input&ndash;&gt;-->
<!--&lt;!&ndash;              placeholder="Find Player"&ndash;&gt;-->
<!--&lt;!&ndash;              v-model="form.member"&ndash;&gt;-->
<!--&lt;!&ndash;              :search="searchPlayers"&ndash;&gt;-->
<!--&lt;!&ndash;            ></five-stack-search-input>&ndash;&gt;-->
<!--</form>-->

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, e_team_roles_enum, order_by } from "~/generated/zeus";

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
};
</script>
