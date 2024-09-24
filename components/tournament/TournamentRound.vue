<script lang="ts" setup>
import TournamentRoundLineup from "~/components/tournament/TournamentRoundLineup.vue";
</script>

<template>
  <div class="flex flex-col justify-around mx-5 round">
    <template v-for="bracket in brackets">
      <div class="items-center m-2 relative leading-relaxed with-connector">
        <div class="bg-gray-600 text-gray-300 rounded p-1">
          <TournamentRoundLineup
            :bracket="bracket"
            :match="bracket.match"
            :lineup="bracket.match.lineup_1"
            v-if="bracket.match"
          ></TournamentRoundLineup>
          <template v-else> Team 1 </template>
        </div>
      </div>
      <div
        class="items-center m-2 relative leading-relaxed with-connector"
        :class="{
          ['with-bye']: round === 1 && bracket.team_1 && !bracket.team_2,
        }"
      >
        <div class="bg-gray-600 text-gray-300 rounded p-1">
          <TournamentRoundLineup
            :bracket="bracket"
            :match="bracket.match"
            :lineup="bracket.match.lineup_2"
            v-if="bracket.match"
          ></TournamentRoundLineup>
          <template v-else> Team 2 </template>
        </div>
      </div>

      <!-- TODO - round and match # -->
      <!-- <div class="absoulte">
        <Badge>Round {{ round }} - Match {{ bracket.match_number }}</Badge>
      </div> -->
    </template>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    round: {
      type: Number,
      required: true,
    },
    brackets: {
      type: Array,
      required: true,
    },
  },
};
</script>

<style lang="scss">
/*
  Outgoing connector
 */

.with-connector:after {
  content: " ";
  position: absolute;
  left: calc(100% + 0.5rem);
  width: 1.25rem;
  border: 2px solid #e2e8f0;
  border-left: none;
}

/** Top Line **/
.with-connector:nth-child(odd):after {
  top: 50%;
  border-bottom: none;
}

/** Bottom Line **/
.with-connector:nth-child(even):after {
  bottom: 50%;
  border-top: none;
}

/** Middle Line **/
.round + .round .with-connector:before {
  content: " ";
  position: absolute;
  left: -1.75rem; /* competitor margin + current width */
  top: 50%;
  width: 1.25rem; /* round margin-left */
  border-top: 2px solid #e2e8f0;
}

/*
  height formula for a given round connector:
  connectorHeight = (margin + (lineHeight + padding) / 2) * roundNumber^(n - 1)
*/

// TODO - look up the max rounds we support
@for $n from 1 through 20 {
  .round:nth-child(#{$n}) .with-connector:after {
    height: calc((12px + (24px + 4px) / 2) * #{pow(2, $n - 1)});
  }
}

.with-bye + .with-connector {
  visibility: hidden;
}
</style>
