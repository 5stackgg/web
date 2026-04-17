<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamMember } from "~/components/teams";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  UserPlus,
  Users,
  UserMinus,
  Users2,
  GraduationCap,
} from "lucide-vue-next";
import PlayerSearch from "~/components/PlayerSearch.vue";
</script>

<template>
  <Card v-if="team" class="overflow-hidden">
    <CardHeader class="flex flex-row items-center justify-between gap-2 pb-3">
      <div class="space-y-1">
        <CardTitle>{{ $t("team.members.title") }}</CardTitle>
        <p class="text-xs text-muted-foreground">
          {{
            starters.length + bench.length + substitutes.length + coaches.length
          }}
          {{ $t("team.roster_count_players") }}
        </p>
      </div>
      <PlayerSearch
        v-if="team.can_invite"
        :label="$t('team.members.invite_player')"
        :exclude="team?.roster.map((m) => m.player.steam_id) || []"
        @selected="onInvite"
      >
        <Button size="sm" variant="outline" class="gap-2">
          <UserPlus class="h-4 w-4" />
          {{ $t("team.members.invite_player") }}
        </Button>
      </PlayerSearch>
    </CardHeader>

    <CardContent class="space-y-5">
      <section v-if="team.can_invite && team_invites?.length" class="space-y-1">
        <div class="flex items-center gap-2 px-1">
          <UserPlus class="h-3.5 w-3.5 text-muted-foreground" />
          <h3 class="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            {{ $t("team.members.pending_invites") }}
          </h3>
          <Badge variant="secondary">{{ team_invites.length }}</Badge>
          <div class="h-px flex-1 bg-border/60" />
        </div>
        <div class="space-y-1">
          <TeamMember
            v-for="member of team_invites"
            :key="member.id"
            :team="team"
            :member="member"
            :is-invite="true"
          />
        </div>
      </section>

      <section v-if="starters.length" class="space-y-1">
        <div class="flex items-center gap-2 px-1">
          <Users class="h-3.5 w-3.5 text-muted-foreground" />
          <h3 class="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            {{ $t("team.members.starters") }}
          </h3>
          <span
            class="rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold text-muted-foreground"
          >
            {{ starters.length }}
          </span>
          <div class="h-px flex-1 bg-border/60" />
        </div>
        <div class="space-y-1">
          <TeamMember
            v-for="member of starters"
            :key="member.player.steam_id"
            :team="team"
            :member="member"
            :roles="roles"
            :is-invite="false"
          />
        </div>
      </section>

      <section v-if="bench.length" class="space-y-1">
        <div class="flex items-center gap-2 px-1">
          <UserMinus class="h-3.5 w-3.5 text-amber-500/80" />
          <h3 class="text-xs uppercase tracking-[0.14em] text-amber-500/80">
            {{ $t("team.members.bench") }}
          </h3>
          <span
            class="rounded-full bg-amber-500/10 px-1.5 py-px text-[10px] font-semibold text-amber-500/80"
          >
            {{ bench.length }}
          </span>
          <div class="h-px flex-1 bg-amber-500/20" />
        </div>
        <div class="space-y-1">
          <TeamMember
            v-for="member of bench"
            :key="member.player.steam_id"
            :team="team"
            :member="member"
            :roles="roles"
            :is-invite="false"
          />
        </div>
      </section>

      <section v-if="substitutes.length" class="space-y-1">
        <div class="flex items-center gap-2 px-1">
          <Users2 class="h-3.5 w-3.5 text-muted-foreground" />
          <h3 class="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            {{ $t("team.members.substitutes") }}
          </h3>
          <span
            class="rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold text-muted-foreground"
          >
            {{ substitutes.length }}
          </span>
          <div class="h-px flex-1 bg-border/60" />
        </div>
        <div class="space-y-1">
          <TeamMember
            v-for="member of substitutes"
            :key="member.player.steam_id"
            :team="team"
            :member="member"
            :roles="roles"
            :is-invite="false"
          />
        </div>
      </section>

      <section v-if="coaches.length" class="space-y-1">
        <div class="flex items-center gap-2 px-1">
          <GraduationCap class="h-3.5 w-3.5 text-muted-foreground" />
          <h3 class="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            {{ $t("common.coaches") }}
          </h3>
          <span
            class="rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold text-muted-foreground"
          >
            {{ coaches.length }}
          </span>
          <div class="h-px flex-1 bg-border/60" />
        </div>
        <div class="space-y-1">
          <TeamMember
            v-for="member of coaches"
            :key="member.player.steam_id"
            :team="team"
            :member="member"
            :roles="roles"
            :is-invite="false"
          />
        </div>
      </section>

      <p
        v-if="
          !starters.length &&
          !bench.length &&
          !substitutes.length &&
          !coaches.length
        "
        class="py-6 text-center text-sm text-muted-foreground"
      >
        {{ $t("team.members.title") }} — 0
      </p>
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
    sortedRoster(): any[] {
      return (this.team?.roster || []).slice().sort((a: any, b: any) => {
        const roleOrder = { Admin: 1, Invite: 2, Member: 3 } as Record<
          string,
          number
        >;
        return (roleOrder[a.role] || 4) - (roleOrder[b.role] || 4);
      });
    },
    starters(): any[] {
      return this.sortedRoster.filter(
        (m: any) => !m.coach && m.status === "Starter",
      );
    },
    bench(): any[] {
      return this.sortedRoster.filter(
        (m: any) => !m.coach && m.status === "Benched",
      );
    },
    substitutes(): any[] {
      return this.sortedRoster.filter(
        (m: any) => !m.coach && m.status === "Substitute",
      );
    },
    coaches(): any[] {
      return this.sortedRoster.filter((m: any) => m.coach);
    },
  },
  methods: {
    async onInvite(member: any) {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          insert_team_roster_one: [
            {
              object: {
                team_id: (this as any).$route.params.id,
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
