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
    <tab title="Clutches">
      <lineup-clutches
        :match="match"
        :lineup1="matchLineups.lineup1"
        :lineup2="matchLineups.lineup2"
      ></lineup-clutches>
    </tab>
  </tabs>
</template>
<script lang="ts">
import Tab from "~/components/tabs/Tab.vue";
import getMatchLineups from "~/utilities/getMatchLineups";
import LineupUtility from "~/components/match/LineupUtility.vue";
import LineupOverview from "~/components/match/LineupOverview.vue";
import LineupClutches from "~/components/match/LineupClutches.vue";
import LineupOpeningDuels from "~/components/match/LineupOpeningDuels.vue";

export default {
  components: {
    Tab,
    LineupUtility,
    LineupOverview,
    LineupClutches,
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
