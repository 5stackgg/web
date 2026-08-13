<template>
  <div
    v-if="isInMatch && match.can_check_in"
    class="flex min-h-[2.625rem] items-center"
  >
    <!-- Checking in is refused server-side without a live camera, so the
         button becomes the way to set one up rather than a dead end. -->
    <button
      v-if="!isCheckedIn && needsCamera"
      type="button"
      :class="[tacticalCtaButtonClasses, 'w-full']"
      @click="cameraSetupOpen = true"
    >
      <LucideVideo class="w-4 h-4" />
      <span>{{ $t("camera.setup_before_check_in") }}</span>
    </button>

    <button
      v-else-if="!isCheckedIn"
      type="button"
      :class="[tacticalCtaButtonClasses, 'w-full disabled:cursor-default']"
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
    </button>
    <div v-else class="flex items-center gap-3">
      <Badge variant="secondary" class="shrink-0 whitespace-nowrap">
        {{ $t("match.check_in.checked_in") }}
      </Badge>
      <span class="text-xs text-muted-foreground">
        {{
          $t("match.check_in.checked_in_description", {
            required: playersRequiredToStart,
            checked: totalCheckedIn,
          })
        }}
      </span>
    </div>

    <Dialog v-model:open="cameraSetupOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ $t("camera.title") }}</DialogTitle>
          <DialogDescription>{{ $t("camera.subtitle") }}</DialogDescription>
        </DialogHeader>
        <CameraSetup
          :token="cameraToken"
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
    const camera = useCameraSetup(() => String(props.match.id));

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
      cameraToken: camera.token,
      cameraQrDataUrl: camera.qrDataUrl,
      cameraReady: camera.ready,
      openCameraOnThisComputer: camera.openOnThisComputer,
    };
  },
  computed: {
    me() {
      return useAuthStore().me;
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
