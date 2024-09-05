<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import TimeAgo from "~/components/TimeAgo.vue";
</script>

<template>
  <AlertDialog :open="confirmation && !expired">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Confirm Matchmaking</AlertDialogTitle>
        <AlertDialogDescription>
          <pre>{{ confirmation.type }} {{ confirmation.region }}</pre>
        </AlertDialogDescription>
      </AlertDialogHeader>

      {{ confirmation.confirmed }} / {{ confirmation.players }}

      <TimeAgo :date="confirmation.expiresAt"></TimeAgo>
      <AlertDialogFooter>
        <Button @click="ready">Ready</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script lang="ts">
import socket from "~/web-sockets/Socket";
export default {
  computed: {
    confirmation() {
      return useMatchMakingStore().joinedMatchmakingQueues?.confirmation;
    },
    expired() {
      if (!this.confirmation?.expiresAt || this.confirmation?.matchId) {
        return true;
      }

      return new Date(this.confirmation.expiresAt) < new Date();
    },
  },
  watch: {
    confirmation: {
      immediate: true,
      handler() {
        if (this.confirmation?.matchId) {
          const lastMatchRedirect = localStorage.getItem("confirmedMatchId");
          if (lastMatchRedirect !== this.confirmation.matchId) {
            localStorage.setItem("confirmedMatchId", this.confirmation.matchId);
            this.$router.push(`/matches/${this.confirmation.matchId}`);
          }
        }
      },
    },
  },
  methods: {
    ready() {
      if (!this.confirmation) {
        return;
      }

      socket.event("match-making:confirm", {
        confirmationId: this.confirmation.confirmationId,
      });
    },
  },
};
</script>
