<script setup lang="ts">
import {
  CheckCheck,
  LifeBuoy,
  MoreVertical,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Scissors,
  Server,
  SlidersHorizontal,
  Square,
  Trash2,
  Trophy,
  XCircle,
  Zap,
} from "lucide-vue-next";
import MatchCameraStatus from "~/components/match/MatchCameraStatus.vue";
import MatchSelectServer from "~/components/match/MatchSelectServer.vue";
import MatchSelectWinner from "~/components/match/MatchSelectWinner.vue";
import DropdownMenuItem from "~/components/ui/dropdown-menu/DropdownMenuItem.vue";
import DropdownMenuLabel from "~/components/ui/dropdown-menu/DropdownMenuLabel.vue";
import {
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  e_match_status_enum,
  e_match_map_status_enum,
  e_player_roles_enum,
} from "~/generated/zeus";

// Dock controls share the admin bar's chip shape so the strip stays one short
// row; the tone says what the button does.
const dockChip =
  "inline-flex items-center gap-2 whitespace-nowrap rounded-md border px-2.5 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em] transition-colors duration-200 ease-out disabled:pointer-events-none disabled:opacity-50";
const dockPrimary = `${dockChip} border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.2)]`;
const dockDanger = `${dockChip} border-[hsl(var(--destructive)/0.45)] text-destructive hover:bg-[hsl(var(--destructive)/0.12)]`;
const dockNeutral = `${dockChip} border-border bg-background/60 text-muted-foreground hover:border-[hsl(var(--tac-amber)/0.4)] hover:text-foreground data-[state=open]:border-[hsl(var(--tac-amber)/0.4)] data-[state=open]:text-foreground`;

const menuLabel =
  "px-2 pb-1 pt-1.5 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground";

const upcomingIcons = {
  veto_override: Zap,
  force_ready: CheckCheck,
  pause: Pause,
  live_stream: Radio,
  highlights: Scissors,
  reparse: RefreshCw,
};
</script>

