<script lang="ts" setup>
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import TournamentStageBuilder from "~/components/tournament/TournamentStageBuilder.vue";
import TournamentJoinForm from "~/components/tournament/TournamentJoinForm.vue";
import TournamentTeamTable from "~/components/tournament/TournamentTeam.vue";
import TournamentOrganizers from "~/components/tournament/TournamentOrganizers.vue";
import TournamentServers from "~/components/tournament/TournamentServers.vue";
import MapDisplay from "~/components/MapDisplay.vue";
import TournamentForm from "~/components/tournament/TournamentForm.vue";
import TournamentAddTeam from "~/components/tournament/TournamentAddTeam.vue";
</script>

<template>
  <Tabs default-value="info" v-if="tournament">
    <TabsList>
      <TabsTrigger value="info"> <Badge>{{ tournament.status }}</Badge> Information </TabsTrigger>
      <TabsTrigger value="bracket"> Bracket </TabsTrigger>
      <TabsTrigger value="teams">
        Teams ({{ tournament.teams_aggregate.aggregate.count }})
      </TabsTrigger>
      <TabsTrigger value="roster" v-if="myTeam"> My Roster </TabsTrigger>
      <TabsTrigger value="manage"> Manage Tournament </TabsTrigger>
    </TabsList>
    <TabsContent value="info">
      {{ tournament.name }} : {{ tournament.description }}
      <Badge>{{ tournament.status }}</Badge>
      <Badge>{{ tournament.options.type }}</Badge>
      <Badge>{{ tournament.start }}</Badge>

      <p>
        Admin:
        {{ tournament.admin.name }}
      </p>

      <p>Organizers</p>
      <p v-for="{ organizer } of tournament.organizers">
        {{ organizer.name }}
      </p>

      <h1>Maps</h1>
      <div class="flex">
        <template v-for="map in tournament.options.map_pool.maps">
          <MapDisplay :map="map"></MapDisplay>
        </template>
      </div>

      <Drawer :open="tournamentDialog" v-if="tournament.can_join_tournament">
        <DrawerTrigger @click="tournamentDialog = true">
          <Button> Join Tournament </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Which Team do you wish to join with?</DrawerTitle>
          </DrawerHeader>
          <DrawerFooter>
            <TournamentJoinForm
              :tournament-type="tournament.options.type"
              @close="tournamentDialog = false"
            ></TournamentJoinForm>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </TabsContent>
    <TabsContent value="bracket">
      <TournamentStageBuilder :tournament="tournament"></TournamentStageBuilder>
    </TabsContent>
    <TabsContent value="teams">
      <TournamentAddTeam :tournament="tournament" v-if="canAddTeams"></TournamentAddTeam>

      <div v-for="team of tournament.teams">
        <NuxtLink :to="`/tournaments/${tournament.id}/teams/${team.id}`">
          {{ team.name }}: {{ team.roster_aggregate.aggregate.count }} players
          registered ({{ team.eligible_at }})
        </NuxtLink>

        <Button @click="removeTeam(team.id)">Remove Team</Button>
      </div>
    </TabsContent>
    <TabsContent value="roster" v-if="myTeam">
      <TournamentTeamTable :team="myTeam"></TournamentTeamTable>
    </TabsContent>
    <TabsContent value="manage">
      <Tabs default-value="match-options">
        <TabsList>
          <TabsTrigger value="match-options"> Match Options </TabsTrigger>
          <TabsTrigger value="organizers"> Organizers </TabsTrigger>
          <TabsTrigger value="servers"> Servers </TabsTrigger>
        </TabsList>
        <TabsContent value="match-options">
          <TournamentForm :tournament="tournament"></TournamentForm>
        </TabsContent>
        <TabsContent value="organizers">
          <TournamentOrganizers :tournament="tournament">
          </TournamentOrganizers>
        </TabsContent>
        <TabsContent value="servers">
          <TournamentServers :tournament="tournament"></TournamentServers>
        </TabsContent>
      </Tabs>
    </TabsContent>
  </Tabs>
