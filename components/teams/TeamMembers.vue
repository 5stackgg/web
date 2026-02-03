<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamMember } from "~/components/teams";
import { Separator } from "~/components/ui/separator";
import PlayerSearch from "~/components/PlayerSearch.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
</script>

<template>
  <Card v-if="team">
    <CardHeader>
      <CardTitle>{{ $t("team.members.title") }}</CardTitle>
    </CardHeader>
    <CardContent class="grid gap-3">
      <div
        class="grid grid-cols-12 items-center gap-4 px-3 text-xs uppercase tracking-wide text-muted-foreground"
      >
        <div :class="team?.can_change_role ? 'col-span-5' : 'col-span-12'">
          {{ $t("team.members.player") }}
        </div>
        <div v-if="team?.can_change_role" class="col-span-2">
          {{ $t("team.members.role") }}
        </div>
        <div v-if="team?.can_change_role" class="col-span-2">
          {{ $t("team.member.coach") }}
        </div>
        <div v-if="team?.can_change_role" class="col-span-3">
          {{ $t("team.member.status") }}
        </div>
      </div>

      <div class="h-px bg-border" />

      <div
        class="grid grid-cols-12 items-center gap-4 rounded-lg px-3 py-2 hover:bg-muted/40"
        v-for="member of membersMain"
      >
        <TeamMember
          :key="member.player.steam_id"
          :team="team"
          :member="member"
          :roles="roles"
          :is-invite="false"
        ></TeamMember>
      </div>

      <template v-if="substitutes.length">
        <Separator class="my-3" />
        <div class="px-3 text-sm font-medium">
          {{ $t("team.members.substitutes") }}
        </div>
        <div
          class="grid grid-cols-12 items-center gap-4 rounded-lg px-3 py-2 hover:bg-muted/40"
          v-for="member of substitutes"
        >
          <TeamMember
            :key="member.player.steam_id"
            :team="team"
            :member="member"
            :roles="roles"
            :is-invite="false"
          ></TeamMember>
        </div>
      </template>

      <template v-if="team.can_invite">
        <Separator class="my-3" />

        <PlayerSearch
          :label="$t('team.members.invite_player')"
          :exclude="team?.roster.map((member) => member.player.steam_id) || []"
          @selected="addMember"
        ></PlayerSearch>

        <template v-if="team_invites?.length > 0">
          <h1 class="text-base font-medium">
            {{ $t("team.members.pending_invites") }}
          </h1>

          <div
            class="grid grid-cols-12 items-center gap-4 px-3 text-xs uppercase tracking-wide text-muted-foreground mt-2"
          >
            <div class="col-span-7">{{ $t("team.members.player") }}</div>
            <div class="col-span-5">{{ $t("common.actions_label") }}</div>
          </div>
          <div class="h-px bg-border" />

          <div
            class="grid grid-cols-12 items-center gap-4 rounded-lg px-3 py-2 hover:bg-muted/40"
            v-for="member of team_invites"
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
  <Card v-if="team && coaches.length" class="mt-6">
    <CardHeader>
      <CardTitle>{{ $t("team.members.coaches") }}</CardTitle>
    </CardHeader>
    <CardContent class="grid gap-3">
      <div
        class="grid grid-cols-12 items-center gap-4 px-3 text-xs uppercase tracking-wide text-muted-foreground"
      >
        <div class="col-span-7">{{ $t("team.members.player") }}</div>
      </div>
      <div class="h-px bg-border" />
      <div
        class="grid grid-cols-12 items-center gap-4 rounded-lg px-3 py-2"
        v-for="coach of coaches"
        :key="coach.player.steam_id"
      >
        <div class="col-span-7 min-w-0">
          <PlayerDisplay :player="coach.player" :linkable="true" />
        </div>
      </div>
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
      team_invites: [],
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
                  coach: true,
                  status: true,
                  team_id: true,
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
      team_invites: {
        query: typedGql("subscription")({
          team_invites: [
            {
              where: {
                team_id: {
                  _eq: $("teamId", "uuid!"),
                },
              },
            },
            {
              id: true,
              player: playerFields,
            },
          ],
        }),
        variables: function () {
          return {
            teamId: this.teamId,
          };
        },
        skip: function () {
          return !useAuthStore().me;
        },
        result: function ({ data }) {
          this.team_invites = data.team_invites;
        },
      },
    },
    e_team_roles: {
      query: typedGql("query")({
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
  computed: {
    members() {
      return (this.team?.roster || []).sort((a, b) => {
        const roleOrder = { Admin: 1, Invite: 2, Member: 3 } as Record<
          string,
          number
        >;
        return (roleOrder[a.role] || 4) - (roleOrder[b.role] || 4);
      });
    },
    membersMain() {
      const starters = (this.members || []).filter(
        (m: any) => m.status === "Starter",
      );
      const benched = (this.members || []).filter(
        (m: any) => m.status === "Benched",
      );
      // Coaches should also show up here regardless of coach flag as long as they are Starter or Benched
      return [...starters, ...benched];
    },
    substitutes() {
      return (this.members || []).filter((m: any) => m.status === "Substitute");
    },
    coaches() {
      return (this.members || []).filter((m: any) => m.coach);
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
