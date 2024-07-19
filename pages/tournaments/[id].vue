<template>
  <Tabs default-value="info" v-if="tournament">
    <TabsList>
      <TabsTrigger value="info"> Information </TabsTrigger>
      <TabsTrigger value="bracket"> Bracket </TabsTrigger>
      <TabsTrigger value="teams"> Teams ({{ tournament.teams_aggregate.aggregate.count }}) </TabsTrigger>
      <TabsTrigger value="roster"> Manage My Roster </TabsTrigger>
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
      <p v-for="{ organizer, role } of tournament.organizers">
        {{ organizer.name }} ({{ role }})
      </p>
    </TabsContent>
    <TabsContent value="bracket">
      <TournamentStageBuilder :tournament="tournament"></TournamentStageBuilder>
    </TabsContent>
    <TabsContent value="manage">
      <Tabs default-value="organizers">
        <TabsList>
          <TabsTrigger value="organizers"> Organizers </TabsTrigger>
          <TabsTrigger value="servers"> Servers </TabsTrigger>
        </TabsList>
        <TabsContent value="organizers">organizers</TabsContent>
        <TabsContent value="servers">servers</TabsContent>
      </Tabs>
    </TabsContent>
  </Tabs>
</template>

<script lang="ts">
import { $, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import TournamentRound from "~/components/tournament/TournamentRound.vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import TournamentStage from "~/components/tournament/TournamentStage.vue";
import TournamentStageBuilder from "~/components/tournament/TournamentStageBuilder.vue";

/**
 * https://codepen.io/eth0lo/pen/dyyrGww
 */
export default {
  components: {
    TournamentStageBuilder,
    TournamentStage,
    TabsList,
    Tabs,
    TabsContent,
    TabsTrigger,
    TournamentRound,
  },
  data() {
    return {
      tournament: undefined,
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
                  role: true,
                  organizer: {
                    name: true,
                  },
                },
              ],
              teams_aggregate: [
                {},
                {
                  aggregate: {
                    count: true,
                  },
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
            tournamentId: this.$route.params.id,
          };
        },
        result: function ({ data }) {
          this.tournament = data.tournaments_by_pk;
        },
      },
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
