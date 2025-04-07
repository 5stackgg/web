<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
</script>

<template>
  <AlertDialog :open="shouldShow && confirmation">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{
          $t("matchmaking.confirm.title")
        }}</AlertDialogTitle>
        <AlertDialogDescription>
          <div>{{ confirmation?.type }} @ {{ confirmation?.region }}</div>
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div class="text-4xl font-bold text-center my-4">
        {{ remainingSeconds }}
      </div>

      <template v-if="confirmation?.isReady">
        <div class="flex justify-center items-center">
          <span class="text-4xl font-bold">
            {{
              $t("matchmaking.confirm.players", {
                confirmed: confirmation?.confirmed,
                total: confirmation?.players,
              })
            }}
          </span>
        </div>
      </template>
      <AlertDialogFooter v-else>
        <Button
          @click="ready"
          class="bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-8 text-xl rounded-sm shadow-lg transition duration-300 ease-in-out transform hover:scale-105 w-full p-8"
        >
          {{ $t("matchmaking.confirm.ready") }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script lang="ts">
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import socket from "~/web-sockets/Socket";

export default {
  data() {
    return {
      remainingSeconds: 0,
      routedConfirmedId: undefined as string | undefined,
      countdownInterval: undefined as NodeJS.Timeout | undefined,
    };
  },
  computed: {
    confirmation() {
      return useMatchmakingStore().joinedMatchmakingQueues?.confirmation;
    },
    shouldShow() {
      if (!this.confirmation || this.confirmation.matchId || this.isExpired) {
        return false;
      }

      return true;
    },
    isExpired() {
      if (!this.confirmation) {
        return true;
      }

      return new Date(this.confirmation.expiresAt) <= new Date();
    },
  },
  watch: {
    confirmation: {
      immediate: true,
      handler() {
        this.updateCountdown();

        if (this.confirmation?.matchId) {
          if (this.routedConfirmedId !== this.confirmation.matchId) {
            this.routedConfirmedId = this.confirmation.matchId;
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

      socket.event("matchmaking:confirm", {
        confirmationId: this.confirmation.confirmationId,
      });
    },
    updateCountdown() {
      if (this.confirmation?.expiresAt) {
        const expiresAt = new Date(this.confirmation.expiresAt).getTime();
        const now = new Date().getTime();
        const difference = Math.max(0, Math.floor((expiresAt - now) / 1000));
        this.remainingSeconds = difference;
      }
    },
  },
  mounted() {
    this.updateCountdown();
    this.countdownInterval = setInterval(this.updateCountdown, 1000);
  },
  beforeUnmount() {
    if (this.countdownInterval !== null) {
      clearInterval(this.countdownInterval);
    }
  },
};
</script>
