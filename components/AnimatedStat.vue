<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    value: string | number | null | undefined;
    // Milliseconds between one changed character and the next; 0 flips them
    // all at once.
    stagger?: number;
  }>(),
  { stagger: 0 },
);

// Split into characters so each digit flips on its own (split-flap board).
// Only characters that actually change re-key, so unchanged digits stay put;
// all changed digits flip together (no left-to-right cascade) — like an old
// flip clock rolling to the next value.
const chars = computed(() => {
  const s =
    props.value === null || props.value === undefined
      ? ""
      : String(props.value);
  return [...s];
});

// The cascade counts from the first character that changed, so a shared
// prefix holds still.
const firstChanged = ref(0);
const leaving = ref<Record<number, { key: string; ch: string }>>({});
let generation = 0;
let leavingTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  chars,
  (next, previous = []) => {
    let index = 0;
    while (index < next.length && next[index] === previous[index]) {
      index++;
    }
    firstChanged.value = index;
    // Emptied, it clears at once: what it held may be meant to disappear.
    if (!props.stagger || !previous.length || !next.length) {
      leaving.value = {};
      return;
    }
    generation++;
    const gone: Record<number, { key: string; ch: string }> = {};
    for (let i = index; i < previous.length; i++) {
      if (previous[i] !== next[i] && previous[i] !== " ") {
        gone[i] = { key: `${generation}|${i}|${previous[i]}`, ch: previous[i] };
      }
    }
    leaving.value = gone;
    clearTimeout(leavingTimer);
    leavingTimer = setTimeout(
      () => {
        leaving.value = {};
      },
      (Math.max(next.length, previous.length) - index) * props.stagger + 320,
    );
  },
  { immediate: true, flush: "sync" },
);
onBeforeUnmount(() => clearTimeout(leavingTimer));

// Joined and right-to-left scripts can't be cut into separate leaves without
// breaking their letters apart, so they change as a whole instead.
const whole = computed(
  () =>
    props.stagger > 0 &&
    /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/.test(chars.value.join("")),
);

const slots = computed(() =>
  Math.max(
    chars.value.length,
    ...Object.keys(leaving.value).map((index) => Number(index) + 1),
  ),
);

const delayOf = (index: number) =>
  props.stagger
    ? {
        animationDelay: `${Math.max(0, index - firstChanged.value) * props.stagger}ms`,
      }
    : undefined;
</script>

<template>
  <span class="flip-stat">
    <template v-if="!stagger">
      <span
        v-for="(ch, i) in chars"
        :key="i + '|' + ch"
        class="flip-stat__char"
        >{{ ch === " " ? " " : ch }}</span
      >
    </template>
    <span v-else-if="whole" :key="chars.join('')" class="flip-stat__whole">{{
      chars.join("")
    }}</span>
    <template v-else>
      <span
        v-for="slot in slots"
        :key="slot"
        class="flip-stat__slot"
        :class="{ 'is-gone': slot > chars.length }"
        :style="slot > chars.length ? delayOf(slot - 1) : undefined"
      >
        <span
          v-if="leaving[slot - 1]"
          :key="leaving[slot - 1].key"
          class="flip-stat__out"
          :class="{ 'is-over': slot <= chars.length }"
          :style="delayOf(slot - 1)"
          aria-hidden="true"
          >{{ leaving[slot - 1].ch }}</span
        >
        <span
          v-if="slot <= chars.length"
          :key="slot - 1 + '|' + chars[slot - 1]"
          class="flip-stat__char is-staggered"
          :style="delayOf(slot - 1)"
          >{{ chars[slot - 1] === " " ? " " : chars[slot - 1] }}</span
        >
      </span>
    </template>
  </span>
</template>

<style scoped>
.flip-stat {
  display: inline-flex;
  perspective: 360px;
  white-space: pre;
}

/* Hinges at the top edge so the leaf falls in from the top and settles flat —
   a split-flap / stock-ticker flip. */
/* No `will-change` here on purpose: these pages mount 100+ AnimatedStats, and a
   permanent hint would pin a compositor layer per character at idle. The flip is
   a one-shot transform/opacity animation, which the compositor promotes on its
   own while it runs — so the hint costs memory without buying smoothness.
   The same goes for a fill mode (`forwards`/`both`) and backface-visibility:
   Chrome counts a finished animation that still fills as running, so the layer
   would never be released. The last keyframe is the resting style, and the
   leaf never turns past 90deg, so neither is needed. */
.flip-stat__char {
  display: inline-block;
  transform-origin: top center;
  animation: flip-char 440ms cubic-bezier(0.2, 0.78, 0.32, 1);
}

/* A character waiting its turn shows its first frame (folded away) instead of
   its final one. `backwards` only fills before the flip starts, so the layer
   still lets go once it lands. */
.flip-stat__char.is-staggered {
  animation-fill-mode: backwards;
}

/* The old and new leaf share one cell while they trade. Perspective has to
   sit on the cell: it only reaches an element's own children. */
.flip-stat__slot {
  position: relative;
  display: inline-block;
  perspective: 360px;
}
/* An old leaf with a new one landing in its cell takes no width, so the new
   letters keep their own spacing instead of the wider of the two. */
.flip-stat__out.is-over {
  position: absolute;
  top: 0;
  left: 0;
}
/* The outgoing leaf falls away from its bottom edge as the new one drops in.
   It fills both ways (shown until its turn, gone once over) and is unmounted
   right after, so no finished animation is left holding a layer. */
.flip-stat__out {
  display: inline-block;
  transform-origin: bottom center;
  animation: flip-away 260ms cubic-bezier(0.4, 0, 0.9, 0.6) both;
  pointer-events: none;
}

.flip-stat__whole {
  animation: flip-whole-in 240ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes flip-whole-in {
  from {
    opacity: 0;
  }
}

/* A trailing leaf with nothing to replace it closes its cell as it folds, so
   whatever follows the stat slides up to it rather than jumping once it goes. */
.flip-stat__slot.is-gone {
  overflow: hidden;
  animation: flip-slot-close 260ms cubic-bezier(0.4, 0, 0.9, 0.6) both;
}

@keyframes flip-slot-close {
  from {
    max-width: 1em;
  }
  to {
    max-width: 0;
  }
}

@keyframes flip-away {
  from {
    transform: rotateX(0deg);
    opacity: 1;
  }
  to {
    transform: rotateX(90deg);
    opacity: 0;
  }
}

@keyframes flip-char {
  0% {
    transform: rotateX(-90deg);
    opacity: 0;
  }
  55% {
    transform: rotateX(0deg);
    opacity: 1;
  }
  100% {
    transform: rotateX(0deg);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .flip-stat__char {
    animation: none;
  }
  .flip-stat__out {
    display: none;
  }
  .flip-stat__slot.is-gone,
  .flip-stat__whole {
    animation: none;
  }
}
</style>
