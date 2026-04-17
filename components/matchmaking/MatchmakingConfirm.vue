<script setup lang="ts">
import { AlertDialog, AlertDialogContent } from "@/components/ui/alert-dialog";
</script>

<template>
  <AlertDialog :open="!!shouldShow">
    <AlertDialogContent
      class="!max-w-md !gap-0 overflow-visible !border-0 !bg-transparent !p-0 !shadow-none"
    >
      <div
        class="relative overflow-hidden rounded-lg border border-border px-6 py-8 [backdrop-filter:blur(10px)] [background:linear-gradient(180deg,hsl(var(--card)/0.95)_0%,hsl(var(--card)/0.85)_100%)]"
        :class="
          isCritical
            ? '[box-shadow:0_0_0_1px_hsl(var(--destructive)/0.45),0_0_40px_hsl(var(--destructive)/0.3)]'
            : '[box-shadow:0_0_0_1px_hsl(var(--tac-amber)/0.3),0_0_40px_hsl(var(--tac-amber)/0.18)]'
        "
      >
        <span
          aria-hidden="true"
          class="pointer-events-none absolute left-2 top-2 h-[14px] w-[14px] border-l-2 border-t-2 transition-colors duration-300"
          :class="
            isCritical ? 'border-destructive' : 'border-[hsl(var(--tac-amber))]'
          "
        ></span>
        <span
          aria-hidden="true"
          class="pointer-events-none absolute bottom-2 right-2 h-[14px] w-[14px] border-b-2 border-r-2 transition-colors duration-300"
          :class="
            isCritical ? 'border-destructive' : 'border-[hsl(var(--tac-amber))]'
          "
        ></span>

        <span
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 opacity-30 [background-image:repeating-linear-gradient(180deg,transparent_0,transparent_3px,hsl(var(--tac-amber)/0.04)_3px,hsl(var(--tac-amber)/0.04)_4px)]"
        ></span>

        <span
          aria-hidden="true"
          class="pointer-events-none absolute left-0 right-0 top-0 h-[2px] overflow-hidden"
        >
          <span
            class="block h-full w-1/2 bg-gradient-to-r from-transparent to-transparent animate-loading-bar"
            :class="
              isCritical ? 'via-destructive' : 'via-[hsl(var(--tac-amber))]'
            "
          ></span>
        </span>

        <div class="relative z-10 flex flex-col items-center gap-5 text-center">
          <div class="flex flex-col items-center gap-1.5">
            <div
              class="inline-flex items-center gap-2 font-mono text-[0.72rem] font-bold uppercase tracking-[0.28em] transition-colors duration-300"
              :class="
                isCritical ? 'text-destructive' : 'text-[hsl(var(--tac-amber))]'
              "
            >
              <span
                class="inline-block h-[2px] w-[10px] transition-colors duration-300"
                :class="
                  isCritical ? 'bg-destructive' : 'bg-[hsl(var(--tac-amber))]'
                "
              ></span>
              {{ $t("matchmaking.match_found") }}
              <span
                class="h-1 w-1 rounded-full animate-soft-pulse transition-colors duration-300"
                :class="
                  isCritical ? 'bg-destructive' : 'bg-[hsl(var(--tac-amber))]'
                "
              ></span>
            </div>
            <div
              v-if="confirmation"
              class="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground"
            >
              {{ confirmation.type }}
              <span class="mx-1.5 text-muted-foreground/50">·</span>
              {{ confirmation.region }}
            </div>
          </div>

          <div class="flex flex-col items-center gap-1">
            <div
              class="font-mono font-bold leading-none tracking-[0.08em] tabular-nums text-[clamp(3rem,10vw,5rem)] transition-colors duration-300"
              :class="
                isCritical
                  ? 'text-destructive [text-shadow:0_0_24px_hsl(var(--destructive)/0.6)]'
                  : 'text-foreground [text-shadow:0_0_24px_hsl(var(--tac-amber)/0.4)]'
              "
            >
              {{ formattedCountdown }}
            </div>
            <div
              class="font-mono text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground/80"
            >
              {{
                confirmation?.isReady
                  ? $t("matchmaking.waiting_on_others")
                  : $t("matchmaking.waiting_for_players")
              }}
            </div>
          </div>

          <div class="flex flex-col items-center gap-2.5">
            <div
              class="font-mono text-[0.75rem] uppercase tracking-[0.2em] text-foreground"
            >
              <span class="text-[hsl(var(--tac-amber))]">{{
                confirmation?.confirmed || 0
              }}</span>
              <span class="text-muted-foreground/60"> / </span>
              <span>{{ confirmation?.players || 0 }}</span>
              <span class="ml-2 text-muted-foreground">{{
                $t("matchmaking.confirmed")
              }}</span>
            </div>
            <div class="flex items-center gap-2">
              <template v-for="i in confirmation?.players" :key="i">
                <span
                  v-if="i <= (confirmation?.confirmed || 0)"
                  class="h-2.5 w-2.5 rotate-45 bg-[hsl(var(--tac-amber))] [box-shadow:0_0_10px_hsl(var(--tac-amber)/0.65)]"
                ></span>
                <span
                  v-else
                  class="h-2.5 w-2.5 rotate-45 border border-muted-foreground/40"
                ></span>
              </template>
            </div>
          </div>

          <button
            v-if="!confirmation?.isReady"
            type="button"
            class="tac-amber-cta relative isolate mt-2 inline-flex w-full items-center justify-center gap-3 overflow-hidden rounded-md border px-6 py-4 font-sans text-sm font-bold uppercase leading-none tracking-[0.22em]"
            @click="ready"
          >
            <span
              class="inline-block h-[2px] w-[12px] bg-[hsl(var(--tac-amber-foreground))]/70"
            ></span>
            {{ $t("matchmaking.ready") }}
            <span
              class="inline-block h-[2px] w-[12px] bg-[hsl(var(--tac-amber-foreground))]/70"
            ></span>
          </button>

          <div
            v-else
            class="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-success/50 bg-success/10 px-6 py-4 font-sans text-sm font-bold uppercase leading-none tracking-[0.22em] text-success"
          >
            <span
              class="h-2 w-2 rotate-45 bg-success animate-soft-pulse"
            ></span>
            {{ $t("matchmaking.locked_in") }}
          </div>
        </div>
      </div>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script lang="ts">
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import socket from "~/web-sockets/Socket";
import { useSound } from "~/composables/useSound";

