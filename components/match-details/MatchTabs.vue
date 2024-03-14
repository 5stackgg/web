<template>
  <tabs>
    <tab title="Overview">
      <lineup-overview
        :match="match"
        :lineup="matchLineups.lineup1"
      ></lineup-overview>
      <br />
      <lineup-overview
        :match="match"
        :lineup="matchLineups.lineup2"
      ></lineup-overview>
    </tab>
    <tab title="Utility">
      <lineup-utility
        :match="match"
        :lineup="matchLineups.lineup1"
      ></lineup-utility>
      <br />
      <lineup-utility
        :match="match"
        :lineup="matchLineups.lineup2"
      ></lineup-utility>
    </tab>
    <tab title="Opening Duels">
      <lineup-opening-duels
        :match="match"
        :lineup="matchLineups.lineup1"
      ></lineup-opening-duels>
      <br />
      <lineup-opening-duels
        :match="match"
        :lineup="matchLineups.lineup2"
      ></lineup-opening-duels>
    </tab>
    <tab title="Clutches"> TODO </tab>
  </tabs>
</template>
<script lang="ts">
import Tab from "~/components/tabs/Tab.vue";
import getMatchLineups from "~/utilities/getMatchLineups";
import LineupUtility from "~/components/match-details/LineupUtility.vue";
import LineupOverview from "~/components/match-details/LineupOverview.vue";
import LineupOpeningDuels from "~/components/match-details/LineupOpeningDuels.vue";

export default {
  components: {
    Tab,
    LineupUtility,
    LineupOverview,
    LineupOpeningDuels,
  },
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  computed: {
    matchLineups() {
      return getMatchLineups(this.match);
    },
  },
};
</script>
