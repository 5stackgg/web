<template>
  <div class="flex" v-if="tournament">
    <template v-for="round of Array.from(rounds.keys())">
      <TournamentRound :matches="rounds.get(round)"></TournamentRound>
    </template>
  </div>
</template>

<script lang="ts">
import { $, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import TournamentRound from "~/components/tournament/TournamentRound.vue";

/**
 * https://codepen.io/eth0lo/pen/dyyrGww
 */
export default {
  components: { TournamentRound },
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
              stages: [
                {},
                {
                  id: true,
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
  computed: {
    stage() {
      return this.tournament?.stages[0];
    },
    rounds() {
      const rounds = new Map();
      for (const bracket of this.stage?.brackets) {
        let matches = rounds.get(bracket.round) || [];

        matches.push(bracket);

        rounds.set(bracket.round, matches);
      }

      return rounds;
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
