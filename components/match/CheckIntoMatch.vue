<template>
  <div v-if="isInMatch && match.can_check_in" class="flex flex-col">
    <!-- The window is a deadline: the match auto-cancels at cancels_at whether
         or not anyone is looking. The clock is set into the button rather than
         parked above it, because the button is the thing being timed -- the
         action and the time left to take it are one control, not two notices.
         `mode="out-in"` so the outgoing state clears before the next lands;
         min-h holds the row so nothing below it moves during the handoff. -->
    <div class="grid min-h-[2.625rem] items-center">
      <Transition name="checkin-state" mode="out-in">
        <!-- Checking in is refused server-side without a live camera, so the
             button becomes the way to set one up rather than a dead end. -->
        <button
          v-if="!isCheckedIn && needsCamera"
          key="camera"
          type="button"
          :class="[tacticalCtaButtonClasses, 'w-full', deadlineGutterClasses]"
          @click="cameraSetupOpen = true"
        >
          <LucideVideo class="w-4 h-4" />
          <span>{{ $t("camera.setup_before_check_in") }}</span>
          <span class="absolute inset-y-0 right-3 flex items-center">
            <CheckInDeadline :cancels-at="match.cancels_at" />
          </span>
        </button>

        <button
          v-else-if="!isCheckedIn"
          key="check-in"
          type="button"
          :class="[
            tacticalCtaButtonClasses,
            'w-full disabled:cursor-default',
            deadlineGutterClasses,
          ]"
          :disabled="loading"
          @click="checkIn"
        >
          <span
            v-if="loading"
            class="absolute inset-0 flex items-center justify-center"
          >
            <Spinner />
          </span>
          <CheckCircle2 class="w-4 h-4" :class="{ invisible: loading }" />
          <span :class="{ invisible: loading }">{{
            $t("match.check_in.check_in")
          }}</span>
          <span
            class="absolute inset-y-0 right-3 flex items-center"
            :class="{ invisible: loading }"
          >
            <CheckInDeadline :cancels-at="match.cancels_at" />
          </span>
        </button>

        <!-- No button left to set the clock into, but the deadline still
             applies to everyone else -- it keeps its slot, now framed in its
             own amber rather than cut out of the button's. -->
        <div v-else key="checked-in" class="flex items-center gap-3">
          <Badge variant="secondary" class="shrink-0 whitespace-nowrap">
            {{ $t("match.check_in.checked_in") }}
          </Badge>
          <CheckInDeadline
            :cancels-at="match.cancels_at"
            variant="standalone"
            checked-in
          />
          <span class="min-w-0 text-xs text-muted-foreground">
            {{
              $t("match.check_in.checked_in_description", {
                required: playersRequiredToStart,
                checked: totalCheckedIn,
              })
            }}
          </span>
        </div>
      </Transition>
    </div>

    <Dialog v-model:open="cameraSetupOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ $t("camera.title") }}</DialogTitle>
          <DialogDescription>{{ $t("camera.subtitle") }}</DialogDescription>
        </DialogHeader>
        <CameraSetup
          :qr-data-url="cameraQrDataUrl"
          :ready="cameraReady"
          @open-on-this-computer="openCameraOnThisComputer"
        />
      </DialogContent>
    </Dialog>
  </div>
</template>

<script lang="ts">
import { computed, ref } from "vue";
import { CheckCircle2, LucideVideo } from "lucide-vue-next";
import CameraSetup from "~/components/match/CameraSetup.vue";
import CheckInDeadline from "~/components/match/CheckInDeadline.vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useCameraSetup } from "~/composables/useCameraSetup";
import { generateMutation } from "~/graphql/graphqlGen";
import { e_check_in_settings_enum } from "~/generated/zeus";
import { tacticalCtaButtonClasses } from "~/utilities/tacticalClasses";
import { Spinner } from "~/components/ui/spinner";
import { useMinLoading } from "~/composables/useMinLoading";

export default {
  components: {
    CheckCircle2,
    LucideVideo,
    Spinner,
    CameraSetup,
    CheckInDeadline,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
  },
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  setup(props: { match: Record<string, any> }) {
    const cameraSetupOpen = ref(false);
    const camera = useCameraSetup(
      () => String(props.match.id),
      () =>
        props.match.options?.camera_required === true &&
        props.match.is_in_lineup === true,
    );

    // Only a rostered player publishes; coaches and organizers never do.
    const needsCamera = computed(
      () =>
        props.match.options?.camera_required === true &&
        props.match.is_in_lineup === true &&
        !camera.ready.value,
    );

    return {
      tacticalCtaButtonClasses,
      ...useMinLoading(),
      cameraSetupOpen,
      needsCamera,
      cameraQrDataUrl: camera.qrDataUrl,
      cameraReady: camera.ready,
      openCameraOnThisComputer: camera.openOnThisComputer,
    };
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    // The readout is absolutely positioned so the label stays centred in the
    // space it actually has; the button has to give up that space or a long
    // label (the camera CTA) runs underneath the digits. No deadline, no
    // gutter -- auto-cancellation being off leaves cancels_at null.
    deadlineGutterClasses() {
      return this.match?.cancels_at ? "pr-[4.75rem]" : "";
    },
    isCheckedIn() {
      return this.isInMatch?.checked_in;
    },
    isInMatch() {
      return this.players.find((player) => {
        return player.steam_id === this.me?.steam_id;
      });
    },
    players() {
      if (!this.match) {
        return [];
      }

      const players = [];

      players.push(...this.match.lineup_1.lineup_players);
      players.push(...this.match.lineup_2.lineup_players);

      return players;
    },
    totalCheckedIn() {
      return this.players?.filter(({ checked_in }) => {
        return checked_in;
      }).length;
    },
    playersRequiredToStart() {
      switch (this.match.options.check_in_setting) {
        case e_check_in_settings_enum.Players:
          return this.match.min_players_per_lineup * 2;
        case e_check_in_settings_enum.Captains:
          return 2;
        case e_check_in_settings_enum.Admin:
          return 1;
      }
    },
  },
  methods: {
    async checkIn() {
      await this.run(() =>
        this.$apollo.mutate({
          mutation: generateMutation({
            checkIntoMatch: [
              {
                match_id: this.match.id,
              },
              {
                success: true,
              },
            ],
          }),
        }),
      );
    },
  },
};
</script>

<style scoped>
/* Checking in is a commitment, and the swap should feel like one settling
   rather than a flicker. Both halves share the same grid cell, so the outgoing
   state sinks and clears before the confirmation rises into its place --
   short, one direction, no cross-fade mush. */
.checkin-state-enter-active {
  transition:
    opacity 240ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}

.checkin-state-leave-active {
  transition:
    opacity 140ms ease-in,
    transform 140ms ease-in;
}

.checkin-state-enter-from {
  opacity: 0;
  transform: translateY(0.375rem);
}

.checkin-state-leave-to {
  opacity: 0;
  transform: translateY(-0.25rem);
}

@media (prefers-reduced-motion: reduce) {
  .checkin-state-enter-from,
  .checkin-state-leave-to {
    transform: none;
  }

  .checkin-state-enter-active,
  .checkin-state-leave-active {
    transition: opacity 120ms linear;
  }
}
</style>
