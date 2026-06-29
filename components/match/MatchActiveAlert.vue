<script setup lang="ts">
import { AlertDialog, AlertDialogContent } from "@/components/ui/alert-dialog";
import { X } from "lucide-vue-next";
import { useMatchReadyModal } from "~/composables/useMatchReadyModal";

const { manuallyOpened } = useMatchReadyModal();
</script>

<template>
  <AlertDialog :open="!!shouldShow">
    <AlertDialogContent
      class="!max-w-md !gap-0 overflow-visible !border-0 !bg-transparent !p-0 !shadow-none"
    >
      <div
        v-if="match"
        class="relative overflow-hidden rounded-lg border border-border px-6 py-8 [backdrop-filter:blur(10px)] [background:linear-gradient(180deg,hsl(var(--card)/0.95)_0%,hsl(var(--card)/0.85)_100%)] [box-shadow:0_0_0_1px_hsl(var(--tac-amber)/0.3),0_0_40px_hsl(var(--tac-amber)/0.18)]"
      >
        <span
          aria-hidden="true"
          class="pointer-events-none absolute left-2 top-2 h-[14px] w-[14px] border-l-2 border-t-2 border-[hsl(var(--tac-amber))]"
        ></span>
        <span
          aria-hidden="true"
          class="pointer-events-none absolute bottom-2 right-2 h-[14px] w-[14px] border-b-2 border-r-2 border-[hsl(var(--tac-amber))]"
        ></span>
        <span
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 opacity-30 [background-image:repeating-linear-gradient(180deg,transparent_0,transparent_3px,hsl(var(--tac-amber)/0.04)_3px,hsl(var(--tac-amber)/0.04)_4px)]"
        ></span>

        <div class="relative z-10 flex flex-col items-center gap-5 text-center">
          <div class="flex flex-col items-center gap-1.5">
            <div
              class="inline-flex items-center gap-2 font-mono text-[0.72rem] font-bold uppercase tracking-[0.28em] text-[hsl(var(--tac-amber))]"
            >
              <span
                class="inline-block h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"
              ></span>
              {{ statusLabel }}
              <span
                class="h-1 w-1 rounded-full animate-soft-pulse bg-[hsl(var(--tac-amber))]"
              ></span>
            </div>
          </div>

          <div class="flex flex-col items-center gap-1">
            <div
              class="font-sans text-base font-semibold leading-snug text-foreground"
            >
              {{ matchTitle }}
            </div>
          </div>

          <NuxtLink
            :to="targetLink"
            class="tac-amber-cta relative isolate mt-2 inline-flex w-full items-center justify-center gap-3 overflow-hidden rounded-md border px-6 py-4 font-sans text-sm font-bold uppercase leading-none tracking-[0.22em]"
            @click="acknowledge"
          >
            <span
              class="inline-block h-[2px] w-[12px] bg-[hsl(var(--tac-amber-foreground))]/70"
            ></span>
            {{ draftGameId ? $t("draft_games.room.go_to_room") : $t("matchmaking.go_to_match") }}
            <span
              class="inline-block h-[2px] w-[12px] bg-[hsl(var(--tac-amber-foreground))]/70"
            ></span>
          </NuxtLink>

          <div
            class="mt-1 flex flex-col items-center gap-0.5 text-center text-xs leading-snug"
          >
            <span class="text-muted-foreground">
              {{ $t("matchmaking.disable_match_ready_modal_hint") }}
            </span>
            <NuxtLink
              to="/settings/matchmaking"
              class="text-foreground underline underline-offset-4 decoration-muted-foreground/60 transition-colors hover:text-[hsl(var(--tac-amber))] hover:decoration-[hsl(var(--tac-amber))]"
              @click="acknowledge"
            >
              {{ $t("matchmaking.disable_match_ready_modal_action") }}
            </NuxtLink>
          </div>
        </div>

        <button
          type="button"
          class="absolute right-3 top-3 z-20 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
          :aria-label="$t('common.close')"
          @click="acknowledge"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script lang="ts">
import { e_match_status_enum } from "~/generated/zeus";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { useAuthStore } from "~/stores/AuthStore";
import { useMatchReadyModal } from "~/composables/useMatchReadyModal";

const ALERT_STATUSES: string[] = [
  e_match_status_enum.WaitingForCheckIn,
  e_match_status_enum.Veto,
  e_match_status_enum.Live,
];

export default {
  data() {
    return {
      acknowledgedKey: null as string | null,
      visitedMatchId: null as string | null,
    };
  },
  computed: {
    match(): any {
      return useMatchLobbyStore().currentMatch;
    },
    matchKey(): string | null {
      if (!this.match) return null;
      return `${this.match.id}:${this.match.status}`;
    },
    isAlertable(): boolean {
      return !!this.match && ALERT_STATUSES.includes(this.match.status);
    },
    hasActiveMatchmakingConfirmation(): boolean {
      const confirmation =
        useMatchmakingStore().joinedMatchmakingQueues?.confirmation;
      return !!confirmation && !confirmation.matchId;
    },
    showPref(): boolean {
      return useAuthStore().me?.show_match_ready_modal !== false;
    },
    isOnMatchPage(): boolean {
      const path = this.$route?.path || "";
      if (
        this.draftGameId &&
        path.startsWith(`/draft-room/${this.draftGameId}`)
      ) {
        return true;
      }
      return !!this.match && path.startsWith(`/matches/${this.match.id}`);
    },
    shouldShow(): boolean {
      if (!this.isAlertable) return false;
      if (this.hasActiveMatchmakingConfirmation) return false;
      if (this.isOnMatchPage) return false;
      if (this.acknowledgedKey && this.acknowledgedKey === this.matchKey) {
        return false;
      }
      // If they were on the match (or draft) page and navigated away, don't
      // auto-nag them — they already know. Manual open still works.
      const autoShow =
        this.showPref && this.visitedMatchId !== this.match.id;
      return autoShow || this.manuallyOpened;
    },
    statusLabel(): string {
      return (
        this.match?.e_match_status?.description || this.match?.status || ""
      );
    },
    matchTitle(): string {
      const a = this.match?.lineup_1?.name || this.$t("common.tbd");
      const b = this.match?.lineup_2?.name || this.$t("common.tbd");
      return `${a} vs ${b}`;
    },
    draftGameId(): string | null {
      return this.match?.draft_games?.[0]?.id || null;
    },
    targetLink(): string {
      return this.draftGameId
        ? `/draft-room/${this.draftGameId}`
        : `/matches/${this.match.id}`;
    },
  },
  watch: {
    matchKey(next, prev) {
      if (next !== prev && this.acknowledgedKey !== next) {
        this.acknowledgedKey = null;
      }
    },
    isOnMatchPage: {
      immediate: true,
      handler(onPage: boolean) {
        if (onPage && this.match) {
          this.visitedMatchId = this.match.id;
        }
      },
    },
  },
  methods: {
    acknowledge() {
      this.acknowledgedKey = this.matchKey;
      useMatchReadyModal().closeMatchReadyModal();
    },
  },
};
</script>
