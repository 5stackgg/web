<script setup lang="ts">
import { useMediaQuery } from "@vueuse/core";
import { AlertTriangle } from "lucide-vue-next";
import QuickMatchConnect from "~/components/match/QuickMatchConnect.vue";
import { Button } from "~/components/ui/button";
import TimeAgo from "../TimeAgo.vue";
import CustomMatch from "~/components/CustomMatch.vue";

const isMobile = useMediaQuery("(max-width: 768px)");

const mmCardBase =
  "group/mmc relative flex flex-col flex-1 min-h-[120px] px-[1.1rem] pt-4 pb-5 text-left cursor-pointer overflow-hidden isolate border border-border text-foreground [background:linear-gradient(135deg,hsl(var(--card)/0.7)_0%,hsl(var(--card)/0.35)_60%,hsl(var(--tac-amber)/0.05)_100%)] [transition:border-color_180ms_ease,background_220ms_ease,box-shadow_220ms_ease] hover:border-[hsl(var(--tac-amber)/0.55)] hover:[background:linear-gradient(135deg,hsl(var(--card)/0.8)_0%,hsl(var(--card)/0.45)_55%,hsl(var(--tac-amber)/0.12)_100%)] hover:shadow-[0_0_24px_hsl(var(--tac-amber)/0.12)] focus-visible:outline-none focus-visible:border-[hsl(var(--tac-amber))] focus-visible:shadow-[0_0_0_2px_hsl(var(--tac-amber)/0.35)]";

const mmCardPending =
  "!border-[hsl(var(--tac-amber))] ![background:linear-gradient(135deg,hsl(var(--card)/0.8)_0%,hsl(var(--tac-amber)/0.18)_100%)] !shadow-[0_0_32px_hsl(var(--tac-amber)/0.2)]";
</script>

