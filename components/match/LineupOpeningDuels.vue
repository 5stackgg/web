<script lang="ts" setup>
import LineupOpeningDuelRow from "~/components/match/LineupOpeningDuelRow.vue";
</script>
<template>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead class="w-[220px] text-left whitespace-nowrap">
          {{ lineup.name }}
        </TableHead>
        <TableHead class="whitespace-nowrap">{{
          $t("match.opening_duels.attempts")
        }}</TableHead>
        <TableHead class="whitespace-nowrap">{{
          $t("match.opening_duels.success")
        }}</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <lineup-opening-duel-row
        :member="member"
        :lineup="lineup"
        :match="match"
        v-for="member of lineup.lineup_players"
      ></lineup-opening-duel-row>
    </TableBody>
  </Table>
</template>

<script lang="ts">
export default {
  props: {
    match: {
      required: true,
      type: Object,
    },
    lineup: {
      required: true,
      type: Object,
    },
  },
};
</script>