export default {
  data() {
    return {
      remainingSeconds: 0,
      routedConfirmedId: undefined as string | undefined,
      countdownInterval: undefined as NodeJS.Timeout | undefined,
      playCountdownSound: useSound().playCountdownSound,
      playMatchFoundSound: useSound().playMatchFoundSound,
      playTickSound: useSound().playTickSound,
    };
  },
  computed: {
    confirmation() {
      return useMatchmakingStore().joinedMatchmakingQueues?.confirmation;
    },
    shouldShow() {
      if (!this.confirmation || this.confirmation.matchId) {
        return false;
      }
      return true;
    },
    formattedCountdown(): string {
      const total = Math.max(0, this.remainingSeconds);
      const m = Math.floor(total / 60)
        .toString()
        .padStart(2, "0");
      const s = (total % 60).toString().padStart(2, "0");
      return `${m}:${s}`;
    },
    isCritical(): boolean {
      return this.remainingSeconds > 0 && this.remainingSeconds <= 5;
    },
  },
  watch: {
    confirmation: {
      immediate: true,
      handler(confirmation, oldConfirmation) {
        if (!confirmation) {
          return;
        }

        if (!oldConfirmation) {
          if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
          }
          this.playMatchFoundSound();
          this.updateCountdown();
          this.countdownInterval = setInterval(this.updateCountdown, 1000);
        }

        if (this.confirmation?.isReady) {
          this.playTickSound();
        }

        if (!oldConfirmation?.matchId && this.confirmation?.matchId) {
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
      if (
        this.confirmation?.expiresAt &&
        this.confirmation.confirmed !== this.confirmation.players
      ) {
        const expiresAt = new Date(this.confirmation.expiresAt).getTime();
        const now = new Date().getTime();
        const difference = Math.max(0, Math.floor((expiresAt - now) / 1000));

        this.playCountdownSound();
        this.remainingSeconds = difference;
      }
    },
  },
  beforeUnmount() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  },
};
</script>
