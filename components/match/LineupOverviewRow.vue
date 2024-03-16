<template>
  <tr>
    <lineup-member
      :member="member"
      :lineup_id="lineup_id"
      :removeable="true"
    ></lineup-member>
    <td class="w-2">
      {{ member.player.kills_aggregate.aggregate.count }}
    </td>
    <td class="w-2">
      {{ member.player.assists_aggregate.aggregate.count }}
    </td>
    <td class="w-2">
      {{ member.player.deaths_aggregate.aggregate.count }}
    </td>
    <td class="w-2">
      {{ kd }}
    </td>
    <td class="w-2">
      {{ member.player.damage_dealt_aggregate.aggregate.sum.damage }}
      <span
        class="ml-2 inline-flex items-center gap-x-1.5 py-1.5 px-3 rounded-md text-xs font-medium border border-gray-200 bg-white text-gray-800 shadow-sm dark:bg-slate-900 dark:border-gray-700 dark:text-white"
        >{{
          Math.ceil(
            member.player.damage_dealt_aggregate.aggregate.sum.damage / 1,
            // TODO - need to get rounds
            // match.rounds.length,
          )
        }}
        ADR</span
      >
    </td>
    <td class="w-2">{{ twoKills }}</td>
    <td class="w-2">{{ threeKills }}</td>
    <td class="w-2">{{ fourKills }}</td>
    <td class="w-2">{{ fiveKills }}</td>
    <td class="w-2">
      {{ member.player.knife_kills_aggregate.aggregate.count }}
    </td>
  </tr>
</template>
<script lang="ts">
import LineupMember from "~/components/match/LineupMember.vue";
export default {
  components: {
    LineupMember,
  },
  props: {
    member: {
      required: true,
      type: Object,
    },
    lineup_id: {
      required: true,
      type: String,
    },
  },
  computed: {
    kd() {
      if (this.member.player.deaths_aggregate.aggregate.count === 0) {
        return this.member.player.kills_aggregate.aggregate.count;
      }
      return Math.round(
        this.member.player.kills_aggregate.aggregate.count /
          this.member.player.deaths_aggregate.aggregate.count,
        2,
      );
    },
    twoKills() {
      return this.member.player.multi_kills.filter(({ kills }) => {
        return kills == 2;
      }).length;
    },
    threeKills() {
      return this.member.player.multi_kills.filter(({ kills }) => {
        return kills == 3;
      }).length;
    },
    fourKills() {
      return this.member.player.multi_kills.filter(({ kills }) => {
        return kills == 4;
      }).length;
    },
    fiveKills() {
      return this.member.player.multi_kills.filter(({ kills }) => {
        return kills == 5;
      }).length;
    },
  },
};
</script>
