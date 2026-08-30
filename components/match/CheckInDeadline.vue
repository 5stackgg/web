<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

const props = withDefaults(
  defineProps<{
    cancelsAt?: string | null;
    // `cta` is the slot milled into the amber button -- it borrows the
    // button's own ink and darkens itself to read as recessed. `standalone`
    // sits on the page background and has to draw its own frame.
    variant?: "cta" | "standalone";
    checkedIn?: boolean;
    // The readout is reused for countdowns that are not a match check-in
    // deadline -- a tournament check-in window opening, or kickoff. The match
    // copy would then announce "Check in within" on a window that is not open
    // yet, and promise an auto-cancellation that nothing performs. Pass a
    // prefix (and `null` help to drop the tooltip) for those.
    prefixLabel?: string;
    helpLabel?: string | null;
  }>(),
  {
    variant: "cta",
    checkedIn: false,
  },
);

const { t } = useI18n();

// One interval per readout. A second is the smallest unit displayed, so
// anything faster is wasted wake-ups on a surface that can sit open for the
// full fifteen-minute window.
const now = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | null = null;
let rollTimer: ReturnType<typeof setTimeout> | null = null;

onMounted(() => {
  ticker = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onBeforeUnmount(() => {
  if (ticker) {
    clearInterval(ticker);
  }
  if (rollTimer) {
    clearTimeout(rollTimer);
  }
});

// Null whenever auto-cancellation is off for the instance -- the trigger only
// stamps cancels_at when it's enabled, and there is no deadline to show if
// nothing is going to expire.
const remaining = computed(() => {
  if (!props.cancelsAt) {
    return null;
  }

  const at = new Date(props.cancelsAt).getTime();

  if (Number.isNaN(at)) {
    return null;
  }

  return Math.max(0, Math.floor((at - now.value) / 1000));
});

const label = computed(() => {
  if (remaining.value === null) {
    return null;
  }

  const hours = Math.floor(remaining.value / 3600);
  const minutes = Math.floor((remaining.value % 3600) / 60);
  const seconds = (remaining.value % 60).toString().padStart(2, "0");

  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
});

// Strictly under a minute: at exactly 60 the readout still says "1:00", and an
// alarm that fires while the clock reads a full minute left looks broken.
const urgent = computed(() => remaining.value !== null && remaining.value < 60);
const critical = computed(
  () => remaining.value !== null && remaining.value <= 10,
);

// The digits themselves are deliberately not animated: a fifteen-minute
// countdown ticks ~900 times, and animating every one of them is noise rather
// than craft. The minute rollover happens fifteen times, which is rare enough
// to register as an event -- that is the one the slot reacts to.
const rolling = ref(false);

watch(
  () => (remaining.value === null ? null : Math.floor(remaining.value / 60)),
  (minute, previous) => {
    if (minute === null || previous === null || previous === undefined) {
      return;
    }

    // Adding the class is what starts the keyframes, and rollovers are a full
    // minute apart, so the flag is always back to false before the next one --
    // no restart trick needed. (Deliberately not scheduled on a frame: a
    // backgrounded tab never runs the callback, and the animation would be
    // dropped entirely rather than merely unseen.)
    if (rollTimer) {
      clearTimeout(rollTimer);
    }

    rolling.value = true;
    rollTimer = setTimeout(() => {
      rolling.value = false;
    }, 560);
  },
);

const description = computed(() => {
  if (!label.value) {
    return "";
  }

  const prefix =
    props.prefixLabel ??
    (props.checkedIn
      ? t("match.check_in.deadline_checked_in")
      : t("match.check_in.deadline"));

  return `${prefix} ${label.value}`;
});

// `undefined` means "not overridden" and falls back to the match copy; an
// explicit `null` means this countdown has no consequence worth a tooltip.
const help = computed(() =>
  props.helpLabel === undefined
    ? t("match.check_in.deadline_help")
    : props.helpLabel,
);

const title = computed(() =>
  help.value ? `${description.value} — ${help.value}` : description.value,
);
</script>

<template>
  <Transition name="readout">
    <span
      v-if="label"
      class="readout font-mono"
      :class="[
        variant === 'standalone' ? 'readout--standalone' : 'readout--cta',
        { 'is-urgent': urgent, 'is-rolling': rolling },
      ]"
      role="timer"
      :aria-label="description"
      :title="title"
    >
      <!-- Only in the last ten seconds, and only ever as an indicator dot --
           the digits stay still so they stay readable. -->
      <span v-if="critical" class="readout-alarm" aria-hidden="true">
        <span class="readout-alarm-ping"></span>
        <span class="readout-alarm-core"></span>
      </span>
      <span class="readout-digits">{{ label }}</span>
    </span>
  </Transition>
</template>

<style scoped>
/* An instrument set into the control: a slot milled out of the button face,
   holding a live readout. Recessed rather than applied -- inset shadow, no
   outer edge -- so it reads as part of the button instead of a chip stuck on
   top of it. */
.readout {
  --readout-ink: hsl(var(--tac-amber-foreground));
  --readout-well: hsl(0 0% 0% / 0.2);
  --readout-rim: hsl(0 0% 0% / 0.16);
  /* Rim, then a shadow cast down from the top edge -- the light on this face
     comes from above, so that is what makes the slot read as cut in rather
     than stuck on. Held in a variable because the flare below has to restate
     the resting stack to add a layer to it. */
  --readout-shadow:
    inset 0 0 0 1px var(--readout-rim), inset 0 1px 1.5px hsl(0 0% 0% / 0.22);

  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  overflow: hidden;
  border-radius: 0.1875rem;
  padding: 0.22rem 0.36rem;
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
  color: var(--readout-ink);
  background: var(--readout-well);
  box-shadow: var(--readout-shadow);
  /* Urgency arrives as a wash rather than a jump cut -- long enough to be felt
     as the state changing, short enough to still be a warning. */
  transition:
    color 460ms cubic-bezier(0.4, 0, 0.2, 1),
    background-color 460ms cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 460ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Off the amber button there is no face to cut into, so the slot draws its own
   amber rim instead of a shadow. */
.readout--standalone {
  --readout-ink: hsl(var(--tac-amber));
  --readout-well: hsl(var(--tac-amber) / 0.08);
  --readout-rim: hsl(var(--tac-amber) / 0.28);
}

/* Red text on an amber face is muddy, so the last minute inverts the slot
   instead: the well goes near-black and the digits light up inside it. */
.readout.is-urgent {
  --readout-ink: hsl(0 92% 71%);
  --readout-well: hsl(0 0% 0% / 0.55);
  --readout-rim: hsl(0 90% 62% / 0.5);
  animation: readout-arm 640ms cubic-bezier(0.16, 1, 0.3, 1) 1;
}

/* One ring, once, at the crossing. Both frames carry the resting stack, so the
   flare is purely additive and lands back on exactly what the transition above
   is already driving -- no fighting over box-shadow at the handoff. The ring is
   the element's own shadow rather than a child, because `overflow: hidden`
   below would clip anything drawn outward from inside. */
@keyframes readout-arm {
  from {
    box-shadow:
      var(--readout-shadow),
      0 0 0 0 hsl(0 90% 62% / 0.5);
  }
  to {
    box-shadow:
      var(--readout-shadow),
      0 0 0 9px hsl(0 90% 62% / 0);
  }
}

/* Minute rollover: the new value is wiped up into the slot behind its edges,
   like a counter turning over. `overflow: hidden` on the well is what makes it
   read mechanical instead of a floating fade. */
.readout-digits {
  display: inline-block;
}

.readout.is-rolling .readout-digits {
  animation: readout-roll 560ms cubic-bezier(0.16, 1, 0.3, 1) 1;
}

@keyframes readout-roll {
  0% {
    transform: translateY(-52%);
    opacity: 0;
  }
  60% {
    opacity: 1;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

.readout-alarm {
  position: relative;
  display: grid;
  place-items: center;
  width: 0.3rem;
  height: 0.3rem;
  flex: none;
}

.readout-alarm-ping {
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background: hsl(0 92% 66% / 0.65);
  animation: readout-ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
}

.readout-alarm-core {
  width: 0.3rem;
  height: 0.3rem;
  border-radius: 9999px;
  background: hsl(0 92% 71%);
}

@keyframes readout-ping {
  75%,
  100% {
    transform: scale(2.4);
    opacity: 0;
  }
}

/* The slot slides out of the button's right edge on arrival and retracts the
   same way. Asymmetric on purpose: arrivals get the slow decelerate so they
   land, departures get out of the way. */
.readout-enter-active {
  transition:
    opacity 280ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 280ms cubic-bezier(0.16, 1, 0.3, 1);
}

.readout-leave-active {
  transition:
    opacity 150ms ease-in,
    transform 150ms ease-in;
}

.readout-enter-from,
.readout-leave-to {
  opacity: 0;
  transform: translateX(0.45rem);
}

@media (prefers-reduced-motion: reduce) {
  /* Colour still carries the urgency; only the movement goes away. */
  .readout.is-urgent,
  .readout.is-rolling .readout-digits,
  .readout-alarm-ping {
    animation: none;
  }

  .readout-enter-active,
  .readout-leave-active {
    transition: opacity 120ms linear;
  }

  .readout-enter-from,
  .readout-leave-to {
    transform: none;
  }
}
</style>
