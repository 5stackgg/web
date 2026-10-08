<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ technique: string }>();

// One figure per way of throwing, drawn to be told apart at a glance: the pose
// is how you are standing, the amber is what you add to it -- speed lines for
// walking and running, a chevron under the feet for leaving the ground.
type Pose = { head: [number, number]; body: string; cue?: string };

const POSES: Record<string, Pose> = {
  Stationary: {
    head: [16, 7],
    body: "M16 11v9M16 13.5l-4 5M16 13.5l4 5M16 20l-3 8M16 20l3 8",
  },
  Walking: {
    head: [16.5, 7],
    body: "M16.5 11L16 20M16.3 13.5l-3.8 4.5M16.3 13.5l4.2 3.5M16 20l-4.5 8M16 20l4.5 8",
    cue: "M4 15h4.5",
  },
  Running: {
    head: [19.5, 7.5],
    body: "M18.5 11L15 19.5M17.5 13.5l4.5 1.5l1-3.5M17.5 13.5l-4.5 1l-1.5 3M15 19.5l5 2l-1 6.5M15 19.5l-3.5 4.5l-4.5.5",
    cue: "M3 12h5M2 17h5",
  },
  Crouch: {
    head: [15, 13.5],
    body: "M15 17.5l-1 5M14.7 19l4.3 2.5M14 22.5l5.5 1l-2.5 4.5M14 22.5l-2 5.5",
  },
  Jump: {
    head: [16, 5],
    body: "M16 9v8M16 11l-4.5-3M16 11l4.5-3M16 17l-2.5 6M16 17l2.5 6",
    cue: "M12 28l4-3l4 3",
  },
  WalkJump: {
    head: [16.5, 5],
    body: "M16.5 9L16 17.5M16.3 11.5l-4-2M16.3 11.5l4.2 2.5M16 17.5l-4.5 6M16 17.5l4.5 5",
    cue: "M12 28l4-3l4 3M4 13h4.5",
  },
  RunJump: {
    head: [19.5, 5],
    body: "M18.5 8.5L15 17M17.5 11l4.5 1.5l1-3.5M17.5 11l-4.5 1l-1.5 3M15 17l5 1.5v5M15 17l-3.5 4l-4.5.5",
    cue: "M12 28l4-3l4 3M3 9.5h5M2 14.5h5",
  },
  CrouchJump: {
    head: [15.5, 7.5],
    body: "M15.5 11.5l-1 5M15.2 13l4.3 2.5M14.5 16.5l5.5.5l-2 4.5M14.5 16.5l3 3l-3.5 2.5",
    cue: "M11.5 28l4-3l4 3",
  },
};

const pose = computed(() => POSES[props.technique] ?? POSES.Stationary);
</script>

<template>
  <svg
    viewBox="0 0 32 32"
    fill="none"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M4 29.5h24" class="stroke-white/15" stroke-width="1.5" />
    <path
      v-if="pose.cue"
      :d="pose.cue"
      class="stroke-[hsl(var(--tac-amber))]"
      stroke-width="2"
    />
    <circle :cx="pose.head[0]" :cy="pose.head[1]" r="3" class="fill-current" />
    <path :d="pose.body" stroke="currentColor" stroke-width="2" />
  </svg>
</template>
