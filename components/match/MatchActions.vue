<script setup lang="ts">
import { MoreVertical, Radio } from "lucide-vue-next";
import MatchSelectServer from "~/components/match/MatchSelectServer.vue";
import MatchSelectWinner from "~/components/match/MatchSelectWinner.vue";
import DropdownMenuItem from "~/components/ui/dropdown-menu/DropdownMenuItem.vue";
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
import MatchLobbyAccess from "./MatchLobbyAccess.vue";
import {
  e_match_status_enum,
  e_match_map_status_enum,
  e_player_roles_enum,
} from "~/generated/zeus";
</script>

<template>
  <div class="flex gap-2 items-center" v-if="canAct">
    <MatchLobbyAccess
      :match="match"
      v-if="match.status === e_match_status_enum.PickingPlayers"
    />

    <Button
      v-if="canPauseResume"
      size="sm"
      :variant="isPaused ? 'default' : 'destructive'"
      @click="togglePause"
      :disabled="!match.is_server_online"
    >
      {{ isPaused ? $t("match.actions.resume") : $t("match.actions.pause") }}
    </Button>

    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button size="icon" variant="outline">
          <MoreVertical class="h-3.5 w-3.5" />
          <span class="sr-only">{{ $t("common.more") }}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <template v-if="match.is_in_lineup">
          <DropdownMenuItem
            class="text-destructive"
            @click="callForOrganizer"
            :disabled="match.requested_organizer"
          >
            {{ $t("match.actions.call_support") }}
          </DropdownMenuItem>
          <DropdownMenuSeparator
            v-if="match.can_assign_server || match.is_organizer"
          />
        </template>

        <DropdownMenuItem v-if="match.can_assign_server">
          <MatchSelectServer :match="match"></MatchSelectServer>
        </DropdownMenuItem>

        <DropdownMenuItem v-if="match.is_organizer">
          <MatchSelectWinner :match="match"></MatchSelectWinner>
        </DropdownMenuItem>

        <template v-if="match.is_organizer && hasOrganizerLiveActions">
          <DropdownMenuSeparator />
          <!-- "Start" only shows when there's nothing running. Once
               a Job exists (booting OR live), the only remaining
               action is to stop it — booting needs to be cancellable
               so a stuck/wrong-server start can be undone.

               Two modes:
               - "live"  — direct game-port observer connect, no GOTV delay
               - "tv"    — GOTV/Playcast, honors tv_delay (default ~115s) -->
          <DropdownMenuSub v-if="isLive && gameStreamerStatus === 'off'">
            <Tooltip v-if="liveStartDisabledReason">
              <TooltipTrigger as-child>
                <DropdownMenuSubTrigger disabled>
                  <Radio class="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  <span>{{ $t("match.actions.start_live") }}</span>
                </DropdownMenuSubTrigger>
              </TooltipTrigger>
              <TooltipContent side="left">
                {{ liveStartDisabledReason }}
              </TooltipContent>
            </Tooltip>
            <DropdownMenuSubTrigger v-else>
              <Radio class="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <span>{{ $t("match.actions.start_live") }}</span>
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
                    gpuBlocksAction
                      ? gpuBusyReason || "GPU busy"
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
                    gpuBlocksAction
                      ? gpuBusyReason || "GPU busy"
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
            <template v-if="gameStreamerStatus === 'booting'">
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
          <DropdownMenuItem v-if="hasMatchDemos" @click="createClipsForMatch">
            {{ $t("match.actions.create_clips") }}
          </DropdownMenuItem>
        </template>

        <DropdownMenuSeparator
          v-if="match.can_start || match.can_cancel || canDeleteMatch"
        />

        <template v-if="match.can_start">
          <DropdownMenuItem
            @click.prevent.stop="startMatch"
            class="text-destructive"
            :disabled="!hasMinimumLineupPlayers"
          >
            <template
              v-if="
                match.options.map_veto &&
                match.options.best_of != match.match_maps.length
              "
            >
              {{ $t("match.actions.start_veto") }}
            </template>
            <template v-else> {{ $t("match.actions.skip_checkin") }} </template>
          </DropdownMenuItem>
        </template>

        <template v-if="match.can_cancel">
          <DropdownMenuItem class="text-destructive" @click="cancelMatch">{{
            $t("match.actions.cancel")
          }}</DropdownMenuItem>
        </template>

        <template v-if="canDeleteMatch">
          <DropdownMenuItem
            class="text-destructive"
            @click="showDeleteDialog = true"
            >{{ $t("match.actions.delete") }}</DropdownMenuItem
          >
        </template>
      </DropdownMenuContent>
    </DropdownMenu>

    <AlertDialog :open="showDeleteDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{
            $t("match.delete_confirm.title")
          }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t("match.delete_confirm.description") }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="showDeleteDialog = false">
            {{ $t("common.cancel") }}
          </AlertDialogCancel>
          <AlertDialogAction
            @click="
              deleteMatch();
              showDeleteDialog = false;
            "
          >
            {{ $t("common.delete") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";
import socket from "~/web-sockets/Socket";
import { v4 as uuidv4 } from "uuid";
import { useGpuPoolStatusStore } from "~/stores/GpuPoolStatusStore";
export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      showDeleteDialog: false,
      rconUuid: undefined as string | undefined,
      // Guards the auto-stop watcher so we don't fire `stopLive` more
      // than once when the match settles into a finished status.
      autoStopFired: false,
    };
  },
  created() {
    this.rconUuid = uuidv4();
    socket.on("rcon", this.onRconResponse);
  },
  beforeUnmount() {
    socket.removeListener("rcon", this.onRconResponse);
  },
  watch: {
    // Match transitioning out of Live (Finished/Forfeit/Tie/Surrendered/
    // Canceled) while the streamer pod is still attached — fire stopLive
    // once so the pod tears down cleanly without an organizer having to
    // remember to click Stop. Booting jobs are stopped too: a half-booted
    // pod after the match wraps is just wasted compute.
    "match.status"(status: e_match_status_enum) {
      if (status === e_match_status_enum.Live) {
        this.autoStopFired = false;
        return;
      }
      if (this.autoStopFired) return;
      if (this.gameStreamerStatus === "off") return;
      if (!this.match.is_organizer) return;
      this.autoStopFired = true;
      this.stopLiveSilently();
    },
  },
  methods: {
    async cancelMatch() {
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
    },
    async deleteMatch() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          deleteMatch: [{ match_id: this.match.id }, { success: true }],
        }),
      });

      toast({
        title: this.$t("match.actions.deleted"),
      });

      this.$router.push({
        name: "manage-matches",
      });
    },
    async startMatch() {
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
    },
    async startLive(mode: "live" | "tv") {
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
    },
    async stopLive() {
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
    },
    // Auto-stop variant — no toast on success (the pod going away is
    // self-evident from the UI), but still surface errors so a stuck
    // pod is visible.
    async stopLiveSilently() {
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            stopLive: [{ match_id: this.match.id }, { success: true }],
          }),
        });
      } catch (error: any) {
        console.error("[match-actions] auto stopLive failed:", error);
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
        toast({
          title: this.isPaused
            ? this.$t("match.actions.match_resumed")
            : this.$t("match.actions.match_paused"),
        });
      }
    },
    togglePause() {
      const command = this.isPaused ? "css_resume" : "css_pause";
      this.rconUuid = uuidv4();
      socket.event("rcon", {
        uuid: this.rconUuid,
        serverId: this.match.server_id,
        command,
      });
    },
    async callForOrganizer() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          callForOrganizer: [{ match_id: this.match.id }, { success: true }],
        }),
      });

      toast({
        title: this.$t("match.actions.requested_organizer"),
      });
    },
  },
  computed: {
    canAct() {
      return this.match.is_in_lineup || this.match.is_organizer;
    },
    isLive() {
      return this.match.status === e_match_status_enum.Live;
    },
    hasMatchDemos() {
      return (this.match.match_maps ?? []).some(
        (m: any) => (m?.demos?.length ?? 0) > 0,
      );
    },
    // True only when the live-actions block in the dropdown will render
    // at least one item — otherwise its leading separator becomes an
    // orphan (visible as a stray divider with no content following).
    hasOrganizerLiveActions() {
      const startVisible =
        this.gameStreamerStatus === "off" &&
        (this.canStartLiveDirect || this.canStartLiveTv);
      const stopVisible = this.gameStreamerStatus !== "off";
      return startVisible || stopVisible || this.hasMatchDemos;
    },
    // Direct (live) mode: the streamer pod joins the game port as an
    // observer with no GOTV delay. Available the moment the match goes
    // Live and the server is up — `can_stream_live` is the SQL truth.
    gpuBlocksAction() {
      const gpu = useGpuPoolStatusStore();
      return gpu.hasLoaded && !gpu.hasFreeGpu;
    },
    gpuBusyReason() {
      const gpu = useGpuPoolStatusStore();
      return gpu.busyReason;
    },
    canStartLiveDirect() {
      return !!this.match.can_stream_live && !this.gpuBlocksAction;
    },
    liveStartDisabledReason() {
      if (this.canStartLiveDirect || this.canStartLiveTv) return null;
      if (this.gpuBlocksAction) return this.gpuBusyReason || "GPU busy";
      if (!this.match.is_server_online) return "Server is offline";
      return "Live streaming isn't available for this match right now";
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
        this.isLive && !!this.match.is_server_online && !this.gpuBlocksAction
      );
    },
    // "off"     — no game-streamer row (Start button shown)
    // "booting" — row exists, is_live = false (Cancel item with the
    //             current boot step in the label)
    // "live"    — row exists, is_live = true (Stop button shown)
    gameStreamerStatus() {
      const row = (this.match.streams ?? []).find(
        (s: any) => s.is_game_streamer,
      );
      if (!row) return "off";
      return row.is_live ? "live" : "booting";
    },
    gameStreamerRow() {
      return (this.match.streams ?? []).find((s: any) => s.is_game_streamer);
    },
    // Sub-line under "Cancel Live Stream" while the streamer pod is
    // booting. Mirrors the pod's `status` text so the operator can see
    // exactly which boot step is running ("Downloading CS2…", "Logging
    // in…", etc) — and the error message if the pod reported errored.
    gameStreamerStatusLine() {
      const row = this.gameStreamerRow as any;
      if (!row) return "";
      if (row.status === "errored") {
        return row.error_message || "errored";
      }
      const status = row.status as string | undefined;
      if (!status) return "";
      const stepLabels: Record<string, string> = {
        launching_steam: "Launching Steam…",
        logging_in: "Logging in…",
        downloading_cs2: "Downloading CS2…",
        launching_cs2: "Launching CS2…",
        connecting_to_game: "Connecting to game…",
        starting_capture: "Starting capture…",
      };
      return stepLabels[status] || status.replace(/_/g, " ");
    },
    currentMap() {
      return this.match.match_maps?.find((m: any) => m.is_current_map);
    },
    isPaused() {
      return this.currentMap?.status === e_match_map_status_enum.Paused;
    },
    canPauseResume() {
      if (!this.match.is_organizer) {
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
