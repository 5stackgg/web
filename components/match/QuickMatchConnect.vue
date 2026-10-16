<script setup lang="ts">
import { e_match_status_enum } from "~/generated/zeus";
import HeightSwap from "~/components/ui/transitions/HeightSwap.vue";
</script>

<template>
  <div v-if="showConnectPanel">
    <template v-if="isLive && canWatch && !match.tv_connection_string">
      <div
        class="flex items-center gap-2 p-4 rounded-lg border bg-foreground/10 mb-2"
      >
        <Tv class="w-4 h-4" />
        {{ $t("match.server.tv_delay", { delay: match.options.tv_delay }) }}
      </div>
    </template>
    <template
      v-if="isLive && match.tv_connection_string && !match.connection_link"
    >
      <div
        class="flex items-center gap-2 p-4 rounded-lg border bg-foreground/10 mb-2"
      >
        <ClipBoard
          :data="match.tv_connection_string"
          class="grow shrink-0 p-3 rounded-md h-12 w-12 connect-action"
        >
          <div class="flex items-center justify-center gap-2">
            <Tv class="w-4 h-4" />
            <span>{{ $t("match.server.join_tv_stream") }}</span>
          </div>
        </ClipBoard>
      </div>
      <Separator class="my-4" label="OR" v-if="match.connection_string" />
    </template>

    <!-- One slot, three states -- offline, booting, connect -- traded through
         a measured height swap instead of popping between very different
         boxes on the frame the server comes up. The two booting variants
         (before and after the connection string exists) share one branch and
         one key, so the string arriving mid-boot changes nothing on screen. -->
    <HeightSwap>
      <div v-if="showOffline" key="offline">
        <div
          class="flex items-center gap-2 p-4 rounded-lg border border-destructive/30 bg-destructive/10"
        >
          <div
            class="flex items-center justify-center gap-3 rounded-md p-3 w-full bg-background/40 text-destructive"
          >
            <AlertTriangle class="w-4 h-4 shrink-0" />
            <span class="text-sm font-medium">{{
              $t("match.server.offline")
            }}</span>
          </div>
        </div>
      </div>

      <!-- Booting and connect share one card, the size of the join row, so
           one turns into the other where it stands. -->
      <div v-else-if="showBooting" key="booting">
        <div class="qmc-card" :style="posterStyle">
          <div class="qmc-boot">
            <div class="qmc-glass">
              <Spinner class="qmc-boot-icon" />
              <span class="qmc-boot-text">
                <b>{{ $t("match.veto.start.booting") }}</b>
                <span>{{ $t("match.veto.start.booting_line") }}</span>
              </span>
            </div>
          </div>
          <p
            v-if="match.server_error"
            class="mt-2 max-w-full whitespace-pre-wrap break-words text-xs leading-relaxed text-[hsl(var(--tac-amber))]"
          >
            {{ match.server_error }}
          </p>
        </div>
      </div>

      <div v-else-if="showConnect" key="connect">
        <div class="qmc-card flex items-center gap-2" :style="posterStyle">
          <ClipBoard
            :data="match.connection_string"
            class="qmc-copy shrink-0 p-3 h-12 w-12 connect-action"
            :class="{
              grow: !match.connection_link,
            }"
          >
            <div
              class="flex items-center justify-center gap-2"
              v-if="!match.connection_link"
            >
              <Copy class="w-4 h-4" />
              <span>{{ $t("match.server.join_as_spectator") }}</span>
            </div>
          </ClipBoard>
          <template v-if="match.connection_link">
            <a
              :href="match.connection_link"
              class="w-full"
              @click="handleClick"
            >
              <!-- Gold, and ringing until the player is in the game. -->
              <Button
                variant="outline"
                class="qmc-join tac-amber-cta w-full h-12"
                :class="{ 'is-calling': isInLineup && !inGame && !isLoading }"
                :loading="isLoading"
              >
                <div class="relative flex items-center" v-if="isInLineup">
                  <span
                    class="absolute w-2 h-2 rounded-full animate-ping"
                    :class="inGame ? 'bg-green-500' : 'bg-red-500'"
                  ></span>
                  <span
                    class="relative w-2 h-2 rounded-full"
                    :class="inGame ? 'bg-green-500' : 'bg-red-500'"
                  ></span>
                </div>
                <span>{{ $t("match.server.join_server") }}</span>
                <ExternalLink class="w-4 h-4" />
              </Button>
            </a>
          </template>
        </div>
      </div>
    </HeightSwap>
  </div>
</template>

<style scoped>
/* The map being played, as the veto's start panels show it, with the
   server's state on glass over it; the join row takes the same card. */