<template>
  <div v-if="matchmakingAllowed">
    <template v-if="me.is_banned">
      <Alert class="my-3">
        <AlertDescription class="flex items-center gap-2">
          <AlertTriangle class="h-4 w-4" />
          {{ $t("matchmaking.banned") }}
        </AlertDescription>
      </Alert>
    </template>
    <template v-else-if="me.matchmaking_cooldown">
      <Alert class="my-3">
        <AlertDescription class="flex items-center gap-2">
          <AlertTriangle class="h-4 w-4" />
          {{
            $t("matchmaking.temp_banned", {
              time: me.matchmaking_cooldown,
            })
          }}
        </AlertDescription>
      </Alert>
    </template>
    <template v-else-if="!confirmationDetails">
      <div
        v-if="isInQueue && matchMakingQueueDetails"
        class="mb-4 flex flex-col gap-6 p-12 rounded-xl border border-border shadow-lg relative overflow-hidden min-h-[300px] justify-center items-center animate-fade-in backdrop-blur-sm"
      >
        <div
          class="absolute inset-0 bg-gradient-to-r from-primary/5 to-primary/10 animate-soft-pulse"
        ></div>
        <div class="absolute inset-0">
          <div
            class="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,var(--primary)_/_0.1,transparent)]"
          ></div>
        </div>

        <div class="absolute top-0 left-0 w-full h-1">
          <div
            class="h-full bg-gradient-to-r from-primary/80 to-primary animate-loading-bar"
          ></div>
        </div>

        <div class="relative z-10 flex flex-col items-center text-center">
          <div
            class="flex items-center gap-4 mb-4 text-2xl font-medium capitalize"
          >
            {{
              $t("matchmaking.searching_for_match", {
                type: matchMakingQueueDetails.type,
              })
            }}
          </div>
          <div class="text-xl text-gray-400/90 flex items-center gap-2">
            <TimeAgo
              v-if="matchMakingQueueDetails.joinedAt"
              :date="
                Math.min(
                  new Date().getTime(),
                  new Date(matchMakingQueueDetails.joinedAt).getTime(),
                )
              "
              :seconds="true"
            />
          </div>
        </div>

        <Button
          class="relative group overflow-hidden bg-red-900/90 hover:bg-red-800 text-white transition-all duration-300 w-full max-w-md text-lg py-6 transform hover:scale-[1.02]"
          @click="leaveMatchmaking"
        >
          <span class="relative z-10 flex items-center justify-center gap-2">
            <span>{{ $t("matchmaking.cancel_matchmaking") }}</span>
          </span>
          <div
            class="absolute inset-0 -translate-x-full group-hover:translate-x-0 bg-gradient-to-r from-red-800 to-red-900 transition-transform duration-300"
          ></div>
        </Button>
      </div>

      <div class="flex flex-col gap-4 bg-card rounded-lg" v-else>
        <div
          v-if="
            !isMobile &&
            availableRegionsWithNodes.length > 0 &&
            !preferredRegions.length
          "
        >
          <Alert class="w-fit p-2" variant="destructive">
            <AlertDescription class="flex items-center gap-2">
              <AlertTriangle class="h-4 w-4" />
              {{ $t("matchmaking.high_latency_warning") }}
            </AlertDescription>
          </Alert>
        </div>

        <div v-if="!isMobile" class="flex flex-row gap-4">
          <button
            v-for="type in allowedMatchTypes"
            :key="type.value"
            type="button"
            :class="[
              mmCardBase,
              'transition-all duration-300 ease-out',
              pendingMatchType === type.value &&
                `${mmCardPending} scale-[1.03]`,
              pendingMatchType &&
                pendingMatchType !== type.value &&
                'opacity-40 scale-95',
              (!pendingMatchType || pendingMatchType === type.value) &&
                'hover:scale-[1.015]',
            ]"
            @click="handleMatchTypeClick(type.value)"
          >
            <span
              class="absolute inset-0 z-0 pointer-events-none opacity-0 transition-opacity [transition-duration:220ms] [transition-timing-function:ease] [background-image:repeating-linear-gradient(180deg,transparent_0,transparent_3px,hsl(var(--tac-amber)/0.03)_3px,hsl(var(--tac-amber)/0.03)_4px)] group-hover/mmc:opacity-100"
              :class="{ '!opacity-100': pendingMatchType === type.value }"
              aria-hidden="true"
            ></span>

            <Badge
              variant="secondary"
              class="absolute top-2 right-2 px-2 py-0.5 text-[0.65rem] tracking-[0.12em] uppercase transition-opacity duration-200"
              v-if="inQueueStas[type.value] > 0"
              :class="{ 'opacity-0': pendingMatchType === type.value }"
            >
              {{ inQueueStas[type.value] || 0 }}
              {{ $t("matchmaking.in_queue") }}
            </Badge>

            <div
              class="relative z-[1] flex-1 min-w-0 flex flex-col gap-[0.4rem]"
            >
              <div
                class="inline-flex items-center gap-[0.55rem] font-mono text-[0.72rem] font-bold tracking-[0.24em] uppercase text-muted-foreground transition-colors [transition-duration:180ms] group-hover/mmc:text-[hsl(var(--tac-amber))]"
                :class="{
                  '!text-[hsl(var(--tac-amber))]':
                    pendingMatchType === type.value,
                }"
              >
                <span
                  class="inline-block w-[10px] h-[2px] bg-[hsl(var(--tac-amber))]"
                  aria-hidden="true"
                ></span>
                {{ type.value.toUpperCase() }}
              </div>
              <Transition
                mode="out-in"
                enter-active-class="transition-all duration-200 ease-out"
                leave-active-class="transition-all duration-150 ease-in"
                enter-from-class="opacity-0 scale-90"
                enter-to-class="opacity-100 scale-100"
                leave-from-class="opacity-100 scale-100"
                leave-to-class="opacity-0 scale-90"
              >
                <p
                  v-if="pendingMatchType !== type.value"
                  :key="`idle-${type.value}`"
                  class="m-0 text-[0.78rem] leading-[1.5] text-muted-foreground"
                >
                  {{ type.description }}
                </p>
                <div
                  v-else
                  :key="`pending-${type.value}`"
                  class="relative z-[1] flex-1 flex items-center justify-center font-sans text-[1.05rem] font-bold tracking-[0.14em] uppercase text-[hsl(var(--tac-amber))] [text-shadow:0_0_12px_hsl(var(--tac-amber)/0.4)]"
                >
                  {{ $t("matchmaking.confirm_selection") }}
                </div>
              </Transition>
            </div>
          </button>

          <CustomMatch
            compact
            class="transition-all duration-300 ease-out"
            :class="{ 'opacity-40 scale-95': pendingMatchType }"
          />
        </div>

        <CustomMatch v-if="isMobile" class="mt-4" />
      </div>
    </template>
    <template v-else-if="match">
      <div class="flex justify-between items-center">
        <div>
          <Badge variant="secondary" class="text-lg">
            {{ match.status }}
          </Badge>

          <QuickMatchConnect :match="match" />
        </div>

        <Button>
          <NuxtLink
            :to="{ name: 'matches-id', params: { id: match.id } }"
            class="text-xl font-bold bg-foreground"
          >
            {{ $t("matchmaking.go_to_match") }}
          </NuxtLink>
        </Button>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { $ } from "~/generated/zeus";
