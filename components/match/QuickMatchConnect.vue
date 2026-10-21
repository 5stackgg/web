<script setup lang="ts">
import { e_match_status_enum } from "~/generated/zeus";
import HeightSwap from "~/components/ui/transitions/HeightSwap.vue";
</script>

<template>
  <!-- The match page's strip along the foot of its header: the same states
       as the card, in a row, with the server's address masked until asked
       for so a stream or a screenshot never carries it by accident. -->
  <Transition
    v-if="variant === 'bar'"
    enter-active-class="mcb-fold"
    leave-active-class="mcb-fold"
    enter-from-class="mcb-folded"
    leave-to-class="mcb-folded"
  >
    <div v-if="showBar" class="grid grid-rows-[1fr]">
      <div class="min-h-0">
        <div
          class="relative flex items-center gap-3 border-t border-white/[0.06] bg-black/25 px-4 py-3 max-sm:flex-wrap md:px-6"
        >
          <Transition
            enter-active-class="transition-opacity [transition-duration:240ms] motion-reduce:![transition-duration:1ms]"
            leave-active-class="transition-opacity [transition-duration:240ms] motion-reduce:![transition-duration:1ms]"
            enter-from-class="opacity-0"
            leave-to-class="opacity-0"
          >
            <span
              v-if="showBooting"
              class="mcb-progress"
              aria-hidden="true"
            ></span>
          </Transition>
          <img
            v-if="currentMap?.poster"
            :src="currentMap.poster"
            alt=""
            class="h-10 w-16 shrink-0 rounded-md object-cover ring-1 ring-inset ring-white/10"
          />
          <!-- The words flip over in place, a departures board turning from
               booting to ready, while the spinner's slot closes behind it. -->
          <div class="grid min-w-0 flex-1 gap-0.5" role="status">
            <span class="flex min-w-0 items-center text-sm font-semibold">
              <span
                class="mcb-icon-slot"
                :class="{ 'is-open': showOffline || showBooting }"
              >
                <Transition
                  enter-active-class="mcb-icon-in"
                  leave-active-class="mcb-icon-out"
                  enter-from-class="mcb-icon-from"
                  leave-to-class="mcb-icon-from"
                >
                  <span v-if="showOffline" key="offline" class="mcb-icon">
                    <AlertTriangle class="size-3.5 text-destructive" />
                  </span>
                  <span v-else-if="showBooting" key="booting" class="mcb-icon">
                    <Spinner class="size-3.5 text-[hsl(var(--tac-amber))]" />
                  </span>
                </Transition>
              </span>
              <AnimatedStat
                :value="title"
                :stagger="30"
                class="whitespace-nowrap"
                :class="showOffline && 'text-destructive'"
              />
              <span
                v-if="facts"
                class="ml-1 truncate font-normal text-muted-foreground"
              >
                · {{ facts }}
              </span>
            </span>
            <!-- The second line changes shape between booting and ready, so it
                 fades across rather than flipping letter for letter. -->
            <Transition
              mode="out-in"
              enter-active-class="transition-opacity [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
              leave-active-class="transition-opacity [transition-duration:110ms] ease-in motion-reduce:![transition-duration:1ms]"
              enter-from-class="opacity-0"
              leave-to-class="opacity-0"
            >
              <span
                v-if="showBooting && match.server_error"
                key="error"
                class="whitespace-pre-wrap break-words text-xs text-[hsl(var(--tac-amber))]"
              >
                {{ match.server_error }}
              </span>
              <span
                v-else-if="detail || showConnect"
                :key="phase"
                class="flex h-[18px] min-w-0 items-center gap-2 text-xs leading-[18px] text-muted-foreground"
              >
                <span
                  v-if="detail"
                  class="min-w-0 shrink-0 overflow-hidden whitespace-nowrap"
                  :class="showConnect && 'font-mono'"
                >
                  <AnimatedStat :value="detail" :stagger="12" />
                </span>
                <template v-if="showConnect">
                  <!-- One width whether masked or shown (a mono character is
                       1ch), so the eye beside it never moves. Masked, the address
                       is not in the page at all. -->
                  <span
                    class="grid min-w-0 shrink items-center overflow-hidden whitespace-nowrap font-mono"
                    :style="{ width: `${address.length}ch` }"
                  >
                    <Transition
                      enter-active-class="transition-opacity [transition-duration:240ms] motion-reduce:![transition-duration:1ms]"
                      leave-active-class="transition-opacity [transition-duration:160ms] motion-reduce:![transition-duration:1ms]"
                      enter-from-class="opacity-0"
                      leave-to-class="opacity-0"
                    >
                      <span
                        v-if="!revealed"
                        class="mcb-redact [grid-area:1/1]"
                        aria-hidden="true"
                      ></span>
                    </Transition>
                    <AnimatedStat
                      :value="revealed ? address : ''"
                      :stagger="12"
                      class="[grid-area:1/1]"
                    />
                  </span>
                  <button
                    type="button"
                    class="mcb-icon-button relative grid size-[18px] shrink-0 place-items-center rounded text-muted-foreground"
                    :aria-label="
                      revealed
                        ? $t('match.server.hide_address')
                        : $t('match.server.show_address')
                    "
                    :aria-pressed="revealed"
                    @click="revealed = !revealed"
                  >
                    <EyeOff v-if="revealed" class="size-3.5" />
                    <Eye v-else class="size-3.5" />
                  </button>
                  <button
                    type="button"
                    class="mcb-icon-button relative grid size-[18px] shrink-0 place-items-center rounded text-muted-foreground"
                    :aria-label="$t('match.server.copy_connect')"
                    @click="copyConnect"
                  >
                    <Check
                      v-if="copied"
                      class="size-3.5 text-[hsl(var(--tac-amber))]"
                    />
                    <Copy v-else class="size-3.5" />
                  </button>
                </template>
              </span>
            </Transition>
          </div>

          <Transition
            mode="out-in"
            enter-active-class="transition-opacity [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
            leave-active-class="transition-opacity [transition-duration:110ms] ease-in motion-reduce:![transition-duration:1ms]"
            enter-from-class="opacity-0"
            leave-to-class="opacity-0"
          >
            <div
              v-if="showTv || showPlayerJoin"
              :key="phase"
              class="flex items-center gap-2 max-sm:w-full"
            >
              <ClipBoard
                v-if="showTv"
                :data="match.tv_connection_string"
                class="h-10 w-auto shrink-0 px-3 max-sm:flex-1"
              >
                <span class="flex items-center gap-2">
                  <Tv class="size-4" />
                  {{ $t("match.server.join_tv_stream") }}
                </span>
              </ClipBoard>
              <template v-if="showPlayerJoin">
                <Button
                  variant="outline"
                  class="qmc-join h-10 px-5 max-sm:flex-1"
                  :class="[
                    showConnect ? 'tac-amber-cta' : 'is-locked',
                    { 'is-calling': showConnect && !inGame && !isLoading },
                  ]"
                  :disabled="!showConnect"
                  :loading="isLoading"
                  @click="join"
                >
                  <span v-if="showConnect" class="relative flex size-2">
                    <span
                      class="absolute inline-flex size-full animate-ping rounded-full motion-reduce:animate-none"
                      :class="inGame ? 'bg-green-500' : 'bg-red-500'"
                    ></span>
                    <span
                      class="relative inline-flex size-2 rounded-full"
                      :class="inGame ? 'bg-green-500' : 'bg-red-500'"
                    ></span>
                  </span>
                  <span>{{ $t("match.server.join_server") }}</span>
                  <ExternalLink class="size-4" />
                </Button>
              </template>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </Transition>
  <div v-else-if="showConnectPanel">
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
.mcb-fold {
  transition:
    grid-template-rows 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}
