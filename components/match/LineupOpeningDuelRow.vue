<template>
  <TableRow>
    <TableCell>
      <lineup-member :member="member" :lineup_id="lineup.id"></lineup-member>
    </TableCell>
    <TableCell>{{ attempts }}</TableCell>
    <TableCell>{{ success }}</TableCell>
  </TableRow>
</template>

<script lang="ts">
import LineupMember from "~/components/match/LineupMember.vue";

export default {
  components: { LineupMember },
  props: {
    match: {
      required: true,
      type: Object,
    },
    member: {
      required: true,
      type: Object,
    },
    lineup: {
      required: true,
      type: Object,
    },
  },
  computed: {
    attempts() {
      let attempts = 0;

      for (const match_map of this.match.match_maps) {
        for (const round of match_map.rounds) {
          const firstKill = round.kills.find((kill: any) => {
            return (
              kill.player &&
              kill.player?.steam_id !== kill.attacked_player.steam_id
            );
          });

          if (!firstKill) {
            continue;
          }

          if (
            this.member.steam_id === firstKill.player?.steam_id ||
            this.member.steam_id === firstKill.attacked_player.steam_id
          ) {
            attempts++;
          }
        }
      }
      return attempts;
    },
    success() {
      let success = 0;

      for (const match_map of this.match.match_maps) {
        for (const round of match_map.rounds) {
          const firstKill = round.kills.find((kill: any) => {
            return (
              kill.player &&
              kill.player?.steam_id !== kill.attacked_player.steam_id
            );
          });

          if (!firstKill) {
            continue;
          }

          if (this.member.steam_id === firstKill.player?.steam_id) {
            success++;
          }
        }
      }
      return success;
    },
  },
};
</script>
