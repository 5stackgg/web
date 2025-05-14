<script setup lang="ts">
import { AlertTriangle, Settings2 } from "lucide-vue-next";
import QuickServerConnect from "~/components/match/QuickServerConnect.vue";
import MatchmakingSettings from "~/components/matchmaking/MatchmakingSettings.vue";
import { Collapsible, CollapsibleContent } from "~/components/ui/collapsible";
import { Button } from "~/components/ui/button";
import TimeAgo from "../TimeAgo.vue";
import CustomMatch from "~/components/CustomMatch.vue";
import FiveStackToolTip from "../FiveStackToolTip.vue";
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
          class="absolute inset-0 bg-gradient-to-r from-primary/5 to-primary/10 animate-pulse"
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
              :date="matchMakingQueueDetails.joinedAt"
              :seconds="true"
            />
          </div>
        </div>

        <Button
          class="relative group overflow-hidden bg-red-900/90 hover:bg-red-800 text-white transition-all duration-300 w-full max-w-md text-lg py-6 transform hover:scale-[1.02]"
          @click="leaveMatchmaking"
        >
          <span class="relative z-10 flex items-center justify-center gap-2">
            <span>Cancel Matchmaking</span>
          </span>
          <div
            class="absolute inset-0 -translate-x-full group-hover:translate-x-0 bg-gradient-to-r from-red-800 to-red-900 transition-transform duration-300"
          ></div>
        </Button>
      </div>

      <div class="flex flex-col gap-4 bg-card p-8 rounded-lg" v-else>
        <div>
          <div
            class="flex mb-4"
            :class="{
              'justify-end': preferredRegions.length,
              'justify-between': !preferredRegions.length,
            }"
          >
            <template v-if="!preferredRegions.length">
              <Alert class="w-fit p-2" variant="destructive">
                <AlertDescription class="flex items-center gap-2">
                  <AlertTriangle class="h-4 w-4" />
                  {{ $t("matchmaking.high_latency_warning") }}
                </AlertDescription>
              </Alert>
            </template>

            <Button
              variant="outline"
              @click="showSettings = !showSettings"
              class="flex items-center gap-2"
            >
              <Settings2 class="h-4 w-4" />
              {{ $t("matchmaking.settings_section.toggle") }}
              <FiveStackToolTip>
                <div class="flex gap-1">
                  {{ $t("matchmaking.settings_section.queue_order") }}
                  <span
                    v-for="(region, index) in preferredRegions"
                    :key="region.value"
                  >
                    {{ region.value
                    }}{{ index < preferredRegions.length - 1 ? ", " : "" }}
                  </span>
                </div>
              </FiveStackToolTip>
            </Button>
          </div>

          <Collapsible :open="showSettings">
            <CollapsibleContent class="flex flex-col gap-4">
              <MatchmakingSettings />
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div class="flex flex-row gap-4">
          <div
            v-for="type in e_match_types"
            :key="type.value"
            class="flex-1 p-4 border rounded-lg transition-all duration-300 relative overflow-hidden group h-[100px]"
            :class="{
              'hover:bg-accent/50 cursor-pointer':
                pendingMatchType !== type.value,
              'bg-primary/20 border-primary cursor-pointer shadow-lg scale-[1.02]':
                pendingMatchType === type.value,
            }"
            @click="handleMatchTypeClick(type.value)"
          >
            <div class="relative z-10 h-full">
              <template v-if="pendingMatchType !== type.value">
                <h3 class="text-lg font-medium">{{ type.value }}</h3>
                <p class="text-sm text-muted-foreground">
                  {{ type.description }}
                </p>
              </template>
              <div
                v-else
                class="absolute inset-0 flex items-center justify-center"
              >
                <span
                  class="text-xl font-semibold text-primary animate-fade-in"
                >
                  {{ $t("matchmaking.confirm_selection") }}
                </span>
              </div>
            </div>
            <div
              v-if="pendingMatchType === type.value"
              class="absolute inset-0 bg-gradient-to-r from-primary/5 to-primary/10 animate-pulse"
            ></div>
          </div>
        </div>

        <Separator class="my-4" />
        <CustomMatch />
      </div>
    </template>
    <template v-else-if="match">
      <div class="flex justify-between items-center">
        <div>
          <Badge variant="secondary" class="text-lg">
            {{ match.status }}
          </Badge>

          <QuickServerConnect :match="match" />
        </div>

        <Button>
          <NuxtLink
            :to="{ name: 'matches', params: { id: match.id } }"
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
import FiveStackToolTip from "../FiveStackToolTip.vue";

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
              region: true,
              server_type: true,
              is_server_online: true,
              connection_string: true,
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
      showSettings: false,
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
    joinMatchmaking(matchType: MatchType): void {
      socket.event("matchmaking:join-queue", {
        type: matchType,
        regions: this.preferredRegions.map((region: Region) => {
          return region.value;
        }),
      });
    },
    leaveMatchmaking(): void {
      socket.leave("matchmaking");
    },
  },
  computed: {
    isInQueue(): boolean {
      return !!this.matchMakingQueueDetails;
    },
    preferredRegions(): Region[] {
      return useMatchmakingStore().preferredRegions;
    },
    regionStats() {
      return useMatchmakingStore().regionStats;
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

<style scoped>
@keyframes loading-bar {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.animate-loading-bar {
  animation: loading-bar 2s infinite;
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 0.8;
  }
}
</style>
