<script setup lang="ts">
import { dateLocale } from "~/utilities/dateLocale";
import { useMediaQuery } from "@vueuse/core";
import { useSubscription } from "@vue/apollo-composable";
import { AlertTriangle } from "lucide-vue-next";
import { TOURNAMENT_COOLDOWN_SUBSCRIPTION } from "~/graphql/tournamentCooldown";
import QuickMatchConnect from "~/components/match/QuickMatchConnect.vue";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import TimeAgo from "../TimeAgo.vue";

const isMobile = useMediaQuery("(max-width: 768px)");

// Both the ban expiry and the matchmaking cooldown are timestamps. Rendered in
// the viewer's own locale and timezone -- a raw ISO string is unreadable, and
// the cooldown was previously passed to the message but never shown at all.
// Takes unknown because the generated timestamptz scalar is untyped, so the
// value arrives as {} rather than a string.
const formatBanExpiry = (value: unknown) => {
  const date = value instanceof Date ? value : new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString(dateLocale(), {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

// A scoped sanction whose ladder rung is 0 resolves to 'infinity'::timestamptz
// and arrives here as the literal string "infinity". new Date() turns that into
// an Invalid Date, which formatBanExpiry reports as "" -- indistinguishable
// from a missing expiry. It has to be caught first and read as permanent.
const isPermanentExpiry = (value: unknown) => String(value) === "infinity";

// Deliberately NOT part of `me`. api and web ship as separate images on
// separate release channels, so web can reach a stack whose api has not run the
// sanctions migration; inside the `me` document that rejection took sign-in down
// with it. Here the same rejection costs only the readout: `optional` keeps it
// out of the global error toast (plugins/apollo.client.ts), useSubscription
// parks the failure on its own `error` ref rather than throwing, and `result`
// simply stays undefined -- which renders as no cooldown.
const meSteamId = computed(() => useAuthStore().me?.steam_id);

const { result: tournamentCooldownResult } = useSubscription(
  TOURNAMENT_COOLDOWN_SUBSCRIPTION,
  () => ({ steamId: meSteamId.value }),
  () => ({
    enabled: !!meSteamId.value,
    context: { optional: true },
  }),
);

const tournamentCooldown = computed(
  () =>
    (tournamentCooldownResult.value as Record<string, any> | undefined)
      ?.players_by_pk?.tournament_cooldown,
);

const mmCardBase =
  "group/mmc relative flex flex-col flex-1 min-h-[120px] px-[1.1rem] pt-4 pb-5 text-left cursor-pointer overflow-hidden isolate border border-border text-foreground [background:linear-gradient(135deg,hsl(var(--card)/0.7)_0%,hsl(var(--card)/0.35)_60%,hsl(var(--tac-amber)/0.05)_100%)] [transition:border-color_180ms_ease,background_220ms_ease,box-shadow_220ms_ease] hover:border-[hsl(var(--tac-amber)/0.55)] hover:[background:linear-gradient(135deg,hsl(var(--card)/0.8)_0%,hsl(var(--card)/0.45)_55%,hsl(var(--tac-amber)/0.12)_100%)] hover:shadow-[0_0_24px_hsl(var(--tac-amber)/0.12)] focus-visible:outline-none focus-visible:border-[hsl(var(--tac-amber))] focus-visible:shadow-[0_0_0_2px_hsl(var(--tac-amber)/0.35)]";

// The queue panel is much taller than the card row, so the shell morphs between
// the two heights while the panels cross-fade — otherwise the page below jumps.
// Hooks take a single arg on purpose: a second (`done`) param makes Vue wait for
// a manual callback instead of detecting the CSS transition end.
const shellOf = (el: Element) => (el as HTMLElement).parentElement;

function lockSwapHeight(el: Element): void {
  const shell = shellOf(el);
  if (!shell) {
    return;
  }
  shell.style.overflow = "hidden";
  shell.style.height = `${(el as HTMLElement).offsetHeight}px`;
}

function swapHeightTo(el: Element): void {
  const shell = shellOf(el);
  if (!shell) {
    return;
  }
  shell.style.overflow = "hidden";
  shell.style.height = `${(el as HTMLElement).offsetHeight}px`;
}

function releaseSwapHeight(el: Element): void {
  const shell = shellOf(el);
  if (!shell) {
    return;
  }
  shell.style.height = "";
  shell.style.overflow = "";
}
</script>

<template>
  <div v-if="matchmakingAllowed || (isGuest && matchmakingEnabled)">
    <!-- Deliberately outside the ban/cooldown chain below rather than another
         branch of it: a tournament cooldown bars tournament rosters and the
         free-agent pool and NEVER the queue, so it is reported alongside
         matchmaking instead of standing in for it. -->
    <Alert v-if="tournamentCooldown" class="my-3">
      <AlertDescription class="flex items-center gap-2">
        <AlertTriangle class="h-4 w-4" />
        {{
          isPermanentExpiry(tournamentCooldown) ||
          !formatBanExpiry(tournamentCooldown)
            ? $t("matchmaking.tournament_banned")
            : $t("matchmaking.tournament_banned_until", {
                time: formatBanExpiry(tournamentCooldown),
              })
        }}
      </AlertDescription>
    </Alert>
    <template v-if="me?.is_banned">
      <Alert class="my-3">
        <AlertDescription class="flex items-center gap-2">
          <AlertTriangle class="h-4 w-4" />
          <!-- No date means the ban is permanent, so there is nothing to
               count towards -- fall back to the plain message. -->
          {{
            me.banned_until
              ? $t("matchmaking.banned_until", {
                  time: formatBanExpiry(me.banned_until),
                })
              : $t("matchmaking.banned")
          }}
        </AlertDescription>
      </Alert>
    </template>
    <template v-else-if="me?.matchmaking_cooldown">
      <Alert class="my-3">
        <AlertDescription class="flex items-center gap-2">
          <AlertTriangle class="h-4 w-4" />
          <!-- Separate key rather than a placeholder bolted onto temp_banned:
               every other locale already has that key without a {time} token,
               so reusing it drops the expiry for all of them. -->
          {{
            formatBanExpiry(me.matchmaking_cooldown)
              ? $t("matchmaking.temp_banned_until", {
                  time: formatBanExpiry(me.matchmaking_cooldown),
                })
              : $t("matchmaking.temp_banned")
          }}
        </AlertDescription>
      </Alert>
    </template>
    <template v-else>
      <div class="mm-shell">
        <Transition
          name="mm-swap"
          mode="out-in"
          @before-leave="lockSwapHeight"
          @leave-cancelled="releaseSwapHeight"
          @enter="swapHeightTo"
          @after-enter="releaseSwapHeight"
          @enter-cancelled="releaseSwapHeight"
        >
          <!-- Match found and its connect row live inside the same measured
               shell as the queue panel. They used to sit outside it: the
               confirmation arriving unmounted the whole shell in one frame,
               and until the match subscription answered there was nothing
               rendered at all -- ~500px of queue panel, then a blank, then
               the connect row popping in. -->
          <div v-if="confirmationDetails && match" key="match">
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
          </div>

          <div
            v-else-if="confirmationDetails"
            key="found"
            class="relative overflow-hidden rounded-lg border border-border px-6 py-10 sm:px-10 sm:py-12 [backdrop-filter:blur(6px)] [background:linear-gradient(180deg,hsl(var(--card)/0.7)_0%,hsl(var(--card)/0.3)_100%)]"
          >
            <div class="relative z-10 flex flex-col items-center gap-3 text-center">
              <Spinner />
              <div
                class="inline-flex items-center gap-2 font-mono text-[0.72rem] font-bold uppercase tracking-[0.28em] text-[hsl(var(--tac-amber))]"
              >
                <span
                  class="inline-block h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"
                ></span>
                {{ $t("matchmaking.match_found") }}
              </div>
            </div>
          </div>

          <div
            v-else-if="isInQueue && matchMakingQueueDetails"
            key="queue"
            class="relative overflow-hidden rounded-lg border border-border px-6 py-10 sm:px-10 sm:py-12 [backdrop-filter:blur(6px)] [background:linear-gradient(180deg,hsl(var(--card)/0.7)_0%,hsl(var(--card)/0.3)_100%)]"
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
              class="pointer-events-none absolute inset-0 opacity-40 [background-image:repeating-linear-gradient(180deg,transparent_0,transparent_3px,hsl(var(--tac-amber)/0.04)_3px,hsl(var(--tac-amber)/0.04)_4px)]"
            ></span>

            <span
              aria-hidden="true"
              class="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_50%_55%,hsl(var(--tac-amber)/0.12),transparent_65%)] animate-soft-pulse"
            ></span>

            <span
              aria-hidden="true"
              class="pointer-events-none absolute left-0 right-0 top-0 h-[2px] overflow-hidden"
            >
              <span
                class="tac-scan-sweep block h-full text-[hsl(var(--tac-amber))]"
              ></span>
            </span>

            <div
              class="relative z-10 flex flex-col items-center gap-6 text-center"
            >
              <div
                class="mm-step inline-flex items-center gap-2 font-mono text-[0.72rem] font-bold uppercase tracking-[0.28em] text-[hsl(var(--tac-amber))]"
                :style="{ '--step': 0 }"
              >
                <span
                  class="inline-block h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"
                ></span>
                {{ $t("matchmaking.in_queue_label") }}
                <span
                  class="h-1 w-1 rounded-full bg-[hsl(var(--tac-amber))] animate-soft-pulse"
                ></span>
              </div>

              <div
                class="mm-step flex flex-col items-center gap-1"
                :style="{ '--step': 1 }"
              >
                <div
                  class="font-sans text-2xl font-bold uppercase leading-none tracking-[0.08em] text-foreground sm:text-3xl [font-stretch:80%]"
                >
                  {{ getMatchTypeTitle(matchMakingQueueDetails.type) }}
                </div>
                <div
                  class="font-mono text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground/80"
                >
                  {{ $t("matchmaking.searching") }}
                </div>
              </div>

              <div
                class="mm-step flex flex-col items-center gap-1"
                :style="{ '--step': 2 }"
              >
                <div
                  class="font-mono font-bold leading-none tracking-[0.06em] text-foreground text-[clamp(2.75rem,7vw,4rem)] tabular-nums [text-shadow:0_0_24px_hsl(var(--tac-amber)/0.3)]"
                >
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
                <div
                  class="font-mono text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground/70"
                >
                  {{ $t("matchmaking.elapsed") }}
                </div>
              </div>

              <div
                class="mm-step flex flex-wrap items-center justify-center gap-2"
                :style="{ '--step': 3 }"
              >
                <span
                  v-for="region in matchMakingQueueDetails.regions"
                  :key="region"
                  class="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.08)] px-2.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]"
                >
                  <span
                    class="h-1 w-1 rounded-full bg-[hsl(var(--tac-amber))]"
                  ></span>
                  {{ region }}
                </span>
                <span
                  v-if="
                    distinctInQueue(
                      matchMakingQueueDetails.type,
                      matchMakingQueueDetails.regions,
                    ) > 0
                  "
                  class="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-2.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground"
                >
                  {{
                    distinctInQueue(
                      matchMakingQueueDetails.type,
                      matchMakingQueueDetails.regions,
                    )
                  }}
                  {{ $t("matchmaking.in_queue") }}
                </span>
              </div>

              <button
                type="button"
                class="mm-step group/cancel mt-2 inline-flex w-full max-w-md items-center justify-center gap-2 overflow-hidden rounded-md border border-[hsl(var(--destructive)/0.5)] bg-[hsl(var(--destructive)/0.1)] px-5 py-3 font-sans text-xs font-bold uppercase leading-none tracking-[0.2em] text-destructive transition-[background-color,border-color,box-shadow] duration-150 hover:border-[hsl(var(--destructive)/0.8)] hover:bg-[hsl(var(--destructive)/0.18)] hover:shadow-[0_0_18px_hsl(var(--destructive)/0.3)]"
                :style="{ '--step': 4 }"
                @click="leaveMatchmaking"
              >
                <span
                  class="inline-block h-[2px] w-[10px] bg-destructive transition-transform group-hover/cancel:translate-x-[-2px]"
                ></span>
                {{ $t("matchmaking.cancel_matchmaking") }}
                <span
                  class="inline-block h-[2px] w-[10px] bg-destructive transition-transform group-hover/cancel:translate-x-[2px]"
                ></span>
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-4" v-else key="idle">
            <div
              v-if="
                !isGuest &&
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
                v-for="(type, index) in allowedMatchTypes"
                :key="type.value"
                type="button"
                :disabled="!canQueueType(type.value)"
                :style="{ '--step': index }"
                :class="[
                  mmCardBase,
                  'mm-step transition-all duration-300 ease-out',
                  canQueueType(type.value) && 'hover:scale-[1.015]',
                  !canQueueType(type.value) &&
                    '!cursor-not-allowed opacity-45 grayscale hover:!border-border hover:!shadow-none',
                ]"
                @click="handleMatchTypeClick(type.value)"
              >
                <span
                  class="absolute inset-0 z-0 pointer-events-none opacity-0 transition-opacity [transition-duration:220ms] [transition-timing-function:ease] [background-image:repeating-linear-gradient(180deg,transparent_0,transparent_3px,hsl(var(--tac-amber)/0.03)_3px,hsl(var(--tac-amber)/0.03)_4px)] group-hover/mmc:opacity-100"
                  aria-hidden="true"
                ></span>

                <Badge
                  variant="secondary"
                  class="absolute top-2 right-2 px-2 py-0.5 text-[0.65rem] tracking-[0.12em] uppercase transition-opacity duration-200"
                  v-if="
                    distinctInQueue(
                      type.value,
                      preferredRegions.map((region) => region.value),
                    ) > 0
                  "
                >
                  {{
                    distinctInQueue(
                      type.value,
                      preferredRegions.map((region) => region.value),
                    )
                  }}
                  {{ $t("matchmaking.in_queue") }}
                </Badge>

                <div
                  class="relative z-[1] flex-1 min-w-0 flex flex-col gap-[0.4rem]"
                >
                  <div
                    class="inline-flex items-center gap-[0.55rem] font-mono text-[0.72rem] font-bold tracking-[0.24em] uppercase text-muted-foreground transition-colors [transition-duration:180ms] group-hover/mmc:text-[hsl(var(--tac-amber))]"
                  >
                    <span
                      class="inline-block w-[10px] h-[2px] bg-[hsl(var(--tac-amber))]"
                      aria-hidden="true"
                    ></span>
                    {{ getMatchTypeTitle(type.value) }}
                  </div>
                  <p
                    class="m-0 text-[0.78rem] leading-[1.5] text-muted-foreground"
                  >
                    <template v-if="canQueueType(type.value)">
                      {{
                        $t(
                          `matchmaking.match_types.${type.value.toLowerCase()}.description`,
                        )
                      }}
                    </template>
                    <template v-else>
                      <span class="block font-medium text-destructive">
                        {{
                          $t("matchmaking.party_size.unavailable", {
                            size: partySize,
                          })
                        }}
                      </span>
                      {{
                        $t("matchmaking.party_size.requirement", {
                          half: expectedPlayers(type.value) / 2,
                          full: expectedPlayers(type.value),
                        })
                      }}
                    </template>
                  </p>
                </div>
              </button>
            </div>
          </div>
        </Transition>
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
import {
  EXPECTED_PLAYERS,
  canPartyQueue,
} from "~/utilities/matchmakingPartySize";

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
      e_match_types: [] as {
        value: e_match_types_enum;
        description: string;
      }[],
    };
  },
  methods: {
    getMatchTypeTitle(typeValue: string): string {
      if (!typeValue) return "";
      const key = `matchmaking.match_types.${typeValue.toLowerCase()}.title`;
      return this.$te(key) ? (this.$t(key) as string) : typeValue.toUpperCase();
    },
    isMatchmakingTypeEnabled(matchType: string): boolean {
      return useApplicationSettingsStore().isMatchmakingTypeEnabled(matchType);
    },
    expectedPlayers(type: e_match_types_enum): number {
      return EXPECTED_PLAYERS[type] ?? 0;
    },
    canQueueType(type: e_match_types_enum): boolean {
      return canPartyQueue(type, this.partySize);
    },
    distinctInQueue(type: e_match_types_enum, regionValues: string[]): number {
      const lobbyIndexes = new Set<number>();
      for (const regionValue of regionValues) {
        const indexes = this.regionStats[regionValue]?.[type];
        if (!indexes) {
          continue;
        }
        for (const index of indexes) {
          lobbyIndexes.add(index);
        }
      }
      return lobbyIndexes.size;
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
      if (!this.me?.steam_id) {
        navigateTo("/login?redirect=/play");
        return;
      }
      if (!this.canQueueType(matchType)) {
        toast({
          title: this.$t("matchmaking.party_size.requirement", {
            half: this.expectedPlayers(matchType) / 2,
            full: this.expectedPlayers(matchType),
          }) as string,
          variant: "destructive",
        });
        return;
      }
      if (this.preferredRegions.length === 0) {
        toast({
          title: this.$t("matchmaking.no_preferred_regions") as string,
          variant: "destructive",
        });
        return;
      }
      this.joinMatchmaking(matchType);
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
      return this.e_match_types.filter(
        (type) =>
          type.value !== e_match_types_enum.Premier &&
          type.value !== e_match_types_enum.Faceit &&
          this.isMatchmakingTypeEnabled(type.value.toLowerCase()),
      );
    },
    isInQueue(): boolean {
      return !!this.matchMakingQueueDetails;
    },
    // Only accepted lobby members queue — pending invites don't count, which is
    // how the api sizes the lobby too.
    partySize(): number {
      const lobby = useMatchmakingStore().currentLobby as any;
      const accepted = lobby?.players?.filter(
        (player: { status: string }) => player.status === "Accepted",
      );
      return accepted?.length || 1;
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
    matchMakingQueueDetails(): QueueDetails | undefined {
      return useMatchmakingStore().joinedMatchmakingQueues.details;
    },
    confirmationDetails(): ConfirmationDetails | undefined {
      return useMatchmakingStore().joinedMatchmakingQueues.confirmation;
    },
    matchmakingAllowed(): boolean {
      return useApplicationSettingsStore().matchmakingAllowed;
    },
    matchmakingEnabled(): boolean {
      return useApplicationSettingsStore().matchmakingEnabled;
    },
    me() {
      return useAuthStore().me;
    },
    isGuest(): boolean {
      return !useAuthStore().me?.steam_id;
    },
    queueWaitTime(): string {
      if (!this.matchMakingQueueDetails?.joinedAt)
        return this.$t("matchmaking.queue_wait.zero");

      const joinedAt = new Date(this.matchMakingQueueDetails.joinedAt);
      const now = new Date();
      const diffInSeconds = Math.floor(
        (now.getTime() - joinedAt.getTime()) / 1000,
      );

      if (diffInSeconds < 60) {
        return this.$t("matchmaking.queue_wait.seconds", {
          count: diffInSeconds,
        });
      }

      const minutes = Math.floor(diffInSeconds / 60);
      const seconds = diffInSeconds % 60;
      return this.$t("matchmaking.queue_wait.minutes_seconds", {
        minutes,
        seconds,
      });
    },
  },
};
</script>

<style scoped>
.mm-shell {
  transition: height 320ms cubic-bezier(0.16, 1, 0.3, 1);
}

.mm-swap-enter-active {
  transition:
    opacity 260ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 260ms cubic-bezier(0.16, 1, 0.3, 1),
    filter 260ms ease-out;
}

.mm-swap-leave-active {
  transition:
    opacity 140ms ease-in,
    transform 140ms ease-in,
    filter 140ms ease-in;
}

.mm-swap-enter-from {
  opacity: 0;
  transform: scale(0.97);
  filter: blur(3px);
}

.mm-swap-leave-to {
  opacity: 0;
  transform: scale(0.985);
  filter: blur(3px);
}

/* Staggered reveal — the queue panel (and the card row on cancel) lands as one
   gesture instead of every element appearing at once. */
.mm-step {
  animation: mm-step-in 380ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
  animation-delay: calc(var(--step, 0) * 55ms + 40ms);
}

@keyframes mm-step-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mm-shell,
  .mm-swap-enter-active,
  .mm-swap-leave-active {
    transition: none;
  }

  .mm-swap-enter-from,
  .mm-swap-leave-to {
    transform: none;
    filter: none;
  }

  .mm-step {
    animation: none;
  }
}
</style>
