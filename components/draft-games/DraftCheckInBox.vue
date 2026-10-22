<script setup lang="ts">
import { computed, ref } from "vue";
import { CheckCircle2, LucideVideo } from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
import CameraSetup from "~/components/match/CameraSetup.vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useCameraSetup } from "~/composables/useCameraSetup";
import { useCountdown } from "~/composables/useCountdown";
import { useMinLoading } from "~/composables/useMinLoading";
import { generateMutation } from "~/graphql/graphqlGen";
import getGraphqlClient from "~/graphql/getGraphqlClient";

// The draft header's check-in box. While you still have to check in it is the
// button; once you have, or if you are only watching, it stays the same amber
// box with its clock and dashes, so the header never changes size under it.
const props = defineProps<{
  match: Record<string, any>;
  deadline: string | null;
  ready: number;
  total: number;
  canCheckIn: boolean;
  checkedIn: boolean;
}>();

const { seconds } = useCountdown(
  computed(() => props.deadline),
  ref(0),
);
const clock = computed(
  () =>
    `${Math.floor(seconds.value / 60)}:${String(seconds.value % 60).padStart(2, "0")}`,
);
// Red only for the last ten seconds: the draft's own window is a minute long,
// and a box that is red from the moment it appears stops meaning anything.
const final = computed(
  () => !!props.deadline && seconds.value > 0 && seconds.value <= 10,
);

// Checking in is refused server-side without a live camera, so the box sets
// one up first instead (same as CheckIntoMatch on the match page).
const cameraSetupOpen = ref(false);
const camera = useCameraSetup(
  () => String(props.match.id),
  () =>
    props.match.options?.camera_required === true &&
    props.match.is_in_lineup === true,
);
const needsCamera = computed(
  () =>
    props.match.options?.camera_required === true &&
    props.match.is_in_lineup === true &&
    !camera.ready.value,
);

const { loading, run } = useMinLoading();
const checkIn = () => {
  if (needsCamera.value) {
    cameraSetupOpen.value = true;
    return;
  }
  void run(() =>
    getGraphqlClient().mutate({
      mutation: generateMutation({
        checkIntoMatch: [{ match_id: props.match.id }, { success: true }],
      }),
    }),
  );
};
</script>

<template>
  <component
    :is="canCheckIn ? 'button' : 'div'"
    :type="canCheckIn ? 'button' : undefined"
    :role="canCheckIn ? undefined : 'status'"
    class="checkin-box"
    :class="{ 'is-action': canCheckIn, 'is-final': final }"
    :disabled="canCheckIn && loading ? true : undefined"
    @click="canCheckIn && checkIn()"
  >
    <span class="checkin-box-label">
      <Spinner v-if="canCheckIn && loading" class="size-4 shrink-0" />
      <LucideVideo
        v-else-if="canCheckIn && needsCamera"
        class="size-4 shrink-0"
      />
      <CheckCircle2 v-else-if="canCheckIn || checkedIn" class="size-4 shrink-0" />
      <span class="truncate">
        {{
          canCheckIn
            ? needsCamera
              ? $t("camera.setup_before_check_in")
              : $t("match.check_in.check_in")
            : checkedIn
              ? $t("match.check_in.checked_in")
              : $t("draft_games.header.checkin_watch_title")
        }}
      </span>
    </span>
    <span v-if="deadline" class="checkin-box-clock">{{ clock }}</span>
    <span class="checkin-box-seats" :style="{ '--seats': total }">
      <i
        v-for="seat in total"
        :key="seat"
        :class="{ 'is-in': seat <= ready }"
        aria-hidden="true"
      ></i>
      <span class="sr-only">
        {{ $t("draft_games.header.checkin_count", { ready, total }) }}
      </span>
    </span>
  </component>

  <Dialog v-if="canCheckIn" v-model:open="cameraSetupOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ $t("camera.title") }}</DialogTitle>
        <DialogDescription>{{ $t("camera.subtitle") }}</DialogDescription>
      </DialogHeader>
      <CameraSetup
        :qr-data-url="camera.qrDataUrl.value"
        :ready="camera.ready.value"
        @open-on-this-computer="camera.openOnThisComputer"
      />
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.checkin-box {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: 1fr auto;
  align-items: center;
  column-gap: 0.875rem;
  row-gap: 0.5rem;
  width: 100%;
  max-width: 18rem;
  padding: 0.75rem 0.875rem 0.6875rem 1rem;
  color: hsl(var(--tac-amber-foreground));
  background: linear-gradient(
    135deg,
    var(--tac-amber-cta-from) 0%,
    hsl(var(--tac-amber)) 50%,
    var(--tac-amber-cta-to) 100%
  );
  text-align: left;
  transition:
    filter 0.2s ease,
    background 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    color 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}
.checkin-box.is-action {
  cursor: pointer;
}
.checkin-box.is-action:hover {
  filter: brightness(1.06);
}
.checkin-box.is-action:focus-visible {
  outline: 2px solid hsl(var(--foreground));
  outline-offset: -4px;
}
.checkin-box:disabled {
  cursor: default;
}
.checkin-box.is-final {
  color: hsl(0 0% 100%);
  background: linear-gradient(
    135deg,
    color-mix(in hsl, hsl(var(--destructive)), white 15%) 0%,
    hsl(var(--destructive)) 50%,
    color-mix(in hsl, hsl(var(--destructive)), black 12%) 100%
  );
}
.checkin-box-label {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.checkin-box-clock {
  padding-left: 0.875rem;
  border-left: 1px solid rgb(0 0 0 / 0.22);
  font-size: 1.625rem;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.is-final .checkin-box-clock {
  border-left-color: rgb(255 255 255 / 0.35);
}
.checkin-box-seats {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(var(--seats), minmax(0, 1fr));
  gap: 3px;
}
.checkin-box-seats i {
  height: 4px;
  border-radius: 2px;
  background: rgb(0 0 0 / 0.18);
  transition: background 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}
.checkin-box-seats i.is-in {
  background: rgb(0 0 0 / 0.72);
}
.is-final .checkin-box-seats i {
  background: rgb(255 255 255 / 0.25);
}
.is-final .checkin-box-seats i.is-in {
  background: hsl(0 0% 100%);
}
/* Narrow headers stack the teams and stretch the box down beside them, so the
   label, clock and dashes stack too. */
@container draft-header (max-width: 619px) {
  .checkin-box {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto auto;
    align-content: center;
    justify-items: center;
    padding: 0.625rem 0.75rem;
    text-align: center;
  }
  .checkin-box-label {
    font-size: 0.6875rem;
  }
  .checkin-box-clock {
    padding-left: 0;
    border-left: 0;
  }
  .checkin-box-seats {
    width: 100%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .checkin-box,
  .checkin-box-seats i {
    transition: none;
  }
}
</style>