.qmc-card {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  padding: 12px;
  border-radius: 12px;
  background-color: hsl(var(--popover));
  background-size: cover;
  background-position: center;
  box-shadow:
    inset 0 0 0 1px hsl(0 0% 100% / 0.1),
    0 12px 32px rgb(0 0 0 / 0.35);
}
.qmc-card::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  background: linear-gradient(
    90deg,
    hsl(240 10% 4% / 0.82),
    hsl(240 10% 4% / 0.45)
  );
}
.qmc-boot {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
}
.qmc-glass {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  max-width: 100%;
  padding: 6px 16px 6px 12px;
  border-radius: 10px;
  background: hsl(240 10% 4% / 0.72);
  backdrop-filter: blur(10px);
  box-shadow:
    inset 0 0 0 1px hsl(0 0% 100% / 0.12),
    0 12px 32px rgb(0 0 0 / 0.45);
}
.qmc-boot-icon {
  flex: none;
  width: 22px;
  height: 22px;
  color: hsl(var(--tac-amber));
}
.qmc-boot-text {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.qmc-boot-text > * {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* Both lines fit the join row's 48px, so the swap moves nothing. */
.qmc-boot-text b {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.2;
}
.qmc-boot-text span {
  font-size: 12px;
  line-height: 1.2;
  color: hsl(0 0% 100% / 0.72);
}
.qmc-copy {
  border-color: transparent;
  background: hsl(240 10% 4% / 0.72);
  backdrop-filter: blur(10px);
  box-shadow: inset 0 0 0 1px hsl(0 0% 100% / 0.12);
}
.qmc-join {
  position: relative;
  font-weight: 700;
}
/* The ring is its own layer, grown with transform and faded with opacity,
   so the pulse never repaints the button. ~6px out on each side. */
.qmc-join.is-calling::after {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  box-shadow: 0 0 0 2px hsl(var(--tac-amber) / 0.55);
  pointer-events: none;
  animation: qmc-call 1.8s cubic-bezier(0, 0, 0.2, 1) 600ms infinite;
}
@keyframes qmc-call {
  0% {
    opacity: 1;
    scale: 1;
  }
  75%,
  100% {
    opacity: 0;
    scale: 1.04 1.25;
  }
}
@media (prefers-reduced-motion: reduce) {
  .qmc-join.is-calling::after {
    animation: none;
    opacity: 0;
  }
}
</style>

<script lang="ts">
import { ExternalLink, Copy, Tv, AlertTriangle } from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
import { Button } from "~/components/ui/button";
import ClipBoard from "~/components/ClipBoard.vue";
import { e_player_roles_enum } from "~/generated/zeus";

export default {
  components: {
    Spinner,
    Button,
    ExternalLink,
    Copy,
    Tv,
    AlertTriangle,
    ClipBoard,
  },
  props: {
    match: {
      type: Object,
      required: true,
    },
    // The surrounding UI shows the server starting (the veto's start stage):
    // no booting spinner here, and the connect box waits until the maps have
    // landed in the page's cards, so it arrives on its own beat.
    hideBooting: {
      type: Boolean,
      default: false,
    },
    // Owned by the match page, which flips it once CameraRequirementOverlay
    // confirms this viewer's own camera is live.
    cameraReady: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      isLoading: false,
    };
  },
  methods: {
    handleClick() {
      this.isLoading = true;
      setTimeout(() => {
        this.isLoading = false;
      }, 10000);
    },
  },
  computed: {
    isLive() {
      return this.match.status === e_match_status_enum.Live;
    },
    posterStyle() {
      const maps = this.match.match_maps ?? [];
      const map = (maps.find((entry: any) => entry.is_current_map) ?? maps[0])
        ?.map;
      return map?.poster
        ? { backgroundImage: `url("${map.poster}")` }
        : undefined;
    },
    isAssignedOnDemandServerBooting() {
      return (
        this.isLive &&
        !!this.match.server_id &&
        !this.match.is_server_online &&
        this.match.server_type !== "Dedicated"
      );
    },
    showBootingState() {
      return this.isAssignedOnDemandServerBooting && !this.hideBooting;
    },
    // The swap's three branches, mutually exclusive by construction. Booting
    // deliberately covers both before and after the connection string arrives.
    showOffline() {
      return (
        !!this.match.connection_string &&
        !this.match.is_server_online &&
        this.match.server_type === "Dedicated"
      );
    },
    showBooting() {
      if (this.match.connection_string) {
        return (
          !this.match.is_server_online &&
          this.match.server_type !== "Dedicated" &&
          !this.hideBooting
        );
      }

      return this.showBootingState;
    },
    showConnect() {
      return (
        !!this.match.connection_string &&
        this.match.is_server_online &&
        !this.hideBooting
      );
    },
    showConnectPanel() {
      return !!this.me && this.isLive && !this.blockedByCamera;
    },
    // A rostered player has to publish a camera before the server details are
    // shown. Coaches and organizers never publish, so they are never blocked.
    blockedByCamera() {
      return (
        !!this.match.options?.camera_required &&
        !!this.match.is_in_lineup &&
        !this.cameraReady
      );
    },
    me() {
      return useAuthStore().me;
    },
    canWatch() {
      if (this.match.is_in_lineup) {
        return false;
      }

      if (this.match.is_organizer) {
        return this.match.is_server_online;
      }

      return useAuthStore().isRoleAbove(this.minimumRoleToStream);
    },
    minimumRoleToStream() {
      return (
        useApplicationSettingsStore().settings.find(
          (setting) => setting.name === "public.minimum_role_to_stream",
        )?.value || e_player_roles_enum.user
      );
    },
    lobby() {
      return useMatchLobbyStore().lobbyChat[`match:${this.match?.id}`];
    },
    isInLineup() {
      return this.match.is_in_lineup;
    },
    inGame() {
      const player =
        (this.lobby?.get(this.me?.steam_id) as unknown as {
          inGame?: boolean;
        }) || undefined;
      return !!player?.inGame;
    },
  },
};
</script>
