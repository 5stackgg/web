<script lang="ts" setup>
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import TournamentStageBuilder from "~/components/tournament/TournamentStageBuilder.vue";
import TournamentJoinForm from "~/components/tournament/TournamentJoinForm.vue";
import TournamentTeamTable from "~/components/tournament/TournamentTeam.vue";
import TournamentOrganizers from "~/components/tournament/TournamentOrganizers.vue";
import TournamentServers from "~/components/tournament/TournamentServers.vue";
import TournamentMapPool from "~/components/tournament/TournamentMapPool.vue";
import MapDisplay from "~/components/MapDisplay.vue";
</script>

<template>
  <Tabs default-value="info" v-if="tournament">
    <TabsList>
      <TabsTrigger value="info"> Information </TabsTrigger>
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
      <Badge>{{ tournament.type }}</Badge>
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
        <template v-for="map in tournament.map_pool.maps">
          <MapDisplay :map="map"></MapDisplay>
        </template>
      </div>

      <Drawer :open="tournamentDialog">
        <DrawerTrigger @click="tournamentDialog = true">
          <Button> Join Tournament </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Which Team do you wish to join with?</DrawerTitle>
          </DrawerHeader>
          <DrawerFooter>
            <TournamentJoinForm
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
      <template v-for="team of tournament.teams">
        <NuxtLink :to="`/tournaments/${tournament.id}/teams/${team.id}`">
          {{ team.name }}: {{ team.roster_aggregate.aggregate.count }} players
          registered
        </NuxtLink>
      </template>
    </TabsContent>
    <TabsContent value="roster" v-if="myTeam">
      <TournamentTeamTable :team="myTeam"></TournamentTeamTable>
    </TabsContent>
    <TabsContent value="manage">
      <Tabs default-value="organizers">
        <TabsList>
          <TabsTrigger value="organizers"> Organizers </TabsTrigger>
          <TabsTrigger value="map_pool"> Map Pool </TabsTrigger>
          <TabsTrigger value="servers"> Servers </TabsTrigger>
        </TabsList>
        <TabsContent value="organizers">
          <TournamentOrganizers :tournament="tournament">
          </TournamentOrganizers>
        </TabsContent>
        <TabsContent value="map_pool">
          <TournamentMapPool :tournament="tournament"></TournamentMapPool>
        </TabsContent>
        <TabsContent value="servers">
          <TournamentServers :tournament="tournament"></TournamentServers>
        </TabsContent>
      </Tabs>
    </TabsContent>
  </Tabs>
</template>

<script lang="ts">
import { $, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { useAuthStore } from "~/stores/AuthStore";
import tournamentTeamFields from "~/graphql/tournamentTeamFields";
import {mapFields} from "~/graphql/mapGraphql";

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
              status: true,
              type: true,
              start: true,
              description: true,
              admin: {
                name: true,
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
              teams: [{}, tournamentTeamFields],
              teams_aggregate: [
                {},
                {
                  aggregate: {
                    count: true,
                  },
                },
              ],
              map_pool: [
                {},
                {
                  id: true,
                  type: true,
                  maps: [
                    {
                      order_by: {
                        name: order_by.asc,
                      },
                    },
                    mapFields
                  ]
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
  },
};
</script>

<style>
/*
  Outgoing connector
 */

.with-connector:after {
  content: " ";
  position: absolute;
  left: calc(100% + 0.5rem); /* participant size (includes margin) */
  width: 1.25rem; /* round margin-right */
  border: 2px solid #e2e8f0;
  border-left: none;
}

.with-connector:nth-child(odd):after {
  top: 50%;
  border-bottom: none;
}

.with-connector:nth-child(even):after {
  bottom: 50%;
  border-top: none;
}

/*
  height formula for a given round connector:
  connectorHeight(roundNumber) = (margin + (lineHeight + padding)/2) * r^(n-1)

  where:
  - margin = 8px (.m-2)
  - line-height = 24px (.leading-relaxed)
  - padding = 4px (.p-1)
*/
.round:nth-child(1) .with-connector:after {
  height: 25px;
}

.round:nth-child(2) .with-connector:after {
  height: 60px;
}

.round:nth-child(3) .with-connector:after {
  height: 100px;
}

.round:nth-child(4) .with-connector:after {
  height: 200px;
}

.round.round-winner .with-connector:after {
  width: 0;
}

.round + .round .with-connector:before {
  content: " ";
  position: absolute;
  left: -1.75rem; /* competitor margin + current width */
  top: 50%;
  width: 1.25rem; /* round margin-left */
  border-top: 2px solid #e2e8f0;
}
</style>