.mcb-fold > * {
  overflow: hidden;
}
.mcb-folded {
  grid-template-rows: 0fr;
  opacity: 0;
}
.mcb-progress {
  position: absolute;
  inset-inline: 0;
  top: -1px;
  height: 2px;
  overflow: hidden;
  pointer-events: none;
}
.mcb-progress::after {
  content: "";
  position: absolute;
  inset-block: 0;
  left: 0;
  width: 30%;
  background: linear-gradient(
    90deg,
    transparent,
    hsl(var(--tac-amber)),
    transparent
  );
  animation: mcb-slide 1.4s cubic-bezier(0.45, 0, 0.55, 1) infinite;
}
@keyframes mcb-slide {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(340%);
  }
}
/* The status icon's slot is open only while there is one to show, and it
   closes as the spinner leaves, so the title slides into its place. */
.mcb-icon-slot {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 0;
  margin-right: 0;
  transition:
    width 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    margin-right 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}
.mcb-icon-slot.is-open {
  width: 0.875rem;
  margin-right: 0.5rem;
}
.mcb-icon {
  grid-area: 1 / 1;
  display: grid;
  place-items: center;
}
.mcb-icon-in {
  transition:
    opacity 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}
.mcb-icon-out {
  transition:
    opacity 0.16s ease-in,
    transform 0.16s ease-in;
}
.mcb-icon-from {
  opacity: 0;
  transform: scale(0.4);
}
/* A redaction bar the address's own width, striped so it reads as hidden
   rather than empty. */