import socket from "~/web-sockets/Socket";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { generateQuery } from "~/graphql/graphqlGen";
import { e_match_types_enum, e_match_status_enum } from "~/generated/zeus";
import { toast } from "@/components/ui/toast";

interface Region {
  value: string;
  description: string;
  status: string;
  is_lan: boolean;
}

interface QueueDetails {
  totalInQueue: number;
  type: e_match_types_enum;
  regions: string[];
  joinedAt?: string;
}

interface ConfirmationDetails {
  matchId: string;
  isReady: boolean;
  expiresAt: string;
  confirmed: number;
  confirmationId: string;
  type: e_match_types_enum;
  region: string;
}

interface Match {
  id: string;
  status: e_match_status_enum;
  region?: string;
  server_type?: string;
  is_server_online?: boolean;
  connection_string?: string;
}

export default {
  apollo: {
    e_match_types: {
      fetchPolicy: "cache-first",
      query: generateQuery({
        e_match_types: [
          {
            where: {
              value: {
                _in: [
                  e_match_types_enum.Competitive,
                  e_match_types_enum.Wingman,
                  e_match_types_enum.Duel,
                ],
              },
            },
          },
          {
            value: true,
            description: true,
          },
        ],
      }),
    },
    $subscribe: {
      matches_by_pk: {
        variables(): { matchId: string | undefined } {
          return {
            matchId: (this as any).confirmationDetails?.matchId,
          };
        },
        skip(): boolean {
          return !(this as any).confirmationDetails?.matchId;
        },
        query: typedGql("subscription")({
          matches_by_pk: [
            {
              id: $("matchId", "uuid!"),
            },
            {
              id: true,
              status: true,
              server_type: true,
              is_in_lineup: true,
              is_organizer: true,
              is_server_online: true,
              connection_string: true,
              connection_link: true,
              tv_connection_string: true,
              options: {
                tv_delay: true,
              },
            },
          ],
        }),
        result({ data }: { data: { matches_by_pk: Match } }): void {
          (this as any).match = data.matches_by_pk;
        },
      },
    },
  },
  data() {
    return {
      match: undefined as Match | undefined,
      playerSanctions: [] as any[],
      showConfirmation: false,
      pendingMatchType: undefined as e_match_types_enum | undefined,
      e_match_types: [] as {
        value: e_match_types_enum;
        description: string;
      }[],
      confirmationTimeout: undefined as NodeJS.Timeout | undefined,
    };
  },
  methods: {
    isMatchmakingTypeEnabled(matchType: string): boolean {
      return useApplicationSettingsStore().isMatchmakingTypeEnabled(matchType);
    },
    getRegionlatencyResult(region: string):
      | {
          isLan: boolean;
          latency: string;
        }
      | undefined {
      return useMatchmakingStore().getRegionlatencyResult(region);
    },
    handleMatchTypeClick(matchType: e_match_types_enum): void {
      if (this.preferredRegions.length === 0) {
        toast({
          title: this.$t("matchmaking.no_preferred_regions") as string,
          variant: "destructive",
        });
        return;
      }
      if (this.pendingMatchType === matchType) {
        // Second click - confirm
        if (this.confirmationTimeout) {
          clearTimeout(this.confirmationTimeout);
          this.confirmationTimeout = undefined;
        }
        this.joinMatchmaking(this.pendingMatchType);
        this.pendingMatchType = undefined;
        return;
      }

      // First click - show confirmation state
      if (this.confirmationTimeout) {
        clearTimeout(this.confirmationTimeout);
      }

      this.pendingMatchType = matchType;
      this.confirmationTimeout = setTimeout(() => {
        this.pendingMatchType = undefined;
        this.confirmationTimeout = undefined;
      }, 5000);
    },
    joinMatchmaking(matchType: e_match_types_enum): void {
      socket.event("matchmaking:join-queue", {
        type: matchType,
        regions: this.preferredRegions.map((region: Region) => {
          return region.value;
        }),
      });
    },
    leaveMatchmaking(): void {
      socket.event("matchmaking:leave");
    },
  },
  computed: {
    showSeparators() {
      return useApplicationSettingsStore().showSeparators;
    },
    allowedMatchTypes(): {
      value: e_match_types_enum;
      description: string;
    }[] {
      return this.e_match_types.filter((type) =>
        this.isMatchmakingTypeEnabled(type.value.toLowerCase()),
      );
    },
    isInQueue(): boolean {
      return !!this.matchMakingQueueDetails;
    },
    preferredRegions(): Region[] {
      return useMatchmakingStore().preferredRegions;
    },
    availableRegionsWithNodes(): Region[] {
      return useApplicationSettingsStore().availableRegions.filter(
        (region: { has_node: boolean }) => region.has_node,
      );
    },
    regionStats() {
      return useMatchmakingStore().regionStats;
    },
    inQueueStas() {
      const inQueue = {
        [e_match_types_enum.Duel]: 0,
        [e_match_types_enum.Wingman]: 0,
        [e_match_types_enum.Competitive]: 0,
      };
      const regions = this.preferredRegions as Region[];
      for (let i = 0; i < regions.length; i++) {
        const region: Region = regions[i];
        const regionStats = this.regionStats[region.value];
        if (!regionStats) {
          continue;
        }
        inQueue[e_match_types_enum.Duel] +=
          regionStats[e_match_types_enum.Duel] || 0;
        inQueue[e_match_types_enum.Wingman] +=
          regionStats[e_match_types_enum.Wingman] || 0;
        inQueue[e_match_types_enum.Competitive] +=
          regionStats[e_match_types_enum.Competitive] || 0;
      }

      return inQueue;
    },
    matchMakingQueueDetails(): QueueDetails | undefined {
      return useMatchmakingStore().joinedMatchmakingQueues.details;
    },
    confirmationDetails(): ConfirmationDetails | undefined {
      return useMatchmakingStore().joinedMatchmakingQueues.confirmation;
    },
    matchmakingAllowed(): boolean {
      return useApplicationSettingsStore().matchmakingAllowed;
    },
    me() {
      return useAuthStore().me;
    },
    queueWaitTime(): string {
      if (!this.matchMakingQueueDetails?.joinedAt) return "0 seconds";

      const joinedAt = new Date(this.matchMakingQueueDetails.joinedAt);
      const now = new Date();
      const diffInSeconds = Math.floor(
        (now.getTime() - joinedAt.getTime()) / 1000,
      );

      if (diffInSeconds < 60) {
        return `${diffInSeconds} seconds`;
      }

      const minutes = Math.floor(diffInSeconds / 60);
      const seconds = diffInSeconds % 60;
      return `${minutes}m ${seconds}s`;
    },
  },
};
</script>
