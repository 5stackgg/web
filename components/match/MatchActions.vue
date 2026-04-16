<script setup lang="ts">
import { MoreVertical } from "lucide-vue-next";
import MatchSelectServer from "~/components/match/MatchSelectServer.vue";
import MatchSelectWinner from "~/components/match/MatchSelectWinner.vue";
import DropdownMenuItem from "~/components/ui/dropdown-menu/DropdownMenuItem.vue";
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
    };
  },
  created() {
    this.rconUuid = uuidv4();
    socket.on("rcon", this.onRconResponse);
  },
  beforeUnmount() {
    socket.removeListener("rcon", this.onRconResponse);
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