.mcb-redact {
  height: 10px;
  border-radius: 3px;
  background: repeating-linear-gradient(
    135deg,
    hsl(var(--muted-foreground) / 0.34) 0 3px,
    hsl(var(--muted-foreground) / 0.16) 3px 6px
  );
}
.mcb-icon-button::before {
  content: "";
  position: absolute;
  inset: -8px -4px;
}
.mcb-icon-button {
  transition: color 0.15s ease-out;
}
.mcb-icon-button:focus-visible {
  outline: 2px solid hsl(var(--foreground) / 0.8);
  outline-offset: 2px;
}
@media (hover: hover) and (pointer: fine) {
  .mcb-icon-button:hover {
    color: hsl(var(--foreground));
  }
}
.qmc-join.is-locked:disabled {
  opacity: 1;
  color: hsl(var(--muted-foreground));
  border-color: hsl(var(--border));
  background: hsl(var(--muted) / 0.35);
}
@media (prefers-reduced-motion: reduce) {
  .mcb-icon-in,
  .mcb-icon-out,
  .mcb-icon-slot {
    transition-duration: 1ms;
  }
  .mcb-fold {
    transition-duration: 1ms;
  }
  .mcb-progress::after {
    animation: none;
    width: 100%;
    opacity: 0.35;
  }
}
</style>

<script lang="ts">
import {
  ExternalLink,
  Check,
  Copy,
  Eye,
  EyeOff,
  Tv,
  AlertTriangle,
} from "lucide-vue-next";
import mapLabel from "~/utilities/mapLabel";
import AnimatedStat from "~/components/AnimatedStat.vue";
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
    AnimatedStat,
    Check,
    Eye,
    EyeOff,
    ClipBoard,
  },
  props: {
    match: {
      type: Object,
      required: true,
    },
    // "bar" lays the same states out as the strip along the match header.
    variant: {
      type: String,
      default: "card",
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
      revealed: false,
      copied: false,
    };
  },
  beforeUnmount() {
    clearTimeout(this.copiedTimer);
  },
  methods: {
    handleClick() {
      this.isLoading = true;
      setTimeout(() => {
        this.isLoading = false;
      }, 10000);
    },
    // Opened from a click rather than a link, so hovering Join Server never
    // puts the address in the browser's status bar.
    join() {
      this.handleClick();
      window.location.href = this.match.connection_link;
    },
    async copyConnect() {
      try {
        await navigator.clipboard.writeText(this.match.connection_string);
      } catch {
        return;
      }
      this.copied = true;
      clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => {
        this.copied = false;
      }, 1500);
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
    phase() {
      if (this.showOffline) {
        return "offline";
      }
      return this.showBooting ? "booting" : "ready";
    },
    detail() {
      if (this.showBooting) {
        return this.$t("match.veto.start.booting_line");
      }
      if (this.showTvDelay) {
        return this.$t("match.server.tv_delay", {
          delay: this.match.options.tv_delay,
        });
      }
      if (this.showConnect) {
        return this.connectParts.prefix;
      }
      return "";
    },
    // "connect" stays readable; everything after it is the part to keep off
    // a stream.
    connectParts() {
      const command = this.match.connection_string ?? "";
      const match = command.match(/^(connect)\s+(.*)$/i);
      return match
        ? { prefix: match[1], address: match[2] }
        : { prefix: "", address: command };
    },
    address() {
      return this.connectParts.address;
    },
    currentMap() {
      const maps = this.match.match_maps ?? [];
      return (maps.find((entry: any) => entry.is_current_map) ?? maps[0])?.map;
    },
    facts() {
      return [
        this.currentMap ? mapLabel(this.currentMap) : "",
        this.match.e_region?.description ?? this.match.region ?? "",
      ]
        .filter(Boolean)
        .join(" · ");
    },
    title() {
      if (this.showOffline) {
        return this.$t("match.server.offline");
      }
      if (this.showBooting) {
        return this.$t("match.veto.start.booting");
      }
      return this.$t("match.server.ready");
    },
    showTvDelay() {
      return this.isLive && this.canWatch && !this.match.tv_connection_string;
    },
    showTv() {
      return (
        this.isLive &&
        !!this.match.tv_connection_string &&
        !this.match.connection_link
      );
    },
    // A player's Join Server holds its place, locked, while the server boots.
    showPlayerJoin() {
      return (
        !!this.match.connection_link || (this.isInLineup && this.showBooting)
      );
    },
    showBar() {
      return (
        this.showConnectPanel &&
        (this.showOffline ||
          this.showBooting ||
          this.showConnect ||
          this.showTv ||
          this.showTvDelay)
      );
    },
  },
};
</script>