<template>
  <div
    class="flex gap-2 items-center"
    v-if="dock ? hasDockItems : canAct || canWatchCameras"
  >
    <MatchCameraStatus v-if="canWatchCameras && !dock" :match-id="match.id" />

    <!-- The pause control appears when a map goes live; its column animates
         0fr -> 1fr so the kebab slides over instead of jumping. Both labels
         are always laid out (one invisible), so Pause <-> Resume never
         changes the button's width -- only the colors cross-fade. -->
    <Transition
      enter-active-class="pause-reveal"
      enter-from-class="pause-reveal-collapsed"
      leave-active-class="pause-reveal"
      leave-to-class="pause-reveal-collapsed"
    >
      <div v-if="canPauseResume && !dock" class="grid min-w-0 grid-cols-[1fr]">
        <div class="min-w-0 overflow-hidden">
          <Button
            size="sm"
            variant="outline"
            @click="togglePause"
            :disabled="!match.is_server_online"
            :class="[
              'h-9 gap-1.5 font-mono text-[0.62rem] font-bold tracking-[0.18em] uppercase transition-colors',
              isPaused
                ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.2)] hover:text-[hsl(var(--tac-amber))]'
                : 'border-[hsl(var(--destructive)/0.55)] bg-[hsl(var(--destructive)/0.12)] text-destructive hover:bg-[hsl(var(--destructive)/0.2)] hover:text-destructive',
            ]"
          >
            <component :is="isPaused ? Play : Pause" class="h-3 w-3" />
            <span class="grid text-center">
              <span
                class="col-start-1 row-start-1"
                :class="{ invisible: isPaused }"
                :aria-hidden="isPaused"
              >
                {{ $t("match.actions.pause") }}
              </span>
              <span
                class="col-start-1 row-start-1"
                :class="{ invisible: !isPaused }"
                :aria-hidden="!isPaused"
              >
                {{ $t("match.actions.resume") }}
              </span>
            </span>
          </Button>
        </div>
      </div>
    </Transition>

    <!-- Admin dock: the current step's main action, then Cancel and Delete out
         front. The veto step's main action, Veto Override, lives in the bar. -->
    <template v-if="dock">
      <button
        v-if="primaryAction === 'start'"
        type="button"
        :class="dockPrimary"
        :disabled="!hasMinimumLineupPlayers"
        @click="startMatch"
      >
        <Play class="h-3 w-3 shrink-0" />
        {{ startLabel }}
      </button>
      <button
        v-else-if="primaryAction === 'force_ready'"
        type="button"
        :class="dockPrimary"
        @click="forceReady"
      >
        <CheckCheck class="h-3 w-3 shrink-0" />
        {{ $t("match.commands.force_ready") }}
      </button>
      <button
        v-else-if="primaryAction === 'pause'"
        type="button"
        :class="dockPrimary"
        :disabled="!match.is_server_online"
        @click="togglePause"
      >
        <component :is="isPaused ? Play : Pause" class="h-3 w-3 shrink-0" />
        {{ isPaused ? $t("match.actions.resume") : $t("match.actions.pause") }}
      </button>
      <button
        v-else-if="primaryAction === 'winner'"
        type="button"
        :class="dockPrimary"
        @click="openWinnerDialog"
      >
        <Trophy class="h-3 w-3 shrink-0" />
        {{ $t("match.winner.set") }}
      </button>

      <button
        v-if="match.can_cancel"
        type="button"
        :class="dockDanger"
        @click="confirmCancel"
      >
        <XCircle class="h-3 w-3 shrink-0" />
        <span class="sr-only sm:not-sr-only">
          {{ $t("match.actions.cancel") }}
        </span>
      </button>
      <button
        v-if="canDeleteMatch"
        type="button"
        :class="dockDanger"
        @click="confirmDelete"
      >
        <Trash2 class="h-3 w-3 shrink-0" />
        <span class="sr-only sm:not-sr-only">
          {{ $t("match.actions.delete") }}
        </span>
      </button>
    </template>

    <DropdownMenu v-if="!dock || hasMoreItems">
      <DropdownMenuTrigger as-child>
        <button v-if="dock" type="button" :class="dockNeutral">
          <SlidersHorizontal class="h-3 w-3 shrink-0" />
          <span class="sr-only sm:not-sr-only">
            {{ $t("match.admin_bar.actions") }}
          </span>
        </button>
        <Button v-else size="icon" variant="outline">
          <MoreVertical class="h-3.5 w-3.5" />
          <span class="sr-only">{{ $t("common.more") }}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        :side="dock ? 'top' : 'bottom'"
        :class="dock && 'min-w-60'"
      >
        <template v-if="match.is_in_lineup && !dock">
          <DropdownMenuItem
            class="text-destructive"
            @click="callForOrganizer"
            :disabled="match.requested_organizer"
          >
            <LifeBuoy />
            {{ $t("match.actions.call_support") }}
          </DropdownMenuItem>
          <DropdownMenuSeparator
            v-if="match.can_assign_server || match.is_organizer"
          />
        </template>

        <DropdownMenuItem
          v-if="match.can_assign_server"
          @click="openServerDialog"
        >
          <Server />
          {{ $t("match.server.assign") }}…
        </DropdownMenuItem>

        <DropdownMenuItem
          v-if="canSetMatchWinner && primaryAction !== 'winner'"
          @click="openWinnerDialog"
        >
          <Trophy />
          {{ $t("match.winner.set") }}…
        </DropdownMenuItem>

        <template v-if="match.is_organizer && hasOrganizerLiveActions">
          <DropdownMenuSeparator class="first:hidden" />
          <!-- "Start" only shows when there's nothing running. Once
               a Job exists (booting OR live), the only remaining
               action is to stop it — booting needs to be cancellable
               so a stuck/wrong-server start can be undone.

               Two modes:
               - "live"  — direct game-port observer connect, no GOTV delay
               - "tv"    — GOTV/Playcast, honors tv_delay (default ~115s) -->
          <DropdownMenuItem
            v-if="gameStreamerStatus === 'off' && canSwitchHere"
            :disabled="switching || !match.is_server_online"
            @click="switchHere"
          >
            <Radio class="text-muted-foreground" />
            <span>{{ $t("match.actions.switch_stream_here") }}</span>
          </DropdownMenuItem>
          <DropdownMenuSub v-else-if="gameStreamerStatus === 'off'">
            <Tooltip v-if="liveStartDisabledReason">
              <TooltipTrigger as-child>
                <DropdownMenuSubTrigger disabled>
                  <Radio class="text-muted-foreground" />
                  <span>{{ $t("match.actions.start_live") }}</span>
                </DropdownMenuSubTrigger>
              </TooltipTrigger>
              <TooltipContent side="left">
                {{ liveStartDisabledReason }}
              </TooltipContent>
            </Tooltip>
            <DropdownMenuSubTrigger v-else>
              <Radio class="text-muted-foreground" />
              <span>{{
                canPreemptHighlights
                  ? $t("match.actions.pause_highlights_and_start_live")
                  : $t("match.actions.start_live")
              }}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent class="w-64">
              <DropdownMenuItem
                :disabled="!canStartLiveDirect"
                class="flex flex-col items-start gap-0.5"
                @click="startLive('live')"
              >
                <span>{{ $t("match.actions.start_live_direct") }}</span>
                <span class="text-xs text-muted-foreground">
                  {{
                    canPreemptHighlights
                      ? $t("match.actions.start_live_preempt_highlights_hint")
                      : gpuBlocksAction
                        ? gpuBusyReason || $t("stream_status.gpu_busy")
                        : $t("match.actions.start_live_direct_hint")
                  }}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                :disabled="!canStartLiveTv"
                class="flex flex-col items-start gap-0.5"
                @click="startLive('tv')"
              >
                <span>{{ $t("match.actions.start_live_tv") }}</span>
                <span class="text-xs text-muted-foreground">
                  {{
                    canPreemptHighlights
                      ? $t("match.actions.start_live_preempt_highlights_hint")
                      : gpuBlocksAction
                        ? gpuBusyReason || $t("stream_status.gpu_busy")
                        : canStartLiveTv
                          ? $t("match.actions.start_live_tv_hint")
                          : $t("match.actions.start_live_waiting_tv")
                  }}
                </span>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem
            v-if="gameStreamerStatus !== 'off'"
            class="text-destructive"
            @click="stopLive"
          >
            <Square />
            <template v-if="gameStreamerStatus === 'pending'">
              <div class="flex flex-col items-start leading-tight">
                <span>{{ $t("match.actions.cancel_live_pending") }}</span>
                <span class="text-xs text-muted-foreground mt-0.5">
                  {{ $t("match.actions.live_pending_hint") }}
                </span>
              </div>
            </template>
            <template v-else-if="gameStreamerStatus === 'booting'">
              <div class="flex flex-col items-start leading-tight">
                <span>{{ $t("match.actions.cancel_live_boot") }}</span>
                <span
                  v-if="gameStreamerStatusLine"
                  class="text-xs text-muted-foreground mt-0.5"
                  :class="
                    gameStreamerRow?.status === 'errored'
                      ? 'text-destructive'
                      : ''
                  "
                >
                  {{ gameStreamerStatusLine }}
                </span>
              </div>
            </template>
            <template v-else>
              {{ $t("match.actions.stop_live") }}
            </template>
          </DropdownMenuItem>
          <Tooltip v-if="canCreateClips && !hasRegisteredGpu">
            <TooltipTrigger as-child>
              <DropdownMenuItem disabled>
                <Scissors />
                {{ $t("match.actions.create_clips") }}
              </DropdownMenuItem>
            </TooltipTrigger>
            <TooltipContent side="left">
              {{ $t("match.actions.create_clips_needs_gpu_node") }}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuItem
            v-else-if="canCreateClips"
            @click="createClipsForMatch"
          >
            <Scissors />
            {{ $t("match.actions.create_clips") }}
          </DropdownMenuItem>
          <Tooltip v-if="hasPausedRenders && resumeRendersBlockedReason">
            <TooltipTrigger as-child>
              <DropdownMenuItem disabled>
                <Play />
                <div class="flex flex-col items-start leading-tight">
                  <span>{{ $t("match.actions.resume_renders") }}</span>
                  <span class="text-xs text-muted-foreground mt-0.5">
                    {{ resumeRendersBlockedReason }}
                  </span>
                </div>
              </DropdownMenuItem>
            </TooltipTrigger>
            <TooltipContent side="left">
              {{ resumeRendersBlockedReason }}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuItem v-else-if="hasPausedRenders" @click="resumeRenders">
            <Play />
            <div class="flex flex-col items-start leading-tight">
              <span>{{ $t("match.actions.resume_renders") }}</span>
              <span class="text-xs text-muted-foreground mt-0.5">
                {{ $t("match.actions.resume_renders_hint") }}
              </span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            v-else-if="hasInFlightRenders"
            @click="pauseRenders"
          >
            <Pause />
            <div class="flex flex-col items-start leading-tight">
              <span>{{ $t("match.actions.pause_renders") }}</span>
              <span class="text-xs text-muted-foreground mt-0.5">
                {{ $t("match.actions.pause_renders_hint") }}
              </span>
            </div>
          </DropdownMenuItem>
        </template>

        <DropdownMenuSeparator
          v-if="
            canReparseDemos ||
            showForceReadyItem ||
            showStartItem ||
            (!dock && (match.can_cancel || canDeleteMatch))
          "
          class="first:hidden"
        />

        <DropdownMenuItem v-if="canReparseDemos" @click="reparseAllDemos">
          <RefreshCw />
          {{ $t("match.actions.reparse_demos") }}
        </DropdownMenuItem>

        <DropdownMenuItem v-if="showForceReadyItem" @click="forceReady">
          <CheckCheck />
          {{ $t("match.commands.force_ready") }}
        </DropdownMenuItem>

        <template v-if="showStartItem">
          <DropdownMenuItem
            @click.prevent.stop="startMatch"
            class="text-destructive"
            :disabled="!hasMinimumLineupPlayers"
          >
            <Play />
            {{ startLabel }}
          </DropdownMenuItem>
        </template>

        <template v-if="!dock && match.can_cancel">
          <DropdownMenuItem class="text-destructive" @click="confirmCancel">
            <XCircle />
            {{ $t("match.actions.cancel") }}
          </DropdownMenuItem>
        </template>

        <template v-if="!dock && canDeleteMatch">
          <DropdownMenuItem class="text-destructive" @click="confirmDelete">
            <Trash2 />
            {{ $t("match.actions.delete") }}
          </DropdownMenuItem>
        </template>

        <!-- What unlocks at later steps, limited to what this role can ever
             use, so nothing shows up out of nowhere. -->
        <template v-if="dock && upcoming.length">
          <DropdownMenuSeparator class="first:hidden" />
          <DropdownMenuLabel :class="menuLabel">
            {{ $t("match.admin_bar.coming_up") }}
          </DropdownMenuLabel>
          <DropdownMenuItem
            v-for="action of upcoming"
            :key="action.key"
            disabled
          >
            <component :is="upcomingIcons[action.key]" />
            {{ $t(action.label) }}
            <span
              class="ml-auto rounded-sm border border-dashed border-border px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.12em]"
            >
              {{ $t(`match.admin_bar.steps.${action.step}`) }}
            </span>
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenu>

    <!-- One confirm for every consequential item. It lives outside the menu so
         it survives the menu closing as the dialog takes focus. -->
    <AlertDialog
      :open="confirmOpen"
      @update:open="(open) => !open && !confirmBusy && (confirmOpen = false)"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ confirming?.title }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ confirming?.description }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <MatchSelectServer
          v-if="confirming?.picker === 'server'"
          :match="match"
          @select="(choice) => (confirmChoice = choice)"
        />
        <MatchSelectWinner
          v-else-if="confirming?.picker === 'winner'"
          :match="match"
          @select="(choice) => (confirmChoice = choice)"
        />
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="confirmBusy">
            {{ $t("common.cancel") }}
          </AlertDialogCancel>
          <!-- Plain button: AlertDialogAction closes the dialog before an
               async click handler gets to run. -->
          <Button
            :variant="confirming?.destructive ? 'destructive' : 'default'"
            :disabled="confirmBusy || (!!confirming?.picker && !confirmChoice)"
            @click="runConfirm"
          >
            {{ confirming?.action }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script lang="ts">
import { generateMutation, generateSubscription } from "~/graphql/graphqlGen";
import gql from "graphql-tag";
import { toast } from "@/components/ui/toast";

const PAUSE_CLIP_RENDER_BATCH = gql`
  mutation PauseClipRenderBatch($match_map_id: uuid!) {
    pauseClipRenderBatch(match_map_id: $match_map_id) {
      success
    }
  }
`;

const RESUME_CLIP_RENDER_BATCH = gql`
  mutation ResumeClipRenderBatch($match_map_id: uuid!) {
    resumeClipRenderBatch(match_map_id: $match_map_id) {
      success
    }
  }
`;
import socket from "~/web-sockets/Socket";
import { v4 as uuidv4 } from "uuid";
import { useGpuPoolStatusStore } from "~/stores/GpuPoolStatusStore";
import { useStreamerStore } from "~/stores/StreamerStore";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { canWatchMatchCameras } from "~/composables/useMatchCameraStatus";
import {
  RconAction,
  matchCommandsForStatus,
  resolveRconCommand,
  effectivePluginRuntime,
} from "~/constants/rconCommands";
import {
  currentMatchAdminStep,
  upcomingAdminActions,
} from "~/utilities/matchAdminSteps";
type MatchActionChoice = { value: string; label: string };

type MatchActionConfirm = {
  title: string;
  description: string;
  action: string;
  destructive?: boolean;
  // Server and winner dialogs carry their picker; the action waits for a pick.
  picker?: "server" | "winner";
  run: (choice: MatchActionChoice | null) => Promise<void>;
};

export default {
  inject: {
    refetchMatchStatic: {
      default: () => () => {},
    },
  },
  props: {
    match: {
      type: Object,
      required: true,
    },
    // The admin dock's copy: organizer items only, behind a labeled chip that
    // opens upward. The camera chip, pause button and support call stay in
    // the header.
    dock: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      confirmOpen: false,
      confirmBusy: false,
      confirming: null as MatchActionConfirm | null,
      confirmChoice: null as MatchActionChoice | null,
      rconUuid: undefined as string | undefined,
      rconSuccessTitle: "",
      switching: false,
      renderSummary: [] as Array<{
        match_map_id: string;
        in_flight: number;
        paused: number;
      }>,
      renderSummarySub: undefined as { unsubscribe: () => void } | undefined,
      startingMatch: false,
      cancellingMatch: false,
      deletingMatch: false,
      togglingLive: false,
    };
  },
  created() {
    this.rconUuid = uuidv4();
    socket.on("rcon", this.onRconResponse);
  },
  beforeUnmount() {
    socket.removeListener("rcon", this.onRconResponse);
    this.renderSummarySub?.unsubscribe();
  },
  watch: {
    renderSummaryScope: {
      immediate: true,
      handler() {
        this.renderSummarySub?.unsubscribe();
        this.renderSummarySub = undefined;
        this.renderSummary = [];
        this.subscribeRenderSummary();
      },
    },
  },
  methods: {
    ask(confirming: MatchActionConfirm) {
      this.confirming = confirming;
      this.confirmChoice = null;
      this.confirmOpen = true;
    },
    async runConfirm() {
      if (this.confirmBusy || !this.confirming) {
        return;
      }
      this.confirmBusy = true;
      try {
        await this.confirming.run(this.confirmChoice);
        this.confirmOpen = false;
      } finally {
        this.confirmBusy = false;
      }
    },
    confirmCancel() {
      this.ask({
        title: this.$t("match.actions.cancel"),
        description: this.$t("match.cancel_confirm.description"),
        action: this.$t("match.actions.cancel"),
        destructive: true,
        run: this.cancelMatch,
      });
    },
    confirmDelete() {
      this.ask({
        title: this.$t("match.delete_confirm.title"),
        description: this.$t("match.delete_confirm.description"),
        action: this.$t("common.delete"),
        destructive: true,
        run: this.deleteMatch,
      });
    },
    openServerDialog() {
      this.ask({
        title: this.$t("match.server.assign"),
        description: this.$t("match.server.assign_hint"),
        action: this.$t("match.server.assign"),
        picker: "server",
        run: async (choice) => {
          if (choice) {
            await this.assignServer(choice.value);
          }
        },
      });
    },
    openWinnerDialog() {
      this.ask({
        title: this.$t("match.winner.set"),
        description: this.$t("match.winner.set_hint"),
        action: this.$t("match.winner.set"),
        picker: "winner",
        run: async (choice) => {
          if (choice) {
            await this.setWinner(choice.value);
          }
        },
      });
    },
    // "0:<region>" is an on-demand server in that region; anything else is a
    // dedicated server id.
    async assignServer(value: string) {
      const [serverId, region] = value.split(":");

      await this.$apollo.mutate({
        mutation: generateMutation({
          update_matches_by_pk: [
            {
              pk_columns: {
                id: this.match.id,
              },
              _set: {
                region,
                server_id: serverId === "0" ? null : value,
              },
            },
            {
              id: true,
            },
          ],
        }),
      });

      toast({
        title: this.$t("match.server.assigned"),
      });
    },
    // Goes through setMatchWinner rather than writing winning_lineup_id
    // directly: the action is what enforces organizer permission and blocks a
    // reassignment once a downstream tournament match has already been
    // played. A direct mutation skips both.
    async setWinner(lineupId: string) {
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            setMatchWinner: [
              {
                match_id: this.match.id,
                winning_lineup_id: lineupId,
              },
              {
                success: true,
              },
            ],
          }),
        });
      } catch (error) {
        toast({
          title: this.$t("match.winner.set_failed"),
          description: (error as Error)?.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: this.$t("match.winner.set"),
      });
    },
    async cancelMatch() {
      if (this.cancellingMatch) {
        return;
      }
      this.cancellingMatch = true;
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            cancelMatch: [
              {
                match_id: this.match.id,
              },
              {
                success: true,
              },
            ],
          }),
        });

        toast({
          title: this.$t("match.actions.canceled"),
        });
      } finally {
        this.cancellingMatch = false;
      }
    },
    async deleteMatch() {
      if (this.deletingMatch) {
        return;
      }
      this.deletingMatch = true;
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            deleteMatch: [{ match_id: this.match.id }, { success: true }],
          }),
        });

        toast({
          title: this.$t("match.actions.deleted"),
        });

        // Admins are usually deleting a match they were playing in, so send
        // them back to /play rather than the matches list.
        if (useAuthStore().isRoleAbove(e_player_roles_enum.administrator)) {
          navigateTo("/play");
        } else {
          this.$router.push({
            name: "matches",
          });
        }
      } finally {
        this.deletingMatch = false;
      }
    },
    async startMatch() {
      if (this.startingMatch) {
        return;
      }
      this.startingMatch = true;
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            startMatch: [
              {
                match_id: this.match.id,
              },
              {
                success: true,
              },
            ],
          }),
        });
      } finally {
        this.startingMatch = false;
      }
    },
    async startLive(mode: "live" | "tv") {
      if (this.togglingLive) {
        return;
      }
      this.togglingLive = true;
      try {
        try {
          await this.$apollo.mutate({
            mutation: generateMutation({
              startLive: [{ match_id: this.match.id, mode }, { success: true }],
            }),
          });
          toast({ title: this.$t("match.actions.live_started") });
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: this.$t("common.error"),
            description: error?.message,
          });
        }
      } finally {
        this.togglingLive = false;
      }
    },
    async stopLive() {
      if (this.togglingLive) {
        return;
      }
      this.togglingLive = true;
      try {
        try {
          await this.$apollo.mutate({
            mutation: generateMutation({
              stopLive: [{ match_id: this.match.id }, { success: true }],
            }),
          });
          toast({ title: this.$t("match.actions.live_stopped") });
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: this.$t("common.error"),
            description: error?.message,
          });
        }
      } finally {
        this.togglingLive = false;
      }
    },
    async reparseAllDemos() {
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            reparseMatchDemos: [{ match_id: this.match.id }, { success: true }],
          }),
        });
        toast({ title: this.$t("match.actions.reparse_demos_started") });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      }
    },
    subscribeRenderSummary() {
      // Guests have no select permission on clip_render_jobs, and RetryLink
      // would retry the rejected subscription up to 30 times.
      if (!useAuthStore().me) {
        return;
      }
      const mapIds = (this.match?.match_maps ?? [])
        .map((m: any) => m?.id)
        .filter((id: any) => !!id);
      if (mapIds.length === 0) return;
      const sub = (this as any).$apollo
        .subscribe({
          query: generateSubscription({
            clip_render_jobs: [
              {
                where: {
                  match_map_id: { _in: mapIds },
                  status: { _in: ["queued", "rendering", "uploading"] },
                },
              },
              {
                match_map_id: true,
                status: true,
                paused: true,
              },
            ],
          }),
        })
        .subscribe({
          next: ({ data }: any) => {
            const byMap = new Map<
              string,
              { match_map_id: string; in_flight: number; paused: number }
            >();
            for (const r of (data?.clip_render_jobs ?? []) as Array<{
              match_map_id: string;
              paused: boolean;
            }>) {
              const id = String(r.match_map_id);
              const bucket = byMap.get(id) ?? {
                match_map_id: id,
                in_flight: 0,
                paused: 0,
              };
              bucket.in_flight += 1;
              if (r.paused) bucket.paused += 1;
              byMap.set(id, bucket);
            }
            this.renderSummary = Array.from(byMap.values());
          },
          error: (error: any) => {
            console.error("[match-actions] render summary sub:", error);
          },
        });
      this.renderSummarySub = sub;
    },
    async switchHere() {
      if (this.switching) return;
      const from = this.activeStreamElsewhere?.match_id;
      if (!from) return;
      this.switching = true;
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            switchLiveMatch: [
              {
                from_match_id: from,
                to_match_id: this.match.id,
                mode: "live",
              },
              { success: true },
            ],
          }),
        });
        toast({ title: this.$t("match.actions.live_switched") });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      } finally {
        this.switching = false;
      }
    },
    async pauseRenders() {
      try {
        await this.$apollo.mutate({
          mutation: PAUSE_CLIP_RENDER_BATCH,
          variables: { match_map_id: this.firstInFlightRenderMatchMapId },
        });
        toast({ title: this.$t("match.actions.pause_renders_started") });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      }
    },
    async resumeRenders() {
      try {
        await this.$apollo.mutate({
          mutation: RESUME_CLIP_RENDER_BATCH,
          variables: { match_map_id: this.firstPausedRenderMatchMapId },
        });
        toast({ title: this.$t("match.actions.resume_renders_started") });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      }
    },
    async createClipsForMatch() {
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            createClips: [{ match_id: this.match.id }, { success: true }],
          }),
        });
        toast({ title: this.$t("match.actions.clips_started") });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      }
    },
    onRconResponse(data: any) {
      if (data.uuid !== this.rconUuid) {
        return;
      }
      if (data.result === "unable to connect to rcon") {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
        });
      } else {
        toast({ title: this.rconSuccessTitle });
      }
    },
    // The success title is fixed at send time: by the time the reply lands,
    // the map status may already have flipped.
    sendRcon(action: RconAction, successTitle: string) {
      const pluginRuntime = effectivePluginRuntime(
        this.match.server_plugin_runtime,
        useApplicationSettingsStore().gameServerPluginRuntime,
      );
      this.rconUuid = uuidv4();
      this.rconSuccessTitle = successTitle;
      socket.event("rcon", {
        uuid: this.rconUuid,
        serverId: this.match.server_id,
        command: resolveRconCommand(action, pluginRuntime),
      });
    },
    togglePause() {
      this.sendRcon(
        this.isPaused ? RconAction.Resume : RconAction.Pause,
        this.isPaused
          ? this.$t("match.actions.match_resumed")
          : this.$t("match.actions.match_paused"),
      );
    },
    forceReady() {
      this.sendRcon(
        RconAction.ForceReady,
        this.$t("match.actions.forced_ready"),
      );
    },
    async callForOrganizer() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          callForOrganizer: [{ match_id: this.match.id }, { success: true }],
        }),
      });

      // requested_organizer is what disables this item, and it is read from
      // the match's static half rather than the subscription.
      await this.refetchMatchStatic();

      toast({
        title: this.$t("match.actions.requested_organizer"),
      });
    },
  },
  computed: {
    renderSummaryScope() {
      return `${this.match?.id ?? ""}:${useAuthStore().me?.steam_id ?? ""}`;
    },
    canAct() {
      return this.match.is_in_lineup || this.match.is_organizer;
    },
    canSetMatchWinner() {
      return (
        this.match.is_organizer &&
        useAuthStore().isRoleAbove(e_player_roles_enum.match_organizer)
      );
    },
    isLive() {
      return this.match.status === e_match_status_enum.Live;
    },
    hasMatchDemos() {
      return (this.match.match_maps ?? []).some(
        (m: any) => (m?.demos?.length ?? 0) > 0,
      );
    },
    hasOrganizerLiveActions() {
      return this.isLive || this.hasMatchDemos;
    },
    // The dock's one main button for the current step. The veto step's,
    // Veto Override, is rendered by the admin bar itself.
    primaryAction() {
      if (!this.dock) {
        return null;
      }
      switch (currentMatchAdminStep(this.match)) {
        case "check_in":
          return this.match.can_start ? "start" : null;
        case "warmup":
          return this.canForceReady ? "force_ready" : null;
        case "live":
          return this.canPauseResume ? "pause" : null;
        case "finished":
          return this.canSetMatchWinner ? "winner" : null;
      }
      return null;
    },
    startLabel() {
      return this.match.options?.map_veto &&
        this.match.options.best_of != this.match.match_maps?.length
        ? this.$t("match.actions.start_veto")
        : this.$t("match.actions.skip_checkin");
    },
    showStartItem() {
      return this.match.can_start && this.primaryAction !== "start";
    },
    showForceReadyItem() {
      return this.canForceReady && this.primaryAction !== "force_ready";
    },
    upcoming() {
      return this.dock
        ? upcomingAdminActions(this.match, (role) =>
            useAuthStore().isRoleAbove(role),
          )
        : [];
    },
    // Everything the dock's More actions menu would list.
    hasMoreItems() {
      return (
        this.match.can_assign_server ||
        (this.canSetMatchWinner && this.primaryAction !== "winner") ||
        (this.match.is_organizer && this.hasOrganizerLiveActions) ||
        this.canReparseDemos ||
        this.showForceReadyItem ||
        this.showStartItem ||
        this.upcoming.length > 0
      );
    },
    hasDockItems() {
      return (
        !!this.primaryAction ||
        this.match.can_cancel ||
        this.canDeleteMatch ||
        this.hasMoreItems
      );
    },
    activeStreamElsewhere() {
      const streams = useStreamerStore().liveStreams ?? [];
      return streams.find(
        (s: any) =>
          s?.is_game_streamer &&
          s.match_id &&
          s.match_id !== this.match.id &&
          s.status !== "pending" &&
          s.status !== "errored",
      );
    },
    canSwitchHere() {
      return (
        this.isLive &&
        !!this.match.is_server_online &&
        !!this.activeStreamElsewhere
      );
    },
    hasInFlightRenders() {
      return (this.renderSummary ?? []).some((s) => (s?.in_flight ?? 0) > 0);
    },
    hasPausedRenders() {
      return (this.renderSummary ?? []).some((s) => (s?.paused ?? 0) > 0);
    },
    resumeRendersBlockedReason() {
      const gpu = useGpuPoolStatusStore();
      if (!gpu.hasLoaded) return null;
      const s = gpu.status as { live_in_progress?: boolean } | null;
      if (s?.live_in_progress) {
        return this.$t("clips.render_queue.resume_blocked_live");
      }
      return null;
    },
    firstInFlightRenderMatchMapId() {
      return (
        (this.renderSummary ?? []).find((s) => (s?.in_flight ?? 0) > 0)
          ?.match_map_id ?? null
      );
    },
    firstPausedRenderMatchMapId() {
      return (
        (this.renderSummary ?? []).find((s) => (s?.paused ?? 0) > 0)
          ?.match_map_id ?? null
      );
    },
    // Direct (live) mode: the streamer pod joins the game port as an
    // observer with no GOTV delay. Available the moment the match goes
    // Live and the server is up — `can_stream_live` is the SQL truth.
    gpuBlocksAction() {
      const gpu = useGpuPoolStatusStore();
      return gpu.hasLoaded && !gpu.getAvailability("streaming").hasFree;
    },
    gpuBusyReason() {
      const gpu = useGpuPoolStatusStore();
      const key = gpu.getAvailability("streaming").busyReasonKey;
      return key ? this.$t(key) : null;
    },
    canPreemptHighlights() {
      const gpu = useGpuPoolStatusStore();
      if (!gpu.hasLoaded) return false;
      const streaming = gpu.getAvailability("streaming");
      if (streaming.hasFree) return false;
      return streaming.busyReasonKey === "gpu_pool_status.highlights_busy";
    },
    // Highlight queueing only needs a GPU node to *exist* (offline is OK).
    // hasFreeGpu collapses to false when the GPU is offline too, which is
    // why we use a separate "is there any GPU registered" signal here.
    hasRegisteredGpu() {
      const gpu = useGpuPoolStatusStore();
      if (!gpu.hasLoaded) return true;
      return gpu.hasRegisteredGpu;
    },
    canStartLiveDirect() {
      return (
        !!this.match.can_stream_live &&
        !!this.match.is_server_online &&
        (!this.gpuBlocksAction || this.canPreemptHighlights)
      );
    },
    liveStartDisabledReason() {
      if (this.canStartLiveDirect || this.canStartLiveTv) return null;
      if (this.activeStreamElsewhere)
        return this.$t("match.actions.live_busy_elsewhere");
      if (this.gpuBlocksAction)
        return this.gpuBusyReason || this.$t("stream_status.gpu_busy");
      if (!this.match.is_server_online)
        return this.$t("match.actions.server_offline");
      return this.$t("match.actions.live_unavailable");
    },
    // TV mode: GOTV/Playcast path. Both `can_stream_tv` and
    // `tv_connection_string` come back null for organizers who are also
    // in the match (Hasura row perms gate connection details to
    // non-participants), so neither can drive the gate. TV doesn't
    // conflict with players occupying game-port slots, so we just
    // require a Live match on a reachable server — the streamer pod
    // handles the `tv_delay` wait on its own and retries until GOTV
    // accepts the connection.
    canStartLiveTv() {
      return (
        this.isLive &&
        !!this.match.is_server_online &&
        (!this.gpuBlocksAction || this.canPreemptHighlights)
      );
    },
    gameStreamerStatus() {
      const row = (this.match.streams ?? []).find(
        (s: any) => s.is_game_streamer,
      );
      if (!row) return "off";
      if (row.status === "pending") return "pending";
      return row.is_live ? "live" : "booting";
    },
    gameStreamerRow() {
      return (this.match.streams ?? []).find((s: any) => s.is_game_streamer);
    },
    // Sub-line under "Cancel Live Stream" while the streamer pod is
    // booting. Mirrors the pod's `status` text so the operator can see
    // exactly which boot step is running ("Installing CS2…", "Logging
    // in…", etc) — and the error message if the pod reported errored.
    gameStreamerStatusLine() {
      const row = this.gameStreamerRow as any;
      if (!row) return "";
      if (row.status === "errored") {
        return row.error_message || "errored";
      }
      const status = row.status as string | undefined;
      if (!status) return "";
      // Same stages as the live-stream badge — reuse live_stages.* instead of
      // re-stating them in English here.
      const known = [
        "launching_steam",
        "logging_in",
        "downloading_cs2",
        "launching_cs2",
        "connecting_to_game",
      ];
      if (known.includes(status)) return `${this.$t(`live_stages.${status}`)}…`;
      if (status === "starting_capture")
        return `${this.$t("stream_deck_status.starting_capture")}…`;
      return status;
    },
    currentMap() {
      return this.match.match_maps?.find((m: any) => m.is_current_map);
    },
    isPaused() {
      return this.currentMap?.status === e_match_map_status_enum.Paused;
    },
    // Same rule as the console's Force Ready, narrowed to when it can act: the
    // current map is warming up on a live, reachable server.
    canForceReady() {
      return (
        this.match.is_organizer &&
        this.isLive &&
        !!this.match.is_server_online &&
        useAuthStore().isRoleAbove(e_player_roles_enum.moderator) &&
        matchCommandsForStatus(this.currentMap?.status).some(
          (command) => command.action === RconAction.ForceReady,
        )
      );
    },
    canPauseResume() {
      if (!this.match.is_organizer) {
        return false;
      }
      // Pause and resume are RCON commands, which the api runs only for
      // moderators and above.
      if (!useAuthStore().isRoleAbove(e_player_roles_enum.moderator)) {
        return false;
      }
      if (this.match.status !== e_match_status_enum.Live) {
        return false;
      }
      const status = this.currentMap?.status;
      return (
        status === e_match_map_status_enum.Live ||
        status === e_match_map_status_enum.Overtime ||
        status === e_match_map_status_enum.Paused
      );
    },
    canDeleteMatch() {
      return (
        this.match.status !== e_match_status_enum.Live &&
        useAuthStore().isRoleAbove(e_player_roles_enum.administrator)
      );
    },
    // One shared rule, mirroring CameraService.watchScope. This used to be a
    // second hand-rolled copy and it had already drifted from the one in
    // useMatchCameraStatus.
    canWatchCameras() {
      return canWatchMatchCameras(this.match);
    },
    // Reparse-all is admin-only (matches the Hasura action permission) and
    // only meaningful once at least one demo has been uploaded somewhere in
    // the match — otherwise the action handler throws "no demos for this match".
    canReparseDemos() {
      return (
        this.hasMatchDemos &&
        useAuthStore().isRoleAbove(e_player_roles_enum.administrator)
      );
    },
    canCreateClips() {
      return (
        this.hasMatchDemos &&
        useAuthStore().isRoleAbove(e_player_roles_enum.administrator)
      );
    },
    hasMinimumLineupPlayers() {
      return (
        this.match.lineup_1?.lineup_players.length >=
          this.match.min_players_per_lineup &&
        this.match.lineup_2?.lineup_players.length >=
          this.match.min_players_per_lineup
      );
    },
  },
};
</script>

<style scoped>
/* The pause control's column collapses to a true zero -- the cell carries no
   padding of its own, so nothing is left to snap when the element unmounts. */
.pause-reveal {
  transition:
    grid-template-columns 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.18s ease;
}
.pause-reveal-collapsed {
  grid-template-columns: 0fr;
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .pause-reveal {
    transition-duration: 1ms;
  }
}
</style>