</template>

<script lang="ts">
import {$, e_map_pool_types_enum, order_by} from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { useAuthStore } from "~/stores/AuthStore";
import tournamentTeamFields from "~/graphql/tournamentTeamFields";
import { mapFields } from "~/graphql/mapGraphql";
import {generateMutation} from "~/graphql/graphqlGen";

/**
 * https://codepen.io/eth0lo/pen/dyyrGww
 */
export default {
  data() {
    return {
      myTeam: undefined,
      tournament: undefined,
      tournamentDialog: false,
    };
  },
  apollo: {
    $subscribe: {
      tournaments_by_pk: {
        query: typedGql("subscription")({
          tournaments_by_pk: [
            {
              id: $("tournamentId", "uuid!"),
            },
            {
              id: true,
              name: true,
              start: true,
              status: true,
              description: true,
              can_join_tournament: true,
              admin: {
                name: true,
              },
              options: {
                id: true,
                type: true,
                mr: true,
                map_veto: true,
                coaches: true,
                knife_round: true,
                overtime: true,
                best_of: true,
                number_of_substitutes: true,
                map_pool: [
                  {},
                  {
                    id: true,
                    type: true,
                    maps: [{}, mapFields],
                  },
                ],
              },
              organizers: [
                {},
                {
                  organizer: {
                    name: true,
                    steam_id: true,
                    avatar_url: true,
                  },
                },
              ],
              teams: [
                {
                  order_by: [
                    {
                      seed: order_by.asc,
                    },
                    {
                      eligible_at: order_by.asc,
                    },
                  ],
                },
                tournamentTeamFields,
              ],
              teams_aggregate: [
                {},
                {
                  aggregate: {
                    count: true,
                  },
                },
              ],
              servers: [
                {},
                {
                  server_id: true,
                },
              ],
              stages: [
                {
                  order_by: [
                    {
                      order: order_by.asc,
                    },
                  ],
                },
                {
                  id: true,
                  type: true,
                  e_tournament_stage_type: {
                    description: true,
                  },
                  order: true,
                  min_teams: true,
                  max_teams: true,
                  brackets: [
                    {
                      order_by: [
                        {
                          round: order_by.asc,
                        },
                        {
                          match_number: order_by.asc,
                        },
                      ],
                    },
                    {
                      id: true,
                      round: true,
                      match_number: true,
                      created_at: true,
                    },
                  ],
                },
              ],
            },
          ],
        }),
        variables: function () {
          return {
            tournamentId: this.$route.params.tournamentId,
          };
        },
        result: function ({ data }) {
          this.tournament = data.tournaments_by_pk;
        },
      },
      tournament_teams: {
        query: typedGql("subscription")({
          tournament_teams: [
            {
              where: {
                tournament_id: {
                  _eq: $("tournamentId", "uuid!"),
                },
                _or: [
                  {
                    owner_steam_id: {
                      _eq: $("steam_id", "bigint!"),
                    },
                  },
                  {
                    roster: {
                      player_steam_id: {
                        _eq: $("steam_id", "bigint!"),
                      },
                    },
                  },
                ],
              },
            },
            tournamentTeamFields,
          ],
        }),
        variables: function () {
          return {
            steam_id: this.me.steam_id,
            tournamentId: this.$route.params.tournamentId,
          };
        },
        result: function ({ data }) {
          this.myTeam = data.tournament_teams?.[0];
        },
      },
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    canAddTeams() {
      return this.tournament.orgnaier_steam_id === this.me.id || this.tournament.organizers.find(({ steam_id }) => {
        return steam_id === this.me.id;
      });
    }
  },
  methods: {
    async removeTeam(teamId) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_tournament_teams_by_pk: [
            {
              id: teamId,
            },
            {
              id: true,
            },
          ],
        }),
      });
    }
  }
};
</script>
